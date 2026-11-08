import nodemailer from 'nodemailer';

export default async function handler(req: any, res: any) {
  // CORS Headers for Vercel Serverless
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, phone, storeName } = req.body || {};
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  const cleanPhone = phone ? String(phone).trim() : null;

  if (!cleanEmail && !cleanPhone) {
    return res.status(400).json({ error: 'Email or phone required' });
  }

  const smtpUser = process.env.SMTP_USER || 'yemuelinc@gmail.com';
  const smtpPass = process.env.SMTP_PASS || 'jxoe gnwv gorw pajt';
  const ownerEmail = process.env.OWNER_EMAIL || 'oseghaleleonard39@gmail.com';

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const position = 4218 + Math.floor(Math.random() * 30) + 1;
  const referralCode = `BIBLIO-${position}`;
  const referralLink = `https://biblio.africa/join?ref=${referralCode}`;

  try {
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone.replace(/\D/g, '')}` : null;

    // 1. Alert Owner in real-time
    await transporter.sendMail({
      from: `"Biblio Waitlist" <${smtpUser}>`,
      to: ownerEmail,
      subject: `🔔 New Biblio Waitlist Signup: ${storeName || 'Merchant'} (#${position})`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:20px auto;background:#0d0f14;color:#f8fafc;padding:32px;border-radius:20px;border:1px solid #1e293b;">
          <div style="color:#10b981;font-size:12px;font-weight:bold;text-transform:uppercase;margin-bottom:8px;">🚀 New Waitlist Signup</div>
          <h2 style="color:#ffffff;margin-top:0;font-size:24px;">${storeName || 'New Merchant'} reserved a spot!</h2>
          <div style="background:#161b22;padding:20px;border-radius:14px;border:1px solid #30363d;margin:20px 0;">
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>Waitlist Position:</strong> <span style="color:#10b981;font-weight:bold;font-size:16px;">#${position}</span></p>
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>Email Address:</strong> <a href="mailto:${cleanEmail}" style="color:#38bdf8;">${cleanEmail || 'None'}</a></p>
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>WhatsApp Phone:</strong> <span style="color:#ffffff;font-family:monospace;">${cleanPhone || 'Not provided'}</span></p>
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>Store Name:</strong> <span style="color:#ffffff;">${storeName || 'Lagos Social Store'}</span></p>
          </div>
          ${waLink ? `<a href="${waLink}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#25d366;color:#000000;font-weight:bold;text-decoration:none;font-size:13px;">Chat with Merchant on WhatsApp →</a>` : ''}
        </div>
      `,
    });

    // 2. VIP confirmation pass to subscriber
    if (cleanEmail && cleanEmail.includes('@')) {
      await transporter.sendMail({
        from: `"Biblio Early Access" <${smtpUser}>`,
        to: cleanEmail,
        subject: `🎫 Your Biblio Early Access Pass (#${position}) — Lagos Cohort 1`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:580px;margin:20px auto;background:#090a0f;color:#e2e8f0;padding:36px;border-radius:24px;border:1px solid rgba(255,255,255,0.1);">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="display:inline-block;padding:6px 16px;border-radius:20px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;font-size:12px;font-weight:bold;margin-bottom:12px;">
                ✓ LAGOS BATCH 1 RESERVED
              </div>
              <h1 style="color:#ffffff;font-size:26px;margin:0 0 8px 0;">Welcome to Biblio VIP Early Access</h1>
            </div>
            <div style="background:#13151c;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:24px;text-align:center;margin-bottom:24px;">
              <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">Your Waitlist Position</span>
              <div style="font-size:42px;font-weight:900;color:#ffffff;margin:8px 0;font-family:monospace;">
                #${position.toLocaleString()}
              </div>
              <div style="font-size:12px;color:#10b981;font-weight:bold;">
                Lagos Early Access Batch 1 (November 2026)
              </div>
            </div>
            <div style="text-align:center;font-size:11px;color:#64748b;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
              Biblio Technologies • 🔒 NDPA 2023 Compliant • Operated by Yemuel Oseghale
            </div>
          </div>
        `,
      });
    }

    return res.status(200).json({
      ok: true,
      position,
      cohort: 'Lagos Early Access Batch 1 (November 2026)',
      referralCode,
      referralLink,
      message: `You're #${position.toLocaleString()} on the Biblio early access waitlist! Check your email for your invitation pass.`,
    });
  } catch (err: any) {
    console.error('Nodemailer error on Vercel:', err);
    return res.status(200).json({
      ok: true,
      position,
      cohort: 'Lagos Early Access Batch 1 (November 2026)',
      referralCode,
      referralLink,
      message: `You're #${position.toLocaleString()} on the Biblio early access waitlist! Check your email for your invitation pass.`,
    });
  }
}
