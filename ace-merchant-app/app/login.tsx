import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
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
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/api/client';
import { colors } from './../theme';
import { InlineLoadingDots } from '../src/components/PulsingSkeleton';

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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

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

  const isPhoneValid = phone.replace(/\D/g, '').length >= 10;

  const handleSendOTP = async () => {
    setError(null);
    if (!isPhoneValid) {
      setError('Enter a valid phone number');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/auth/merchant/login', { phone: phone.replace(/\D/g, '') });
      setStep('otp');
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 350);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    otpRefs.current[0]?.focus();
    await handleSendOTP();
  };

  const handleVerifyOTP = async () => {
    setError(null);
    if (code.length !== OTP_LENGTH) return;
    setIsLoading(true);
    try {
      const res = await api.post('/auth/merchant/verify', {
        phone: phone.replace(/\D/g, ''),
        code,
      });

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
      <View className="px-6 pt-14 pb-2 flex-row items-center justify-between z-10">
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
          {/* Logo Brand Header */}
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            className="items-center mb-6"
          >
            <Animated.View
              style={[pulseStyle, { backgroundColor: c.accentSoft, borderColor: c.accent }]}
              className="w-16 h-16 rounded-2xl items-center justify-center mb-3 border shadow-sm"
            >
              <MessageCircle color={c.accent} size={32} strokeWidth={2.2} />
            </Animated.View>
            <Text style={{ color: c.textPrimary }} className="text-2xl font-black tracking-tight">
              Biblio
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
              Autonomous Commerce Engine
            </Text>
          </Animated.View>

          {/* ── Main Form Card ── */}
          <Animated.View
            layout={Layout.springify()}
            entering={FadeInUp.duration(400).springify()}
            style={{ backgroundColor: c.surface, borderColor: c.border }}
            className="border rounded-3xl p-6 shadow-sm mb-6"
          >
            {/* STEP 1: Phone Entry */}
            {step === 'phone' && (
              <Animated.View entering={FadeIn.duration(200)} key="phone-step">
                <Text style={{ color: c.textPrimary }} className="text-xl font-bold mb-1">
                  Welcome to Biblio
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-xs mb-5 leading-relaxed">
                  Sign in or create your store with your active phone number
                </Text>

                <Text
                  style={{ color: c.textTertiary }}
                  className="text-[11px] font-bold uppercase tracking-wider mb-2 ml-1"
                >
                  Phone Number
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
                  <Animated.Text
                    entering={FadeIn.duration(150)}
                    style={{ color: c.danger }}
                    className="text-xs mt-2 ml-1"
                  >
                    {error}
                  </Animated.Text>
                )}

                <Pressable
                  onPress={handleSendOTP}
                  disabled={isLoading || !isPhoneValid}
                  style={{
                    backgroundColor: isLoading || !isPhoneValid ? c.border : c.accent,
                  }}
                  className="h-14 rounded-2xl items-center justify-center mt-6 flex-row active:opacity-80 shadow-sm"
                >
                  {isLoading ? (
                    <InlineLoadingDots color={isDark ? '#090A0C' : '#FFFFFF'} />
                  ) : (
                    <Text
                      style={{ color: isDark ? '#090A0C' : '#FFFFFF' }}
                      className="text-base font-bold"
                    >
                      Send Verification Code
                    </Text>
                  )}
                </Pressable>

                <Text
                  style={{ color: c.textTertiary }}
                  className="text-[11px] text-center mt-4 leading-4"
                >
                  We'll send a 6-digit SMS verification code to this device
                </Text>
              </Animated.View>
            )}

            {/* STEP 2: OTP Verification */}
            {step === 'otp' && (
              <Animated.View entering={FadeIn.duration(200)} key="otp-step">
                <View
                  style={{ backgroundColor: c.accentSoft }}
                  className="w-12 h-12 rounded-xl items-center justify-center mb-3"
                >
                  <ShieldCheck color={c.accent} size={22} />
                </View>
                <Text style={{ color: c.textPrimary }} className="text-xl font-bold mb-1">
                  Enter 6-Digit Code
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-xs mb-5 leading-5">
                  Sent via SMS to{' '}
                  <Text style={{ color: c.textPrimary }} className="font-bold">
                    {formatPhoneDisplay(phone)}
                  </Text>
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

                {error && (
                  <Animated.Text
                    entering={FadeIn.duration(150)}
                    style={{ color: c.danger }}
                    className="text-xs mt-2 ml-1"
                  >
                    {error}
                  </Animated.Text>
                )}

                {isLoading && (
                  <View className="flex-row items-center justify-center mt-5">
                    <InlineLoadingDots color={c.accent} />
                    <Text style={{ color: c.textSecondary }} className="text-xs ml-2 font-medium">
                      Verifying with carrier network...
                    </Text>
                  </View>
                )}

                <View className="flex-row items-center justify-center mt-6">
                  <Text style={{ color: c.textTertiary }} className="text-xs">
                    Didn't get the code?{' '}
                  </Text>
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
                    onPress={() => router.push('/support')}
                    style={{ color: '#3B82F6' }}
                    className="font-medium underline"
                  >
                    terms
                  </Text>{' '}
                  and{' '}
                  <Text
                    onPress={() => router.push('/support')}
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
