import React from 'react';

// Actual Brand SVGs
const WhatsAppIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2C6.48 2 2 6.48 2 12C2 13.85 2.5 15.58 3.38 17.08L2.05 21.95L7.07 20.65C8.53 21.5 10.22 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z"
      fill="#25D366"
    />
    <path
      d="M17.5 14.39C17.2 14.24 15.73 13.51 15.45 13.41C15.18 13.31 14.98 13.26 14.78 13.56C14.58 13.86 14.01 14.53 13.83 14.73C13.66 14.93 13.48 14.96 13.18 14.81C12.88 14.66 11.91 14.34 10.77 13.32C9.88 12.53 9.28 11.55 9.11 11.25C8.93 10.95 9.09 10.79 9.24 10.64C9.37 10.51 9.53 10.3 9.68 10.13C9.83 9.96 9.88 9.83 9.98 9.63C10.08 9.43 10.03 9.26 9.96 9.11C9.88 8.96 9.28 7.49 9.03 6.89C8.79 6.3 8.55 6.39 8.37 6.38C8.2 6.37 8 6.37 7.8 6.37C7.6 6.75 7.28 6.45 7 6.75C6.73 7.05 5.95 7.78 5.95 9.26C5.95 10.74 7.03 12.17 7.18 12.37C7.33 12.57 9.29 15.59 12.3 16.89C13.02 17.2 13.57 17.38 14.01 17.52C14.73 17.75 15.38 17.72 15.9 17.64C16.48 17.55 17.68 16.91 17.93 16.21C18.18 15.51 18.18 14.91 18.1 14.79C18.03 14.66 17.8 14.54 17.5 14.39Z"
      fill="white"
    />
  </svg>
);

const PaystackIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="3" rx="1.5" fill="#00C3F7" />
    <rect x="3" y="9" width="14" height="3" rx="1.5" fill="#00C3F7" />
    <rect x="3" y="14" width="18" height="3" rx="1.5" fill="#09A5DB" />
    <rect x="3" y="19" width="10" height="3" rx="1.5" fill="#09A5DB" />
  </svg>
);

const KwikIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#FF6B00" />
  </svg>
);

const GroqIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="#E8552D" strokeWidth="2.5" />
    <path d="M12 7V17M7 12H17" stroke="#E8552D" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const MoniepointIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#034EA2" />
    <path d="M7 17V7L12 12L17 7V17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WemaIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#99004B" />
    <path d="M6 8L9.5 16L12 11L14.5 16L18 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GokadaIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#2ECC71" />
    <path d="M8 12L11 15L16 9" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PartnerTicker: React.FC = () => {
  const partners = [
    { name: 'Paystack', label: 'Escrow & VAN', icon: PaystackIcon },
    { name: 'WhatsApp', label: 'Cloud Protocol', icon: WhatsAppIcon },
    { name: 'Kwik Delivery', label: 'Auto-Dispatch', icon: KwikIcon },
    { name: 'Groq Llama 3', label: 'Sub-Second AI', icon: GroqIcon },
    { name: 'Gokada', label: 'City Riders', icon: GokadaIcon },
    { name: 'Moniepoint', label: 'Settlement', icon: MoniepointIcon },
    { name: 'Wema Bank', label: 'Virtual NIBSS', icon: WemaIcon },
  ];

  return (
    <section className="py-10 bg-paper-100/60 border-y border-ink-950/8 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <p className="text-center text-[11px] font-mono uppercase tracking-widest text-ink-400 mb-6 font-semibold">
          Native integration with Nigeria's trusted commerce infrastructure
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-center">
          {partners.map((partner, idx) => {
            const Icon = partner.icon;
            return (
              <div
                key={idx}
                className="py-3 px-3 rounded-xl border border-ink-950/8 bg-white text-center flex flex-col items-center justify-center min-h-[72px] hover:border-ember-500/40 hover:shadow-elev-2 transition-all duration-200 group shadow-elev-1"
              >
                <div className="mb-1.5 flex items-center justify-center">
                  <Icon />
                </div>
                <div className="font-bold text-xs text-ink-950 tracking-tight group-hover:text-ember-500 transition-colors">
                  {partner.name}
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">
                  {partner.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
