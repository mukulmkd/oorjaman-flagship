import { ActionSheetIOS, Alert, Platform } from "react-native";

export type SitePhotoSource = "camera" | "library";

/** One-shot camera vs gallery choice — must finish before opening the system picker. */
export function promptSitePhotoSource(): Promise<SitePhotoSource | null> {
  if (Platform.OS === "ios") {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Add site photo",
          message: "Take a new photo or choose one from your gallery.",
          options: ["Take photo", "Choose from gallery", "Cancel"],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) resolve("camera");
          else if (buttonIndex === 1) resolve("library");
          else resolve(null);
        },
      );
    });
  }

  return new Promise((resolve) => {
    Alert.alert(
      "Add site photo",
      "Take a new photo or choose one from your gallery.",
      [
        { text: "Take photo", onPress: () => resolve("camera") },
        { text: "Choose from gallery", onPress: () => resolve("library") },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
