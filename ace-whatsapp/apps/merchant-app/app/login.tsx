// merchant-app/app/login.tsx
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import * as SecureStore from 'expo-secure-store';
import { useRouter } from "expo-router";
import { api } from "../src/api/client";

// Demo merchant ID for MVP
const DEMO_MERCHANT_ID = "11111111-1111-1111-1111-111111111111";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSendOtp = async () => {
    if (!phone) return Alert.alert("Error", "Enter a valid phone number.");
    setLoading(true);
    try {
      await api.sendOtp(phone);
      setStep("otp");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) return Alert.alert("Error", "Enter the OTP code.");
    setLoading(true);
    try {
      const res = await api.verifyOtp(phone, otp, DEMO_MERCHANT_ID);
      await SecureStore.setItemAsync("ace_merchant_token", res.token);
      await api.track("merchant_login", { globalBuyerId: res.globalBuyerId });
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={S.container}>
      <Text style={S.title}>ACE</Text>
      <Text style={S.subtitle}>Autonomous Commerce Engine</Text>

      <View style={S.card}>
        {step === "phone" ? (
          <>
            <Text style={S.label}>WhatsApp Business Number</Text>
            <TextInput
              style={S.input}
              placeholder="+2348000000000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TouchableOpacity style={S.btn} onPress={handleSendOtp} disabled={loading}>
              <Text style={S.btnText}>{loading ? "Sending..." : "Send Verification Code"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={S.label}>Enter the 6-digit code</Text>
            <TextInput
              style={S.input}
              placeholder="123456"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={S.btn} onPress={handleVerifyOtp} disabled={loading}>
              <Text style={S.btnText}>{loading ? "Verifying..." : "Verify & Login"}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f7f5", justifyContent: "center", padding: 24 },
  title: { fontSize: 42, fontWeight: "900", color: "#0b6b3a", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 16, color: "#5a6b62", textAlign: "center", marginBottom: 48 },
  card: { backgroundColor: "#fff", padding: 24, borderRadius: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
  label: { fontSize: 14, fontWeight: "600", color: "#0b3a22", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#e3e8e5", borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 24, backgroundColor: "#fbfcfb" },
  btn: { backgroundColor: "#0b6b3a", padding: 16, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" }
});
