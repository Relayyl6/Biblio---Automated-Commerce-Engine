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
    <div className="min-h-screen flex flex-col bg-paper-50 text-ink-950 font-sans antialiased selection:bg-ember-500 selection:text-white w-full max-w-[100vw] overflow-x-hidden">
      {/* Floating Dark Frosted Glass Pill Header (DESIGN.md Section 10.7) */}
      <Navbar onOpenWaitlist={() => handleOpenWaitlist(undefined, 'professional')} />

      {/* Main Flow */}
      <main className="flex-1 w-full max-w-[100vw] overflow-x-hidden">
        {/* Editorial Hero (Stepped Typography, Real Lagos Merchant Photo, Sticker Cut-out) */}
        <Hero onOpenWaitlist={(seed) => handleOpenWaitlist(seed, 'professional')} />
        
        {/* Integrations & Partners Ticker */}
        <PartnerTicker />
        
        {/* Core Autonomous Features Bento */}
        <BentoFeatures />
        
        {/* Real Merchant Performance Metrics */}
        <MetricsSection />
        
        {/* Interactive In-WhatsApp AI Negotiator & Voice Note Simulator */}
        <WhatsAppSimulator />
        
        {/* How It Works Behind The Scenes */}
        <HowItWorks />
        
        {/* Transparent Naira Pricing Plans */}
        <Pricing onOpenWaitlist={(planId) => handleOpenWaitlist(undefined, planId || 'professional')} />
        
        {/* FAQ Section */}
        <Faq />
      </main>

      {/* Modern Trust Footer */}
      <Footer onOpenWaitlist={(seed) => handleOpenWaitlist(seed, 'professional')} />

      {/* Early Access Waitlist Modal */}
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
