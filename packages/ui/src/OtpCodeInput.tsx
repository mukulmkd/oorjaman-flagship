import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { colors, fontFamily, fontSize, spacing } from "@oorjaman/config";

export type OtpCodeInputProps = {
  length?: number;
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
} & Pick<TextInputProps, "accessibilityLabel" | "accessibilityHint">;

const DEFAULT_LENGTH = 6;

/** Dismiss OTP keyboard before leaving the login screen (avoids Android IME crashes). */
export async function dismissOtpKeyboard(input?: TextInput | null): Promise<void> {
  input?.blur();
  Keyboard.dismiss();
  if (Platform.OS === "android") {
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}

export const OtpCodeInput = forwardRef<TextInput, OtpCodeInputProps>(function OtpCodeInput(
  {
    length = DEFAULT_LENGTH,
    value,
    onChangeText,
    editable = true,
    accessibilityLabel = "One-time code",
    accessibilityHint = "Six digit SMS verification code",
  },
  ref,
) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  useImperativeHandle(ref, () => inputRef.current as TextInput);

  useEffect(() => {
    if (!editable) inputRef.current?.blur();
  }, [editable]);

  const chars = useMemo(() => {
    const split = value.replace(/\D/g, "").slice(0, length).split("");
    return Array.from({ length }, (_, i) => split[i] ?? "");
  }, [value, length]);

  const activeIndex = Math.min(value.replace(/\D/g, "").length, length - 1);

  const handleChange = (text: string) => {
    onChangeText(text.replace(/\D/g, "").slice(0, length));
  };

  return (
    <View style={[styles.wrap, !editable && styles.wrapDisabled]}>
      <View style={styles.row} pointerEvents="none">
        {chars.map((ch, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              ch ? styles.cellFilled : null,
              editable && focused && i === activeIndex ? styles.cellActive : null,
            ]}
          >
            <Text style={styles.digit}>{ch}</Text>
          </View>
        ))}
      </View>
      {/*
        Full-area transparent input (on-screen so focus/keyboard work). Off-screen + opacity:0
        broke taps on Android. Digits render in the cells above; IME crash on logout is handled
        by dismissOtpKeyboard() before navigation and unmounting while verifying.
      */}
      <TextInput
        ref={inputRef}
        value={value}
        editable={editable}
        pointerEvents={editable ? "auto" : "none"}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === "android" ? "sms-otp" : undefined}
        {...(Platform.OS === "android" ? { importantForAutofill: "yes" as const } : {})}
        maxLength={length}
        caretHidden
        autoCorrect={false}
        spellCheck={false}
        selectTextOnFocus={false}
        contextMenuHidden
        style={styles.hiddenInput}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    marginTop: spacing.sm,
    minHeight: 52,
  },
  wrapDisabled: {
    opacity: 0.55,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 52,
  },
  cell: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  cellFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.muted,
  },
  cellActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  digit: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: "transparent",
    backgroundColor: "transparent",
    fontSize: 1,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    ...(Platform.OS === "android" ? { underlineColorAndroid: "transparent" as const } : {}),
  },
});
