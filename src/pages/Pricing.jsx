import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, activatePlan, createMeeting, getHostToken, isLoggedIn } from "../api";

const PLANS = [
  {
    id:       "free",
    name:     "Starter",
    price:    "$0",
    period:   "/ month",
    subline:  "Free forever",
    color:    "#5f6368",
    features: ["Up to 5-minute meeting duration", "Up to 2 participants", "Chat & screen share", "No credit card required"],
    cta:      "Start Free",
  },
  {
    id:       "basic",
    name:     "Basic",
    price:    "$9.99",
    period:   "/ month",
    color:    "#1a73e8",
    features: ["Up to 10-minute meeting duration", "Up to 4 participants", "Chat & screen share", "Meeting recordings"],
    cta:      "Upgrade to Basic",
  },
  {
    id:       "pro",
    name:     "Pro",
    price:    "$29.99",
    period:   "/ month",
    color:    "#6c63ff",
    popular:  true,
    features: ["Unlimited meeting duration", "Up to 6 participants", "Everything in Basic", "Priority support"],
    cta:      "Upgrade to Pro",
  },
  {
    id:       "enterprise",
    name:     "Enterprise",
    price:    "Custom",
    period:   "",
    color:    "#f59e0b",
    features: ["Unlimited meeting duration", "Unlimited participants", "White-label branding", "Dedicated support & SSO"],
    cta:      "Contact Sales",
  },
];

function HoverCard({ plan, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.card,
        borderColor: plan.popular ? plan.color : hovered ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.1)",
        boxShadow: plan.popular
          ? `0 0 0 2px ${plan.color}, 0 ${hovered ? 16 : 8}px ${hovered ? 48 : 40}px rgba(0,0,0,.5)`
          : hovered ? "0 8px 32px rgba(0,0,0,.5)" : "none",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
      }}
    >
      {children(hovered)}
    </div>
  );
}

function HoverButton({ baseColor, style, onClick, disabled, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.planBtn,
        background: baseColor,
        filter: hovered && !disabled ? "brightness(1.15)" : "none",
        transform: hovered && !disabled ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hovered && !disabled ? `0 4px 16px rgba(0,0,0,.35)` : "none",
        transition: "filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

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
  const pendingType     = sessionStorage.getItem("pending_meeting_type");

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/auth", { replace: true }); return; }
    getMe().then(u => setUserPlan(u.plan)).catch(() => {});
  }, []);

  async function startMeeting(planId) {
    setLoadingPlan(planId);
    setError("");
    try {
      // Plan activation is handled by PaymentModal (paid) or here for free
      if (planId === "free") await activatePlan("free");

      if (pendingType === "scheduled") {
        // Signal Home's useEffect that pricing was completed — safe to create the meeting
        sessionStorage.setItem("pending_return_confirmed", "1");
        navigate("/", { replace: true });
        return;
      }

      // Instant meeting: create and go to room
      const name     = pendingName || "My Meeting";
      const settings = pendingSettings ? JSON.parse(pendingSettings) : {};
      sessionStorage.removeItem("pending_meeting_name");
      sessionStorage.removeItem("pending_meeting_settings");
      sessionStorage.removeItem("pending_meeting_type");
      sessionStorage.removeItem("pending_schedule");
      const data               = await createMeeting(name, settings);
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
        <a href="/" style={{ textDecoration: "none" }}>
          <div style={{ ...s.brand, cursor: "pointer" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#1a73e8">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#e8eaed" }}>RoomLy</span>
          </div>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 13, color: "#9aa0a6" }}>
            Meeting: <span style={{ color: "#e8eaed", fontWeight: 500 }}>"{meetingTitle}"</span>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={s.backBtn}
          >
            ← Back
          </button>
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
            <HoverCard key={plan.id} plan={plan}>
              {(cardHovered) => (
                <>
                  {plan.popular && (
                    <div style={{ ...s.badge, background: plan.color }}>Most Popular</div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: plan.color, marginBottom: 8 }}>{plan.name}</div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                      <span style={{ fontSize: plan.price === "Custom" ? 24 : 32, fontWeight: 800, color: "#e8eaed" }}>{plan.price}</span>
                      {plan.period && <span style={{ fontSize: 13, color: "#9aa0a6", paddingBottom: 6 }}>{plan.period}</span>}
                    </div>
                    {plan.subline && <div style={{ fontSize: 11, color: "#9aa0a6", marginTop: 2 }}>{plan.subline}</div>}
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
                    <HoverButton
                      baseColor={plan.color}
                      style={{ opacity: isLoading ? 0.7 : 1 }}
                      onClick={() => startMeeting(plan.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? "Starting…" : "Continue with " + plan.name}
                    </HoverButton>
                  ) : (
                    <HoverButton
                      baseColor={plan.id === "free" ? "rgba(255,255,255,.15)" : plan.color}
                      style={{ opacity: isLoading ? 0.7 : 1 }}
                      onClick={() => handleSelect(plan)}
                      disabled={!!loadingPlan}
                    >
                      {isLoading ? "Starting…" : plan.cta}
                    </HoverButton>
                  )}
                </>
              )}
            </HoverCard>
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
  backBtn: {
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 8,
    color: "#9aa0a6",
    fontSize: 13,
    padding: "6px 14px",
    cursor: "pointer",
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
