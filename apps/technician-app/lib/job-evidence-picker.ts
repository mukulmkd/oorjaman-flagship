import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

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
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
  });
  return picked.canceled ? null : (picked.assets[0]?.uri ?? null);
}

async function pickFromCamera(cameraType?: ImagePicker.CameraType): Promise<string | null> {
  const camPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (!camPerm.granted) {
    Alert.alert("Camera", "Camera permission is required to take a photo.");
    return null;
  }
  try {
    const shot = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      cameraType,
    });
    return shot.canceled ? null : (shot.assets[0]?.uri ?? null);
  } catch (e: unknown) {
    if (!isCameraUnavailableError(e)) throw e;
    Alert.alert(
      "Camera unavailable",
      "Opening your photo library instead. On a real device, the camera is used.",
    );
    return pickFromLibrary();
  }
}

/**
 * Picks a job evidence image. On the iOS/Android simulator (no camera), uses the photo library automatically.
 */
export async function pickJobEvidenceImageUri(options?: {
  source?: "camera" | "library";
  cameraType?: ImagePicker.CameraType;
}): Promise<string | null> {
  const source = options?.source ?? "camera";

  if (source === "library" || !Device.isDevice) {
    if (!Device.isDevice && source === "camera") {
      Alert.alert(
        "Simulator demo",
        "The simulator has no camera. Pick a photo from the library to continue the demo.",
      );
    }
    return pickFromLibrary();
  }

  return pickFromCamera(options?.cameraType);
}
