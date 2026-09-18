import type { SitePhotoCaptureGeo } from "@oorjaman/api";
import { Alert } from "react-native";
import { ensureForegroundLocationAccess } from "./location-access";
import type { SitePhotoSource } from "./site-photo-source-prompt";

export type SitePhotoPickResult = {
  uri: string;
  geo: SitePhotoCaptureGeo;
  source: SitePhotoSource;
  width: number;
  height: number;
};

const SITE_PHOTO_LOCATION_PROMPT = {
  settingsTitle: "Location required for site photos",
  settingsMessage:
    "Site photos need GPS for the map stamp. Allow location access when prompted, or enable it in your browser settings.",
} as const;

function pickImageFile(source: SitePhotoSource): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (source === "camera") {
      input.setAttribute("capture", "environment");
    }
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onWindowFocus);
      input.remove();
      resolve(file);
    };

    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled && !input.files?.length) finish(null);
      }, 400);
    };

    input.addEventListener("change", () => {
      finish(input.files?.[0] ?? null);
    });
    input.addEventListener("cancel", () => {
      finish(null);
    });

    document.body.appendChild(input);
    input.click();
    window.setTimeout(() => {
      if (!settled) window.addEventListener("focus", onWindowFocus);
    }, 500);
  });
}

function readImageDimensions(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = objectUrl;
  });
}

async function readCurrentGeo(): Promise<SitePhotoCaptureGeo | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    Alert.alert(SITE_PHOTO_LOCATION_PROMPT.settingsTitle, "This browser does not support location.");
    return null;
  }
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 5_000,
      });
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy_m: pos.coords.accuracy ?? null,
    };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? Number((e as { code?: unknown }).code) : NaN;
    Alert.alert(
      SITE_PHOTO_LOCATION_PROMPT.settingsTitle,
      code === 1
        ? "Location permission was denied. Allow access in browser settings, then try again."
        : e instanceof Error
          ? e.message
          : "Could not read GPS for this photo.",
    );
    return null;
  }
}

/**
 * Web site photo pick via `<input type="file" capture>` + browser geolocation.
 * Opens the file dialog first (must stay in the user-activation chain), then reads GPS.
 */
export async function pickSitePhotoWithGeo(source: SitePhotoSource): Promise<SitePhotoPickResult | null> {
  const file = await pickImageFile(source);
  if (!file) return null;

  const uri = URL.createObjectURL(file);
  const dims = await readImageDimensions(uri);

  if (!(await ensureForegroundLocationAccess(SITE_PHOTO_LOCATION_PROMPT)).ok) {
    URL.revokeObjectURL(uri);
    return null;
  }

  const geo = await readCurrentGeo();
  if (!geo) {
    URL.revokeObjectURL(uri);
    return null;
  }

  return {
    uri,
    geo,
    source,
    width: dims.width,
    height: dims.height,
  };
}
