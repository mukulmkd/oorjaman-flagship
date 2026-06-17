import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Alert, InteractionManager, Platform } from "react-native";
import type { SitePhotoCaptureGeo } from "@oorjaman/api";
import { ensureForegroundLocationAccess } from "./location-access";
import { prepareSitePhotoUri } from "./prepare-site-photo-uri";
import type { SitePhotoSource } from "./site-photo-source-prompt";
import { ensureReadableImageFileUri } from "./read-local-image-bytes";

export type SitePhotoPickResult = {
  uri: string;
  geo: SitePhotoCaptureGeo;
  source: SitePhotoSource;
  width: number;
  height: number;
};

/** iOS library/camera can return HEIC; request JPEG-compatible output for stamping and upload. */
const IOS_JPEG_PICK_OPTIONS: Pick<
  ImagePicker.ImagePickerOptions,
  "preferredAssetRepresentationMode"
> =
  Platform.OS === "ios"
    ? {
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      }
    : {};

const LIBRARY_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.85,
  allowsEditing: false,
  allowsMultipleSelection: false,
  ...IOS_JPEG_PICK_OPTIONS,
};

/** Keep camera options minimal on Android — extra flags (exif, etc.) have caused native failures on some OEMs. */
const CAMERA_OPTIONS: ImagePicker.ImagePickerOptions = {
  quality: 0.85,
  allowsEditing: false,
  ...(Platform.OS === "ios" ? { exif: true, ...IOS_JPEG_PICK_OPTIONS } : {}),
};

function isCameraUnavailableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /camera not available/i.test(msg) || /simulator/i.test(msg);
}

/** iOS only: action sheet must finish dismissing before presenting camera. */
async function waitForSourcePickerDismissal(): Promise<void> {
  if (Platform.OS !== "ios") return;
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, 350);
    });
  });
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

async function normalizePickedUri(rawUri: string | undefined): Promise<string | null> {
  if (!rawUri?.trim()) return null;
  try {
    return await ensureReadableImageFileUri(rawUri);
  } catch (e: unknown) {
    Alert.alert("Photo error", e instanceof Error ? e.message : "Could not read the selected photo.");
    return null;
  }
}

async function pickFromLibrary(): Promise<string | null> {
  const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!libraryPerm.granted) {
    Alert.alert("Photos access", "Allow access to your photo library to attach a site image.");
    return null;
  }

  await waitForSourcePickerDismissal();
  const picked = await ImagePicker.launchImageLibraryAsync(LIBRARY_OPTIONS);
  if (picked.canceled || !picked.assets[0]?.uri) return null;
  return normalizePickedUri(picked.assets[0].uri);
}

async function pickFromCamera(): Promise<string | null> {
  if (!Device.isDevice) {
    Alert.alert(
      "Camera unavailable",
      "The simulator has no camera. Choose from gallery or test on a physical device.",
    );
    return pickFromLibrary();
  }

  const camPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (!camPerm.granted) {
    Alert.alert("Camera access", "Allow camera access to photograph your solar site.");
    return null;
  }

  await waitForSourcePickerDismissal();
  try {
    const shot = await ImagePicker.launchCameraAsync(CAMERA_OPTIONS);
    if (shot.canceled || !shot.assets[0]?.uri) return null;
    return normalizePickedUri(shot.assets[0].uri);
  } catch (e: unknown) {
    if (isCameraUnavailableError(e)) {
      Alert.alert(
        "Camera unavailable",
        "Opening your photo library instead. On a real device, the camera is used.",
      );
      return pickFromLibrary();
    }
    Alert.alert("Camera error", e instanceof Error ? e.message : "Could not open camera.");
    return null;
  }
}

async function pickImageUri(source: SitePhotoSource): Promise<string | null> {
  return source === "camera" ? pickFromCamera() : pickFromLibrary();
}

/**
 * Open camera or gallery (source chosen by caller), then attach GPS.
 * Caller must invoke {@link promptSitePhotoSource} before this.
 */
export async function pickSitePhotoWithGeo(source: SitePhotoSource): Promise<SitePhotoPickResult | null> {
  const rawUri = await pickImageUri(source);
  if (!rawUri) return null;

  const prepared = await prepareSitePhotoUri(rawUri, source);

  const geo = await captureGeo();
  if (!geo) return null;

  return {
    uri: prepared.uri,
    geo,
    source,
    width: prepared.width,
    height: prepared.height,
  };
}
