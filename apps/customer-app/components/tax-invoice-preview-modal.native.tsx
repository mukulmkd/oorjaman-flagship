import { Modal, Platform, StyleSheet, Text, View, ActivityIndicator, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import { initialWindowMetrics, SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { Button } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";

type Props = {
  visible: boolean;
  html: string | null;
  loading?: boolean;
  title?: string;
  onClose: () => void;
  onShare: () => void;
  onDownload: () => void;
  shareLoading?: boolean;
  downloadLoading?: boolean;
};

function TaxInvoicePreviewModalBody({
  html,
  loading = false,
  title = "Tax invoice",
  onClose,
  onShare,
  onDownload,
  shareLoading = false,
  downloadLoading = false,
}: Omit<Props, "visible">) {
  const insets = useSafeAreaInsets();
  const busy = loading || shareLoading || downloadLoading || !html;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, spacing.md) + spacing.sm,
          },
        ]}
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close invoice">
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        {loading || !html ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Preparing invoice…</Text>
          </View>
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={styles.webview}
            setSupportMultipleWindows={false}
            startInLoadingState
            javaScriptEnabled
            // Screen preview HTML is already device-width; avoid Android scale-to-fit zoom.
            scalesPageToFit={false}
            showsVerticalScrollIndicator
            showsHorizontalScrollIndicator={false}
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            bounces={false}
            overScrollMode="never"
          />
        )}
      </View>
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
          },
        ]}
      >
        <Button
          variant="outline"
          size="md"
          loading={downloadLoading}
          disabled={busy && !downloadLoading}
          onPress={onDownload}
          style={styles.footerBtn}
          accessibilityLabel="Download tax invoice PDF"
        >
          Download
        </Button>
        <Button
          variant="primary"
          size="md"
          loading={shareLoading}
          disabled={busy && !shareLoading}
          onPress={onShare}
          style={styles.footerBtn}
          accessibilityLabel="Share tax invoice PDF"
        >
          Share PDF
        </Button>
      </View>
    </View>
  );
}

export function TaxInvoicePreviewModal(props: Props) {
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={props.onClose}
      statusBarTranslucent={Platform.OS === "android"}
      navigationBarTranslucent={Platform.OS === "android"}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
        <TaxInvoicePreviewModalBody {...props} />
      </SafeAreaProvider>
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
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  title: {
    flex: 1,
    marginRight: spacing.md,
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  close: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  body: {
    flex: 1,
    backgroundColor: "#fff",
  },
  webview: {
    flex: 1,
    backgroundColor: "#fff",
    width: "100%",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  footerBtn: {
    flex: 1,
  },
});
