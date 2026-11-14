import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  Mic,
  Shield,
  Bike,
  Sparkles,
  Play,
  Pause,
  Copy,
  Check,
  CheckCheck,
  Clock,
  MapPin,
  TrendingUp,
  Package,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const BentoFeatures: React.FC = () => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('0:00');
  const [copiedVan, setCopiedVan] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const bentoTabs = [
    { label: 'Pidgin Haggling', icon: MessageSquare, shortLabel: 'Haggling' },
    { label: 'Voice Notes', icon: Mic, shortLabel: 'Voice Note' },
    { label: 'Paystack Escrow', icon: Shield, shortLabel: 'Escrow' },
    { label: 'Rider Dispatch', icon: Bike, shortLabel: 'Dispatch' },
    { label: 'Status Auto-Poster', icon: TrendingUp, shortLabel: 'Status' },
  ];

  const scrollToCard = (index: number) => {
    setActiveCardIndex(index);
    if (!carouselRef.current) return;
    const card = carouselRef.current.children[index] as HTMLElement;
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const cardWidth = carouselRef.current.children[0]?.clientWidth || 320;
    const newIndex = Math.min(
      4,
      Math.max(0, Math.round(scrollLeft / (cardWidth + 14)))
    );
    if (newIndex !== activeCardIndex) {
      setActiveCardIndex(newIndex);
    }
  };

  const handlePrev = () => {
    if (activeCardIndex > 0) {
      scrollToCard(activeCardIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeCardIndex < 4) {
      scrollToCard(activeCardIndex + 1);
    }
  };

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const total = audioRef.current.duration || 7;
    setAudioProgress((current / total) * 100);
    const mins = Math.floor(current / 60);
    const secs = Math.floor(current % 60);
    setCurrentTimeStr(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setCurrentTimeStr('0:00');
  };

  const handleCopyVan = () => {
    navigator.clipboard?.writeText('9928174520');
    setCopiedVan(true);
    setTimeout(() => setCopiedVan(false), 2000);
  };

  return (
    <section id="features" className="py-14 sm:py-28 relative bg-paper-50 text-ink-950 paper-pattern border-b border-ink-950/8 overflow-hidden w-full max-w-[100vw]">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-8 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ember-50 border border-ember-500/20 text-ember-600 text-xs font-mono font-bold mb-3 sm:mb-4">
            <Sparkles className="w-3.5 h-3.5 text-ember-500" />
            <span>BUILT FOR NIGERIAN SOCIAL MERCHANTS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-ink-950 leading-tight mb-3">
            Everything your store needs to sell on autopilot
          </h2>
          <p className="text-ink-700 text-sm sm:text-base leading-relaxed">
            From natural Pidgin haggling to locking escrow payments and booking dispatch riders without you lifting a finger.
          </p>
        </div>

        {/* Mobile-Only Feature Carousel Navigation Toolbar */}
        <div className="md:hidden flex flex-col gap-2.5 mb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
            {bentoTabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeCardIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => scrollToCard(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                    isActive
                      ? 'bg-ember-500 text-white shadow-md shadow-ember-500/20 font-bold'
                      : 'bg-white text-ink-700 hover:text-ink-950 border border-ink-950/8'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-ink-400">
            <span className="font-mono text-[10px]">
              <span className="text-ember-600 font-bold">{activeCardIndex + 1}</span> of 5 • {bentoTabs[activeCardIndex].label}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                disabled={activeCardIndex === 0}
                className="w-7 h-7 rounded-full bg-white border border-ink-950/8 flex items-center justify-center text-ink-700 disabled:opacity-30 transition-colors shadow-elev-1"
                aria-label="Previous feature"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                disabled={activeCardIndex === 4}
                className="w-7 h-7 rounded-full bg-white border border-ink-950/8 flex items-center justify-center text-ink-700 disabled:opacity-30 transition-colors shadow-elev-1"
                aria-label="Next feature"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bento Grid */}
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex md:grid overflow-x-auto md:overflow-x-visible snap-x snap-mandatory md:snap-none md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pb-4 md:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none items-stretch"
        >

          {/* CARD 1: Pidgin & English Price Bargaining (Span 2 cols on lg) */}
          <div className="w-[88vw] max-w-[360px] md:w-auto md:max-w-none flex-shrink-0 md:flex-shrink snap-center lg:col-span-2 rounded-2xl sm:rounded-3xl bg-white border border-ink-950/8 p-5 sm:p-8 flex flex-col justify-between shadow-elev-1 hover:shadow-elev-2 hover:border-ember-500/30 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-ember-50 border border-ember-500/20 text-ember-600 flex items-center justify-center shadow-sm">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-semibold text-ink-700 px-3 py-1 rounded-full bg-paper-100 border border-ink-950/8">
                  Pidgin & English
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-ink-950 mb-1.5 tracking-tight">
                Pidgin Price Bargaining
              </h3>
              <p className="text-ink-700 text-xs sm:text-sm max-w-xl mb-5 leading-relaxed">
                Haggles in natural street Pidgin. Defends your profit floor with smart bundles and hospitality.
              </p>
            </div>

            {/* Authentic WhatsApp Light Mode Chat Frame */}
            <div className="rounded-xl sm:rounded-2xl bg-[#EFEAE2] border border-ink-950/10 overflow-hidden shadow-sm">
              {/* WhatsApp Chat Header */}
              <div className="px-4 py-2.5 bg-[#075E54] flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white">
                    CB
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-none">Chidi (Customer)</div>
                    <div className="text-[10px] text-emerald-200 mt-0.5">Online</div>
                  </div>
                </div>
                <span className="text-[10px] text-white/80 font-mono">WhatsApp Business</span>
              </div>

              {/* Chat Message Stream */}
              <div className="p-4 space-y-3 bg-[#EFEAE2]">
                {/* Buyer Message */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-white px-3.5 py-2 text-xs text-ink-950 shadow-sm border border-black/5">
                    <p className="leading-relaxed">
                      "Abeg cut am to <span className="font-bold text-ink-950">₦20,000</span> for 2 pairs make I buy sharp sharp."
                    </p>
                    <div className="text-right text-[9px] text-ink-400 mt-0.5">10:42 AM</div>
                  </div>
                </div>

                {/* Biblio Reply */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-[#D9FDD3] px-3.5 py-2 text-xs text-[#111B21] shadow-sm">
                    <p className="leading-relaxed">
                      "Boss, ₦20k go bite capital! 😂 ₦23,000 last last and I go put free shoe brush for you."
                    </p>
                    <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-800 mt-0.5">
                      <span>10:42 AM</span>
                      <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
                    </div>
                  </div>
                </div>

                {/* Buyer Agrees */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-white px-3.5 py-1.5 text-xs text-ink-950 shadow-sm border border-black/5">
                    <p className="leading-relaxed">"Deal! Send account make I pay."</p>
                    <div className="text-right text-[9px] text-ink-400 mt-0.5">10:43 AM</div>
                  </div>
                </div>

                {/* Margin Safeguard Summary */}
                <div className="pt-2.5 border-t border-black/10 mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-ink-700 font-medium">Margin Guardrail</span>
                    <span className="text-settled-600 font-bold font-mono">₦22,500 Min Floor (Protected)</span>
                  </div>
                  <div className="w-full bg-paper-200 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-settled-600 h-full w-[78%]" title="Allowed Concession" />
                    <div className="bg-alert-600 h-full w-[22%]" title="Protected Profit" />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-ink-400 mt-1 font-mono">
                    <span>Floor: ₦22.5k</span>
                    <span className="text-settled-600 font-semibold">Agreed: ₦23k (+₦5k Margin)</span>
                    <span>Retail: ₦28k</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: Voice Note Speech-to-Order */}
          <div className="w-[88vw] max-w-[360px] md:w-auto md:max-w-none flex-shrink-0 md:flex-shrink snap-center rounded-2xl sm:rounded-3xl bg-white border border-ink-950/8 p-5 sm:p-8 flex flex-col justify-between shadow-elev-1 hover:shadow-elev-2 hover:border-ember-500/30 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 border border-teal-500/20 text-teal-600 flex items-center justify-center shadow-sm">
                  <Mic className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-semibold text-ink-700 px-3 py-1 rounded-full bg-paper-100 border border-ink-950/8">
                  Instant Audio
                </span>
              </div>

              <h3 className="text-xl font-bold text-ink-950 mb-1.5 tracking-tight">
                Voice Note Speech-to-Order
              </h3>
              <p className="text-ink-700 text-xs sm:text-sm leading-relaxed mb-5">
                Understands Nigerian accents and Pidgin. Extracts shoe sizes and addresses in 1.4s.
              </p>
            </div>

            {/* Voice Note & Auto-Drafted Order Card */}
            <div className="rounded-xl sm:rounded-2xl bg-paper-50 border border-ink-950/8 p-3.5 space-y-3">
              <audio
                ref={audioRef}
                src="/voice-note-demo.mp3"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleAudioEnded}
                preload="auto"
              />

              {/* WhatsApp Voice Note Player */}
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-ink-950/8 shadow-sm">
                <button
                  type="button"
                  onClick={togglePlayAudio}
                  className="w-9 h-9 rounded-full bg-ember-500 hover:bg-ember-600 text-white flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 shadow-sm cursor-pointer"
                  aria-label={isPlayingAudio ? "Pause voice note" : "Play voice note"}
                >
                  {isPlayingAudio ? (
                    <Pause className="w-4 h-4 fill-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  )}
                </button>

                {/* Waveform */}
                <div className="flex-1 flex items-center gap-1 h-6">
                  {[35, 60, 90, 45, 100, 70, 50, 85, 95, 60, 40, 75, 90, 55, 70, 80, 45, 60].map(
                    (height, i, arr) => {
                      const barPercent = (i / arr.length) * 100;
                      const isPlayed = audioProgress > barPercent;
                      return (
                        <span
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-200 ${
                            isPlayed
                              ? 'bg-ember-500'
                              : isPlayingAudio
                              ? 'bg-ember-500/40'
                              : 'bg-ink-400/30'
                          }`}
                          style={{
                            height: isPlayingAudio
                              ? `${Math.max(25, (height * (Math.sin(i * 0.8 + 1.2)) + 15) % 100)}%`
                              : `${height}%`,
                          }}
                        />
                      );
                    }
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-xs text-ember-600 font-mono font-bold block tabular-nums">
                    {isPlayingAudio ? currentTimeStr : '0:07'}
                  </span>
                  <span className="text-[9px] text-ink-400 font-mono">Audio Note</span>
                </div>
              </div>

              {/* Instant Structured Order Card */}
              <div className="bg-white rounded-xl p-3 border border-ink-950/8 space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-settled-600 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Auto-Drafted from Accent
                  </span>
                  <span className="text-ink-400 font-mono">1.4s • Whisper</span>
                </div>

                <div className="text-[11px] text-ink-700 italic bg-paper-100 p-2 rounded-lg border border-ink-950/5">
                  "Bro, how you dey? I want two bundles of the 30 inches bone straight hair... Ikeja GRA today."
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <div className="w-9 h-9 rounded-lg bg-paper-100 border border-ink-950/8 flex items-center justify-center flex-shrink-0 text-ink-700">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-ink-950 truncate">
                      Bone Straight 30" (13A)
                    </div>
                    <div className="text-[11px] text-ink-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-ink-400" />
                      <span className="truncate">2 Bundles • Ikeja GRA</span>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-settled-600 font-mono tabular-nums">
                    ₦360k
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: Dynamic Paystack VAN Escrow */}
          <div className="w-[88vw] max-w-[360px] md:w-auto md:max-w-none flex-shrink-0 md:flex-shrink snap-center rounded-2xl sm:rounded-3xl bg-white border border-ink-950/8 p-5 sm:p-8 flex flex-col justify-between shadow-elev-1 hover:shadow-elev-2 hover:border-ember-500/30 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-50 border border-cyan-500/20 text-cyan-600 flex items-center justify-center shadow-sm">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-semibold text-ink-700 px-3 py-1 rounded-full bg-paper-100 border border-ink-950/8">
                  Anti-Fraud
                </span>
              </div>

              <h3 className="text-xl font-bold text-ink-950 mb-1.5 tracking-tight">
                Dynamic Paystack VAN Escrow
              </h3>
              <p className="text-ink-700 text-xs sm:text-sm leading-relaxed mb-5">
                One-time 30-minute accounts per checkout. Immune to fake transfer alerts.
              </p>
            </div>

            {/* Apple Wallet / Clean Paystack Card */}
            <div className="rounded-xl sm:rounded-2xl bg-paper-50 border border-ink-950/8 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded bg-amber-400/20 border border-amber-400/50 flex items-center justify-center">
                    <div className="w-3 h-2 border border-amber-400/60 rounded-xs" />
                  </div>
                  <span className="font-bold text-ink-950">Wema Bank</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-settled-600 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>29:48 left</span>
                </div>
              </div>

              {/* Account Number Box */}
              <div className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5 border border-ink-950/8 shadow-sm">
                <div>
                  <div className="text-[10px] text-ink-400 font-medium">One-Time Escrow Account</div>
                  <div className="font-mono text-base font-bold text-ink-950 tracking-wider">
                    9928 1745 20
                  </div>
                </div>
                <button
                  onClick={handleCopyVan}
                  className="px-2.5 py-1.5 rounded-lg bg-paper-100 hover:bg-paper-200 text-xs text-ink-950 font-medium flex items-center gap-1 transition-colors border border-ink-950/8"
                >
                  {copiedVan ? (
                    <>
                      <Check className="w-3 h-3 text-settled-600" />
                      <span className="text-settled-600 text-[11px] font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-ink-700" />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-ink-400 pt-0.5">
                <span>Beneficiary: Biblio Escrow Ltd</span>
                <span className="text-settled-600 font-semibold">Paystack Secured</span>
              </div>
            </div>
          </div>

          {/* CARD 4: 1-Click Kwik Courier Dispatch */}
          <div className="w-[88vw] max-w-[360px] md:w-auto md:max-w-none flex-shrink-0 md:flex-shrink snap-center rounded-2xl sm:rounded-3xl bg-white border border-ink-950/8 p-5 sm:p-8 flex flex-col justify-between shadow-elev-1 hover:shadow-elev-2 hover:border-ember-500/30 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 border border-amber-500/20 text-amber-600 flex items-center justify-center shadow-sm">
                  <Bike className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-semibold text-ink-700 px-3 py-1 rounded-full bg-paper-100 border border-ink-950/8">
                  Auto-Summon
                </span>
              </div>

              <h3 className="text-xl font-bold text-ink-950 mb-1.5 tracking-tight">
                1-Click Dispatch Booking
              </h3>
              <p className="text-ink-700 text-xs sm:text-sm leading-relaxed mb-5">
                Summons the nearest Kwik rider the second escrow clears. SMS tracking sent automatically.
              </p>
            </div>

            {/* Clean Dispatch Routing Card */}
            <div className="rounded-xl sm:rounded-2xl bg-paper-50 border border-ink-950/8 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink-950 flex items-center gap-1.5">
                  <Bike className="w-4 h-4 text-amber-600" />
                  Kwik Delivery #KW-81
                </span>
                <span className="text-settled-600 text-[11px] font-medium bg-settled-50 px-2 py-0.5 rounded-full border border-settled-600/20">
                  En Route (14m)
                </span>
              </div>

              {/* Waypoints line */}
              <div className="relative pl-5 space-y-2 text-xs before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-paper-200">
                <div className="relative">
                  <span className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-ink-400">Pickup:</span> <span className="text-ink-950 font-medium">Merchant Hub (Yaba)</span>
                </div>
                <div className="relative">
                  <span className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-settled-600" />
                  <span className="text-ink-400">Dropoff:</span> <span className="text-ink-950 font-medium">Admiralty Way, Lekki 1</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-2.5 text-[11px] text-ink-700 flex items-center justify-between border border-ink-950/8">
                <span className="font-medium">Rider: Tunde B.</span>
                <span className="text-ink-400 font-mono">SMS Tracking Sent</span>
              </div>
            </div>
          </div>

          {/* CARD 5: WhatsApp Status Auto-Poster */}
          <div className="w-[88vw] max-w-[360px] md:w-auto md:max-w-none flex-shrink-0 md:flex-shrink snap-center rounded-2xl sm:rounded-3xl bg-white border border-ink-950/8 p-5 sm:p-8 flex flex-col justify-between shadow-elev-1 hover:shadow-elev-2 hover:border-ember-500/30 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shadow-sm">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-semibold text-ink-700 px-3 py-1 rounded-full bg-paper-100 border border-ink-950/8">
                  Daily Reach
                </span>
              </div>

              <h3 className="text-xl font-bold text-ink-950 mb-1.5 tracking-tight">
                WhatsApp Status Auto-Poster
              </h3>
              <p className="text-ink-700 text-xs sm:text-sm leading-relaxed mb-5">
                Turns inventory photos into 9:16 WhatsApp Stories. Auto-posted at Lagos peak congestion hours.
              </p>
            </div>

            {/* Story Reach Card */}
            <div className="rounded-xl sm:rounded-2xl bg-paper-50 border border-ink-950/8 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-400">Peak Schedule</span>
                <span className="text-settled-600 text-[11px] font-semibold font-mono">8:00 AM • 1:00 PM • 7:00 PM</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-ink-950/8 flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-[10px] text-ink-400 uppercase font-mono font-medium">Avg Status Views</div>
                  <div className="text-lg font-bold text-ink-950 tabular-nums">1,450+ Daily</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-ink-400 uppercase font-mono font-medium">Direct Orders</div>
                  <div className="text-lg font-bold text-settled-600 font-mono tabular-nums">+38% Lift</div>
                </div>
              </div>

              <div className="text-[11px] text-ink-400 text-center font-mono">
                Automated 9:16 product catalog stories
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
