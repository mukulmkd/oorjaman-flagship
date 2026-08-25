import { useState } from "react";
import { resolveDummyAuthSettings } from "@oorjaman/api";
import { LoginAuthMethodTabs, type LoginAuthMethod } from "@oorjaman/ui";
import { LoginEmailOtpScreen } from "../components/login-email-otp-screen";
import { LoginPhoneOtpScreen } from "../components/login-phone-otp-screen";

/**
 * Local/UAT (dummy auth on): Email OTP + Mobile OTP (dummy) tabs.
 * Production (dummy hard-disabled): Email OTP only; SMS OTP Coming soon.
 */
export default function LoginScreen() {
  const allowPhoneOtp = resolveDummyAuthSettings().enabled;
  const [method, setMethod] = useState<LoginAuthMethod>("email");

  if (!allowPhoneOtp) {
    return <LoginEmailOtpScreen showSmsComingSoon />;
  }

  const tabs = <LoginAuthMethodTabs method={method} onChange={setMethod} />;

  if (method === "phone") {
    return <LoginPhoneOtpScreen methodTabs={tabs} />;
  }
  return <LoginEmailOtpScreen methodTabs={tabs} showSmsComingSoon={false} />;
}
