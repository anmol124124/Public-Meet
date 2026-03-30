import React from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function SdkLeave() {
  const { roomName } = useParams();
  const navigate     = useNavigate();

  const handleRejoin = () => {
    // Session storage kept intentionally — same token = same identity = was_admitted bypass
    navigate(`/sdk/join/${roomName}`);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          {/* Animated checkmark */}
          <svg width="40" height="40" viewBox="0 0 52 52" fill="none">
            <circle cx="26" cy="26" r="25" stroke="#4d94ff" strokeWidth="2" opacity="0.4"/>
            <path
              d="M14 27l8 8 16-16"
              stroke="#4d94ff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: 48, strokeDashoffset: 0 }}
            />
          </svg>
        </div>

        <h1 style={styles.heading}>Thanks for joining!</h1>
        <p style={styles.subtext}>
          You've left the meeting. We hope it was a great experience.
        </p>

        <button
          style={styles.btnPrimary}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
          onClick={handleRejoin}
        >
          Rejoin Meeting
        </button>
        <button
          style={styles.btnSecondary}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
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
    background: "rgba(77,148,255,0.1)",
    border: "1px solid rgba(77,148,255,0.2)",
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
