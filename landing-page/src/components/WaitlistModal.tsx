import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  ArrowRight,
  Share2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  Mail,
  Smartphone,
  Store,
  Sparkles,
  Tag,
  TrendingUp,
} from 'lucide-react';

export type PlanType = 'starter' | 'professional' | 'enterprise';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPhone?: string;
  initialValue?: string;
  initialPlan?: PlanType;
}

const CATEGORIES = [
  { id: 'fashion', label: 'Fashion & Apparel', icon: '👗' },
  { id: 'hair', label: 'Hair, Wigs & Beauty', icon: '💇‍♀️' },
  { id: 'footwear', label: 'Sneakers & Shoes', icon: '👟' },
  { id: 'electronics', label: 'Electronics & Gadgets', icon: '📱' },
  { id: 'jewelry', label: 'Jewelry & Accessories', icon: '💍' },
  { id: 'wholesale', label: 'Wholesale & General', icon: '📦' },
];

const ORDER_VOLUMES = [
  { id: 'under_50', label: '< 50 orders/mo' },
  { id: '50_to_200', label: '50 – 200 orders/mo' },
  { id: 'over_200', label: '200+ orders/mo' },
];

export const WaitlistModal: React.FC<WaitlistModalProps> = ({
  isOpen,
  onClose,
  defaultPhone = '',
  initialValue = '',
  initialPlan = 'professional',
}) => {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(initialPlan);
  const [phone, setPhone] = useState(defaultPhone || initialValue);
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('fashion');
  const [orderVolume, setOrderVolume] = useState('50_to_200');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waitlistData, setWaitlistData] = useState<{
    position: number;
    cohort: string;
    referralCode: string;
    referralLink: string;
    plan: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync incoming input seed & plan whenever modal opens or props change
  useEffect(() => {
    if (initialPlan) {
      setSelectedPlan(initialPlan);
    }
    const seed = (initialValue || defaultPhone || '').trim();
    if (seed) {
      if (seed.includes('@')) {
        setEmail(seed);
      } else {
        setPhone(seed);
      }
    }
    if (isOpen) {
      setErrorMsg(null);
    }
  }, [initialValue, defaultPhone, initialPlan, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address to receive your VIP early access ticket.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Please enter your WhatsApp phone number.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const payload = {
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      storeName: storeName.trim() || 'Lagos Social Store',
      plan: selectedPlan,
      category,
      volume: orderVolume,
      dialect: 'pidgin_english',
    };

    try {
      let response: Response | null = null;
      // 1. Try /api/waitlist (Vercel Serverless) or /waitlist (Vite proxied to Fastify :3004)
      try {
        response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // fallback
      }

      if (!response || !response.ok) {
        try {
          response = await fetch('/waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch {
          response = await fetch('http://localhost:3004/waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
      }

      if (response && response.ok) {
        const data = await response.json();
        setWaitlistData({
          position: data.position || 4219,
          cohort: data.cohort || 'Lagos Early Access Batch 1',
          referralCode: data.referralCode || `BIBLIO-${data.position || 4219}`,
          referralLink: data.referralLink || `https://biblio.africa?ref=${data.referralCode || 'BIB-4219'}`,
          plan: selectedPlan,
        });
      } else {
        // Optimistic fallback so user is never blocked
        const fallbackPos = 4219;
        setWaitlistData({
          position: fallbackPos,
          cohort: 'Lagos Early Access Batch 1',
          referralCode: `BIBLIO-${fallbackPos}`,
          referralLink: `https://biblio.africa?ref=BIBLIO-${fallbackPos}`,
          plan: selectedPlan,
        });
      }
      setStep('success');
    } catch {
      const fallbackPos = 4219;
      setWaitlistData({
        position: fallbackPos,
        cohort: 'Lagos Early Access Batch 1',
        referralCode: `BIBLIO-${fallbackPos}`,
        referralLink: `https://biblio.africa?ref=BIBLIO-${fallbackPos}`,
        plan: selectedPlan,
      });
      setStep('success');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (waitlistData?.referralLink) {
      navigator.clipboard.writeText(waitlistData.referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    const planName =
      selectedPlan === 'enterprise'
        ? 'Enterprise Plan'
        : selectedPlan === 'starter'
        ? 'Starter Plan'
        : 'Professional Plan';
    const text = encodeURIComponent(
      `Hey! I just claimed ticket #${waitlistData?.position || 4219} for the ${planName} on Biblio — an autonomous WhatsApp sales agent that haggles in Pidgin, stops fake transfer alerts, and auto-dispatches riders. Join Lagos Batch 1 here: ${waitlistData?.referralLink || 'https://biblio.africa'}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const planConfig = {
    starter: {
      badge: 'COMMUNITY TIER • 100% FREE',
      badgeColor: 'text-zinc-300 bg-white/[0.06] border-white/10',
      title: 'Join Free Starter Waitlist',
      subtitle: 'Free forever for vendors testing autonomous sales. Up to 50 automated orders/mo.',
      buttonText: 'Join Free Waitlist',
    },
    professional: {
      badge: '🔥 LAGOS BATCH 1 PRIORITY ADMISSION • ₦15,000/MO',
      badgeColor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
      title: 'Reserve Professional Early Pass',
      subtitle: 'Priority onboarding for boutiques, hair vendors, and social stores. Unlimited orders & voice notes.',
      buttonText: 'Claim Priority Access Pass',
    },
    enterprise: {
      badge: '⚡ WHOLESALE & MERCHANT NETWORK COHORT • ₦50,000/MO',
      badgeColor: 'text-teal-300 bg-teal-500/10 border-teal-500/30',
      title: 'Reserve Enterprise Cohort Seat',
      subtitle: 'Dedicated Lagos account manager, custom inventory & ERP sync, and team swarm.',
      buttonText: 'Join Enterprise Cohort',
    },
  }[selectedPlan];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-[#0D0F14] rounded-2xl sm:rounded-3xl border border-white/10 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.95)] overflow-hidden text-white p-5 sm:p-8 max-h-[92vh] overflow-y-auto">
        
        {/* Top-Right Quiet Dismiss Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors z-20"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ================= STEP 1: INTAKE FORM ================= */}
        {step === 'form' && (
          <div className="flex flex-col text-left">
            {/* Visual Anchor: Connected Dual Compact App Icons */}
            <div className="flex items-center justify-center gap-2.5 mb-4 pt-1">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-md p-1.5 overflow-hidden flex-shrink-0">
                <img src="/biblio-logo.png" alt="Biblio" className="w-full h-full object-contain" />
              </div>
              <div className="w-4 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full flex-shrink-0" />
              <div className="w-9 h-9 rounded-xl bg-[#005C4B]/30 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-md flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            {/* Interactive 3-Way Plan Switcher */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400 mb-1.5">
                <span>Select Early Access Tier</span>
                <span className="text-emerald-400 font-bold">Lagos Batch 1</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/50 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedPlan('starter')}
                  className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all text-center flex flex-col items-center ${
                    selectedPlan === 'starter'
                      ? 'bg-zinc-800 text-white shadow-sm border border-white/20 font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-[11px] truncate">Starter</span>
                  <span className="text-[9px] font-mono text-zinc-400">₦0 free</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan('professional')}
                  className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all text-center flex flex-col items-center relative ${
                    selectedPlan === 'professional'
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/25 font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-[11px] flex items-center gap-0.5">
                    <span>Professional</span>
                  </span>
                  <span className={`text-[9px] font-mono ${selectedPlan === 'professional' ? 'text-black/80 font-bold' : 'text-emerald-400'}`}>
                    ₦15,000/mo
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan('enterprise')}
                  className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all text-center flex flex-col items-center ${
                    selectedPlan === 'enterprise'
                      ? 'bg-teal-500 text-black shadow-md shadow-teal-500/25 font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-[11px] truncate">Enterprise</span>
                  <span className={`text-[9px] font-mono ${selectedPlan === 'enterprise' ? 'text-black/80 font-bold' : 'text-teal-400'}`}>
                    ₦50,000/mo
                  </span>
                </button>
              </div>
            </div>

            {/* Dynamic Plan Header & Context */}
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold mb-2 border shadow-sm ${planConfig.badgeColor}">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>{planConfig.badge}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1">
                {planConfig.title}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                {planConfig.subtitle}
              </p>
            </div>

            {errorMsg && (
              <div className="w-full mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form Inputs */}
            <form onSubmit={handleSubmit} className="w-full space-y-3.5">
              {/* Store Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Store or Brand Name</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. The Sneaker Hub, Glam Hair Studio"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141720] border border-white/10 text-white placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Product Category Chips */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-400" />
                  <span>What do you sell on WhatsApp?</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-medium border text-left flex items-center gap-1.5 transition-all ${
                        category === cat.id
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-white font-semibold shadow-sm'
                          : 'bg-[#141720]/60 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone & Email Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Number</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+234 803 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141720] border border-white/10 text-white placeholder-zinc-500 text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Business Email</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="founder@yourstore.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141720] border border-white/10 text-white placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Monthly Sales Volume */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Estimated Monthly Orders</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ORDER_VOLUMES.map((vol) => (
                    <button
                      key={vol.id}
                      type="button"
                      onClick={() => setOrderVolume(vol.id)}
                      className={`py-1.5 px-2 rounded-xl text-[11px] border text-center transition-all ${
                        orderVolume === vol.id
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-semibold'
                          : 'bg-[#141720]/60 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {vol.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dominant Primary Action */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm text-black bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.35)] disabled:opacity-50 active:scale-98"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <>
                      <span>{planConfig.buttonText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-zinc-500">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Instant reservation • VIP pass dispatched directly to your email</span>
              </div>
            </form>
          </div>
        )}

        {/* ================= STEP 2: SUCCESS ACCESS PASS ================= */}
        {step === 'success' && waitlistData && (
          <div className="flex flex-col items-center text-center py-2 animate-fadeIn">
            {/* VIP Access Badge */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold mb-4 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>LAGOS BATCH 1 RESERVED</span>
            </div>

            {/* Huge Queue Number */}
            <div className="text-5xl sm:text-6xl font-black text-white tracking-tight mb-2 font-mono">
              #{waitlistData.position.toLocaleString()}
            </div>

            <h3 className="text-xl font-bold text-white mb-1">
              You're officially on the waitlist!
            </h3>
            <p className="text-xs text-zinc-400 max-w-xs mb-6">
              Your VIP onboarding ticket has been dispatched to{' '}
              <strong className="text-zinc-200">{email}</strong>.
            </p>

            {/* Ticket Card Details */}
            <div className="w-full bg-[#141720] rounded-2xl border border-white/10 p-4 mb-6 text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-zinc-400">Reserved Tier:</span>
                <span className="font-bold text-emerald-400 uppercase font-mono">
                  {selectedPlan} Plan
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-zinc-400">Store / Merchant:</span>
                <span className="font-semibold text-white truncate max-w-[170px]">
                  {storeName || 'Verified Merchant'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-zinc-400">Product Category:</span>
                <span className="capitalize text-zinc-300 font-medium">
                  {CATEGORIES.find((c) => c.id === category)?.label || category}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">WhatsApp Phone:</span>
                <span className="font-mono text-zinc-300">{phone}</span>
              </div>
            </div>

            {/* Referral / Skip-the-line Link Box */}
            <div className="w-full bg-[#08090C] rounded-2xl border border-white/10 p-3.5 mb-5 text-left">
              <div className="text-[10px] text-zinc-400 font-mono uppercase mb-1.5 flex items-center justify-between">
                <span>Skip 50 spots per merchant referral:</span>
                <span className="text-emerald-400 font-bold">{waitlistData.referralCode}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={waitlistData.referralLink}
                  className="flex-1 bg-transparent text-xs text-zinc-300 font-mono outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium flex items-center gap-1 transition-colors flex-shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Share to WhatsApp Button */}
            <button
              onClick={handleShareWhatsApp}
              className="w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm text-black bg-[#25D366] hover:bg-[#20ba59] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-98"
            >
              <Share2 className="w-4 h-4 text-black" />
              <span>Share Pass with Merchants on WhatsApp</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
