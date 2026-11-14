import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';

interface HeroProps {
  onOpenWaitlist: (phone?: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenWaitlist }) => {
  return (
    <section className="relative w-full pt-28 sm:pt-36 pb-12 sm:pb-20 overflow-hidden bg-paper-50 text-ink-950 paper-pattern">
      {/* Editorial Grid Container */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Stepped Headline Section */}
        <div className="relative w-full mb-16 sm:mb-24 lg:mb-32">
          
          {/* Top Line & Description Block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end relative z-30">
            
            {/* Headline Line 1: "Your business" */}
            <div className="lg:col-span-8 animate-entrance">
              <h1 className="hero-stagger-title font-black text-ink-950 text-5xl sm:text-7xl md:text-8xl lg:text-[130px] xl:text-[150px] tracking-tight leading-[0.88] select-none">
                Your business
              </h1>
            </div>

            {/* Short Editorial Description (Tucked under/alongside Line 1, max 320px) */}
            <div className="lg:col-span-4 pb-2 sm:pb-4 animate-entrance [animation-delay:150ms]">
              <div className="max-w-[320px] text-ink-700 text-sm sm:text-base font-normal leading-relaxed border-l-2 border-ember-500/40 pl-3">
                biblio handles your WhatsApp orders, payments, and restocking while you focus on what you make.
              </div>
            </div>
          </div>

          {/* Headline Line 2: "runs itself." (Pushed right so the two lines step down like stairs - fully unobstructed) */}
          <div className="w-full flex items-end justify-between mt-3 sm:mt-6 animate-entrance [animation-delay:200ms] relative z-30">
            {/* Mobile 3D Phone Cutout: Nestled in the open left whitespace below description, free of text collisions */}
            <div 
              onClick={() => onOpenWaitlist()}
              className="md:hidden flex-shrink-0 cursor-pointer -mb-8 -mt-2 z-40 transform rotate-0 active:scale-95 transition-transform"
              title="Join early access"
            >
              <div className="w-24 xs:w-28 filter drop-shadow-[0_20px_40px_rgba(15,17,21,0.28)]">
                <img
                  src="/hero-cutout-phone.png"
                  alt="Biblio Autonomous Commerce Engine 3D interface"
                  className="w-full h-auto object-contain pointer-events-auto"
                />
              </div>
            </div>

            <h1 className="hero-stagger-title font-black text-ink-950 text-5xl sm:text-7xl md:text-8xl lg:text-[130px] xl:text-[150px] tracking-tight leading-[0.88] text-right select-none ml-auto">
              runs <span className="text-ember-500">itself.</span>
            </h1>
          </div>

          {/* 3D Cut-out Brand Object (Only shown on md+ screens to avoid mobile text collisions; upright by default, bends only on hover) */}
          <div 
            onClick={() => onOpenWaitlist()}
            className="hidden md:block absolute top-[9%] lg:top-[7%] left-[52%] lg:left-[54%] xl:left-[54%] -translate-x-1/2 z-20 cursor-pointer transform rotate-0 hover:-rotate-12 hover:scale-105 transition-all duration-500"
            title="Join the early access"
          >
            <div className="relative md:w-44 lg:w-52 xl:w-56 filter drop-shadow-[0_24px_48px_rgba(15,17,21,0.28)]">
              <img
                src="/hero-cutout-phone.png"
                alt="Biblio Autonomous Commerce Engine 3D interface"
                className="w-full h-auto object-contain pointer-events-auto"
              />
            </div>
          </div>
        </div>

        {/* Real Lagos Merchant Warm Photography Full-Bleed Frame (12px rounded corners, 24px margins, warm light) */}
        <div className="relative w-full rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden border border-ink-950/10 shadow-elev-2 bg-paper-100">
          
          {/* Real Photo Asset */}
          <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full max-h-[640px] overflow-hidden">
            <img
              src="/hero-merchant.jpg"
              alt="Lagos merchant managing orders via Biblio WhatsApp Autonomous Engine"
              className="w-full h-full object-cover object-center transform hover:scale-[1.01] transition-transform duration-700"
            />
            
            {/* Subtle Warm Gradient Overlay at bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent pointer-events-none" />

            {/* In-Photo Trust Elements (Hospitality & Autonomous Verifications) */}
            <div className="absolute bottom-4 sm:bottom-8 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pointer-events-none">
              
              {/* Photo Caption / Merchant Context */}
              <div 
                onClick={() => onOpenWaitlist()}
                className="biblio-glass-dark px-4 py-2.5 rounded-xl pointer-events-auto max-w-sm cursor-pointer hover:border-white/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-settled-600" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    Adeola Fabrics • Balogun Market, Lagos
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-snug">
                  "Biblio closed 42 customer orders and verified ₦185,000 in bank transfers while I was at the textile mill."
                </p>
              </div>

              {/* Floating Real-Time Metrics Badge */}
              <div className="hidden md:flex items-center gap-3 biblio-glass-dark px-4 py-2 rounded-xl pointer-events-auto">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
                  <Zap className="w-3.5 h-3.5 text-ember-500" />
                  <span>24/7 WhatsApp Autonomy</span>
                </div>
                <span className="text-zinc-600">|</span>
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-settled-600" />
                  <span>Instant VAN Escrow</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Microcopy Bar under photo */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ink-400 px-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ember-500" />
            <span>Designed for Lagos merchants running 30–150 WhatsApp conversations daily</span>
          </div>
          <div className="font-mono text-[11px]">
            No laptop required • 100% Android & iOS native • Works offline
          </div>
        </div>

      </div>
    </section>
  );
};
