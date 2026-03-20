import React, { useEffect, useRef } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { backendWsUrl } from "../api";

/**
 * Room page — mounts the WebRTCMeetingAPI SDK inside a full-screen div.
 * The SDK (app.js) is loaded from the backend and handles all WebRTC logic.
 *
 * State passed from JoinRoom:
 *   { token: string, name: string, isHost: boolean }
 */
export default function Room() {
  const { roomCode }  = useParams();
  const location      = useLocation();
  const navigate      = useNavigate();
  const containerRef  = useRef(null);
  const apiRef        = useRef(null);

  // Persist session in sessionStorage so refresh doesn't kick user out
  const SESSION_KEY = `meet_session_${roomCode}`;

  let state = location.state;
  if (state?.token) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } else {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) state = JSON.parse(saved);
  }

  useEffect(() => {
    // If no token at all, send back to join page
    if (!state?.token) {
      navigate(`/${roomCode}`, { replace: true });
      return;
    }

    // Dynamically load app.js from the backend (same origin as BACKEND_URL)
    const backendBase = (window.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
    const script = document.createElement("script");
    script.src = `${backendBase}/public/js/app.js?v=${Date.now()}`;
    script.async = true;

    script.onload = () => {
      if (!containerRef.current) return;
      apiRef.current = new window.WebRTCMeetingAPI({
        serverUrl:  backendWsUrl(),
        roomName:   roomCode,
        token:      state.token,
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

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "#202124",
      }}
    />
  );
}
