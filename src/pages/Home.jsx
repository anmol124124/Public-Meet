import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMeeting, getHostToken, isLoggedIn, listMeetings, getMe, logout } from "../api";

const TZ_OPTIONS = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function gcalUrl(name, dateStr, timeStr, tz, joinUrl) {
  const pad = (n) => String(n).padStart(2, "0");
  const [h, m] = timeStr.split(":").map(Number);
  const endH = pad((h + 1) % 24);
  const d = dateStr.replace(/-/g, "");
  const start = `${d}T${pad(h)}${pad(m)}00`;
  const end   = `${d}T${endH}${pad(m)}00`;
  const p = new URLSearchParams({
    action:   "TEMPLATE",
    text:     name,
    dates:    `${start}/${end}`,
    ctz:      tz,
    details:  `Join RoomLy meeting: ${joinUrl}`,
    location: joinUrl,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

const DEFAULT_SETTINGS = {
  require_approval:              true,
  allow_participants_see_others: true,   // always on
  allow_participant_admit:       false,
  allow_chat:                    true,   // always on
  allow_screen_share:            true,   // always on
  allow_unmute_self:             true,   // always on
};

export default function Home() {
  const [meetingName, setMeetingName] = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [meetings, setMeetings]       = useState([]);
  const [activeTab, setActiveTab]     = useState("instant");
  const [copied, setCopied]           = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings]         = useState({ ...DEFAULT_SETTINGS });
  const [page, setPage]               = useState(1);
  const [pageSched, setPageSched]     = useState(1);
  const PAGE_SIZE = 5;
  const navigate = useNavigate();

  // Schedule-related state
  const [showCreateDrop, setShowCreateDrop] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedDate, setSchedDate]       = useState("");
  const [schedTime, setSchedTime]       = useState("09:00");
  const [schedTz, setSchedTz]           = useState("Asia/Kolkata");
  const [inviteeInput, setInviteeInput] = useState("");
  const [invitees, setInvitees]         = useState([]);
  const [scheduleSuccess, setScheduleSuccess] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userEmail, setUserEmail]     = useState("");
  const inviteeRef = useRef(null);

  const toggleSetting = (key) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!isLoggedIn()) return;

    getMe().then(u => setUserEmail(u.email)).catch(() => {});

    // Auto-complete a meeting action that was interrupted by login
    const pendingName     = sessionStorage.getItem("pending_meeting_name");
    const pendingSettings = sessionStorage.getItem("pending_meeting_settings");
    const pendingType     = sessionStorage.getItem("pending_meeting_type");
    const pendingSchedule = sessionStorage.getItem("pending_schedule");
    if (pendingName) {
      sessionStorage.removeItem("pending_meeting_name");
      sessionStorage.removeItem("pending_meeting_settings");
      sessionStorage.removeItem("pending_meeting_type");
      sessionStorage.removeItem("pending_schedule");
      const s = pendingSettings ? JSON.parse(pendingSettings) : DEFAULT_SETTINGS;

      if (pendingType === "scheduled" && pendingSchedule) {
        // Restore scheduled meeting — just create and show in list, don't start
        const sched = JSON.parse(pendingSchedule);
        const localDateTimeStr = `${sched.date}T${sched.time}:00`;
        createMeeting(pendingName, s, localDateTimeStr, sched.invitees, sched.tz)
          .then((data) => {
            setMeetings((prev) => [data, ...prev]);
            setActiveTab("scheduled");
            setScheduleSuccess({
              name: pendingName,
              date: sched.date,
              time: sched.time,
              tz: sched.tz,
              invitees: sched.invitees,
              joinUrl: data.url,
            });
          })
          .catch((err) => setError(err.message));
      } else {
        // Instant meeting — create and start
        createMeeting(pendingName, s)
          .then((data) => {
            setMeetings((prev) => [data, ...prev]);
            setActiveTab("instant");
            return getHostToken(data.room_code).then(({ token, name }) => {
              navigate(`/${data.room_code}`, { state: { hostToken: token, hostName: name } });
            });
          })
          .catch((err) => setError(err.message));
      }
      return;
    }

    listMeetings()
      .then((data) => setMeetings(data))
      .catch(() => {/* silently ignore — user will still see empty state */});
  }, []);

  const handleInstantMeeting = async () => {
    setShowCreateDrop(false);
    if (!isLoggedIn()) {
      sessionStorage.setItem("pending_meeting_name",     meetingName.trim());
      sessionStorage.setItem("pending_meeting_settings", JSON.stringify(settings));
      navigate("/auth");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Check if user has a paid plan — if not, go through pricing first
      const user = await getMe();
      if (!user.plan) {
        sessionStorage.setItem("pending_meeting_name",     meetingName.trim());
        sessionStorage.setItem("pending_meeting_settings", JSON.stringify(settings));
        navigate("/pricing");
        return;
      }
      const data = await createMeeting(meetingName.trim(), settings);
      setMeetings((prev) => [data, ...prev]);
      setActiveTab("instant");
      setPage(1);
      const { token, name } = await getHostToken(data.room_code);
      navigate(`/${data.room_code}`, { state: { hostToken: token, hostName: name } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addInvitee = () => {
    const email = inviteeInput.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (invitees.includes(email)) { setInviteeInput(""); return; }
    setInvitees((prev) => [...prev, email]);
    setInviteeInput("");
    inviteeRef.current?.focus();
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!meetingName.trim()) return;
    if (!schedDate || !schedTime) { setError("Please select a date and time."); return; }

    // Auto-add any email still typed in the input field
    const pendingEmail = inviteeInput.trim().toLowerCase();
    const finalInvitees = (pendingEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pendingEmail) && !invitees.includes(pendingEmail))
      ? [...invitees, pendingEmail]
      : [...invitees];

    if (!isLoggedIn()) {
      sessionStorage.setItem("pending_meeting_name",     meetingName.trim());
      sessionStorage.setItem("pending_meeting_settings", JSON.stringify(settings));
      sessionStorage.setItem("pending_meeting_type",     "scheduled");
      sessionStorage.setItem("pending_schedule",         JSON.stringify({
        date: schedDate, time: schedTime, tz: schedTz, invitees: finalInvitees,
      }));
      navigate("/auth?redirect=/");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const localDateTimeStr = `${schedDate}T${schedTime}:00`;
      const data = await createMeeting(meetingName.trim(), settings, localDateTimeStr, finalInvitees, schedTz);
      setMeetings((prev) => [data, ...prev]);
      setScheduleSuccess({
        name: meetingName.trim(),
        date: schedDate,
        time: schedTime,
        tz: schedTz,
        invitees: finalInvitees,
        joinUrl: data.url,
      });
      setMeetingName("");
      setInvitees([]);
      setSchedDate("");
      setInviteeInput("");
      setShowScheduleForm(false);
      setActiveTab("scheduled");
      setPageSched(1);
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
          <span style={styles.brandName}>RoomLy</span>
        </div>

        {!isLoggedIn() && (
          <button
            onClick={() => navigate("/auth")}
            style={{
              marginLeft: "auto",
              padding: "9px 20px",
              background: "rgba(255,255,255,.12)",
              border: "1.5px solid rgba(255,255,255,.28)",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Sign in / Sign up
          </button>
        )}

        {isLoggedIn() && (
          <div style={{ position: "relative", marginLeft: "auto" }}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              style={styles.profileBtn}
              title={userEmail}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            </button>

            {profileOpen && (
              <>
                {/* Backdrop to close on outside click */}
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 99 }}
                  onClick={() => setProfileOpen(false)}
                />
                <div style={styles.dropdown}>
                  {userEmail && (
                    <div style={styles.dropEmail}>{userEmail}</div>
                  )}
                  <button
                    style={styles.dropItem}
                    onClick={() => { setProfileOpen(false); navigate("/dashboard"); }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                    Dashboard
                  </button>
                  <button
                    style={styles.dropItem}
                    onClick={() => {
                      logout();
                      setProfileOpen(false);
                      setUserEmail("");
                      setMeetings([]);
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          <h1 style={styles.heroTitle}>Secure and high quality meetings</h1>
          <p style={styles.heroSub}>Connect with anyone, anywhere — no account needed to join.</p>

          {/* ── Schedule success banner ── */}
          {scheduleSuccess && (
            <div style={styles.successBanner}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34a853" strokeWidth="2.5" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
              <div style={{ flex: 1 }}>
                <div>
                  <strong>{scheduleSuccess.name}</strong> scheduled for {scheduleSuccess.date} at {scheduleSuccess.time} ({scheduleSuccess.tz})
                  {scheduleSuccess.invitees.length > 0 && ` — invites sent to ${scheduleSuccess.invitees.length} recipient${scheduleSuccess.invitees.length > 1 ? "s" : ""}`}
                </div>
                <a
                  href={gcalUrl(scheduleSuccess.name, scheduleSuccess.date, scheduleSuccess.time, scheduleSuccess.tz, scheduleSuccess.joinUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.gcalBtn}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  Add to Google Calendar
                </a>
              </div>
              <button style={styles.successClose} onClick={() => setScheduleSuccess(null)}>✕</button>
            </div>
          )}

          {/* ── Title input + split button ── */}
          <div style={styles.inputRow}>
            <input
              style={styles.heroInput}
              type="text"
              placeholder="Enter a meeting name or topic…"
              value={meetingName}
              onChange={(e) => { setMeetingName(e.target.value); setShowCreateDrop(false); setShowScheduleForm(false); }}
              maxLength={80}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && meetingName.trim()) handleInstantMeeting(); }}
            />
            {/* Split button */}
            <div style={{ position: "relative", display: "flex", flexShrink: 0 }}>
              <button
                style={{
                  ...styles.heroBtn,
                  borderRadius: 0,
                  opacity: !meetingName.trim() || loading ? 0.6 : 1,
                  cursor: !meetingName.trim() || loading ? "default" : "pointer",
                  paddingRight: "16px",
                }}
                disabled={!meetingName.trim() || loading}
                onClick={handleInstantMeeting}
              >
                {loading ? "Starting…" : "New Meeting"}
              </button>
              <button
                style={{
                  ...styles.heroBtn,
                  borderLeft: "1px solid rgba(255,255,255,.25)",
                  borderRadius: "0 12px 12px 0",
                  padding: "16px 14px",
                  opacity: !meetingName.trim() ? 0.6 : 1,
                  cursor: !meetingName.trim() ? "default" : "pointer",
                }}
                disabled={!meetingName.trim()}
                onClick={(e) => { e.stopPropagation(); setShowCreateDrop(v => !v); setShowScheduleForm(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ display: "block", transform: showCreateDrop ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>

              {/* Dropdown */}
              {showCreateDrop && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setShowCreateDrop(false)} />
                  <div style={styles.createDropdown}>
                    <button style={styles.createDropItem} onClick={handleInstantMeeting}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                      </svg>
                      Start Instant Meeting
                    </button>
                    <button style={styles.createDropItem} onClick={() => { setShowCreateDrop(false); setShowScheduleForm(v => !v); setError(""); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                      </svg>
                      Schedule Meeting
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Schedule form (expands below) ── */}
          {showScheduleForm && (
            <form onSubmit={handleSchedule} style={styles.scheduleForm}>
              <div style={styles.schedRow}>
                <div style={styles.schedField}>
                  <label style={styles.schedLabel}>Date</label>
                  <input
                    style={styles.schedInput}
                    type="date"
                    value={schedDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setSchedDate(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.schedField}>
                  <label style={styles.schedLabel}>Time</label>
                  <input
                    style={styles.schedInput}
                    type="time"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={styles.schedField}>
                <label style={styles.schedLabel}>Time Zone</label>
                <select
                  style={{ ...styles.schedInput, cursor: "pointer" }}
                  value={schedTz}
                  onChange={(e) => setSchedTz(e.target.value)}
                >
                  {TZ_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              <div style={styles.schedField}>
                <label style={styles.schedLabel}>Invite by email <span style={{ color: "rgba(255,255,255,.35)", fontWeight: 400 }}>(optional)</span></label>
                <div style={styles.inviteeInputRow}>
                  <input
                    ref={inviteeRef}
                    style={{ ...styles.schedInput, flex: 1, marginBottom: 0 }}
                    type="email"
                    placeholder="name@example.com"
                    value={inviteeInput}
                    onChange={(e) => setInviteeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvitee(); } }}
                  />
                  <button type="button" style={styles.addInviteeBtn} onClick={addInvitee}>Add</button>
                </div>
                {invitees.length > 0 && (
                  <div style={styles.inviteeTags}>
                    {invitees.map((em) => (
                      <span key={em} style={styles.inviteeTag}>
                        {em}
                        <button type="button" style={styles.inviteeTagRemove}
                          onClick={() => setInvitees((prev) => prev.filter((x) => x !== em))}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {error && <p style={styles.heroError}>{error}</p>}

              <button
                type="submit"
                style={{
                  ...styles.schedSubmitBtn,
                  opacity: !schedDate || loading ? 0.6 : 1,
                  cursor: !schedDate || loading ? "default" : "pointer",
                }}
                disabled={!schedDate || loading}
              >
                {loading ? "Scheduling…" : invitees.length > 0 ? `Schedule & Send ${invitees.length} Invite${invitees.length > 1 ? "s" : ""}` : "Schedule Meeting"}
              </button>
            </form>
          )}

          {error && <p style={styles.heroError}>{error}</p>}

          {/* ── Settings toggle ── */}
          <button
            type="button"
            style={{ ...styles.settingsToggle, marginTop: "16px" }}
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
                { key: "require_approval",       label: "Require host approval to join",  desc: "Guests wait for host to admit them" },
                { key: "allow_participant_admit", label: "Participants can admit each other", desc: "Any participant can approve join requests" },
              ].map(({ key, label, desc }) => (
                <div key={key} style={{ ...styles.settingRow, borderBottom: "none" }} onClick={() => toggleSetting(key)}>
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
            style={{ ...styles.tab, ...(activeTab === "instant" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("instant")}
          >
            Instant Meetings
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "scheduled" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("scheduled")}
          >
            Scheduled Meetings
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "how" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("how")}
          >
            How it works
          </button>
        </div>

        {/* ── Instant meetings list ── */}
        {activeTab === "instant" && (() => {
          const list       = meetings.filter((m) => !m.scheduled_at);
          const totalPages = Math.ceil(list.length / PAGE_SIZE);
          const paginated  = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
          return list.length === 0 ? (
            <div style={styles.empty}>
              <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
              <p style={styles.emptyText}>No instant meetings yet.</p>
              <p style={styles.emptyHint}>Create one above and click "Start Instant Meeting".</p>
            </div>
          ) : (
            <>
              <div style={styles.list}>
                {paginated.map((m) => (
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
                          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34a853" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                        ) : (
                          <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>Copy link</>
                        )}
                      </button>
                      <button style={styles.startBtn} onClick={() => startMeeting(m.room_code)}>Start</button>
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div style={styles.pagination}>
                  <button style={{ ...styles.pageBtn, opacity: page === 1 ? 0.4 : 1 }} onClick={() => page > 1 && setPage(p => p - 1)} disabled={page === 1}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button key={n} style={{ ...styles.pageBtn, ...(n === page ? styles.pageBtnActive : {}) }} onClick={() => setPage(n)}>{n}</button>
                  ))}
                  <button style={{ ...styles.pageBtn, opacity: page === totalPages ? 0.4 : 1 }} onClick={() => page < totalPages && setPage(p => p + 1)} disabled={page === totalPages}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              )}
            </>
          );
        })()}

        {/* ── Scheduled meetings list ── */}
        {activeTab === "scheduled" && (() => {
          const list       = meetings.filter((m) => !!m.scheduled_at);
          const totalPages = Math.ceil(list.length / PAGE_SIZE);
          const paginated  = list.slice((pageSched - 1) * PAGE_SIZE, pageSched * PAGE_SIZE);
          return list.length === 0 ? (
            <div style={styles.empty}>
              <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <p style={styles.emptyText}>No scheduled meetings yet.</p>
              <p style={styles.emptyHint}>Create one above and click "Schedule Meeting".</p>
            </div>
          ) : (
            <>
              <div style={styles.list}>
                {paginated.map((m) => (
                  <div key={m.room_code} style={styles.item}>
                    <div style={styles.itemLeft}>
                      <div style={{ ...styles.itemIcon, background: "rgba(52,168,83,.12)" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34a853" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                      </div>
                      <div>
                        <div style={styles.itemName}>{m.name}</div>
                        <div style={styles.itemCode}>
                          {m.room_code}
                          {m.scheduled_at && (
                            <span style={{ marginLeft: "8px", color: "#34a853", fontFamily: "inherit" }}>
                              · {new Date(m.scheduled_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={styles.itemActions}>
                      <button style={styles.copyBtn} onClick={() => copyLink(m)}>
                        {copied === m.room_code ? (
                          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34a853" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                        ) : (
                          <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>Copy link</>
                        )}
                      </button>
                      <button style={styles.startBtn} onClick={() => startMeeting(m.room_code)}>Start</button>
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div style={styles.pagination}>
                  <button style={{ ...styles.pageBtn, opacity: pageSched === 1 ? 0.4 : 1 }} onClick={() => pageSched > 1 && setPageSched(p => p - 1)} disabled={pageSched === 1}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button key={n} style={{ ...styles.pageBtn, ...(n === pageSched ? styles.pageBtnActive : {}) }} onClick={() => setPageSched(n)}>{n}</button>
                  ))}
                  <button style={{ ...styles.pageBtn, opacity: pageSched === totalPages ? 0.4 : 1 }} onClick={() => pageSched < totalPages && setPageSched(p => p + 1)} disabled={pageSched === totalPages}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              )}
            </>
          );
        })()}

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
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(255,255,255,.15)",
    border: "1.5px solid rgba(255,255,255,.25)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    background: "#2d2e31",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 12,
    minWidth: 200,
    boxShadow: "0 8px 32px rgba(0,0,0,.5)",
    zIndex: 100,
    overflow: "hidden",
  },
  dropEmail: {
    padding: "12px 16px 8px",
    fontSize: 12,
    color: "#9aa0a6",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  dropItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "11px 16px",
    fontSize: 14,
    color: "#e8eaed",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "left",
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
    overflow: "visible",
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
    borderRadius: "12px 0 0 12px",
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

  // Pagination
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "14px 24px",
    borderTop: "1px solid #f1f3f4",
  },
  pageBtn: {
    minWidth: "34px",
    height: "34px",
    padding: "0 8px",
    background: "transparent",
    border: "1px solid #dadce0",
    borderRadius: "8px",
    color: "#5f6368",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s, color 0.15s",
  },
  pageBtnActive: {
    background: "#1a73e8",
    borderColor: "#1a73e8",
    color: "#fff",
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

  createDropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    background: "#2d2e31",
    border: "1px solid rgba(255,255,255,.13)",
    borderRadius: "10px",
    minWidth: "210px",
    boxShadow: "0 8px 32px rgba(0,0,0,.5)",
    zIndex: 10,
    overflow: "hidden",
  },
  createDropItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    padding: "12px 16px",
    background: "transparent",
    border: "none",
    color: "#e8eaed",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    textAlign: "left",
  },

  // Schedule form
  scheduleForm: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxWidth: "560px",
    margin: "0 auto",
    width: "100%",
  },
  schedRow: {
    display: "flex",
    gap: "12px",
  },
  schedField: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  schedLabel: {
    fontSize: "12px",
    fontWeight: "500",
    color: "rgba(255,255,255,.6)",
    textAlign: "left",
  },
  schedInput: {
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "14px",
    color: "#e8eaed",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    marginBottom: "0",
    colorScheme: "dark",
  },
  inviteeInputRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  addInviteeBtn: {
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "10px",
    padding: "12px 18px",
    color: "#e8eaed",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  inviteeTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "6px",
  },
  inviteeTag: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "rgba(26,115,232,.2)",
    border: "1px solid rgba(26,115,232,.4)",
    borderRadius: "20px",
    padding: "4px 10px 4px 12px",
    fontSize: "12px",
    color: "#8ab4f8",
  },
  inviteeTagRemove: {
    background: "none",
    border: "none",
    color: "rgba(138,180,248,.6)",
    cursor: "pointer",
    padding: "0",
    fontSize: "11px",
    lineHeight: 1,
  },
  schedSubmitBtn: {
    background: "linear-gradient(135deg, #34a853, #2d9249)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: "600",
    width: "100%",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(52,168,83,.35)",
    transition: "opacity .15s",
  },

  // Success banner
  successBanner: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "rgba(52,168,83,.12)",
    border: "1px solid rgba(52,168,83,.3)",
    borderRadius: "10px",
    padding: "12px 16px",
    maxWidth: "560px",
    margin: "0 auto 16px",
    width: "100%",
    fontSize: "13px",
    color: "#81c995",
    textAlign: "left",
    lineHeight: 1.5,
  },
  successClose: {
    background: "none",
    border: "none",
    color: "rgba(129,201,149,.6)",
    cursor: "pointer",
    marginLeft: "auto",
    fontSize: "14px",
    flexShrink: 0,
  },
  gcalBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "8px",
    background: "rgba(52,168,83,.2)",
    border: "1px solid rgba(52,168,83,.4)",
    borderRadius: "6px",
    padding: "5px 12px",
    fontSize: "12px",
    fontWeight: "500",
    color: "#81c995",
    textDecoration: "none",
    cursor: "pointer",
  },

  // Scheduled badge in meeting list
  scheduledBadge: {
    display: "inline-block",
    marginLeft: "8px",
    background: "rgba(52,168,83,.12)",
    border: "1px solid rgba(52,168,83,.3)",
    borderRadius: "4px",
    padding: "1px 6px",
    fontSize: "11px",
    fontWeight: "500",
    color: "#34a853",
    verticalAlign: "middle",
  },
};
