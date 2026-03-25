import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMeeting, getHostToken, isLoggedIn, listMeetings } from "../api";

const DEFAULT_SETTINGS = {
  require_approval:             true,
  allow_participants_see_others: true,
  allow_participant_admit:       false,
  allow_chat:                   true,
  allow_screen_share:           true,
  allow_unmute_self:            true,
};

export default function Home() {
  const [meetingName, setMeetingName] = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [meetings, setMeetings]       = useState([]);
  const [activeTab, setActiveTab]     = useState("upcoming");
  const [copied, setCopied]           = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings]         = useState({ ...DEFAULT_SETTINGS });
  const navigate = useNavigate();

  const toggleSetting = (key) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!isLoggedIn()) return;

    // Auto-create a meeting that was started before login
    const pendingName     = sessionStorage.getItem("pending_meeting_name");
    const pendingSettings = sessionStorage.getItem("pending_meeting_settings");
    if (pendingName) {
      sessionStorage.removeItem("pending_meeting_name");
      sessionStorage.removeItem("pending_meeting_settings");
      const s = pendingSettings ? JSON.parse(pendingSettings) : DEFAULT_SETTINGS;
      createMeeting(pendingName, s)
        .then((data) => {
          setMeetings((prev) => [data, ...prev]);
          setActiveTab("upcoming");
          // Go straight to the join page as host
          return getHostToken(data.room_code).then(({ token, name }) => {
            navigate(`/${data.room_code}`, { state: { hostToken: token, hostName: name } });
          });
        })
        .catch((err) => setError(err.message));
      return;
    }

    listMeetings()
      .then((data) => setMeetings(data))
      .catch(() => {/* silently ignore — user will still see empty state */});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!meetingName.trim()) return;

    // Not logged in — save intent and go through auth first
    if (!isLoggedIn()) {
      sessionStorage.setItem("pending_meeting_name",     meetingName.trim());
      sessionStorage.setItem("pending_meeting_settings", JSON.stringify(settings));
      navigate("/auth?redirect=/");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await createMeeting(meetingName.trim(), settings);
      setMeetings((prev) => [data, ...prev]);
      setMeetingName("");
      setActiveTab("upcoming");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startMeeting = async (roomCode) => {
    if (isLoggedIn()) {
      try {
        const { token, name } = await getHostToken(roomCode);
        navigate(`/${roomCode}`, {
          state: { hostToken: token, hostName: name },
        });
      } catch (err) {
        setError(err.message);
      }
    } else {
      navigate(`/auth?redirect=/${roomCode}/room&roomCode=${roomCode}`);
    }
  };

  const copyLink = (m) => {
    const url = `${window.location.origin}/${m.room_code}/room`;
    navigator.clipboard.writeText(url);
    setCopied(m.room_code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={styles.page}>
      {/* ── Navbar ── */}
      <nav style={styles.nav}>
        <div style={styles.brand}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#1a73e8">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
          <span style={styles.brandName}>NexMeet</span>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          <h1 style={styles.heroTitle}>Secure and high quality meetings</h1>
          <p style={styles.heroSub}>Connect with anyone, anywhere — no account needed to join.</p>

          <form onSubmit={handleCreate} style={styles.inputRow}>
            <input
              style={styles.heroInput}
              type="text"
              placeholder="Enter a meeting name or topic…"
              value={meetingName}
              onChange={(e) => setMeetingName(e.target.value)}
              maxLength={80}
              autoFocus
            />
            <button
              type="submit"
              style={{
                ...styles.heroBtn,
                opacity: !meetingName.trim() || loading ? 0.6 : 1,
                cursor: !meetingName.trim() || loading ? "default" : "pointer",
              }}
              disabled={!meetingName.trim() || loading}
            >
              {loading ? "Creating…" : "Start meeting"}
            </button>
          </form>

          {error && <p style={styles.heroError}>{error}</p>}

          {/* ── Settings toggle ── */}
          <button
            type="button"
            style={styles.settingsToggle}
            onClick={() => setShowSettings((v) => !v)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.1 7.1 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54a7.1 7.1 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54a7.1 7.1 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 0 1 8.4 12 3.6 3.6 0 0 1 12 8.4 3.6 3.6 0 0 1 15.6 12 3.6 3.6 0 0 1 12 15.6z"/>
            </svg>
            Meeting settings
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "auto", transform: showSettings ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>

          {showSettings && (
            <div style={styles.settingsPanel}>
              {[
                { key: "require_approval",             label: "Require host approval to join",        desc: "Guests wait for host to admit them" },
                { key: "allow_participants_see_others", label: "Participants can see each other",      desc: "Show participant list to everyone" },
                { key: "allow_participant_admit",       label: "Participants can admit others",        desc: "Any participant can approve join requests" },
                { key: "allow_chat",                   label: "Enable chat",                          desc: "Allow in-meeting text messages" },
                { key: "allow_screen_share",           label: "Enable screen sharing",                desc: "Allow participants to share their screen" },
                { key: "allow_unmute_self",            label: "Participants can unmute themselves",   desc: "Allow participants to turn on their mic" },
              ].map(({ key, label, desc }) => (
                <div key={key} style={styles.settingRow} onClick={() => toggleSetting(key)}>
                  <div style={styles.settingInfo}>
                    <div style={styles.settingLabel}>{label}</div>
                    <div style={styles.settingDesc}>{desc}</div>
                  </div>
                  <div style={{ ...styles.toggle, background: settings[key] ? "#1a73e8" : "rgba(255,255,255,.2)" }}>
                    <div style={{ ...styles.toggleKnob, transform: settings[key] ? "translateX(20px)" : "translateX(2px)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <p style={styles.heroHint}>
            Or share a meeting link with guests — they join with just their name, no sign-up required.
          </p>
        </div>
      </div>

      {/* ── Meetings panel ── */}
      <div style={styles.panel}>
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(activeTab === "upcoming" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("upcoming")}
          >
            Your meetings
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "how" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("how")}
          >
            How it works
          </button>
        </div>

        {activeTab === "upcoming" && (
          meetings.length === 0 ? (
            <div style={styles.empty}>
              <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <p style={styles.emptyText}>No meetings yet.</p>
              <p style={styles.emptyHint}>Create one above — it will appear here.</p>
            </div>
          ) : (
            <div style={styles.list}>
              {meetings.map((m) => (
                <div key={m.room_code} style={styles.item}>
                  <div style={styles.itemLeft}>
                    <div style={styles.itemIcon}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#1a73e8">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                      </svg>
                    </div>
                    <div>
                      <div style={styles.itemName}>{m.name}</div>
                      <div style={styles.itemCode}>{m.room_code}</div>
                    </div>
                  </div>
                  <div style={styles.itemActions}>
                    <button style={styles.copyBtn} onClick={() => copyLink(m)}>
                      {copied === m.room_code ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34a853" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                          </svg>
                          Copy link
                        </>
                      )}
                    </button>
                    <button style={styles.startBtn} onClick={() => startMeeting(m.room_code)}>
                      Start
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "how" && (
          <div style={styles.howList}>
            {[
              { n: "1", t: "Create a meeting", d: "Enter a topic or name and click Start meeting." },
              { n: "2", t: "Sign up as host",  d: "Quick one-time sign-up — you control the meeting." },
              { n: "3", t: "Share the link",   d: "Guests click your link, enter their name, and join instantly." },
            ].map((s) => (
              <div key={s.n} style={styles.howItem}>
                <div style={styles.howNum}>{s.n}</div>
                <div>
                  <div style={styles.howTitle}>{s.t}</div>
                  <div style={styles.howDesc}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f0f4f9",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Google Sans', Roboto, -apple-system, sans-serif",
  },

  // Navbar
  nav: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: "18px 32px",
    display: "flex",
    alignItems: "center",
    zIndex: 10,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  brandName: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#fff",
    letterSpacing: "-0.3px",
  },

  // Hero
  hero: {
    background: "linear-gradient(135deg, #1a1f2e 0%, #0d1117 40%, #1a2744 100%)",
    minHeight: "62vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "100px 24px 60px",
    position: "relative",
    overflow: "hidden",
  },
  heroInner: {
    maxWidth: "680px",
    width: "100%",
    textAlign: "center",
    position: "relative",
    zIndex: 1,
  },
  heroTitle: {
    fontSize: "clamp(28px, 5vw, 44px)",
    fontWeight: "600",
    color: "#fff",
    marginBottom: "12px",
    letterSpacing: "-0.5px",
    lineHeight: 1.2,
  },
  heroSub: {
    fontSize: "16px",
    color: "rgba(255,255,255,0.65)",
    marginBottom: "36px",
  },
  inputRow: {
    display: "flex",
    gap: "0",
    maxWidth: "560px",
    margin: "0 auto 16px",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
  },
  heroInput: {
    flex: 1,
    padding: "16px 20px",
    fontSize: "15px",
    border: "none",
    outline: "none",
    background: "#fff",
    color: "#202124",
    minWidth: 0,
  },
  heroBtn: {
    padding: "16px 28px",
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    fontSize: "15px",
    fontWeight: "500",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  heroError: {
    color: "#f28b82",
    fontSize: "13px",
    marginBottom: "12px",
  },
  heroHint: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.45)",
    maxWidth: "460px",
    margin: "0 auto",
    lineHeight: 1.6,
  },

  // Panel
  panel: {
    maxWidth: "720px",
    width: "100%",
    margin: "-32px auto 48px",
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    overflow: "hidden",
    position: "relative",
    zIndex: 2,
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #e8eaed",
  },
  tab: {
    flex: 1,
    padding: "16px",
    background: "transparent",
    border: "none",
    fontSize: "14px",
    fontWeight: "500",
    color: "#5f6368",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    transition: "color 0.15s, border-color 0.15s",
  },
  tabActive: {
    color: "#1a73e8",
    borderBottom: "2px solid #1a73e8",
  },

  // Empty state
  empty: {
    padding: "48px 24px",
    textAlign: "center",
    color: "#80868b",
  },
  emptyIcon: {
    width: "48px",
    height: "48px",
    color: "#dadce0",
    marginBottom: "12px",
  },
  emptyText: {
    fontSize: "15px",
    fontWeight: "500",
    color: "#5f6368",
    marginBottom: "4px",
  },
  emptyHint: {
    fontSize: "13px",
    color: "#9aa0a6",
  },

  // Meeting list
  list: {
    display: "flex",
    flexDirection: "column",
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    borderBottom: "1px solid #f1f3f4",
    gap: "16px",
  },
  itemLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minWidth: 0,
  },
  itemIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "#e8f0fe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemName: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#202124",
    marginBottom: "2px",
  },
  itemCode: {
    fontSize: "12px",
    color: "#9aa0a6",
    fontFamily: "monospace",
  },
  itemActions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  },
  copyBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    background: "transparent",
    border: "1px solid #dadce0",
    borderRadius: "8px",
    color: "#5f6368",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
  },
  startBtn: {
    padding: "8px 20px",
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
  },

  // How it works
  howList: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  howItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    padding: "20px 24px",
    borderBottom: "1px solid #f1f3f4",
  },
  howNum: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#e8f0fe",
    color: "#1a73e8",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  howTitle: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#202124",
    marginBottom: "2px",
  },
  howDesc: {
    fontSize: "13px",
    color: "#5f6368",
    lineHeight: 1.5,
  },

  settingsToggle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "8px",
    color: "rgba(255,255,255,.75)",
    fontSize: "13px",
    fontWeight: "500",
    padding: "8px 14px",
    cursor: "pointer",
    margin: "0 auto 16px",
    width: "100%",
    maxWidth: "560px",
  },
  settingsPanel: {
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "12px",
    padding: "4px 0",
    maxWidth: "560px",
    margin: "0 auto 16px",
    width: "100%",
  },
  settingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    cursor: "pointer",
    gap: "16px",
    borderBottom: "1px solid rgba(255,255,255,.07)",
  },
  settingInfo: {
    textAlign: "left",
  },
  settingLabel: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#e8eaed",
    marginBottom: "2px",
  },
  settingDesc: {
    fontSize: "11px",
    color: "rgba(255,255,255,.45)",
  },
  toggle: {
    width: "42px",
    height: "24px",
    borderRadius: "12px",
    position: "relative",
    flexShrink: 0,
    transition: "background .2s",
  },
  toggleKnob: {
    position: "absolute",
    top: "2px",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "#fff",
    transition: "transform .2s",
  },
};
