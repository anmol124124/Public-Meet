import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, signup, getHostToken, getMe } from "../api";

const PW_RULES = [
  { label: "At least 8 characters",        test: (p) => p.length >= 8 },
  { label: "One uppercase letter (A–Z)",    test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a–z)",    test: (p) => /[a-z]/.test(p) },
  { label: "One number (0–9)",              test: (p) => /[0-9]/.test(p) },
  { label: "One special character (!@#…)",  test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

function PasswordHint({ password }) {
  if (!password) return null;
  const allPassed = PW_RULES.every(r => r.test(password));
  if (allPassed) return null;
  return (
    <div style={styles.pwHint}>
      {PW_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <div key={rule.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: ok ? "#34a853" : "#ea4335", fontSize: 13, lineHeight: 1 }}>
              {ok ? "✓" : "✗"}
            </span>
            <span style={{ color: ok ? "#34a853" : "#9aa0a6", fontSize: 12 }}>{rule.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Auth() {
  const [tab, setTab]             = useState("signup"); // default to signup
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showCpw, setShowCpw]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  function switchTab(t) {
    setTab(t);
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPw("");
    setShowPw(false);
    setShowCpw(false);
    setError("");
  }

  const navigate   = useNavigate();
  const [params]   = useSearchParams();
  const roomCode   = params.get("roomCode");  // if coming from a meeting
  const redirectTo = params.get("redirect") || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tab === "signup" && name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (tab === "signup" && !PW_RULES.every(r => r.test(password))) {
      setError("Password does not meet the required criteria.");
      return;
    }
    if (tab === "signup" && password !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const isSignup = tab === "signup";
      if (tab === "login") {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }

      // If coming from a meeting → get host token and go to room
      if (roomCode) {
        try {
          const { token } = await getHostToken(roomCode);
          navigate(`/${roomCode}/room`, {
            state: { token, name: name || email, isHost: true },
            replace: true,
          });
          return;
        } catch {
          navigate("/", { replace: true });
          return;
        }
      }

      // If there's a pending meeting, route through pricing for new signups
      const hasPending  = !!sessionStorage.getItem("pending_meeting_name");
      if (hasPending) {
        if (isSignup) {
          // New signup always needs to pick a plan first
          navigate("/pricing", { replace: true });
        } else {
          // Existing login: skip pricing if they already have a plan
          const user = await getMe();
          if (user.plan) {
            navigate("/", { replace: true });
          } else {
            navigate("/pricing", { replace: true });
          }
        }
        return;
      }

      navigate(redirectTo, { replace: true });
    } catch (err) {
      // If signup fails because email already exists, switch to login tab
      if (tab === "signup" && err.message?.toLowerCase().includes("already")) {
        setTab("login");
        setError("This email is already registered. Please sign in.");
      } else if (tab === "login" && err.message?.toLowerCase().includes("invalid")) {
        setError("Invalid credentials.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Brand */}
        <div style={styles.brand}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#1a73e8">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
          <span style={styles.brandName}>RoomLy</span>
        </div>

        {roomCode && (
          <p style={styles.meetingHint}>
            Sign in to start your meeting
          </p>
        )}

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(tab === "signup" ? styles.tabActive : {}) }}
            onClick={() => switchTab("signup")}
          >
            Sign up
          </button>
          <button
            style={{ ...styles.tab, ...(tab === "login" ? styles.tabActive : {}) }}
            onClick={() => switchTab("login")}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {tab === "signup" && (
            <input
              style={styles.input}
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              autoFocus
            />
          )}
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={100}
            required
            autoFocus={tab === "login"}
          />
          <div style={{ position: "relative" }}>
            <input
              style={{ ...styles.input, paddingRight: "44px" }}
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              style={styles.eyeBtn}
              tabIndex={-1}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

          {tab === "signup" && <PasswordHint password={password} />}

          {tab === "signup" && (
            <div style={{ position: "relative" }}>
              <input
                style={{ ...styles.input, paddingRight: "44px" }}
                type={showCpw ? "text" : "password"}
                placeholder="Confirm password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowCpw(v => !v)}
                style={styles.eyeBtn}
                tabIndex={-1}
                aria-label={showCpw ? "Hide password" : "Show password"}
              >
                {showCpw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
            disabled={loading}
          >
            {loading
              ? "Please wait…"
              : roomCode
                ? tab === "signup" ? "Sign up & Start Meeting" : "Sign in & Start Meeting"
                : tab === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "#202124",
  },
  card: {
    background: "#2d2e31",
    borderRadius: "16px",
    padding: "40px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 8px 40px rgba(0,0,0,.5)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "20px",
  },
  brandName: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#e8eaed",
  },
  meetingHint: {
    fontSize: "13px",
    color: "#9aa0a6",
    marginBottom: "16px",
    padding: "10px 14px",
    background: "rgba(26,115,232,.1)",
    borderRadius: "8px",
    borderLeft: "3px solid #1a73e8",
  },
  tabs: {
    display: "flex",
    gap: "4px",
    marginBottom: "24px",
    background: "rgba(255,255,255,.06)",
    borderRadius: "10px",
    padding: "4px",
  },
  tab: {
    flex: 1,
    padding: "8px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "#9aa0a6",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  tabActive: {
    background: "#3c4043",
    color: "#e8eaed",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  input: {
    background: "rgba(255,255,255,.07)",
    border: "1.5px solid rgba(255,255,255,.15)",
    borderRadius: "10px",
    padding: "13px 16px",
    color: "#e8eaed",
    fontSize: "15px",
    width: "100%",
    boxSizing: "border-box",
  },
  btn: {
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "13px",
    fontSize: "15px",
    fontWeight: "500",
    width: "100%",
    cursor: "pointer",
    marginTop: "4px",
  },
  error: {
    color: "#ea4335",
    fontSize: "13px",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    lineHeight: 0,
  },
  pwHint: {
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: "8px",
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: "-4px",
  },
};
