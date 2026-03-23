import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { backendWsUrl } from "../api";

export default function Room() {
  const { roomCode } = useParams();
  const location     = useLocation();
  const navigate     = useNavigate();
  const containerRef = useRef(null);
  const apiRef       = useRef(null);
  const SESSION_KEY  = `meet_session_${roomCode}`;
  const [left, setLeft] = useState(false);

  // useRef so the value is stable across re-renders and reliably captured in useEffect
  const sessionRef = useRef(null);
  if (sessionRef.current === null) {
    const fromNav = location.state;
    if (fromNav?.token) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(fromNav));
      sessionRef.current = fromNav;
    } else {
      const saved = sessionStorage.getItem(SESSION_KEY);
      sessionRef.current = saved ? JSON.parse(saved) : {};
    }
  }

  useEffect(() => {
    const session = sessionRef.current;

    if (!session?.token) {
      navigate(`/${roomCode}`, { replace: true });
      return;
    }

    const backendBase = (window.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
    const script = document.createElement("script");
    script.src   = `${backendBase}/public/js/app.js?v=${Date.now()}`;
    script.async = true;

    script.onload = () => {
      if (!containerRef.current) return;
      // Pre-seed name so the SDK skips its own "Enter your name" prompt
      if (session.name) {
        sessionStorage.setItem(`wrtc_name_${roomCode}`, session.name);
      }
      apiRef.current = new window.WebRTCMeetingAPI({
        serverUrl:  backendWsUrl(),
        roomName:   roomCode,
        token:      session.token,
        parentNode: containerRef.current,
        onLeave:    () => {
          if (session.isHost) {
            navigate('/');
          } else {
            setLeft(true);
          }
        },
      });
    };

    script.onerror = () => {
      if (containerRef.current) {
        containerRef.current.innerHTML =
          '<div style="color:#ea4335;padding:24px;font-family:sans-serif">Failed to load meeting SDK. Please refresh.</div>';
      }
    };

    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  if (left) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.iconWrap}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#1a73e8">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </div>
          <h2 style={styles.title}>You left the meeting</h2>
          <p style={styles.sub}>Thanks for joining! We hope to see you again soon.</p>
          <button style={styles.btn} onClick={() => navigate('/')}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "fixed", inset: 0, background: "#202124" }}
    />
  );
}

const styles = {
  page: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#202124",
    fontFamily: "'Google Sans', Roboto, sans-serif",
    zIndex: 9999,
  },
  card: {
    background: "#2d2e31",
    borderRadius: "20px",
    padding: "48px 40px",
    textAlign: "center",
    maxWidth: "400px",
    width: "100%",
    boxShadow: "0 8px 40px rgba(0,0,0,.5)",
  },
  iconWrap: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    background: "rgba(26,115,232,.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "600",
    color: "#e8eaed",
    marginBottom: "10px",
  },
  sub: {
    fontSize: "14px",
    color: "#9aa0a6",
    lineHeight: 1.6,
    marginBottom: "32px",
  },
  btn: {
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "12px 28px",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
  },
};
