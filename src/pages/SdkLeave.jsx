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
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="1.5">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        </div>

        <h1 style={styles.heading}>Thanks for joining!</h1>
        <p style={styles.subtext}>
          You have left the meeting. We hope it was a great experience.
        </p>

        <button style={styles.btnPrimary} onClick={handleRejoin}>
          Rejoin Meeting
        </button>
        <button style={styles.btnSecondary} onClick={() => navigate("/")}>
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
    background: "#202124",
  },
  card: {
    background: "#2d2e31",
    borderRadius: "16px",
    padding: "40px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 8px 40px rgba(0,0,0,.5)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  iconWrap: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    background: "rgba(26,115,232,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "24px",
  },
  heading: {
    fontSize: "22px",
    fontWeight: "600",
    color: "#e8eaed",
    marginBottom: "8px",
    margin: "0 0 8px",
  },
  subtext: {
    fontSize: "14px",
    color: "#9aa0a6",
    lineHeight: "1.6",
    marginBottom: "28px",
    margin: "0 0 28px",
  },
  btnPrimary: {
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "13px",
    fontSize: "15px",
    fontWeight: "500",
    width: "100%",
    cursor: "pointer",
    marginBottom: "10px",
  },
  btnSecondary: {
    background: "transparent",
    color: "#9aa0a6",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: "10px",
    padding: "12px",
    fontSize: "15px",
    fontWeight: "500",
    width: "100%",
    cursor: "pointer",
  },
};
