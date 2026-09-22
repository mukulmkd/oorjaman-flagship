import { createElement } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@oorjaman/config";

type Props = {
  embedUrl: string;
  title?: string;
};

/** Web: OSM embed (Google Maps blocks iframe embedding). */
export function JobDirectionsPreview({ embedUrl, title = "Route to customer site" }: Props) {
  return (
    <View style={styles.wrap}>
      {createElement("iframe", {
        title,
        src: embedUrl,
        style: {
          display: "block",
          width: "100%",
          height: "100%",
          border: 0,
        },
        loading: "lazy",
        referrerPolicy: "no-referrer-when-downgrade",
      })}
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
});
