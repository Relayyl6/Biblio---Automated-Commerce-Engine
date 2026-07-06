import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { LayoutDashboard, Users, Settings, LogOut } from "lucide-react";
import { api, type Merchant, type Product } from "./api";

const DEMO_ID = "11111111-1111-1111-1111-111111111111";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<AuthGuard><DashboardLayout /></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const token = localStorage.getItem("ace_admin_token");

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  return token ? <>{children}</> : null;
}

function Login() {
  const [merchantId, setMerchantId] = useState(DEMO_ID);
  const navigate = useNavigate();

  const handleLogin = async () => {
    const res = await fetch("http://localhost:3004/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId, role: "admin" })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem("ace_admin_token", data.token);
      navigate("/");
    }
  };

  return (
    <div style={{ ...S.page, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ ...S.card, width: 400, textAlign: 'center' }}>
        <h2>ACE Admin Login</h2>
        <input style={{...S.input, width: '100%', marginBottom: 16}} value={merchantId} onChange={e => setMerchantId(e.target.value)} placeholder="Admin / Merchant ID" />
        <button style={{...S.btn, width: '100%'}} onClick={handleLogin}>Authenticate</button>
      </div>
    </div>
  );
}

function DashboardLayout() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f7f5' }}>
      <aside style={{ width: 250, backgroundColor: '#0b3a22', color: 'white', padding: 20 }}>
        <h2>ACE Admin</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 40 }}>
          <Link to="/" style={S.navLink}><LayoutDashboard size={18} /> Data Intelligence</Link>
          <Link to="/merchants" style={S.navLink}><Users size={18} /> Merchants</Link>
          <button style={{...S.navLink, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer'}} onClick={() => {
            localStorage.removeItem("ace_admin_token");
            navigate("/login");
          }}><LogOut size={18} /> Logout</button>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 40 }}>
        <Routes>
          <Route path="/" element={<DataIntelligenceDashboard />} />
          <Route path="/merchants" element={<MerchantManagement />} />
        </Routes>
      </main>
    </div>
  );
}

function DataIntelligenceDashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("http://localhost:3004/telemetry/dashboard", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("ace_admin_token")}` }
    })
      .then(r => r.json())
      .then(setData);
  }, []);

  if (!data) return <p>Loading metrics...</p>;

  const COLORS = ['#0b6b3a', '#2a9d8f', '#e9c46a', '#e76f51'];

  return (
    <div>
      <h1 style={{ color: '#0b3a22', marginBottom: 24 }}>Data Intelligence</h1>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ ...S.card, flex: 2 }}>
          <h3>Network Price Elasticity Signal</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.elasticity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f0" />
                <XAxis dataKey="name" stroke="#5a6b62" />
                <YAxis domain={[0, 1]} stroke="#5a6b62" />
                <ChartTooltip />
                <Line type="monotone" dataKey="score" stroke="#0b6b3a" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ ...S.card, flex: 1 }}>
          <h3>Negotiation Outcomes</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.outcomes} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {data.outcomes.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function MerchantManagement() {
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
    <div>
      <h1 style={{ color: '#0b3a22', marginBottom: 24 }}>Merchant Management</h1>
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
              <tr><th style={S.th}>SKU</th><th style={S.th}>Name</th><th style={S.th}>Price</th><th style={S.th}>Stock</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.sku} style={{ opacity: p.active ? 1 : 0.5 }}>
                  <td style={S.td}>{p.sku}</td>
                  <td style={S.td}>{p.name}</td>
                  <td style={S.td}>₦{Number(p.price).toLocaleString()}</td>
                  <td style={S.td}>{p.stock}</td>
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
  page: { fontFamily: "system-ui, sans-serif", color: "#0b3a22", backgroundColor: '#f4f7f5' },
  card: { background: "#fff", border: "1px solid #e3e8e5", borderRadius: 14, padding: 24, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#5a6b62", marginBottom: 6 },
  input: { flex: 1, padding: 10, borderRadius: 8, border: "1px solid #cdd6d1", fontSize: 14 },
  btn: { background: "#0b6b3a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700 },
  btnGhost: { background: "#f4f7f5", color: "#0b6b3a", border: "1px solid #0b6b3a", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700 },
  msg: { color: "#5a6b62", marginTop: 10 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", borderBottom: "2px solid #e3e8e5", padding: "6px 8px", color: "#5a6b62" },
  td: { borderBottom: "1px solid #eef2f0", padding: "6px 8px" },
  navLink: { color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, transition: 'background 0.2s' }
};
