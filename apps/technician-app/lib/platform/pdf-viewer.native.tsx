import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "@oorjaman/config";

type Props = {
  url: string;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  loading?: boolean;
};

/** Native PDF preview via WebView. */
export function PdfDocumentPreview({ url, onLoadStart, onLoadEnd, loading }: Props) {
  return (
    <View style={styles.wrap}>
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onError={onLoadEnd}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      />
      {loading ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.muted,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
