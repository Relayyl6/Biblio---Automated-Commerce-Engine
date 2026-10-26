import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Send,
  Sparkles,
  Bot,
  User,
  MessageSquare,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
  Building2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Mic,
  MicOff,
  Paperclip,
  X,
  Image as ImageIcon,
  Phone,
  Clock,
  ArrowUpRight,
  Tag,
  Package,
  Wallet,
  Share2,
  Copy,
  FileText,
  Layers,
  HelpCircle,
  RefreshCw,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../theme';
import {
  useAgentMessages,
  useSendAgentMessage,
  useMerchantConfig,
  type AgentMessage,
} from '../src/api/client';
import { SearchSkeleton, InlineLoadingDots } from '../src/components/PulsingSkeleton';
import * as Haptics from 'expo-haptics';

type ChannelFilter = 'all' | 'whatsapp' | 'in_app';
type CategoryTray = 'products' | 'finance' | 'sales' | 'profile';

interface ParsedProductCard {
  title: string;
  sku: string;
  price: string;
  floor?: string;
  stock?: string;
  category?: string;
  colors?: string;
  vectorIndexed?: boolean;
}

export default function BiblioAssistantScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const { data: messages = [], isLoading, refetch } = useAgentMessages();
  const { data: merchantConfig } = useMerchantConfig();
  const sendMessageMutation = useSendAgentMessage();

  const [inputText, setInputText] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<ChannelFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryTray>('products');
  const [isIdentityExpanded, setIsIdentityExpanded] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Voice recording timer simulation
  useEffect(() => {
    let timer: any = null;
    if (isRecordingVoice) {
      setRecordingSeconds(0);
      timer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecordingVoice]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Filter messages based on channel tab
  const filteredMessages = useMemo(() => {
    if (selectedChannel === 'all') return messages;
    return messages.filter((m) => m.channel === selectedChannel);
  }, [messages, selectedChannel]);

  // Counts for tabs
  const whatsappCount = useMemo(
    () => messages.filter((m) => m.channel === 'whatsapp').length,
    [messages]
  );
  const inAppCount = useMemo(
    () => messages.filter((m) => m.channel === 'in_app').length,
    [messages]
  );

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if ((!text && !attachedImage) || sendMessageMutation.isPending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');
    const imageUrlToSend = attachedImage || undefined;
    setAttachedImage(null);

    await sendMessageMutation.mutateAsync({
      text: text || 'Analyze this product image and catalog it.',
      imageUrl: imageUrlToSend,
    });
  };

  const handleToggleVoice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isRecordingVoice) {
      setIsRecordingVoice(true);
    } else {
      setIsRecordingVoice(false);
      // Simulate transcribing voice note
      const transcribed =
        'Vendor voice note: Add 3 pairs of white Chelsea boots for 35,000 naira floor 30,000 in stock';
      setInputText(transcribed);
    }
  };

  const handleAttachImage = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAttachedImage(url);
    setIsMediaModalOpen(false);
  };

  // Helper to parse product catalog message
  const parseProductCard = (content: string): ParsedProductCard | null => {
    if (!content.includes('Extracted & Cataloged') && !content.includes('• Product:')) {
      return null;
    }
    const titleMatch = content.match(/• Product:\s*([^\n(]+)/);
    const skuMatch = content.match(/SKU:\s*([^)\n]+)/);
    const priceMatch = content.match(/• Price:\s*([^\n(]+)/);
    const floorMatch = content.match(/Floor:\s*([^)\n]+)/);
    const stockMatch = content.match(/• Stock:\s*([^\n]+)/);
    const categoryMatch = content.match(/• Category:\s*([^\n]+)/);
    const colorsMatch = content.match(/• Colors:\s*([^\n]+)/);
    const vectorIndexed = content.includes('CLIP Indexed');

    if (!titleMatch && !priceMatch) return null;

    return {
      title: titleMatch ? titleMatch[1].trim() : 'Catalog Product',
      sku: skuMatch ? skuMatch[1].trim() : 'SKU-AUTO',
      price: priceMatch ? priceMatch[1].trim() : '₦0',
      floor: floorMatch ? floorMatch[1].trim() : undefined,
      stock: stockMatch ? stockMatch[1].trim() : '1',
      category: categoryMatch ? categoryMatch[1].trim() : undefined,
      colors: colorsMatch ? colorsMatch[1].trim() : undefined,
      vectorIndexed,
    };
  };

  // Detect finance receipt
  const isFinanceReceipt = (content: string) => {
    return (
      content.includes('Zero-Deduction') ||
      content.includes('Payout') ||
      content.includes('VAN') ||
      content.includes('Bank Details') ||
      content.includes('Settlement Route')
    );
  };

  // Detect profile update receipt
  const isProfileReceipt = (content: string) => {
    return (
      content.includes('Business Profile') ||
      content.includes('CAC Registration') ||
      content.includes('RC Number') ||
      content.includes('Onboarding')
    );
  };

  // Quick Action Categories & Prompts
  const categoryPrompts: Record<
    CategoryTray,
    { label: string; icon: any; prompts: string[] }
  > = {
    products: {
      label: 'Products & Catalog',
      icon: <Package size={14} color={selectedCategory === 'products' ? '#FFFFFF' : c.textSecondary} />,
      prompts: [
        'Add: Blue Ankara with white shine shine 45k 3 yards',
        'Search catalog semantically for shiny blue lace',
        'Predict stockouts for this week',
        'Show active catalog SKUs with margins',
      ],
    },
    finance: {
      label: 'Finance & VAN',
      icon: <Wallet size={14} color={selectedCategory === 'finance' ? '#FFFFFF' : c.textSecondary} />,
      prompts: [
        'Explain the Zero-Deduction Fee Padding model',
        "What is my net revenue and payout balance today?",
        'Set my payout schedule to instant',
        'Show my Providus VAN settlement account',
      ],
    },
    sales: {
      label: 'WhatsApp Sales',
      icon: <Zap size={14} color={selectedCategory === 'sales' ? '#FFFFFF' : c.textSecondary} />,
      prompts: [
        'Generate engaging WhatsApp Status copy for new arrivals',
        'Check today customer conversion rate and active leads',
        'Show recent customer inquiries on WhatsApp',
        'Draft a special VIP discount announcement',
      ],
    },
    profile: {
      label: 'Business Profile',
      icon: <Building2 size={14} color={selectedCategory === 'profile' ? '#FFFFFF' : c.textSecondary} />,
      prompts: [
        'Set profile: Jane, Jane Textiles, RC-883921, Access Bank',
        'Update my operating hours to 8:00 AM - 6:00 PM',
        'Teach me how to use Biblio via interactive session',
        'Verify my CAC RC number and business structure',
      ],
    },
  };

  const currentConfig = merchantConfig || {};
  const ownerName = currentConfig.owner_first_name || 'Vendor';
  const businessName = currentConfig.name || currentConfig.business_name || 'My Store';
  const isRegistered = currentConfig.is_registered || false;
  const rcNumber = currentConfig.rc_number;
  const payoutFreq = currentConfig.payout_frequency || 'instant';
  const feeModel = currentConfig.fee_padding_model || 'customer_padded';
  const bankDetails = currentConfig.bank_details || {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* ─── Top Header Bar ─── */}
      <View
        style={{
          borderBottomColor: c.border,
          borderBottomWidth: 1,
          backgroundColor: isDark ? 'rgba(20, 26, 24, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        }}
        className="px-4 py-3"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              className="p-1 -ml-2 rounded-full active:opacity-70"
            >
              <ArrowLeft size={20} color={c.textPrimary} />
            </Pressable>

            <View className="flex-row items-center gap-1.5">
              <View
                style={{ backgroundColor: c.accent }}
                className="w-10 h-10 rounded-full items-center justify-center shadow-sm relative"
              >
                <Bot size={22} color="#FFFFFF" />
                <View className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-black" />
              </View>

              <View>
                <View className="flex-row items-center gap-1.5">
                  <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                    Biblio Copilot
                  </Text>
                  <View className="bg-emerald-500/15 px-2 py-0.5 rounded-full flex-row items-center">
                    <Text className="text-[10px] font-bold text-emerald-500">Live Agent</Text>
                  </View>
                </View>
                <Text style={{ color: c.textTertiary }} className="text-[11px]">
                  {businessName} • {ownerName}
                </Text>
              </View>
            </View>
          </View>

          {/* Toggle Identity Drawer */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsIdentityExpanded(!isIdentityExpanded);
            }}
            style={{
              backgroundColor: isIdentityExpanded
                ? c.accentSoft
                : isDark
                ? '#1F2925'
                : '#F1F5F9',
              borderColor: isIdentityExpanded ? c.accent : c.border,
            }}
            className="flex-row items-center px-2.5 py-1.5 rounded-full border gap-1"
          >
            <Building2 size={13} color={isIdentityExpanded ? c.accent : c.textSecondary} />
            <Text
              style={{ color: isIdentityExpanded ? c.accent : c.textSecondary }}
              className="text-[11px] font-semibold"
            >
              Profile
            </Text>
            {isIdentityExpanded ? (
              <ChevronUp size={13} color={isIdentityExpanded ? c.accent : c.textSecondary} />
            ) : (
              <ChevronDown size={13} color={isIdentityExpanded ? c.accent : c.textSecondary} />
            )}
          </Pressable>
        </View>

        {/* ─── Expandable Business Identity Drawer ─── */}
        {isIdentityExpanded && (
          <View
            style={{
              backgroundColor: isDark ? '#161D1A' : '#F8FAFC',
              borderColor: c.border,
            }}
            className="mt-3 p-3.5 rounded-2xl border gap-3"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                  {businessName}
                </Text>
                {isRegistered ? (
                  <View className="bg-emerald-500/15 px-2 py-0.5 rounded-full flex-row items-center gap-1">
                    <ShieldCheck size={11} color={c.accent} />
                    <Text className="text-[10px] font-bold text-emerald-500">
                      CAC {rcNumber ? `RC-${rcNumber}` : 'Verified'}
                    </Text>
                  </View>
                ) : (
                  <View className="bg-amber-500/15 px-2 py-0.5 rounded-full flex-row items-center gap-1">
                    <AlertCircle size={11} color="#D97706" />
                    <Text className="text-[10px] font-bold text-amber-600">
                      Sole Proprietorship
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ color: c.textTertiary }} className="text-[10px] font-mono">
                ID: {merchantConfig?.id ? merchantConfig.id.slice(0, 8) : 'ACTIVE'}
              </Text>
            </View>

            {/* Payout & VAN Route */}
            <View
              style={{ backgroundColor: isDark ? '#1F2925' : '#FFFFFF', borderColor: c.border }}
              className="p-2.5 rounded-xl border flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-2.5">
                <CreditCard size={18} color={c.accent} />
                <View>
                  <Text style={{ color: c.textPrimary }} className="text-xs font-semibold">
                    {bankDetails.bankName || 'Providus Bank VAN'}
                  </Text>
                  <Text style={{ color: c.textTertiary }} className="text-[10px]">
                    {bankDetails.accountNumber
                      ? `•••• ${bankDetails.accountNumber.slice(-4)}`
                      : 'Zero-Deduction VAN Active'}
                    {bankDetails.accountName ? ` • ${bankDetails.accountName}` : ''}
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <View className="bg-emerald-500/15 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-emerald-500 capitalize">
                    {payoutFreq}
                  </Text>
                </View>
                <Text style={{ color: c.textTertiary }} className="text-[9px] mt-0.5">
                  Settlement
                </Text>
              </View>
            </View>

            {/* Fee Padding Guarantee Notice */}
            <View className="flex-row items-center gap-2">
              <Zap size={14} color="#D97706" />
              <Text style={{ color: c.textSecondary }} className="text-[11px] flex-1">
                {feeModel === 'customer_padded'
                  ? 'Zero-Deduction Guarantee: VAN + 3% Biblio fees are padded on the customer checkout price. You receive 100% of your listing price.'
                  : 'Vendor-Absorbed Model: Platform and gateway fees deducted directly from settlement.'}
              </Text>
            </View>

            {/* Quick Profile Prompt Shortcuts */}
            <View className="flex-row flex-wrap gap-1.5 pt-1">
              <Pressable
                onPress={() => handleSend('Switch my payout frequency to instant')}
                className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 active:opacity-70"
              >
                <Text style={{ color: c.accent }} className="text-[11px] font-medium">
                  ⚡ Set Instant Payout
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSend('Show my current bank payout details and fee model')}
                className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 active:opacity-70"
              >
                <Text style={{ color: c.accent }} className="text-[11px] font-medium">
                  💳 View Payout Route
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSend('How do I verify my CAC registration number?')}
                className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 active:opacity-70"
              >
                <Text style={{ color: c.accent }} className="text-[11px] font-medium">
                  🏛️ CAC Status
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* ─── Multi-Channel Parity Switcher & Filter Pills ─── */}
      <View
        style={{
          borderBottomColor: c.border,
          borderBottomWidth: 1,
          backgroundColor: isDark ? '#111715' : '#FFFFFF',
        }}
        className="px-4 py-2 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-2">
          {/* Tab: All */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedChannel('all');
            }}
            style={{
              backgroundColor:
                selectedChannel === 'all'
                  ? c.accent
                  : isDark
                  ? '#1A2320'
                  : '#F1F5F9',
            }}
            className="px-3 py-1.5 rounded-full flex-row items-center gap-1.5"
          >
            <Layers
              size={12}
              color={selectedChannel === 'all' ? '#FFFFFF' : c.textSecondary}
            />
            <Text
              style={{
                color: selectedChannel === 'all' ? '#FFFFFF' : c.textSecondary,
              }}
              className="text-xs font-bold"
            >
              All Sync ({messages.length})
            </Text>
          </Pressable>

          {/* Tab: WhatsApp */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedChannel('whatsapp');
            }}
            style={{
              backgroundColor:
                selectedChannel === 'whatsapp'
                  ? '#25D366'
                  : isDark
                  ? '#1A2320'
                  : '#F1F5F9',
            }}
            className="px-3 py-1.5 rounded-full flex-row items-center gap-1.5"
          >
            <MessageSquare
              size={12}
              color={selectedChannel === 'whatsapp' ? '#FFFFFF' : c.textSecondary}
            />
            <Text
              style={{
                color: selectedChannel === 'whatsapp' ? '#FFFFFF' : c.textSecondary,
              }}
              className="text-xs font-bold"
            >
              WhatsApp ({whatsappCount})
            </Text>
          </Pressable>

          {/* Tab: In-App */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedChannel('in_app');
            }}
            style={{
              backgroundColor:
                selectedChannel === 'in_app'
                  ? c.accent
                  : isDark
                  ? '#1A2320'
                  : '#F1F5F9',
            }}
            className="px-3 py-1.5 rounded-full flex-row items-center gap-1.5"
          >
            <Bot
              size={12}
              color={selectedChannel === 'in_app' ? '#FFFFFF' : c.textSecondary}
            />
            <Text
              style={{
                color: selectedChannel === 'in_app' ? '#FFFFFF' : c.textSecondary,
              }}
              className="text-xs font-bold"
            >
              In-App ({inAppCount})
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            refetch();
          }}
          className="p-1.5 rounded-full active:opacity-70"
        >
          <RefreshCw size={14} color={c.textTertiary} />
        </Pressable>
      </View>

      {/* ─── Categorized Quick-Action Tray Selector ─── */}
      <View
        style={{
          borderBottomColor: c.border,
          borderBottomWidth: 1,
          backgroundColor: isDark ? '#141A18' : '#F8FAFC',
        }}
        className="pt-2 pb-1.5"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          className="flex-row gap-2"
        >
          {(['products', 'finance', 'sales', 'profile'] as CategoryTray[]).map((cat) => {
            const isCatActive = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedCategory(cat);
                }}
                style={{
                  backgroundColor: isCatActive
                    ? c.accent
                    : isDark
                    ? '#1E2724'
                    : '#FFFFFF',
                  borderColor: isCatActive ? c.accent : c.border,
                }}
                className="px-3 py-1.5 rounded-full border flex-row items-center gap-1.5 active:opacity-80"
              >
                {categoryPrompts[cat].icon}
                <Text
                  style={{
                    color: isCatActive ? '#FFFFFF' : c.textPrimary,
                  }}
                  className="text-xs font-semibold"
                >
                  {categoryPrompts[cat].label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Prompt Chips under selected category */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}
          className="flex-row gap-2"
        >
          {categoryPrompts[selectedCategory].prompts.map((promptText, idx) => (
            <Pressable
              key={idx}
              onPress={() => handleSend(promptText)}
              style={{
                backgroundColor: isDark ? '#1F2925' : '#FFFFFF',
                borderColor: c.border,
              }}
              className="px-3 py-1.5 rounded-xl border flex-row items-center gap-1.5 active:opacity-70 shadow-sm"
            >
              <Zap size={11} color={c.accent} />
              <Text
                style={{ color: c.textPrimary }}
                className="text-xs font-medium"
                numberOfLines={1}
              >
                {promptText}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ─── Messages FlatList ─── */}
      {isLoading && filteredMessages.length === 0 ? (
        <View className="flex-1 px-4 pt-4">
          <SearchSkeleton count={6} />
        </View>
      ) : filteredMessages.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <View
            style={{ backgroundColor: c.accentSoft }}
            className="w-16 h-16 rounded-full items-center justify-center mb-3"
          >
            <Sparkles size={28} color={c.accent} />
          </View>
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold text-center mb-1">
            Welcome to Biblio, {ownerName}!
          </Text>
          <Text style={{ color: c.textTertiary }} className="text-xs text-center max-w-xs mb-6">
            Your AI copilot is live across WhatsApp and in-app. Catalog items, inspect 100%
            Zero-Deduction payouts, or draft WhatsApp Status posts in natural language.
          </Text>

          <View className="w-full gap-2">
            {categoryPrompts[selectedCategory].prompts.map((prompt, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleSend(prompt)}
                style={{
                  backgroundColor: isDark ? '#1A2320' : '#FFFFFF',
                  borderColor: c.border,
                }}
                className="p-3 rounded-xl border active:opacity-70 flex-row items-center justify-between shadow-sm"
              >
                <Text style={{ color: c.textPrimary }} className="text-xs font-medium flex-1">
                  "{prompt}"
                </Text>
                <Zap size={14} color={c.accent} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const isAgent = item.sender_role === 'agent' || item.sender_role === 'system';
            const productCard = isAgent ? parseProductCard(item.content) : null;
            const financeCard = isAgent && !productCard ? isFinanceReceipt(item.content) : false;
            const profileCard = isAgent && !productCard && !financeCard ? isProfileReceipt(item.content) : false;

            return (
              <View
                className={`mb-4 flex-row ${isAgent ? 'justify-start' : 'justify-end'}`}
              >
                {/* Agent Avatar */}
                {isAgent && (
                  <View
                    style={{ backgroundColor: c.accent }}
                    className="w-8 h-8 rounded-full items-center justify-center mr-2 self-start mt-1 shadow-sm"
                  >
                    <Bot size={16} color="#FFFFFF" />
                  </View>
                )}

                {/* Message Bubble Container */}
                <View style={{ maxWidth: '84%' }}>
                  {/* Standard Message Bubble or Rich Card */}
                  <View
                    style={{
                      backgroundColor: isAgent
                        ? isDark
                          ? '#1A2320'
                          : '#FFFFFF'
                        : c.accent,
                      borderColor: isAgent ? c.border : 'transparent',
                      borderWidth: isAgent ? 1 : 0,
                      borderRadius: 18,
                      borderBottomLeftRadius: isAgent ? 4 : 18,
                      borderBottomRightRadius: isAgent ? 18 : 4,
                    }}
                    className="p-3.5 shadow-sm"
                  >
                    {/* Rich Product Card */}
                    {productCard ? (
                      <View className="gap-2.5">
                        <View className="flex-row items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                          <View className="flex-row items-center gap-1.5">
                            <Package size={15} color={c.accent} />
                            <Text style={{ color: c.accent }} className="text-xs font-bold">
                              Catalog Enriched
                            </Text>
                          </View>
                          <View className="bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
                            <Text
                              style={{ color: c.textTertiary }}
                              className="text-[10px] font-mono font-bold"
                            >
                              {productCard.sku}
                            </Text>
                          </View>
                        </View>

                        <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                          {productCard.title}
                        </Text>

                        <View className="flex-row items-center gap-2">
                          <View className="bg-emerald-500/15 px-2.5 py-1 rounded-lg">
                            <Text className="text-xs font-bold text-emerald-500">
                              {productCard.price}
                            </Text>
                          </View>
                          {productCard.floor && (
                            <View className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg">
                              <Text style={{ color: c.textTertiary }} className="text-[10px]">
                                Floor: {productCard.floor}
                              </Text>
                            </View>
                          )}
                          <View className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg">
                            <Text style={{ color: c.textSecondary }} className="text-[10px]">
                              Stock: {productCard.stock}
                            </Text>
                          </View>
                        </View>

                        {productCard.category && (
                          <Text style={{ color: c.textTertiary }} className="text-[11px]">
                            📂 {productCard.category}
                          </Text>
                        )}

                        {productCard.vectorIndexed && (
                          <View className="flex-row items-center gap-1">
                            <Sparkles size={11} color={c.accent} />
                            <Text className="text-[10px] font-bold text-emerald-500">
                              Indexed in 512-dim Vector Search Engine
                            </Text>
                          </View>
                        )}

                        {/* Interactive Card Action Buttons */}
                        <View className="flex-row items-center gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                          <Pressable
                            onPress={() =>
                              handleSend(
                                `Draft WhatsApp status copy for product ${productCard.sku}`
                              )
                            }
                            className="flex-1 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 items-center flex-row justify-center gap-1"
                          >
                            <Share2 size={12} color={c.accent} />
                            <Text style={{ color: c.accent }} className="text-[11px] font-bold">
                              Status Post
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              handleSend(`Search catalog for items like ${productCard.title}`)
                            }
                            className="flex-1 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 items-center flex-row justify-center gap-1"
                          >
                            <Sparkles size={12} color={c.textSecondary} />
                            <Text style={{ color: c.textSecondary }} className="text-[11px] font-semibold">
                              Similar Items
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : financeCard ? (
                      /* Rich Finance & VAN Settlement Card */
                      <View className="gap-2">
                        <View className="flex-row items-center gap-1.5 border-b border-black/5 dark:border-white/5 pb-1.5">
                          <Wallet size={15} color="#D97706" />
                          <Text style={{ color: '#D97706' }} className="text-xs font-bold">
                            Zero-Deduction Settlement Guarantee
                          </Text>
                        </View>
                        <Text
                          style={{ color: c.textPrimary, fontSize: 13, lineHeight: 19 }}
                        >
                          {item.content}
                        </Text>
                        <View className="bg-amber-500/10 p-2 rounded-xl flex-row items-center gap-1.5">
                          <ShieldCheck size={14} color="#D97706" />
                          <Text className="text-[10px] text-amber-700 dark:text-amber-300 font-medium flex-1">
                            Providus VAN auto-settles instant payouts without eating merchant margins.
                          </Text>
                        </View>
                      </View>
                    ) : profileCard ? (
                      /* Rich Profile / CAC Card */
                      <View className="gap-2">
                        <View className="flex-row items-center gap-1.5 border-b border-black/5 dark:border-white/5 pb-1.5">
                          <Building2 size={15} color={c.accent} />
                          <Text style={{ color: c.accent }} className="text-xs font-bold">
                            Business Profile Verified
                          </Text>
                        </View>
                        <Text
                          style={{ color: c.textPrimary, fontSize: 13, lineHeight: 19 }}
                        >
                          {item.content}
                        </Text>
                      </View>
                    ) : (
                      /* Plain text message */
                      <Text
                        style={{
                          color: isAgent ? c.textPrimary : '#FFFFFF',
                          fontSize: 14,
                          lineHeight: 20,
                        }}
                      >
                        {item.content}
                      </Text>
                    )}

                    {/* Channel & Timestamp Subtitle */}
                    <View className="flex-row items-center justify-between mt-2 pt-1.5 border-t border-black/5 dark:border-white/5">
                      <View className="flex-row items-center gap-1">
                        {item.channel === 'whatsapp' ? (
                          <MessageSquare
                            size={10}
                            color={isAgent ? c.textTertiary : 'rgba(255,255,255,0.7)'}
                          />
                        ) : (
                          <Bot
                            size={10}
                            color={isAgent ? c.textTertiary : 'rgba(255,255,255,0.7)'}
                          />
                        )}
                        <Text
                          style={{
                            color: isAgent ? c.textTertiary : 'rgba(255,255,255,0.7)',
                          }}
                          className="text-[9px]"
                        >
                          {item.channel === 'whatsapp' ? 'via WhatsApp' : 'In-App'}
                        </Text>
                      </View>

                      <Text
                        style={{
                          color: isAgent ? c.textTertiary : 'rgba(255,255,255,0.7)',
                        }}
                        className="text-[9px]"
                      >
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* User Avatar */}
                {!isAgent && (
                  <View
                    style={{ backgroundColor: isDark ? '#2D3A34' : '#E2E8F0' }}
                    className="w-8 h-8 rounded-full items-center justify-center ml-2 self-start mt-1 shadow-sm"
                  >
                    <User size={16} color={c.textPrimary} />
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ─── Typing / Reasoning Indicator ─── */}
      {sendMessageMutation.isPending && (
        <View className="flex-row items-center px-4 py-2 gap-2">
          <View
            style={{ backgroundColor: c.accent }}
            className="w-6 h-6 rounded-full items-center justify-center"
          >
            <Bot size={13} color="#FFFFFF" />
          </View>
          <View
            style={{ backgroundColor: isDark ? '#1F2925' : '#E2E8F0' }}
            className="px-3 py-1.5 rounded-full flex-row items-center gap-1.5"
          >
            <InlineLoadingDots color={c.accent} />
            <Text style={{ color: c.textSecondary }} className="text-xs">
              Biblio reasoning & executing tools...
            </Text>
          </View>
        </View>
      )}

      {/* ─── Active Voice Recording Waveform Banner ─── */}
      {isRecordingVoice && (
        <View
          style={{
            backgroundColor: isDark ? '#2D1B1B' : '#FEF2F2',
            borderColor: '#EF4444',
          }}
          className="mx-4 mb-2 p-3 rounded-2xl border flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-2.5">
            <View className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <Text className="text-xs font-bold text-red-600">
              Recording Voice Note: 00:0{recordingSeconds}s
            </Text>
          </View>
          <Pressable
            onPress={handleToggleVoice}
            className="bg-red-500 px-3 py-1.5 rounded-full"
          >
            <Text className="text-xs font-bold text-white">Transcribe</Text>
          </Pressable>
        </View>
      )}

      {/* ─── Attached Image Preview Thumbnail ─── */}
      {attachedImage && (
        <View
          style={{ backgroundColor: isDark ? '#1F2925' : '#F1F5F9', borderColor: c.border }}
          className="mx-4 mb-2 p-2 rounded-xl border flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-2">
            <ImageIcon size={16} color={c.accent} />
            <Text style={{ color: c.textPrimary }} className="text-xs font-medium" numberOfLines={1}>
              Image attached for extraction
            </Text>
          </View>
          <Pressable onPress={() => setAttachedImage(null)} className="p-1">
            <X size={16} color={c.textTertiary} />
          </Pressable>
        </View>
      )}

      {/* ─── Message Input & Controls Bar ─── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View
          style={{
            borderTopColor: c.border,
            borderTopWidth: 1,
            backgroundColor: isDark ? '#141A18' : '#FFFFFF',
          }}
          className="p-3 flex-row items-center gap-2"
        >
          {/* Attachment (+) Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsMediaModalOpen(true);
            }}
            style={{ backgroundColor: isDark ? '#1F2925' : '#F1F5F9' }}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
          >
            <Paperclip size={18} color={c.textSecondary} />
          </Pressable>

          {/* Voice Mic Button */}
          <Pressable
            onPress={handleToggleVoice}
            style={{
              backgroundColor: isRecordingVoice
                ? '#EF4444'
                : isDark
                ? '#1F2925'
                : '#F1F5F9',
            }}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
          >
            {isRecordingVoice ? (
              <MicOff size={18} color="#FFFFFF" />
            ) : (
              <Mic size={18} color={c.textSecondary} />
            )}
          </Pressable>

          {/* Text Input */}
          <TextInput
            style={{
              backgroundColor: isDark ? '#1F2925' : '#F8FAFC',
              color: c.textPrimary,
              borderColor: c.border,
            }}
            className="flex-1 py-2.5 px-4 rounded-3xl border text-sm max-h-24"
            placeholder={
              isRecordingVoice
                ? 'Listening to voice note...'
                : 'Ask Biblio or paste item...'
            }
            placeholderTextColor={c.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />

          {/* Send Button */}
          <Pressable
            onPress={() => handleSend()}
            disabled={(!inputText.trim() && !attachedImage) || sendMessageMutation.isPending}
            style={{
              backgroundColor:
                inputText.trim() || attachedImage
                  ? c.accent
                  : isDark
                  ? '#232D29'
                  : '#E2E8F0',
            }}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70 shadow-sm"
          >
            {sendMessageMutation.isPending ? (
              <InlineLoadingDots color="#FFFFFF" />
            ) : (
              <Send size={18} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ─── Attachment / Media Picker Modal ─── */}
      <Modal
        visible={isMediaModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMediaModalOpen(false)}
      >
        <Pressable
          onPress={() => setIsMediaModalOpen(false)}
          className="flex-1 bg-black/60 justify-end"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isDark ? '#18211E' : '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
            className="p-5 gap-4"
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                Attach Media for AI Ingestion
              </Text>
              <Pressable onPress={() => setIsMediaModalOpen(false)} className="p-1">
                <X size={20} color={c.textTertiary} />
              </Pressable>
            </View>

            <View className="gap-2.5">
              <Pressable
                onPress={() =>
                  handleAttachImage('https://images.unsplash.com/photo-1594938298603-c8148c4dae35')
                }
                style={{
                  backgroundColor: isDark ? '#1F2925' : '#F8FAFC',
                  borderColor: c.border,
                }}
                className="p-3.5 rounded-2xl border flex-row items-center gap-3 active:opacity-70"
              >
                <View className="w-10 h-10 rounded-xl bg-emerald-500/15 items-center justify-center">
                  <ImageIcon size={20} color={c.accent} />
                </View>
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                    Product Photo (Catalog Item)
                  </Text>
                  <Text style={{ color: c.textTertiary }} className="text-xs">
                    Auto-extracts colors, fabric, dimensions & generates 512-dim embedding
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() =>
                  handleAttachImage('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c')
                }
                style={{
                  backgroundColor: isDark ? '#1F2925' : '#F8FAFC',
                  borderColor: c.border,
                }}
                className="p-3.5 rounded-2xl border flex-row items-center gap-3 active:opacity-70"
              >
                <View className="w-10 h-10 rounded-xl bg-amber-500/15 items-center justify-center">
                  <FileText size={20} color="#D97706" />
                </View>
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                    Supplier Invoice / Restock Bill
                  </Text>
                  <Text style={{ color: c.textTertiary }} className="text-xs">
                    OCR parses supplier wholesale quotes & computes profit margin
                  </Text>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
