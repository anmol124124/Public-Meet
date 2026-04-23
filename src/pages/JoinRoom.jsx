import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getMeeting, getGuestToken } from "../api";

/**
 * Join page — shown for both guests (shared link) and hosts (Start button).
 * Hosts arrive with { hostToken, hostName } in location.state — name is pre-filled.
 * Guests see only a "Join Now" button — the SDK lobby collects their name.
 */
export default function JoinRoom() {
  const { roomCode } = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();

  const hostToken = location.state?.hostToken || null;
  const hostName  = location.state?.hostName  || "";

  const [meeting, setMeeting]       = useState(null);
  const [notFound, setNotFound]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [name, setName]             = useState(hostName);
  const [localEnded, setLocalEnded] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("meeting_ended_" + roomCode) === "1") {
        setLocalEnded(true);
        return;
      }
    } catch(_) {}
    getMeeting(roomCode)
      .then(setMeeting)
      .catch(() => setNotFound(true));
  }, [roomCode]);

  const joinNow = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Host — token already fetched via startMeeting, go straight to room
      if (hostToken) {
        const trimmedName = name.trim() || hostName;
        navigate(`/${roomCode}/room`, {
          state: { token: hostToken, name: trimmedName, isHost: true },
        });
        return;
      }

      // Guest — get token with placeholder; SDK lobby collects the real name
      const { token } = await getGuestToken(roomCode, "Guest");
      navigate(`/${roomCode}/room`, {
        state: { token, isHost: false },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (localEnded) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏱️</div>
          <h2 style={styles.heading}>Meeting has ended</h2>
          <p style={styles.subtext}>This meeting's time limit was reached and is no longer available.</p>
          <button style={styles.btn} onClick={() => navigate("/")}>Go home</button>
        </div>
      </div>
    );
  }

  if (!meeting && !notFound) {
    return (
      <div style={styles.page}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔗</div>
          <h2 style={styles.heading}>Meeting not found</h2>
          <p style={styles.subtext}>This link may be invalid or the meeting has ended.</p>
          <button style={styles.btn} onClick={() => navigate("/")}>Go home</button>
        </div>
      </div>
    );
  }

  if (meeting && !meeting.is_active) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
          <h2 style={styles.heading}>Meeting has ended</h2>
          <p style={styles.subtext}>This meeting is no longer available. The link has expired.</p>
          <button style={styles.btn} onClick={() => navigate("/")}>Go home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Brand */}
        <a href="/" style={{ textDecoration: "none" }}>
          <div style={{ ...styles.brand, cursor: "pointer" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#1a73e8">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
            <span style={styles.brandName}>RoomLy</span>
          </div>
        </a>

        <h1 style={styles.heading} title={meeting.name}>{meeting.name}</h1>
        <p style={styles.roomCode}>Room · {roomCode}</p>

        <form onSubmit={joinNow} style={styles.form}>
          {error && <p style={styles.error}>{error}</p>}

          {/* Name input only for host — guests enter name in the SDK lobby */}
          {hostToken && (
            <div>
              <label style={styles.label}>Your name</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
              />
            </div>
          )}

          <button
            type="submit"
            style={{ ...styles.btn, opacity: loading ? 0.5 : 1 }}
            disabled={loading}
          >
            {loading ? "Joining…" : "Join Now"}
          </button>
        </form>

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
    overflow: "hidden",
    minWidth: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "24px",
  },
  brandName: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#e8eaed",
  },
  heading: {
    fontSize: "22px",
    fontWeight: "600",
    color: "#e8eaed",
    marginBottom: "4px",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    textOverflow: "ellipsis",
  },
  roomCode: {
    fontSize: "13px",
    color: "#9aa0a6",
    marginBottom: "28px",
    fontFamily: "monospace",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  label: {
    display: "block",
    fontSize: "14px",
    color: "#9aa0a6",
    fontWeight: "500",
    marginBottom: "6px",
  },
  input: {
    background: "rgba(255,255,255,.07)",
    border: "1.5px solid rgba(255,255,255,.15)",
    borderRadius: "10px",
    padding: "13px 16px",
    color: "#e8eaed",
    fontSize: "15px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },
  btn: {
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "13px",
    fontSize: "15px",
    fontWeight: "500",
    width: "100%",
    cursor: "pointer",
    marginTop: "4px",
  },
  subtext: {
    fontSize: "14px",
    color: "#9aa0a6",
    marginBottom: "24px",
  },
  error: {
    color: "#ea4335",
    fontSize: "13px",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid rgba(255,255,255,.1)",
    borderTop: "3px solid #1a73e8",
    borderRadius: "50%",
  },
};
