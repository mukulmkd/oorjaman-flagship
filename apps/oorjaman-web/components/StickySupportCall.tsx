"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { BusinessCallbackForm } from "@/components/BusinessCallbackForm";
import { SUPPORT_EMAIL, SUPPORT_HOURS, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from "@/lib/site";
import styles from "./sticky-support.module.css";

type SheetView = "menu" | "write";

/** Floating Help control → contact sheet (call / write draft / callback). */
export function StickySupportCall() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SheetView>("menu");
  const titleId = useId();
  const dialogId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setView("menu");
    queueMicrotask(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (view === "write") setView("menu");
        else close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, view, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.chip}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => {
          setView("menu");
          setOpen(true);
        }}
      >
        <span className={styles.icon} aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 014.6 1.2c0 1.5-2.1 2-2.1 3.3" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className={styles.copy}>
          <span className={styles.label}>Help</span>
          <span className={styles.phone}>Talk to us</span>
        </span>
      </button>

      {open ? (
        <div className={styles.overlay} role="presentation" onClick={close}>
          <div
            id={dialogId}
            className={[styles.sheet, view === "write" ? styles.sheetWide : ""].filter(Boolean).join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.sheetTop}>
              <div>
                <p className={styles.sheetEyebrow}>Support</p>
                <h2 id={titleId} className={styles.sheetTitle}>
                  {view === "write" ? "Write to us" : "Talk to OorjaMan"}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                className={styles.close}
                aria-label="Close"
                onClick={close}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.85"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {view === "menu" ? (
              <>
                <p className={styles.sheetLead}>
                  Bookings, visits, or a callback — we’ll help. Hours: {SUPPORT_HOURS}.
                </p>

                <div className={styles.actions}>
                  <a href={`tel:${SUPPORT_PHONE_TEL}`} className={styles.actionPrimary}>
                    <span className={styles.actionIcon} aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
                        <path d="M7.5 4.5h3l1.2 3.2-1.6 1.1a12.5 12.5 0 005.6 5.6l1.1-1.6 3.2 1.2v3a1.5 1.5 0 01-1.5 1.5A14.5 14.5 0 016 6a1.5 1.5 0 011.5-1.5z" />
                      </svg>
                    </span>
                    <span className={styles.actionCopy}>
                      <span className={styles.actionLabel}>Call</span>
                      <span className={styles.actionValue}>{SUPPORT_PHONE}</span>
                    </span>
                  </a>

                  <button
                    type="button"
                    className={styles.actionSecondary}
                    onClick={() => setView("write")}
                  >
                    <span className={styles.actionIcon} aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
                        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
                        <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className={styles.actionCopy}>
                      <span className={styles.actionLabel}>Write to us</span>
                      <span className={styles.actionValue}>{SUPPORT_EMAIL}</span>
                    </span>
                  </button>

                  <Link href="/contact#callback" className={styles.actionTertiary} onClick={close}>
                    Request a callback
                  </Link>
                </div>
              </>
            ) : (
              <>
                <button type="button" className={styles.back} onClick={() => setView("menu")}>
                  ← Back
                </button>
                <BusinessCallbackForm context="support" compact />
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
