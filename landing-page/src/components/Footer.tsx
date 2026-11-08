import React, { useState } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Lock,
  Globe,
  Radio,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';

interface FooterProps {
  onOpenWaitlist?: (phone?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenWaitlist }) => {
  const [footerPhone, setFooterPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onOpenWaitlist) {
      onOpenWaitlist(footerPhone);
    }
  };

  return (
    <footer className="relative bg-[#050608] text-zinc-400 border-t border-white/[0.08] overflow-hidden w-full max-w-[100vw]">
      {/* Top ambient aura */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-emerald-500/[0.03] blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute inset-0 apple-subtle-grid opacity-25 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-3.5 sm:px-6 pt-10 sm:pt-20 pb-12">
        {/* Top Pre-Footer Callout Card (Apple/Linear Style) */}
        <div className="rounded-2xl sm:rounded-3xl apple-card p-5 sm:p-12 mb-10 sm:mb-20 border border-white/10 relative overflow-hidden bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] sm:text-xs mb-3 sm:mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>BATCH 1 NOW OPEN • 80 SPOTS REMAINING</span>
            </div>
            <h3 className="text-xl sm:text-3xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-2.5 sm:mb-4">
              Ready to put your WhatsApp store on autopilot?
            </h3>
            <p className="text-zinc-400 text-xs sm:text-base leading-relaxed mb-6 sm:mb-8 max-w-xl">
              Lock in your store handle before Batch 1 closes. Defend your profit floor and close sales on autopilot.
            </p>

            {/* Inline Fast Waitlist Form */}
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 max-w-md">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Enter WhatsApp number or email..."
                  value={footerPhone}
                  onChange={(e) => setFooterPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full bg-black/60 border border-white/15 text-white placeholder-zinc-500 text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors shadow-inner"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
              >
                <span>Claim Handle</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </form>

            <div className="flex items-center gap-2 mt-3 sm:mt-4 text-[10px] sm:text-[11px] text-zinc-500 font-mono">
              <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Instant VIP pass delivery via email • No setup fee</span>
            </div>
          </div>
        </div>

        {/* 5-Column Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 sm:gap-10 pb-16 border-b border-white/[0.08]">
          
          {/* Col 1: Product */}
          <div>
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-white mb-4">
              Product & Agent
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Autonomous Negotiator
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Whisper Voice Parser
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Paystack VAN Escrow
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Kwik & Gokada Dispatch
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  WhatsApp Status Stories
                </a>
              </li>
              <li>
                <a href="#simulator" className="hover:text-emerald-400 transition-colors flex items-center gap-1 text-emerald-400 font-medium">
                  <span>Interactive Simulator</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 2: Platform & Engine */}
          <div>
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-white mb-4">
              Platform & Arch
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="#how-it-works" className="hover:text-emerald-400 transition-colors">
                  Groq Llama-3 70B Engine
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-emerald-400 transition-colors">
                  Multi-Dialect Pidgin NLP
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-emerald-400 transition-colors">
                  6-Layer Safety Veto
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-emerald-400 transition-colors">
                  Floor Margin Guardrail
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-emerald-400 transition-colors">
                  Multi-Agent Team Swarm
                </a>
              </li>
              <li>
                <span className="text-zinc-600 font-mono text-[11px] block pt-1">
                  API & SDK (Coming Q1)
                </span>
              </li>
            </ul>
          </div>

          {/* Col 3: Integrations */}
          <div>
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-white mb-4">
              Integrations
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="https://paystack.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                  Paystack Dynamic VAN
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-600" />
                </a>
              </li>
              <li>
                <a href="https://business.whatsapp.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                  Meta WhatsApp Cloud
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-600" />
                </a>
              </li>
              <li>
                <a href="https://kwik.delivery" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                  Kwik Delivery Fleet
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-600" />
                </a>
              </li>
              <li>
                <a href="https://gokada.ng" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                  Gokada Dispatch
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-600" />
                </a>
              </li>
              <li>
                <a href="https://groq.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                  Groq Inference Engine
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-600" />
                </a>
              </li>
              <li>
                <span className="text-zinc-600">Wema Bank NIBSS</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Trust & Compliance */}
          <div>
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-white mb-4">
              Trust & Regulatory
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  Privacy Policy (NDPA 2023)
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  Merchant Terms of Service
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  Apple App Store 5.1.1(v) Notice
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  Anti-Fraud Security Policy
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  Escrow Settlement SLA
                </a>
              </li>
              <li>
                <span className="text-[11px] font-mono text-zinc-500 block pt-1">
                  DPO: compliance@biblio.africa
                </span>
              </li>
            </ul>
          </div>

          {/* Col 5: Company & Lagos Hub */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-white mb-4">
              Company & Lagos Hub
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="#pricing" className="hover:text-emerald-400 transition-colors">
                  About Biblio Technologies
                </a>
              </li>
              <li>
                <span className="text-zinc-400">
                  Yaba Innovation Hub, Lagos, Nigeria
                </span>
              </li>
              <li>
                <a href="#pricing" className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                  <span>Careers</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                    WE'RE HIRING
                  </span>
                </a>
              </li>
              <li>
                <a href="https://wa.me/2348000000000" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1 text-emerald-400 font-semibold">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat With Founder on WhatsApp</span>
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Telemetry Status Ribbon & Statutory Bar */}
        <div className="py-8 border-b border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono">
          {/* Live Telemetry Indicator */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>99.98% ALL SYSTEMS OPERATIONAL</span>
            </div>
            <span className="text-zinc-600 hidden sm:inline">•</span>
            <span className="text-zinc-500 hidden sm:inline">
              Groq Llama-3 (380ms) • Paystack Webhook (Active)
            </span>
          </div>

          {/* Country & Currency Selector */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-zinc-300 text-xs">
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              <span>🇳🇬 Nigeria • NGN (₦)</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-zinc-400 text-xs">
              <span>WAT (UTC+1)</span>
            </div>
          </div>
        </div>

        {/* Bottom Statutory & Brand Strip */}
        <div className="pt-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <img src="/biblio-logo.png" alt="Biblio" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="text-zinc-300 font-bold">
                Biblio Technologies Ltd. <span className="text-zinc-600 text-[11px] font-mono font-normal">RC: 1984210</span>
              </div>
              <div className="text-[11px] text-zinc-500">
                Automate. Sell. Grow. Designed with pride for African Commerce.
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-white/[0.08] text-[11px] text-emerald-400 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>NDPA 2023 Statutory Registered Data Controller</span>
          </div>

          <div className="text-zinc-500 text-[11px] font-mono">
            © {new Date().getFullYear()} Biblio Technologies Ltd. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};
