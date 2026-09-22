import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Platform } from "react-native";

export type JobEvidenceCameraFacing = "front" | "back";

/** iOS returns HEIC by default; Storage buckets allow JPEG/PNG/WebP only. */
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

function isCameraUnavailableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /camera not available/i.test(msg) || /simulator/i.test(msg);
}

async function pickFromLibrary(): Promise<string | null> {
  const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!libraryPerm.granted) {
    Alert.alert("Photos", "Allow photo library access to attach evidence.");
    return null;
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    ...IOS_JPEG_PICK_OPTIONS,
  });
  return picked.canceled ? null : (picked.assets[0]?.uri ?? null);
}

async function pickFromCamera(): Promise<string | null> {
  const camPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (!camPerm.granted) {
    Alert.alert(
      "Camera permission needed",
      "Allow camera access in Settings so you can take on-site photos and selfies.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ],
    );
    return null;
  }
  try {
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      ...IOS_JPEG_PICK_OPTIONS,
    });
    return shot.canceled ? null : (shot.assets[0]?.uri ?? null);
  } catch (e: unknown) {
    if (isCameraUnavailableError(e)) {
      Alert.alert(
        "Camera unavailable",
        "Opening your photo library instead. On a real device, the camera is used.",
      );
      return pickFromLibrary();
    }
    Alert.alert("Camera error", e instanceof Error ? e.message : "Could not open the camera.");
    return null;
  }
}

/**
 * Picks a job evidence image. On the iOS/Android simulator (no camera), uses the photo library automatically.
 * `cameraType` is used on web (front selfie). Native expo-image-picker 57 no longer exposes CameraType —
 * the system camera UI lets the technician flip to the front camera.
 */
export async function pickJobEvidenceImageUri(options?: {
  source?: "camera" | "library";
  cameraType?: JobEvidenceCameraFacing;
}): Promise<string | null> {
  const source = options?.source ?? "camera";

  if (source === "library" || !Device.isDevice) {
    if (!Device.isDevice && source === "camera") {
      Alert.alert(
        "Simulator demo",
        "The simulator has no camera. Pick a photo from your library to continue the demo.",
      );
    }
    return pickFromLibrary();
  }

  return pickFromCamera();
}
