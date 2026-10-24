import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  TextInput,
  Platform,
  LayoutAnimation,
  UIManager,
  Modal,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { useRouter } from 'expo-router';
import { useAlert } from '../src/store/alertStore';
import { useAuthStore } from '../src/store/authStore';
import {
  Mail,
  PhoneCall,
  MessageCircle,
  Globe,
  ExternalLink,
  HelpCircle,
  ChevronDown,
  Search,
  Activity,
  Star,
  Send,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Calendar,
  Lock,
  FileText,
  X,
  Shield,
} from 'lucide-react-native';
import { colors } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useSubmitSupportTicket } from '../src/api/client';
import { InlineLoadingDots } from '../src/components/PulsingSkeleton';

type C = typeof colors.light;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQS: { id: string; question: string; answer: string; category?: string }[] = [
  {
    id: 'why-birthday',
    question: 'Why does Biblio ask for my birthday?',
    category: 'compliance',
    answer:
      'We collect your birthday under the Nigeria Data Protection Act (NDPA 2023) and Central Bank of Nigeria (CBN) regulations. This enables automated commercial contracts, Providus Bank Virtual Account Number (VAN) escrow generation, and Paystack settlement. Account holders must be at least 18 years old to legally operate autonomous trading agents. Your birthday is kept confidential and is never displayed on your public storefront or customer receipts.',
  },
  {
    id: 'whatsapp',
    question: 'How do I connect my WhatsApp Business number?',
    answer:
      'Go to Menu → WhatsApp Companion Linking. Enter your phone number to receive an 8-character pairing code. In WhatsApp, tap Linked Devices → Link a Device → Link with Phone Number.',
  },
  {
    id: 'ai-drafts',
    question: 'How does Biblio AI decide what to reply to customers?',
    answer:
      'Biblio uses Anthropic Claude reasoning with strict tool-use security boundaries. It quotes prices between your retail and floor limits, checks real-time inventory, and pauses autonomously whenever you are present and replying.',
  },
  {
    id: 'orders-payments',
    question: 'How do customer payments and settlement work?',
    answer:
      'Biblio generates Paystack payment links and Providus Bank dedicated virtual accounts (VAN). When a customer transfers funds, Paystack webhooks confirm receipt instantly and Biblio notifies both you and the customer.',
  },
  {
    id: 'delete-account',
    question: 'How do I request complete account & data deletion?',
    answer:
      'Under NDPA 2023 regulations and App Store guidelines, you can initiate immediate deletion in Settings → Account & Data Deletion, or email our Data Privacy Contact at oseghaleleonard39@gmail.com.',
  },
];

const SUPPORT_EMAIL = 'oseghaleleonard39@gmail.com';
const DATA_CONTROLLER = 'Yemuel Oseghale (individual, operating Biblio)';
const SUPPORT_PHONE_DISPLAY = '+234 800 000 0000';
const SUPPORT_PHONE_TEL = 'tel:+2348000000000';
const SUPPORT_WHATSAPP = 'https://wa.me/2348000000000';
const HELP_CENTER_URL = 'https://biblio.ai/help';
const STATUS_PAGE_URL = 'https://biblio.ai/status';
const APP_VERSION = '1.0.0';

function useIsSupportOpen() {
  return useMemo(() => {
    const now = new Date();
    const watHour = (now.getUTCHours() + 1) % 24;
    const day = now.getUTCDay();
    return day >= 1 && day <= 5 && watHour >= 9 && watHour < 17;
  }, []);
}

function SectionHeader({ label, c }: { label: string; c: C }) {
  return (
    <Text style={{ color: c.textTertiary }} className="text-xs font-bold uppercase tracking-wider mb-3 mt-2">
      {label}
    </Text>
  );
}

function ContactRow({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  last,
  c,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
  c: C;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ borderColor: c.border }}
      className={`p-4 flex-row items-center active:opacity-70 ${last ? '' : 'border-b'}`}
    >
      <View style={{ backgroundColor: iconBg }} className="w-10 h-10 rounded-2xl items-center justify-center mr-4">
        {icon}
      </View>
      <View className="flex-1">
        <Text style={{ color: c.textPrimary }} className="font-bold text-base mb-0.5">
          {title}
        </Text>
        <Text style={{ color: c.textSecondary }} className="text-xs">
          {subtitle}
        </Text>
      </View>
      <ExternalLink size={16} color={c.textTertiary} />
    </Pressable>
  );
}

function FAQItem({
  item,
  expanded,
  onToggle,
  c,
}: {
  item: (typeof FAQS)[number];
  expanded: boolean;
  onToggle: () => void;
  c: C;
}) {
  return (
    <Pressable onPress={onToggle} style={{ borderColor: c.border }} className="py-4 border-b">
      <View className="flex-row items-center justify-between">
        <Text style={{ color: c.textPrimary }} className="flex-1 text-sm font-bold pr-4">
          {item.question}
        </Text>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <ChevronDown size={18} color={c.textTertiary} />
        </View>
      </View>
      {expanded && (
        <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed mt-3 pr-4">
          {item.answer}
        </Text>
      )}
    </Pressable>
  );
}

export default function SupportScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const isOpen = useIsSupportOpen();
  const alert = useAlert();
  const merchantId = useAuthStore((state) => state.merchantId);
  const isAuthenticated = Boolean(merchantId);

  const submitTicket = useSubmitSupportTicket();

  const [query, setQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>('why-birthday');
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);

  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketEmail, setTicketEmail] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSent, setTicketSent] = useState(false);
  const [ticketSending, setTicketSending] = useState(false);

  const filteredFaqs = useMemo(() => {
    if (!query.trim()) return FAQS;
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  }, [query]);

  function toggleFaq(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq((prev) => (prev === id ? null : id));
  }

  async function handleSubmitTicket() {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      alert.warning('Required Fields', 'Please enter a subject and a message.');
      return;
    }

    if (!isAuthenticated && !ticketEmail.trim()) {
      alert.warning('Email Required', 'Please enter your email so we can reply to you.');
      return;
    }

    setTicketSending(true);
    try {
      if (isAuthenticated) {
        const res = await submitTicket.mutateAsync({
          subject: ticketSubject.trim(),
          message: ticketMessage.trim(),
          priority: 'normal',
        });
        setTicketSent(true);
        setTicketSubject('');
        setTicketMessage('');
        alert.success(
          'Inquiry Logged',
          `Reference: ${res?.reference || 'TKT-LIVE'}. Your ticket has been logged with store diagnostics.`
        );
      } else {
        // Direct unauthenticated email dispatch
        await Linking.openURL(
          `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
            `[Support Request] ${ticketSubject.trim()}`
          )}&body=${encodeURIComponent(
            `Sender: ${ticketEmail.trim()}\n\n${ticketMessage.trim()}`
          )}`
        );
        setTicketSent(true);
        setTicketSubject('');
        setTicketMessage('');
      }
    } catch (err: any) {
      alert.error('Submission Failed', err?.message || 'Could not submit inquiry.');
    } finally {
      setTicketSending(false);
    }
  }

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      {/* ── Unauthenticated / Authenticated Custom Header ── */}
      <View
        style={{
          backgroundColor: c.surface,
          borderBottomColor: c.border,
          borderBottomWidth: 1,
        }}
        className="px-6 pt-14 pb-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace(isAuthenticated ? '/' : '/login');
              }
            }}
            style={{ backgroundColor: c.surfaceAlt }}
            className="w-9 h-9 rounded-full items-center justify-center mr-3 active:opacity-70"
            hitSlop={10}
          >
            <ArrowLeft size={18} color={c.textPrimary} />
          </Pressable>
          <View>
            <Text style={{ color: c.textPrimary }} className="text-lg font-bold">
              Help & Support
            </Text>
            <Text style={{ color: c.textTertiary }} className="text-[11px]">
              {isAuthenticated ? 'Authenticated Store Portal' : 'Public Knowledge Base & Privacy'}
            </Text>
          </View>
        </View>

        {!isAuthenticated && (
          <Pressable
            onPress={() => router.replace('/login')}
            style={{ backgroundColor: c.accentSoft, borderColor: c.accent }}
            className="px-3 py-1 rounded-full border active:opacity-70"
          >
            <Text style={{ color: c.accent }} className="text-xs font-bold">
              Sign In
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1 pt-3 px-6"
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Section */}
        <View className="items-center justify-center py-5 mb-2">
          <View
            style={{ backgroundColor: c.accentSoft }}
            className="w-14 h-14 rounded-full items-center justify-center mb-3"
          >
            <HelpCircle size={28} color={c.accent} />
          </View>
          <Text style={{ color: c.textPrimary }} className="text-xl font-bold text-center">
            How can we assist you?
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-xs text-center mt-1 px-4 leading-relaxed">
            Get answers on merchant compliance, date of birth regulations, autonomous negotiations, and settlement.
          </Text>

          <View className="flex-row items-center mt-2.5">
            <View
              style={{ backgroundColor: isOpen ? '#22C55E' : c.textTertiary }}
              className="w-2 h-2 rounded-full mr-2"
            />
            <Text style={{ color: c.textSecondary }} className="text-[11px] font-medium">
              {isOpen ? 'Support online now (WAT)' : 'Live desk returns Mon–Fri, 9am–5pm WAT'}
            </Text>
          </View>
        </View>

        {/* ── Featured Regulatory Article: Why Birthday is Required (Matching Image 2) ── */}
        <Pressable
          onPress={() => setIsBirthdayModalOpen(true)}
          style={{ backgroundColor: isDark ? '#1F2925' : '#F1F5F9', borderColor: c.border }}
          className="p-5 rounded-3xl border mb-6 active:opacity-85"
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center space-x-1.5">
              <Calendar size={16} color={c.accent} />
              <Text style={{ color: c.accent }} className="text-xs font-bold uppercase tracking-wider ml-1">
                Official Compliance Guide
              </Text>
            </View>
            <View className="bg-emerald-500/15 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] font-bold text-emerald-500">NDPA 2023</Text>
            </View>
          </View>

          <Text style={{ color: c.textPrimary }} className="text-base font-bold mb-1.5">
            Why Biblio asks for your birthday for Merchant Accounts
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed mb-3">
            Learn why date of birth is collected for legal commercial contract capacity, Providus VAN settlement accounts, and minor debt protection.
          </Text>

          <View className="flex-row items-center">
            <Text style={{ color: '#3B82F6' }} className="text-xs font-bold mr-1">
              Read compliance breakdown →
            </Text>
          </View>
        </Pressable>

        {/* Search */}
        <View
          style={{ backgroundColor: c.surface, borderColor: c.border }}
          className="flex-row items-center px-4 rounded-2xl border mb-6"
        >
          <Search size={16} color={c.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search FAQs, compliance, setup..."
            placeholderTextColor={c.textTertiary}
            style={{ color: c.textPrimary }}
            className="flex-1 py-3 px-3 text-sm"
          />
        </View>

        {/* Direct Contacts */}
        <SectionHeader label="Direct Channels" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="rounded-3xl border mb-6">
          <ContactRow
            icon={<MessageCircle size={20} color="#22C55E" />}
            iconBg="#22C55E1A"
            title="WhatsApp Desk"
            subtitle="Autonomous copilot & team support"
            onPress={() => Linking.openURL(SUPPORT_WHATSAPP)}
            c={c}
          />
          <ContactRow
            icon={<Mail size={20} color={c.textPrimary} />}
            iconBg={c.surfaceAlt}
            title="Privacy & Support Email"
            subtitle={SUPPORT_EMAIL}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            c={c}
          />
          <ContactRow
            icon={<PhoneCall size={20} color={c.accent} />}
            iconBg={c.accentSoft}
            title="Telephone"
            subtitle={`${SUPPORT_PHONE_DISPLAY} · Mon-Fri, 9am - 5pm WAT`}
            onPress={() => Linking.openURL(SUPPORT_PHONE_TEL)}
            last
            c={c}
          />
        </View>

        {/* Frequently Asked */}
        <SectionHeader label="Frequently Asked Questions" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-5 rounded-3xl border mb-6">
          {filteredFaqs.length === 0 ? (
            <Text style={{ color: c.textSecondary }} className="text-xs py-6 text-center">
              No results for &ldquo;{query}&rdquo;
            </Text>
          ) : (
            filteredFaqs.map((item) => (
              <FAQItem
                key={item.id}
                item={item}
                expanded={expandedFaq === item.id}
                onToggle={() => toggleFaq(item.id)}
                c={c}
              />
            ))
          )}
        </View>

        {/* Submit Inquiry Section */}
        <SectionHeader
          label={isAuthenticated ? 'Submit Operator Support Ticket' : 'Send Support Request'}
          c={c}
        />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="p-5 rounded-3xl border mb-6">
          {ticketSent ? (
            <View className="items-center py-4">
              <CheckCircle2 size={32} color="#22C55E" />
              <Text style={{ color: c.textPrimary }} className="text-sm font-bold mt-3 mb-1">
                Inquiry Dispatched
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs text-center leading-relaxed">
                Our support desk has received your message. You will receive a response at your email promptly.
              </Text>
              <Pressable onPress={() => setTicketSent(false)} className="mt-4">
                <Text style={{ color: c.accent }} className="text-xs font-bold">
                  Send another inquiry
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {!isAuthenticated && (
                <View className="mb-3">
                  <Text style={{ color: c.textSecondary }} className="text-xs font-bold mb-1.5">
                    Your Contact Email
                  </Text>
                  <TextInput
                    value={ticketEmail}
                    onChangeText={setTicketEmail}
                    placeholder="e.g. merchant@gmail.com"
                    placeholderTextColor={c.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{ color: c.textPrimary, backgroundColor: c.surfaceAlt }}
                    className="rounded-2xl px-4 py-3 text-sm"
                  />
                </View>
              )}

              <Text style={{ color: c.textSecondary }} className="text-xs font-bold mb-1.5">
                Subject
              </Text>
              <TextInput
                value={ticketSubject}
                onChangeText={setTicketSubject}
                placeholder="e.g. Question on date of birth or WhatsApp pairing"
                placeholderTextColor={c.textTertiary}
                style={{ color: c.textPrimary, backgroundColor: c.surfaceAlt }}
                className="rounded-2xl px-4 py-3 text-sm mb-3"
              />

              <Text style={{ color: c.textSecondary }} className="text-xs font-bold mb-1.5">
                Message Details
              </Text>
              <TextInput
                value={ticketMessage}
                onChangeText={setTicketMessage}
                placeholder="Describe your inquiry..."
                placeholderTextColor={c.textTertiary}
                style={{ color: c.textPrimary, backgroundColor: c.surfaceAlt }}
                className="rounded-2xl px-4 py-3 text-sm mb-4"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Pressable
                onPress={handleSubmitTicket}
                disabled={ticketSending}
                style={{ backgroundColor: c.accent }}
                className="flex-row items-center justify-center py-3.5 rounded-2xl active:opacity-85"
              >
                {ticketSending ? (
                  <InlineLoadingDots color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={15} color="#FFFFFF" />
                    <Text className="text-white text-sm font-bold ml-2">
                      {isAuthenticated ? 'Submit Priority Ticket' : 'Send Inquiry Email'}
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>

        {/* Legal & Controller Footer */}
        <View style={{ borderTopWidth: 1, borderColor: c.border }} className="pt-4 items-center">
          <Text style={{ color: c.textTertiary }} className="text-[11px] font-bold text-center">
            Data Controller: {DATA_CONTROLLER}
          </Text>
          <Text style={{ color: c.textTertiary }} className="text-[10px] text-center mt-0.5">
            Privacy Contact: {SUPPORT_EMAIL} • Biblio Platform v{APP_VERSION}
          </Text>
        </View>
      </ScrollView>

      {/* ─── Detailed Birthday Policy Modal (Matching User Image 2) ─── */}
      <Modal
        visible={isBirthdayModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsBirthdayModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <View
            style={{ backgroundColor: c.surface, borderBottomColor: c.border }}
            className="px-6 py-4 border-b flex-row items-center justify-between"
          >
            <View>
              <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                Regulatory Compliance Policy
              </Text>
              <Text style={{ color: c.textTertiary }} className="text-[11px]">
                Nigeria Data Protection Act (NDPA 2023)
              </Text>
            </View>
            <Pressable
              onPress={() => setIsBirthdayModalOpen(false)}
              style={{ backgroundColor: c.surfaceAlt }}
              className="w-8 h-8 rounded-full items-center justify-center active:opacity-70"
            >
              <X size={16} color={c.textPrimary} />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-6 pt-5" contentContainerStyle={{ paddingBottom: 60 }}>
            <Text style={{ color: c.textPrimary }} className="text-2xl font-black tracking-tight mb-2">
              Why Biblio asks for your birthday for Merchant Accounts
            </Text>

            <View className="flex-row items-center space-x-2 mb-4">
              <View className="bg-emerald-500/15 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-emerald-500">
                  Verified Compliance Standard
                </Text>
              </View>
              <Text style={{ color: c.textTertiary }} className="text-xs">
                Updated recently · Legal Compliance
              </Text>
            </View>

            <View
              style={{ backgroundColor: isDark ? '#1F2925' : '#F1F5F9', borderColor: c.border }}
              className="p-4 rounded-2xl border mb-6"
            >
              <Text style={{ color: c.textPrimary }} className="text-xs leading-relaxed">
                We're updating Accounts Center under the{' '}
                <Text className="font-bold">Nigeria Data Protection Act (NDPA 2023)</Text> and{' '}
                <Text className="font-bold">Central Bank of Nigeria (CBN)</Text> Customer Due
                Diligence guidelines. This enables Providus Bank Virtual Account Number (VAN)
                generation, merchant escrow settlement, and automated commercial contract
                execution.
              </Text>
            </View>

            <Text style={{ color: c.textPrimary }} className="text-sm font-bold mb-3">
              Biblio asks for your birthday to:
            </Text>

            <View className="space-y-3 mb-6">
              <View className="flex-row items-start mb-3">
                <CheckCircle2 size={16} color={c.accent} style={{ marginTop: 2, marginRight: 10 }} />
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="text-xs font-bold mb-0.5">
                    Make sure automated features are appropriate for you
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-[11px] leading-relaxed">
                    Under Nigerian contract law, autonomous negotiation agents and settlement
                    escrow accounts require an adult (18+) account holder who can legally execute
                    commercial agreements.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start mb-3">
                <Shield size={16} color="#3B82F6" style={{ marginTop: 2, marginRight: 10 }} />
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="text-xs font-bold mb-0.5">
                    Offer safety & debt protection
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-[11px] leading-relaxed">
                    Protects minors from inadvertent commercial commitments, supplier debt
                    reorders, or unauthorized automated dispute liabilities.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start mb-3">
                <Calendar size={16} color="#F59E0B" style={{ marginTop: 2, marginRight: 10 }} />
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="text-xs font-bold mb-0.5">
                    Follow financial laws & regulations
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-[11px] leading-relaxed">
                    Paystack, Providus Bank, and Flutterwave require verified dates of birth before
                    activating merchant payouts and virtual settlement accounts.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start mb-3">
                <CheckCircle2 size={16} color="#10B981" style={{ marginTop: 2, marginRight: 10 }} />
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="text-xs font-bold mb-0.5">
                    Cross-verify CAC and business registration
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-[11px] leading-relaxed">
                    Allows seamless auto-verification of your RC / BN number and BVN records when
                    you link official business documents.
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={{ backgroundColor: c.accentSoft, borderColor: c.accent }}
              className="p-4 rounded-2xl border mb-6"
            >
              <Text style={{ color: c.textPrimary }} className="text-xs font-bold mb-1">
                🔒 Privacy Guarantee:
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
                Your birthday won't appear on your profile, public storefront, WhatsApp catalog, or
                customer receipts, even if your store is public.
              </Text>
            </View>

            <View style={{ borderTopWidth: 1, borderColor: c.border }} className="pt-4 mb-6">
              <Text style={{ color: c.textTertiary }} className="text-[10px] font-bold uppercase mb-1">
                Controller & Inquiries
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs">
                Data Controller: <Text className="font-bold text-white">{DATA_CONTROLLER}</Text>
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
                Privacy Email:{' '}
                <Text style={{ color: c.accent }} className="font-bold">
                  {SUPPORT_EMAIL}
                </Text>
              </Text>
            </View>

            <Pressable
              onPress={() => setIsBirthdayModalOpen(false)}
              style={{ backgroundColor: c.accent }}
              className="py-3.5 rounded-2xl items-center justify-center active:opacity-80"
            >
              <Text
                style={{ color: isDark ? '#090A0C' : '#FFFFFF' }}
                className="font-bold text-sm"
              >
                Close Article
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
