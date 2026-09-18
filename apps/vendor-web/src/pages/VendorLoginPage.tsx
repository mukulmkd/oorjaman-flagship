import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  authApi,
  buildLoginE164,
  LOGIN_PHONE_COUNTRIES,
  DEFAULT_LOGIN_COUNTRY_DIAL,
  resolveDummyAuthSettings,
  userApi,
  validateEmailFormat,
  validateLoginNationalPhone,
  vendorApi,
  vendorProfileIsComplete,
} from "@oorjaman/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button, Card, Input, PhoneCountryLogin, PortalLoginBrand } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";
import { adminPortalUrl } from "@oorjaman/web-ui";
const OTP_LEN = 6;

type SignInMethod = "phone" | "email";

async function routeAfterVendorLogin(
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
  if (row.role === "vendor") {
    try {
      const vendor = await vendorApi.getMyVendor(supabase);
      if (vendor && !vendorProfileIsComplete(vendor)) {
        navigate("/complete-profile", { replace: true });
        return;
      }
      if (!vendor) {
        navigate("/signup", { replace: true });
        return;
      }
    } catch {
      // Fall through to portal; gate will re-check.
    }
    navigate("/", { replace: true });
    return;
  }
  await authApi.signOut(supabase);
  if (row.role === "admin") {
    window.location.replace(adminPortalUrl("/login"));
    return;
  }
  onError(
    "This portal is for registered vendor partners. Customers and technicians should use the mobile apps.",
  );
}

export default function VendorLoginPage() {
  const supabase = useSupabase();
  const navigate = useNavigate();
  const phoneOtpRef = useRef<HTMLInputElement>(null);
  const emailOtpRef = useRef<HTMLInputElement>(null);
  const autoPhoneOtp = useRef<string | null>(null);
  const autoEmailOtp = useRef<string | null>(null);

  const viteEnv = import.meta.env;
  /** Local/UAT: Email + Mobile dummy OTP. Prod: Email OTP only (SMS Coming soon). */
  const allowPhoneOtp = resolveDummyAuthSettings(viteEnv).enabled;

  const [method, setMethod] = useState<SignInMethod>("email");
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

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const row = await userApi.getMyUserRecord(supabase);
      if (row?.role === "vendor") {
        try {
          const vendor = await vendorApi.getMyVendor(supabase);
          if (vendor && !vendorProfileIsComplete(vendor)) {
            navigate("/complete-profile", { replace: true });
            return;
          }
          if (!vendor) {
            navigate("/signup", { replace: true });
            return;
          }
        } catch {
          // ignore
        }
        navigate("/", { replace: true });
        return;
      }
      if (row?.role === "admin") {
        window.location.replace(adminPortalUrl("/dashboard/analytics"));
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

  useEffect(() => {
    if (!allowPhoneOtp && method === "phone") setMethod("email");
  }, [allowPhoneOtp, method]);

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
      await authApi.requestPhoneOtp(supabase, normalized, {
        data: { role: "vendor", phone: normalized },
        frameworkEnv: viteEnv,
      });
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
      await authApi.requestEmailOtp(supabase, trimmed, {
        data: { role: "vendor" },
        frameworkEnv: viteEnv,
      });
      setEmailForVerify(trimmed);
      setEmailOtpSent(true);
      emailOtpRef.current?.focus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send email code.");
    } finally {
      setSending(false);
    }
  }, [email, supabase, viteEnv]);

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
      await routeAfterVendorLogin(supabase, navigate, setError);
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
      await authApi.verifyEmailOtp(supabase, emailForVerify, emailOtp, { frameworkEnv: viteEnv });
      await routeAfterVendorLogin(supabase, navigate, setError);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally {
      setVerifying(false);
    }
  }, [emailForVerify, emailOtp, navigate, supabase, viteEnv]);

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
  const showPhoneForm = allowPhoneOtp && method === "phone";

  return (
    <div className="al-root">
      <PortalLoginBrand persona="partner" />
      <Card padded className="al-card">
        <p className="al-lede">
          {allowPhoneOtp
            ? "Sign in with your email or mobile number for a one-time code. OorjaMan operations staff should use the admin console instead."
            : "Sign in with a one-time code emailed to you. OorjaMan operations staff should use the admin console instead."}
        </p>

        {allowPhoneOtp ? (
          <div className="al-tabs" role="tablist" aria-label="Sign-in method">
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
              Mobile OTP
            </button>
          </div>
        ) : null}

        {error ? <p className="al-error">{error}</p> : null}

        {showPhoneForm ? (
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
            <p className="al-hint">
              {allowPhoneOtp
                ? "We email a one-time code (or use the local/UAT test code when dummy auth is on)."
                : "We email you a one-time code. Check spam if it does not arrive within a minute."}
            </p>

            {!allowPhoneOtp ? (
              <div className="al-coming-soon">
                <span className="al-coming-soon-badge">Coming soon</span>
                <p className="al-coming-soon-title">Sign in with mobile OTP</p>
                <p className="al-coming-soon-body">
                  SMS one-time codes will return once our India SMS provider is live. Until then, use
                  email OTP.
                </p>
                <Button variant="outline" className="al-coming-soon-btn" disabled>
                  Mobile OTP
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <p className="al-footer">
          <Link to="/signup">Register as a vendor partner</Link>
        </p>
      </Card>
    </div>
  );
}
