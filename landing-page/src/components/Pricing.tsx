import React, { useState } from 'react';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { PlanType } from './WaitlistModal';

interface PricingProps {
  onOpenWaitlist: (planId?: PlanType) => void;
}

export const Pricing: React.FC<PricingProps> = ({ onOpenWaitlist }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans: Array<{
    id: PlanType;
    name: string;
    tagline: string;
    priceMonthly: string;
    priceYearly: string;
    badge?: string;
    isPopular?: boolean;
    features: string[];
    buttonText: string;
  }> = [
    {
      id: 'starter',
      name: 'Starter',
      tagline: 'For boutique owners doing under 30 chats daily.',
      priceMonthly: '₦12,500',
      priceYearly: '₦10,000',
      features: [
        '1 WhatsApp business line',
        'English & Pidgin auto-negotiation',
        'Basic Paystack VAN escrow collection',
        'Manual rider booking link',
        'Up to 150 automated orders/mo',
      ],
      buttonText: 'Join Waitlist',
    },
    {
      id: 'professional',
      name: 'Pro Merchant',
      tagline: 'For growing brands processing 30–150 daily orders.',
      priceMonthly: '₦28,000',
      priceYearly: '₦22,400',
      badge: 'MOST POPULAR',
      isPopular: true,
      features: [
        'Up to 3 staff & multi-device sync',
        'Instant voice note transcription (Audio AI)',
        'Automatic 1-click Kwik rider dispatch',
        'Anti-fraud VAN escrow protection',
        'Daily WhatsApp Status auto-poster',
        'Unlimited automated transactions',
      ],
      buttonText: 'Get Pro Access',
    },
    {
      id: 'enterprise',
      name: 'Scale / Multi-Branch',
      tagline: 'For high-volume merchants and distributed warehouses.',
      priceMonthly: '₦65,000',
      priceYearly: '₦52,000',
      features: [
        'Multi-warehouse & store branch routing',
        'Dedicated account manager in Lagos',
        'Custom courier API integrations',
        'Priority low-latency Groq AI server',
        'Custom ERP & accounting webhook exports',
      ],
      buttonText: 'Contact for Scale',
    },
  ];

  return (
    <section id="pricing" className="py-16 sm:py-28 bg-paper-50 border-b border-ink-950/8 relative w-full max-w-[100vw] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ember-50 border border-ember-500/20 text-ember-600 text-xs font-mono font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>TRANSPARENT NAIRA PRICING</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-ink-950 mb-3">
            Simple, predictable pricing
          </h2>
          <p className="text-ink-700 text-sm sm:text-base leading-relaxed">
            No hidden fees, no percentage cuts, zero surprise bank deductions.
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span
              className={`text-xs font-semibold cursor-pointer transition-colors ${
                billingCycle === 'monthly' ? 'text-ink-950' : 'text-ink-400'
              }`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="w-11 h-6 rounded-full bg-paper-200 p-0.5 flex items-center transition-colors relative border border-ink-950/10"
              aria-label="Toggle Billing"
            >
              <div
                className={`w-5 h-5 rounded-full bg-ember-500 transform transition-transform shadow-sm ${
                  billingCycle === 'yearly' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span
              className={`text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors ${
                billingCycle === 'yearly' ? 'text-ink-950' : 'text-ink-400'
              }`}
              onClick={() => setBillingCycle('yearly')}
            >
              <span>Yearly</span>
              <span className="text-[10px] font-bold text-settled-600 bg-settled-50 px-2 py-0.5 rounded-full border border-settled-600/20">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 relative ${
                plan.isPopular
                  ? 'bg-ink-950 text-white shadow-elev-3 border-2 border-ember-500 z-10'
                  : 'bg-white text-ink-950 border border-ink-950/8 shadow-elev-1 hover:border-ember-500/30 hover:shadow-elev-2'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-ember-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md tracking-wider uppercase font-mono">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div>
                <h3 className={`text-xl font-bold mb-1 ${plan.isPopular ? 'text-white' : 'text-ink-950'}`}>
                  {plan.name}
                </h3>
                <p className={`text-xs mb-6 ${plan.isPopular ? 'text-zinc-400' : 'text-ink-400'}`}>
                  {plan.tagline}
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums ${plan.isPopular ? 'text-white' : 'text-ink-950'}`}>
                    {billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly}
                  </span>
                  <span className={`text-xs ${plan.isPopular ? 'text-zinc-400' : 'text-ink-400'}`}>
                    /month
                  </span>
                </div>

                <div className="space-y-3 pt-4 border-t border-ink-950/8">
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2.5 text-xs">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        plan.isPopular ? 'bg-ember-500/20 text-ember-400' : 'bg-settled-50 text-settled-600'
                      }`}>
                        <Check className="w-3 h-3" />
                      </div>
                      <span className={plan.isPopular ? 'text-zinc-300' : 'text-ink-700'}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 mt-6">
                <button
                  onClick={() => onOpenWaitlist(plan.id)}
                  className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                    plan.isPopular
                      ? 'bg-ember-500 hover:bg-ember-600 text-white shadow-ember-500/20'
                      : 'bg-paper-100 hover:bg-paper-200 text-ink-950 border border-ink-950/8'
                  }`}
                >
                  <span>{plan.buttonText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
