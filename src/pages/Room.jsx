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
      if (!containerRef.current || apiRef.current) return; // prevent double-init (React StrictMode)
      // Pre-seed name only for the host (so the SDK skips its name prompt for hosts)
      // Guests enter their name in the SDK lobby
      if (session.isHost && session.name) {
        sessionStorage.setItem(`wrtc_name_${roomCode}`, session.name);
      }
      const dashboardBase = (window.DASHBOARD_URL || import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:5174').replace(/\/$/, '');
      const accessToken = localStorage.getItem("access_token") || "";
      const addonRaw = localStorage.getItem("pub_recording_addon_enabled");
      const recordingAddonEnabled = addonRaw === null ? true : addonRaw === "true";
      apiRef.current = new window.WebRTCMeetingAPI({
        serverUrl:              backendWsUrl(),
        roomName:               roomCode,
        token:                  session.token,
        parentNode:             containerRef.current,
        upgradePlanUrl:         dashboardBase + '/?upgrade=1',
        recordingEndpoint:      backendBase + '/api/v1/public/meetings/recordings/upload',
        recordingToken:         accessToken,
        recordingAddonEnabled:  recordingAddonEnabled,
        onLeave: () => navigate(`/${roomCode}/left`),
      });
    };

    script.onerror = () => {
      if (containerRef.current) {
        containerRef.current.innerHTML =
          '<div style="color:#ea4335;padding:24px;font-family:sans-serif">Failed to load meeting SDK. Please refresh.</div>';
      }
    };

    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
      // Silently close WS without triggering onLeave navigation
      if (apiRef.current) { apiRef.current._ws?.close(); apiRef.current = null; }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "fixed", inset: 0, background: "#202124" }}
    />
  );
}
