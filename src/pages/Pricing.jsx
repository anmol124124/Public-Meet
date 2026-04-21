import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, activatePlan, createMeeting, getHostToken, isLoggedIn } from "../api";

const PLANS = [
  {
    id:       "free",
    name:     "Free",
    price:    "$0",
    period:   "forever",
    color:    "#5f6368",
    features: ["40-minute meetings", "Up to 100 participants", "Chat & screen share", "No credit card required"],
    cta:      "Start for Free",
  },
  {
    id:       "basic",
    name:     "Basic",
    price:    "$9.99",
    period:   "/month",
    color:    "#1a73e8",
    features: ["24-hour meetings", "Up to 100 participants", "Chat & screen share", "Meeting recordings"],
    cta:      "Choose Basic",
  },
  {
    id:       "pro",
    name:     "Pro",
    price:    "$29.99",
    period:   "/month",
    color:    "#6c63ff",
    popular:  true,
    features: ["Unlimited meeting duration", "Up to 300 participants", "Everything in Basic", "Priority support"],
    cta:      "Choose Pro",
  },
  {
    id:       "enterprise",
    name:     "Enterprise",
    price:    "Custom",
    period:   "",
    color:    "#f59e0b",
    features: ["Unlimited everything", "White-label branding", "Dedicated support", "Custom SLA & SSO"],
    cta:      "Contact Sales",
  },
];

function PaymentModal({ plan, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      await activatePlan(plan.id);
      onSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>💳</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#e8eaed" }}>Complete your purchase</div>
          <div style={{ fontSize: 13, color: "#9aa0a6", marginTop: 4 }}>Sandbox — no real charge</div>
        </div>

        <div style={s.summary}>
          <div style={s.row}>
            <span style={{ color: "#9aa0a6", fontSize: 14 }}>Plan</span>
            <span style={{ color: "#bdc1c6", fontWeight: 500 }}>{plan.name}</span>
          </div>
          <div style={s.row}>
            <span style={{ color: "#9aa0a6", fontSize: 14 }}>Billing</span>
            <span style={{ color: "#bdc1c6", fontWeight: 500 }}>Monthly</span>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", margin: "8px 0" }} />
          <div style={s.row}>
            <span style={{ color: "#e8eaed", fontWeight: 600 }}>Total today</span>
            <span style={{ color: "#e8eaed", fontWeight: 700, fontSize: 20 }}>{plan.price}</span>
          </div>
        </div>

        <div style={s.sandboxNote}>
          🧪 Sandbox environment. Click "Pay Now" to simulate a successful payment.
        </div>

        {error && <div style={{ color: "#ea4335", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button
          style={{ ...s.payBtn, opacity: loading ? 0.7 : 1 }}
          onClick={handlePay}
          disabled={loading}
        >
          {loading ? "Processing…" : `Pay ${plan.price}`}
        </button>
        <button style={s.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>
      </div>
    </div>
  );
}

function EnterpriseModal({ onClose }) {
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [company, setCompany] = useState("");
  const [sent, setSent]     = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: 440 }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaed", marginBottom: 8 }}>We'll be in touch!</div>
            <div style={{ fontSize: 13, color: "#9aa0a6", marginBottom: 24 }}>Our team will contact you within 1 business day.</div>
            <button style={s.payBtn} onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e8eaed" }}>Contact Sales</div>
              <div style={{ fontSize: 13, color: "#9aa0a6", marginTop: 4 }}>Tell us about your needs and we'll get back to you.</div>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input style={s.input} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
              <input style={s.input} type="email" placeholder="Work email" value={email} onChange={e => setEmail(e.target.value)} required />
              <input style={s.input} placeholder="Company name" value={company} onChange={e => setCompany(e.target.value)} required />
              <button type="submit" style={{ ...s.payBtn, marginTop: 4 }}>Submit</button>
              <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function Pricing() {
  const navigate = useNavigate();
  const [userPlan, setUserPlan]         = useState(null);
  const [loadingPlan, setLoadingPlan]   = useState(""); // which plan is being activated
  const [payModal, setPayModal]         = useState(null); // plan object or null
  const [entModal, setEntModal]         = useState(false);
  const [error, setError]               = useState("");

  const pendingName     = sessionStorage.getItem("pending_meeting_name");
  const pendingSettings = sessionStorage.getItem("pending_meeting_settings");

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/auth", { replace: true }); return; }
    getMe().then(u => setUserPlan(u.plan)).catch(() => {});
  }, []);

  async function startMeeting(planId) {
    setLoadingPlan(planId);
    setError("");
    try {
      const name     = pendingName || "My Meeting";
      const settings = pendingSettings ? JSON.parse(pendingSettings) : {};
      sessionStorage.removeItem("pending_meeting_name");
      sessionStorage.removeItem("pending_meeting_settings");
      const data         = await createMeeting(name, settings);
      const { token, name: hostName } = await getHostToken(data.room_code);
      navigate(`/${data.room_code}`, { state: { hostToken: token, hostName }, replace: true });
    } catch (e) {
      setError(e.message);
      setLoadingPlan("");
    }
  }

  async function handleSelect(plan) {
    if (plan.id === "enterprise") { setEntModal(true); return; }
    if (plan.id === "free") { await startMeeting("free"); return; }
    // Basic / Pro → show payment modal
    setPayModal(plan);
  }

  async function handlePaySuccess() {
    setPayModal(null);
    await startMeeting(payModal?.id || "basic");
  }

  const meetingTitle = pendingName || "your meeting";

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.brand}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#1a73e8">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#e8eaed" }}>RoomLy</span>
        </div>
        <div style={{ fontSize: 13, color: "#9aa0a6" }}>
          Starting: <span style={{ color: "#e8eaed", fontWeight: 500 }}>"{meetingTitle}"</span>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#e8eaed", margin: "0 0 10px" }}>Choose your plan</h1>
        <p style={{ fontSize: 15, color: "#9aa0a6", margin: 0 }}>Select a plan to start your meeting. Upgrade anytime.</p>
      </div>

      {error && (
        <div style={{ color: "#ea4335", fontSize: 13, textAlign: "center", marginBottom: 20 }}>{error}</div>
      )}

      {/* Plan cards */}
      <div style={s.grid}>
        {PLANS.map(plan => {
          const isCurrent = userPlan === plan.id || (plan.id === "free" && !userPlan);
          const isLoading = loadingPlan === plan.id;
          return (
            <div key={plan.id} style={{
              ...s.card,
              borderColor: plan.popular ? plan.color : "rgba(255,255,255,.1)",
              boxShadow: plan.popular ? `0 0 0 2px ${plan.color}` : "none",
            }}>
              {plan.popular && (
                <div style={{ ...s.badge, background: plan.color }}>Most Popular</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: plan.color, marginBottom: 8 }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: plan.price === "Custom" ? 24 : 32, fontWeight: 800, color: "#e8eaed" }}>{plan.price}</span>
                {plan.period && <span style={{ fontSize: 13, color: "#9aa0a6", paddingBottom: 6 }}>{plan.period}</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28, flex: 1 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#bdc1c6" }}>
                    <span style={{ color: plan.color, fontSize: 16, lineHeight: 1 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
              {isCurrent && plan.id !== "free" ? (
                <button
                  style={{ ...s.planBtn, background: plan.color, opacity: isLoading ? 0.7 : 1 }}
                  onClick={() => startMeeting(plan.id)}
                  disabled={isLoading}
                >
                  {isLoading ? "Starting…" : "Continue with " + plan.name}
                </button>
              ) : (
                <button
                  style={{ ...s.planBtn, background: plan.id === "free" ? "rgba(255,255,255,.1)" : plan.color, opacity: isLoading ? 0.7 : 1 }}
                  onClick={() => handleSelect(plan)}
                  disabled={!!loadingPlan}
                >
                  {isLoading ? "Starting…" : plan.cta}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {payModal && (
        <PaymentModal
          plan={payModal}
          onSuccess={handlePaySuccess}
          onCancel={() => setPayModal(null)}
        />
      )}
      {entModal && <EnterpriseModal onClose={() => setEntModal(false)} />}
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#202124",
    padding: "0 24px 60px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 0 32px",
    maxWidth: 960,
    margin: "0 auto",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  grid: {
    display: "flex",
    gap: 20,
    maxWidth: 960,
    margin: "0 auto",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  card: {
    flex: "1 1 200px",
    maxWidth: 220,
    background: "#2d2e31",
    borderRadius: 16,
    border: "1.5px solid",
    padding: "28px 22px",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -12,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "3px 14px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    color: "#fff",
    whiteSpace: "nowrap",
  },
  planBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "none",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 24,
  },
  modal: {
    background: "#2d2e31",
    borderRadius: 16,
    padding: 40,
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 8px 40px rgba(0,0,0,.6)",
  },
  summary: {
    background: "rgba(255,255,255,.05)",
    borderRadius: 10,
    padding: "16px 20px",
    marginBottom: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sandboxNote: {
    fontSize: 12,
    color: "#9aa0a6",
    background: "rgba(26,115,232,.1)",
    borderLeft: "3px solid #1a73e8",
    borderRadius: 6,
    padding: "8px 12px",
    marginBottom: 16,
  },
  payBtn: {
    width: "100%",
    padding: "13px",
    borderRadius: 10,
    border: "none",
    background: "#1a73e8",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 8,
  },
  cancelBtn: {
    width: "100%",
    padding: "10px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#9aa0a6",
    fontSize: 14,
    cursor: "pointer",
  },
  input: {
    background: "rgba(255,255,255,.07)",
    border: "1.5px solid rgba(255,255,255,.15)",
    borderRadius: 10,
    padding: "12px 14px",
    color: "#e8eaed",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  },
};
