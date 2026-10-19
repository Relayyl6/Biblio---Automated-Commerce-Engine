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
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { useAlert } from '../src/store/alertStore';
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
} from 'lucide-react-native';
import { colors } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useSubmitSupportTicket } from '../src/api/client';

type C = typeof colors.light;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// [PLACEHOLDER] copy — swap for your real FAQ content. Kept generic on
// purpose rather than guessing at specific policies (refund windows,
// pricing, etc.) that aren't mine to invent.
const FAQS: { id: string; question: string; answer: string }[] = [
  {
    id: 'whatsapp',
    question: 'How do I connect my WhatsApp Business number?',
    answer:
      "Go to Settings → Channels → WhatsApp and follow the prompts to link your number. It usually takes under five minutes.",
  },
  {
    id: 'ai-drafts',
    question: 'How does the AI decide what to say to customers?',
    answer:
      'It drafts replies from your product catalogue, order history and the tone you set up. Anything it\'s unsure about is sent to your Inbox for approval before it goes out.',
  },
  {
    id: 'orders',
    question: 'Where do I see new orders?',
    answer: 'The Orders tab shows every order as it comes in, with payment status and delivery details.',
  },
  {
    id: 'billing',
    question: 'How do I update my billing details?',
    answer: 'Go to Settings → Billing to update your card or view past invoices.',
  },
  {
    id: 'delete-account',
    question: 'How do I close my account?',
    answer: "Email us at support@biblo.ai from your account's registered address and we'll process it within 48 hours.",
  },
];

// [PLACEHOLDER] — replace with the real numbers/links before launch.
const SUPPORT_EMAIL = 'support@biblo.ai';
const SUPPORT_PHONE_DISPLAY = '+234 800 000 0000';
const SUPPORT_PHONE_TEL = 'tel:+2348000000000';
const SUPPORT_WHATSAPP = 'https://wa.me/2348000000000';
const HELP_CENTER_URL = 'https://help.biblo.ai';
const STATUS_PAGE_URL = 'https://status.biblo.ai';
const APP_VERSION = '1.0.0'; // [PLACEHOLDER] — wire to app.json / expo-constants
const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/id0000000000', // [PLACEHOLDER]
  android: 'https://play.google.com/store/apps/details?id=com.biblo.app', // [PLACEHOLDER]
  default: 'https://biblo.ai',
});

// Support hours: Mon–Fri, 9am–5pm WAT (UTC+1). [SUGGESTED] — edit if hours differ.
function useIsSupportOpen() {
  return useMemo(() => {
    const now = new Date();
    const watHour = (now.getUTCHours() + 1) % 24;
    const day = now.getUTCDay(); // 0 = Sunday
    const isWeekday = day >= 1 && day <= 5;
    return isWeekday && watHour >= 9 && watHour < 17;
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

function FAQItem({ item, expanded, onToggle, c }: { item: (typeof FAQS)[number]; expanded: boolean; onToggle: () => void; c: C }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{ borderColor: c.border }}
      className="py-4 border-b"
    >
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
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const isOpen = useIsSupportOpen();
  const alert = useAlert();
  const submitTicket = useSubmitSupportTicket();

  const [query, setQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const [ticketSubject, setTicketSubject] = useState('');
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
      alert.warning('Almost there', 'Please add a subject and a short message so our team can help you promptly.');
      return;
    }
    setTicketSending(true);
    try {
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
        `Reference: ${res?.reference || 'TKT-QUEUED'}. Your ticket has been logged with Biblo priority support.`
      );
    } catch (err: any) {
      alert.error('Submission Failed', err?.response?.data?.error || err.message || 'Could not submit support ticket.');
    } finally {
      setTicketSending(false);
    }
  }

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader title="Help & Support" variant="bar" />

      <ScrollView className="flex-1 pt-3 px-6" contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View className="items-center justify-center py-6 mb-4">
          <View style={{ backgroundColor: c.accentSoft }} className="w-16 h-16 rounded-full items-center justify-center mb-4">
            <HelpCircle size={32} color={c.accent} />
          </View>
          <Text style={{ color: c.textPrimary }} className="text-xl font-bold text-center">
            How can we help?
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-sm text-center mt-2 px-4 leading-relaxed">
            Whether you need help configuring your AI agent or have billing questions, our team is here for you.
          </Text>

          <View className="flex-row items-center mt-3">
            <View
              style={{ backgroundColor: isOpen ? '#22C55E' : c.textTertiary }}
              className="w-2 h-2 rounded-full mr-2"
            />
            <Text style={{ color: c.textSecondary }} className="text-xs">
              {isOpen ? 'We’re online now' : 'Back online Mon–Fri, 9am–5pm WAT'}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View
          style={{ backgroundColor: c.surface, borderColor: c.border }}
          className="flex-row items-center px-4 rounded-2xl border mb-8"
        >
          <Search size={16} color={c.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search for help..."
            placeholderTextColor={c.textTertiary}
            style={{ color: c.textPrimary }}
            className="flex-1 py-3 px-3 text-sm"
          />
        </View>

        <SectionHeader label="Contact Us" c={c} />

        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="rounded-3xl border mb-8">
          <ContactRow
            icon={<MessageCircle size={20} color="#22C55E" />}
            iconBg="#22C55E1A"
            title="Chat on WhatsApp"
            subtitle="Usually replies within the hour"
            onPress={() => Linking.openURL(SUPPORT_WHATSAPP)}
            c={c}
          />
          <ContactRow
            icon={<Mail size={20} color={c.textPrimary} />}
            iconBg={c.surfaceAlt}
            title="Email Support"
            subtitle={SUPPORT_EMAIL}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            c={c}
          />
          <ContactRow
            icon={<PhoneCall size={20} color={c.accent} />}
            iconBg={c.accentSoft}
            title="Call Us"
            subtitle={`${SUPPORT_PHONE_DISPLAY} · Mon-Fri, 9am - 5pm WAT`}
            onPress={() => Linking.openURL(SUPPORT_PHONE_TEL)}
            last
            c={c}
          />
        </View>

        <SectionHeader label="Frequently Asked" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-5 rounded-3xl border mb-8">
          {filteredFaqs.length === 0 ? (
            <Text style={{ color: c.textSecondary }} className="text-sm py-6 text-center">
              No results for &ldquo;{query}&rdquo; — try a different search or message us below.
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

        <SectionHeader label="Resources" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="rounded-3xl border mb-8">
          <ContactRow
            icon={<Globe size={20} color={c.textPrimary} />}
            iconBg={c.surfaceAlt}
            title="Help Center"
            subtitle="Read guides and tutorials"
            onPress={() => Linking.openURL(HELP_CENTER_URL)}
            c={c}
          />
          <ContactRow
            icon={<Activity size={20} color="#22C55E" />}
            iconBg="#22C55E1A"
            title="System Status"
            subtitle="Check for ongoing incidents"
            onPress={() => Linking.openURL(STATUS_PAGE_URL)}
            c={c}
          />
          <ContactRow
            icon={<Star size={20} color="#F59E0B" />}
            iconBg="#F59E0B1A"
            title="Rate Biblo"
            subtitle="Enjoying the app? Leave us a review"
            onPress={() => Linking.openURL(STORE_URL!)}
            last
            c={c}
          />
        </View>

        <SectionHeader label="Still Stuck? Send Us a Message" c={c} />
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="p-5 rounded-3xl border mb-8">
          {ticketSent ? (
            <View className="items-center py-4">
              <CheckCircle2 size={28} color="#22C55E" />
              <Text style={{ color: c.textPrimary }} className="text-sm font-bold mt-3 mb-1">
                Message sent
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs text-center">
                We&apos;ll get back to you at your account email, usually within a day.
              </Text>
              <Pressable onPress={() => setTicketSent(false)} className="mt-4">
                <Text style={{ color: c.accent }} className="text-xs font-bold">
                  Send another message
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={{ color: c.textSecondary }} className="text-xs font-bold mb-1.5">
                Subject
              </Text>
              <TextInput
                value={ticketSubject}
                onChangeText={setTicketSubject}
                placeholder="e.g. Can't connect WhatsApp"
                placeholderTextColor={c.textTertiary}
                style={{ color: c.textPrimary, backgroundColor: c.surfaceAlt }}
                className="rounded-2xl px-4 py-3 text-sm mb-4"
              />
              <Text style={{ color: c.textSecondary }} className="text-xs font-bold mb-1.5">
                Message
              </Text>
              <TextInput
                value={ticketMessage}
                onChangeText={setTicketMessage}
                placeholder="Tell us what's going on..."
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
                style={{ backgroundColor: c.accent, opacity: ticketSending ? 0.6 : 1 }}
                className="flex-row items-center justify-center py-3.5 rounded-2xl"
              >
                <Send size={16} color="#FFFFFF" />
                <Text className="text-white text-sm font-bold ml-2">
                  {ticketSending ? 'Sending…' : 'Send Message'}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={{ color: c.textTertiary }} className="text-xs text-center">
          Biblo v{APP_VERSION}
        </Text>
      </ScrollView>
    </View>
  );
}
