import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  authApi,
  isPlayReviewEmailForApp,
  queryKeys,
  resolveCustomerAppPostAuthPath,
  validateEmailFormat,
} from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import {
  BrandLockup,
  Button,
  Input,
  OtpCodeInput,
  dismissOtpKeyboard,
  KeyboardFormScreen,
} from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { supabase } from "../lib/supabase";

const OTP_LEN = 6;
const RESEND_SEC = 48;
const PLAY_REVIEW_APP = "customer" as const;

export type LoginEmailOtpScreenProps = {
  /** Email | Mobile OTP switcher. */
  methodTabs?: ReactNode;
  /** Prod: show disabled SMS OTP “Coming soon”. Default true when no tabs. */
  showSmsComingSoon?: boolean;
  /** Use copy that identifies this as a local/UAT test account. */
  useTestAccountCopy?: boolean;
};

/** Email OTP sign-in (code from inbox). */
export function LoginEmailOtpScreen({
  methodTabs,
  showSmsComingSoon = !methodTabs,
  useTestAccountCopy = false,
}: LoginEmailOtpScreenProps) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const otpRef = useRef<TextInput>(null);
  const autoVerifyOtpRef = useRef<string | null>(null);
  const sendInFlightRef = useRef(false);

  const [email, setEmail] = useState("");
  const [emailForVerify, setEmailForVerify] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const playReviewMode = isPlayReviewEmailForApp(email, PLAY_REVIEW_APP);

  useEffect(() => {
    setOtpSent(false);
    setOtp("");
    setPassword("");
    setEmailForVerify(null);
    setError(null);
    autoVerifyOtpRef.current = null;
  }, [email]);

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

  const sendOtp = useCallback(async () => {
    if (sendInFlightRef.current || verifying || cooldown > 0) return;
    setError(null);
    if (!supabase) {
      setError(
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment, then rebuild.",
      );
      return;
    }
    const emailErr = validateEmailFormat(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (isPlayReviewEmailForApp(trimmed, PLAY_REVIEW_APP)) {
      setError("This account uses a password. Enter it below to continue.");
      return;
    }
    sendInFlightRef.current = true;
    setSending(true);
    Keyboard.dismiss();
    try {
      await authApi.requestEmailOtp(supabase, trimmed, {
        data: { role: "customer" },
      });
      setEmailForVerify(trimmed);
      setOtpSent(true);
      setCooldown(RESEND_SEC);
      otpRef.current?.focus();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Could not send code. Try again.",
      );
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }, [email, verifying, cooldown]);

  const signInWithPlayReviewPassword = useCallback(async () => {
    setError(null);
    if (!supabase) return;
    const emailErr = validateEmailFormat(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (!isPlayReviewEmailForApp(trimmed, PLAY_REVIEW_APP)) {
      setError("Password sign-in is only for the Play review account.");
      return;
    }
    if (!password.trim()) {
      setError("Enter the Play review password.");
      return;
    }
    setVerifying(true);
    let navigated = false;
    try {
      await authApi.signInWithEmailPassword(supabase, trimmed, password);
      Keyboard.dismiss();
      const path = await resolveCustomerAppPostAuthPath(supabase);
      navigated = true;
      router.replace(path as Href);
      void qc.invalidateQueries({ queryKey: queryKeys.users.me() });
      void qc.invalidateQueries({ queryKey: queryKeys.auth.user() });
      void qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      if (!navigated) setVerifying(false);
    }
  }, [email, password, qc]);

  const verify = useCallback(async () => {
    setError(null);
    if (!supabase) return;
    if (!emailForVerify) {
      setError("Send the verification code first.");
      return;
    }
    if (otp.length !== OTP_LEN) {
      setError(`Enter the ${OTP_LEN}-digit code from your email.`);
      return;
    }
    setVerifying(true);
    let navigated = false;
    try {
      await authApi.verifyEmailOtp(supabase, emailForVerify, otp);
      await dismissOtpKeyboard(otpRef.current);
      const path = await resolveCustomerAppPostAuthPath(supabase);
      navigated = true;
      router.replace(path as Href);
      void qc.invalidateQueries({ queryKey: queryKeys.users.me() });
      void qc.invalidateQueries({ queryKey: queryKeys.auth.user() });
      void qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally {
      if (!navigated) setVerifying(false);
    }
  }, [emailForVerify, otp, qc]);

  useEffect(() => {
    if (playReviewMode) return;
    if (
      !otpSent ||
      otp.length !== OTP_LEN ||
      verifying ||
      sending ||
      !emailForVerify ||
      !supabase
    ) {
      return;
    }
    if (autoVerifyOtpRef.current === otp) return;
    autoVerifyOtpRef.current = otp;
    const id = setTimeout(() => void verify(), 380);
    return () => clearTimeout(id);
  }, [otp, otpSent, verifying, sending, emailForVerify, verify, playReviewMode]);

  const resendLabel =
    cooldown > 0
      ? `Resend code (${cooldown}s)`
      : otpSent
        ? "Resend code"
        : "Send code";

  return (
    <KeyboardFormScreen
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      webVariant="auth"
      centerVertically
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.md,
        },
      ]}
    >
      <View style={styles.brandHeader}>
        <BrandLockup iconSize={96} />
      </View>
      {methodTabs}
      <Text style={styles.title}>Sign in with email</Text>
      <Text style={styles.lede}>
        {playReviewMode
          ? "Play review account detected. Enter the fixed password to continue (no email code)."
          : useTestAccountCopy
            ? "Send code, then enter the one-time code for your test account."
            : "We'll email you a one-time code. New accounts are created when you verify."}
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        editable={!verifying}
        placeholder="you@example.com"
      />

      {playReviewMode ? (
        <>
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            editable={!verifying}
            placeholder="Play review password"
            onSubmitEditing={() => void signInWithPlayReviewPassword()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            disabled={verifying || !password.trim()}
            onPress={() => void signInWithPlayReviewPassword()}
            style={({ pressed }) => [
              styles.primary,
              (verifying || !password.trim()) && styles.primaryDisabled,
              pressed && !(verifying || !password.trim()) && styles.primaryPressed,
            ]}
          >
            {verifying ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.primaryLabel}>Sign in</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.otpHeader}>
            <Text style={styles.label}>One-time code</Text>
            <Button
              variant="secondary"
              size="sm"
              accessibilityLabel={resendLabel}
              loading={sending}
              disabled={sending || verifying || cooldown > 0}
              onPress={() => void sendOtp()}
              style={styles.sendCodeBtn}
            >
              {resendLabel}
            </Button>
          </View>

          <Text style={styles.otpHint}>
            {useTestAccountCopy
              ? "Use the UAT one-time code 123456."
              : "After you send the code, check your inbox (and spam). Enter the 6-digit code here."}
          </Text>

          {!verifying ? (
            <OtpCodeInput
              ref={otpRef}
              value={otp}
              onChangeText={setOtp}
              length={OTP_LEN}
              editable={otpSent && !verifying}
            />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Verify and continue"
            disabled={verifying || otp.length !== OTP_LEN || !otpSent}
            onPress={() => void verify()}
            style={({ pressed }) => [
              styles.primary,
              (verifying || otp.length !== OTP_LEN || !otpSent) &&
                styles.primaryDisabled,
              pressed &&
                !(verifying || otp.length !== OTP_LEN || !otpSent) &&
                styles.primaryPressed,
            ]}
          >
            {verifying ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.primaryLabel}>Verify & continue</Text>
            )}
          </Pressable>
        </>
      )}

      {showSmsComingSoon ? (
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonBadge}>Coming soon</Text>
          <Text style={styles.comingSoonTitle}>Sign in with mobile OTP</Text>
          <Text style={styles.comingSoonBody}>
            SMS one-time codes will return once our India SMS provider is live.
            Until then, use email OTP.
          </Text>
          <Button
            variant="secondary"
            size="sm"
            disabled
            accessibilityLabel="Mobile OTP coming soon"
          >
            Mobile OTP
          </Button>
        </View>
      ) : null}

      <Text style={styles.hint}>
        Signed-in sessions persist across app restarts on this device.
      </Text>
    </KeyboardFormScreen>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  brandHeader: {
    alignSelf: "center",
    marginBottom: spacing.xs,
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
  otpHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  otpHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sendCodeBtn: {
    flexShrink: 0,
    minWidth: 120,
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
  comingSoon: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.xs,
  },
  comingSoonBadge: {
    alignSelf: "flex-start",
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  comingSoonTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  comingSoonBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
