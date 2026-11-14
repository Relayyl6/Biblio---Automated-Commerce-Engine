import React, { useState } from 'react';
import { Menu, X, ArrowRight, ChevronRight } from 'lucide-react';

interface NavbarProps {
  onOpenWaitlist: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenWaitlist }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Capabilities', href: '#features' },
    { label: 'WhatsApp Simulator', href: '#simulator' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="fixed top-3 sm:top-5 left-0 right-0 z-50 flex justify-center px-4 sm:px-6 pointer-events-none">
      <div className="w-full max-w-6xl relative pointer-events-auto">
        
        {/* Floating Glass Navbar Bar with 3-Section Layout */}
        <nav className="w-full biblio-glass-dark rounded-full px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-elev-3 border border-white/10">
          
          {/* Left: Small Logo & Wordmark */}
          <a href="#" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-ember-500/10 border border-ember-500/30 flex items-center justify-center p-1.5 shadow-sm">
              <img src="/biblio-logo.png" alt="Biblio Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-white leading-none">
                biblio
              </span>
              <span className="text-[9px] font-mono font-medium text-ember-400 tracking-wider uppercase mt-0.5">
                ACE 1.0
              </span>
            </div>
          </a>

          {/* Centre: Dark Pill with "Join the early access" and a round arrow button (DESIGN.md Sec 10.7) */}
          <div className="hidden sm:flex items-center">
            <button
              onClick={onOpenWaitlist}
              className="group flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 transition-all text-xs font-semibold text-white shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="w-2 h-2 rounded-full bg-ember-500 animate-pulse" />
              <span>Join the early access</span>
              <div className="w-5 h-5 rounded-full bg-ember-500 text-white flex items-center justify-center ml-0.5 group-hover:translate-x-0.5 transition-transform">
                <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          </div>

          {/* Right: 2 or 3 links on the right */}
          <div className="hidden md:flex items-center gap-5 text-xs font-medium text-zinc-300">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Mobile Right: Menu button + Direct Early Access */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={onOpenWaitlist}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ember-500 text-white text-xs font-bold shadow-sm"
            >
              <span>Join</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

        </nav>

        {/* Mobile Dropdown Menu Card */}
        {mobileMenuOpen && (
          <div className="sm:hidden absolute top-full left-0 right-0 mt-2 p-3 rounded-2xl biblio-glass-dark border border-white/10 shadow-elev-3 flex flex-col gap-1.5 animate-entrance">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span>{link.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              </a>
            ))}
            <div className="pt-2 border-t border-white/10 mt-1">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenWaitlist();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ember-500 text-white text-xs font-bold"
              >
                <span>Join the early access</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>
    </header>
  );
};
