import React from 'react';

export const MetricsSection: React.FC = () => {
  const metrics = [
    {
      value: '₦450M+',
      label: 'Escrow Settled',
      description: 'Zero fake alert losses verified through automated NIBSS VAN matching.',
    },
    {
      value: '85%',
      label: 'Auto-Negotiated',
      description: 'Closed within merchant pricing floors without typing a single word.',
    },
    {
      value: '420ms',
      label: 'Response Time',
      description: 'Instant replies 24/7 across Lagos peak congestion windows.',
    },
    {
      value: '3.8x',
      label: 'Sales Velocity',
      description: 'Average 30-day merchant revenue boost from recovered abandoned carts.',
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-paper-50 border-b border-ink-950/8 relative w-full max-w-[100vw] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-settled-50 border border-settled-600/20 text-settled-600 text-xs font-mono font-bold mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-settled-600" />
            <span>MEASURED AUTONOMOUS IMPACT</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-ink-950 tracking-tight">
            Financial clarity in every figure.
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className="p-5 sm:p-7 rounded-2xl bg-white border border-ink-950/8 shadow-elev-1 flex flex-col justify-between hover:border-ember-500/40 hover:shadow-elev-2 transition-all duration-200"
            >
              <div>
                <div className="text-2xl sm:text-4xl font-extrabold tracking-tight text-ink-950 mb-2 tabular-nums">
                  {metric.value}
                </div>
                <div className="text-xs sm:text-sm font-bold text-settled-600 mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-settled-600 flex-shrink-0" />
                  <span>{metric.label}</span>
                </div>
              </div>
              <p className="text-xs text-ink-400 mt-2 leading-relaxed">
                {metric.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
