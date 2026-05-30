import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  authApi,
  buildLoginE164,
  DEFAULT_LOGIN_COUNTRY_DIAL,
  getDummyAuthUiHint,
  LOGIN_PHONE_COUNTRIES,
  resolveTechnicianAppPostAuthPath,
  validateLoginNationalPhone,
} from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { LoginPhoneRow } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";

const OTP_LEN = 6;
const RESEND_SEC = 48;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const otpRef = useRef<TextInput>(null);
  const autoVerifyOtpRef = useRef<string | null>(null);

  const [countryDial, setCountryDial] = useState(DEFAULT_LOGIN_COUNTRY_DIAL);
  const [nationalPhone, setNationalPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [e164, setE164] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    setOtpSent(false);
    setOtp("");
    setE164(null);
    setError(null);
    autoVerifyOtpRef.current = null;
  }, [nationalPhone, countryDial]);

  useEffect(() => {
    if (otp.length < OTP_LEN) {
      autoVerifyOtpRef.current = null;
    }
  }, [otp]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const otpChars = useMemo(() => {
    const chars = otp.split("").slice(0, OTP_LEN);
    return Array.from({ length: OTP_LEN }, (_, i) => chars[i] ?? "");
  }, [otp]);

  const [otpInputFocused, setOtpInputFocused] = useState(false);
  /** Index of the cell where the caret effectively sits (next empty or last filled). */
  const activeOtpIndex = Math.min(otp.length, OTP_LEN - 1);

  const dummyHint = useMemo(() => getDummyAuthUiHint(), []);

  const sendOtp = useCallback(async () => {
    setError(null);
    if (!supabase) {
      setError(
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment, then rebuild.",
      );
      return;
    }
    const phoneErr = validateLoginNationalPhone(nationalPhone);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    const normalized = buildLoginE164(countryDial, nationalPhone);
    setSending(true);
    try {
      await authApi.requestPhoneOtp(supabase, normalized, {
        data: { role: "technician", phone: normalized },
      });
      setE164(normalized);
      setOtpSent(true);
      setCooldown(RESEND_SEC);
      otpRef.current?.focus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send code. Try again.");
    } finally {
      setSending(false);
    }
  }, [nationalPhone, countryDial]);

  const verify = useCallback(async () => {
    setError(null);
    if (!supabase) return;
    if (!e164) {
      setError("Send the verification code first.");
      return;
    }
    if (otp.length !== OTP_LEN) {
      setError(`Enter the ${OTP_LEN}-digit code from SMS.`);
      return;
    }
    setVerifying(true);
    try {
      await authApi.verifyPhoneOtp(supabase, e164, otp);
      const path = await resolveTechnicianAppPostAuthPath(supabase);
      router.replace(path as Href);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally {
      setVerifying(false);
    }
  }, [e164, otp]);

  useEffect(() => {
    if (!otpSent || otp.length !== OTP_LEN || verifying || sending || !e164 || !supabase) return;
    if (autoVerifyOtpRef.current === otp) return;
    autoVerifyOtpRef.current = otp;
    const id = setTimeout(() => void verify(), 380);
    return () => clearTimeout(id);
  }, [otp, otpSent, verifying, sending, e164, verify]);

  const resendLabel =
    cooldown > 0 ? `Resend code (${cooldown}s)` : otpSent ? "Resend code" : "Send code";

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <Text style={styles.kicker}>Technician access</Text>
        <Text style={styles.title}>Sign in with mobile</Text>
        <Text style={styles.lede}>
          Use the mobile number registered with operations. We'll verify via SMS OTP.
        </Text>

        {dummyHint ? (
          <View style={styles.dummyBanner}>
            <Text style={styles.dummyBannerText}>{dummyHint}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <LoginPhoneRow
          countries={LOGIN_PHONE_COUNTRIES}
          countryDialCode={countryDial}
          onCountryDialCodeChange={setCountryDial}
          nationalDigits={nationalPhone}
          onNationalDigitsChange={setNationalPhone}
          editable={!verifying}
        />

        <View style={styles.otpHeader}>
          <Text style={styles.label}>One-time code</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={resendLabel}
            disabled={sending || verifying || cooldown > 0}
            onPress={() => void sendOtp()}
          >
            <Text style={[styles.link, (sending || cooldown > 0 || verifying) && styles.linkMuted]}>
              {sending ? "Sending…" : resendLabel}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.otpSmsHint}>
          After you send the code, tap the boxes - the cursor appears there as you type. On iPhone and many Android
          phones, the code can autofill from SMS when the message contains a 6-digit code.
        </Text>

        <Pressable
          style={styles.otpRowWrap}
          onPress={() => {
            if (otpSent && !verifying) otpRef.current?.focus();
          }}
          accessibilityRole="none"
        >
          <View style={styles.otpRow} pointerEvents="none">
            {otpChars.map((ch, i) => (
              <View
                key={i}
                style={[
                  styles.otpCell,
                  ch ? styles.otpCellFilled : null,
                  otpSent && otpInputFocused && i === activeOtpIndex ? styles.otpCellActive : null,
                ]}
              >
                <Text style={styles.otpDigit}>{ch}</Text>
              </View>
            ))}
          </View>
          <TextInput
            ref={otpRef}
            value={otp}
            editable={otpSent && !verifying}
            onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, OTP_LEN))}
            onFocus={() => setOtpInputFocused(true)}
            onBlur={() => setOtpInputFocused(false)}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete={Platform.OS === "android" ? "sms-otp" : undefined}
            {...(Platform.OS === "android" ? { importantForAutofill: "yes" as const } : {})}
            maxLength={OTP_LEN}
            style={styles.otpOverlayInput}
            {...(Platform.OS === "android" ? { cursorColor: colors.primary } : {})}
            accessibilityLabel="One-time code"
            accessibilityHint="Six digit SMS verification code"
            selectionColor={colors.primary}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Verify and continue"
          disabled={verifying || otp.length !== OTP_LEN || !otpSent}
          onPress={() => void verify()}
          style={({ pressed }) => [
            styles.primary,
            (verifying || otp.length !== OTP_LEN || !otpSent) && styles.primaryDisabled,
            pressed && !(verifying || otp.length !== OTP_LEN || !otpSent) && styles.primaryPressed,
          ]}
        >
          {verifying ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.primaryLabel}>Verify & continue</Text>
          )}
        </Pressable>

        <View style={styles.footerSpacer} />

        <Text style={styles.hint}>Sessions stay signed in until you explicitly sign out.</Text>

        <Text style={styles.footerNote}>
          New technician? Use the same sign-in above. After your number is verified, we’ll walk you through
          onboarding.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  kicker: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    letterSpacing: -0.4,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  lede: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  dummyBanner: {
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#a7f3d0",
    marginBottom: spacing.xs,
  },
  dummyBannerText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: "#065f46",
  },
  errorBanner: {
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.primaryMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryBorder,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.foreground,
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  input: {
    marginTop: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    color: colors.foreground,
    backgroundColor: colors.muted,
  },
  otpHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  link: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  linkMuted: {
    color: colors.mutedForeground,
  },
  otpSmsHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  otpRowWrap: {
    position: "relative",
    marginTop: spacing.sm,
    minHeight: 52,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 52,
  },
  otpCell: {
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
  otpCellFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.muted,
  },
  otpCellActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  otpDigit: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xl,
    color: colors.foreground,
  },
  /** Covers the OTP cells; glyphs are invisible so digits show only in boxes - caret stays visible for feedback + SMS autofill. */
  otpOverlayInput: {
    ...StyleSheet.absoluteFillObject,
    fontFamily: fontFamily.semiBold,
    fontSize: 22,
    color: "transparent",
    textAlign: "center",
    paddingHorizontal: spacing.xs,
    letterSpacing: 10,
    zIndex: 2,
  },
  primary: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryPressed: {
    opacity: 0.92,
  },
  primaryDisabled: {
    opacity: 0.45,
  },
  primaryLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: colors.primaryForeground,
  },
  footerSpacer: {
    flex: 1,
    minHeight: 16,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  footerNote: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
