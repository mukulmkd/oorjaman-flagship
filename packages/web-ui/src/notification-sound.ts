import type { NotificationAudience } from "@oorjaman/api";

export type NotificationSoundAudience = NotificationAudience | "support";

const MUTE_KEYS: Record<NotificationSoundAudience, string> = {
  admin: "oorjaman_admin_notifications_sound_muted",
  vendor: "oorjaman_vendor_notifications_sound_muted",
  support: "oorjaman_support_notifications_sound_muted",
};

export function isNotificationSoundMuted(audience: NotificationSoundAudience = "support"): boolean {
  try {
    return localStorage.getItem(MUTE_KEYS[audience]) === "1";
  } catch {
    return false;
  }
}

export function setNotificationSoundMuted(audience: NotificationSoundAudience, muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEYS[audience], muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Short two-tone chime for new in-app alerts (Web Audio). */
export function playNotificationChime(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    };
    playTone(880, now, 0.12);
    playTone(1174, now + 0.1, 0.16);
    window.setTimeout(() => void ctx.close(), 400);
  } catch {
    /* autoplay policy or unsupported */
  }
}
