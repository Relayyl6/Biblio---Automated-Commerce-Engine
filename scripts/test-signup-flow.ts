import 'dotenv/config';
import axios from 'axios';
import { sql, redis } from '@ace/shared/clients';

const BASE_URL = 'http://localhost:3004';

async function runTest() {
  console.log('--- 🧪 STARTING SIGNUP & ONBOARDING END-TO-END VERIFICATION ---');
  const testPhone = '2348099887766';
  const testEmail = 'new_merchant_test@biblio.africa';

  // 1. Clean up any previous test record
  await sql`DELETE FROM merchants WHERE phone_number_id = ${testPhone} OR phone_number_id = ${testEmail}`;
  await redis.del(`otp:phone:${testPhone}`);
  await redis.del(`otp:email:${testEmail}`);

  console.log('\nStep 1: Request SMS OTP via POST /auth/merchant/login');
  const step1 = await axios.post(`${BASE_URL}/auth/merchant/login`, {
    phone: testPhone,
    channel: 'sms',
  });
  console.log('Step 1 Response:', step1.data);
  if (!step1.data.ok) throw new Error('Step 1 failed');

  // Verify OTP was stored in Redis
  const cachedOtp = await redis.get(`otp:phone:${testPhone}`);
  console.log('Verified Redis OTP:', cachedOtp);
  if (!cachedOtp) throw new Error('OTP was not stored in Redis');

  console.log('\nStep 2: Request Email Fallback OTP via POST /auth/merchant/email-otp');
  const step2 = await axios.post(`${BASE_URL}/auth/merchant/email-otp`, {
    phone: testPhone,
    email: testEmail,
  });
  console.log('Step 2 Response:', step2.data);
  const cachedEmailOtp = await redis.get(`otp:email:${testEmail}`);
  console.log('Verified Redis Email OTP:', cachedEmailOtp);
  if (!cachedEmailOtp) throw new Error('Email OTP not stored in Redis');

  console.log('\nStep 3: Verify OTP for New User via POST /auth/merchant/verify');
  const step3 = await axios.post(`${BASE_URL}/auth/merchant/verify`, {
    phone: testPhone,
    code: cachedEmailOtp,
  });
  console.log('Step 3 Response:', step3.data);
  if (!step3.data.ok || !step3.data.isNewUser || !step3.data.merchantId || !step3.data.token) {
    throw new Error('Step 3 failed: expected new user with merchantId and token');
  }

  const { merchantId, token } = step3.data;
  console.log(`Generated Merchant UUID: ${merchantId}`);

  console.log('\nStep 4: Complete Profile via POST /auth/merchant/finish-profile');
  const step4 = await axios.post(`${BASE_URL}/auth/merchant/finish-profile`, {
    merchantId,
    firstName: 'Tunde',
    lastName: 'Adekunle',
    businessName: 'Lagos Footwear Hub',
    dobMonth: 'October',
    dobDay: 24,
    dobYear: 1998,
  });
  console.log('Step 4 Response:', step4.data);
  if (!step4.data.ok) throw new Error('Step 4 failed');

  console.log('\nStep 5: Verify Database Record in PostgreSQL');
  const dbRows = await sql`
    SELECT id, name, owner_first_name, owner_last_name, dob_month, dob_day, dob_year, age_verified, phone_number_id
    FROM merchants
    WHERE id = ${merchantId}::uuid
  `;
  console.log('Database Record:', dbRows[0]);
  if (!dbRows[0]) throw new Error('Merchant record not found in DB');
  if (dbRows[0].owner_first_name !== 'Tunde' || dbRows[0].owner_last_name !== 'Adekunle' || !dbRows[0].age_verified) {
    throw new Error('Database record does not match submitted profile');
  }

  console.log('\nStep 6: Existing User Login via POST /auth/merchant/verify (Subsequent Login)');
  // Put a fresh OTP for login
  await redis.set(`otp:phone:${testPhone}`, '654321', 'EX', 300);
  const step6 = await axios.post(`${BASE_URL}/auth/merchant/verify`, {
    phone: testPhone,
    code: '654321',
  });
  console.log('Step 6 Response:', step6.data);
  if (step6.data.isNewUser !== false) {
    throw new Error('Expected isNewUser: false for completed merchant profile');
  }

  console.log('\nStep 7: Authenticated Dashboard Telemetry with Bearer Token');
  const step7 = await axios.get(`${BASE_URL}/telemetry/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('Step 7 Response status:', step7.status);
  console.log('Telemetry Overview:', {
    activeChats: step7.data?.active_conversations ?? step7.data?.total_active ?? 0,
    marketPulse: step7.data?.market_pulse?.trend ?? 'General Commerce',
  });

  console.log('\nStep 8: Fetch Merchant Profile via GET /merchants/:id with Bearer Token');
  const step8 = await axios.get(`${BASE_URL}/merchants/${merchantId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('Step 8 Profile Status:', step8.status);
  console.log('Fetched Merchant Profile:', {
    id: step8.data?.id,
    name: step8.data?.name,
    owner: `${step8.data?.owner_first_name} ${step8.data?.owner_last_name}`,
    dob: `${step8.data?.dob_month} ${step8.data?.dob_day}, ${step8.data?.dob_year}`,
    ageVerified: step8.data?.age_verified,
  });

  // Clean up test record
  await sql`DELETE FROM merchants WHERE id = ${merchantId}::uuid`;
  await redis.del(`otp:phone:${testPhone}`);
  await redis.del(`otp:email:${testEmail}`);

  console.log('\n✅ ALL 8 SIGNUP & ONBOARDING VERIFICATION CHECKS PASSED PERFECTLY!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.response?.data || err.message);
  process.exit(1);
});
