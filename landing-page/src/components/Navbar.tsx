import React, { useState } from 'react';
import { Menu, X, ArrowRight, ChevronRight, Zap } from 'lucide-react';

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
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 sm:px-6">
      <nav
        className={`w-full max-w-5xl bg-[#0C0E14]/95 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.7)] transition-all duration-300 ${
          mobileMenuOpen ? 'rounded-3xl p-4 sm:p-5' : 'rounded-full px-4 sm:px-6 py-2.5'
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Brand Mark */}
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/25 border border-emerald-300/30 flex-shrink-0">
              <Zap className="w-4 h-4 text-black fill-black" />
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
              className="px-3 py-1.5 text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 rounded-full transition-all"
            >
              Join Waitlist
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-3 mt-3 border-t border-white/10 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] active:bg-white/10 transition-colors"
              >
                <span>{link.label}</span>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </a>
            ))}

            <div className="pt-3 mt-2 border-t border-white/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-3.5 py-1 text-[11px] font-mono text-emerald-400/90">
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
                className="w-full py-3 rounded-xl text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-400/20 active:scale-[0.99]"
              >
                <span>Join Waitlist (Instant Access)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};
