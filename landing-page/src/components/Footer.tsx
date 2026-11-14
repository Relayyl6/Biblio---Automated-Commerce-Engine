import React from 'react';
import {
  ArrowRight,
  Sparkles,
  MessageCircle,
} from 'lucide-react';

interface FooterProps {
  onOpenWaitlist?: (phone?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenWaitlist }) => {
  return (
    <footer className="relative bg-[#050608] text-zinc-400 border-t border-white/[0.08] overflow-hidden w-full max-w-[100vw]">
      {/* Top subtle ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[250px] bg-emerald-500/[0.04] blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute inset-0 apple-subtle-grid opacity-20 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12">
        {/* Pre-Footer Callout Card: Minimalist Linear / Apple High-Craft Aesthetic */}
        <div className="rounded-2xl sm:rounded-3xl apple-card p-6 sm:p-12 mb-12 sm:mb-16 border border-white/10 relative overflow-hidden bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ember-500/20 border border-ember-500/30 text-ember-400 font-mono text-[11px] mb-3 sm:mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>BATCH 1 NOW OPEN • 80 SPOTS REMAINING</span>
            </div>

            <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
              Ready to automate your WhatsApp sales?
            </h3>
            
            <p className="text-zinc-400 text-xs sm:text-base leading-relaxed mb-6 sm:mb-8 max-w-lg">
              Join 4,200+ Nigerian merchants closing deals 24/7 without fake transfer alerts, haggling stress, or missed DMs.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenWaitlist && onOpenWaitlist()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-ember-500 hover:bg-ember-600 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-ember-500/25 active:scale-98"
              >
                <span>Join Batch 1 Waitlist</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#simulator"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white/[0.05] hover:bg-white/10 text-white font-semibold text-xs sm:text-sm border border-white/10 transition-colors"
              >
                <span>Try Interactive Demo</span>
              </a>
            </div>
          </div>
        </div>

        {/* Clean, Human 4-Column Navigation Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10 pb-12 sm:pb-16 border-b border-white/[0.08]">
          {/* Brand & Location Column (Span 5 on Desktop) */}
          <div className="md:col-span-5 flex flex-col justify-between">
            <div>
              {/* Brand Lockup */}
              <a href="#" className="flex items-center gap-2 group mb-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center flex-shrink-0">
                  <img src="/biblio-logo.png" alt="Biblio Logo" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <span className="font-extrabold text-base tracking-tight text-white leading-none">
                      Biblio
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 align-super ml-0.5 leading-none">
                      ™
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-medium text-emerald-400/80 tracking-wide uppercase mt-0.5">
                    Live-in Business Agent
                  </span>
                </div>
              </a>

              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-sm mb-5">
                Autonomous commerce infrastructure built for Nigerian social sellers. Negotiates in natural Pidgin, locks Paystack escrow, and coordinates riders.
              </p>

              {/* Direct WhatsApp Contact Button */}
              <div className="mb-4">
                <a
                  href="https://wa.me/2349064982841"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-emerald-400 hover:text-emerald-300 transition-all group"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400 group-hover:scale-105 transition-transform" />
                  <span className="font-medium">Chat directly with our team on WhatsApp</span>
                  <span className="text-zinc-500 group-hover:translate-x-0.5 transition-transform">→</span>
                </a>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 font-mono">
              Yaba, Lagos, Nigeria
            </div>
          </div>

          {/* Col 2: Product (Span 2) */}
          <div className="md:col-span-2 col-span-1">
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-white mb-3 sm:mb-4">
              Product
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Pidgin Haggling
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Voice Note Orders
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Paystack Escrow
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Rider Dispatch
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Status Stories
                </a>
              </li>
              <li>
                <a href="#simulator" className="hover:text-emerald-400 transition-colors text-emerald-400 font-medium">
                  Interactive Demo →
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Platform (Span 2) */}
          <div className="md:col-span-2 col-span-1">
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-white mb-3 sm:mb-4">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#how-it-works" className="hover:text-emerald-400 transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-emerald-400 transition-colors">
                  Pricing & Plans
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Margin Protection
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  Merchant FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Trust & Support (Span 3) */}
          <div className="md:col-span-3 col-span-1">
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-white mb-3 sm:mb-4">
              Trust & Support
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  Escrow Guarantee
                </a>
              </li>
              <li>
                <a href="mailto:support@biblio.africa" className="hover:text-emerald-400 transition-colors">
                  support@biblio.africa
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Minimalist Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            © {new Date().getFullYear()} Biblio Technologies Ltd. All rights reserved.
          </div>

          <div className="text-[11px] text-zinc-500">
            Built with pride in Lagos, Nigeria 🇳🇬
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono text-zinc-400">All Systems Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
