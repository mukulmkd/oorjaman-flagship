import { useState } from "react";
import { resolveDummyAuthSettings } from "@oorjaman/api";
import { LoginAuthMethodTabs, type LoginAuthMethod } from "@oorjaman/ui";
import { LoginEmailOtpScreen } from "../components/login-email-otp-screen";
import { LoginPhoneOtpScreen } from "../components/login-phone-otp-screen";

/** Email and mobile sign-in tabs; production mobile OTP remains visibly unavailable. */
export default function LoginScreen() {
  const allowPhoneOtp = resolveDummyAuthSettings().enabled;
  const [method, setMethod] = useState<LoginAuthMethod>("email");

  const tabs = <LoginAuthMethodTabs method={method} onChange={setMethod} />;

  if (method === "phone") {
    return (
      <LoginPhoneOtpScreen methodTabs={tabs} comingSoon={!allowPhoneOtp} />
    );
  }
  return (
    <LoginEmailOtpScreen
      methodTabs={tabs}
      showSmsComingSoon={false}
      useTestAccountCopy={allowPhoneOtp}
    />
  );
}
