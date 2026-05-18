import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  authApi,
  buildLoginE164,
  getDummyAuthUiHint,
  LOGIN_PHONE_COUNTRIES,
  DEFAULT_LOGIN_COUNTRY_DIAL,
  userApi,
  validateEmailFormat,
  validateLoginNationalPhone,
} from "@oorjaman/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button, Card, Input, PhoneCountryLogin } from "@oorjaman/web-ui";
import { useSupabase } from "../lib/supabase-context";
import "./admin-login.css";

const OTP_LEN = 6;

type SignInMethod = "phone" | "email";

/** Partner portal origin (`VITE_VENDOR_PORTAL_URL`, default local dev port 5174). */
function vendorPortalOrigin(): string {
  const raw = import.meta.env.VITE_VENDOR_PORTAL_URL as string | undefined;
  return typeof raw === "string" && raw.trim() ? raw.replace(/\/$/, "") : "http://localhost:5174";
}

/**
 * After successful OTP: staff only — vendors are sent to the partner portal app.
 */
async function routeAfterAdminLogin(
  supabase: SupabaseClient,
  navigate: ReturnType<typeof useNavigate>,
  onError: (message: string) => void,
): Promise<void> {
  const row = await userApi.getMyUserRecord(supabase);
  if (!row) {
    await authApi.signOut(supabase);
    onError("We could not load your profile. Try again or contact support.");
    return;
  }
  if (row.role === "admin") {
    navigate("/dashboard/analytics", { replace: true });
    return;
  }
  await authApi.signOut(supabase);
  if (row.role === "vendor") {
    window.location.replace(`${vendorPortalOrigin()}/login`);
    return;
  }
  onError(
    "This portal is for OorjaMan operations staff. Vendor partners use the partner portal; customers and technicians use the mobile apps.",
  );
}

export default function AdminLoginPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const phoneOtpRef = useRef<HTMLInputElement>(null);
  const emailOtpRef = useRef<HTMLInputElement>(null);
  const autoPhoneOtp = useRef<string | null>(null);
  const autoEmailOtp = useRef<string | null>(null);

  const [method, setMethod] = useState<SignInMethod>("phone");
  const [countryDial, setCountryDial] = useState(DEFAULT_LOGIN_COUNTRY_DIAL);
  const [nationalPhone, setNationalPhone] = useState("");
  const [e164, setE164] = useState<string | null>(null);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);

  const [email, setEmail] = useState("");
  const [emailForVerify, setEmailForVerify] = useState<string | null>(null);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const dummyHint = useMemo(() => getDummyAuthUiHint(import.meta.env), []);
  const viteEnv = import.meta.env;

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const row = await userApi.getMyUserRecord(supabase);
      if (row?.role === "admin") {
        navigate("/dashboard/analytics", { replace: true });
        return;
      }
      if (row?.role === "vendor") {
        window.location.replace(`${vendorPortalOrigin()}/`);
        return;
      }
      await authApi.signOut(supabase);
    })();
  }, [supabase, navigate]);

  useEffect(() => {
    setPhoneOtpSent(false);
    setPhoneOtp("");
    setE164(null);
    autoPhoneOtp.current = null;
    setError(null);
  }, [nationalPhone, countryDial]);

  useEffect(() => {
    setEmailOtpSent(false);
    setEmailOtp("");
    setEmailForVerify(null);
    autoEmailOtp.current = null;
    setError(null);
  }, [email]);

  useEffect(() => {
    if (phoneOtp.length < OTP_LEN) autoPhoneOtp.current = null;
  }, [phoneOtp]);

  useEffect(() => {
    if (emailOtp.length < OTP_LEN) autoEmailOtp.current = null;
  }, [emailOtp]);

  const sendPhoneOtp = useCallback(async () => {
    setError(null);
    if (!supabase) {
      setError("Supabase client not configured.");
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
      await authApi.requestPhoneOtp(supabase, normalized, { frameworkEnv: viteEnv });
      setE164(normalized);
      setPhoneOtpSent(true);
      phoneOtpRef.current?.focus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send code.");
    } finally {
      setSending(false);
    }
  }, [nationalPhone, countryDial, supabase, viteEnv]);

  const sendEmailOtp = useCallback(async () => {
    setError(null);
    if (!supabase) {
      setError("Supabase client not configured.");
      return;
    }
    const emailErr = validateEmailFormat(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    const trimmed = email.trim().toLowerCase();
    setSending(true);
    try {
      await authApi.requestEmailOtp(supabase, trimmed);
      setEmailForVerify(trimmed);
      setEmailOtpSent(true);
      emailOtpRef.current?.focus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send email code.");
    } finally {
      setSending(false);
    }
  }, [email, supabase]);

  const verifyPhone = useCallback(async () => {
    setError(null);
    if (!supabase || !e164) {
      setError("Send the verification code first.");
      return;
    }
    if (phoneOtp.length !== OTP_LEN) {
      setError(`Enter the ${OTP_LEN}-digit code.`);
      return;
    }
    setVerifying(true);
    try {
      await authApi.verifyPhoneOtp(supabase, e164, phoneOtp, { frameworkEnv: viteEnv });
      await routeAfterAdminLogin(supabase, navigate, setError);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally {
      setVerifying(false);
    }
  }, [e164, navigate, phoneOtp, supabase, viteEnv]);

  const verifyEmail = useCallback(async () => {
    setError(null);
    if (!supabase || !emailForVerify) {
      setError("Send the email code first.");
      return;
    }
    if (emailOtp.length !== OTP_LEN) {
      setError(`Enter the ${OTP_LEN}-digit code from your email.`);
      return;
    }
    setVerifying(true);
    try {
      await authApi.verifyEmailOtp(supabase, emailForVerify, emailOtp);
      await routeAfterAdminLogin(supabase, navigate, setError);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally {
      setVerifying(false);
    }
  }, [emailForVerify, emailOtp, navigate, supabase]);

  useEffect(() => {
    if (!phoneOtpSent || phoneOtp.length !== OTP_LEN || verifying || sending || !e164 || !supabase) return;
    if (method !== "phone") return;
    if (autoPhoneOtp.current === phoneOtp) return;
    autoPhoneOtp.current = phoneOtp;
    const id = setTimeout(() => void verifyPhone(), 400);
    return () => clearTimeout(id);
  }, [phoneOtp, phoneOtpSent, verifying, sending, e164, supabase, verifyPhone, method]);

  useEffect(() => {
    if (!emailOtpSent || emailOtp.length !== OTP_LEN || verifying || sending || !emailForVerify || !supabase) return;
    if (method !== "email") return;
    if (autoEmailOtp.current === emailOtp) return;
    autoEmailOtp.current = emailOtp;
    const id = setTimeout(() => void verifyEmail(), 400);
    return () => clearTimeout(id);
  }, [emailOtp, emailOtpSent, verifying, sending, emailForVerify, supabase, verifyEmail, method]);

  const canSubmitPhone = phoneOtpSent && phoneOtp.length === OTP_LEN && !verifying;
  const canSubmitEmail = emailOtpSent && emailOtp.length === OTP_LEN && !verifying;

  return (
    <div className="al-root">
      <Card padded className="al-card">
        <h1 className="al-title">OorjaMan operations</h1>
        <p className="al-lede">
          Staff sign-in with a one-time code on your mobile number or email. Vendor partners use the separate partner
          portal.
        </p>

        <div className="al-tabs" role="tablist" aria-label="Sign-in method">
          <button
            type="button"
            role="tab"
            className={`al-tab ${method === "phone" ? "al-tab--active" : ""}`}
            aria-selected={method === "phone"}
            disabled={verifying}
            onClick={() => {
              setMethod("phone");
              setError(null);
            }}
          >
            Mobile
          </button>
          <button
            type="button"
            role="tab"
            className={`al-tab ${method === "email" ? "al-tab--active" : ""}`}
            aria-selected={method === "email"}
            disabled={verifying}
            onClick={() => {
              setMethod("email");
              setError(null);
            }}
          >
            Email
          </button>
        </div>

        {dummyHint ? <div className="al-dummy">{dummyHint}</div> : null}
        {error ? <p className="al-error">{error}</p> : null}

        {method === "phone" ? (
          <div className="al-fields">
            <PhoneCountryLogin
              label="Mobile number"
              countries={LOGIN_PHONE_COUNTRIES}
              countryDialCode={countryDial}
              onCountryDialCodeChange={setCountryDial}
              nationalDigits={nationalPhone}
              onNationalDigitsChange={setNationalPhone}
              disabled={verifying}
            />
            <div className="al-row-actions" style={{ marginTop: "0.75rem" }}>
              <span className="web-field-label" style={{ margin: 0 }}>
                One-time code
              </span>
              <button
                type="button"
                className="al-resend"
                onClick={() => void sendPhoneOtp()}
                disabled={sending || verifying}
              >
                {sending ? "Sending…" : phoneOtpSent ? "Resend code" : "Send code"}
              </button>
            </div>
            <input
              ref={phoneOtpRef}
              className="al-otp"
              value={phoneOtp}
              onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LEN))}
              inputMode="numeric"
              maxLength={OTP_LEN}
              disabled={verifying}
              placeholder="000000"
              aria-label="One-time code"
            />
            <Button
              variant="primary"
              className="al-primary"
              disabled={!canSubmitPhone}
              loading={verifying}
              onClick={() => void verifyPhone()}
            >
              Sign in
            </Button>
            <p className="al-hint">SMS rates from your carrier may apply.</p>
          </div>
        ) : (
          <div className="al-fields">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={verifying}
              autoComplete="email"
            />
            <div className="al-row-actions" style={{ marginTop: "0.75rem" }}>
              <span className="web-field-label" style={{ margin: 0 }}>
                One-time code
              </span>
              <button
                type="button"
                className="al-resend"
                onClick={() => void sendEmailOtp()}
                disabled={sending || verifying}
              >
                {sending ? "Sending…" : emailOtpSent ? "Resend code" : "Send code"}
              </button>
            </div>
            <input
              ref={emailOtpRef}
              className="al-otp"
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LEN))}
              inputMode="numeric"
              maxLength={OTP_LEN}
              disabled={verifying}
              placeholder="000000"
              aria-label="Email one-time code"
            />
            <Button
              variant="primary"
              className="al-primary"
              disabled={!canSubmitEmail}
              loading={verifying}
              onClick={() => void verifyEmail()}
            >
              Sign in
            </Button>
            <p className="al-hint">We email you a one-time code (configure the Email provider in Supabase Auth).</p>
          </div>
        )}

        <p className="al-footer">
          Vendor partner?{" "}
          <a href={`${vendorPortalOrigin()}/signup`}>Register on the partner portal</a>
          {" · "}
          <a href={`${vendorPortalOrigin()}/login`}>Partner sign in</a>
        </p>
      </Card>
    </div>
  );
}
