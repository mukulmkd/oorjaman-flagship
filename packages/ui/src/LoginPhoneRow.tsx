import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontFamily, fontSize, lineHeight, spacing } from "@oorjaman/config";
import { LOGIN_NATIONAL_MAX_DIGITS } from "@oorjaman/api";

export type PhoneCountryOption = { dialCode: string; label: string };

export type LoginPhoneRowProps = {
  countries: readonly PhoneCountryOption[];
  countryDialCode: string;
  onCountryDialCodeChange: (dial: string) => void;
  nationalDigits: string;
  onNationalDigitsChange: (digits: string) => void;
  editable?: boolean;
  label?: string;
};

export function LoginPhoneRow({
  countries,
  countryDialCode,
  onCountryDialCodeChange,
  nationalDigits,
  onNationalDigitsChange,
  editable = true,
  label = "Mobile number",
}: LoginPhoneRowProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => countries.find((c) => c.dialCode === countryDialCode) ?? countries[0],
    [countries, countryDialCode],
  );

  return (
    <View style={styles.block}>
      <Text style={styles.labelText} accessibilityRole="text">
        {label}
      </Text>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.countryBox, !editable && styles.muted, pressed && styles.pressed]}
          onPress={() => editable && setOpen(true)}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={`Country: ${selected?.label ?? ""}`}
        >
          <Text style={styles.countryText} numberOfLines={1}>
            {selected?.label ?? "-"}
          </Text>
        </Pressable>
        <TextInput
          style={styles.national}
          keyboardType="number-pad"
          maxLength={LOGIN_NATIONAL_MAX_DIGITS}
          placeholder="9876543210"
          placeholderTextColor={colors.mutedForeground}
          value={nationalDigits}
          editable={editable}
          onChangeText={(t) =>
            onNationalDigitsChange(t.replace(/\D/g, "").slice(0, LOGIN_NATIONAL_MAX_DIGITS))
          }
          textContentType="telephoneNumber"
          accessibilityLabel="Mobile number without country code"
        />
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalWrap}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.modalBackdrop]}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close country picker"
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Country code</Text>
              {countries.map((c) => (
                <Pressable
                  key={c.dialCode}
                  style={styles.option}
                  onPress={() => {
                    onCountryDialCodeChange(c.dialCode);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: spacing.md,
  },
  labelText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  countryBox: {
    flexShrink: 0,
    maxWidth: "52%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  muted: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  countryText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  national: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  modalWrap: {
    flex: 1,
  },
  modalBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  modalCenter: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    borderRadius: 14,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground,
  },
  option: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  optionText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
});
