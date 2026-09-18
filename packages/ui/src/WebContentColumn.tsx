import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
  USE_WEB_LAYOUT,
  WEB_PAGE_GUTTER,
  webContentColumnStyle,
  type WebContentVariant,
} from "./web-layout";

type Props = {
  children: ReactNode;
  variant?: WebContentVariant;
  maxWidth?: number;
  /** Vertically center column contents on tall web viewports (auth). */
  centerVertically?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Constrains children to a readable web column. On native, renders a plain flex View.
 */
export function WebContentColumn({
  children,
  variant = "page",
  maxWidth,
  centerVertically = false,
  style,
}: Props) {
  if (!USE_WEB_LAYOUT) {
    return <View style={[styles.nativeFill, style]}>{children}</View>;
  }

  return (
    <View
      style={[
        styles.webHost,
        centerVertically && styles.webCenterVertically,
        style,
      ]}
    >
      <View
        style={[
          webContentColumnStyle(variant, {
            maxWidth,
            gutter: WEB_PAGE_GUTTER,
          }),
          styles.webColumn,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeFill: {
    flex: 1,
  },
  webHost: {
    flex: 1,
    width: "100%",
  },
  webCenterVertically: {
    justifyContent: "center",
  },
  webColumn: {
    flexGrow: 1,
  },
});
