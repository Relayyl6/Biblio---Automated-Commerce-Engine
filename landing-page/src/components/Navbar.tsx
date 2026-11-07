import React, { useState } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';

interface NavbarProps {
  onOpenWaitlist: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenWaitlist }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 sm:px-6">
      <nav className="w-full max-w-5xl bg-[#0C0E14]/85 backdrop-blur-xl rounded-full px-4 sm:px-6 py-2.5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-300">
        <div className="flex items-center justify-between">
          {/* Brand Mark */}
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-emerald-950/60 border border-emerald-500/30 shadow-sm shadow-emerald-500/20">
              <img
                src="/biblio-logo.png"
                alt="Biblio Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-white leading-none">
                Biblio<span className="text-emerald-400 text-[10px] align-super ml-0.5">™</span>
              </span>
              <span className="text-[9px] font-mono font-medium text-emerald-400/80 tracking-wide uppercase">
                Live-in Business Agent
              </span>
            </div>
          </a>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1 text-xs font-medium text-zinc-300">
            <a
              href="#features"
              className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              Capabilities
            </a>
            <a
              href="#simulator"
              className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              Interactive Demo
            </a>
            <a
              href="#how-it-works"
              className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              FAQ
            </a>
          </div>

          {/* Action CTAs */}
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

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onOpenWaitlist}
              className="px-3 py-1.5 text-xs font-bold text-black bg-emerald-400 rounded-full"
            >
              Join Waitlist
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-4 pb-2 border-t border-white/10 mt-3 flex flex-col gap-2 text-xs font-medium text-zinc-300">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-white/[0.06] hover:text-white"
            >
              Capabilities
            </a>
            <a
              href="#simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-white/[0.06] hover:text-white"
            >
              Interactive Demo
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-white/[0.06] hover:text-white"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-white/[0.06] hover:text-white"
            >
              Pricing
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-white/[0.06] hover:text-white"
            >
              FAQ
            </a>
          </div>
        )}
      </nav>
    </header>
  );
};
