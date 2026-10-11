import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { LayoutDashboard, Users, LogOut, Smartphone, Zap, CheckCircle2, MessageSquare, RefreshCw, ShoppingBag, ShieldCheck } from "lucide-react";
import { api, type Merchant, type Product, type StatusLogEntry, type QueueItem, type VendorSummary } from "./api";

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
  const token = localStorage.getItem("ace_admin_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function Login() {
  const [merchantId, setMerchantId] = useState(DEMO_ID);
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
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
    } catch (e) {
      alert("Login error: " + String(e));
    }
  };

  return (
    <div style={{ ...S.page, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ ...S.card, width: 420, textAlign: 'center', padding: 32 }}>
        <div style={{ display: 'inline-flex', padding: 12, borderRadius: 16, background: '#0b3a22', color: '#fff', marginBottom: 16 }}>
          <Zap size={28} />
        </div>
        <h2 style={{ color: '#0b3a22', margin: '0 0 8px' }}>ACE Admin Portal</h2>
        <p style={{ color: '#5a6b62', fontSize: 14, margin: '0 0 24px' }}>Automated Commerce Engine Control Plane</p>
        <input
          style={{ ...S.input, width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
          value={merchantId}
          onChange={e => setMerchantId(e.target.value)}
          placeholder="Admin / Merchant ID"
        />
        <button style={{ ...S.btn, width: '100%', padding: '12px 16px' }} onClick={handleLogin}>Authenticate</button>
      </div>
    </div>
  );
}

function DashboardLayout() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f7f5' }}>
      <aside style={{ width: 260, backgroundColor: '#0b3a22', color: 'white', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={24} color="#2a9d8f" />
          <h2 style={{ margin: 0, fontSize: 20, letterSpacing: -0.5 }}>ACE Admin</h2>
        </div>
        <span style={{ fontSize: 12, color: '#8fb89e', marginTop: 4 }}>Merchant & WhatsApp Engine</span>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 40, flex: 1 }}>
          <Link to="/" style={S.navLink}><LayoutDashboard size={18} /> Data Intelligence</Link>
          <Link to="/vendor-status" style={S.navLink}><Smartphone size={18} /> WhatsApp Auto-Pairing</Link>
          <Link to="/merchants" style={S.navLink}><Users size={18} /> Merchants & Catalog</Link>
        </nav>

        <button style={{ ...S.navLink, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#e76f51', padding: '10px 14px' }} onClick={() => {
          localStorage.removeItem("ace_admin_token");
          navigate("/login");
        }}><LogOut size={18} /> Logout</button>
      </aside>
      <main style={{ flex: 1, padding: 40, overflowY: 'auto' }}>
        <Routes>
          <Route path="/" element={<DataIntelligenceDashboard />} />
          <Route path="/vendor-status" element={<VendorStatusPanel />} />
          <Route path="/merchants" element={<MerchantManagement />} />
        </Routes>
      </main>
    </div>
  );
}

function DataIntelligenceDashboard() {
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:3004/telemetry/dashboard", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("ace_admin_token")}` }
    })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem("ace_admin_token");
          navigate("/login");
          return null;
        }
        return r.json();
      })
      .then(d => {
        if (d && !d.error) setData(d);
      })
      .catch(console.error);
  }, [navigate]);

  if (!data) return <p style={{ color: '#5a6b62' }}>Loading metrics...</p>;

  const COLORS = ['#0b6b3a', '#2a9d8f', '#e9c46a', '#e76f51'];

  return (
    <div>
      <h1 style={{ color: '#0b3a22', marginBottom: 24, fontSize: 28 }}>Data Intelligence & Telemetry</h1>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ ...S.card, flex: 2 }}>
          <h3 style={{ margin: '0 0 16px', color: '#0b3a22' }}>Network Price Elasticity Signal</h3>
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
          <h3 style={{ margin: '0 0 16px', color: '#0b3a22' }}>Negotiation Outcomes</h3>
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

// ─── Vendor Status & Auto-Provisioning Panel ──────────────────────────────────

function VendorStatusPanel() {
  const [vendorList, setVendorList] = useState<VendorSummary[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [status, setStatus] = useState<{ dbStatus: string; inMemory?: boolean; businessLineNumber?: string | null } | null>(null);
  const [log, setLog] = useState<StatusLogEntry[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-provisioning form state
  const [autoPhone, setAutoPhone] = useState("234");
  const [merchantName, setMerchantName] = useState("");
  const [dialect, setDialect] = useState("pidgin");
  const [pairCode, setPairCode] = useState("");

  const refreshVendors = async () => {
    try {
      const list = await api.listVendors();
      setVendorList(list || []);
      if (list && list.length > 0 && !selectedVendorId) {
        setSelectedVendorId(list[0].vendor_id);
        loadVendorData(list[0].vendor_id);
      }
    } catch (e) {
      console.warn("Failed to list vendors", e);
    }
  };

  useEffect(() => {
    refreshVendors();
  }, []);

  const loadVendorData = async (vId: string) => {
    if (!vId) return;
    setSelectedVendorId(vId);
    setLoading(true);
    try {
      const [s, l, q] = await Promise.all([
        api.getVendorStatus(vId).catch(() => null),
        api.getStatusLog(vId).catch(() => []),
        api.getQueue(vId).catch(() => []),
      ]);
      if (s) setStatus(s);
      setLog(l || []);
      setQueue(q || []);
    } catch (e) {
      setMsg("Error loading vendor: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Instant Auto-Provisioning & Pairing
  const handleAutoProvision = async () => {
    const cleanPhone = autoPhone.replace(/^\+/, "").replace(/\s/g, "");
    if (!/^\d{11,15}$/.test(cleanPhone)) {
      setMsg("⚠️ Invalid phone format. Please enter a valid WhatsApp phone number with country code (e.g. 2348012345678)");
      return;
    }

    setLoading(true);
    setMsg("⚡ Auto-provisioning merchant, vendor, pricing rules, and generating WhatsApp code...");
    setPairCode("");

    try {
      const res = await api.autoPair({
        phoneNumber: cleanPhone,
        merchantName: merchantName.trim() || undefined,
        dialect: dialect || "pidgin",
      });

      if (res.ok && res.code) {
        setPairCode(res.code);
        if (res.vendorId) {
          setSelectedVendorId(res.vendorId);
          loadVendorData(res.vendorId);
        }
        await refreshVendors();
        setMsg(`✅ Auto-provisioned successfully! Enter the 8-digit code below into WhatsApp.`);

        // Auto-poll status every 4s for 60s
        const pollId = setInterval(() => {
          if (res.vendorId) loadVendorData(res.vendorId);
        }, 4000);
        setTimeout(() => clearInterval(pollId), 60000);
      } else {
        setMsg("❌ Provisioning error: " + (res.error || "Unknown"));
      }
    } catch (e) {
      setMsg("❌ Provisioning failed: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  const triggerCron = async () => {
    setMsg("🚀 Triggering Status posting cron...");
    try {
      const res = await api.triggerStatusCron();
      if (res.ok) {
        setMsg("✅ Status cron executed! Refreshing logs in 3s...");
        setTimeout(() => {
          if (selectedVendorId) loadVendorData(selectedVendorId);
        }, 3000);
      }
    } catch (e) {
      setMsg("Error triggering cron: " + String(e));
    }
  };

  const approve = async (queueId: string) => {
    if (!selectedVendorId) return;
    setMsg("Approving...");
    try {
      await api.approveQueueItem(selectedVendorId, queueId);
      const q = await api.getQueue(selectedVendorId);
      setQueue(q);
      setMsg("Approved ✅");
    } catch (e) {
      setMsg("Approval error: " + String(e));
    }
  };

  const sessionColor = (dbStatus?: string) => {
    if (dbStatus === "connected") return "#0b6b3a";
    if (dbStatus === "reconnecting") return "#e9c46a";
    if (dbStatus === "logged_out") return "#e76f51";
    return "#5a6b62";
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0b3a22", margin: "0 0 6px", fontSize: 28 }}>WhatsApp Business Line & Auto-Provisioning</h1>
          <p style={{ color: "#5a6b62", margin: 0, fontSize: 14 }}>
            Instant zero-config onboarding: supply any phone number to provision merchant identity, pricing rules, dialect, and WhatsApp socket.
          </p>
        </div>
        <button style={S.btnGhost} onClick={refreshVendors}><RefreshCw size={16} /> Refresh Directory</button>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith("❌") ? "#fce8e6" : msg.startsWith("⚠️") ? "#fef3d6" : "#e6f4ea", color: msg.startsWith("❌") ? "#c5221f" : msg.startsWith("⚠️") ? "#b06000" : "#137333", padding: 14, borderRadius: 10, marginBottom: 24, fontWeight: 600, border: "1px solid rgba(0,0,0,0.06)" }}>
          {msg}
        </div>
      )}

      {/* ── 1-Step Auto-Provisioning Card ── */}
      <section style={{ ...S.card, border: "2px solid #0b6b3a", background: "linear-gradient(180deg, #ffffff 0%, #f6faf7 100%)" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#0b6b3a', color: 'white', padding: 8, borderRadius: 10 }}>
            <Zap size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#0b3a22', fontSize: 18 }}>Instant 1-Step WhatsApp Auto-Provisioning</h3>
            <span style={{ fontSize: 13, color: '#5a6b62' }}>Automatically provisions PostgreSQL merchant ID, vendor ID, pricing rules, and issues WhatsApp pairing code</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr auto', gap: 12, alignItems: 'flex-end', marginTop: 16 }}>
          <div>
            <label style={S.label}>WhatsApp Phone Number (E.164)</label>
            <input
              style={S.input}
              value={autoPhone}
              onChange={e => setAutoPhone(e.target.value)}
              placeholder="e.g. 2349064982841"
            />
          </div>
          <div>
            <label style={S.label}>Store / Merchant Name (Optional)</label>
            <input
              style={S.input}
              value={merchantName}
              onChange={e => setMerchantName(e.target.value)}
              placeholder="e.g. Biblio Store"
            />
          </div>
          <div>
            <label style={S.label}>Cultural Dialect Voice</label>
            <select
              style={S.select}
              value={dialect}
              onChange={e => setDialect(e.target.value)}
            >
              <option value="pidgin">Nigerian Pidgin (Default)</option>
              <option value="yoruba">Yoruba-inflected</option>
              <option value="igbo">Igbo-inflected</option>
              <option value="hausa">Hausa-inflected</option>
              <option value="english">Nigerian English</option>
            </select>
          </div>
          <button
            style={{ ...S.btn, padding: "12px 20px", display: "flex", alignItems: "center", gap: 8, height: 42, background: "#0b6b3a" }}
            onClick={handleAutoProvision}
            disabled={loading}
          >
            <Zap size={18} /> {loading ? "Generating..." : "Auto-Provision & Pair"}
          </button>
        </div>

        {/* Pairing Code Display Modal / Box */}
        {pairCode && (
          <div style={{ marginTop: 24, padding: 24, background: "#ffffff", borderRadius: 12, border: "2px dashed #0b6b3a", textAlign: "center" }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#e6f4ea', color: '#137333', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
              <CheckCircle2 size={16} /> WhatsApp 8-Digit Pairing Code Ready
            </div>
            <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 10, color: "#0b3a22", fontFamily: "monospace", margin: "8px 0" }}>
              {pairCode}
            </div>
            <div style={{ maxWidth: 540, margin: "12px auto 0", fontSize: 13, color: "#5a6b62", lineHeight: 1.6, textAlign: 'left', background: '#f8faf9', padding: 14, borderRadius: 8 }}>
              <strong>Follow these steps on your WhatsApp phone:</strong>
              <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                <li>Open WhatsApp on phone <strong>+{autoPhone.replace(/^\+/, '')}</strong></li>
                <li>Go to <strong>Settings</strong> (or <strong>⋮</strong> on Android) &gt; <strong>Linked Devices</strong></li>
                <li>Tap <strong>Link a Device</strong> &gt; Select <strong>"Link with phone number instead"</strong></li>
                <li>Enter the 8-character code: <strong>{pairCode}</strong></li>
              </ol>
            </div>
          </div>
        )}
      </section>

      {/* ── Registered Vendors Directory Table ── */}
      <section style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#0b3a22' }}>Provisioned WhatsApp Business Lines ({vendorList.length})</h3>
        </div>

        {vendorList.length === 0 ? (
          <p style={{ color: "#5a6b62", margin: 0 }}>No vendors provisioned yet. Use the 1-Step form above to auto-provision your first line.</p>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Merchant / Store</th>
                <th style={S.th}>WhatsApp Number</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Dialect</th>
                <th style={S.th}>Auto-Status</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendorList.map((v) => {
                const isSelected = selectedVendorId === v.vendor_id;
                return (
                  <tr key={v.vendor_id} style={{ background: isSelected ? "#eef7f2" : "transparent" }}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{v.merchant_name || "Biblio Merchant"}</td>
                    <td style={S.td}>+{v.business_line_number || v.personal_number || "—"}</td>
                    <td style={S.td}>
                      <span style={{ background: sessionColor(v.session_status), color: "#fff", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        {v.session_status.toUpperCase()}
                      </span>
                    </td>
                    <td style={S.td}><span style={{ textTransform: 'capitalize' }}>{v.dialect || "pidgin"}</span></td>
                    <td style={S.td}>{v.auto_status_enabled ? "✅ Enabled" : "⏸️ Disabled"}</td>
                    <td style={S.td}>
                      <button
                        style={isSelected ? S.btn : S.btnGhost}
                        onClick={() => loadVendorData(v.vendor_id)}
                      >
                        {isSelected ? "Active Inspect" : "Inspect"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Active Line Health & Stateful Business Mode Card ── */}
      {status && (
        <section style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: "0 0 4px", color: '#0b3a22' }}>Live Session Health & Note-to-Self Control</h3>
              <span style={{ fontSize: 13, color: '#5a6b62' }}>Vendor ID: {selectedVendorId}</span>
            </div>
            <button style={{ ...S.btn, background: "#2a9d8f", display: 'flex', alignItems: 'center', gap: 6 }} onClick={triggerCron}>
              <Zap size={16} /> Trigger Status Posting Cron
            </button>
          </div>

          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginBottom: 20, padding: 16, background: '#f8faf9', borderRadius: 10 }}>
            <div style={{ background: sessionColor(status.dbStatus), color: "white", borderRadius: 20, padding: "6px 16px", fontWeight: 800, fontSize: 13 }}>
              {status.dbStatus.toUpperCase()}
            </div>
            <span style={{ color: "#0b3a22", fontSize: 14, fontWeight: 600 }}>
              {status.inMemory ? "⚡ Baileys WebSocket In-Memory: CONNECTED" : "📦 No active in-process socket"}
            </span>
            {status.businessLineNumber && (
              <span style={{ color: "#5a6b62", fontSize: 14, fontWeight: 700 }}>
                📱 +{status.businessLineNumber}
              </span>
            )}
          </div>

          {/* Stateful Business Mode User Guidance */}
          <div style={{ background: '#eef4fd', border: '1px solid #c8dafc', borderRadius: 10, padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ background: '#1a73e8', color: 'white', padding: 8, borderRadius: 8, marginTop: 2 }}>
              <MessageSquare size={20} />
            </div>
            <div>
              <h4 style={{ margin: "0 0 4px", color: '#174ea6' }}>Stateful "Note-to-Self" WhatsApp Business Mode</h4>
              <p style={{ margin: 0, fontSize: 13, color: '#185abc', lineHeight: 1.5 }}>
                To manage inventory directly from your WhatsApp: open your <strong>"Message yourself"</strong> chat and type <strong><code>business</code></strong>.
                All product images, voice notes, and price descriptions will be automatically parsed and posted to WhatsApp Status until you type <strong><code>end-business</code></strong>.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Status Approval Queue ── */}
      {queue.length > 0 && (
        <section style={S.card}>
          <h3 style={{ margin: "0 0 16px", color: '#0b3a22' }}>Pending Status Approval ({queue.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {queue.map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: 14, borderRadius: 10, background: "#f8faf9", border: "1px solid #e3e8e5" }}>
                {item.image_url && (
                  <img src={item.image_url} alt={item.product_name ?? item.sku} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{item.product_name ?? item.sku}</div>
                  <div style={{ fontSize: 13, color: "#5a6b62", whiteSpace: "pre-line" }}>{item.caption}</div>
                  <div style={{ fontSize: 11, color: "#aab8b2", marginTop: 4 }}>Queued {new Date(item.queued_at).toLocaleString()}</div>
                </div>
                <button id={`approve-${item.id}`} style={{ ...S.btn, fontSize: 13 }} onClick={() => approve(item.id)}>
                  Approve & Post ✅
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Status Posting History ── */}
      {log.length > 0 && (
        <section style={S.card}>
          <h3 style={{ margin: "0 0 16px", color: '#0b3a22' }}>Status Posting History ({log.length})</h3>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Image</th>
                <th style={S.th}>Product</th>
                <th style={S.th}>Caption</th>
                <th style={S.th}>Posted At</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry, i) => (
                <tr key={i}>
                  <td style={S.td}>
                    {entry.image_url
                      ? <img src={entry.image_url} alt={entry.product_name ?? entry.sku} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
                      : "—"}
                  </td>
                  <td style={S.td}>{entry.product_name ?? entry.sku}</td>
                  <td style={{ ...S.td, fontSize: 13, color: "#5a6b62", whiteSpace: "pre-line", maxWidth: 300 }}>{entry.caption}</td>
                  <td style={S.td}>{new Date(entry.posted_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

// ─── Merchant Management & Catalog Tab ───────────────────────────────────────

function MerchantManagement() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedId, setSelectedId] = useState(DEMO_ID);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [msg, setMsg] = useState<string>("");

  const refreshMerchants = async () => {
    try {
      const list = await api.listMerchants();
      setMerchants(list || []);
      if (list && list.length > 0) {
        setSelectedId(list[0].id);
        load(list[0].id);
      } else {
        load(DEMO_ID);
      }
    } catch {
      load(DEMO_ID);
    }
  };

  useEffect(() => {
    refreshMerchants();
  }, []);

  const load = async (mId = selectedId) => {
    setSelectedId(mId);
    setMsg("Loading…");
    try {
      const [m, p] = await Promise.all([
        api.getMerchant(mId).catch(() => null),
        api.listProducts(mId).catch(() => []),
      ]);
      setMerchant(m);
      setProducts(p || []);
      setMsg("");
    } catch (e) {
      setMsg(String(e));
    }
  };

  const sync = async () => {
    setMsg("Syncing catalog with Meta Commerce Manager…");
    try {
      const r = await api.syncCatalog(selectedId);
      setMsg(`✅ Synced: fetched ${r.fetched}, upserted ${r.upserted}.`);
      const p = await api.listProducts(selectedId);
      setProducts(p || []);
    } catch (e) {
      setMsg("Sync error: " + String(e));
    }
  };

  return (
    <div>
      <h1 style={{ color: '#0b3a22', marginBottom: 24, fontSize: 28 }}>Merchants & Catalog Management</h1>

      {msg && <p style={S.msg}>{msg}</p>}

      <section style={S.card}>
        <label style={S.label}>Select Merchant or Enter ID</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {merchants.length > 0 && (
            <select
              style={{ ...S.select, flex: 1 }}
              value={selectedId}
              onChange={e => load(e.target.value)}
            >
              {merchants.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.id.substring(0, 8)}...)</option>
              ))}
            </select>
          )}
          <input
            style={{ ...S.input, flex: 1 }}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            placeholder="Merchant UUID"
          />
          <button style={S.btn} onClick={() => load(selectedId)}>Load</button>
          <button style={S.btnGhost} onClick={sync}>↻ Sync Meta Catalog</button>
        </div>
      </section>

      {merchant && (
        <section style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <ShoppingBag size={20} color="#0b6b3a" />
            <h3 style={{ margin: 0, color: '#0b3a22' }}>{merchant.name}</h3>
          </div>
          <Row k="Merchant ID" v={merchant.id} />
          <Row k="Phone number id" v={merchant.phone_number_id} />
          <Row k="Dialect Voice" v={merchant.dialect} />
          <Row k="Meta Catalog ID" v={merchant.whatsapp_catalog_id ?? "—"} />
          <Row k="Tone & Voice Guide" v={merchant.tone_guide ?? "—"} />
          <Row k="Business Policies" v={merchant.business_policies ?? "—"} />
          <Row k="Delivery Info" v={merchant.delivery_info ?? "—"} />
        </section>
      )}

      {products.length > 0 && (
        <section style={S.card}>
          <h3 style={{ margin: "0 0 16px", color: '#0b3a22' }}>Active Products Catalog ({products.length})</h3>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>SKU</th>
                <th style={S.th}>Product Name</th>
                <th style={S.th}>Price</th>
                <th style={S.th}>Stock</th>
                <th style={S.th}>Source</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.sku} style={{ opacity: p.active ? 1 : 0.5 }}>
                  <td style={{ ...S.td, fontFamily: 'monospace' }}>{p.sku}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...S.td, color: '#0b6b3a', fontWeight: 700 }}>₦{Number(p.price).toLocaleString()}</td>
                  <td style={S.td}>{p.stock}</td>
                  <td style={S.td}><span style={{ fontSize: 12, background: '#eef2f0', padding: '2px 8px', borderRadius: 6 }}>{p.source || "local"}</span></td>
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
    <div style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #f4f7f5" }}>
      <span style={{ width: 180, color: "#5a6b62", fontWeight: 600, fontSize: 13 }}>{k}</span>
      <span style={{ flex: 1, color: "#0b3a22", fontSize: 14 }}>{v}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: "system-ui, -apple-system, sans-serif", color: "#0b3a22", backgroundColor: '#f4f7f5' },
  card: { background: "#fff", border: "1px solid #e3e8e5", borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#5a6b62", marginBottom: 6 },
  input: { padding: 10, borderRadius: 8, border: "1px solid #cdd6d1", fontSize: 14, outline: 'none', background: '#fff' },
  select: { padding: 10, borderRadius: 8, border: "1px solid #cdd6d1", fontSize: 14, outline: 'none', background: '#fff' },
  btn: { background: "#0b6b3a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  btnGhost: { background: "#f4f7f5", color: "#0b6b3a", border: "1px solid #0b6b3a", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  msg: { color: "#5a6b62", margin: '0 0 16px' },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", borderBottom: "2px solid #e3e8e5", padding: "10px 12px", color: "#5a6b62", fontWeight: 700, fontSize: 13 },
  td: { borderBottom: "1px solid #eef2f0", padding: "10px 12px" },
  navLink: { color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14, transition: 'background 0.2s' }
};
