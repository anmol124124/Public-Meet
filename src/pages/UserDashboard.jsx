import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isLoggedIn, getMe, listMeetings, activatePlan, logout } from "../api";
import "../dashboard.css";

const BASE = (window.BACKEND_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
const authHeader = () => {
  const t = localStorage.getItem("access_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const apiFetch = (path) =>
  fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json", ...authHeader() } })
    .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.detail || "Error"))));

function fmtSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── PLAN CONFIG ──────────────────────────────────────────────────────────────
const PLANS = [
  {
    key: "free", name: "Starter", priceLabel: "Free", priceSub: "No credit card required",
    color: "#6b7280", popular: false, inherits: null,
    groups: [
      { icon: "🎥", label: "Meetings",      items: ["40-minute meetings", "Up to 100 participants"] },
      { icon: "📹", label: "Video & Audio", items: ["HD video quality", "Noise cancellation"] },
      { icon: "☁️", label: "Recording",     items: ["Cloud recording included"] },
      { icon: "💬", label: "Chat",          items: ["In-meeting messaging", "Screen share"] },
    ],
  },
  {
    key: "basic", name: "Basic", priceLabel: "$9.99", price: "$9.99", priceSub: "per month",
    color: "#1a73e8", popular: false, inherits: "Starter",
    groups: [
      { icon: "🎥", label: "Meetings",  items: ["Up to 24-hour meetings", "Up to 100 participants"] },
      { icon: "☁️", label: "Recording", items: ["Cloud recording with 5 GB storage"] },
      { icon: "🎧", label: "Support",   items: ["Email support", "Help centre access"] },
    ],
  },
  {
    key: "pro", name: "Pro", priceLabel: "$29.99", price: "$29.99", priceSub: "per month",
    color: "#6c63ff", popular: true, inherits: "Basic",
    groups: [
      { icon: "🎥", label: "Meetings",   items: ["Unlimited meeting duration", "Up to 300 participants"] },
      { icon: "☁️", label: "Recording",  items: ["Cloud recording with 50 GB storage", "Recording transcripts"] },
      { icon: "🎨", label: "Branding",   items: ["Custom branding", "Branded waiting room"] },
      { icon: "🎧", label: "Support",    items: ["Priority support"] },
    ],
  },
  {
    key: "enterprise", name: "Enterprise", priceLabel: "Custom", priceSub: "Tailored to your needs",
    color: "#f59e0b", popular: false, enterprise: true, inherits: null,
    groups: [
      { icon: "📹", label: "Video",       items: ["4K video quality", "4K cloud recording", "Unlimited storage"] },
      { icon: "🏷️", label: "White-label", items: ["Full white-label solution", "Custom domain & branding"] },
      { icon: "🔒", label: "Enterprise",  items: ["SSO & managed domains", "SLA guarantee (99.9%)"] },
      { icon: "🎧", label: "Support",     items: ["Dedicated account manager", "24/7 phone support"] },
    ],
  },
];
const PLAN_ORDER = ["free", "basic", "pro", "enterprise"];

const FAQS = [
  { category: "Getting Started", q: "How do I start a meeting?", a: "Enter a meeting title on the home page and click 'Create Meeting', then 'Start Instant Meeting'. After selecting a plan, your meeting is created instantly." },
  { category: "Getting Started", q: "Can participants join without an account?", a: "Yes. Guests can join your meeting using the shareable meeting link without signing up for an account. They just enter their name." },
  { category: "Getting Started", q: "How do I schedule a meeting?", a: "On the home page, enter a meeting title, click 'Create Meeting', then choose 'Schedule Meeting'. You can set date, time, timezone, and invite participants by email." },
  { category: "Plans & Billing", q: "What are the available plans?", a: "RoomLy offers four plans: Starter (Free) with 40-minute meetings; Basic ($9.99/mo) with 24-hour meetings; Pro ($29.99/mo) with unlimited duration, 300 participants, and custom branding; and Enterprise (Custom pricing) for large-scale deployments." },
  { category: "Plans & Billing", q: "How do I upgrade my plan?", a: "Go to 'My Plan' in the dashboard and click the plan you want. For Basic and Pro, a sandbox payment will activate it immediately." },
  { category: "Plans & Billing", q: "Are there meeting duration limits?", a: "Yes. The Starter (free) plan limits meetings to 40 minutes. The Basic plan allows up to 24-hour meetings. The Pro and Enterprise plans have no meeting duration limit." },
  { category: "Recordings", q: "How do recordings work?", a: "When you click the Record button during a meeting, RoomLy captures screen and audio locally in the browser. When stopped, the file is automatically uploaded and saved to your Recordings tab here." },
  { category: "Recordings", q: "Where are recordings stored?", a: "Recordings are stored in Google Cloud Storage and are accessible via a secure signed URL. You can find and download all recordings from the Recordings page." },
  { category: "Meetings", q: "What browsers are supported?", a: "RoomLy works in all modern browsers: Chrome, Firefox, Edge, and Safari. Chrome and Edge provide the best recording support." },
  { category: "Security", q: "Is my data secure?", a: "Yes. All meetings use WebRTC encryption (DTLS-SRTP) for media streams. Your meeting token (JWT) authenticates the host — it is only valid for that specific meeting." },
];

// ── PAYMENT MODAL ────────────────────────────────────────────────────────────
function PayModal({ plan, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  async function pay() {
    setLoading(true); setError("");
    try { await activatePlan(plan.key); onSuccess(); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <div className="ud-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="ud-modal">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>💳</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Complete your purchase</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Sandbox — no real charge</div>
        </div>
        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 18px", marginBottom: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {[["Plan", plan.name], ["Billing", "Monthly"], null, ["Total today", plan.priceLabel]].map((row, i) =>
            !row ? <div key={i} style={{ borderTop: "1px solid var(--border)" }} /> :
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>{row[0]}</span>
              <span style={{ color: i === 3 ? "var(--text)" : "var(--muted)", fontWeight: i === 3 ? 700 : 500, fontSize: i === 3 ? 18 : 13 }}>{row[1]}</span>
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 18 }}>
          🧪 Sandbox — click "Pay Now" to simulate payment.
        </div>
        {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button className="ud-btn ud-btn-primary" style={{ width: "100%", marginBottom: 10, opacity: loading ? 0.7 : 1 }} onClick={pay} disabled={loading}>
          {loading ? "Processing…" : `Pay ${plan.priceLabel}`}
        </button>
        <button className="ud-btn ud-btn-ghost" style={{ width: "100%" }} onClick={onCancel} disabled={loading}>Cancel</button>
      </div>
    </div>
  );
}

function EnterpriseModal({ onClose }) {
  const [sent, setSent] = useState(false);
  const [f, setF]       = useState({ name: "", email: "", company: "" });
  return (
    <div className="ud-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ud-modal">
        {sent ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>We'll be in touch!</div>
            <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24, lineHeight: 1.6 }}>Our team will contact you within 1 business day.</div>
            <button className="ud-btn ud-btn-primary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Enterprise</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Contact Sales</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Tell us about your team and we'll put together a custom plan.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[["Full Name", "name", "text", "Jane Smith"], ["Work Email", "email", "email", "jane@company.com"], ["Company", "company", "text", "Acme Inc."]].map(([label, field, type, ph]) => (
                <div key={field}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>{label}</label>
                  <input
                    type={type} placeholder={ph} value={f[field]}
                    onChange={e => setF(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "inherit" }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="ud-btn ud-btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button className="ud-btn" style={{ flex: 1, background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff" }}
                onClick={() => { if (f.name && f.email) setSent(true); }}
              >Submit</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── OVERVIEW PAGE ────────────────────────────────────────────────────────────
function OverviewPage({ user, meetings }) {
  const navigate = useNavigate();
  const instant   = meetings.filter(m => !m.scheduled_at);
  const scheduled = meetings.filter(m => !!m.scheduled_at);
  const lastDate  = meetings.length > 0
    ? new Date(meetings[0].created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";

  return (
    <div className="ud-page">
      <div className="ud-page-heading">
        <h1>Overview</h1>
        <p>Summary of your public meetings and account.</p>
      </div>

      <div className="ud-stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="ud-stat-card">
          <div className="ud-stat-value">{meetings.length}</div>
          <div className="ud-stat-label">Total Meetings</div>
        </div>
        <div className="ud-stat-card">
          <div className="ud-stat-value" style={{ fontSize: 16, paddingTop: 4 }}>{lastDate}</div>
          <div className="ud-stat-label">Last Meeting</div>
        </div>
        <div className="ud-stat-card">
          <div className="ud-stat-value" style={{ fontSize: 15, textTransform: "capitalize" }}>
            {user?.plan || "Free"}
          </div>
          <div className="ud-stat-label">Current Plan</div>
        </div>
      </div>

      {meetings.length > 0 ? (
        <div className="ud-section-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)" }}>
            <div className="ud-section-title" style={{ marginBottom: 0 }}>Recent Meetings</div>
          </div>
          <table className="ud-rec-table">
            <thead>
              <tr>
                <th style={{ padding: "10px 24px" }}>Name</th>
                <th style={{ padding: "10px 12px" }}>Room Code</th>
                <th style={{ padding: "10px 12px" }}>Type</th>
                <th style={{ padding: "10px 24px", textAlign: "right" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {meetings.slice(0, 10).map(m => (
                <tr key={m.room_code}>
                  <td style={{ padding: "13px 24px", fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: "13px 12px", fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>{m.room_code}</td>
                  <td style={{ padding: "13px 12px" }}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: m.scheduled_at ? "rgba(52,168,83,.12)" : "rgba(108,99,255,.12)",
                      color: m.scheduled_at ? "#34a853" : "var(--primary)",
                    }}>
                      {m.scheduled_at ? "Scheduled" : "Instant"}
                    </span>
                  </td>
                  <td style={{ padding: "13px 24px", color: "var(--muted)", fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>
                    {fmtTime(m.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ud-section-card">
          <div className="ud-empty" style={{ padding: "40px 20px" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 14 }}>
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            <h3>No meetings yet</h3>
            <p>Create a meeting from the home page to get started.</p>
            <button className="ud-btn ud-btn-primary" style={{ marginTop: 18 }} onClick={() => navigate("/")}>
              Go to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MY PLAN PAGE ─────────────────────────────────────────────────────────────
function MyPlanPage({ user, onToast, onUserRefresh }) {
  const currentKey  = user?.plan || "free";
  const currentIdx  = PLAN_ORDER.indexOf(currentKey);
  const [upgrading, setUpgrading] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="ud-page">
      <div className="ud-page-heading">
        <h1>Plans &amp; Pricing</h1>
        <p>Choose the plan that fits your needs. Upgrade or downgrade at any time.</p>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 0, border: "1px solid var(--border)", borderRadius: 18,
        overflow: "hidden", background: "var(--surface2)",
      }}>
        {PLANS.map((plan, idx) => {
          const isCurrent  = plan.key === currentKey;
          const canUpgrade = PLAN_ORDER.indexOf(plan.key) > currentIdx;
          const isPopular  = plan.popular;

          return (
            <div key={plan.key} style={{
              position: "relative",
              borderRight: idx < PLANS.length - 1 ? "1px solid var(--border)" : "none",
              display: "flex", flexDirection: "column",
              background: isPopular
                ? `linear-gradient(180deg, ${plan.color}14 0%, var(--surface2) 120px)`
                : "transparent",
            }}>
              {isPopular ? (
                <div style={{
                  background: plan.color, color: "#fff", textAlign: "center",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", padding: "6px 0",
                }}>Most Popular</div>
              ) : <div style={{ height: 0 }} />}

              <div style={{ padding: "24px 22px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: plan.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {plan.name}
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: plan.color, border: `1.5px solid ${plan.color}`, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.06em" }}>
                      CURRENT
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: plan.enterprise ? 28 : 36, fontWeight: 800, color: "var(--text)", lineHeight: 1.1 }}>
                    {plan.priceLabel}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{plan.priceSub}</div>
                </div>

                {plan.enterprise ? (
                  <button onClick={() => setContactOpen(true)} style={{
                    background: isCurrent ? "transparent" : `linear-gradient(135deg,${plan.color},#d97706)`,
                    color: isCurrent ? plan.color : "#fff",
                    border: `1.5px solid ${plan.color}`, borderRadius: 8,
                    padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
                    marginBottom: 20, boxShadow: isCurrent ? "none" : `0 4px 16px ${plan.color}40`, fontFamily: "inherit",
                  }}>
                    {isCurrent ? "✓ Your current plan" : "Contact Sales"}
                  </button>
                ) : isCurrent ? (
                  <div style={{
                    textAlign: "center", padding: "10px 0", fontSize: 13, fontWeight: 600,
                    color: plan.color, border: `1.5px solid ${plan.color}40`, borderRadius: 8, marginBottom: 20,
                  }}>✓ Your current plan</div>
                ) : canUpgrade ? (
                  <button onClick={() => setUpgrading(plan)} style={{
                    background: isPopular ? `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)` : "transparent",
                    color: isPopular ? "#fff" : plan.color,
                    border: `1.5px solid ${plan.color}`, borderRadius: 8,
                    padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
                    marginBottom: 20, boxShadow: isPopular ? `0 4px 16px ${plan.color}40` : "none", fontFamily: "inherit",
                  }}>Upgrade</button>
                ) : (
                  <div style={{
                    textAlign: "center", padding: "10px 0", fontSize: 13, color: "var(--muted)",
                    border: "1.5px solid var(--border)", borderRadius: 8, marginBottom: 20, opacity: 0.5,
                  }}>
                    {plan.key === "free" ? "Included" : "Downgrade"}
                  </div>
                )}

                <div style={{ borderTop: "1px solid var(--border)", marginBottom: 14 }} />
                {plan.inherits && (
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", margin: "0 0 12px" }}>
                    All of {plan.inherits}, and:
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                  {plan.groups.map((group, gi) => (
                    <div key={gi}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 13 }}>{group.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{group.label}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 4 }}>
                        {group.items.map((item, ii) => (
                          <div key={ii} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={plan.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
        All plans include a sandbox environment. Payments are simulated — no real charges.
      </p>

      {upgrading && (
        <PayModal
          plan={upgrading}
          onSuccess={() => { setUpgrading(null); onToast("Plan upgraded!"); onUserRefresh(); }}
          onCancel={() => setUpgrading(null)}
        />
      )}
      {contactOpen && <EnterpriseModal onClose={() => setContactOpen(false)} />}
    </div>
  );
}

// ── RECORDINGS PAGE ──────────────────────────────────────────────────────────
function RecordingsPage() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    apiFetch("/api/v1/public/meetings/recordings")
      .then(setRecordings)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ud-page">
      <div className="ud-page-heading">
        <h1>Recordings</h1>
        <p>All recordings saved during your public meetings. Click Download to save.</p>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {error   && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {!loading && recordings.length === 0 && !error && (
        <div className="ud-section-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--muted)", marginBottom: 14, opacity: 0.4 }}>
            <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
          </svg>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            No recordings yet. Start a meeting and click the record button to save a recording here.
          </p>
        </div>
      )}

      {recordings.length > 0 && (
        <div className="ud-section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="ud-rec-table">
            <thead>
              <tr>
                <th style={{ padding: "14px 24px" }}>Room</th>
                <th style={{ padding: "14px 12px" }}>Date</th>
                <th style={{ padding: "14px 12px" }}>Size</th>
                <th style={{ padding: "14px 24px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {recordings.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: "14px 24px" }}>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>{r.room_code}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", opacity: 0.6 }}>{r.filename}</div>
                  </td>
                  <td style={{ padding: "14px 12px", color: "var(--muted)", whiteSpace: "nowrap", fontSize: 13 }}>
                    {fmtTime(r.created_at)}
                  </td>
                  <td style={{ padding: "14px 12px", color: "var(--muted)", fontSize: 13 }}>
                    {fmtSize(r.file_size)}
                  </td>
                  <td style={{ padding: "14px 24px", textAlign: "right" }}>
                    <a href={r.url} download className="ud-btn ud-btn-ghost ud-btn-sm" style={{ textDecoration: "none" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── FAQ PAGE ─────────────────────────────────────────────────────────────────
function FAQItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ud-faq-item${open ? " open" : ""}`}>
      <button className="ud-faq-btn" onClick={() => setOpen(o => !o)}>
        {faq.q}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5"
          style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="ud-faq-answer">{faq.a}</div>}
    </div>
  );
}

function FAQsPage() {
  const categories = [...new Set(FAQS.map(f => f.category))];
  return (
    <div className="ud-page">
      <div className="ud-page-heading">
        <h1>FAQ</h1>
        <p>Frequently asked questions about RoomLy Public Meet.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {categories.map(cat => (
          <div key={cat}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary)", marginBottom: 10 }}>
              {cat}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FAQS.filter(f => f.category === cat).map((faq, i) => (
                <FAQItem key={i} faq={faq} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
        Still have questions?{" "}
        <span style={{ color: "var(--primary)" }}>Contact our support team →</span>
      </div>
    </div>
  );
}

// ── ADD-ONS PAGE ─────────────────────────────────────────────────────────────
function AddOnsPage({ user, onToast, onNavMyPlan }) {
  const isFree = !user?.plan || user.plan === "free";
  const [enabled, setEnabled] = useState(() => {
    const v = localStorage.getItem("pub_recording_addon_enabled");
    if (v === null) return !isFree; // paid default: on; free default: off
    return v === "true";
  });
  const [dirty, setDirty]     = useState(false);
  const [showFreeMsg, setShowFreeMsg] = useState(false);

  function toggle() {
    if (isFree) { setShowFreeMsg(true); return; }
    setEnabled(v => !v);
    setDirty(true);
    setShowFreeMsg(false);
  }

  function save() {
    localStorage.setItem("pub_recording_addon_enabled", String(enabled));
    setDirty(false);
    onToast("Add-on settings saved!");
  }

  return (
    <div className="ud-page">
      <div className="ud-page-heading">
        <h1>Add-Ons</h1>
        <p>Enable or disable optional features for your meetings.</p>
      </div>

      <div style={{ maxWidth: 640 }}>
        <div className="ud-section-card">
          <div className="ud-section-title">Meeting Features</div>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8, lineHeight: 1.6 }}>
            Control which optional features are available to you as the host during meetings.
          </p>

          {/* Screen Recording row */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 0",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: enabled && !isFree ? "rgba(108,99,255,.12)" : "var(--surface2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background .2s",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={enabled && !isFree ? "var(--primary)" : "var(--muted)"} strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                  Screen Recording
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                  Allows you to record meetings. Requires a paid plan (Basic or above).
                </div>
              </div>
            </div>
            <div style={{ marginLeft: 16 }}>
              {/* Toggle */}
              <button onClick={toggle} style={{
                position: "relative", width: 44, height: 24, borderRadius: 12, border: "none",
                cursor: "pointer",
                background: enabled && !isFree ? "var(--primary)" : "rgba(0,0,0,.15)",
                transition: "background .2s", flexShrink: 0,
              }}>
                <span style={{
                  position: "absolute", top: 3, left: enabled && !isFree ? 23 : 3,
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                }} />
              </button>
            </div>
          </div>

          {/* Free plan upgrade message */}
          {showFreeMsg && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.3)",
              borderRadius: 10, padding: "14px 16px", marginTop: 4, marginBottom: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
                  You're on the Free plan
                </div>
                <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>
                  Screen recording requires a paid plan. Please upgrade to <strong>Basic</strong> or above to enable this feature.
                </div>
                <button
                  onClick={() => { setShowFreeMsg(false); onNavMyPlan(); }}
                  style={{
                    marginTop: 10, padding: "7px 16px", background: "linear-gradient(135deg,#f59e0b,#d97706)",
                    color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Upgrade Now →
                </button>
              </div>
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4 }}>
            <button
              className="ud-btn ud-btn-primary"
              onClick={save}
              disabled={!dirty || isFree}
              style={{ opacity: !dirty || isFree ? 0.6 : 1 }}
            >
              {isFree ? "Upgrade to Save" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NAV ITEMS ────────────────────────────────────────────────────────────────
const NAV = [
  {
    id: "overview", label: "Overview",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    id: "my-plan", label: "My Plan",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  },
  {
    id: "add-ons", label: "Add-Ons",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/><circle cx="12" cy="12" r="3"/></svg>,
  },
  {
    id: "recordings", label: "Recordings",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>,
  },
  {
    id: "faq", label: "FAQ",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
];

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function UserDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState(() => sessionStorage.getItem("ud_page") || "overview");
  const [user, setUser]             = useState(null);
  const [meetings, setMeetings]     = useState([]);
  const [toast, setToast]           = useState({ msg: "", show: false });
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, show: true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2800);
  }, []);

  const loadUser = useCallback(() => {
    if (!isLoggedIn()) { navigate("/auth"); return; }
    getMe().then(setUser).catch(() => navigate("/auth"));
  }, [navigate]);

  useEffect(() => {
    loadUser();
    if (isLoggedIn()) {
      listMeetings().then(setMeetings).catch(() => {});
    }
  }, [loadUser]);

  function navTo(id) { sessionStorage.setItem("ud_page", id); setActivePage(id); }

  function handleLogout() { logout(); navigate("/"); }

  return (
    <div className="ud-root">
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <div className="ud-sidebar">
        <div className="ud-brand">
          <div className="ud-brand-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </div>
          <div>
            <div className="ud-brand-name">RoomLy</div>
            <div className="ud-brand-tagline">Public Meet</div>
          </div>
        </div>

        <nav className="ud-nav">
          {NAV.map(item => (
            <button
              key={item.id}
              className={`ud-nav-item${activePage === item.id ? " active" : ""}`}
              onClick={() => navTo(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          <div className="ud-sep" />

          <button className="ud-nav-item" onClick={() => navigate("/")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Home
          </button>
        </nav>

        <div className="ud-bottom">
          <div className="ud-user-row">
            <div className="ud-user-avatar">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="ud-user-email">{user?.email || ""}</div>
          </div>
          <button className="ud-nav-item" style={{ color: "var(--danger)" }} onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className="ud-main">
        {activePage === "overview"   && <OverviewPage user={user} meetings={meetings} />}
        {activePage === "my-plan"    && <MyPlanPage user={user} onToast={showToast} onUserRefresh={loadUser} />}
        {activePage === "add-ons"    && <AddOnsPage user={user} onToast={showToast} onNavMyPlan={() => navTo("my-plan")} />}
        {activePage === "recordings" && <RecordingsPage />}
        {activePage === "faq"        && <FAQsPage />}
      </div>

      <div className={`ud-toast${toast.show ? " show" : ""}`}>{toast.msg}</div>
    </div>
  );
}
