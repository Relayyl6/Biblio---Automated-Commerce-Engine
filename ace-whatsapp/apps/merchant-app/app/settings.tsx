// merchant-app/app/settings.tsx — Seller Voice & Settings.
//
// THE screen that closes the "seller's voice is ignored" gap from the product
// side: the merchant edits tone, policies, delivery and dialect here, it PATCHes
// merchant-api, and on the very next customer message the negotiator's system
// prompt speaks in exactly these words (agentLoop.buildSystemPrompt).

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, type Dialect, type Merchant } from "@/api/client";
import { MERCHANT_ID } from "./_layout";

const DIALECTS: Dialect[] = ["pidgin", "yoruba", "igbo", "hausa", "english"];

export default function Settings() {
  const [m, setM] = useState<Merchant | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api.getMerchant(MERCHANT_ID).then(setM).catch((e) => setStatus(String(e)));
  }, []);

  if (!m) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await api.updateMerchant(MERCHANT_ID, {
        name: m.name,
        tone_guide: m.tone_guide,
        business_policies: m.business_policies,
        delivery_info: m.delivery_info,
        dialect: m.dialect,
      });
      setStatus("Saved — your agent now speaks with these settings.");
    } catch (e) {
      setStatus(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Field label="Shop name" value={m.name} onChange={(v) => setM({ ...m, name: v })} />
      <Field
        label="Voice / persona (how the AI should sound)"
        value={m.tone_guide ?? ""}
        onChange={(v) => setM({ ...m, tone_guide: v })}
        multiline
      />
      <Field
        label="Business policies (returns, min order, hours…)"
        value={m.business_policies ?? ""}
        onChange={(v) => setM({ ...m, business_policies: v })}
        multiline
      />
      <Field
        label="Delivery info the AI may quote"
        value={m.delivery_info ?? ""}
        onChange={(v) => setM({ ...m, delivery_info: v })}
        multiline
      />

      <Text style={styles.label}>Dialect</Text>
      <View style={styles.chips}>
        {DIALECTS.map((d) => (
          <Pressable
            key={d}
            style={[styles.chip, m.dialect === d && styles.chipActive]}
            onPress={() => setM({ ...m, dialect: d })}
          >
            <Text style={[styles.chipText, m.dialect === d && styles.chipTextActive]}>{d}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.save} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
      </Pressable>
      {status && <Text style={styles.status}>{status}</Text>}
    </ScrollView>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.multiline]}
        value={props.value}
        onChangeText={props.onChange}
        multiline={props.multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f4f6f5" },
  content: { padding: 20 },
  label: { fontSize: 13, fontWeight: "700", color: "#5a6b62", marginBottom: 6 },
  input: { backgroundColor: "#fff", borderRadius: 10, padding: 12, fontSize: 15, color: "#0b3a22" },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: "#0b6b3a", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: { backgroundColor: "#0b6b3a" },
  chipText: { color: "#0b6b3a", fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  save: { backgroundColor: "#0b6b3a", borderRadius: 12, padding: 16, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  status: { marginTop: 12, color: "#0b6b3a" },
});
