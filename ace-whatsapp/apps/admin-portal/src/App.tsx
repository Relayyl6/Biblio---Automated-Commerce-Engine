// admin-portal/src/App.tsx — Merchant Management (the ACE-team ops view).
//
// Phase-1 slice of the spec: look up a merchant, see their catalog + seller
// context, onboard a new merchant, and trigger a WhatsApp catalog sync. The
// other spec views (AI Performance, System Health, Billing) read from analytics
// + queue depth in Phase 2.

import { useState } from "react";
import { api, type Merchant, type Product } from "./api";

const DEMO_ID = "11111111-1111-1111-1111-111111111111";

export function App() {
  const [id, setId] = useState(DEMO_ID);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [msg, setMsg] = useState<string>("");

  const load = async () => {
    setMsg("Loading…");
    try {
      const [m, p] = await Promise.all([api.getMerchant(id), api.listProducts(id)]);
      setMerchant(m);
      setProducts(p);
      setMsg("");
    } catch (e) {
      setMsg(String(e));
    }
  };

  const sync = async () => {
    setMsg("Syncing catalog…");
    try {
      const r = await api.syncCatalog(id);
      setMsg(`Synced: fetched ${r.fetched}, upserted ${r.upserted}.`);
      const p = await api.listProducts(id);
      setProducts(p);
    } catch (e) {
      setMsg(String(e));
    }
  };

  return (
    <div style={S.page}>
      <header style={S.header}>
        <strong>ACE · Admin Portal</strong>
        <span style={S.badge}>Merchant Management</span>
      </header>

      <section style={S.card}>
        <label style={S.label}>Merchant ID</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={S.input} value={id} onChange={(e) => setId(e.target.value)} />
          <button style={S.btn} onClick={load}>Load</button>
          <button style={S.btnGhost} onClick={sync}>↻ Sync catalog</button>
        </div>
        {msg && <p style={S.msg}>{msg}</p>}
      </section>

      {merchant && (
        <section style={S.card}>
          <h3 style={{ margin: "0 0 8px" }}>{merchant.name}</h3>
          <Row k="Phone number id" v={merchant.phone_number_id} />
          <Row k="Dialect" v={merchant.dialect} />
          <Row k="Catalog id" v={merchant.whatsapp_catalog_id ?? "—"} />
          <Row k="Voice" v={merchant.tone_guide ?? "—"} />
          <Row k="Policies" v={merchant.business_policies ?? "—"} />
          <Row k="Delivery" v={merchant.delivery_info ?? "—"} />
        </section>
      )}

      {products.length > 0 && (
        <section style={S.card}>
          <h3 style={{ margin: "0 0 12px" }}>Catalog ({products.length})</h3>
          <table style={S.table}>
            <thead>
              <tr><th style={S.th}>SKU</th><th style={S.th}>Name</th><th style={S.th}>Price</th><th style={S.th}>Stock</th><th style={S.th}>Source</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.sku} style={{ opacity: p.active ? 1 : 0.5 }}>
                  <td style={S.td}>{p.sku}</td>
                  <td style={S.td}>{p.name}</td>
                  <td style={S.td}>₦{Number(p.price).toLocaleString()}</td>
                  <td style={S.td}>{p.stock}</td>
                  <td style={S.td}>{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "4px 0" }}>
      <span style={{ width: 140, color: "#5a6b62" }}>{k}</span>
      <span style={{ flex: 1 }}>{v}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: "system-ui, sans-serif", maxWidth: 860, margin: "0 auto", padding: 24, color: "#0b3a22" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  badge: { background: "#0b6b3a", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12 },
  card: { background: "#fff", border: "1px solid #e3e8e5", borderRadius: 14, padding: 18, marginBottom: 16 },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#5a6b62", marginBottom: 6 },
  input: { flex: 1, padding: 10, borderRadius: 8, border: "1px solid #cdd6d1", fontSize: 14 },
  btn: { background: "#0b6b3a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700 },
  btnGhost: { background: "#fff", color: "#0b6b3a", border: "1px solid #0b6b3a", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700 },
  msg: { color: "#5a6b62", marginTop: 10 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", borderBottom: "2px solid #e3e8e5", padding: "6px 8px", color: "#5a6b62" },
  td: { borderBottom: "1px solid #eef2f0", padding: "6px 8px" },
};
