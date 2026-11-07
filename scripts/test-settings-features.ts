import 'dotenv/config';
import axios from 'axios';
import { sql, redis } from '@ace/shared/clients';

const BASE_URL = 'http://localhost:3004';

async function runSettingsVerification() {
  console.log('===============================================================');
  console.log('   🧪 BIBLIO SYSTEM BRAIN: SETTINGS & CONFIG VERIFICATION      ');
  console.log('===============================================================');

  // 1. Provision a dedicated clean test merchant
  const testPhone = '2348011223344';
  const testMerchantId = 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6';
  const testVendorId = testMerchantId;

  // Clean previous records
  await sql`DELETE FROM merchant_integrations WHERE merchant_id = ${testMerchantId}::uuid`;
  await sql`DELETE FROM vendors WHERE id = ${testVendorId}::uuid OR merchant_id = ${testMerchantId}::uuid`;
  await sql`DELETE FROM merchants WHERE id = ${testMerchantId}::uuid OR phone_number_id = ${testPhone}`;

  // Create clean merchant record
  await sql`
    INSERT INTO merchants (
      id, name, phone_number_id, owner_first_name, owner_last_name,
      subscription_tier, dialect, tone_guide, business_policies, delivery_info,
      created_at, updated_at
    )
    VALUES (
      ${testMerchantId}::uuid, 'Test Boutique Lagos', ${testPhone}, 'Chioma', 'Eze',
      'starter', 'pidgin', 'Friendly, respectful, use light street slang', 'No returns after 48h', 'Pickups at Lekki 1',
      NOW(), NOW()
    )
  `;

  // Create corresponding vendor record for Status Engine
  await sql`
    INSERT INTO vendors (
      id, merchant_id, personal_number, business_line_number, session_status, auto_status_enabled, posting_frequency_hours,
      status_strategy, margin_weight, velocity_weight, created_at, updated_at
    )
    VALUES (
      ${testVendorId}::uuid, ${testMerchantId}::uuid, ${testPhone}, ${testPhone}, 'connected', true, 4,
      'balanced', 0.70, 0.30, NOW(), NOW()
    )
  `;

  // Issue merchant auth token
  const { authEngine } = await import('@ace/shared/auth/index.js');
  const token = await authEngine.issueToken(testMerchantId, 'merchant');
  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log(`\n✅ Provisioned Test Merchant: ${testMerchantId}`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: STORE & BUSINESS PROFILE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Testing Store Profile & Business Details (GET & PATCH) ---');
  const patchProfileRes = await axios.patch(
    `${BASE_URL}/merchants/${testMerchantId}`,
    {
      name: 'Chioma Luxury Footwear & Wigs',
      ownerFirstName: 'Chioma',
      ownerLastName: 'Eze-Okafor',
      deliveryInfo: 'Fulfillment hub at Block 12, Admiralty Way, Lekki Phase 1',
      businessPolicies: '48-hour return window for unworn footwear with receipt',
      physicalAddress: 'Suite 4, Silverbird Galleria, Victoria Island, Lagos',
      operatingHours: { monday: '09:00 - 18:00', saturday: '10:00 - 16:00' },
      supportsPickup: true,
      cancelWindowMinutes: 15,
      softMode: false,
    },
    { headers: authHeaders }
  );
  console.log('PATCH /merchants/:id Status:', patchProfileRes.status, patchProfileRes.data);
  if (!patchProfileRes.data.ok) throw new Error('Profile update failed');

  const getProfileRes = await axios.get(`${BASE_URL}/merchants/${testMerchantId}`, { headers: authHeaders });
  console.log('GET /merchants/:id Profile:', {
    name: getProfileRes.data?.name,
    owner: `${getProfileRes.data?.owner_first_name} ${getProfileRes.data?.owner_last_name}`,
    deliveryInfo: getProfileRes.data?.delivery_info,
    supportsPickup: getProfileRes.data?.supports_pickup,
  });
  if (getProfileRes.data?.name !== 'Chioma Luxury Footwear & Wigs') {
    throw new Error('Profile verification failed: name mismatch');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: TONE & DIALECT CALIBRATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing Tone & Dialect Calibration (Pidgin -> Lagos -> Formal) ---');
  const testDialects = ['lagos', 'formal', 'pidgin'];
  for (const dialect of testDialects) {
    const dialectRes = await axios.patch(
      `${BASE_URL}/merchants/${testMerchantId}`,
      {
        dialect,
        toneGuide: `Calibrated for ${dialect} cadence: Polite, swift price anchor, zero loss.`,
      },
      { headers: authHeaders }
    );
    console.log(`Dialect update to [${dialect}]:`, dialectRes.data);
  }
  const checkDialect = await sql`SELECT dialect, tone_guide FROM merchants WHERE id = ${testMerchantId}::uuid`;
  console.log('Final Database Dialect State:', checkDialect[0]);
  if (checkDialect[0].dialect !== 'pidgin') throw new Error('Dialect did not persist');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: GLOBAL AUTONOMY BOUNDARIES & FINANCIAL CEILINGS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing Global Autonomy Boundaries & Pricing Safeguards ---');
  const boundaryRes = await axios.patch(
    `${BASE_URL}/merchants/${testMerchantId}`,
    {
      maxDiscountPercentage: 12,
      autoDispatchRiders: true,
      feePaddingModel: 'buyer_pays_all',
    },
    { headers: authHeaders }
  );
  console.log('Autonomy Boundaries Status:', boundaryRes.data);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: WHATSAPP STATUS ENGINE & BROADCAST STRATEGY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Testing WhatsApp Status Automation Engine ---');
  const getStatusRes = await axios.get(`${BASE_URL}/merchants/${testMerchantId}/status-settings`, {
    headers: authHeaders,
  });
  console.log('Initial Status Settings:', getStatusRes.data?.settings);

  const updateStatusRes = await axios.patch(
    `${BASE_URL}/merchants/${testMerchantId}/status-settings`,
    {
      autoStatusEnabled: true,
      postingFrequencyHours: 6,
      approveBeforePost: false,
      statusStrategy: 'margin_priority',
      marginWeight: 0.85,
      velocityWeight: 0.15,
    },
    { headers: authHeaders }
  );
  console.log('Update Status Engine Response:', updateStatusRes.data);
  if (!updateStatusRes.data.ok) throw new Error('Status settings update failed');

  const verifyStatus = await axios.get(`${BASE_URL}/merchants/${testMerchantId}/status-settings`, {
    headers: authHeaders,
  });
  console.log('Verified Updated Status Engine:', {
    strategy: verifyStatus.data?.settings?.status_strategy,
    frequency: verifyStatus.data?.settings?.posting_frequency_hours,
    marginWeight: verifyStatus.data?.settings?.margin_weight,
  });
  if (verifyStatus.data?.settings?.status_strategy !== 'margin_priority') {
    throw new Error('Status engine strategy was not updated');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: SUBSCRIPTION TIERS & PLATFORM CAPABILITIES
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Testing Subscription Tiers & Feature Gates ---');
  const initialFeatures = await axios.get(`${BASE_URL}/merchants/${testMerchantId}/features`, {
    headers: authHeaders,
  });
  const starterCustomKeys = initialFeatures.data?.entitlements?.find((e: any) => e.id === 'custom_api_keys');
  console.log('Initial Tier (Starter):', {
    tier: initialFeatures.data?.currentTier,
    customApiKeysAllowed: starterCustomKeys?.isAllowed,
  });
  if (starterCustomKeys?.isAllowed === true) {
    throw new Error('Starter tier should NOT allow custom_api_keys');
  }

  // Upgrade to Enterprise tier
  const upgradeRes = await axios.post(
    `${BASE_URL}/merchants/${testMerchantId}/billing/upgrade`,
    { targetTier: 'enterprise', paymentMethod: 'admin_grant' },
    { headers: authHeaders }
  );
  console.log('Tier Upgrade Response:', upgradeRes.data);
  if (!upgradeRes.data.ok || upgradeRes.data.tier !== 'enterprise') {
    throw new Error('Tier upgrade failed');
  }

  const upgradedFeatures = await axios.get(`${BASE_URL}/merchants/${testMerchantId}/features`, {
    headers: authHeaders,
  });
  const enterpriseCustomKeys = upgradedFeatures.data?.entitlements?.find((e: any) => e.id === 'custom_api_keys');
  console.log('Upgraded Tier (Enterprise):', {
    tier: upgradedFeatures.data?.currentTier,
    customApiKeysAllowed: enterpriseCustomKeys?.isAllowed,
  });
  if (!enterpriseCustomKeys?.isAllowed) {
    throw new Error('Enterprise tier should unlock custom_api_keys');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: INTEGRATIONS & DISPATCH API KEYS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Testing Logistics & Integration Credentials (Gokada, Kwik, BYOK) ---');
  const updateKeysRes = await axios.patch(
    `${BASE_URL}/merchants/${testMerchantId}/integrations`,
    {
      dispatch: {
        gokada: 'gok_live_secret_key_88294719',
        kwik: 'kwik_api_key_lagos_9921',
      },
    },
    { headers: authHeaders }
  );
  console.log('Update Integrations Response:', updateKeysRes.data);

  const getKeysRes = await axios.get(`${BASE_URL}/merchants/${testMerchantId}/integrations`, {
    headers: authHeaders,
  });
  console.log('Retrieved Integrations (Masked for Security):', {
    gokada: getKeysRes.data?.dispatch?.gokada,
    hasGokada: getKeysRes.data?.dispatch?.hasGokada,
    kwik: getKeysRes.data?.dispatch?.kwik,
    hasKwik: getKeysRes.data?.dispatch?.hasKwik,
  });
  if (!getKeysRes.data?.dispatch?.hasGokada || (!getKeysRes.data?.dispatch?.gokada.includes('•') && !getKeysRes.data?.dispatch?.gokada.includes('*'))) {
    throw new Error('API key security masking failed or key not recorded');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: AUTONOMOUS VOICE CALLING CONFIGURATION & SCRIPT BUILDER
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Testing Autonomous Voice Calling Config & Speech Synthesis ---');
  const getVoiceRes = await axios.get(`${BASE_URL}/merchants/${testMerchantId}/voice-config`, {
    headers: authHeaders,
  });
  console.log('Voice Call Initial Config:', getVoiceRes.data?.config);

  const updateVoiceRes = await axios.put(
    `${BASE_URL}/merchants/${testMerchantId}/voice-config`,
    {
      enabled: true,
      requireApproval: true,
      voicePersona: 'polite_nigerian_female',
      approvalThresholdAmount: 50000,
    },
    { headers: authHeaders }
  );
  console.log('Voice Config Saved:', updateVoiceRes.data);

  // Test voice preview script generation
  const scriptPreview = await axios.post(
    `${BASE_URL}/merchants/${testMerchantId}/voice-preview`,
    {
      purpose: 'order_confirmation',
      orderTotal: '₦38,500',
      deliveryAddress: '14 Admiralty Way, Lekki 1',
      voicePersona: 'polite_nigerian_female',
    },
    { headers: authHeaders }
  );
  console.log('Generated Voice Call Script Preview:', scriptPreview.data?.scriptPreview?.slice(0, 140) + '...');
  if (!scriptPreview.data?.scriptPreview) throw new Error('Voice script preview failed');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: STATUTORY ACCOUNT DELETION (App Store 5.1.1(v) & NDPA 2023)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 8. Testing Statutory Account Erasure & Data Compliance ---');
  const deleteRes = await axios.post(
    `${BASE_URL}/merchants/${testMerchantId}/delete-account`,
    { confirmation: 'DELETE' },
    { headers: authHeaders }
  );
  console.log('Account Erasure Response:', deleteRes.data);
  if (!deleteRes.data.success && !deleteRes.data.ok) throw new Error('Account deletion failed');

  const checkDeleted = await sql`SELECT id FROM merchants WHERE id = ${testMerchantId}::uuid`;
  console.log('Post-Deletion Database Check:', checkDeleted.length === 0 ? 'Purged ✓' : 'Still exists');
  if (checkDeleted.length !== 0) throw new Error('Merchant record was not deleted');

  console.log('\n===============================================================');
  console.log('   🎉 ALL 8 SETTINGS SUBSYSTEM VERIFICATIONS PASSED 100%!     ');
  console.log('===============================================================');
  process.exit(0);
}

runSettingsVerification().catch((err) => {
  console.error('\n❌ SETTINGS VERIFICATION FAILED:', err.response?.data || err.message);
  process.exit(1);
});
