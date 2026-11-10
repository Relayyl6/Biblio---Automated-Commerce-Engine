import React, { useState } from 'react';
import { Menu, X, ArrowRight, ChevronRight } from 'lucide-react';

interface NavbarProps {
  onOpenWaitlist: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenWaitlist }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Capabilities', href: '#features' },
    { label: 'Interactive Demo', href: '#simulator' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="fixed top-3 sm:top-4 left-0 right-0 z-50 flex justify-center px-3 sm:px-6 pointer-events-none">
      <div className="w-full max-w-5xl relative pointer-events-auto">
        {/* Permanent Pill Navbar Bar — Fixed Shape to completely eliminate distorted balloon/oval morphing */}
        <nav className="w-full bg-[#0C0E14]/95 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.7)] rounded-full px-3.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between">
          {/* Brand Mark */}
          <a href="#" className="flex items-center gap-2 group flex-shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center flex-shrink-0">
              <img src="/biblio-logo.png" alt="Biblio Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white leading-none">
                  Biblio
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 align-super ml-0.5 leading-none">
                  ™
                </span>
              </div>
              <span className="text-[8px] sm:text-[9px] font-mono font-medium text-emerald-400/80 tracking-wide uppercase mt-0.5">
                Live-in Business Agent
              </span>
            </div>
          </a>

          {/* Nav Links (Desktop) */}
          <div className="hidden md:flex items-center gap-1 text-xs font-medium text-zinc-300">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Action CTAs (Desktop) */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>BATCH 1 OPEN</span>
            </div>

            <button
              onClick={onOpenWaitlist}
              className="group inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 rounded-full transition-all shadow-md shadow-emerald-400/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Join Waitlist</span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Mobile Menu Toggle & Direct Waitlist CTA */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onOpenWaitlist}
              className="px-2.5 py-1 text-[11px] font-bold text-black bg-emerald-400 hover:bg-emerald-300 rounded-full transition-all shadow-sm active:scale-95"
            >
              Join Waitlist
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
            </button>
          </div>
        </nav>

        {/* Crisp Mobile Floating Dropdown Menu (Detached, Fixed Card - Zero Morphing Distortion!) */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 mt-2 p-3 rounded-2xl bg-[#0C0E14]/98 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col gap-1 transition-all">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] active:bg-white/10 transition-colors"
              >
                <span>{link.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
              </a>
            ))}

            <div className="pt-2 mt-1 border-t border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between px-3 py-1 text-[10px] font-mono text-emerald-400/90">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  BATCH 1 ADMISSIONS OPEN
                </span>
                <span className="text-zinc-500">LAGOS & ABUJA</span>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenWaitlist();
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-400/20 active:scale-[0.99]"
              >
                <span>Join Waitlist (Instant Access)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
