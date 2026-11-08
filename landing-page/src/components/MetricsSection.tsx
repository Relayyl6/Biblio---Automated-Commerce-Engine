import React from 'react';

export const MetricsSection: React.FC = () => {
  const metrics = [
    {
      value: '₦450M+',
      label: 'Escrow Settled',
      description: 'Zero fake alert losses.',
    },
    {
      value: '85%',
      label: 'Auto-Closed',
      description: 'Closed without typing a word.',
    },
    {
      value: '420ms',
      label: 'Response Time',
      description: 'Instant replies at any hour.',
    },
    {
      value: '3.8x',
      label: 'Sales Velocity',
      description: 'Average 30-day revenue boost.',
    },
  ];

  return (
    <section className="py-12 sm:py-20 bg-[#060709] border-b border-white/[0.08] relative w-full max-w-[100vw] overflow-hidden">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className="p-4 sm:p-7 rounded-2xl sm:rounded-3xl bg-[#0D0F14] border border-white/[0.08] flex flex-col justify-between"
            >
              <div>
                <div className="text-2xl sm:text-5xl font-bold tracking-tight text-white mb-1.5 sm:mb-2 font-mono">
                  {metric.value}
                </div>
                <div className="text-[11px] sm:text-sm font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span>{metric.label}</span>
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-zinc-400 mt-1">
                {metric.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
