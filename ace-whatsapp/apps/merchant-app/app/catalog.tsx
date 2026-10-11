// merchant-app/app/catalog.tsx — Inventory Oracle (catalog view + WhatsApp sync).
//
// Lists the products the AI sells from, and offers one-tap "Sync from WhatsApp
// catalog" which calls merchant-api → catalog-sync. This is the self-serve path
// that replaces hand-written SQL: the seller curates in Meta Commerce Manager,
// taps sync, and ACE mirrors it.

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, type Product } from "@/api/client";
import { MERCHANT_ID } from "./_layout";

export default function Catalog() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.listProducts(MERCHANT_ID).then(setProducts).catch((e) => setError(String(e)));
  }, []);

  useEffect(load, [load]);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const r = await api.syncCatalog(MERCHANT_ID);
      Alert.alert("Sync complete", `Fetched ${r.fetched}, updated ${r.upserted} products.`);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.syncBtn} onPress={sync} disabled={syncing}>
        {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.syncText}>↻ Sync from WhatsApp catalog</Text>}
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}

      {products === null ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        products.map((p) => (
          <View key={p.sku} style={[styles.card, !p.active && styles.inactive]}>
            <View style={styles.cardHead}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.price}>₦{Number(p.price).toLocaleString()}</Text>
            </View>
            <Text style={styles.meta}>
              {p.category ?? "Uncategorised"} · stock {p.stock} · {p.source}
            </Text>
            {p.description ? <Text style={styles.desc}>{p.description}</Text> : null}
            {p.tags?.length ? <Text style={styles.tags}>{p.tags.map((t) => `#${t}`).join("  ")}</Text> : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f4f6f5" },
  content: { padding: 20, gap: 8 },
  syncBtn: { backgroundColor: "#0b6b3a", borderRadius: 12, padding: 14, alignItems: "center" },
  syncText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: "#b00020", marginTop: 8 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginTop: 8 },
  inactive: { opacity: 0.5 },
  cardHead: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontSize: 16, fontWeight: "700", color: "#0b3a22", flex: 1 },
  price: { fontSize: 16, fontWeight: "800", color: "#0b6b3a" },
  meta: { color: "#5a6b62", fontSize: 13, marginTop: 2 },
  desc: { color: "#33433b", marginTop: 8 },
  tags: { color: "#0b6b3a", marginTop: 8, fontSize: 12 },
});
