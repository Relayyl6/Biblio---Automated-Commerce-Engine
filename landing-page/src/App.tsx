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
import { WaitlistModal, PlanType } from './components/WaitlistModal';

export const App: React.FC = () => {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistSeed, setWaitlistSeed] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('professional');

  const handleOpenWaitlist = (input?: string, plan?: PlanType) => {
    if (input) setWaitlistSeed(input);
    if (plan) setSelectedPlan(plan);
    setWaitlistOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#08090C] text-white font-sans antialiased selection:bg-emerald-500 selection:text-black w-full max-w-[100vw] overflow-x-hidden">
      {/* Floating Dark Frosted Glass Pill Header */}
      <Navbar onOpenWaitlist={() => handleOpenWaitlist(undefined, 'professional')} />

      {/* Main Flow */}
      <main className="flex-1 w-full max-w-[100vw] overflow-x-hidden">
        <Hero onOpenWaitlist={(seed) => handleOpenWaitlist(seed, 'professional')} />
        <PartnerTicker />
        <BentoFeatures />
        <MetricsSection />
        <WhatsAppSimulator />
        <HowItWorks />
        <Pricing onOpenWaitlist={(planId) => handleOpenWaitlist(undefined, planId || 'professional')} />
        <Faq />
      </main>

      {/* World-Class Modern Footer */}
      <Footer onOpenWaitlist={(seed) => handleOpenWaitlist(seed, 'professional')} />

      {/* Early Access Waitlist Modal (Augmented with Plan Switcher & Category Selection) */}
      <WaitlistModal
        isOpen={waitlistOpen}
        initialValue={waitlistSeed}
        defaultPhone={waitlistSeed}
        initialPlan={selectedPlan}
        onClose={() => setWaitlistOpen(false)}
      />
    </div>
  );
};

export default App;
