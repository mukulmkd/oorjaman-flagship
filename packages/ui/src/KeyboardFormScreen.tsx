import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "@oorjaman/config";

export type KeyboardFormScreenRef = {
  /** Scroll content so lower fields (OTP, buttons) sit above the keyboard. */
  scrollToEnd: (animated?: boolean) => void;
};

export type KeyboardFormScreenProps = {
  children: ReactNode;
  /** Extra offset for fixed headers / nav bars (mainly iOS). */
  keyboardVerticalOffset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Nudge scroll when the keyboard opens — useful on login / OTP screens. */
  scrollToEndOnKeyboard?: boolean;
};

export const KeyboardFormScreen = forwardRef<KeyboardFormScreenRef, KeyboardFormScreenProps>(
  function KeyboardFormScreen(
    { children, keyboardVerticalOffset = 0, contentContainerStyle, scrollToEndOnKeyboard = false },
    ref,
  ) {
    const scrollRef = useRef<ScrollView>(null);

    const scrollToEnd = (animated = true) => {
      scrollRef.current?.scrollToEnd({ animated });
    };

    useImperativeHandle(ref, () => ({ scrollToEnd }), []);

    useEffect(() => {
      if (!scrollToEndOnKeyboard) return;
      const event = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
      const sub = Keyboard.addListener(event, () => scrollToEnd(true));
      return () => sub.remove();
    }, [scrollToEndOnKeyboard]);

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  },
);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
