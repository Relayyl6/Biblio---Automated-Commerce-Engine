// merchant-app/app/index.tsx — Command Center (Home).
//
// Per the README design philosophy: "The merchant's dashboard should be empty
// most of the time." This surfaces the exception queue + quick stats and routes
// into Catalog and Seller Voice. Live order velocity / cash-flow widgets read
// from analytics in Phase 2; here they show the shape with placeholder values.

import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api, type Product } from "@/api/client";
import { MERCHANT_ID } from "./_layout";

export default function CommandCenter() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProducts(MERCHANT_ID)
      .then(setProducts)
      .catch((e) => setError(String(e)));
  }, []);

  const lowStock = (products ?? []).filter((p) => p.active && p.stock > 0 && p.stock <= 5);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Good day 👋</Text>
      <Text style={styles.sub}>ACE is handling your conversations. Here's what needs you.</Text>

      <View style={styles.statRow}>
        <Stat label="Live catalog" value={products ? String(products.filter((p) => p.active).length) : "—"} />
        <Stat label="Low stock" value={String(lowStock.length)} />
      </View>

      <Text style={styles.section}>Exception queue</Text>
      {lowStock.length === 0 ? (
        <Card><Text style={styles.muted}>Nothing needs you right now. 🎉</Text></Card>
      ) : (
        lowStock.map((p) => (
          <Card key={p.sku}>
            <Text style={styles.cardTitle}>{p.name}</Text>
            <Text style={styles.muted}>Only {p.stock} left — restock or let scarcity sell it.</Text>
          </Card>
        ))
      )}

      {error && <Card><Text style={styles.error}>{error}</Text></Card>}

      <Text style={styles.section}>Manage</Text>
      <Link href="/catalog" style={styles.link}>→ Catalog & WhatsApp sync</Link>
      <Link href="/settings" style={styles.link}>→ Seller voice, policies & delivery</Link>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f4f6f5" },
  content: { padding: 20, gap: 8 },
  greeting: { fontSize: 26, fontWeight: "800", color: "#0b3a22" },
  sub: { fontSize: 15, color: "#5a6b62", marginBottom: 12 },
  statRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  statValue: { fontSize: 28, fontWeight: "800", color: "#0b6b3a" },
  statLabel: { fontSize: 13, color: "#5a6b62" },
  section: { fontSize: 13, fontWeight: "700", color: "#5a6b62", marginTop: 16, textTransform: "uppercase" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginTop: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0b3a22" },
  muted: { color: "#5a6b62" },
  error: { color: "#b00020" },
  link: { color: "#0b6b3a", fontSize: 16, fontWeight: "600", paddingVertical: 10 },
});
