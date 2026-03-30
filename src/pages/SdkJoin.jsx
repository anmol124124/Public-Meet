import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSdkGuestInfo, backendWsUrl } from "../api";

export default function SdkJoin() {
  const { roomName }  = useParams();
  const navigate      = useNavigate();
  const containerRef  = useRef(null);

  const SESSION_KEY = `wrtc_guest_session_${roomName}`;

  // True if the user refreshed mid-meeting (sessionStorage has their token)
  const [isRejoining] = useState(() => !!sessionStorage.getItem(`wrtc_guest_session_${roomName}`));

  const [info, setInfo]               = useState(null);
  const [error, setError]             = useState("");
  const [joined, setJoined]           = useState(false);
  const [sdkReady, setSdkReady]       = useState(false);
  const [refreshWarning, setRefreshWarning] = useState(false);

  // Load SDK script
  useEffect(() => {
    if (window.WebRTCMeetingAPI) { setSdkReady(true); return; }
    const base = window.BACKEND_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    const script = document.createElement("script");
    script.src = `${base}/public/js/app.js`;
    script.defer = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError("Failed to load meeting SDK.");
    document.head.appendChild(script);
  }, []);

  // Fetch meeting info
  useEffect(() => {
    getSdkGuestInfo(roomName)
      .then(setInfo)
      .catch(() => setError("Meeting not found or no longer available."));
  }, [roomName]);

  // Auto-rejoin if refreshed mid-meeting
  useEffect(() => {
    if (!sdkReady) return;
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const { guestToken } = JSON.parse(saved);
        // Show refresh warning banner for 5 seconds
        setRefreshWarning(true);
        setTimeout(() => setRefreshWarning(false), 5000);
        launchSdk(roomName, guestToken, true);
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, [sdkReady]);

  function launchSdk(room, token, reconnect = false) {
    setJoined(true);
    setTimeout(() => {
      new window.WebRTCMeetingAPI({
        serverUrl:  backendWsUrl(),
        roomName:   room,
        token:      token,
        reconnect:  reconnect,
        parentNode: containerRef.current,
        onLeave:    () => {
          // Keep session storage so rejoin can reuse the same token (same identity → no re-approval)
          navigate(`/sdk/leave/${room}`);
        },
      });
    }, 50);
  }

  const joinNow = () => {
    if (!info || !sdkReady) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ guestToken: info.guest_token }));
    launchSdk(info.room_name, info.guest_token);
  };

  if (joined) {
    return (
      <div style={styles.fullscreen}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        {refreshWarning && (
          <div style={styles.refreshBanner}>
            Avoid refreshing during meetings for a smoother experience
          </div>
        )}
      </div>
    );
  }

  // Refresh case: show reconnecting screen while SDK loads
  if (isRejoining && !joined) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.brand}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#1a73e8">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
            <span style={styles.brandName}>Meet</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "8px 0" }}>
            <div style={styles.spinner} />
            <p style={{ ...styles.heading, fontSize: "18px", textAlign: "center" }}>Rejoining meeting…</p>
            <p style={{ ...styles.subtext, textAlign: "center", marginBottom: 0 }}>
              Please wait, reconnecting you to the meeting.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {!info && !error && <div style={styles.spinner} />}

      {error && (
        <div style={styles.card}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔗</div>
          <h2 style={styles.heading}>Meeting not found</h2>
          <p style={styles.subtext}>{error}</p>
          <button style={styles.btn} onClick={() => navigate("/")}>Go home</button>
        </div>
      )}

      {info && (
        <div style={styles.card}>
          <div style={styles.brand}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#1a73e8">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
            <span style={styles.brandName}>Meet</span>
          </div>

          <h1 style={styles.heading}>{info.name}</h1>
          <p style={styles.subtext}>
            You're about to join as a guest. The host will admit you shortly.
          </p>

          <button
            style={{ ...styles.btn, opacity: sdkReady ? 1 : 0.5 }}
            disabled={!sdkReady}
            onClick={joinNow}
          >
            {sdkReady ? "Join Meeting" : "Loading…"}
          </button>
        </div>
      )}
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
  fullscreen: {
    position: "fixed",
    inset: 0,
    background: "linear-gradient(135deg,#13151c 0%,#1a1d26 100%)",
  },
  refreshBanner: {
    position: "fixed",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(251,188,4,0.95)",
    color: "#202124",
    padding: "10px 20px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "500",
    zIndex: 9999,
    pointerEvents: "none",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 16px rgba(0,0,0,.3)",
  },
  card: {
    background: "rgba(255,255,255,.04)",
    borderRadius: "20px",
    padding: "40px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 24px 64px rgba(0,0,0,.6),0 2px 8px rgba(0,0,0,.3)",
    border: "1px solid rgba(255,255,255,.07)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "28px",
  },
  brandName: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#e8eaed",
    letterSpacing: "0.2px",
  },
  heading: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#e8eaed",
    marginBottom: "8px",
  },
  subtext: {
    fontSize: "14px",
    color: "#9aa0a6",
    marginBottom: "28px",
    lineHeight: "1.6",
  },
  btn: {
    background: "linear-gradient(135deg,#1a73e8,#4d94ff)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: "600",
    width: "100%",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(26,115,232,.45)",
    transition: "opacity .15s,transform .1s",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(255,255,255,.08)",
    borderTop: "3px solid #4d94ff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
