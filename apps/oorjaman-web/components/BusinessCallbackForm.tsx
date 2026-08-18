"use client";

import { useState, type FormEvent } from "react";
import { SUPPORT_EMAIL } from "@/lib/site";
import styles from "./business-callback-form.module.css";

type BusinessCallbackFormProps = {
  /** Prefill subject context */
  context?: "business" | "contact";
};

export function BusinessCallbackForm({ context = "business" }: BusinessCallbackFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [sentHint, setSentHint] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const subject =
      context === "contact"
        ? "OorjaMan callback request"
        : "Business / multi-site enquiry";
    const body = [
      `Name: ${name.trim()}`,
      `Phone: ${phone.trim()}`,
      company.trim() ? `Company: ${company.trim()}` : null,
      city.trim() ? `City: ${city.trim()}` : null,
      "",
      message.trim() || "(No additional message)",
    ]
      .filter((line) => line !== null)
      .join("\n");

    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setSentHint(true);
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <p className={styles.intro}>
        Request a callback for multi-site or commercial rooftops. Opens your email app with a ready draft to{" "}
        {SUPPORT_EMAIL}.
      </p>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Name</span>
          <input
            name="name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>
        <label className={styles.field}>
          <span>Phone</span>
          <input
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 …"
          />
        </label>
        <label className={styles.field}>
          <span>Company (optional)</span>
          <input
            name="company"
            autoComplete="organization"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Organisation"
          />
        </label>
        <label className={styles.field}>
          <span>City (optional)</span>
          <input
            name="city"
            autoComplete="address-level2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Metro / town"
          />
        </label>
      </div>
      <label className={styles.field}>
        <span>What do you need?</span>
        <textarea
          name="message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Sites, kW capacity, preferred timeline…"
        />
      </label>
      <div className={styles.actions}>
        <button type="submit" className="om-btn om-btn--primary">
          Open email draft
        </button>
        {sentHint ? (
          <p className={styles.hint} role="status">
            If nothing opened, email {SUPPORT_EMAIL} directly.
          </p>
        ) : null}
      </div>
    </form>
  );
}
