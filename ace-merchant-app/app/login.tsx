import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, ShieldCheck, ArrowLeft, MessageCircle } from 'lucide-react-native';
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

const OTP_LENGTH = 6;

export default function LoginScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const setAuth = useAuthStore(state => state.setAuth);
  const otpRefs = useRef<Array<TextInput | null>>([]);

  const code = otpDigits.join('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(val => val - 1), 1000);
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
      setError('Enter a valid WhatsApp business number');
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
        setAuth(res.data.merchantId, res.data.token);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code. Check and try again.');
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      otpRefs.current[0]?.focus();
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
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 pt-20 pb-8">
          {step === 'otp' && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Pressable
                onPress={() => {
                  setStep('phone');
                  setOtpDigits(Array(OTP_LENGTH).fill(''));
                  setError(null);
                }}
                style={{ backgroundColor: c.surface, borderColor: c.border }}
                className="w-10 h-10 rounded-full border items-center justify-center mb-6 active:opacity-70"
                hitSlop={10}
              >
                <ArrowLeft color={c.textPrimary} size={20} />
              </Pressable>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(500).springify()} className="items-center mb-10">
            <Animated.View
              style={[pulseStyle, { backgroundColor: c.accentSoft, borderColor: c.accent }]}
              className="w-16 h-16 rounded-2xl items-center justify-center mb-4 border"
            >
              <MessageCircle color={c.accent} size={30} strokeWidth={2} />
            </Animated.View>
            <Text style={{ color: c.textPrimary }} className="text-2xl font-bold tracking-tight">Biblio</Text>
            <Text style={{ color: c.textSecondary }} className="text-sm mt-1">Autonomous Commerce Engine</Text>
          </Animated.View>

          <Animated.View
            layout={Layout.springify()}
            entering={FadeInUp.duration(500).delay(100).springify()}
            style={{ backgroundColor: c.surface, borderColor: c.border }}
            className="border rounded-3xl p-6 shadow-sm"
          >
            {step === 'phone' ? (
              <Animated.View entering={FadeIn.duration(250)} key="phone-step">
                <Text style={{ color: c.textPrimary }} className="text-xl font-semibold mb-1">Welcome back</Text>
                <Text style={{ color: c.textSecondary }} className="text-sm mb-6 leading-5">
                  Sign in with the WhatsApp number linked to your store
                </Text>

                <Text style={{ color: c.textTertiary }} className="text-xs font-medium mb-2 ml-1">
                  WHATSAPP BUSINESS NUMBER
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
                    onChangeText={t => {
                      setPhone(t);
                      if (error) setError(null);
                    }}
                    maxLength={13}
                    returnKeyType="done"
                    onSubmitEditing={handleSendOTP}
                  />
                </View>

                {error && (
                  <Animated.Text entering={FadeIn.duration(150)} style={{ color: c.danger }} className="text-xs mt-2 ml-1">
                    {error}
                  </Animated.Text>
                )}

                <Pressable
                  onPress={handleSendOTP}
                  disabled={isLoading || !isPhoneValid}
                  style={{ backgroundColor: isLoading || !isPhoneValid ? c.border : c.accent }}
                  className="h-14 rounded-2xl items-center justify-center mt-6 flex-row active:opacity-80 shadow-sm"
                >
                  {isLoading ? (
                    <ActivityIndicator color={isDark ? '#090A0C' : '#FFFFFF'} />
                  ) : (
                    <Text style={{ color: isDark ? '#090A0C' : '#FFFFFF' }} className="text-base font-bold">Send code</Text>
                  )}
                </Pressable>

                <Text style={{ color: c.textTertiary }} className="text-xs text-center mt-5 leading-4">
                  We'll send a 6-digit code via WhatsApp to verify it's you
                </Text>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(250)} key="otp-step">
                <View style={{ backgroundColor: c.accentSoft }} className="w-12 h-12 rounded-xl items-center justify-center mb-4">
                  <ShieldCheck color={c.accent} size={22} />
                </View>
                <Text style={{ color: c.textPrimary }} className="text-xl font-semibold mb-1">Enter your code</Text>
                <Text style={{ color: c.textSecondary }} className="text-sm mb-6 leading-5">
                  Sent via WhatsApp to{' '}
                  <Text style={{ color: c.textPrimary }} className="font-medium">
                    {formatPhoneDisplay(phone)}
                  </Text>
                </Text>

                <View className="flex-row justify-between mb-2">
                  {otpDigits.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={ref => (otpRefs.current[i] = ref)}
                      value={digit}
                      onChangeText={t => handleOtpChange(t, i)}
                      onKeyPress={e => handleOtpKeyPress(e, i)}
                      keyboardType="number-pad"
                      maxLength={OTP_LENGTH}
                      style={{ 
                        backgroundColor: c.bg,
                        borderColor: error ? c.danger : digit ? c.accent : c.border,
                        color: c.textPrimary 
                      }}
                      className="w-12 h-14 rounded-xl text-center text-xl font-bold border"
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {error && (
                  <Animated.Text entering={FadeIn.duration(150)} style={{ color: c.danger }} className="text-xs mt-2 ml-1">
                    {error}
                  </Animated.Text>
                )}

                {isLoading && (
                  <View className="flex-row items-center justify-center mt-5">
                    <ActivityIndicator color={c.accent} />
                    <Text style={{ color: c.textSecondary }} className="text-sm ml-2">Verifying...</Text>
                  </View>
                )}

                <View className="flex-row items-center justify-center mt-6">
                  <Text style={{ color: c.textTertiary }} className="text-sm">Didn't get it? </Text>
                  <Pressable onPress={handleResend} disabled={resendCooldown > 0}>
                    <Text style={{ color: resendCooldown > 0 ? c.textTertiary : c.accent }} className="text-sm font-semibold">
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}
          </Animated.View>

          <View className="flex-1" />

          <Text style={{ color: c.textTertiary }} className="text-xs text-center">
            By continuing, you agree to Biblio's Terms & Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
