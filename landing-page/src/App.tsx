import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { PartnerTicker } from './components/PartnerTicker';
import { BentoFeatures } from './components/BentoFeatures';
import { MetricsSection } from './components/MetricsSection';
import { WhatsAppSimulator } from './components/WhatsAppSimulator';
import { HowItWorks } from './components/HowItWorks';
import { Pricing } from './components/Pricing';
import { Faq } from './components/Faq';
import { Footer } from './components/Footer';
import { WaitlistModal } from './components/WaitlistModal';

export const App: React.FC = () => {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistSeed, setWaitlistSeed] = useState('');

  const handleOpenWaitlist = (input?: string) => {
    if (input) setWaitlistSeed(input);
    setWaitlistOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#08090C] text-white font-sans antialiased selection:bg-emerald-500 selection:text-black">
      {/* Floating Dark Frosted Glass Pill Header */}
      <Navbar onOpenWaitlist={() => handleOpenWaitlist()} />

      {/* Main Flow */}
      <main className="flex-1">
        <Hero onOpenWaitlist={handleOpenWaitlist} />
        <PartnerTicker />
        <BentoFeatures />
        <MetricsSection />
        <WhatsAppSimulator />
        <HowItWorks />
        <Pricing onOpenWaitlist={() => handleOpenWaitlist()} />
        <Faq />
      </main>

      {/* World-Class Apple/Expo Footer */}
      <Footer onOpenWaitlist={handleOpenWaitlist} />

      {/* Early Access Waitlist Modal */}
      <WaitlistModal
        isOpen={waitlistOpen}
        initialValue={waitlistSeed}
        defaultPhone={waitlistSeed}
        onClose={() => setWaitlistOpen(false)}
      />
    </div>
  );
};

export default App;
