import React, { useState } from 'react';
import { Check, ArrowRight, Sparkles } from 'lucide-react';

interface PricingProps {
  onOpenWaitlist: () => void;
}

export const Pricing: React.FC<PricingProps> = ({ onOpenWaitlist }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      name: 'Starter Plan',
      tagline: 'For vendors testing automated sales.',
      price: billingCycle === 'monthly' ? 0 : 0,
      features: [
        '50 automated orders/mo',
        'Pidgin & English negotiation',
        'Paystack VAN escrow',
        'Manual rider confirmation',
        'Instant takeover (/pause)',
      ],
      ctaText: 'Join Free Waitlist',
    },
    {
      name: 'Professional Plan',
      tagline: 'For boutiques, hair vendors, and fashion brands.',
      price: billingCycle === 'monthly' ? 15000 : 12000,
      isPopular: true,
      badge: 'Most Popular',
      features: [
        'Unlimited automated chats',
        'Voice note transcription',
        'Auto Kwik & Gokada booking',
        'Daily WhatsApp Status poster',
        'Floor margin guardrails',
        'Real-time Paystack webhook lock',
      ],
      ctaText: 'Reserve Priority Spot',
    },
    {
      name: 'Enterprise Plan',
      tagline: 'For wholesalers and merchant networks.',
      price: billingCycle === 'monthly' ? 50000 : 40000,
      features: [
        'Multi-agent team swarm',
        'Custom inventory & ERP sync',
        'Dedicated Lagos account manager',
        'Custom dialect fine-tuning',
        '99.99% uptime SLA',
      ],
      ctaText: 'Join Enterprise Cohort',
    },
  ];

  return (
    <section id="pricing" className="py-24 sm:py-32 bg-[#060709] border-b border-white/[0.08] relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-emerald-400 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
            Simple, predictable pricing
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            No hidden fees or surprise deductions.
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span
              className={`text-xs font-medium cursor-pointer transition-colors ${
                billingCycle === 'monthly' ? 'text-white' : 'text-zinc-500'
              }`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="w-11 h-6 rounded-full bg-white/10 p-0.5 flex items-center transition-colors relative border border-white/10"
              aria-label="Toggle Billing"
            >
              <div
                className={`w-5 h-5 rounded-full bg-emerald-400 transform transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span
              className={`text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors ${
                billingCycle === 'yearly' ? 'text-white' : 'text-zinc-500'
              }`}
              onClick={() => setBillingCycle('yearly')}
            >
              <span>Yearly</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                -20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-200 relative ${
                plan.isPopular
                  ? 'bg-gradient-to-b from-[#141822] to-[#0D1017] text-white border-2 border-emerald-500/50 shadow-2xl z-10'
                  : 'bg-[#0D0F14] text-white border border-white/[0.08]'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-emerald-400 text-black text-[10px] font-bold px-3 py-0.5 rounded-full shadow-md">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold mb-1 text-white">{plan.name}</h3>
                <p className="text-xs text-zinc-400 mb-6">
                  {plan.tagline}
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1 font-mono">
                    <span className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                      ₦{plan.price.toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-500">
                      / month
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 pt-6 border-t border-white/[0.08] mb-8">
                  {plan.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2.5 text-xs">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                          plan.isPopular ? 'bg-emerald-400 text-black' : 'bg-white/10 text-emerald-400'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5" />
                      </div>
                      <span className="text-zinc-300">
                        {feat}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onOpenWaitlist}
                className={`w-full py-3.5 rounded-full font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  plan.isPopular
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-black shadow-md'
                    : 'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10'
                }`}
              >
                <span>{plan.ctaText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
