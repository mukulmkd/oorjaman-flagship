import { forwardRef, type ReactNode, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, fontFamily, fontSize, lineHeight, spacing } from "@oorjaman/config";

export type InputProps = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
  leftAccessory?: ReactNode;
  rightAccessory?: ReactNode;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    helperText,
    errorText,
    leftAccessory,
    rightAccessory,
    editable = true,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const showError = Boolean(errorText);
  const multiline = Boolean(rest.multiline);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label} accessibilityRole="text">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.fieldRow,
          multiline && styles.fieldRowMultiline,
          showError ? styles.fieldRowError : focused ? styles.fieldRowFocused : styles.fieldRowDefault,
          !editable && styles.fieldRowDisabled,
        ]}
      >
        {leftAccessory ? <View style={styles.accessory}>{leftAccessory}</View> : null}
        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, multiline && styles.inputMultiline]}
          {...(Platform.OS === "android"
            ? {
                includeFontPadding: false,
                textAlignVertical: multiline ? "top" : "center",
              }
            : {})}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {showError ? (
        <Text style={styles.error}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    gap: spacing.xs,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: colors.foreground,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    minHeight: 48,
    backgroundColor: colors.card,
  },
  fieldRowMultiline: {
    minHeight: 96,
    paddingVertical: spacing.sm,
  },
  fieldRowDefault: {
    borderColor: colors.border,
  },
  fieldRowError: {
    borderColor: colors.destructive,
  },
  fieldRowFocused: {
    borderColor: colors.primary,
  },
  fieldRowDisabled: {
    opacity: 0.55,
    backgroundColor: colors.muted,
  },
  input: {
    flex: 1,
    padding: 0,
    margin: 0,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.foreground,
    ...(Platform.OS === "ios" ? { lineHeight: lineHeight.md } : {}),
  },
  inputMultiline: {
    minHeight: 72,
    ...(Platform.OS === "ios" ? { paddingTop: 2 } : {}),
  },
  accessory: {
    paddingHorizontal: spacing["3xs"],
  },
  helper: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: colors.mutedForeground,
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: colors.destructive,
  },
});
