const MUTE_KEY_ADMIN = "oorjaman_admin_notifications_sound_muted";
const MUTE_KEY_VENDOR = "oorjaman_vendor_notifications_sound_muted";

export function isNotificationSoundMuted(audience: "admin" | "vendor"): boolean {
  try {
    const key = audience === "admin" ? MUTE_KEY_ADMIN : MUTE_KEY_VENDOR;
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function setNotificationSoundMuted(audience: "admin" | "vendor", muted: boolean): void {
  try {
    const key = audience === "admin" ? MUTE_KEY_ADMIN : MUTE_KEY_VENDOR;
    localStorage.setItem(key, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Short two-tone chime for new in-app alerts (Web Audio). */
export function playNotificationChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
