import React, { useState } from 'react';
import {
  Send,
  CheckCheck,
  ShieldCheck,
  Building,
  Copy,
  Bike,
  Sparkles,
  Volume2,
  Phone,
  Video,
  Check,
  Smartphone,
  BookOpen,
  ChevronLeft,
  Plus,
  Camera,
  Mic,
  Play,
  Pause,
  Search,
  MoreVertical,
} from 'lucide-react';
import { ChatMessage } from '../types';

export const WhatsAppSimulator: React.FC = () => {
  const [deviceMode, setDeviceMode] = useState<'iphone' | 'foldable'>('iphone');
  const [selectedDialect, setSelectedDialect] = useState<'pidgin' | 'lagos' | 'formal'>('pidgin');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [aiPaused, setAiPaused] = useState(false);
  const [escrowReleased, setEscrowReleased] = useState(false);

  // Chat datasets for each scenario
  const initialChats: Record<string, ChatMessage[]> = {
    pidgin: [
      {
        id: '1',
        sender: 'customer',
        text: 'How far boss? How much last for the Jordan 4 (size 44)?',
        timestamp: '10:42 AM',
      },
      {
        id: '2',
        sender: 'biblio',
        text: 'How you dey boss! Last price na ₦40,000 for status buyers. Make I pack am?',
        timestamp: '10:42 AM',
      },
      {
        id: '3',
        sender: 'customer',
        text: 'Abeg make we do ₦37k sharp sharp.',
        timestamp: '10:43 AM',
      },
      {
        id: '4',
        sender: 'biblio',
        text: 'Oga mi, ₦37k go bite capital! 😂 ₦38,500 last and I go put free shoe cleaner.',
        timestamp: '10:43 AM',
      },
      {
        id: '5',
        sender: 'customer',
        text: 'Deal. Send am to 14 Admiralty Way, Lekki 1.',
        timestamp: '10:44 AM',
      },
      {
        id: '6',
        sender: 'biblio',
        text: 'Sharp! Here is your dedicated escrow account. Locked till shoes land safely:',
        timestamp: '10:44 AM',
        hasVanCard: true,
        vanDetails: {
          bank: 'Wema Bank (Paystack Escrow)',
          accountNo: '9928174520',
          amount: '₦38,500',
          expiresIn: '28:45 left',
        },
      },
    ],
    lagos: [
      {
        id: '1',
        sender: 'customer',
        text: 'Bro, you get 30 inches bone straight?',
        timestamp: '11:15 AM',
      },
      {
        id: '2',
        sender: 'biblio',
        text: 'Yes chief! Grade 13A double drawn dey available. ₦185,000 per bundle.',
        timestamp: '11:15 AM',
      },
      {
        id: '3',
        sender: 'customer',
        text: 'Can I send voice note? My keyboard dey mess up.',
        timestamp: '11:16 AM',
      },
      {
        id: '4',
        sender: 'customer',
        text: '🎙️ Voice Note (0:14): "Bro I want 2 bundles, need am for Ikeja GRA today."',
        timestamp: '11:16 AM',
        isAudio: true,
        audioDuration: '0:14',
      },
      {
        id: '5',
        sender: 'biblio',
        text: 'Got you! 2 bundles locked at ₦360k. Kwik rider on standby for Ikeja:',
        timestamp: '11:16 AM',
        hasVanCard: true,
        vanDetails: {
          bank: 'Titan Trust (Paystack Escrow)',
          accountNo: '7821094311',
          amount: '₦360,000',
          expiresIn: '29:10 left',
        },
      },
    ],
    formal: [
      {
        id: '1',
        sender: 'customer',
        text: 'Good afternoon. Inquiring on wholesale pricing for cotton polos (qty: 50).',
        timestamp: '02:20 PM',
      },
      {
        id: '2',
        sender: 'biblio',
        text: 'Good afternoon! For 50 units, our wholesale rate is ₦7,500/unit (₦375,000 total).',
        timestamp: '02:20 PM',
      },
      {
        id: '3',
        sender: 'customer',
        text: 'Approved. Send invoice account for Victoria Island delivery.',
        timestamp: '02:22 PM',
      },
      {
        id: '4',
        sender: 'biblio',
        text: 'Done! One-time corporate escrow account generated below:',
        timestamp: '02:22 PM',
        hasVanCard: true,
        vanDetails: {
          bank: 'Wema Bank (Corporate Escrow)',
          accountNo: '8810239401',
          amount: '₦375,000',
          expiresIn: '29:55 left',
        },
        hasRiderCard: true,
        riderDetails: {
          courier: 'Kwik Delivery #KW-902',
          trackingId: 'KW-LAG-8829',
          eta: 'ETA: 18 mins',
        },
      },
    ],
  };

  const [messages, setMessages] = useState<ChatMessage[]>(initialChats.pidgin);

  const handleDialectChange = (dialect: 'pidgin' | 'lagos' | 'formal') => {
    setSelectedDialect(dialect);
    setMessages(initialChats[dialect]);
  };

  const handleCopyAccount = (acc: string) => {
    navigator.clipboard?.writeText(acc);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userText = inputMsg;
    setInputMsg('');

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'customer',
      text: userText,
      timestamp: 'Now',
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let replyText = '';
      if (userText.toLowerCase().includes('discount') || userText.toLowerCase().includes('price') || userText.toLowerCase().includes('last')) {
        replyText = selectedDialect === 'pidgin'
          ? 'Boss, I check margin. Special ₦36,500 approved for you.'
          : 'Offer reviewed. A 5% concession is approved for immediate settlement.';
      } else if (userText.toLowerCase().includes('pay') || userText.toLowerCase().includes('paid')) {
        replyText = 'Payment verified via Paystack! ₦38,500 locked. Kwik Rider assigned #KW-81.';
      } else {
        replyText = 'Noted! Synced to merchant dashboard. Anything else to add?';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'biblio',
          text: replyText,
          timestamp: 'Now',
          hasRiderCard: userText.toLowerCase().includes('pay'),
          riderDetails: userText.toLowerCase().includes('pay')
            ? { courier: 'Kwik Express Delivery', trackingId: 'KW-LIVE-2049', eta: 'ETA: 12 mins' }
            : undefined,
        },
      ]);
    }, 850);
  };

  const handleReleaseEscrow = () => {
    setEscrowReleased(true);
    setTimeout(() => setEscrowReleased(false), 3000);
  };

  // WhatsApp Foldable Left-Pane Conversation List
  const foldableConversations = [
    {
      id: 'pidgin',
      title: 'Tobi (@thesneakerhub)',
      avatar: '👟',
      avatarBg: 'bg-emerald-600',
      subtitle: 'Sharp! Here is your dedicated escrow...',
      time: '10:44 AM',
      unreadCount: 0,
      badge: '₦38,500 ESCROW',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      activeProduct: 'Nike Air Jordan 4 (Size 44)',
    },
    {
      id: 'lagos',
      title: 'Chidi (Ikeja Hair Studio)',
      avatar: '💇‍♀️',
      avatarBg: 'bg-teal-600',
      subtitle: '🎙️ Voice note (0:14) • 2 bundles locked',
      time: '11:16 AM',
      unreadCount: 1,
      badge: 'KWIK DISPATCH',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      activeProduct: 'Bone Straight 30" (Grade 13A)',
    },
    {
      id: 'formal',
      title: 'Hauwa (VI Polos Wholesale)',
      avatar: '👔',
      avatarBg: 'bg-blue-600',
      subtitle: 'Approved. Send invoice account for delivery',
      time: '02:22 PM',
      unreadCount: 0,
      badge: 'INVOICED',
      badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      activeProduct: 'Luxury Cotton Polos (50x)',
    },
    {
      id: 'yaba',
      title: 'Emeka (Yaba Market Tech)',
      avatar: '📱',
      avatarBg: 'bg-zinc-700',
      subtitle: '✓✓ Payment settled to Wema account',
      time: 'Yesterday',
      unreadCount: 0,
      badge: 'DELIVERED',
      badgeColor: 'text-zinc-400 bg-zinc-800 border-zinc-700',
      activeProduct: 'iPhone 15 Case Pack',
    },
    {
      id: 'lekki',
      title: 'Blessing (Lekki Phase 1)',
      avatar: '🛍️',
      avatarBg: 'bg-purple-700',
      subtitle: 'Boss, you get size 42 in stock?',
      time: 'Wednesday',
      unreadCount: 0,
      badge: 'INQUIRY',
      badgeColor: 'text-zinc-400 bg-zinc-800 border-zinc-700',
      activeProduct: 'Dunk Low Panda',
    },
  ];

  return (
    <section id="simulator" className="py-24 sm:py-32 bg-[#060709] text-white relative overflow-hidden border-b border-white/[0.08] apple-subtle-grid">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-emerald-400 text-xs font-medium mb-3 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Simulator</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
            Experience the Nigerian AI live
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Haggle in Pidgin, test voice notes, or unfold into native WhatsApp dual-pane view.
          </p>
        </div>

        {/* Unified Controls Toolbar: Dialects on Left, Hardware Form Factor Toggle BESIDE it on Right */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-4xl mx-auto mb-10 p-1.5 rounded-2xl bg-zinc-900/80 border border-white/10 shadow-xl backdrop-blur-xl">
          {/* Dialect Switcher on Left */}
          <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-start">
            <span className="text-[10px] font-mono uppercase text-zinc-500 px-2 hidden md:inline">Dialect:</span>
            <button
              onClick={() => handleDialectChange('pidgin')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedDialect === 'pidgin'
                  ? 'bg-emerald-500 text-black shadow-md font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              🇳🇬 Pidgin
            </button>
            <button
              onClick={() => handleDialectChange('lagos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedDialect === 'lagos'
                  ? 'bg-emerald-500 text-black shadow-md font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              🎙️ Voice Note
            </button>
            <button
              onClick={() => handleDialectChange('formal')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedDialect === 'formal'
                  ? 'bg-emerald-500 text-black shadow-md font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              👔 Formal
            </button>
          </div>

          {/* Hardware Device Toggle Placed Directly BESIDE it on Right */}
          <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/5 w-full sm:w-auto justify-center">
            <button
              onClick={() => setDeviceMode('iphone')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                deviceMode === 'iphone'
                  ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_12px_rgba(16,185,129,0.35)] font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>iPhone 15 Pro</span>
            </button>
            
            <button
              onClick={() => setDeviceMode('foldable')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                deviceMode === 'foldable'
                  ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_12px_rgba(16,185,129,0.35)] font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Foldable Duo</span>
            </button>
          </div>
        </div>

        {/* Device Stage with Smooth Scripted Transition Animation */}
        <div className="flex justify-center items-center w-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]">
          
          {deviceMode === 'iphone' ? (
            /* ================= MODE 1: AUTHENTIC UPRIGHT IPHONE 15 PRO (19.5:9 SLENDER ASPECT RATIO) ================= */
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto transition-all duration-700">
              
              {/* Upright iPhone 15 Pro Chassis with Real 19.5:9 Proportions */}
              <div className="lg:col-span-7 flex justify-center">
                {/* Slender Titanium Outer Chassis: 380px wide x 760px tall = exact 1:2 slender iPhone stance */}
                <div className="relative w-[370px] sm:w-[385px] h-[750px] sm:h-[765px] p-[3.5px] rounded-[52px] bg-gradient-to-b from-[#484a51] via-[#242529] to-[#121316] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.98),0_0_45px_rgba(16,185,129,0.08),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-white/10 flex flex-col flex-shrink-0">
                  
                  {/* Subtle Earpiece Speaker Slit on Top Titanium Rim */}
                  <div className="absolute top-[8px] left-1/2 -translate-x-1/2 w-14 h-1 bg-zinc-800 rounded-full z-40" />

                  {/* Inner Black Bezel */}
                  <div className="p-[7px] rounded-[49px] bg-black h-full flex flex-col">
                    
                    {/* Screen Viewport with Proper Inner Radius */}
                    <div className="rounded-[42px] overflow-hidden bg-[#0B141A] relative flex flex-col h-full shadow-inner select-none border border-white/[0.04]">
                      
                      {/* Top Dedicated Status Bar Zone with Centered Dynamic Island */}
                      <div className="relative bg-[#1F2C34] pt-2 px-6 pb-2 z-30 select-none border-b border-white/[0.04] flex-shrink-0">
                        {/* Status bar details */}
                        <div className="flex items-center justify-between text-white text-[12px] font-semibold tracking-tight">
                          <span>9:41</span>
                          <div className="flex items-center gap-1.5 text-white">
                            <svg className="w-3.5 h-2.5" viewBox="0 0 17 12" fill="currentColor">
                              <rect x="0" y="9" width="2.5" height="3" rx="0.5" />
                              <rect x="4.5" y="6" width="2.5" height="6" rx="0.5" />
                              <rect x="9" y="3" width="2.5" height="9" rx="0.5" />
                              <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" />
                            </svg>
                            <span className="text-[10px] font-bold">5G</span>
                            <div className="flex items-center gap-0.5">
                              <div className="w-5 h-2.5 rounded-[4px] border border-white/80 p-0.5 flex items-center">
                                <div className="h-full w-full bg-emerald-400 rounded-[2px]" />
                              </div>
                              <div className="w-0.5 h-1 bg-white/80 rounded-r-sm" />
                            </div>
                          </div>
                        </div>

                        {/* Centered Dynamic Island (properly nestled within the top 44px zone) */}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[114px] h-[26px] bg-black rounded-full flex items-center justify-between px-2.5 shadow-md border border-white/[0.05] pointer-events-none">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#14151a] border border-[#2a2c33] flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-[#0a1829]" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp iOS Header (Cleanly Positioned BELOW Status Bar with Adequate Spacing) */}
                      <div className="bg-[#1F2C34] px-3.5 py-2.5 flex items-center justify-between border-b border-white/[0.06] flex-shrink-0 z-20">
                        <div className="flex items-center gap-2 min-w-0">
                          <button className="flex items-center text-[#53bdeb] hover:text-[#72cbf0] -ml-1">
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-xs font-medium">12</span>
                          </button>
                          
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-600 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-sm">
                            <img src="/biblio-logo.png" alt="Biblio Bot" className="w-full h-full object-cover" />
                          </div>

                          <div className="min-w-0 truncate">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-xs text-white truncate">Biblio Agent (Nike Hub)</span>
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            </div>
                            <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Live Autopilot • 1.8s reply</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-zinc-300">
                          <Video className="w-4 h-4 cursor-pointer hover:text-white" />
                          <Phone className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                        </div>
                      </div>

                      {/* WhatsApp Message Stream with Slender Proportions */}
                      <div
                        className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#0B141A]"
                        style={{
                          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 0)`,
                          backgroundSize: '24px 24px',
                        }}
                      >
                        {/* NDPA E2E Security Chip */}
                        <div className="text-center my-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#182229]/80 border border-white/5 text-[9px] text-amber-300/80 font-mono">
                            🔒 Encrypted with NDPA 2023 compliance
                          </span>
                        </div>

                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs shadow-md relative ${
                                msg.sender === 'customer'
                                  ? 'bg-[#005C4B] text-white rounded-tr-xs'
                                  : 'bg-[#202C33] text-zinc-100 rounded-tl-xs border border-white/[0.06]'
                              }`}
                            >
                              {/* Voice Note Audio Bar */}
                              {msg.isAudio && (
                                <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-white/10 text-emerald-300 font-semibold text-[11px]">
                                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center flex-shrink-0">
                                    <Play className="w-3 h-3 fill-black ml-0.5" />
                                  </div>
                                  <div className="flex-1 flex items-center gap-0.5">
                                    <div className="w-1 h-3 bg-emerald-400 rounded-full" />
                                    <div className="w-1 h-5 bg-emerald-300 rounded-full" />
                                    <div className="w-1 h-2 bg-emerald-500 rounded-full" />
                                    <div className="w-1 h-6 bg-emerald-400 rounded-full" />
                                    <div className="w-1 h-4 bg-emerald-200 rounded-full" />
                                    <div className="w-1 h-3 bg-emerald-400 rounded-full" />
                                    <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                                  </div>
                                  <span className="text-[10px] text-emerald-200 font-mono">0:14</span>
                                </div>
                              )}

                              <p className="leading-relaxed text-[12px]">{msg.text}</p>

                              {/* Paystack VAN Card */}
                              {msg.hasVanCard && msg.vanDetails && (
                                <div className="mt-2 p-2.5 rounded-xl bg-[#182229] border border-emerald-500/25 space-y-1.5 shadow-sm">
                                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                    <span className="flex items-center gap-1 font-medium text-white">
                                      <Building className="w-3 h-3 text-emerald-400" />
                                      {msg.vanDetails.bank}
                                    </span>
                                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                      {msg.vanDetails.expiresIn}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between bg-black/50 px-2.5 py-1.5 rounded-lg border border-white/5">
                                    <span className="font-mono font-bold text-white tracking-wider text-xs">
                                      {msg.vanDetails.accountNo}
                                    </span>
                                    <button
                                      onClick={() => handleCopyAccount(msg.vanDetails!.accountNo)}
                                      className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                                    >
                                      {copiedAccount ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                      <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  </div>

                                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                                    <span>Escrow locked amount:</span>
                                    <span className="font-bold text-emerald-300 text-xs">{msg.vanDetails.amount}</span>
                                  </div>
                                </div>
                              )}

                              {/* Kwik Rider Card */}
                              {msg.hasRiderCard && msg.riderDetails && (
                                <div className="mt-2 p-2 rounded-xl bg-[#182229] border border-amber-500/30 text-zinc-200">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                                    <span className="flex items-center gap-1">
                                      <Bike className="w-3.5 h-3.5" />
                                      {msg.riderDetails.courier}
                                    </span>
                                    <span className="text-emerald-400 text-[10px] font-mono">{msg.riderDetails.eta}</span>
                                  </div>
                                </div>
                              )}

                              {/* Timestamp & Blue Checks */}
                              <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-zinc-400">
                                <span>{msg.timestamp}</span>
                                {msg.sender === 'customer' && (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        {isTyping && (
                          <div className="flex items-center gap-1.5 text-zinc-400 text-xs pl-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                            <span className="text-[10px] text-zinc-500 ml-1">typing...</span>
                          </div>
                        )}
                      </div>

                      {/* WhatsApp iOS Input Dock */}
                      <form onSubmit={handleSendMessage} className="bg-[#202C33] px-2.5 py-2 flex items-center gap-2 border-t border-white/[0.06] flex-shrink-0">
                        <button type="button" className="text-zinc-400 hover:text-white p-1">
                          <Plus className="w-5 h-5 text-[#53bdeb]" />
                        </button>
                        
                        <input
                          type="text"
                          value={inputMsg}
                          onChange={(e) => setInputMsg(e.target.value)}
                          placeholder="Type a message or price offer..."
                          className="flex-1 bg-[#2A3942] text-white placeholder-zinc-400 text-xs rounded-full px-3.5 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
                        />

                        {inputMsg.trim() ? (
                          <button
                            type="submit"
                            className="p-2 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition-colors shadow-md"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <Camera className="w-4 h-4 cursor-pointer hover:text-white" />
                            <Mic className="w-4 h-4 cursor-pointer hover:text-white" />
                          </div>
                        )}
                      </form>

                      {/* iOS Home Indicator Bar */}
                      <div className="bg-[#202C33] pt-1 pb-2 flex justify-center flex-shrink-0">
                        <div className="w-32 h-1 bg-white/40 rounded-full" />
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              {/* Exterior Telemetry: Lean & Punchy (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-6 sm:p-7 space-y-5 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Telemetry: 1.84s Response
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      100% Autopilot
                    </span>
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Step 1 */}
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                        1
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">Floor Price Enforced</div>
                        <div className="text-zinc-400 mt-0.5 leading-relaxed">
                          Buyer offered ₦37,000. Biblio countered at ₦38,500 with a free shoe brush without losing margin.
                        </div>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                        2
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">Dynamic Paystack VAN Escrow</div>
                        <div className="text-zinc-400 mt-0.5 leading-relaxed">
                          Generates unique 30-minute Wema Bank account locked to order. Zero exposure to fake transfer alerts.
                        </div>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                        3
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">Automated Courier Dispatch</div>
                        <div className="text-zinc-400 mt-0.5 leading-relaxed">
                          On payment webhook, Kwik Bike is summoned automatically. Rider pickup code texted to both parties.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Open Canvas Teaser */}
                  <div className="pt-2 border-t border-white/[0.06]">
                    <button
                      onClick={() => setDeviceMode('foldable')}
                      className="w-full py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all group"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Unfold into WhatsApp Dual-Screen</span>
                      <span className="text-zinc-400 group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>

                {/* Human Veto Guarantee Card */}
                <div className="rounded-2xl bg-[#0D0F14] border border-white/[0.08] p-4 flex items-center justify-between text-xs shadow-md">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-zinc-300">
                      Human Veto Always Active: type <code className="text-emerald-400 font-mono">/pause</code>
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">100% Control</span>
                </div>
              </div>

            </div>
          ) : (
            /* ================= MODE 2: AUTHENTIC NATIVE WHATSAPP ON A FOLDABLE (TWO-COLUMN SPLIT PANE) ================= */
            <div className="w-full max-w-5xl mx-auto transition-all duration-700">
              
              {/* Dual-Screen Foldable Hardware Chassis */}
              <div className="relative rounded-[42px] sm:rounded-[48px] p-3 sm:p-4 bg-gradient-to-b from-[#2E3138] via-[#1B1C20] to-[#0C0D10] border border-white/15 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.98),0_0_60px_rgba(16,185,129,0.12)]">
                
                {/* Foldable Dual Screen Screenport */}
                <div className="flex flex-col md:flex-row bg-[#0B141A] rounded-[34px] overflow-hidden border border-white/10 shadow-inner h-[620px]">
                  
                  {/* ====== LEFT SCREEN (38% WIDTH): WHATSAPP CHATS LIST / INBOX ====== */}
                  <div className="w-full md:w-[38%] flex flex-col h-full bg-[#111B21] border-b md:border-b-0 md:border-r border-white/10 flex-shrink-0">
                    
                    {/* WhatsApp Top Header Bar */}
                    <div className="bg-[#202C33] px-4 py-3 flex items-center justify-between border-b border-white/[0.06] flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white tracking-wide">WhatsApp Business</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>
                      <div className="flex items-center gap-3 text-zinc-300">
                        <Camera className="w-4 h-4 cursor-pointer hover:text-white" />
                        <Search className="w-4 h-4 cursor-pointer hover:text-white" />
                        <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white" />
                      </div>
                    </div>

                    {/* WhatsApp Filter Pills: All, Unread, Orders, Groups */}
                    <div className="px-3 py-2 bg-[#111B21] flex items-center gap-1.5 border-b border-white/[0.04] text-[11px] overflow-x-auto">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                        All
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium hover:text-white cursor-pointer">
                        Unread (1)
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium hover:text-white cursor-pointer">
                        Escrow Orders (3)
                      </span>
                    </div>

                    {/* WhatsApp Conversation List (Interactive: Clicking switches dialect & chat) */}
                    <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
                      {foldableConversations.map((conv) => {
                        const isSelected = selectedDialect === conv.id;
                        return (
                          <div
                            key={conv.id}
                            onClick={() => {
                              if (conv.id === 'pidgin' || conv.id === 'lagos' || conv.id === 'formal') {
                                handleDialectChange(conv.id);
                              }
                            }}
                            className={`px-3.5 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#2A3942]/60 border-l-4 border-emerald-400'
                                : 'hover:bg-[#202C33]/50'
                            }`}
                          >
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-full ${conv.avatarBg} flex items-center justify-center text-base flex-shrink-0 shadow-sm border border-white/10`}>
                              {conv.avatar}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-white truncate">{conv.title}</span>
                                <span className={`text-[10px] font-mono ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                  {conv.time}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                {conv.subtitle}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${conv.badgeColor}`}>
                                  {conv.badge}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Left Pane Autopilot Summary Footer */}
                    <div className="p-3 bg-[#182229] border-t border-white/[0.06] text-xs flex items-center justify-between text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] text-white font-medium">Autopilot Active</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">3 Deals Closed Today</span>
                    </div>

                  </div>

                  {/* ====== CENTRAL MECHANICAL HINGE (Hardware Spine) ====== */}
                  <div className="hidden md:flex flex-col items-center justify-between w-3 bg-gradient-to-r from-black/90 via-zinc-800/80 to-black/90 border-x border-white/[0.08] relative shadow-2xl py-6 select-none flex-shrink-0">
                    <div className="w-1.5 h-4 bg-zinc-700 rounded-full" />
                    <div className="w-1 h-24 bg-zinc-600/40 rounded-full" />
                    <div className="w-1.5 h-4 bg-zinc-700 rounded-full" />
                  </div>

                  {/* ====== RIGHT SCREEN (62% WIDTH): ACTIVE WHATSAPP CHAT & AGENT ESCROW PANEL ====== */}
                  <div className="flex-1 flex flex-col h-full bg-[#0B141A] relative">
                    
                    {/* Right Screen Chat Top Bar */}
                    <div className="bg-[#202C33] px-4 py-2.5 flex items-center justify-between border-b border-white/[0.06] flex-shrink-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-600 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-sm">
                          <img src="/biblio-logo.png" alt="Biblio Bot" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 truncate">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-white truncate">
                              Biblio Agent • {selectedDialect === 'pidgin' ? 'Nike Hub' : selectedDialect === 'lagos' ? 'Hair Studio' : 'Wholesale VI'}
                            </span>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          </div>
                          <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>1.8s Response • Floor Enforced</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-zinc-300">
                        <Video className="w-4 h-4 cursor-pointer hover:text-white" />
                        <Phone className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                        <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white" />
                      </div>
                    </div>

                    {/* Chat Message Stream */}
                    <div
                      className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0B141A]"
                      style={{
                        backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 0)`,
                        backgroundSize: '24px 24px',
                      }}
                    >
                      {/* Security notice */}
                      <div className="text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#182229]/80 border border-white/5 text-[9px] text-amber-300/80 font-mono">
                          🔒 Messages are end-to-end encrypted with NDPA 2023 compliance
                        </span>
                      </div>

                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-md ${
                              msg.sender === 'customer'
                                ? 'bg-[#005C4B] text-white rounded-tr-xs'
                                : 'bg-[#202C33] text-zinc-100 rounded-tl-xs border border-white/[0.06]'
                            }`}
                          >
                            {msg.isAudio && (
                              <div className="flex items-center gap-2 mb-1 pb-1 border-b border-white/10 text-emerald-300 font-semibold text-[11px]">
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Voice Note ({msg.audioDuration})</span>
                              </div>
                            )}

                            <p className="leading-relaxed text-[12px]">{msg.text}</p>

                            {/* Paystack VAN Escrow Card */}
                            {msg.hasVanCard && msg.vanDetails && (
                              <div className="mt-2 p-2.5 rounded-xl bg-[#182229] border border-emerald-500/25 space-y-1.5 shadow-sm">
                                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                  <span className="flex items-center gap-1 font-medium text-white">
                                    <Building className="w-3 h-3 text-emerald-400" />
                                    {msg.vanDetails.bank}
                                  </span>
                                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                    {msg.vanDetails.expiresIn}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between bg-black/50 px-2.5 py-1.5 rounded-lg border border-white/5 font-mono text-xs">
                                  <span className="text-white font-bold tracking-wider">{msg.vanDetails.accountNo}</span>
                                  <button
                                    onClick={() => handleCopyAccount(msg.vanDetails!.accountNo)}
                                    className="text-emerald-400 hover:text-emerald-300 text-[10px] font-semibold flex items-center gap-1"
                                  >
                                    {copiedAccount ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                                  </button>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-zinc-400">
                                  <span>Escrow locked amount:</span>
                                  <span className="font-bold text-emerald-300 text-xs">{msg.vanDetails.amount}</span>
                                </div>
                              </div>
                            )}

                            {/* Kwik Rider Card */}
                            {msg.hasRiderCard && msg.riderDetails && (
                              <div className="mt-2 p-2 rounded-xl bg-[#182229] border border-amber-500/30 text-zinc-200">
                                <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                                  <span className="flex items-center gap-1">
                                    <Bike className="w-3.5 h-3.5" />
                                    {msg.riderDetails.courier}
                                  </span>
                                  <span className="text-emerald-400 text-[10px] font-mono">{msg.riderDetails.eta}</span>
                                </div>
                              </div>
                            )}

                            {/* Checks */}
                            <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-zinc-400">
                              <span>{msg.timestamp}</span>
                              {msg.sender === 'customer' && (
                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {isTyping && (
                        <div className="flex items-center gap-1.5 text-zinc-400 text-xs pl-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                          <span className="text-[10px] text-zinc-500 ml-1">typing...</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Merchant Controls Strip (Native to WhatsApp Foldable Business Edition) */}
                    <div className="px-3.5 py-2 bg-[#182229] border-t border-white/[0.06] flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleReleaseEscrow}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all ${
                            escrowReleased
                              ? 'bg-emerald-400 text-black shadow-md'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>{escrowReleased ? 'Escrow Released to Bank!' : 'Release Escrow'}</span>
                        </button>

                        <button
                          onClick={() => setAiPaused(!aiPaused)}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all ${
                            aiPaused
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-zinc-800/90 border-white/10 text-zinc-300 hover:text-white'
                          }`}
                        >
                          {aiPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                          <span>{aiPaused ? 'Resume AI' : 'Pause AI'}</span>
                        </button>
                      </div>

                      <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                        <Bike className="w-3.5 h-3.5 text-amber-400" />
                        <span>Kwik #KW-81 (14m ETA)</span>
                      </div>
                    </div>

                    {/* WhatsApp Input Bar */}
                    <form onSubmit={handleSendMessage} className="bg-[#202C33] px-3 py-2 flex items-center gap-2 border-t border-white/[0.06]">
                      <button type="button" className="text-zinc-400 hover:text-white p-1">
                        <Plus className="w-5 h-5 text-[#53bdeb]" />
                      </button>
                      
                      <input
                        type="text"
                        value={inputMsg}
                        onChange={(e) => setInputMsg(e.target.value)}
                        placeholder="Type a message or price offer..."
                        className="flex-1 bg-[#2A3942] text-white placeholder-zinc-400 text-xs rounded-full px-3.5 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
                      />

                      {inputMsg.trim() ? (
                        <button
                          type="submit"
                          className="p-2 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition-colors shadow-md"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Camera className="w-4 h-4 cursor-pointer hover:text-white" />
                          <Mic className="w-4 h-4 cursor-pointer hover:text-white" />
                        </div>
                      )}
                    </form>

                  </div>

                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </section>
  );
};
