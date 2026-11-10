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
  Alert,
  ActivityIndicator,
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
  Camera,
  Calendar,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../theme';
let SafeAudio: any = null;
try {
  SafeAudio = require('expo-av').Audio;
} catch (e) {
  // Gracefully handled for Expo Go environments lacking ExponentAV
}
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import {
  useAgentMessages,
  useSendAgentMessage,
  useSendAgentAudio,
  useMerchantConfig,
  useQuarantineChats,
  useResolveQuarantine,
  type AgentMessage,
  type QuarantineRecord,
} from '../src/api/client';
import { SearchSkeleton, InlineLoadingDots } from '../src/components/PulsingSkeleton';
import InAppCameraModal, { CapturedMediaResult } from '../src/components/InAppCameraModal';
import { safeHaptics } from '../src/utils/sanitizers';

type ChannelFilter = 'all' | 'whatsapp' | 'in_app';
type CategoryTray = 'products' | 'finance' | 'sales' | 'profile';

export type AttachmentType =
  | 'product_photo'
  | 'supplier_invoice'
  | 'payment_receipt'
  | 'business_doc';

interface AttachedMediaItem {
  uri: string;
  base64: string;
  type: AttachmentType;
}

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

interface ParsedBookingCard {
  title: string;
  time: string;
  customer?: string;
  status: string;
}

function FormattedAssistantText({ content, color }: { content: string; color: string }) {
  const textStr = typeof content === 'string' ? content : String(content || '');
  const clean = textStr
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/^---+$/gm, '')
    .trim();

  const parts = clean.split(/(\*\*[^*]+\*\*)/g);

  return (
    <Text style={{ color, fontSize: 13.5, lineHeight: 20 }}>
      {parts.map((part, index) => {
        if (typeof part === 'string' && part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2);
          return (
            <Text key={index} className="font-bold" style={{ fontWeight: '700', color }}>
              {boldText}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
}

export default function BiblioAssistantScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const { data: rawMessages, isLoading, refetch } = useAgentMessages();
  const messages = useMemo(() => (Array.isArray(rawMessages) ? rawMessages : []), [rawMessages]);
  const { data: merchantConfig } = useMerchantConfig();
  const sendMessageMutation = useSendAgentMessage();
  const sendAudioMutation = useSendAgentAudio();
  const { data: quarantineList } = useQuarantineChats();
  const resolveQuarantineMutation = useResolveQuarantine();

  const [inputText, setInputText] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<ChannelFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryTray>('products');
  const [isIdentityExpanded, setIsIdentityExpanded] = useState(false);

  // Real Audio Recording State
  const recordingRef = useRef<any | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);

  // Real Media Picker with Distinguishable Categories
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<AttachedMediaItem | null>(null);
  const [isInAppCameraOpen, setIsInAppCameraOpen] = useState(false);
  const [cameraCategory, setCameraCategory] = useState<AttachmentType>('product_photo');

  const flatListRef = useRef<FlatList>(null);
  const lastCountRef = useRef(0);

  // Recording seconds timer
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

  // Clean, non-flickering scroll to bottom (only when genuine new messages arrive)
  useEffect(() => {
    if (messages.length > lastCountRef.current) {
      lastCountRef.current = messages.length;
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Filter messages based on channel tab
  const filteredMessages = useMemo(() => {
    const safe = Array.isArray(messages) ? messages : [];
    if (selectedChannel === 'all') return safe;
    return safe.filter((m) => m && m.channel === selectedChannel);
  }, [messages, selectedChannel]);

  // Counts for tabs
  const whatsappCount = useMemo(
    () => (Array.isArray(messages) ? messages.filter((m) => m && m.channel === 'whatsapp').length : 0),
    [messages]
  );
  const inAppCount = useMemo(
    () => (Array.isArray(messages) ? messages.filter((m) => m && m.channel === 'in_app').length : 0),
    [messages]
  );

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if ((!text && !attachedMedia) || sendMessageMutation.isPending || isProcessingAudio) return;

    safeHaptics.impact();
    const mediaToSend = attachedMedia;

    try {
      await sendMessageMutation.mutateAsync({
        text: text || '',
        imageBase64: mediaToSend ? `data:image/jpeg;base64,${mediaToSend.base64}` : undefined,
        attachmentType: mediaToSend?.type,
      });
      setInputText('');
      setAttachedMedia(null);
    } catch (err: any) {
      console.error('Failed to send assistant message:', err);
      Alert.alert('Message Failed', err?.message || 'Could not communicate with Biblio Assistant.');
    }
  };

  // ─── Real Microphone Recording (Expo AV) ───────────────────────────────────
  const handleToggleVoice = async () => {
    safeHaptics.impact();

    if (!isRecordingVoice) {
      if (!SafeAudio) {
        Alert.alert('Microphone Not Available', 'Voice recording requires a microphone-supported build.');
        return;
      }
      try {
        const { granted } = await SafeAudio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert('Microphone Access Needed', 'Please allow microphone access to record spoken voice notes for Biblio.');
          return;
        }

        await SafeAudio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await SafeAudio.Recording.createAsync(
          SafeAudio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setIsRecordingVoice(true);
      } catch (err: any) {
        console.error('Failed to start audio recording:', err);
        Alert.alert('Recording Error', err.message || 'Could not access device microphone.');
      }
    } else {
      // Stop and send recording
      try {
        setIsRecordingVoice(false);
        setIsProcessingAudio(true);
        const recording = recordingRef.current;
        recordingRef.current = null;

        if (!recording) {
          setIsProcessingAudio(false);
          return;
        }

        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();

        if (uri) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64',
          });

          await sendAudioMutation.mutateAsync({
            audioBase64: base64,
            mimeType: 'audio/m4a',
            durationSeconds: recordingSeconds,
          });
        }
      } catch (err: any) {
        console.error('Failed to process voice note:', err);
        Alert.alert('Voice Note Error', 'Could not process audio. Please try again.');
      } finally {
        setIsProcessingAudio(false);
      }
    }
  };

  // ─── Distinguishable Media Picker (Camera & Gallery) ───────────────────────
  const handlePickMedia = async (category: AttachmentType, source: 'camera' | 'library') => {
    setIsMediaModalOpen(false);
    safeHaptics.impact();
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Camera Permission', 'Camera access is required to snap photos.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });
        if (!result.canceled && result.assets?.[0]?.base64) {
          setAttachedMedia({
            uri: result.assets[0].uri,
            base64: result.assets[0].base64,
            type: category,
          });
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Library Permission', 'Photo library access is required to attach images.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });
        if (!result.canceled && result.assets?.[0]?.base64) {
          setAttachedMedia({
            uri: result.assets[0].uri,
            base64: result.assets[0].base64,
            type: category,
          });
        }
      }
    } catch (e: any) {
      console.warn('Image picker error:', e);
    }
  };

  // ─── Open In-App Camera Viewfinder ─────────────────────────────────────────
  const handleOpenCamera = (category: AttachmentType = 'product_photo') => {
    safeHaptics.impact();
    setIsMediaModalOpen(false);
    setCameraCategory(category);
    setIsInAppCameraOpen(true);
  };

  const handleInAppCameraCapture = async (captured: CapturedMediaResult) => {
    safeHaptics.impact();
    if (captured.note) {
      // Direct send if merchant entered instant notes on review screen
      await sendMessageMutation.mutateAsync({
        text: captured.note,
        imageBase64: `data:image/jpeg;base64,${captured.base64}`,
        attachmentType: captured.type,
      });
    } else {
      // Attach to chat input preview bar for inspection & typing
      setAttachedMedia({
        uri: captured.uri,
        base64: captured.base64,
        type: captured.type,
      });
    }
  };

  // ─── Resolve Personal-to-Business Quarantine ──────────────────────────────
  const handleResolveQuarantine = async (
    quarantineId: string,
    action: 'reply_as_biblio' | 'draft_for_me' | 'ignore',
    draftText?: string
  ) => {
    safeHaptics.impact();
    if (action === 'draft_for_me') {
      setInputText(`Regarding your inquiry on "${draftText || 'item'}", it is available at YEMUEL Gadgets.`);
    }
    await resolveQuarantineMutation.mutateAsync({ quarantineId, action, draftText });
  };

  // Helper to parse product catalog message
  const parseProductCard = (content: string): ParsedProductCard | null => {
    if (!content || typeof content !== 'string') return null;
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

  // Helper to parse booking/appointment message
  const parseBookingCard = (content: string): ParsedBookingCard | null => {
    if (!content || typeof content !== 'string') return null;
    const isBooking =
      content.includes('Booking') ||
      content.includes('Appointment') ||
      content.includes('booked') ||
      content.includes('📅');
    if (!isBooking) return null;

    const timeMatch = content.match(
      /for\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM|am|pm)?|[A-Za-z]+(?:\s+[0-9]{1,2})?(?:\s+at\s+[0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM|am|pm)?)?)/i
    );
    const serviceMatch = content.match(/\(([^)]+)\)|booked\s+([^\n.!]+)/i);
    const customerMatch = content.match(/customer\s+([A-Za-z0-9_-]+)/i);

    if (!timeMatch && !content.includes('booked')) return null;

    return {
      title: serviceMatch ? (serviceMatch[1] || serviceMatch[2]).trim() : 'Service Appointment',
      time: timeMatch ? timeMatch[1].trim() : 'Scheduled Slot',
      customer: customerMatch ? customerMatch[1].trim() : undefined,
      status: 'Confirmed in Calendar',
    };
  };

  // Detect finance receipt
  const isFinanceReceipt = (content: string) => {
    if (!content || typeof content !== 'string') return false;
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
    if (!content || typeof content !== 'string') return false;
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
        'Add 5 units of Black Nike Air Force 1 at 45k floor 40k',
        'Show my out-of-stock products',
        'Draft a high-converting WhatsApp status copy for new stock',
      ],
    },
    finance: {
      label: 'Finance & VAN',
      icon: <Wallet size={14} color={selectedCategory === 'finance' ? '#FFFFFF' : c.textSecondary} />,
      prompts: [
        'What is my current Providus VAN destination account?',
        'Verify my Zero-Deduction settlement fee model',
        'How much did I make from WhatsApp sales this week?',
      ],
    },
    sales: {
      label: 'Bookings & Sales',
      icon: <Calendar size={14} color={selectedCategory === 'sales' ? '#FFFFFF' : c.textSecondary} />,
      prompts: [
        'Book an appointment for Emeka tomorrow by 2pm for screen repair',
        'Show upcoming calendar appointments',
        'Check pending WhatsApp customer checkouts',
      ],
    },
    profile: {
      label: 'Store Profile',
      icon: <Building2 size={14} color={selectedCategory === 'profile' ? '#FFFFFF' : c.textSecondary} />,
      prompts: [
        'Update my warehouse pickup address to 14 Broad Street Lagos',
        'What are my active store operating hours?',
        'Check CAC registration status on my profile',
      ],
    },
  };

  // Extract merchant info safely
  const currentConfig = merchantConfig || {};
  const ownerName = currentConfig.owner_first_name || 'Merchant';
  const businessName = currentConfig.name || 'Store';
  const isRegistered = !!currentConfig.is_registered;
  const rcNumber = currentConfig.rc_number || '';
  const feeModel = currentConfig.fee_padding_model || 'customer_padded';
  const payoutFreq = currentConfig.payout_frequency || 'instant';

  let bankDetails: any = null;
  if (typeof currentConfig.bank_details === 'string') {
    try {
      bankDetails = JSON.parse(currentConfig.bank_details);
    } catch {
      bankDetails = null;
    }
  } else if (currentConfig.bank_details && typeof currentConfig.bank_details === 'object') {
    bankDetails = currentConfig.bank_details;
  }

  const bankName = bankDetails?.bankName || currentConfig.bank_name || 'Bank';
  const accNumRaw = bankDetails?.accountNumber || currentConfig.bank_account_number || '';
  const accNumStr = String(accNumRaw).trim();
  const accDisplay = accNumStr ? `•••• ${accNumStr.slice(-4)}` : 'Not linked';
  const bankDisplay = bankName !== 'Bank' ? bankName : 'Palmpay';
  const nameDisplay = bankDetails?.accountName ? ` • ${bankDetails.accountName}` : '';

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView
      style={{ backgroundColor: isDark ? '#0C100F' : '#F8FAFC' }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      {/* ─── Top Navigation Header ─── */}
      <View
        style={{
          borderBottomColor: c.border,
          borderBottomWidth: 1,
          backgroundColor: isDark ? '#111715' : '#FFFFFF',
        }}
        className="px-4 py-3"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              className="p-1 rounded-full active:opacity-70"
            >
              <ArrowLeft size={20} color={c.textPrimary} />
            </Pressable>

            <View className="flex-row items-center gap-2.5">
              <View className="w-9 h-9 rounded-full items-center justify-center overflow-hidden">
                <Image source={require('../assets/logo.png')} style={{ width: 34, height: 34 }} resizeMode="contain" />
              </View>
              <View>
                <View className="flex-row items-center gap-1.5">
                  <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                    Biblio Copilot
                  </Text>
                  <View className="w-2 h-2 rounded-full bg-emerald-500" />
                </View>
                <Text style={{ color: c.textTertiary }} className="text-[11px] font-medium">
                  Gemini 3.8 / 3.5 Flash • Live across WhatsApp & In-App
                </Text>
              </View>
            </View>
          </View>

          {/* Toggle Identity Card */}
          <Pressable
            onPress={() => {
              safeHaptics.impact();
              setIsIdentityExpanded((prev) => !prev);
            }}
            style={{
              backgroundColor: isIdentityExpanded
                ? c.accentSoft
                : isDark
                ? '#1A2320'
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
                ID: {merchantConfig?.id ? String(merchantConfig.id).slice(0, 8) : 'ACTIVE'}
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
                    {bankDisplay}
                  </Text>
                  <Text style={{ color: c.textTertiary }} className="text-[10px]">
                    {accDisplay}{nameDisplay}
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
              safeHaptics.impact();
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
              safeHaptics.impact();
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
              safeHaptics.impact();
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
            safeHaptics.impact();
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
                  safeHaptics.impact();
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

      {/* ─── Quarantine Personal-to-Business Transition Banners ─── */}
      {Array.isArray(quarantineList) && quarantineList.length > 0 && (
        <View className="px-4 pt-2">
          {quarantineList.map((item) => (
            <View
              key={item.id}
              style={{
                backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7',
                borderColor: '#F59E0B',
              }}
              className="p-3.5 rounded-2xl border mb-2 shadow-sm"
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    Personal-to-Business Question
                  </Text>
                </View>
                <View className="bg-amber-500/20 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                    48h TTL
                  </Text>
                </View>
              </View>

              <Text style={{ color: c.textPrimary }} className="text-xs font-semibold mb-2">
                <Text className="font-bold">{item.sender_name || item.contact_raw_phone}</Text> asked:{' '}
                "{item.trigger_message}"
              </Text>

              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => handleResolveQuarantine(item.id, 'reply_as_biblio')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 active:opacity-80 shadow-xs"
                >
                  <Text className="text-black text-xs font-bold">Reply as Biblio</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleResolveQuarantine(item.id, 'draft_for_me', item.trigger_message)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 active:opacity-80 border border-amber-500/30"
                >
                  <Text className="text-amber-700 dark:text-amber-300 text-xs font-bold">Draft for Me</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleResolveQuarantine(item.id, 'ignore')}
                  className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/10 active:opacity-80"
                >
                  <Text style={{ color: c.textTertiary }} className="text-xs font-semibold">Ignore</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ─── Messages FlatList (Protected from Flickering) ─── */}
      {isLoading && messages.length === 0 ? (
        <View className="flex-1 px-4 pt-4">
          <SearchSkeleton count={6} />
        </View>
      ) : messages.length === 0 ? (
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
            Your multimodal AI copilot is live. Tap the mic to speak voice notes, or tap the paperclip
            to attach distinguishable product photos, supplier invoices, payment transfer slips, or CAC documents.
          </Text>

          <View className="w-full gap-2">
            {categoryPrompts[selectedCategory].prompts.map((prompt, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleSend(prompt)}
                style={{
                  backgroundColor: isDark ? '#161D1A' : '#FFFFFF',
                  borderColor: c.border,
                }}
                className="p-3 rounded-2xl border flex-row items-center justify-between active:opacity-80 shadow-sm"
              >
                <Text style={{ color: c.textPrimary }} className="text-xs font-semibold flex-1 pr-2">
                  {prompt}
                </Text>
                <ArrowUpRight size={14} color={c.accent} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={(item, index) => item?.id || `msg_${index}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isAgent = item.sender_role === 'agent' || item.sender_role === 'assistant';
            const productCard = parseProductCard(item.content);
            const bookingCard = parseBookingCard(item.content);
            const financeCard = isFinanceReceipt(item.content);
            const profileCard = isProfileReceipt(item.content);
            const isSpokenAudio = typeof item.content === 'string' && item.content.startsWith('🎤 [Spoken Audio]:');

            // Detect Distinguishable Attachment Types
            const metaType = (item as any).metadata?.attachmentType;
            const contentStr = typeof item.content === 'string' ? item.content : '';
            const attachmentType =
              metaType ||
              (contentStr.includes('[Supplier Invoice Attached]')
                ? 'supplier_invoice'
                : contentStr.includes('[Bank Transfer Slip Attached]')
                ? 'payment_receipt'
                : contentStr.includes('[CAC / Store Document Attached]')
                ? 'business_doc'
                : contentStr.includes('[Product Photo Attached]')
                ? 'product_photo'
                : null);

            return (
              <View
                className={`mb-4 flex-row ${isAgent ? 'justify-start' : 'justify-end'}`}
              >
                {/* Agent Avatar */}
                {isAgent && (
                  <View className="w-8 h-8 rounded-full items-center justify-center mr-2 self-start mt-1 overflow-hidden">
                    <Image source={require('../assets/logo.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
                  </View>
                )}

                {/* Message Bubble Container */}
                <View style={{ maxWidth: '84%' }}>
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
                    {/* ─── Distinguishable Attachment Badges ─── */}
                    {attachmentType === 'product_photo' ? (
                      <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 self-start mb-2">
                        <Package size={12} color="#10B981" />
                        <Text className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          Product Photo Attached
                        </Text>
                      </View>
                    ) : attachmentType === 'supplier_invoice' ? (
                      <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 self-start mb-2">
                        <FileText size={12} color="#D97706" />
                        <Text className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                          Supplier Restock Invoice
                        </Text>
                      </View>
                    ) : attachmentType === 'payment_receipt' ? (
                      <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 self-start mb-2">
                        <CreditCard size={12} color="#3B82F6" />
                        <Text className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          Transfer Slip / Payment Proof
                        </Text>
                      </View>
                    ) : attachmentType === 'business_doc' ? (
                      <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 self-start mb-2">
                        <ShieldCheck size={12} color="#A855F7" />
                        <Text className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                          CAC Document / KYC Verification
                        </Text>
                      </View>
                    ) : isSpokenAudio ? (
                      <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 self-start mb-2">
                        <Mic size={12} color="#F43F5E" />
                        <Text className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                          Gemini Spoken Voice Note
                        </Text>
                      </View>
                    ) : null}

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
                        </View>
                      </View>
                    ) : bookingCard ? (
                      /* Rich Booking & Appointment Card */
                      <View className="gap-2.5">
                        <View className="flex-row items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                          <View className="flex-row items-center gap-1.5">
                            <Calendar size={15} color="#3B82F6" />
                            <Text style={{ color: '#3B82F6' }} className="text-xs font-bold">
                              {bookingCard.status}
                            </Text>
                          </View>
                          <View className="bg-blue-500/15 px-2 py-0.5 rounded-full">
                            <Text className="text-[10px] font-bold text-blue-500">
                              Synced
                            </Text>
                          </View>
                        </View>

                        <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                          {bookingCard.title}
                        </Text>

                        <View className="flex-row items-center gap-2">
                          <View className="bg-blue-500/10 px-2.5 py-1 rounded-lg flex-row items-center gap-1.5">
                            <Clock size={12} color="#3B82F6" />
                            <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              {bookingCard.time}
                            </Text>
                          </View>
                          {bookingCard.customer && (
                            <View className="bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                              <Text style={{ color: c.textSecondary }} className="text-[11px]">
                                Client: {bookingCard.customer}
                              </Text>
                            </View>
                          )}
                        </View>

                        <FormattedAssistantText content={item.content} color={c.textPrimary} />
                      </View>
                    ) : financeCard ? (
                      /* Rich Finance & VAN Settlement Card */
                      <View className="gap-2">
                        <View className="flex-row items-center gap-1.5 border-b border-black/5 dark:border-white/5 pb-1.5">
                          <Wallet size={15} color="#D97706" />
                          <Text style={{ color: '#D97706' }} className="text-xs font-bold">
                            Zero-Deduction Settlement Route
                          </Text>
                        </View>
                        <FormattedAssistantText content={item.content} color={c.textPrimary} />
                        <View className="bg-amber-500/10 p-2 rounded-xl flex-row items-center gap-1.5">
                          <ShieldCheck size={14} color="#D97706" />
                          <Text className="text-[10px] text-amber-700 dark:text-amber-300 font-medium flex-1">
                            Providus VAN auto-settles instant payouts without deducting platform fees.
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
                        <FormattedAssistantText content={item.content} color={c.textPrimary} />
                      </View>
                    ) : (
                      /* Plain text message */
                      <FormattedAssistantText
                        content={item.content}
                        color={isAgent ? c.textPrimary : '#FFFFFF'}
                      />
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
                          className="text-[10px] capitalize"
                        >
                          {item.channel === 'whatsapp' ? 'WhatsApp Line' : 'Biblio App'}
                        </Text>
                      </View>

                      <Text
                        style={{
                          color: isAgent ? c.textTertiary : 'rgba(255,255,255,0.7)',
                        }}
                        className="text-[10px]"
                      >
                        {(() => {
                          try {
                            return new Date(item.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            });
                          } catch {
                            return 'Now';
                          }
                        })()}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ─── Bottom Input Bar with Real Voice & Camera Ingestion ─── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {/* Active Audio Processing Indicator */}
        {isProcessingAudio && (
          <View
            style={{ backgroundColor: isDark ? '#161D1A' : '#EFF6FF', borderColor: '#3B82F6' }}
            className="mx-4 mb-2 p-2.5 rounded-xl border flex-row items-center gap-2"
          >
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Gemini 3.8 / 3.5 Flash listening across pauses & extracting booking...
            </Text>
          </View>
        )}

        {/* ─── Distinguishable Attached Media Preview Chip ─── */}
        {attachedMedia && (
          <View
            style={{
              backgroundColor:
                attachedMedia.type === 'product_photo'
                  ? isDark
                    ? '#06281A'
                    : '#ECFDF5'
                  : attachedMedia.type === 'supplier_invoice'
                  ? isDark
                    ? '#271B04'
                    : '#FFFBEB'
                  : attachedMedia.type === 'payment_receipt'
                  ? isDark
                    ? '#082138'
                    : '#EFF6FF'
                  : isDark
                  ? '#230E38'
                  : '#FAF5FF',
              borderColor:
                attachedMedia.type === 'product_photo'
                  ? '#10B981'
                  : attachedMedia.type === 'supplier_invoice'
                  ? '#F59E0B'
                  : attachedMedia.type === 'payment_receipt'
                  ? '#3B82F6'
                  : '#A855F7',
            }}
            className="mx-4 mb-2 p-2.5 rounded-2xl border flex-row items-center justify-between shadow-sm"
          >
            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
              <Image
                source={{ uri: attachedMedia.uri }}
                className="w-11 h-11 rounded-xl"
                resizeMode="cover"
              />
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5 mb-1">
                  {attachedMedia.type === 'product_photo' ? (
                    <Package size={13} color="#10B981" />
                  ) : attachedMedia.type === 'supplier_invoice' ? (
                    <FileText size={13} color="#F59E0B" />
                  ) : attachedMedia.type === 'payment_receipt' ? (
                    <CreditCard size={13} color="#3B82F6" />
                  ) : (
                    <ShieldCheck size={13} color="#A855F7" />
                  )}
                  <Text
                    style={{
                      color:
                        attachedMedia.type === 'product_photo'
                          ? '#10B981'
                          : attachedMedia.type === 'supplier_invoice'
                          ? '#F59E0B'
                          : attachedMedia.type === 'payment_receipt'
                          ? '#3B82F6'
                          : '#A855F7',
                    }}
                    className="text-xs font-bold uppercase tracking-wider"
                  >
                    {attachedMedia.type === 'product_photo'
                      ? 'Product Photo'
                      : attachedMedia.type === 'supplier_invoice'
                      ? 'Supplier Invoice'
                      : attachedMedia.type === 'payment_receipt'
                      ? 'Transfer Proof'
                      : 'CAC Document'}
                  </Text>
                </View>

                {/* Quick 1-tap re-categorization pills */}
                <View className="flex-row items-center gap-1">
                  {(
                    [
                      'product_photo',
                      'supplier_invoice',
                      'payment_receipt',
                      'business_doc',
                    ] as AttachmentType[]
                  ).map((t) => {
                    const isSelected = attachedMedia.type === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() =>
                          setAttachedMedia((prev) => (prev ? { ...prev, type: t } : null))
                        }
                        className={`px-1.5 py-0.5 rounded-md ${
                          isSelected ? 'bg-black/15 dark:bg-white/20' : 'bg-transparent'
                        }`}
                      >
                        <Text
                          style={{ color: isSelected ? c.textPrimary : c.textTertiary }}
                          className="text-[9px] font-semibold"
                        >
                          {t === 'product_photo'
                            ? 'Product'
                            : t === 'supplier_invoice'
                            ? 'Invoice'
                            : t === 'payment_receipt'
                            ? 'Receipt'
                            : 'CAC'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => setAttachedMedia(null)}
              className="p-1 rounded-full bg-black/10 dark:bg-white/10"
            >
              <X size={15} color={c.textSecondary} />
            </Pressable>
          </View>
        )}

        {/* Active Microphone Recording Banner */}
        {isRecordingVoice ? (
          <View
            style={{
              backgroundColor: '#EF4444',
              borderColor: '#DC2626',
            }}
            className="mx-4 mb-3 p-3 rounded-2xl flex-row items-center justify-between shadow-md"
          >
            <View className="flex-row items-center gap-2.5">
              <View className="w-3 h-3 rounded-full bg-white animate-pulse" />
              <View>
                <Text className="text-xs font-bold text-white">
                  Recording Live Voice Note ({formatSeconds(recordingSeconds)})
                </Text>
                <Text className="text-[10px] text-white/80">
                  Gemini 3.8 / 3.5 Flash listening across all natural pauses
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleToggleVoice}
              className="px-3 py-1.5 rounded-xl bg-white active:opacity-80"
            >
              <Text className="text-xs font-bold text-red-600">
                Finish & Ingest
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              borderTopColor: c.border,
              borderTopWidth: 1,
              backgroundColor: isDark ? '#111715' : '#FFFFFF',
            }}
            className="px-4 py-3 flex-row items-center gap-2"
          >
            {/* Distinguishable Attachment Button */}
            <Pressable
              onPress={() => {
                safeHaptics.impact();
                setIsMediaModalOpen(true);
              }}
              style={{ backgroundColor: isDark ? '#1F2925' : '#F1F5F9' }}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            >
              <Paperclip size={18} color={c.textSecondary} />
            </Pressable>

            {/* In-App Live Camera Button */}
            <Pressable
              onPress={() => handleOpenCamera('product_photo')}
              style={{ backgroundColor: isDark ? '#1F2925' : '#F1F5F9' }}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            >
              <Camera size={18} color={c.textSecondary} />
            </Pressable>

            {/* Real Voice Mic Button */}
            <Pressable
              onPress={handleToggleVoice}
              disabled={isProcessingAudio}
              style={{
                backgroundColor: isDark ? '#1F2925' : '#F1F5F9',
              }}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            >
              <Mic size={18} color={c.textSecondary} />
            </Pressable>

            {/* Text Input */}
            <TextInput
              style={{
                backgroundColor: isDark ? '#1F2925' : '#F8FAFC',
                color: c.textPrimary,
                borderColor: c.border,
              }}
              className="flex-1 py-2.5 px-4 rounded-3xl border text-sm max-h-24"
              placeholder="Ask Biblio, speak, or snap items..."
              placeholderTextColor={c.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />

            {/* Send Button */}
            <Pressable
              onPress={() => handleSend()}
              disabled={
                (!inputText.trim() && !attachedMedia) ||
                sendMessageMutation.isPending ||
                isProcessingAudio
              }
              style={{
                backgroundColor:
                  inputText.trim() || attachedMedia
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
        )}
      </KeyboardAvoidingView>

      {/* ─── Distinguishable Media Picker Modal ─── */}
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
              <View>
                <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                  Choose Attachment Type
                </Text>
                <Text style={{ color: c.textTertiary }} className="text-xs">
                  Gemini multimodal extracts data based on the document type
                </Text>
              </View>
              <Pressable onPress={() => setIsMediaModalOpen(false)} className="p-1">
                <X size={20} color={c.textTertiary} />
              </Pressable>
            </View>

            <View className="gap-3">
              {/* Option 1: Product Photo */}
              <View
                style={{
                  backgroundColor: isDark ? '#1F2925' : '#F8FAFC',
                  borderColor: '#10B981',
                }}
                className="p-3.5 rounded-2xl border flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View className="w-10 h-10 rounded-xl bg-emerald-500/15 items-center justify-center">
                    <Package size={20} color="#10B981" />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                      Product Photo (Catalog Item)
                    </Text>
                    <Text style={{ color: c.textTertiary }} className="text-xs">
                      Enrich colors, fabrics, prices & generate vector embeddings
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Pressable
                    onPress={() => handleOpenCamera('product_photo')}
                    className="p-2 rounded-xl bg-emerald-500/20 active:opacity-70"
                  >
                    <Camera size={16} color="#10B981" />
                  </Pressable>
                  <Pressable
                    onPress={() => handlePickMedia('product_photo', 'library')}
                    className="p-2 rounded-xl bg-emerald-500/20 active:opacity-70"
                  >
                    <ImageIcon size={16} color="#10B981" />
                  </Pressable>
                </View>
              </View>

              {/* Option 2: Supplier Invoice */}
              <View
                style={{
                  backgroundColor: isDark ? '#1F2925' : '#F8FAFC',
                  borderColor: '#F59E0B',
                }}
                className="p-3.5 rounded-2xl border flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View className="w-10 h-10 rounded-xl bg-amber-500/15 items-center justify-center">
                    <FileText size={20} color="#F59E0B" />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                      Supplier Restock Invoice
                    </Text>
                    <Text style={{ color: c.textTertiary }} className="text-xs">
                      OCR line items, wholesale cost & compute +30% retail markup
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Pressable
                    onPress={() => handleOpenCamera('supplier_invoice')}
                    className="p-2 rounded-xl bg-amber-500/20 active:opacity-70"
                  >
                    <Camera size={16} color="#F59E0B" />
                  </Pressable>
                  <Pressable
                    onPress={() => handlePickMedia('supplier_invoice', 'library')}
                    className="p-2 rounded-xl bg-amber-500/20 active:opacity-70"
                  >
                    <ImageIcon size={16} color="#F59E0B" />
                  </Pressable>
                </View>
              </View>

              {/* Option 3: Payment Transfer Slip */}
              <View
                style={{
                  backgroundColor: isDark ? '#1F2925' : '#F8FAFC',
                  borderColor: '#3B82F6',
                }}
                className="p-3.5 rounded-2xl border flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View className="w-10 h-10 rounded-xl bg-blue-500/15 items-center justify-center">
                    <CreditCard size={20} color="#3B82F6" />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                      Transfer Slip / Payment Proof
                    </Text>
                    <Text style={{ color: c.textTertiary }} className="text-xs">
                      Verify buyer bank transfer against Providus VAN settlement
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Pressable
                    onPress={() => handleOpenCamera('payment_receipt')}
                    className="p-2 rounded-xl bg-blue-500/20 active:opacity-70"
                  >
                    <Camera size={16} color="#3B82F6" />
                  </Pressable>
                  <Pressable
                    onPress={() => handlePickMedia('payment_receipt', 'library')}
                    className="p-2 rounded-xl bg-blue-500/20 active:opacity-70"
                  >
                    <ImageIcon size={16} color="#3B82F6" />
                  </Pressable>
                </View>
              </View>

              {/* Option 4: CAC / Business Document */}
              <View
                style={{
                  backgroundColor: isDark ? '#1F2925' : '#F8FAFC',
                  borderColor: '#A855F7',
                }}
                className="p-3.5 rounded-2xl border flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View className="w-10 h-10 rounded-xl bg-purple-500/15 items-center justify-center">
                    <Building2 size={20} color="#A855F7" />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                      CAC Registration Document
                    </Text>
                    <Text style={{ color: c.textTertiary }} className="text-xs">
                      Extract RC number & verify official store compliance
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Pressable
                    onPress={() => handleOpenCamera('business_doc')}
                    className="p-2 rounded-xl bg-purple-500/20 active:opacity-70"
                  >
                    <Camera size={16} color="#A855F7" />
                  </Pressable>
                  <Pressable
                    onPress={() => handlePickMedia('business_doc', 'library')}
                    className="p-2 rounded-xl bg-purple-500/20 active:opacity-70"
                  >
                    <ImageIcon size={16} color="#A855F7" />
                  </Pressable>
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── In-App Camera Viewfinder Modal ─── */}
      <InAppCameraModal
        visible={isInAppCameraOpen}
        initialCategory={cameraCategory}
        onClose={() => setIsInAppCameraOpen(false)}
        onCapture={handleInAppCameraCapture}
      />
    </SafeAreaView>
  );
}
