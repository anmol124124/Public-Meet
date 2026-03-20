import { useEffect, useRef } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { backendWsUrl } from "../api";

export default function Room() {
  const { roomCode } = useParams();
  const location     = useLocation();
  const navigate     = useNavigate();
  const containerRef = useRef(null);
  const apiRef       = useRef(null);
  const SESSION_KEY  = `meet_session_${roomCode}`;

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
      apiRef.current = new window.WebRTCMeetingAPI({
        serverUrl:  backendWsUrl(),
        roomName:   roomCode,
        token:      session.token,
        parentNode: containerRef.current,
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

  return (
    <div
      ref={containerRef}
      style={{ position: "fixed", inset: 0, background: "#202124" }}
    />
  );
}
