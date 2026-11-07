import React, { useState } from 'react';
import { Calculator, ArrowRight, Clock, ShieldCheck } from 'lucide-react';

interface RoiCalculatorProps {
  onOpenAuth: (mode?: 'login' | 'signup') => void;
}

export const RoiCalculator: React.FC<RoiCalculatorProps> = ({ onOpenAuth }) => {
  const [dailyInquiries, setDailyInquiries] = useState<number>(35);
  const [averageOrderValue, setAverageOrderValue] = useState<number>(25000);

  // Assumptions backed by Nigerian social commerce research:
  // Industry average abandonment due to delayed replies (>15 mins): ~32%
  // Biblio instant response (<3s) recovers ~65% of otherwise lost deals.
  // Conversion rate: 18% of inquiries buy.
  // Time spent per inquiry: 6 minutes.
  const monthlyInquiries = dailyInquiries * 30;
  const lostDealsRecovered = Math.round(monthlyInquiries * 0.18 * 0.32 * 0.65);
  const monthlyRevenueRecovered = lostDealsRecovered * averageOrderValue;
  const weeklyHoursSaved = Math.round((dailyInquiries * 7 * 6) / 60);

  return (
    <section id="calculator" className="py-24 bg-gradient-to-b from-slate-50 to-emerald-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-3">
            <Calculator className="w-3.5 h-3.5" />
            <span>Interactive Profit Estimator</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
            Calculate your recovered revenue
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Nigerian buyers move to the next Instagram or WhatsApp vendor if you don't reply within 3 minutes. See how much money Biblio brings back to your pocket.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-900/5 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Sliders (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* Slider 1: Daily Inquiries */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-slate-800">
                  Daily WhatsApp Inquiries & DMs
                </label>
                <span className="text-lg font-mono font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl">
                  {dailyInquiries} chats/day
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="250"
                step="5"
                value={dailyInquiries}
                onChange={(e) => setDailyInquiries(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1 font-mono">
                <span>5 chats</span>
                <span>125 chats</span>
                <span>250+ chats</span>
              </div>
            </div>

            {/* Slider 2: Average Order Value */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-slate-800">
                  Average Order Value (AOV)
                </label>
                <span className="text-lg font-mono font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl">
                  ₦{averageOrderValue.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="5000"
                max="150000"
                step="2500"
                value={averageOrderValue}
                onChange={(e) => setAverageOrderValue(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1 font-mono">
                <span>₦5,000</span>
                <span>₦75,000</span>
                <span>₦150,000+</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>The Nigerian Speed Advantage:</span>
              </div>
              <p>
                68% of WhatsApp shoppers message multiple vendors at the same time. The first vendor to offer a price, confirm stock, and drop a verified escrow account takes the money.
              </p>
            </div>
          </div>

          {/* Results Display (5 cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                  Estimated Monthly Revenue Recovered
                </span>
                <div className="text-3xl sm:text-4xl font-mono font-extrabold text-white mt-1">
                  +₦{monthlyRevenueRecovered.toLocaleString()}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  From {lostDealsRecovered} extra completed sales every 30 days.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Weekly Time Saved</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    ~{weeklyHoursSaved} Hours / week
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </div>

            <button
              onClick={() => onOpenAuth('signup')}
              className="mt-8 w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group"
            >
              <span>Capture This Revenue Now</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
