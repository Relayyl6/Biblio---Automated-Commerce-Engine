import React from 'react';
import { Smartphone, Sliders, Rocket, Sparkles } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Link Your WhatsApp',
      description: 'Scan the QR code to pair your store in 20 seconds. Zero code or technical setup.',
      icon: Smartphone,
      points: ['Preserves personal family chats', 'Zero laptop required'],
    },
    {
      step: '02',
      title: 'Set Your Floor Margins',
      description: 'Tell Biblio the lowest price you will accept for each product. Your profit is locked.',
      icon: Sliders,
      points: ['Strict profit guardrails', 'Custom Lagos delivery fees'],
    },
    {
      step: '03',
      title: 'Sell on Autopilot',
      description: 'Biblio negotiates in Pidgin, verifies VAN escrow, and summons dispatch riders.',
      icon: Rocket,
      points: ['Zero fake transfer alerts', 'Instant Providus bank sweeps'],
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-28 bg-paper-100/60 border-b border-ink-950/8 relative w-full max-w-[100vw] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ember-50 border border-ember-500/20 text-ember-600 text-xs font-mono font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>3-MINUTE ONBOARDING</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-ink-950 mb-3">
            Get started in 3 simple steps
          </h2>
          <p className="text-ink-700 text-sm sm:text-base leading-relaxed">
            Close deals and collect verified bank payments 24/7.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 border border-ink-950/8 shadow-elev-1 hover:border-ember-500/30 hover:shadow-elev-2 flex flex-col justify-between transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-mono font-bold text-ember-600 bg-ember-50 px-3 py-1 rounded-full border border-ember-500/20">
                      Step {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-2xl bg-paper-100 border border-ink-950/8 flex items-center justify-center text-ink-950 shadow-sm">
                      <Icon className="w-5 h-5 text-ember-500" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-ink-950 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-ink-700 text-sm leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-ink-950/8 space-y-2">
                  {item.points.map((pt, pIdx) => (
                    <div key={pIdx} className="flex items-center gap-2 text-xs text-ink-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-settled-600" />
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
