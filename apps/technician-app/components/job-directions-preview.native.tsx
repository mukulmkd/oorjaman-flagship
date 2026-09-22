import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "@oorjaman/config";

type Props = {
  embedUrl: string;
  title?: string;
};

/** Native: OSM embed in WebView so the route preview is visible in-app. */
export function JobDirectionsPreview({ embedUrl }: Props) {
  return (
    <View style={styles.wrap}>
      <WebView
        source={{ uri: embedUrl }}
        style={styles.webview}
        scrollEnabled={false}
        nestedScrollEnabled
        startInLoadingState
        originWhitelist={["https://*"]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.muted,
  },
});
