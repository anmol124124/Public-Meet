import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export default function SdkLeave() {
  const { roomName }    = useParams();
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const ended          = searchParams.get("ended");
  const role           = searchParams.get("role");
  const endedByHost    = ended === "1";
  const timeLimitHost  = ended === "timelimit" && role === "host";
  const timeLimitGuest = ended === "timelimit" && role === "guest";

  if (timeLimitHost) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.iconWrap, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h1 style={styles.heading}>Meeting Time Limit Reached</h1>
          <p style={styles.subtext}>
            Your meeting ended because the plan's time limit was reached.
            Upgrade to host longer meetings.
          </p>
          <button style={styles.btnUpgrade} onClick={() => navigate("/dashboard")}>Upgrade Plan</button>
          <button style={styles.btnSecondary} onClick={() => navigate("/")}>Go Home</button>
        </div>
      </div>
    );
  }

  if (timeLimitGuest) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.iconWrap, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h1 style={styles.heading}>Meeting Ended</h1>
          <p style={styles.subtext}>
            This meeting ended due to the host's plan time limit.
            Please ask the host to upgrade their plan.
          </p>
          <button style={styles.btnSecondary} onClick={() => navigate("/")}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{
          ...styles.iconWrap,
          background: endedByHost ? "rgba(234,67,53,0.1)" : "rgba(77,148,255,0.1)",
          border: `1px solid ${endedByHost ? "rgba(234,67,53,0.2)" : "rgba(77,148,255,0.2)"}`,
        }}>
          {endedByHost ? (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ea4335" strokeWidth="1.8">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
              <line x1="2" y1="2" x2="22" y2="22"/>
            </svg>
          ) : (
            <svg width="40" height="40" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="25" stroke="#4d94ff" strokeWidth="2" opacity="0.4"/>
              <path d="M14 27l8 8 16-16" stroke="#4d94ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 48, strokeDashoffset: 0 }}/>
            </svg>
          )}
        </div>

        <h1 style={styles.heading}>
          {endedByHost ? "Meeting ended" : "Thanks for joining!"}
        </h1>
        <p style={styles.subtext}>
          {endedByHost
            ? "The host has ended this meeting for everyone."
            : "You've left the meeting. We hope it was a great experience."}
        </p>

        {!endedByHost && (
          <button
            style={styles.btnPrimary}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
            onClick={() => navigate(`/sdk/join/${roomName}`)}
          >
            Rejoin Meeting
          </button>
        )}
        <button
          style={endedByHost ? styles.btnPrimary : styles.btnSecondary}
          onMouseEnter={e => { e.currentTarget.style.background = endedByHost ? "rgba(26,115,232,.85)" : "rgba(255,255,255,.06)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = endedByHost ? "linear-gradient(135deg,#1a73e8,#4d94ff)" : "transparent"; }}
          onClick={() => navigate("/")}
        >
          Go Home
        </button>
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
    background: "linear-gradient(135deg,#13151c 0%,#1a1d26 60%,#1c1f2e 100%)",
  },
  card: {
    background: "rgba(255,255,255,.04)",
    borderRadius: "20px",
    padding: "48px 40px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 24px 64px rgba(0,0,0,.6),0 2px 8px rgba(0,0,0,.3)",
    border: "1px solid rgba(255,255,255,.07)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  iconWrap: {
    width: "84px",
    height: "84px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "28px",
  },
  heading: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#e8eaed",
    margin: "0 0 10px",
    letterSpacing: "0.1px",
  },
  subtext: {
    fontSize: "14px",
    color: "#9aa0a6",
    lineHeight: "1.65",
    margin: "0 0 32px",
  },
  btnPrimary: {
    background: "linear-gradient(135deg,#1a73e8,#4d94ff)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: "600",
    width: "100%",
    cursor: "pointer",
    marginBottom: "10px",
    boxShadow: "0 4px 20px rgba(26,115,232,.4)",
    transition: "opacity .15s,transform .1s",
  },
  btnUpgrade: {
    background: "linear-gradient(135deg,#f59e0b,#d97706)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: "600",
    width: "100%",
    cursor: "pointer",
    marginBottom: "10px",
    boxShadow: "0 4px 20px rgba(245,158,11,.4)",
  },
  btnSecondary: {
    background: "transparent",
    color: "#9aa0a6",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: "10px",
    padding: "13px",
    fontSize: "15px",
    fontWeight: "500",
    width: "100%",
    cursor: "pointer",
    transition: "background .15s",
  },
};
