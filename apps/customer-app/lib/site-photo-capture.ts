import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Alert } from "react-native";
import type { SitePhotoCaptureGeo } from "@oorjaman/api";
import { ensureForegroundLocationAccess } from "./location-access";
import type { SitePhotoSource } from "./site-photo-source-prompt";
import { ensureReadableImageFileUri } from "./read-local-image-bytes";

export type SitePhotoPickResult = {
  uri: string;
  geo: SitePhotoCaptureGeo;
  source: SitePhotoSource;
};

function isCameraUnavailableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /camera not available/i.test(msg) || /simulator/i.test(msg);
}

async function captureGeo(): Promise<SitePhotoCaptureGeo | null> {
  const access = await ensureForegroundLocationAccess({
    settingsTitle: "Location required for site photos",
    settingsMessage:
      "Site photos need GPS for the map stamp. Enable location for OorjaMan in Settings, then try again.",
  });
  if (!access.ok) return null;

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy_m: pos.coords.accuracy ?? null,
  };
}

async function pickImageUri(source: SitePhotoSource): Promise<string | null> {
  if (source === "camera") {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) {
      Alert.alert("Camera access", "Allow camera access to photograph your solar site.");
      return null;
    }
    try {
      const shot = await ImagePicker.launchCameraAsync({ quality: 0.9, exif: true });
      if (shot.canceled || !shot.assets[0]?.uri) return null;
      return ensureReadableImageFileUri(shot.assets[0].uri);
    } catch (e: unknown) {
      if (isCameraUnavailableError(e)) {
        Alert.alert(
          "Camera unavailable",
          "Use “Choose from gallery” or test on a physical device.",
        );
      } else {
        Alert.alert("Camera error", e instanceof Error ? e.message : "Could not open camera.");
      }
      return null;
    }
  }

  const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!libraryPerm.granted) {
    Alert.alert("Photos access", "Allow access to your photo library to attach a site image.");
    return null;
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.9,
    exif: true,
    allowsEditing: false,
    allowsMultipleSelection: false,
  });
  if (picked.canceled || !picked.assets[0]?.uri) return null;
  return ensureReadableImageFileUri(picked.assets[0].uri);
}

/**
 * Open camera or gallery (source chosen by caller), then attach GPS.
 * Caller must invoke {@link promptSitePhotoSource} before this.
 */
export async function pickSitePhotoWithGeo(source: SitePhotoSource): Promise<SitePhotoPickResult | null> {
  const uri = await pickImageUri(source);
  if (!uri) return null;

  const geo = await captureGeo();
  if (!geo) return null;

  return { uri, geo, source };
}
