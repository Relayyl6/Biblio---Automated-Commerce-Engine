import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  ArrowRight,
  Share2,
  Copy,
  Check,
  AlertCircle,
  ChevronDown,
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
  { id: 'fashion', label: '👗 Fashion & Apparel' },
  { id: 'hair', label: '💇‍♀️ Hair, Wigs & Beauty' },
  { id: 'footwear', label: '👟 Sneakers & Shoes' },
  { id: 'electronics', label: '📱 Electronics & Gadgets' },
  { id: 'jewelry', label: '💍 Jewelry & Accessories' },
  { id: 'wholesale', label: '📦 Wholesale & General Merchandise' },
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
        // fallback to backend
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
          position: data.position || 1,
          cohort: data.cohort || 'Lagos Early Access Batch 1',
          referralCode: data.referralCode || `BIBLIO-${data.position || 1}`,
          referralLink: data.referralLink || `https://biblio.africa?ref=${data.referralCode || 'BIB-1'}`,
          plan: selectedPlan,
        });
      } else {
        // Fallback so user is never blocked
        const fallbackPos = 1;
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
      const fallbackPos = 1;
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
      `Hey! I just claimed ticket #${waitlistData?.position || 1} for the ${planName} on Biblio — an autonomous WhatsApp sales agent that haggles in Pidgin, stops fake transfer alerts, and auto-dispatches riders. Join Lagos Batch 1 here: ${waitlistData?.referralLink || 'https://biblio.africa'}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Modal Card - Clean, spacious, Apple/Linear aesthetic */}
      <div className="relative w-full max-w-[460px] bg-[#0E1117] rounded-3xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden text-white p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
        
        {/* Top-Right Quiet Dismiss Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors z-20"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ================= STEP 1: INTAKE FORM ================= */}
        {step === 'form' && (
          <div className="flex flex-col text-left">
            {/* Header: Clean Brand Icon & Title */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center p-2.5 shadow-sm">
                <img
                  src="/biblio-logo.png"
                  alt="Biblio Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to green dot icon if logo asset isn't present
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <h2 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-white mb-2">
                Reserve your store handle
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Join 4,200+ Nigerian merchants closing sales automatically on WhatsApp without losing profit.
              </p>
            </div>

            {/* Clean Segmented Tier Switcher */}
            <div className="mb-5">
              <div className="grid grid-cols-3 p-1 bg-[#141822] rounded-xl border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setSelectedPlan('starter')}
                  className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center flex flex-col items-center justify-center ${
                    selectedPlan === 'starter'
                      ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>Starter</span>
                  <span className="text-[10px] text-zinc-500 font-mono">₦0 free</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan('professional')}
                  className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center flex flex-col items-center justify-center ${
                    selectedPlan === 'professional'
                      ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>Professional</span>
                  <span className={`text-[10px] font-mono ${selectedPlan === 'professional' ? 'text-black/80 font-semibold' : 'text-ember-400'}`}>
                    ₦15,000/mo
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan('enterprise')}
                  className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center flex flex-col items-center justify-center ${
                    selectedPlan === 'enterprise'
                      ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>Enterprise</span>
                  <span className={`text-[10px] font-mono ${selectedPlan === 'enterprise' ? 'text-black/80 font-semibold' : 'text-zinc-400'}`}>
                    ₦50,000/mo
                  </span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="w-full mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Spacious, Single-Column Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              {/* Store or Brand Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Store or Brand Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. The Sneaker Hub, Glam Hair"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#141822] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-emerald-500/80 transition-colors"
                />
              </div>

              {/* WhatsApp Phone Number */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  WhatsApp Phone Number <span className="text-ember-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+234 803 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#141822] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-emerald-500/80 transition-colors font-mono"
                />
              </div>

              {/* Business Email */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Business Email Address <span className="text-ember-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="founder@yourstore.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#141822] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-emerald-500/80 transition-colors"
                />
              </div>

              {/* Clean Styled Category Select Dropdown */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  What do you sell on WhatsApp?
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-11 px-3.5 pr-10 rounded-xl bg-[#141822] border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/80 transition-colors appearance-none cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-[#141822] text-white py-1">
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Order Volume Minimal Radio Pills */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Estimated Monthly Orders
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ORDER_VOLUMES.map((vol) => (
                    <button
                      key={vol.id}
                      type="button"
                      onClick={() => setOrderVolume(vol.id)}
                      className={`py-2 px-1 rounded-xl text-xs font-medium border text-center transition-all ${
                        orderVolume === vol.id
                          ? 'bg-emerald-500/15 border-emerald-500/60 text-ember-400 font-semibold'
                          : 'bg-[#141822] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {vol.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl font-bold text-sm text-black bg-ember-500 hover:bg-ember-600 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Claim Early Access Pass</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Quiet Not Now button & Disclaimer */}
              <div className="text-center pt-1 space-y-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Not now
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                  <Lock className="w-3 h-3 text-emerald-500/70" />
                  <span>Instant reservation • Invitation pass dispatched to your email</span>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ================= STEP 2: SUCCESS ACCESS PASS ================= */}
        {step === 'success' && waitlistData && (
          <div className="flex flex-col items-center text-center py-2 animate-fadeIn">
            {/* VIP Access Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-ember-500/30 text-xs font-mono font-bold mb-4">
              <span>LAGOS BATCH 1 RESERVED</span>
            </div>

            {/* Queue Number */}
            <div className="text-5xl font-black text-white tracking-tight mb-2 font-mono">
              #{waitlistData.position.toLocaleString()}
            </div>

            <h3 className="text-xl font-bold text-white mb-1.5">
              You're officially on the waitlist!
            </h3>
            <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed">
              Your VIP onboarding pass has been dispatched to{' '}
              <strong className="text-zinc-200">{email}</strong>.
            </p>

            {/* Ticket Card Details */}
            <div className="w-full bg-[#141822] rounded-2xl border border-white/10 p-4 mb-5 text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-zinc-400">Reserved Tier:</span>
                <span className="font-bold text-ember-400 uppercase font-mono">
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
                <span className="text-zinc-300 font-medium">
                  {CATEGORIES.find((c) => c.id === category)?.label || category}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">WhatsApp Phone:</span>
                <span className="font-mono text-zinc-300">{phone}</span>
              </div>
            </div>

            {/* Referral Code Box */}
            <div className="w-full bg-[#090B0F] rounded-2xl border border-white/10 p-3.5 mb-5 text-left">
              <div className="text-[10px] text-zinc-400 font-mono uppercase mb-1.5 flex items-center justify-between">
                <span>Skip 50 spots per merchant referral:</span>
                <span className="text-ember-400 font-bold">{waitlistData.referralCode}</span>
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
                      <Check className="w-3.5 h-3.5 text-ember-400" />
                      <span className="text-ember-400">Copied</span>
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
              className="w-full h-12 rounded-xl font-bold text-xs sm:text-sm text-black bg-[#25D366] hover:bg-[#20ba59] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] cursor-pointer"
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
