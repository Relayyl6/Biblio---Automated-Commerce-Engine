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
    const nextIdx = Math.max(0, activeCardIndex - 1);
    scrollToCard(nextIdx);
  };

  const handleNext = () => {
    const nextIdx = Math.min(4, activeCardIndex + 1);
    scrollToCard(nextIdx);
  };

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch((e) => {
        console.warn('Audio playback prevented', e);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const duration = audioRef.current.duration || 6.5;
    setAudioProgress((current / duration) * 100);
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
    <section id="features" className="py-14 sm:py-32 relative bg-[#060709] text-white border-y border-white/[0.08] overflow-hidden w-full max-w-[100vw]">
      {/* Soft atmospheric gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-emerald-500/[0.03] blur-[160px] pointer-events-none rounded-full" />

      <div className="relative max-w-6xl mx-auto px-3.5 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-6 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-white/[0.04] border border-white/10 text-emerald-400 text-[11px] sm:text-xs font-medium mb-2.5 sm:mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built for Nigerian Social Sellers</span>
          </div>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight mb-2 sm:mb-4">
            Everything your store needs to sell on autopilot
          </h2>
          <p className="text-zinc-400 text-xs sm:text-base leading-relaxed">
            From natural Pidgin haggling to locking escrow payments and booking dispatch riders.
          </p>
        </div>

        {/* Mobile-Only Feature Carousel Navigation Toolbar (Eliminates vertical stack) */}
        <div className="md:hidden flex flex-col gap-2.5 mb-4">
          {/* Horizontal scrollable category pill switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3.5 px-3.5">
            {bentoTabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeCardIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => scrollToCard(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                    isActive
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/25 font-bold'
                      : 'bg-[#12141A] text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Stepper info with active dots & chevron triggers */}
          <div className="flex items-center justify-between px-1 text-xs text-zinc-400">
            <span className="font-mono text-[10px] text-zinc-400">
              <span className="text-emerald-400 font-bold">{activeCardIndex + 1}</span> of 5 • {bentoTabs[activeCardIndex].label}
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <button
                    key={i}
                    onClick={() => scrollToCard(i)}
                    aria-label={`Go to feature ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      activeCardIndex === i ? 'w-5 bg-emerald-400' : 'w-1.5 bg-zinc-700'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1 ml-1.5">
                <button
                  onClick={handlePrev}
                  disabled={activeCardIndex === 0}
                  className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 active:bg-white/20 transition-colors"
                  aria-label="Previous feature"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={activeCardIndex === 4}
                  className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 active:bg-white/20 transition-colors"
                  aria-label="Next feature"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bento Grid: Horizontal Snapping Carousel on Mobile (NOT vertically stacked), Multi-Column Grid on Desktop */}
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex md:grid overflow-x-auto md:overflow-x-visible snap-x snap-mandatory md:snap-none md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6 pb-4 md:pb-0 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 scrollbar-none items-stretch"
        >

          {/* CARD 1: Pidgin & English Price Bargaining (Span 2 cols on lg) */}
          <div className="w-[88vw] max-w-[360px] md:w-auto md:max-w-none flex-shrink-0 md:flex-shrink snap-center lg:col-span-2 rounded-2xl sm:rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-4 sm:p-8 flex flex-col justify-between hover:border-white/15 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-[10px] sm:text-xs text-zinc-400 font-medium px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  Pidgin & English
                </span>
              </div>

              <h3 className="text-lg sm:text-2xl font-bold text-white mb-1.5 sm:mb-2 tracking-tight">
                Pidgin Price Bargaining
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mb-4 sm:mb-6 leading-relaxed">
                Haggles in natural street Pidgin. Defends your profit floor with smart bundles.
              </p>
            </div>

            {/* Authentic WhatsApp Dark Mode Chat Card */}
            <div className="rounded-xl sm:rounded-2xl bg-[#11141B] border border-white/[0.08] overflow-hidden shadow-xl">
              {/* WhatsApp Chat Header */}
              <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-[#161B24] border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white">
                    CB
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white leading-none">Chidi (Customer)</div>
                    <div className="text-[9px] sm:text-[10px] text-emerald-400 mt-0.5">Online</div>
                  </div>
                </div>
                <span className="text-[9px] sm:text-[10px] text-zinc-400">WhatsApp Chat</span>
              </div>

              {/* Chat Message Stream */}
              <div className="p-3.5 sm:p-5 space-y-2.5 sm:space-y-3 bg-[#0B0D12]">
                {/* Buyer Message */}
                <div className="flex justify-start">
                  <div className="max-w-[88%] sm:max-w-[85%] rounded-xl sm:rounded-2xl rounded-tl-sm bg-[#1E232E] px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs text-zinc-200">
                    <p className="leading-relaxed">
                      "Abeg cut am to <span className="font-semibold text-white">₦20,000</span> for 2 pairs make I buy sharp sharp."
                    </p>
                    <div className="text-right text-[9px] sm:text-[10px] text-zinc-500 mt-0.5">10:42 AM</div>
                  </div>
                </div>

                {/* Biblio Reply */}
                <div className="flex justify-end">
                  <div className="max-w-[88%] sm:max-w-[85%] rounded-xl sm:rounded-2xl rounded-tr-sm bg-[#005C4B] px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs text-white shadow-md">
                    <p className="leading-relaxed">
                      "Boss, ₦20k go bite capital! 😂 ₦23,000 last last and I go put free shoe brush for you."
                    </p>
                    <div className="flex items-center justify-end gap-1 text-[9px] sm:text-[10px] text-emerald-200/80 mt-0.5">
                      <span>10:42 AM</span>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />
                    </div>
                  </div>
                </div>

                {/* Buyer Agrees */}
                <div className="flex justify-start">
                  <div className="max-w-[88%] sm:max-w-[85%] rounded-xl sm:rounded-2xl rounded-tl-sm bg-[#1E232E] px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs text-zinc-200">
                    <p className="leading-relaxed">"Deal! Send account make I pay."</p>
                    <div className="text-right text-[9px] sm:text-[10px] text-zinc-500 mt-0.5">10:43 AM</div>
                  </div>
                </div>

                {/* Merchant Safeguard Summary */}
                <div className="pt-2.5 sm:pt-3 border-t border-white/[0.08] mt-1.5 sm:mt-2">
                  <div className="flex items-center justify-between text-[11px] sm:text-xs mb-1">
                    <span className="text-zinc-400 font-medium">Margin Guardrail</span>
                    <span className="text-emerald-400 font-bold">₦22,500 Min Floor (Protected)</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 sm:h-2 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full w-[78%]" title="Allowed Concession" />
                    <div className="bg-rose-500 h-full w-[22%]" title="Protected Profit" />
                  </div>
                  <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-zinc-500 mt-1">
                    <span>Floor: ₦22.5k</span>
                    <span className="text-emerald-400 font-semibold">Agreed: ₦23k (+₦5k Margin)</span>
                    <span>Retail: ₦28k</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: Voice Note Speech-to-Order */}
          <div className="w-[88vw] max-w-[360px] md:w-auto md:max-w-none flex-shrink-0 md:flex-shrink snap-center rounded-2xl sm:rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-4 sm:p-8 flex flex-col justify-between hover:border-white/15 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-[10px] sm:text-xs text-zinc-400 font-medium px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  Instant Audio
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2 tracking-tight">
                Voice Note Speech-to-Order
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6">
                Understands Nigerian accents. Extracts shoe sizes and addresses in 1.4s.
              </p>
            </div>

            {/* Voice Note & Auto-Drafted Order Card */}
            <div className="rounded-xl sm:rounded-2xl bg-[#11141B] border border-white/[0.08] p-3 sm:p-4 space-y-2.5 sm:space-y-3.5 shadow-xl">
              {/* Real HTML5 Audio Player with Authentic Nigerian Voice Note */}
              <audio
                ref={audioRef}
                src="/voice-note-demo.mp3"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleAudioEnded}
                preload="auto"
              />

              {/* WhatsApp Voice Note Player with Interactive Playback */}
              <div className="flex items-center gap-2.5 sm:gap-3 bg-[#161B24] p-2.5 sm:p-3 rounded-xl border border-white/[0.05]">
                <button
                  type="button"
                  onClick={togglePlayAudio}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer"
                  aria-label={isPlayingAudio ? "Pause voice note" : "Play voice note"}
                >
                  {isPlayingAudio ? (
                    <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black" />
                  ) : (
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black ml-0.5" />
                  )}
                </button>

                {/* Audio Waveform with dynamic live playback reaction */}
                <div className="flex-1 flex items-center gap-0.5 sm:gap-1 h-6 sm:h-7">
                  {[35, 60, 90, 45, 100, 70, 50, 85, 95, 60, 40, 75, 90, 55, 70, 80, 45, 60].map(
                    (height, i, arr) => {
                      const barPercent = (i / arr.length) * 100;
                      const isPlayed = audioProgress > barPercent;
                      return (
                        <span
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-200 ${
                            isPlayed
                              ? 'bg-emerald-400'
                              : isPlayingAudio
                              ? 'bg-emerald-500/40'
                              : 'bg-zinc-600'
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
                  <span className="text-[11px] sm:text-xs text-emerald-400 font-mono font-bold block">
                    {isPlayingAudio ? currentTimeStr : '0:07'}
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-zinc-500 font-mono">Audio Note</span>
                </div>
              </div>

              {/* Instant Structured Order Card */}
              <div className="bg-[#161B24] rounded-xl p-2.5 sm:p-3 border border-white/[0.06] space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px]">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    Auto-Drafted from Accent
                  </span>
                  <span className="text-zinc-500 font-mono">1.4s • Whisper</span>
                </div>

                <div className="text-[10px] sm:text-[11px] text-zinc-300 italic bg-black/30 p-2 rounded-lg border border-white/5">
                  "Bro, how you dey? I want two bundles of the 30 inches bone straight hair... Ikeja GRA today."
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3 pt-0.5 sm:pt-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center flex-shrink-0 text-zinc-300">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] sm:text-xs font-bold text-white truncate">
                      Bone Straight 30" (13A)
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-zinc-500" />
                      <span className="truncate">2 Bundles • Ikeja GRA</span>
                    </div>
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-emerald-400 font-mono">
                    ₦360k
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: Dynamic Paystack VAN Escrow */}
          <div className="w-[88vw] max-w-[360px] md:w-auto md:max-w-none flex-shrink-0 md:flex-shrink snap-center rounded-2xl sm:rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-4 sm:p-8 flex flex-col justify-between hover:border-white/15 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-[10px] sm:text-xs text-zinc-400 font-medium px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  Anti-Fraud
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2 tracking-tight">
                Dynamic Paystack VAN Escrow
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6">
                One-time 30-minute accounts per checkout. Immune to fake transfer alerts.
              </p>
            </div>

            {/* Apple Wallet / Clean Paystack Card */}
            <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#161B24] to-[#10131A] border border-white/10 p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-4 rounded bg-amber-400/20 border border-amber-400/50 flex items-center justify-center">
                    <div className="w-3 h-2 border border-amber-400/60 rounded-xs" />
                  </div>
                  <span className="font-bold text-white text-[11px] sm:text-xs">Wema Bank</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-400 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>29:48 left</span>
                </div>
              </div>

              {/* Account Number Box */}
              <div className="flex items-center justify-between bg-black/40 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 border border-white/[0.06]">
                <div>
                  <div className="text-[9px] sm:text-[10px] text-zinc-500 font-medium">One-Time Escrow Account</div>
                  <div className="font-mono text-sm sm:text-base font-bold text-white tracking-wider">
                    9928 1745 20
                  </div>
                </div>
                <button
                  onClick={handleCopyVan}
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-zinc-200 flex items-center gap-1 transition-colors"
                >
                  {copiedVan ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-zinc-400 pt-0.5">
                <span>Beneficiary: Biblio Escrow Ltd</span>
                <span className="text-emerald-400 font-medium">Paystack Secured</span>
              </div>
            </div>
          </div>

          {/* CARD 4: 1-Click Kwik Courier Dispatch */}
          <div className="w-[88vw] max-w-[360px] md:w-auto md:max-w-none flex-shrink-0 md:flex-shrink snap-center rounded-2xl sm:rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-4 sm:p-8 flex flex-col justify-between hover:border-white/15 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Bike className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-[10px] sm:text-xs text-zinc-400 font-medium px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  Auto-Summon
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2 tracking-tight">
                1-Click Dispatch Booking
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6">
                Summons the nearest Kwik rider the second escrow clears. SMS tracking sent automatically.
              </p>
            </div>

            {/* Clean Dispatch Routing Card */}
            <div className="rounded-xl sm:rounded-2xl bg-[#11141B] border border-white/[0.08] p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5 text-[11px] sm:text-xs">
                  <Bike className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                  Kwik Delivery #KW-81
                </span>
                <span className="text-emerald-400 text-[10px] sm:text-[11px] font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  En Route (14m)
                </span>
              </div>

              {/* Waypoints line */}
              <div className="relative pl-4 sm:pl-5 space-y-1.5 sm:space-y-2 text-[11px] sm:text-xs before:absolute before:left-1.5 sm:before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-700">
                <div className="relative">
                  <span className="absolute -left-[15px] sm:-left-[17px] top-1.5 w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-zinc-400">Pickup:</span> <span className="text-zinc-200">Merchant Hub (Yaba)</span>
                </div>
                <div className="relative">
                  <span className="absolute -left-[15px] sm:-left-[17px] top-1.5 w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-zinc-400">Dropoff:</span> <span className="text-zinc-200">Admiralty Way, Lekki 1</span>
                </div>
              </div>

              <div className="bg-[#161B24] rounded-lg p-2 text-[10px] sm:text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Rider: Tunde B.</span>
                <span className="text-zinc-300 font-mono">SMS Tracking Sent</span>
              </div>
            </div>
          </div>

          {/* CARD 5: WhatsApp Status Auto-Poster */}
          <div className="w-[88vw] max-w-[360px] md:w-auto md:max-w-none flex-shrink-0 md:flex-shrink snap-center rounded-2xl sm:rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-4 sm:p-8 flex flex-col justify-between hover:border-white/15 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-[10px] sm:text-xs text-zinc-400 font-medium px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  Daily Reach
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2 tracking-tight">
                WhatsApp Status Auto-Poster
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6">
                Turns inventory photos into 9:16 WhatsApp Stories. Auto-posted at peak hours.
              </p>
            </div>

            {/* Story Reach Card */}
            <div className="rounded-xl sm:rounded-2xl bg-[#11141B] border border-white/[0.08] p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-[11px] sm:text-xs">
                <span className="text-zinc-400">Peak Schedule</span>
                <span className="text-emerald-400 text-[10px] sm:text-[11px] font-medium">8:00 AM • 1:00 PM • 7:00 PM</span>
              </div>

              <div className="bg-[#161B24] p-2.5 sm:p-3 rounded-xl border border-white/[0.05] flex items-center justify-between">
                <div>
                  <div className="text-[9px] sm:text-[10px] text-zinc-400 uppercase">Avg Status Views</div>
                  <div className="text-base sm:text-lg font-bold text-white">1,450+ Daily</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] sm:text-[10px] text-zinc-400 uppercase">Direct Orders</div>
                  <div className="text-base sm:text-lg font-bold text-emerald-400">+38% Lift</div>
                </div>
              </div>

              <div className="text-[10px] sm:text-[11px] text-zinc-400 text-center">
                Automated 9:16 product catalog stories
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
