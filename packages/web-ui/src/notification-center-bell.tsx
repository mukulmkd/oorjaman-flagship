import { useEffect, useId, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { NotificationAudience } from "@oorjaman/api";
import { useSupabase } from "./supabase-client";
import { useNotificationCenter } from "./use-notification-center";
import "./notification-center.css";

type Props = {
  audience: NotificationAudience;
  vendorId?: string | null;
};

function BellIcon() {
  return (
    <svg className="notif-bell-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a5 5 0 0 0-5 5v2.1c0 .5-.2 1-.5 1.4L5.1 14.2A1.5 1.5 0 0 0 6.4 17h11.2a1.5 1.5 0 0 0 1.3-2.8l-1.4-2.7c-.3-.4-.5-.9-.5-1.4V8a5 5 0 0 0-5-5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function NotificationCenterBell({ audience, vendorId }: Props) {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const {
    open,
    setOpen,
    items,
    unreadCount,
    loading,
    soundMuted,
    toggleSound,
    markRead,
    markAllRead,
  } = useNotificationCenter(supabase, audience, vendorId);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  const badge = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div ref={wrapRef} className="notif-bell-wrap">
      <button
        type="button"
        className="notif-bell-btn"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        title={soundMuted ? "Notifications (sound off)" : "Notifications"}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {badge ? <span className="notif-bell-badge">{badge}</span> : null}
      </button>

      {open ? (
        <div id={panelId} className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-header">
            <h2 className="notif-panel-title">Notifications</h2>
            <div className="notif-panel-actions">
              <button type="button" onClick={() => toggleSound()}>
                {soundMuted ? "Unmute" : "Mute"}
              </button>
              {unreadCount > 0 ? (
                <button type="button" onClick={() => void markAllRead()}>
                  Mark all read
                </button>
              ) : null}
            </div>
          </div>
          <div className="notif-panel-list">
            {loading && items.length === 0 ? (
              <p className="notif-empty">Loading…</p>
            ) : items.length === 0 ? (
              <p className="notif-empty">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notif-item${item.readAt ? "" : " notif-item-unread"}`}
                  onClick={() => {
                    void markRead(item.id);
                    setOpen(false);
                    if (item.href) navigate(item.href);
                  }}
                >
                  <p className="notif-item-title">{item.title}</p>
                  <p className="notif-item-body">{item.body}</p>
                  <span className="notif-item-meta">{item.relativeTime}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
