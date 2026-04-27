import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { isLoggedIn, logout } from "./api";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Pricing from "./pages/Pricing";
import UserDashboard from "./pages/UserDashboard";
import JoinRoom from "./pages/JoinRoom";
import Room from "./pages/Room";
import Left from "./pages/Left";
import SdkJoin from "./pages/SdkJoin";
import SdkLeave from "./pages/SdkLeave";

const IDLE_MS  = 60 * 1000;   // 1 min for testing (change to 60*60*1000 for prod)
const WARN_MS  = 15 * 1000;   // warn 15 s before logout

function IdleLogoutProvider({ children }) {
  const navigate     = useNavigate();
  const [warn, setWarn] = useState(false);
  const idleTimer    = useRef(null);
  const warnTimer    = useRef(null);

  const reset = () => {
    if (!isLoggedIn()) return;
    clearTimeout(idleTimer.current);
    clearTimeout(warnTimer.current);
    setWarn(false);
    warnTimer.current = setTimeout(() => setWarn(true), IDLE_MS - WARN_MS);
    idleTimer.current = setTimeout(() => { logout(); navigate("/auth"); }, IDLE_MS);
  };

  useEffect(() => {
    if (!isLoggedIn()) return;
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(idleTimer.current);
      clearTimeout(warnTimer.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stayIn = () => {
    clearTimeout(idleTimer.current);
    clearTimeout(warnTimer.current);
    setWarn(false);
    warnTimer.current = setTimeout(() => setWarn(true), IDLE_MS - WARN_MS);
    idleTimer.current = setTimeout(() => { logout(); navigate("/auth"); }, IDLE_MS);
  };

  return (
    <>
      {children}
      {warn && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#1e2130", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: "36px 40px", maxWidth: 400, width: "90%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏱️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaed", marginBottom: 10 }}>
              Session Expiring Soon
            </div>
            <div style={{ fontSize: 14, color: "#9aa0a6", lineHeight: 1.6, marginBottom: 28 }}>
              You've been inactive. You'll be signed out in 15 seconds.
            </div>
            <button
              onClick={stayIn}
              style={{
                width: "100%", padding: "14px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg,#1a73e8,#4d94ff)", color: "#fff",
                fontSize: 15, fontWeight: 600, cursor: "pointer",
              }}
            >
              Stay Signed In
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <IdleLogoutProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        {/* Embed SDK guest entry/leave — must be before /:roomCode */}
        <Route path="/sdk/join/:roomName" element={<SdkJoin />} />
        <Route path="/sdk/leave/:roomName" element={<SdkLeave />} />
        <Route path="/:roomCode" element={<JoinRoom />} />
        <Route path="/:roomCode/room" element={<Room />} />
        <Route path="/:roomCode/left" element={<Left />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </IdleLogoutProvider>
  );
}
