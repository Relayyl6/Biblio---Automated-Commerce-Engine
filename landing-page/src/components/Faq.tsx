import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FaqItem } from '../types';

export const Faq: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: 'Does Biblio discount below my minimum profit?',
      answer:
        'Never. You set an absolute floor price. If a buyer haggles below it, Biblio counters with bundles or gifts instead of losing margin.',
    },
    {
      question: 'How does Paystack escrow protect me against fake alerts?',
      answer:
        'Every checkout gets a dedicated 30-minute virtual bank account. Riders are only dispatched when an authentic bank webhook confirms payment.',
    },
    {
      question: 'Can Biblio understand voice notes in Pidgin and local slang?',
      answer:
        'Yes. Our Whisper engine is calibrated for Nigerian accents to extract sizes, quantities, and Lagos landmarks in under 1.5 seconds.',
    },
    {
      question: 'Can I take over from the AI anytime?',
      answer:
        'Yes, you have 100% veto power. Simply reply directly in WhatsApp or send /pause to take instant control.',
    },
    {
      question: 'How does merchant verification work?',
      answer:
        'We send a 6-digit verification code via SMS, with an email fallback. Biblio staff will never ask you for your code.',
    },
    {
      question: 'Will connecting Biblio affect my personal chats?',
      answer:
        'No. Biblio connects via WhatsApp Business multi-device pairing. Your personal chats, family groups, and calls remain 100% private.',
    },
  ];

  return (
    <section id="faq" className="py-24 sm:py-32 bg-[#060709] text-white relative">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-emerald-400 text-xs font-medium mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>FAQ</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Everything you need to know about setting up Biblio.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-white/[0.08] overflow-hidden bg-[#0D0F14] transition-all duration-200"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 bg-transparent hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-semibold text-sm sm:text-base text-zinc-200">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-500 transition-transform duration-200 flex-shrink-0 ${
                      isOpen ? 'transform rotate-180 text-emerald-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="p-5 pt-0 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-white/[0.05]">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
