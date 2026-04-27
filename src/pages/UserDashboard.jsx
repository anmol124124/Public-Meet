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
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── PLAN CONFIG ──────────────────────────────────────────────────────────────
const PLANS = [
  {
    key: "free", name: "Starter", priceLabel: "$0", priceSub: "Free forever",
    color: "#5f6368", popular: false, enterprise: false,
    features: ["Up to 5-minute meeting duration", "Up to 2 participants", "Chat & screen share", "No credit card required"],
  },
  {
    key: "basic", name: "Basic", priceLabel: "$9.99", priceSub: "/ month",
    color: "#1a73e8", popular: false, enterprise: false,
    features: ["Up to 10-minute meeting duration", "Up to 4 participants", "Chat & screen share", "Meeting recordings"],
  },
  {
    key: "pro", name: "Pro", priceLabel: "$29.99", priceSub: "/ month",
    color: "#6c63ff", popular: true, enterprise: false,
    features: ["Unlimited meeting duration", "Up to 6 participants", "Everything in Basic", "Priority support"],
  },
  {
    key: "enterprise", name: "Enterprise", priceLabel: "Custom", priceSub: "",
    color: "#f59e0b", popular: false, enterprise: true,
    features: ["Unlimited meeting duration", "Unlimited participants", "White-label branding", "Dedicated support & SSO"],
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
function MeetingSummaryModal({ meeting, onClose }) {
  const [copied, setCopied] = useState(false);
  const joinUrl = meeting.url || `${window.location.origin}/${meeting.room_code}/room`;
  const copy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="ud-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ud-modal" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>Meeting Summary</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Name */}
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Meeting Name</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{meeting.name}</div>
          </div>

          {/* Type + Status row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Type</div>
              <span style={{
                display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: meeting.scheduled_at ? "rgba(52,168,83,.15)" : "rgba(108,99,255,.15)",
                color: meeting.scheduled_at ? "#059669" : "var(--primary)",
              }}>
                {meeting.scheduled_at ? "Scheduled" : "Instant"}
              </span>
            </div>
            <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Status</div>
              <span style={{
                display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: meeting.is_active ? "rgba(5,150,105,.15)" : "rgba(100,116,139,.12)",
                color: meeting.is_active ? "#059669" : "var(--muted)",
              }}>
                {meeting.is_active ? "Active" : "Ended"}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Created</div>
              <div style={{ fontSize: 13, color: "var(--text)" }}>{fmtTime(meeting.created_at)}</div>
            </div>
            <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                {meeting.scheduled_at ? "Scheduled For" : "Room Code"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text)", fontFamily: meeting.scheduled_at ? "inherit" : "monospace" }}>
                {meeting.scheduled_at ? fmtTime(meeting.scheduled_at) : meeting.room_code}
              </div>
            </div>
          </div>

          {/* Join link */}
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Meeting Link</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                {joinUrl}
              </div>
              <button className="ud-btn ud-btn-ghost ud-btn-sm" onClick={copy} style={{ flexShrink: 0 }}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewPage({ user, meetings }) {
  const navigate = useNavigate();
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const lastDate = meetings.length > 0 ? fmtTime(meetings[0].created_at) : "—";

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
          <div className="ud-stat-value" style={{ fontSize: 14, paddingTop: 6, lineHeight: 1.3 }}>{lastDate}</div>
          <div className="ud-stat-label">Last Created</div>
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
                <tr key={m.room_code}
                  onClick={() => setSelectedMeeting(m)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}
                >
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

      {selectedMeeting && (
        <MeetingSummaryModal meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />
      )}
    </div>
  );
}

// ── MY PLAN PAGE ─────────────────────────────────────────────────────────────
function MyPlanPage({ user, onToast, onUserRefresh }) {
  const currentKey = user?.plan || "free";
  const currentIdx = PLAN_ORDER.indexOf(currentKey);
  const [upgrading, setUpgrading]     = useState(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [hovered, setHovered]         = useState(null);
  const [downgradingFree, setDowngradingFree] = useState(false);
  const [isExpired, setIsExpired]     = useState(false);

  const expiresAt = user?.plan_expires_at ? new Date(user.plan_expires_at) : null;
  const expiryLabel = expiresAt
    ? expiresAt.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  // Detect client-side expiry and auto-refresh user data
  useEffect(() => {
    if (!expiresAt || currentKey === "free") { setIsExpired(false); return; }
    const check = () => {
      if (new Date() >= expiresAt) { setIsExpired(true); onUserRefresh(); }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [expiresAt, currentKey]);

  async function handleDowngradeToFree() {
    setDowngradingFree(true);
    try {
      await activatePlan("free");
      onToast("Switched to Free plan.");
      onUserRefresh();
    } catch (e) {
      onToast("Failed to switch plan: " + e.message);
    } finally {
      setDowngradingFree(false);
    }
  }

  const expiredPlan = isExpired ? PLANS.find(p => p.key === currentKey) : null;

  return (
    <div className="ud-page">
      <div className="ud-page-heading">
        <h1>Plans &amp; Pricing</h1>
        <p>Choose the plan that fits your needs. Upgrade or downgrade at any time.</p>
      </div>

      {/* ── Expired banner ─────────────────────────────────────────────── */}
      {isExpired && expiredPlan && (
        <div style={{
          background: "rgba(239,68,68,.1)", border: "1.5px solid rgba(239,68,68,.35)",
          borderRadius: 14, padding: "18px 22px", marginBottom: 24,
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 15 }}>
                Your {expiredPlan.name} plan has expired
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                You've been moved back to the free plan. Renew or stay on Starter.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setUpgrading(expiredPlan)}
              style={{
                flex: "1 1 140px", padding: "11px 16px", borderRadius: 10, border: "none",
                background: expiredPlan.color, color: "#fff", fontWeight: 600, fontSize: 14,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Renew {expiredPlan.name}
            </button>
            <button
              onClick={handleDowngradeToFree}
              disabled={downgradingFree}
              style={{
                flex: "1 1 140px", padding: "11px 16px", borderRadius: 10,
                border: "1.5px solid var(--border)", background: "transparent",
                color: "var(--muted)", fontWeight: 600, fontSize: 14,
                cursor: "pointer", fontFamily: "inherit",
                opacity: downgradingFree ? 0.6 : 1,
              }}
            >
              {downgradingFree ? "Switching…" : "Continue with Free"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {PLANS.map(plan => {
          const isCurrent  = plan.key === currentKey;
          const planIdx    = PLAN_ORDER.indexOf(plan.key);
          const canUpgrade = planIdx > currentIdx;
          const canDowngradeToFree = plan.key === "free" && currentKey !== "free";
          const isHovered  = hovered === plan.key;

          return (
            <div
              key={plan.key}
              onMouseEnter={() => setHovered(plan.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                flex: "1 1 200px", maxWidth: 220,
                background: "var(--surface2)",
                borderRadius: 16,
                border: `1.5px solid ${plan.popular ? plan.color : isHovered ? "rgba(255,255,255,.25)" : "var(--border)"}`,
                padding: "28px 22px",
                display: "flex", flexDirection: "column",
                position: "relative",
                boxShadow: plan.popular
                  ? `0 0 0 2px ${plan.color}, 0 ${isHovered ? 16 : 8}px ${isHovered ? 48 : 40}px rgba(0,0,0,.5)`
                  : isHovered ? "0 8px 32px rgba(0,0,0,.5)" : "none",
                transform: isHovered ? "translateY(-3px)" : "translateY(0)",
                transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
              }}
            >
              {isCurrent && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#34a853", padding: "3px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
                  Current Plan
                </div>
              )}
              {!isCurrent && plan.popular && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: plan.color, padding: "3px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
                  Most Popular
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: plan.color, marginBottom: 8 }}>{plan.name}</div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: plan.priceLabel === "Custom" ? 24 : 32, fontWeight: 800, color: "var(--text)" }}>{plan.priceLabel}</span>
                  {plan.priceSub && <span style={{ fontSize: 13, color: "var(--muted)", paddingBottom: 6 }}>{plan.priceSub}</span>}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28, flex: 1 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
                    <span style={{ color: plan.color, fontSize: 16, lineHeight: 1 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>

              {plan.enterprise ? (
                <button onClick={() => setContactOpen(true)} style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: plan.color, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  filter: isHovered ? "brightness(1.15)" : "none", transition: "filter 0.15s ease", fontFamily: "inherit",
                }}>Contact Sales</button>
              ) : isCurrent ? (
                <button disabled style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: "rgba(52,168,83,.15)", color: "#34a853", fontSize: 14, fontWeight: 600, cursor: "default", fontFamily: "inherit",
                }}>✓ Current Plan</button>
              ) : canUpgrade ? (
                <button onClick={() => setUpgrading(plan)} style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: plan.color, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  filter: isHovered ? "brightness(1.15)" : "none", transition: "filter 0.15s ease", fontFamily: "inherit",
                }}>Upgrade to {plan.name}</button>
              ) : canDowngradeToFree ? (
                <button
                  onClick={handleDowngradeToFree}
                  disabled={downgradingFree}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 10,
                    border: "1.5px solid var(--border)", background: "transparent",
                    color: "var(--muted)", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                    opacity: downgradingFree ? 0.6 : 1,
                    filter: isHovered ? "brightness(1.3)" : "none", transition: "filter 0.15s ease",
                  }}
                >{downgradingFree ? "Switching…" : "Downgrade to Free"}</button>
              ) : (
                <button disabled style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid var(--border)",
                  background: "transparent", color: "var(--muted)", fontSize: 14, cursor: "default", opacity: 0.5, fontFamily: "inherit",
                }}>Downgrade</button>
              )}
            </div>
          );
        })}
      </div>

      {expiryLabel && !isExpired && (
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          Your <strong style={{ color: "var(--text)" }}>{PLANS.find(p => p.key === currentKey)?.name}</strong> plan expires on{" "}
          <strong style={{ color: "#f59e0b" }}>{expiryLabel}</strong>. After expiry you'll return to the free plan.
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
        Sandbox environment — payments are simulated, no real charges.
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
    if (v === null) return !isFree;
    return v === "true";
  });
  const [dirty, setDirty] = useState(false);

  function toggle() {
    if (isFree) return; // locked — banner is always visible
    setEnabled(v => !v);
    setDirty(true);
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
            opacity: isFree ? 0.6 : 1,
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                    Screen Recording
                  </span>
                  {isFree && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                      background: "rgba(245,158,11,.18)", color: "#f59e0b",
                      border: "1px solid rgba(245,158,11,.35)", borderRadius: 6,
                      padding: "2px 7px",
                    }}>Paid only</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                  Allows you to record meetings. Requires a paid plan (Basic or above).
                </div>
              </div>
            </div>
            <div style={{ marginLeft: 16 }}>
              <button onClick={toggle} disabled={isFree} style={{
                position: "relative", width: 44, height: 24, borderRadius: 12, border: "none",
                cursor: isFree ? "not-allowed" : "pointer",
                background: enabled && !isFree ? "var(--primary)" : "rgba(255,255,255,.1)",
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

          {/* Free plan — always-visible upgrade notice */}
          {isFree && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)",
              borderRadius: 10, padding: "14px 16px", marginBottom: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 4 }}>
                  Recording is not available on the Free plan
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                  Upgrade to <strong style={{ color: "var(--text)" }}>Basic</strong> or above to unlock screen recording in your meetings.
                </div>
                <button
                  onClick={onNavMyPlan}
                  style={{
                    marginTop: 10, padding: "7px 16px",
                    background: "linear-gradient(135deg,#f59e0b,#d97706)",
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

// ── PAGINATION ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

function Pagination({ page, totalPages, total, pageSize, onChange }) {
  if (totalPages <= 1) return null;

  const btnStyle = (active, disabled) => ({
    padding: "6px 11px", minWidth: 34, height: 32,
    border: "1px solid var(--border)", borderRadius: 7, fontSize: 13,
    cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit", fontWeight: active ? 700 : 400,
    background: active ? "var(--primary)" : "var(--surface2)",
    color: active ? "#fff" : disabled ? "var(--border)" : "var(--text)",
    opacity: disabled ? 0.45 : 1,
    transition: "background .15s, color .15s",
    lineHeight: 1,
  });

  // Build visible page list: always show first, last, current ± 1, with ellipsis gaps
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderTop: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>
        Showing {from}–{to} of {total}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <button style={btnStyle(false, page === 1)} disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>
        {pages.map((p, i) =>
          p === "…"
            ? <span key={`e${i}`} style={{ fontSize: 13, color: "var(--muted)", padding: "0 2px", userSelect: "none" }}>…</span>
            : <button key={p} style={btnStyle(p === page, false)} onClick={() => onChange(p)}>{p}</button>
        )}
        <button style={btnStyle(false, page === totalPages)} disabled={page === totalPages} onClick={() => onChange(page + 1)}>›</button>
      </div>
    </div>
  );
}

// ── SUMMARY PAGE ─────────────────────────────────────────────────────────────
function fmtDuration(seconds) {
  if (seconds == null || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

function fmtDetailTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return {
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  };
}

function exportCSV(meetings, summaries) {
  const rows = [["Meeting", "Room Code", "Date", "Duration", "People", "Status"]];
  meetings.forEach(m => {
    const sd = summaries[m.room_code];
    const people = sd?.unique_participant_count ?? "";
    const joinTimes = (sd?.participants || []).map(p => new Date(p.joined_at).getTime()).filter(Boolean);
    const startMs = joinTimes.length ? Math.min(...joinTimes) : null;
    const endMs = sd?.ended_at
      ? new Date(sd.ended_at).getTime()
      : (() => {
          if (sd?.is_active) return null;
          const lt = (sd?.participants || []).filter(p => p.left_at).map(p => new Date(p.left_at).getTime());
          return lt.length ? Math.max(...lt) : null;
        })();
    const dur = startMs && endMs ? Math.round((endMs - startMs) / 1000) : 0;
    rows.push([m.name, m.room_code, fmtTime(m.created_at), fmtDuration(dur), people, m.is_active ? "Live" : "Ended"]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "meetings.csv";
  a.click();
}

function Av({ name, size = 32 }) {
  const colors = ["#6c63ff","#1a73e8","#059669","#d97706","#dc2626","#7c3aed"];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: colors[idx],
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.4, flexShrink: 0,
    }}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

function SummaryDetail({ meeting, summaryData, onBack }) {
  const [data, setData]         = useState(summaryData || null);
  const [loading, setLoading]   = useState(!summaryData);
  const [search, setSearch]     = useState("");
  const [partPage, setPartPage] = useState(1);
  const [expanded, setExpanded] = useState(null); // display_name whose sessions are open

  useEffect(() => {
    if (summaryData) return;
    apiFetch(`/api/v1/public/meetings/summary/${meeting.room_code}`)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [meeting.room_code, summaryData]);

  // Group all session rows by display_name and sum duration
  const allGroups = (() => {
    const map = {};
    (data?.participants || []).forEach(p => {
      const key = p.display_name;
      if (!map[key]) {
        map[key] = { display_name: p.display_name, role: p.role, sessions: [], totalSeconds: 0, stillIn: false };
      }
      map[key].sessions.push(p);
      map[key].totalSeconds += p.duration_seconds || 0;
      if (!p.left_at) map[key].stillIn = true;
    });
    // Sort sessions within each group chronologically
    Object.values(map).forEach(g => g.sessions.sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at)));
    return Object.values(map);
  })();

  const filteredGroups = allGroups.filter(g =>
    !search.trim() || g.display_name.toLowerCase().includes(search.toLowerCase())
  );
  const partTotalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const pagedGroups    = filteredGroups.slice((partPage - 1) * PAGE_SIZE, partPage * PAGE_SIZE);

  const joinTimes  = (data?.participants || []).map(p => new Date(p.joined_at).getTime()).filter(Boolean);
  const startedAt  = joinTimes.length ? new Date(Math.min(...joinTimes)) : null;
  // Use server-provided ended_at (set when meeting is deactivated), fall back to max left_at
  const endedAt = data?.ended_at
    ? new Date(data.ended_at)
    : (() => {
        if (data?.is_active) return null;
        const leftTimes = (data?.participants || []).filter(p => p.left_at).map(p => new Date(p.left_at).getTime());
        return leftTimes.length ? new Date(Math.max(...leftTimes)) : null;
      })();
  const meetingDuration = startedAt && endedAt
    ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
    : null;

  const startFmt = fmtDetailTime(startedAt);
  const endFmt   = fmtDetailTime(endedAt);

  return (
    <div className="ud-page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button className="ud-btn ud-btn-ghost ud-btn-sm" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text)" }}>{meeting.name}</h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
            {meeting.room_code}
            {meeting.created_at && <> · {fmtTime(meeting.created_at)}</>}
          </div>
        </div>
      </div>

      {/* 4 stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <div className="ud-stat-card">
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>MEETING DURATION</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{loading ? "…" : fmtDuration(meetingDuration)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>total time</div>
        </div>
        <div className="ud-stat-card">
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>TOTAL PARTICIPANTS</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{loading ? "…" : (data?.unique_participant_count ?? 0)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>unique</div>
        </div>
        <div className="ud-stat-card">
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>STARTED AT</div>
          {loading ? <div style={{ fontSize: 26, fontWeight: 700 }}>…</div> : startFmt ? (
            <>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{startFmt.time}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{startFmt.date}</div>
            </>
          ) : <div style={{ fontSize: 22, fontWeight: 700, color: "var(--muted)" }}>—</div>}
        </div>
        <div className="ud-stat-card">
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>ENDED AT</div>
          {loading ? <div style={{ fontSize: 26, fontWeight: 700 }}>…</div> : endFmt ? (
            <>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{endFmt.time}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{endFmt.date}</div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: data?.is_active ? "#16a34a" : "var(--muted)", fontWeight: 600, paddingTop: 4 }}>
              {data?.is_active ? "● Still live" : "—"}
            </div>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="ud-section-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Participants</span>
            {!loading && <span style={{ fontSize: 12, color: "var(--muted)" }}>{data?.unique_participant_count ?? 0} unique</span>}
          </div>
          <div style={{ position: "relative" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input placeholder="Search by name…" value={search} onChange={e => { setSearch(e.target.value); setPartPage(1); setExpanded(null); }}
              style={{ padding: "6px 12px 6px 30px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, outline: "none", width: 200, background: "var(--surface2)", color: "var(--text)" }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>
        ) : allGroups.length === 0 ? (
          <div className="ud-empty" style={{ padding: "36px 20px" }}>
            <p>{(data?.participants?.length ?? 0) === 0 ? "No participant data recorded yet." : `No results for "${search}"`}</p>
          </div>
        ) : (
          <>
            <table className="ud-rec-table">
              <thead>
                <tr>
                  <th style={{ padding: "10px 24px" }}>NAME</th>
                  <th style={{ padding: "10px 12px" }}>ROLE</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>SESSIONS</th>
                  <th style={{ padding: "10px 24px", textAlign: "right" }}>TOTAL TIME</th>
                </tr>
              </thead>
              <tbody>
                {pagedGroups.map(g => {
                  const isOpen = expanded === g.display_name;
                  return (
                    <>
                      {/* ── Group row ── */}
                      <tr
                        key={g.display_name}
                        onClick={() => setExpanded(isOpen ? null : g.display_name)}
                        style={{ cursor: "pointer", background: isOpen ? "var(--surface2)" : "" }}
                        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = "var(--surface2)"; }}
                        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = ""; }}
                      >
                        <td style={{ padding: "14px 24px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Av name={g.display_name} />
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text)" }}>{g.display_name}</div>
                              {g.stillIn && (
                                <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, marginTop: 2 }}>● Still in meeting</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <span style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: g.role === "host" ? "rgba(108,99,255,.12)" : "rgba(100,116,139,.1)",
                            color: g.role === "host" ? "var(--primary)" : "var(--muted)",
                            textTransform: "uppercase", letterSpacing: "0.05em",
                          }}>{g.role}</span>
                        </td>
                        <td style={{ padding: "14px 12px", textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <span style={{
                              display: "inline-block", minWidth: 22, padding: "2px 7px", borderRadius: 20,
                              fontSize: 12, fontWeight: 700, textAlign: "center",
                              background: g.sessions.length > 1 ? "rgba(245,158,11,.15)" : "rgba(100,116,139,.1)",
                              color: g.sessions.length > 1 ? "#d97706" : "var(--muted)",
                            }}>{g.sessions.length}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5"
                              style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </div>
                        </td>
                        <td style={{ padding: "14px 24px", textAlign: "right", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
                          {fmtDuration(g.totalSeconds)}
                        </td>
                      </tr>

                      {/* ── Session detail banner ── */}
                      {isOpen && (
                        <tr key={`${g.display_name}-detail`}>
                          <td colSpan={4} style={{ padding: 0, background: "var(--surface2)" }}>
                            <div style={{
                              margin: "0 24px 16px",
                              borderRadius: 10,
                              border: "1px solid var(--border)",
                              overflow: "hidden",
                              marginTop: 8,
                            }}>
                              {/* Banner header */}
                              <div style={{
                                padding: "10px 16px",
                                background: "rgba(108,99,255,.08)",
                                borderBottom: "1px solid var(--border)",
                                display: "flex", alignItems: "center", gap: 8,
                              }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                </svg>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>
                                  Session history for {g.display_name}
                                </span>
                                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
                                  {g.sessions.length} session{g.sessions.length !== 1 ? "s" : ""} · total {fmtDuration(g.totalSeconds)}
                                </span>
                              </div>

                              {/* Session rows */}
                              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                    {["#", "JOINED", "LEFT", "DURATION"].map((h, i) => (
                                      <th key={h} style={{
                                        padding: "8px 14px", fontSize: 10, fontWeight: 700,
                                        color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em",
                                        textAlign: i === 3 ? "right" : "left", background: "transparent",
                                      }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.sessions.map((s, idx) => (
                                    <tr key={s.id} style={{ borderBottom: idx < g.sessions.length - 1 ? "1px solid var(--border)" : "none" }}>
                                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)", fontWeight: 600, width: 32 }}>
                                        {idx + 1}
                                      </td>
                                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text)", whiteSpace: "nowrap" }}>
                                        {fmtTime(s.joined_at)}
                                      </td>
                                      <td style={{ padding: "10px 14px", fontSize: 12, whiteSpace: "nowrap" }}>
                                        {s.left_at
                                          ? <span style={{ color: "var(--text)" }}>{fmtTime(s.left_at)}</span>
                                          : <span style={{ color: "#16a34a", fontWeight: 600 }}>● Still in</span>
                                        }
                                      </td>
                                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--text)", textAlign: "right" }}>
                                        {s.duration_seconds ? fmtDuration(s.duration_seconds) : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={partPage} totalPages={partTotalPages} total={filteredGroups.length} pageSize={PAGE_SIZE} onChange={setPartPage} />
          </>
        )}
      </div>
    </div>
  );
}

function SummaryPage({ meetings }) {
  const [summaries, setSummaries]         = useState({});
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState(null);
  const [search, setSearch]               = useState("");
  const [filter, setFilter]               = useState("all");
  const [sort, setSort]                   = useState("newest");
  const [page, setPage]                   = useState(1);
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  // Restore selected meeting from sessionStorage once meetings list is available
  useEffect(() => {
    const saved = sessionStorage.getItem("ud_summary_room");
    if (saved && meetings.length > 0) {
      const m = meetings.find(x => x.room_code === saved);
      if (m) setSelected(m);
    }
  }, [meetings]);

  function selectMeeting(m) { sessionStorage.setItem("ud_summary_room", m.room_code); setSelected(m); }
  function goBack()          { sessionStorage.removeItem("ud_summary_room"); setSelected(null); }

  useEffect(() => {
    if (meetings.length === 0) { setLoading(false); return; }
    setLoading(true);
    Promise.all(
      meetings.map(m =>
        apiFetch(`/api/v1/public/meetings/summary/${m.room_code}`)
          .then(d => [m.room_code, d])
          .catch(() => [m.room_code, null])
      )
    ).then(results => {
      const map = {};
      results.forEach(([code, d]) => { map[code] = d; });
      setSummaries(map);
    }).finally(() => setLoading(false));
  }, [meetings]);

  if (selected) return <SummaryDetail meeting={selected} summaryData={summaries[selected.room_code]} onBack={goBack} />;

  const totalParticipants = Object.values(summaries).reduce((s, d) => s + (d?.unique_participant_count || 0), 0);
  const meetingDurations = meetings.map(m => {
    const d = summaries[m.room_code];
    if (!d?.participants?.length) return null;
    // Sum all session durations per unique participant, then take the max across participants
    const byName = {};
    d.participants.forEach(p => {
      byName[p.display_name] = (byName[p.display_name] || 0) + (p.duration_seconds || 0);
    });
    const vals = Object.values(byName);
    return vals.length ? Math.max(...vals) : null;
  }).filter(x => x != null);
  const avgDuration     = meetingDurations.length ? Math.round(meetingDurations.reduce((s, v) => s + v, 0) / meetingDurations.length) : null;
  const longestDuration = meetingDurations.length ? Math.max(...meetingDurations) : null;

  let filtered = meetings.filter(m => {
    if (filter === "live"  && !m.is_active) return false;
    if (filter === "ended" &&  m.is_active) return false;
    const q = search.trim().toLowerCase();
    if (q && !m.name.toLowerCase().includes(q) && !m.room_code.includes(q)) return false;
    return true;
  });
  if (sort === "oldest") filtered = [...filtered].reverse();

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const paginated   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const STAT_CARDS = [
    { label: "TOTAL MEETINGS",      value: meetings.length,              sub: "all time" },
    { label: "TOTAL PARTICIPANTS",  value: loading ? "…" : totalParticipants, sub: "join sessions" },
    { label: "AVG DURATION",        value: loading ? "…" : fmtDuration(avgDuration),     sub: "per meeting" },
    { label: "LONGEST MEETING",     value: loading ? "…" : fmtDuration(longestDuration), sub: "ever" },
  ];

  return (
    <div className="ud-page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Summary</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            Overview of all meetings and activity.
          </p>
        </div>
        <button className="ud-btn ud-btn-ghost ud-btn-sm" onClick={() => { setSummaries({}); setLoading(true); }}
          style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {STAT_CARDS.map(c => (
          <div key={c.label} className="ud-stat-card">
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{c.label}</div>
            <div style={{ fontSize: c.value === "—" || c.value === "…" ? 22 : 28, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input placeholder="Search by name or room code…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: "100%", padding: "8px 12px 8px 34px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, outline: "none", background: "var(--surface)", color: "var(--text)", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
          {[["all","All"],["live","Live"],["ended","Ended"]].map(([val, lbl]) => (
            <button key={val} onClick={() => { setFilter(val); setPage(1); }} style={{
              padding: "7px 16px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
              background: filter === val ? "var(--primary)" : "transparent",
              color: filter === val ? "#fff" : "var(--muted)",
              fontFamily: "inherit",
            }}>{lbl}</button>
          ))}
        </div>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
          style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "var(--surface2)", color: "var(--text)", outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <button className="ud-btn ud-btn-ghost ud-btn-sm" onClick={() => setShowExportConfirm(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* Export confirmation modal */}
      {showExportConfirm && (
        <div className="ud-overlay" onClick={e => { if (e.target === e.currentTarget) setShowExportConfirm(false); }}>
          <div className="ud-modal" style={{ maxWidth: 420 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: "rgba(108,99,255,.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Export meetings as CSV?</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
                  {filtered.length} meeting{filtered.length !== 1 ? "s" : ""} will be included based on your current filters.
                </div>
              </div>
            </div>
            <div style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--muted)", lineHeight: 1.6,
            }}>
              The file will download immediately to your device. It includes meeting name, room code, date, duration, participant count, and status.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="ud-btn ud-btn-ghost" style={{ flex: 1 }} onClick={() => setShowExportConfirm(false)}>
                Cancel
              </button>
              <button className="ud-btn ud-btn-primary" style={{ flex: 1 }} onClick={() => {
                exportCSV(filtered, summaries);
                setShowExportConfirm(false);
              }}>
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {meetings.length === 0 ? (
        <div className="ud-section-card">
          <div className="ud-empty" style={{ padding: "48px 20px" }}>
            <h3>No meetings yet</h3>
            <p>Create a meeting and the participant summary will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="ud-section-card" style={{ padding: 0, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>No meetings match your filters.</div>
          ) : (
            <>
              <table className="ud-rec-table">
                <thead>
                  <tr>
                    <th style={{ padding: "12px 24px" }}>MEETING</th>
                    <th style={{ padding: "12px 12px" }}>DATE</th>
                    <th style={{ padding: "12px 12px" }}>DURATION</th>
                    <th style={{ padding: "12px 12px" }}>PEOPLE</th>
                    <th style={{ padding: "12px 24px", textAlign: "right" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(m => {
                    const sd = summaries[m.room_code];
                    const people = sd?.unique_participant_count ?? "—";
                    const byName = {};
                    (sd?.participants || []).forEach(p => {
                      byName[p.display_name] = (byName[p.display_name] || 0) + (p.duration_seconds || 0);
                    });
                    const durVals = Object.values(byName);
                    const dur = durVals.length ? fmtDuration(Math.max(...durVals)) : "—";
                    return (
                      <tr key={m.room_code} onClick={() => selectMeeting(m)} style={{ cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                        onMouseLeave={e => e.currentTarget.style.background = ""}
                      >
                        <td style={{ padding: "14px 24px" }}>
                          <div style={{ fontWeight: 600, color: "var(--text)" }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontFamily: "monospace" }}>{m.room_code}</div>
                        </td>
                        <td style={{ padding: "14px 12px", fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtTime(m.created_at)}</td>
                        <td style={{ padding: "14px 12px", fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{loading ? "…" : dur}</td>
                        <td style={{ padding: "14px 12px", fontSize: 13, color: "var(--text)" }}>{loading ? "…" : people}</td>
                        <td style={{ padding: "14px 24px", textAlign: "right" }}>
                          <span style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                            background: m.is_active ? "rgba(5,150,105,.1)" : "rgba(108,99,255,.1)",
                            color: m.is_active ? "#16a34a" : "var(--primary)",
                            textTransform: "uppercase", letterSpacing: "0.05em",
                          }}>{m.is_active ? "LIVE" : "ENDED"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={safePage} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          )}
        </div>
      )}
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
    id: "summary", label: "Summary",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
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


  // Re-fetch meetings when the browser tab regains visibility
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && isLoggedIn()) listMeetings().then(setMeetings).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  function navTo(id) {
    sessionStorage.setItem("ud_page", id);
    setActivePage(id);
    if (id === "overview") listMeetings().then(setMeetings).catch(() => {});
  }

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
        {activePage === "summary"    && <SummaryPage meetings={meetings} />}
        {activePage === "my-plan"    && <MyPlanPage user={user} onToast={showToast} onUserRefresh={loadUser} />}
        {activePage === "add-ons"    && <AddOnsPage user={user} onToast={showToast} onNavMyPlan={() => navTo("my-plan")} />}
        {activePage === "recordings" && <RecordingsPage />}
        {activePage === "faq"        && <FAQsPage />}
      </div>

      <div className={`ud-toast${toast.show ? " show" : ""}`}>{toast.msg}</div>

    </div>
  );
}
