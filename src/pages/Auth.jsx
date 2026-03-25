import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, signup, getHostToken } from "../api";

export default function Auth() {
  const [tab, setTab]           = useState("signup"); // default to signup
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const navigate   = useNavigate();
  const [params]   = useSearchParams();
  const roomCode   = params.get("roomCode");  // if coming from a meeting
  const redirectTo = params.get("redirect") || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tab === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
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
        } catch {
          // Meeting not owned by this user (or stale URL) — go home
          navigate("/", { replace: true });
        }
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      // If signup fails because email already exists, switch to login tab
      if (tab === "signup" && err.message?.toLowerCase().includes("already")) {
        setTab("login");
        setError("This email is already registered. Please sign in.");
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
          <span style={styles.brandName}>Meet</span>
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
            onClick={() => { setTab("signup"); setError(""); }}
          >
            Sign up
          </button>
          <button
            style={{ ...styles.tab, ...(tab === "login" ? styles.tabActive : {}) }}
            onClick={() => { setTab("login"); setError(""); }}
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
            required
            autoFocus={tab === "login"}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

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
};
