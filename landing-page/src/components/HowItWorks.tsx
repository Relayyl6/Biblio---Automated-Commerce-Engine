import React from 'react';
import { Smartphone, Sliders, Rocket, CheckCircle2, Sparkles } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Link Your WhatsApp',
      description: 'Scan the QR code to pair your store in 20 seconds.',
      icon: Smartphone,
      points: ['Preserves personal chats', 'Zero code required'],
    },
    {
      step: '02',
      title: 'Set Your Floor Margins',
      description: 'Tell Biblio the lowest price you will accept for each item.',
      icon: Sliders,
      points: ['Strict profit guardrails', 'Custom delivery rates'],
    },
    {
      step: '03',
      title: 'Sell on Autopilot',
      description: 'Biblio haggles, collects escrow, and summons dispatch riders.',
      icon: Rocket,
      points: ['Zero fake alerts', 'Automatic bank payouts'],
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-32 bg-[#060709] border-b border-white/[0.08] relative w-full max-w-[100vw] overflow-hidden">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-8 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-white/[0.04] border border-white/10 text-emerald-400 text-[11px] sm:text-xs font-medium mb-2.5 sm:mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>3-Minute Setup</span>
          </div>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-2 sm:mb-3">
            Get started in 3 steps
          </h2>
          <p className="text-zinc-400 text-xs sm:text-base leading-relaxed">
            Close deals and collect payments around the clock.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl sm:rounded-3xl bg-[#0D0F14] p-5 sm:p-8 border border-white/[0.08] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      Step {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-300">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.06] space-y-2">
                  {item.points.map((pt, pIdx) => (
                    <div key={pIdx} className="flex items-center gap-2 text-xs text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
