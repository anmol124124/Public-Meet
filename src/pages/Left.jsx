import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export default function Left() {
  const { roomCode }       = useParams();
  const navigate           = useNavigate();
  const [searchParams]     = useSearchParams();
  const ended              = searchParams.get("ended");
  const role               = searchParams.get("role");
  const endedByHost        = ended === "1";
  const timeLimitHost      = ended === "timelimit" && role === "host";
  const timeLimitGuest     = ended === "timelimit" && role === "guest";

  if (endedByHost) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.iconWrap, background: "rgba(234,67,53,.12)" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ea4335" strokeWidth="1.8">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
              <line x1="2" y1="2" x2="22" y2="22"/>
            </svg>
          </div>
          <h2 style={styles.title}>Meeting ended</h2>
          <p style={styles.sub}>The host has ended this meeting for everyone.</p>
          <div style={styles.actions}>
            <button style={styles.primaryBtn} onClick={() => navigate("/")}>
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (timeLimitHost) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.iconWrap, background: "rgba(245,158,11,.12)" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h2 style={styles.title}>Meeting Time Limit Reached</h2>
          <p style={styles.sub}>
            Your meeting ended because the plan's time limit was reached.
            Upgrade your plan to host longer meetings.
          </p>
          <div style={styles.actions}>
            <button style={styles.upgradeBtn} onClick={() => navigate("/dashboard")}>
              Upgrade Plan
            </button>
            <button style={styles.ghostBtn} onClick={() => navigate("/")}>
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (timeLimitGuest) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.iconWrap, background: "rgba(245,158,11,.12)" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h2 style={styles.title}>Meeting Ended</h2>
          <p style={styles.sub}>
            This meeting ended due to the host's plan time limit.
            Please ask the host to upgrade their plan to host longer meetings.
          </p>
          <div style={styles.actions}>
            <button style={styles.ghostBtn} onClick={() => navigate("/")}>
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#1a73e8">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        </div>
        <h2 style={styles.title}>You left the meeting</h2>
        <p style={styles.sub}>Thanks for joining! You can rejoin anytime.</p>
        <div style={styles.actions}>
          <button style={styles.primaryBtn} onClick={() => navigate(`/${roomCode}/room`)}>
            Rejoin
          </button>
          <button style={styles.ghostBtn} onClick={() => navigate("/")}>
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    position: "fixed", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#202124",
    fontFamily: "'Google Sans', Roboto, sans-serif",
  },
  card: {
    background: "#2d2e31", borderRadius: "20px",
    padding: "48px 40px", textAlign: "center",
    maxWidth: "400px", width: "100%",
    boxShadow: "0 8px 40px rgba(0,0,0,.5)",
  },
  iconWrap: {
    width: "80px", height: "80px", borderRadius: "50%",
    background: "rgba(26,115,232,.12)",
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 24px",
  },
  title:      { fontSize: "22px", fontWeight: "600", color: "#e8eaed", marginBottom: "10px" },
  sub:        { fontSize: "14px", color: "#9aa0a6", lineHeight: 1.6, marginBottom: "32px" },
  actions:    { display: "flex", flexDirection: "column", gap: "12px" },
  primaryBtn: {
    background: "#1a73e8", color: "#fff", border: "none",
    borderRadius: "10px", padding: "13px", fontSize: "15px",
    fontWeight: "500", cursor: "pointer", width: "100%",
  },
  upgradeBtn: {
    background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none",
    borderRadius: "10px", padding: "13px", fontSize: "15px",
    fontWeight: "600", cursor: "pointer", width: "100%",
  },
  ghostBtn: {
    background: "transparent", color: "#9aa0a6",
    border: "1.5px solid rgba(255,255,255,.15)",
    borderRadius: "10px", padding: "13px", fontSize: "15px",
    fontWeight: "500", cursor: "pointer", width: "100%",
  },
};
