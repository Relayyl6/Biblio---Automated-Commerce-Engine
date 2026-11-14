import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const Faq: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      question: 'How does Biblio prevent fake bank transfer alerts?',
      answer:
        'Biblio provisions a unique, one-time virtual account number (VAN) via Paystack for each transaction. Orders are marked paid only when bank settlements clear via NIBSS. Fake SMS and edited screenshots are rejected automatically.',
    },
    {
      question: 'Can Biblio speak Nigerian Pidgin and understand voice notes?',
      answer:
        'Yes. Our custom language model is specifically tuned for Nigerian commerce. It understands Pidgin, street bargaining slang, and extracts audio voice notes into structured items and delivery addresses.',
    },
    {
      question: 'Do I need a laptop or developer to run this?',
      answer:
        'Never. 97% of our merchants run their stores entirely from their Android or iPhone devices. Setup takes under 3 minutes by scanning an in-app QR code.',
    },
    {
      question: 'How does Biblio book dispatch riders?',
      answer:
        'The moment customer payment clears, Biblio passes the verified pickup address and dropoff location to Kwik Delivery, Fez, or Gokada. Your customer receives a live tracking link via SMS.',
    },
    {
      question: 'Will connecting Biblio affect my personal family chats?',
      answer:
        'No. Biblio connects via WhatsApp Business multi-device pairing. Your personal chats, family groups, and calls remain 100% private and untouched.',
    },
  ];

  return (
    <section id="faq" className="py-16 sm:py-28 bg-paper-100/60 text-ink-950 relative w-full max-w-[100vw] overflow-hidden border-b border-ink-950/8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ember-50 border border-ember-500/20 text-ember-600 text-xs font-mono font-bold mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>COMMERCE FAQ</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-ink-950 mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-ink-700 text-sm sm:text-base leading-relaxed">
            Everything you need to know about setting up and automating your store.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-ink-950/8 overflow-hidden bg-white shadow-elev-1 transition-all duration-200"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 bg-transparent hover:bg-paper-50 transition-colors"
                >
                  <span className="font-bold text-sm sm:text-base text-ink-950">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-ink-400 transition-transform duration-200 flex-shrink-0 ${
                      isOpen ? 'transform rotate-180 text-ember-500' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-ink-700 leading-relaxed border-t border-ink-950/5 pt-3">
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
