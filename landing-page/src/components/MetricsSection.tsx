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
    <section className="py-20 bg-[#060709] border-b border-white/[0.08] relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className="p-6 sm:p-7 rounded-3xl bg-[#0D0F14] border border-white/[0.08] flex flex-col justify-between"
            >
              <div>
                <div className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-2 font-mono">
                  {metric.value}
                </div>
                <div className="text-xs sm:text-sm font-semibold text-emerald-400 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {metric.label}
                </div>
              </div>
              <p className="text-xs text-zinc-400">
                {metric.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
