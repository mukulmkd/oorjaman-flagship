import { useState } from "react";
import { ActivityIndicator, Image, Modal, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@oorjaman/config";
import { ModalCloseButton } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { basenameFromStoragePath, documentPreviewKind } from "../lib/document-preview";

export type DocumentViewerModalProps = {
  visible: boolean;
  title: string;
  url: string | null;
  storagePath: string;
  onClose: () => void;
};

export function DocumentViewerModal({
  visible,
  title,
  url,
  storagePath,
  onClose,
}: DocumentViewerModalProps) {
  const insets = useSafeAreaInsets();
  const [previewLoading, setPreviewLoading] = useState(true);
  const kind = documentPreviewKind(storagePath);
  const filename = basenameFromStoragePath(storagePath);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {filename}
            </Text>
          </View>
          <ModalCloseButton onPress={onClose} accessibilityLabel="Close document preview" />
        </View>

        {!url ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : kind === "image" ? (
          <View style={styles.previewWrap}>
            {previewLoading ? (
              <ActivityIndicator style={styles.previewLoader} color={colors.primary} />
            ) : null}
            <Image
              source={{ uri: url }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={title}
              onLoadStart={() => setPreviewLoading(true)}
              onLoadEnd={() => setPreviewLoading(false)}
              onError={() => setPreviewLoading(false)}
            />
          </View>
        ) : kind === "pdf" ? (
          <View style={styles.previewWrap}>
            <WebView
              source={{ uri: url }}
              style={styles.webview}
              onLoadStart={() => setPreviewLoading(true)}
              onLoadEnd={() => setPreviewLoading(false)}
              onError={() => setPreviewLoading(false)}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webviewLoading}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
            />
            {previewLoading ? (
              <View style={styles.webviewLoadingOverlay} pointerEvents="none">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="document-outline" size={40} color={colors.mutedForeground} />
            <Text style={styles.fallbackTitle}>Preview not available</Text>
            <Text style={styles.fallbackBody}>
              This file type cannot be previewed in the app. Contact support if you need a copy.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  previewWrap: {
    flex: 1,
    backgroundColor: colors.muted,
  },
  image: {
    flex: 1,
    width: "100%",
  },
  previewLoader: {
    ...StyleSheet.absoluteFillObject,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webviewLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  webviewLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  fallbackTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    textAlign: "center",
  },
  fallbackBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
