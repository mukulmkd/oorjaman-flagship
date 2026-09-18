import * as DocumentPicker from "expo-document-picker";

export type PickedTechnicianDocument = {
  uri: string;
  name: string;
  mime: string | null;
};

/** Native document picker for KYC / onboarding uploads. */
export async function pickTechnicianDocument(): Promise<PickedTechnicianDocument | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const a = res.assets[0];
  if (!a?.uri) return null;
  return {
    uri: a.uri,
    name: a.name ?? "document",
    mime: a.mimeType ?? null,
  };
}
