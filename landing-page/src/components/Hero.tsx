import React, { useState } from 'react';
import { ArrowRight, Smartphone, ShieldCheck, Zap } from 'lucide-react';

interface HeroProps {
  onOpenWaitlist: (phone?: string) => void;
}

// Actual Official Brand Vector SVGs
const WhatsAppBusinessLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2C6.48 2 2 6.48 2 12C2 13.85 2.5 15.58 3.38 17.08L2.05 21.95L7.07 20.65C8.53 21.5 10.22 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z"
      fill="#25D366"
    />
    <path
      d="M17.5 14.39C17.2 14.24 15.73 13.51 15.45 13.41C15.18 13.31 14.98 13.26 14.78 13.56C14.58 13.86 14.01 14.53 13.83 14.73C13.66 14.93 13.48 14.96 13.18 14.81C12.88 14.66 11.91 14.34 10.77 13.32C9.88 12.53 9.28 11.55 9.11 11.25C8.93 10.95 9.09 10.79 9.24 10.64C9.37 10.51 9.53 10.3 9.68 10.13C9.83 9.96 9.88 9.83 9.98 9.63C10.08 9.43 10.03 9.26 9.96 9.11C9.88 8.96 9.28 7.49 9.03 6.89C8.79 6.3 8.55 6.39 8.37 6.38C8.2 6.37 8 6.37 7.8 6.37C7.6 6.75 5.95 7.78 5.95 9.26C5.95 10.74 7.03 12.17 7.18 12.37C7.33 12.57 9.29 15.59 12.3 16.89C13.02 17.2 13.57 17.38 14.01 17.52C14.73 17.75 15.38 17.72 15.9 17.64C16.48 17.55 17.68 16.91 17.93 16.21C18.18 15.51 18.18 14.91 18.1 14.79C18.03 14.66 17.8 14.54 17.5 14.39Z"
      fill="white"
    />
  </svg>
);

const PaystackLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="3" rx="1.5" fill="#00C3F7" />
    <rect x="3" y="9" width="14" height="3" rx="1.5" fill="#00C3F7" />
    <rect x="3" y="14" width="18" height="3" rx="1.5" fill="#09A5DB" />
    <rect x="3" y="19" width="10" height="3" rx="1.5" fill="#09A5DB" />
  </svg>
);

const KwikLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path
      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
      fill="#FF6B00"
    />
  </svg>
);

const GroqLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="#F55036" strokeWidth="2.5" />
    <path d="M12 7V17M7 12H17" stroke="#F55036" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const Hero: React.FC<HeroProps> = ({ onOpenWaitlist }) => {
  const [heroPhone, setHeroPhone] = useState('');

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenWaitlist(heroPhone);
  };

  return (
    <section className="relative min-h-[92vh] pt-36 pb-24 flex flex-col justify-center items-center overflow-hidden bg-[#08090C] apple-bg-mesh apple-subtle-grid">
      {/* Precision Apple Radar Hairlines (Hardware Schematic Style) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[360px] h-[360px] sm:w-[500px] sm:h-[500px] apple-radar-arc" />
        <div className="w-[640px] h-[640px] sm:w-[820px] sm:h-[820px] apple-radar-dashed" />
        <div className="w-[960px] h-[960px] sm:w-[1180px] sm:h-[1180px] apple-radar-arc" />
        <div className="w-[1300px] h-[1300px] sm:w-[1580px] sm:h-[1580px] apple-radar-dashed" />
        <div className="absolute -top-32 w-[700px] h-[500px] bg-emerald-500/10 rounded-full blur-[130px] -z-10" />
      </div>

      {/* Floating Integration Chips With Actual Vector Logos */}
      <div className="absolute inset-0 max-w-6xl mx-auto pointer-events-none hidden md:block">
        {/* WhatsApp Business */}
        <div className="absolute top-36 left-12 lg:left-24 apple-card px-3.5 py-2.5 rounded-2xl flex items-center gap-3 animate-float-slow">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shadow-sm flex-shrink-0">
            <WhatsAppBusinessLogo />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1">
              WhatsApp Business
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">Cloud Protocol</div>
          </div>
        </div>

        {/* Paystack Escrow */}
        <div className="absolute top-32 right-12 lg:right-24 apple-card px-3.5 py-2.5 rounded-2xl flex items-center gap-3 animate-float-slow [animation-delay:1.5s]">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shadow-sm flex-shrink-0">
            <PaystackLogo />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1">
              Paystack Escrow
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">Dynamic VAN Accounts</div>
          </div>
        </div>

        {/* Kwik Delivery */}
        <div className="absolute top-[48%] left-6 lg:left-14 apple-card px-3.5 py-2.5 rounded-2xl flex items-center gap-3 animate-float-slow [animation-delay:2.5s]">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shadow-sm flex-shrink-0">
            <KwikLogo />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Kwik Delivery</div>
            <div className="text-[10px] text-zinc-400 font-mono">Instant Dispatch Webhook</div>
          </div>
        </div>

        {/* Groq Llama 3 */}
        <div className="absolute top-[52%] right-6 lg:right-16 apple-card px-3.5 py-2.5 rounded-2xl flex items-center gap-3 animate-float-slow [animation-delay:0.8s]">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shadow-sm flex-shrink-0">
            <GroqLogo />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Groq Llama 3 70B</div>
            <div className="text-[10px] text-zinc-400 font-mono">Sub-Second Negotiation</div>
          </div>
        </div>
      </div>

      {/* Main Hero Copy */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
        {/* Cohort Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-white/10 shadow-sm text-xs text-zinc-300 font-medium mb-8 backdrop-blur-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">Lagos Batch 1 Early Access</span>
          <span className="text-zinc-600">•</span>
          <span className="text-emerald-400 font-mono font-bold">82 spots remaining</span>
        </div>

        {/* Apple-style Luminous Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08] mb-6">
          Never leave money in{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200">
            your DMs.
          </span>
        </h1>

        {/* Sub-headline */}
        <p className="text-base sm:text-lg text-zinc-400 max-w-lg mx-auto font-normal leading-relaxed mb-10">
          An autonomous sales agent for your WhatsApp store. Haggles in Pidgin, locks Paystack escrow, and dispatches riders 24/7.
        </p>

        {/* Waitlist Intake Bar */}
        <div className="max-w-md mx-auto mb-10">
          <form
            onSubmit={handleHeroSubmit}
            className="flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl bg-zinc-900/80 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            <div className="flex-1 flex items-center w-full px-3.5 py-2.5">
              <Smartphone className="w-4 h-4 text-zinc-500 mr-2.5 flex-shrink-0" />
              <input
                type="tel"
                placeholder="Enter WhatsApp number (080...)"
                value={heroPhone}
                onChange={(e) => setHeroPhone(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none font-medium"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-1.5 flex-shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
            >
              <span>Join Waitlist</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Social Proof */}
          <div className="flex items-center justify-center gap-3 mt-4 text-xs text-zinc-400">
            <div className="flex -space-x-1.5 overflow-hidden">
              <span className="inline-block h-6 w-6 rounded-full ring-2 ring-zinc-900 bg-emerald-500 text-zinc-950 text-[10px] font-bold flex items-center justify-center">
                TO
              </span>
              <span className="inline-block h-6 w-6 rounded-full ring-2 ring-zinc-900 bg-teal-500 text-zinc-950 text-[10px] font-bold flex items-center justify-center">
                AM
              </span>
              <span className="inline-block h-6 w-6 rounded-full ring-2 ring-zinc-900 bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                CH
              </span>
              <span className="inline-block h-6 w-6 rounded-full ring-2 ring-zinc-900 bg-zinc-800 text-zinc-300 text-[10px] font-bold flex items-center justify-center font-mono">
                +4k
              </span>
            </div>
            <span className="font-medium">
              <strong className="text-white">4,218 Nigerian merchants</strong> already waiting
            </span>
          </div>
        </div>

        {/* Real Activity Notification Stack: iOS Lock Screen Style */}
        <div className="relative max-w-xl mx-auto px-4 mt-2 select-none group">
          {/* Stack Layer 3 (Deepest notification card, scaled down & shifted) */}
          <div className="absolute inset-x-8 -bottom-3.5 h-14 rounded-2xl bg-[#12141A]/60 border border-white/[0.04] backdrop-blur-md transform scale-[0.92] opacity-40 z-10 transition-all duration-300 group-hover:-bottom-4" />

          {/* Stack Layer 2 (Middle notification card with preview info) */}
          <div className="absolute inset-x-6 -bottom-2 h-14 rounded-2xl bg-[#161822]/80 border border-white/[0.07] backdrop-blur-md transform scale-[0.96] opacity-70 z-20 transition-all duration-300 group-hover:-bottom-2.5 flex items-center justify-between px-5 py-2">
            <div className="flex items-center gap-2.5 opacity-60">
              <div className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-[10px] font-bold">₦</div>
              <span className="text-[11px] text-zinc-300 font-medium truncate">Chidi from @lagosvintage secured #4,218</span>
            </div>
            <span className="text-[9px] text-zinc-500 font-mono">1m ago</span>
          </div>

          {/* Stack Layer 1 (Top / Front Active Notification Card) */}
          <div className="relative apple-card rounded-2xl px-5 py-3.5 border border-white/10 flex items-center justify-between gap-4 text-left shadow-2xl bg-zinc-900/85 backdrop-blur-2xl z-30 transition-all duration-300 group-hover:border-emerald-500/30">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 text-emerald-400 font-bold text-xs shadow-inner">
                ₦
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white whitespace-nowrap">
                    Tobi from @thesneakerhub
                  </span>
                  <span className="text-[11px] text-zinc-400 hidden sm:inline">
                    reserved early access
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500">
                  Lagos Early Access • Ticket #4,217
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[10px] text-zinc-500 font-mono">Just now</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] font-mono shadow-sm">
                CONFIRMED
              </span>
            </div>
          </div>
        </div>

        {/* Highlights */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400 font-medium">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>20s pairing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero fake alert losses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Instant rider dispatch</span>
          </div>
        </div>
      </div>
    </section>
  );
};
