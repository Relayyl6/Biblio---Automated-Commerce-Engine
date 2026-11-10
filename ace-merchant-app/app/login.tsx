import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Phone,
  ShieldCheck,
  ArrowLeft,
  MessageCircle,
  HelpCircle,
  ChevronDown,
  X,
  User,
  Store,
  Calendar,
  CheckCircle2,
  Shield,
  FileText,
  Bell,
  Smartphone,
  Mail,
  Lock,
} from 'lucide-react-native';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/api/client';
import { colors } from './../theme';
import { InlineLoadingDots } from '../src/components/PulsingSkeleton';
import { normalizePhoneNumber, isValidPhoneNumber, safeHaptics } from '../src/utils/sanitizers';

const OTP_LENGTH = 6;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const CURRENT_YEAR = new Date().getFullYear();
// Require 18+ for legally binding financial & automated merchant contracts
const YEARS = Array.from({ length: 70 }, (_, i) => String(CURRENT_YEAR - 18 - i));

type LoginStep = 'phone' | 'otp' | 'finish_profile';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const [step, setStep] = useState<LoginStep>('phone');
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Unified SMS-First & Email Fallback Authentication State
  const [activeChannel, setActiveChannel] = useState<'sms' | 'email'>('sms');
  const [email, setEmail] = useState('');
  const [showEmailFallback, setShowEmailFallback] = useState(false);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [pushBannerCode, setPushBannerCode] = useState<string | null>(null);
  const [channelMessage, setChannelMessage] = useState<string>('');

  const DISCLAIMER_TEXT =
    'DISCLAIMER: Never share this security code with anyone. Biblio will NEVER ask for your code via call, SMS, email, or chat.';

  // New Merchant Account Creation Fields (Image 1)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('October');
  const [selectedDay, setSelectedDay] = useState('24');
  const [selectedYear, setSelectedYear] = useState('2000');

  // Active Dropdown Picker Modals
  const [activePicker, setActivePicker] = useState<'month' | 'day' | 'year' | null>(null);
  // "Why do I need to provide my birthday?" Modal (Image 2)
  const [isWhyBirthdayOpen, setIsWhyBirthdayOpen] = useState(false);

  // Temporary auth credentials held during onboarding
  const [tempAuth, setTempAuth] = useState<{ merchantId: string; token: string } | null>(null);

  const setAuth = useAuthStore((state) => state.setAuth);
  const otpRefs = useRef<Array<any>>([]);

  const code = otpDigits.join('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((val) => val - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (step === 'otp' && code.length === OTP_LENGTH && !isLoading) {
      handleVerifyOTP();
    }
  }, [code]);

  const formatPhoneDisplay = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
  };

  const isPhoneValid = isValidPhoneNumber(phone);

  const handleSendOTP = async () => {
    setError(null);
    if (!isPhoneValid) {
      setError('Enter a valid phone number (e.g. 08012345678 or +234...)');
      return;
    }
    setIsLoading(true);
    try {
      const cleanPhone = normalizePhoneNumber(phone);
      const res = await api.post('/auth/merchant/login', {
        phone: cleanPhone,
        channel: 'sms',
      });
      setActiveChannel('sms');
      if (res.data?.pushOtp) {
        setPushBannerCode(res.data.pushOtp);
        safeHaptics.notification();
      } else {
        setPushBannerCode(null);
      }
      if (res.data?.message) {
        setChannelMessage(res.data.message);
      }
      setStep('otp');
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 350);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send SMS code. Please check number or enter email instead.');
    } finally {
      setIsLoading(false);
    }
  };

  const isEmailValid = email.trim().length > 3 && email.includes('@');

  const handleSendEmailAuth = async () => {
    setError(null);
    if (!isEmailValid) {
      setError('Please enter a valid email address (e.g. store@gmail.com)');
      return;
    }
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await api.post('/auth/merchant/login', {
        email: cleanEmail,
        channel: 'email',
      });
      setActiveChannel('email');
      setChannelMessage(res.data?.message || `Passcode sent to ${cleanEmail} via Nodemailer`);
      safeHaptics.notification();
      setStep('otp');
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 350);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send code to email. Please check your address.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmailFallback = async () => {
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsEmailSending(true);
    try {
      const cleanPhone = normalizePhoneNumber(phone);
      const res = await api.post('/auth/merchant/email-otp', {
        phone: cleanPhone,
        email: email.trim().toLowerCase(),
      });
      setActiveChannel('email');
      setShowEmailFallback(false);
      setChannelMessage(res.data?.message || `Passcode dispatched to ${email.trim()}`);
      safeHaptics.notification();
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send code to email.');
    } finally {
      setIsEmailSending(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    otpRefs.current[0]?.focus();
    if (activeChannel === 'email' && email.trim()) {
      if (showEmailFallback) {
        await handleSendEmailFallback();
      } else {
        await handleSendEmailAuth();
      }
    } else {
      await handleSendOTP();
    }
  };

  const handleVerifyOTP = async () => {
    setError(null);
    if (code.length !== OTP_LENGTH) return;
    setIsLoading(true);
    try {
      const cleanPhone = normalizePhoneNumber(phone);
      const payload: Record<string, string> = { code };
      if (cleanPhone) payload.phone = cleanPhone;
      if (email.trim()) payload.email = email.trim().toLowerCase();

      const res = await api.post('/auth/merchant/verify', payload);

      if (res.data && res.data.merchantId) {
        if (res.data.isNewUser) {
          // Transition to Step 3: Finish creating your account
          setTempAuth({ merchantId: res.data.merchantId, token: res.data.token });
          setStep('finish_profile');
        } else {
          // Existing registered user with completed profile -> Login
          setAuth(res.data.merchantId, res.data.token);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code. Check and try again.');
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmFinishAccount = async () => {
    setError(null);
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }
    if (!lastName.trim()) {
      setError('Please enter your last name');
      return;
    }

    if (!tempAuth?.merchantId) {
      setError('Session expired. Please restart sign in.');
      setStep('phone');
      return;
    }

    setIsLoading(true);
    try {
      const monthIdx = MONTHS.indexOf(selectedMonth) + 1;
      await api.post('/auth/merchant/finish-profile', {
        merchantId: tempAuth.merchantId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        businessName: businessName.trim() || `${firstName.trim()}'s Store`,
        dobMonth: selectedMonth,
        dobDay: Number(selectedDay),
        dobYear: Number(selectedYear),
      });

      // Complete authentication and enter dashboard
      setAuth(tempAuth.merchantId, tempAuth.token);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save profile details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) {
      const pasted = text.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
      const next = Array(OTP_LENGTH).fill('');
      pasted.forEach((d, i) => (next[i] = d));
      setOtpDigits(next);
      const lastIndex = Math.min(pasted.length, OTP_LENGTH) - 1;
      otpRefs.current[lastIndex]?.focus();
      return;
    }
    const digit = text.replace(/\D/g, '');
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const next = [...otpDigits];
      next[index - 1] = '';
      setOtpDigits(next);
    }
  };

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 1400 }), withTiming(1, { duration: 1400 })),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Top Bar with Unauthenticated Help & Support Access ── */}
      <View
        style={{ paddingTop: Math.max(insets.top, 16) }}
        className="px-6 pb-2 flex-row items-center justify-between z-10"
      >
        {step !== 'phone' ? (
          <Pressable
            onPress={() => {
              if (step === 'finish_profile') {
                setStep('otp');
              } else {
                setStep('phone');
                setOtpDigits(Array(OTP_LENGTH).fill(''));
              }
              setError(null);
            }}
            style={{ backgroundColor: c.surface, borderColor: c.border }}
            className="w-10 h-10 rounded-full border items-center justify-center active:opacity-70"
            hitSlop={10}
          >
            <ArrowLeft color={c.textPrimary} size={18} />
          </Pressable>
        ) : (
          <View className="w-10 h-10" />
        )}

        <Pressable
          onPress={() => router.push('/support')}
          style={{ backgroundColor: c.surface, borderColor: c.border }}
          className="flex-row items-center px-3 py-1.5 rounded-full border active:opacity-70"
        >
          <HelpCircle size={15} color={c.accent} />
          <Text style={{ color: c.textPrimary }} className="text-xs font-bold ml-1.5">
            Help & Support
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 pt-2 pb-8">
          {/* Logo Brand Header - Side by Side with text-start */}
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            className="flex-row items-center justify-center mb-6"
          >
            <Animated.View
              style={[pulseStyle]}
              className="w-16 h-16 items-center justify-center mr-3.5"
            >
              <Image source={require('../assets/logo.png')} style={{ width: 56, height: 56 }} resizeMode="contain" />
            </Animated.View>
            <View className="items-start">
              <Text style={{ color: c.textPrimary }} className="text-2xl font-black tracking-tight text-left">
                Biblio
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs font-semibold mt-0.5 text-left">
                Autonomous Commerce Engine
              </Text>
            </View>
          </Animated.View>

          {/* ── Main Form Card ── */}
          <Animated.View
            layout={Layout.springify()}
            entering={FadeInUp.duration(400).springify()}
            style={{ backgroundColor: c.surface, borderColor: c.border }}
            className="border rounded-3xl p-6 shadow-sm mb-6"
          >
            {/* STEP 1: Phone / Mobile Entry (Mobile-First Authentication) */}
            {step === 'phone' && (
              <Animated.View entering={FadeIn.duration(200)} key="phone-step">
                <Text style={{ color: c.textPrimary }} className="text-xl font-bold mb-1">
                  Welcome to Biblio
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-xs mb-5 leading-relaxed">
                  {authMode === 'phone'
                    ? 'Sign in or create your store with your active mobile number'
                    : 'Sign in or create your store with your registered email'}
                </Text>

                {authMode === 'phone' ? (
                  <>
                    <Text
                      style={{ color: c.textTertiary }}
                      className="text-[11px] font-bold uppercase tracking-wider mb-2 ml-1"
                    >
                      Mobile Phone Number
                    </Text>
                    <View
                      style={{ backgroundColor: c.bg, borderColor: error ? c.danger : c.border }}
                      className="flex-row items-center border rounded-2xl px-4 h-14"
                    >
                      <Phone color={c.accent} size={18} />
                      <TextInput
                        style={{ color: c.textPrimary }}
                        className="flex-1 text-base ml-3 font-semibold"
                        placeholder="0812 345 6789"
                        placeholderTextColor={c.textTertiary}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        value={formatPhoneDisplay(phone)}
                        onChangeText={(t) => {
                          setPhone(t);
                          if (error) setError(null);
                        }}
                        maxLength={13}
                        returnKeyType="done"
                        onSubmitEditing={handleSendOTP}
                      />
                    </View>

                    {error && (
                      <Animated.View entering={FadeIn.duration(150)} className="mt-2 ml-1">
                        <Text style={{ color: c.danger }} className="text-xs">
                          {error}
                        </Text>
                        <Pressable
                          onPress={() => {
                            setAuthMode('email');
                            setError(null);
                          }}
                          className="mt-1.5 flex-row items-center active:opacity-75"
                        >
                          <Mail size={12} color={c.accent} style={{ marginRight: 4 }} />
                          <Text style={{ color: c.accent }} className="text-xs font-bold underline">
                            SMS delivery failing? Click here to enter email instead →
                          </Text>
                        </Pressable>
                      </Animated.View>
                    )}

                    {/* Direct SMS Verification Channel Badge */}
                    <View
                      style={{
                        backgroundColor: isDark ? '#064E3B20' : '#ECFDF5',
                        borderColor: '#10B981',
                      }}
                      className="border rounded-2xl p-3.5 mt-4 mb-2 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center flex-1 mr-2">
                        <View className="w-9 h-9 rounded-xl bg-emerald-500/20 items-center justify-center mr-3">
                          <Smartphone size={18} color="#10B981" />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text style={{ color: '#10B981' }} className="text-xs font-bold">
                              Direct SMS Verification
                            </Text>
                            <View className="ml-2 bg-emerald-500/15 px-1.5 py-0.2 rounded">
                              <Text className="text-[9px] font-bold text-emerald-500">Clerk & Twilio</Text>
                            </View>
                          </View>
                          <Text style={{ color: c.textTertiary }} className="text-[10px] mt-0.5 leading-tight">
                            One-time passcode dispatched directly to your mobile carrier
                          </Text>
                        </View>
                      </View>
                      <ShieldCheck size={16} color="#10B981" />
                    </View>

                    {/* Mandatory Anti-Fraud Security Disclaimer */}
                    <View
                      style={{
                        backgroundColor: isDark ? '#2D1F08' : '#FFFBEB',
                        borderColor: isDark ? '#78350F' : '#FDE68A',
                      }}
                      className="p-3.5 rounded-2xl border my-2 flex-row items-start"
                    >
                      <Lock size={15} color="#D97706" style={{ marginTop: 2, marginRight: 8 }} />
                      <Text
                        style={{ color: isDark ? '#FDE68A' : '#92400E' }}
                        className="text-[11px] leading-4 flex-1 font-medium"
                      >
                        <Text className="font-bold">DISCLAIMER:</Text> Never share this security code with anyone. Biblio will NEVER ask for your code via call, SMS, email, or chat.
                      </Text>
                    </View>

                    <Pressable
                      onPress={handleSendOTP}
                      disabled={isLoading || !isPhoneValid}
                      style={{
                        backgroundColor: isLoading || !isPhoneValid ? c.border : c.accent,
                      }}
                      className="h-14 rounded-2xl items-center justify-center mt-3 flex-row active:opacity-80 shadow-sm"
                    >
                      {isLoading ? (
                        <InlineLoadingDots color={isDark ? '#090A0C' : '#FFFFFF'} />
                      ) : (
                        <Text
                          style={{ color: isDark ? '#090A0C' : '#FFFFFF' }}
                          className="text-base font-bold"
                        >
                          Send SMS Passcode
                        </Text>
                      )}
                    </Pressable>

                    {/* Small option: Enter email instead */}
                    <Pressable
                      onPress={() => {
                        setAuthMode('email');
                        setError(null);
                      }}
                      className="mt-3.5 py-1.5 flex-row items-center justify-center active:opacity-70"
                    >
                      <Mail size={13} color={c.accent} style={{ marginRight: 6 }} />
                      <Text style={{ color: c.accent }} className="text-xs font-semibold">
                        Enter email instead
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text
                      style={{ color: c.textTertiary }}
                      className="text-[11px] font-bold uppercase tracking-wider mb-2 ml-1"
                    >
                      Email Address
                    </Text>
                    <View
                      style={{ backgroundColor: c.bg, borderColor: error ? c.danger : c.border }}
                      className="flex-row items-center border rounded-2xl px-4 h-14"
                    >
                      <Mail color={c.accent} size={18} />
                      <TextInput
                        style={{ color: c.textPrimary }}
                        className="flex-1 text-base ml-3 font-semibold"
                        placeholder="merchant@yourstore.com"
                        placeholderTextColor={c.textTertiary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={email}
                        onChangeText={(t) => {
                          setEmail(t);
                          if (error) setError(null);
                        }}
                        returnKeyType="done"
                        onSubmitEditing={handleSendEmailAuth}
                      />
                    </View>

                    {error && (
                      <Animated.Text
                        entering={FadeIn.duration(150)}
                        style={{ color: c.danger }}
                        className="text-xs mt-2 ml-1"
                      >
                        {error}
                      </Animated.Text>
                    )}

                    {/* Nodemailer Secure Transport Channel Badge */}
                    <View
                      style={{
                        backgroundColor: isDark ? '#064E3B20' : '#ECFDF5',
                        borderColor: '#10B981',
                      }}
                      className="border rounded-2xl p-3.5 mt-4 mb-2 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center flex-1 mr-2">
                        <View className="w-9 h-9 rounded-xl bg-emerald-500/20 items-center justify-center mr-3">
                          <Mail size={18} color="#10B981" />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text style={{ color: '#10B981' }} className="text-xs font-bold">
                              Nodemailer Secure Email Relay
                            </Text>
                            <View className="ml-2 bg-emerald-500/15 px-1.5 py-0.2 rounded">
                              <Text className="text-[9px] font-bold text-emerald-500">SMTP Auth</Text>
                            </View>
                          </View>
                          <Text style={{ color: c.textTertiary }} className="text-[10px] mt-0.5 leading-tight">
                            6-digit security token delivered directly to your inbox
                          </Text>
                        </View>
                      </View>
                      <ShieldCheck size={16} color="#10B981" />
                    </View>

                    {/* Mandatory Anti-Fraud Security Disclaimer */}
                    <View
                      style={{
                        backgroundColor: isDark ? '#2D1F08' : '#FFFBEB',
                        borderColor: isDark ? '#78350F' : '#FDE68A',
                      }}
                      className="p-3.5 rounded-2xl border my-2 flex-row items-start"
                    >
                      <Lock size={15} color="#D97706" style={{ marginTop: 2, marginRight: 8 }} />
                      <Text
                        style={{ color: isDark ? '#FDE68A' : '#92400E' }}
                        className="text-[11px] leading-4 flex-1 font-medium"
                      >
                        <Text className="font-bold">DISCLAIMER:</Text> Never share this security code with anyone. Biblio will NEVER ask for your code via call, SMS, email, or chat.
                      </Text>
                    </View>

                    <Pressable
                      onPress={handleSendEmailAuth}
                      disabled={isLoading || !isEmailValid}
                      style={{
                        backgroundColor: isLoading || !isEmailValid ? c.border : c.accent,
                      }}
                      className="h-14 rounded-2xl items-center justify-center mt-3 flex-row active:opacity-80 shadow-sm"
                    >
                      {isLoading ? (
                        <InlineLoadingDots color={isDark ? '#090A0C' : '#FFFFFF'} />
                      ) : (
                        <Text
                          style={{ color: isDark ? '#090A0C' : '#FFFFFF' }}
                          className="text-base font-bold"
                        >
                          Send Email Passcode
                        </Text>
                      )}
                    </Pressable>

                    {/* Small option: Use mobile number instead */}
                    <Pressable
                      onPress={() => {
                        setAuthMode('phone');
                        setError(null);
                      }}
                      className="mt-3.5 py-1.5 flex-row items-center justify-center active:opacity-70"
                    >
                      <Smartphone size={13} color={c.accent} style={{ marginRight: 6 }} />
                      <Text style={{ color: c.accent }} className="text-xs font-semibold">
                        ← Use mobile number instead
                      </Text>
                    </Pressable>
                  </>
                )}

                <Text
                  style={{ color: c.textTertiary }}
                  className="text-[11px] text-center mt-4 leading-4"
                >
                  Standard rates apply • NDPA 2023 Compliant
                </Text>
              </Animated.View>
            )}

            {/* STEP 2: OTP Verification */}
            {step === 'otp' && (
              <Animated.View entering={FadeIn.duration(200)} key="otp-step">
                {/* Instant Device Security Alert Banner */}
                {pushBannerCode && (
                  <Animated.View
                    entering={FadeInDown.duration(300).springify()}
                    style={{
                      backgroundColor: isDark ? '#1C2E24' : '#E8F5E9',
                      borderColor: '#10B981',
                    }}
                    className="border rounded-2xl p-3.5 mb-4 flex-row items-center justify-between shadow-sm"
                  >
                    <View className="flex-row items-center flex-1 mr-3">
                      <View className="w-9 h-9 rounded-xl bg-emerald-500/20 items-center justify-center mr-3">
                        <Bell size={18} color="#10B981" />
                      </View>
                      <View className="flex-1">
                        <Text style={{ color: c.textPrimary }} className="text-xs font-bold">
                          Biblio Device Alert
                        </Text>
                        <Text style={{ color: c.textSecondary }} className="text-[11px] mt-0.5">
                          Code: <Text className="font-bold text-emerald-600">{pushBannerCode}</Text>
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => {
                        safeHaptics.notification();
                        const digits = pushBannerCode.split('');
                        setOtpDigits(digits);
                      }}
                      className="bg-emerald-600 px-3 py-1.5 rounded-xl active:opacity-80"
                    >
                      <Text className="text-white text-xs font-bold">Autofill</Text>
                    </Pressable>
                  </Animated.View>
                )}

                <View
                  style={{ backgroundColor: c.accentSoft }}
                  className="w-12 h-12 rounded-xl items-center justify-center mb-3"
                >
                  <ShieldCheck color={c.accent} size={22} />
                </View>
                <Text style={{ color: c.textPrimary }} className="text-xl font-bold mb-1">
                  Enter 6-Digit Code
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-xs mb-4 leading-5">
                  {channelMessage ? (
                    channelMessage
                  ) : (
                    <>
                      Dispatched via {activeChannel.toUpperCase()} to{' '}
                      <Text style={{ color: c.textPrimary }} className="font-bold">
                        {activeChannel === 'sms' ? formatPhoneDisplay(phone) : email}
                      </Text>
                    </>
                  )}
                </Text>

                <View className="flex-row justify-between mb-2">
                  {otpDigits.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(ref) => {
                        otpRefs.current[i] = ref as any;
                      }}
                      value={digit}
                      onChangeText={(t) => handleOtpChange(t, i)}
                      onKeyPress={(e) => handleOtpKeyPress(e, i)}
                      keyboardType="number-pad"
                      maxLength={OTP_LENGTH}
                      style={{
                        backgroundColor: c.bg,
                        borderColor: error ? c.danger : digit ? c.accent : c.border,
                        color: c.textPrimary,
                      }}
                      className="w-12 h-14 rounded-xl text-center text-xl font-bold border"
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {/* Mandatory Security Disclaimer */}
                <View
                  style={{
                    backgroundColor: isDark ? '#2D1F08' : '#FFFBEB',
                    borderColor: isDark ? '#78350F' : '#FDE68A',
                  }}
                  className="p-3 rounded-2xl border my-2 flex-row items-start"
                >
                  <Lock size={14} color="#D97706" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text
                    style={{ color: isDark ? '#FDE68A' : '#92400E' }}
                    className="text-[10px] leading-4 flex-1 font-medium"
                  >
                    <Text className="font-bold">SECURITY NOTICE:</Text> Never share this security code with anyone. Biblio will NEVER ask for your code via call, SMS, email, or chat.
                  </Text>
                </View>

                {error && (
                  <Animated.Text
                    entering={FadeIn.duration(150)}
                    style={{ color: c.danger }}
                    className="text-xs mt-1 ml-1"
                  >
                    {error}
                  </Animated.Text>
                )}

                {isLoading && (
                  <View className="flex-row items-center justify-center mt-4">
                    <InlineLoadingDots color={c.accent} />
                    <Text style={{ color: c.textSecondary }} className="text-xs ml-2 font-medium">
                      Verifying with carrier network...
                    </Text>
                  </View>
                )}

                {/* Email Fallback Intake Component */}
                <View className="mt-4 pt-3 border-t" style={{ borderColor: c.border }}>
                  {!showEmailFallback ? (
                    <Pressable
                      onPress={() => setShowEmailFallback(true)}
                      className="flex-row items-center justify-center py-1 active:opacity-70"
                    >
                      <Mail size={14} color={c.accent} style={{ marginRight: 6 }} />
                      <Text style={{ color: c.accent }} className="text-xs font-semibold">
                        Didn't receive SMS? Send code to your email instead
                      </Text>
                    </Pressable>
                  ) : (
                    <View className="mt-1">
                      <Text style={{ color: c.textSecondary }} className="text-xs font-bold mb-1.5">
                        Type your email address:
                      </Text>
                      <View className="flex-row items-center">
                        <View
                          style={{ backgroundColor: c.bg, borderColor: c.border }}
                          className="flex-1 flex-row items-center border rounded-xl px-3 h-11 mr-2"
                        >
                          <Mail size={15} color={c.textTertiary} />
                          <TextInput
                            style={{ color: c.textPrimary }}
                            className="flex-1 text-xs ml-2 font-medium"
                            placeholder="you@store.com"
                            placeholderTextColor={c.textTertiary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={email}
                            onChangeText={(t) => setEmail(t)}
                          />
                        </View>
                        <Pressable
                          onPress={handleSendEmailFallback}
                          disabled={isEmailSending || !email.trim()}
                          style={{
                            backgroundColor: isEmailSending || !email.trim() ? c.border : c.accent,
                          }}
                          className="h-11 px-3.5 rounded-xl items-center justify-center active:opacity-80"
                        >
                          {isEmailSending ? (
                            <InlineLoadingDots color={isDark ? '#090A0C' : '#FFFFFF'} />
                          ) : (
                            <Text style={{ color: isDark ? '#090A0C' : '#FFFFFF' }} className="text-xs font-bold">
                              Send Code
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>

                <View className="flex-row items-center justify-between mt-5 px-1">
                  <Pressable
                    onPress={() => {
                      setStep('phone');
                      setOtpDigits(Array(OTP_LENGTH).fill(''));
                      setError(null);
                    }}
                  >
                    <Text style={{ color: c.accent }} className="text-xs font-semibold">
                      ← Change phone number
                    </Text>
                  </Pressable>

                  <Pressable onPress={handleResend} disabled={resendCooldown > 0}>
                    <Text
                      style={{ color: resendCooldown > 0 ? c.textTertiary : c.accent }}
                      className="text-xs font-bold"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {/* STEP 3: Finish Creating Your Account (Matches User Image 1) */}
            {step === 'finish_profile' && (
              <Animated.View entering={FadeIn.duration(200)} key="finish-profile-step">
                <Text style={{ color: c.textPrimary }} className="text-xl font-extrabold mb-1">
                  Finish creating your account
                </Text>
                <View className="flex-row flex-wrap items-center mb-6">
                  <Text style={{ color: c.textSecondary }} className="text-xs">
                    This information won't be public.{' '}
                  </Text>
                  <Pressable onPress={() => setIsWhyBirthdayOpen(true)} className="active:opacity-70">
                    <Text style={{ color: '#3B82F6' }} className="text-xs font-semibold">
                      Why do I need to provide my birthday?
                    </Text>
                  </Pressable>
                </View>

                {/* First Name & Last Name */}
                <View className="flex-row space-x-3 mb-4">
                  <View className="flex-1 mr-2">
                    <Text
                      style={{ color: c.textTertiary }}
                      className="text-[11px] font-bold uppercase tracking-wider mb-1.5 ml-1"
                    >
                      First Name
                    </Text>
                    <View
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                      className="border rounded-2xl px-3.5 h-13 justify-center"
                    >
                      <TextInput
                        style={{ color: c.textPrimary }}
                        className="text-sm font-semibold py-3"
                        placeholder="First name"
                        placeholderTextColor={c.textTertiary}
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  <View className="flex-1">
                    <Text
                      style={{ color: c.textTertiary }}
                      className="text-[11px] font-bold uppercase tracking-wider mb-1.5 ml-1"
                    >
                      Last Name
                    </Text>
                    <View
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                      className="border rounded-2xl px-3.5 h-13 justify-center"
                    >
                      <TextInput
                        style={{ color: c.textPrimary }}
                        className="text-sm font-semibold py-3"
                        placeholder="Last name"
                        placeholderTextColor={c.textTertiary}
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                </View>

                {/* Optional Store Name */}
                <View className="mb-4">
                  <Text
                    style={{ color: c.textTertiary }}
                    className="text-[11px] font-bold uppercase tracking-wider mb-1.5 ml-1"
                  >
                    Store / Business Name
                  </Text>
                  <View
                    style={{ backgroundColor: c.bg, borderColor: c.border }}
                    className="flex-row items-center border rounded-2xl px-3.5 h-13"
                  >
                    <Store size={16} color={c.textTertiary} />
                    <TextInput
                      style={{ color: c.textPrimary }}
                      className="flex-1 text-sm font-semibold ml-2.5 py-3"
                      placeholder="e.g. Jane Textiles"
                      placeholderTextColor={c.textTertiary}
                      value={businessName}
                      onChangeText={setBusinessName}
                    />
                  </View>
                </View>

                {/* Date of Birth Pickers (Image 1 Dropdowns) */}
                <View className="mb-6">
                  <Text
                    style={{ color: c.textTertiary }}
                    className="text-[11px] font-bold uppercase tracking-wider mb-1.5 ml-1"
                  >
                    Date of Birth
                  </Text>

                  <View className="flex-row space-x-2">
                    {/* Month Picker Box */}
                    <Pressable
                      onPress={() => setActivePicker('month')}
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                      className="flex-1 border rounded-2xl p-3 justify-between mr-2 active:opacity-75"
                    >
                      <Text style={{ color: c.textTertiary }} className="text-[10px] font-medium">
                        Month
                      </Text>
                      <View className="flex-row items-center justify-between mt-1">
                        <Text
                          style={{ color: c.textPrimary }}
                          className="text-sm font-bold"
                          numberOfLines={1}
                        >
                          {selectedMonth}
                        </Text>
                        <ChevronDown size={14} color={c.textTertiary} />
                      </View>
                    </Pressable>

                    {/* Day Picker Box */}
                    <Pressable
                      onPress={() => setActivePicker('day')}
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                      className="w-20 border rounded-2xl p-3 justify-between mr-2 active:opacity-75"
                    >
                      <Text style={{ color: c.textTertiary }} className="text-[10px] font-medium">
                        Day
                      </Text>
                      <View className="flex-row items-center justify-between mt-1">
                        <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                          {selectedDay}
                        </Text>
                        <ChevronDown size={14} color={c.textTertiary} />
                      </View>
                    </Pressable>

                    {/* Year Picker Box */}
                    <Pressable
                      onPress={() => setActivePicker('year')}
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                      className="w-24 border rounded-2xl p-3 justify-between active:opacity-75"
                    >
                      <Text style={{ color: c.textTertiary }} className="text-[10px] font-medium">
                        Year
                      </Text>
                      <View className="flex-row items-center justify-between mt-1">
                        <Text style={{ color: c.textPrimary }} className="text-sm font-bold">
                          {selectedYear}
                        </Text>
                        <ChevronDown size={14} color={c.textTertiary} />
                      </View>
                    </Pressable>
                  </View>
                </View>

                {error && (
                  <Animated.Text
                    entering={FadeIn.duration(150)}
                    style={{ color: c.danger }}
                    className="text-xs mb-3 ml-1"
                  >
                    {error}
                  </Animated.Text>
                )}

                {/* Confirm Button */}
                <Pressable
                  onPress={handleConfirmFinishAccount}
                  disabled={isLoading}
                  style={{ backgroundColor: c.accent }}
                  className="h-14 rounded-2xl items-center justify-center flex-row active:opacity-85 shadow-sm mb-4"
                >
                  {isLoading ? (
                    <InlineLoadingDots color={isDark ? '#090A0C' : '#FFFFFF'} />
                  ) : (
                    <Text
                      style={{ color: isDark ? '#090A0C' : '#FFFFFF' }}
                      className="text-base font-bold"
                    >
                      Confirm
                    </Text>
                  )}
                </Pressable>

                {/* Legal Footnote */}
                <Text
                  style={{ color: c.textTertiary }}
                  className="text-[11px] text-center leading-relaxed px-2"
                >
                  By tapping Confirm, you'll create a Biblio Merchant Account and agree to our{' '}
                  <Text
                    onPress={() => {
                      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.75:3004';
                      Linking.openURL(`${baseUrl}/legal/terms`).catch(() => router.push('/support'));
                    }}
                    style={{ color: '#3B82F6' }}
                    className="font-medium underline"
                  >
                    terms
                  </Text>{' '}
                  and{' '}
                  <Text
                    onPress={() => {
                      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.75:3004';
                      Linking.openURL(`${baseUrl}/legal/privacy`).catch(() => router.push('/support'));
                    }}
                    style={{ color: '#3B82F6' }}
                    className="font-medium underline"
                  >
                    policies
                  </Text>
                  .
                </Text>
              </Animated.View>
            )}
          </Animated.View>

          <View className="flex-1" />

          <Text style={{ color: c.textTertiary }} className="text-xs text-center">
            Biblio Autonomous Commerce Platform • NDPA 2023 Compliant
          </Text>
        </View>
      </ScrollView>

      {/* ─── Modal 1: Why Biblio asks for your birthday (Matching User Image 2) ─── */}
      <Modal
        visible={isWhyBirthdayOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsWhyBirthdayOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          {/* Header */}
          <View
            style={{ backgroundColor: c.surface, borderBottomColor: c.border }}
            className="px-6 py-4 border-b flex-row items-center justify-between"
          >
            <View className="flex-1 pr-3">
              <Text style={{ color: c.textPrimary }} className="text-base font-bold" numberOfLines={1}>
                Birthday & Compliance
              </Text>
              <Text style={{ color: c.textTertiary }} className="text-[11px]">
                Nigeria Data Protection Act (NDPA 2023)
              </Text>
            </View>
            <Pressable
              onPress={() => setIsWhyBirthdayOpen(false)}
              style={{ backgroundColor: c.surfaceAlt }}
              className="w-8 h-8 rounded-full items-center justify-center active:opacity-70"
            >
              <X size={16} color={c.textPrimary} />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-6 pt-5" contentContainerStyle={{ paddingBottom: 60 }}>
            {/* Title */}
            <Text style={{ color: c.textPrimary }} className="text-2xl font-black tracking-tight mb-2">
              Why Biblio asks for your birthday for Merchant Accounts
            </Text>

            <View className="flex-row items-center space-x-2 mb-4">
              <View className="bg-emerald-500/15 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-emerald-500">
                  Verified Compliance Policy
                </Text>
              </View>
              <Text style={{ color: c.textTertiary }} className="text-xs">
                Updated recently · Regulatory Standards
              </Text>
            </View>

            {/* Regulatory Callout Box (Matching Image 2) */}
            <View
              style={{ backgroundColor: isDark ? '#1F2925' : '#F1F5F9', borderColor: c.border }}
              className="p-4 rounded-2xl border mb-6"
            >
              <Text style={{ color: c.textPrimary }} className="text-xs leading-relaxed">
                We collect your birthday under the{' '}
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
              <View className="flex-row items-start">
                <CheckCircle2 size={16} color={c.accent} style={{ marginTop: 2, marginRight: 10 }} />
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="text-xs font-bold mb-0.5">
                    Verify legal age & commercial capacity
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-[11px] leading-relaxed">
                    Under Nigerian contract law, autonomous negotiation agents and settlement
                    escrow accounts require an adult (18+) account holder who can legally execute
                    commercial agreements.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start">
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

              <View className="flex-row items-start">
                <Calendar size={16} color="#F59E0B" style={{ marginTop: 2, marginRight: 10 }} />
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="text-xs font-bold mb-0.5">
                    Payment gateway KYC compliance
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-[11px] leading-relaxed">
                    Paystack, Providus Bank, and Flutterwave require verified dates of birth before
                    activating merchant payouts and virtual settlement accounts.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start">
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

            {/* Privacy Promise Callout */}
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

            {/* Legal Contacts */}
            <View style={{ borderTopWidth: 1, borderColor: c.border }} className="pt-4 mb-6">
              <Text style={{ color: c.textTertiary }} className="text-[10px] font-bold uppercase mb-1">
                Data Controller & Privacy Contacts
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs">
                Data Controller: <Text className="font-bold text-white">Yemuel Oseghale</Text>
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
                Privacy Email:{' '}
                <Text style={{ color: c.accent }} className="font-bold">
                  oseghaleleonard39@gmail.com
                </Text>
              </Text>
            </View>

            <Pressable
              onPress={() => setIsWhyBirthdayOpen(false)}
              style={{ backgroundColor: c.accent }}
              className="py-3.5 rounded-2xl items-center justify-center active:opacity-80"
            >
              <Text
                style={{ color: isDark ? '#090A0C' : '#FFFFFF' }}
                className="font-bold text-sm"
              >
                Got It
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Modal 2: Dropdown Picker Sheet (Month / Day / Year) ─── */}
      <Modal
        visible={activePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <Pressable
          onPress={() => setActivePicker(null)}
          className="flex-1 bg-black/60 justify-end"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: c.surface, borderColor: c.border }}
            className="rounded-t-3xl border-t p-6 max-h-96"
          >
            <View className="flex-row items-center justify-between pb-3 border-b mb-3" style={{ borderColor: c.border }}>
              <Text style={{ color: c.textPrimary }} className="text-base font-bold capitalize">
                Select {activePicker}
              </Text>
              <Pressable onPress={() => setActivePicker(null)} className="p-1">
                <X size={18} color={c.textTertiary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-72">
              {activePicker === 'month' &&
                MONTHS.map((m) => {
                  const isSelected = selectedMonth === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => {
                        setSelectedMonth(m);
                        setActivePicker(null);
                      }}
                      style={{
                        backgroundColor: isSelected ? c.accentSoft : 'transparent',
                      }}
                      className="p-3.5 rounded-xl flex-row items-center justify-between active:opacity-70 mb-1"
                    >
                      <Text
                        style={{
                          color: isSelected ? c.accent : c.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        }}
                        className="text-sm"
                      >
                        {m}
                      </Text>
                      {isSelected && <CheckCircle2 size={16} color={c.accent} />}
                    </Pressable>
                  );
                })}

              {activePicker === 'day' &&
                DAYS.map((d) => {
                  const isSelected = selectedDay === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => {
                        setSelectedDay(d);
                        setActivePicker(null);
                      }}
                      style={{
                        backgroundColor: isSelected ? c.accentSoft : 'transparent',
                      }}
                      className="p-3.5 rounded-xl flex-row items-center justify-between active:opacity-70 mb-1"
                    >
                      <Text
                        style={{
                          color: isSelected ? c.accent : c.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        }}
                        className="text-sm"
                      >
                        {d}
                      </Text>
                      {isSelected && <CheckCircle2 size={16} color={c.accent} />}
                    </Pressable>
                  );
                })}

              {activePicker === 'year' &&
                YEARS.map((y) => {
                  const isSelected = selectedYear === y;
                  return (
                    <Pressable
                      key={y}
                      onPress={() => {
                        setSelectedYear(y);
                        setActivePicker(null);
                      }}
                      style={{
                        backgroundColor: isSelected ? c.accentSoft : 'transparent',
                      }}
                      className="p-3.5 rounded-xl flex-row items-center justify-between active:opacity-70 mb-1"
                    >
                      <Text
                        style={{
                          color: isSelected ? c.accent : c.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        }}
                        className="text-sm"
                      >
                        {y}
                      </Text>
                      {isSelected && <CheckCircle2 size={16} color={c.accent} />}
                    </Pressable>
                  );
                })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
