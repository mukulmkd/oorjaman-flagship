import { useEffect, useRef } from "react";
import { Dimensions, Keyboard, Platform, type KeyboardEvent, type View } from "react-native";
import type { KeyboardFormScreenRef } from "@oorjaman/ui";

const GAP_ABOVE_KEYBOARD = 16;

/**
 * Shift the one-time code up by only the amount the keypad covers.
 * Scrolling to the end of the form hides the boxes above the screen.
 */
export function usePartnerOtpKeyboardLift() {
  const formRef = useRef<KeyboardFormScreenRef>(null);
  const anchorRef = useRef<View>(null);
  const keyboardHeightRef = useRef(0);
  const focusedRef = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = () => {
    if (Platform.OS !== "ios" || !focusedRef.current) return;
    const keyboardHeight = keyboardHeightRef.current;
    const anchor = anchorRef.current;
    if (keyboardHeight <= 0 || !anchor) return;

    anchor.measureInWindow((_x, y, _width, height) => {
      if (height < 1) return;
      const keyboardTop = Dimensions.get("window").height - keyboardHeight;
      const overlap = y + height + GAP_ABOVE_KEYBOARD - keyboardTop;
      if (overlap > 1) formRef.current?.scrollBy(overlap);
    });
  };

  const scheduleReveal = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      revealTimer.current = null;
      reveal();
    }, 50);
  };

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const onFrame = (event: KeyboardEvent) => {
      const visible = Math.max(
        0,
        Dimensions.get("window").height - event.endCoordinates.screenY,
      );
      keyboardHeightRef.current = visible;
      if (visible > 0 && focusedRef.current) scheduleReveal();
    };
    const show = Keyboard.addListener("keyboardDidShow", onFrame);
    const change = Keyboard.addListener("keyboardDidChangeFrame", onFrame);
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardHeightRef.current = 0;
    });
    return () => {
      show.remove();
      change.remove();
      hide.remove();
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  return {
    formRef,
    anchorRef,
    onOtpFocus: () => {
      focusedRef.current = true;
      if (keyboardHeightRef.current > 0) scheduleReveal();
    },
    onOtpBlur: () => {
      focusedRef.current = false;
    },
  };
}
