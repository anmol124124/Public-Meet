import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import JoinRoom from "./pages/JoinRoom";
import Room from "./pages/Room";
import Left from "./pages/Left";
import SdkJoin from "./pages/SdkJoin";
import SdkLeave from "./pages/SdkLeave";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      {/* Embed SDK guest entry/leave — must be before /:roomCode */}
      <Route path="/sdk/join/:roomName" element={<SdkJoin />} />
      <Route path="/sdk/leave/:roomName" element={<SdkLeave />} />
      <Route path="/:roomCode" element={<JoinRoom />} />
      <Route path="/:roomCode/room" element={<Room />} />
      <Route path="/:roomCode/left" element={<Left />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
