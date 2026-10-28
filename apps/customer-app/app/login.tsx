import { useState } from "react";
import { resolveDummyAuthSettings } from "@oorjaman/api";
import { LoginAuthMethodTabs, type LoginAuthMethod } from "@oorjaman/ui";
import { LoginEmailOtpScreen } from "../components/login-email-otp-screen";
import { LoginPhoneOtpScreen } from "../components/login-phone-otp-screen";

/** Email and mobile sign-in tabs. Mobile OTP uses Supabase Auth + MSG91 on production. */
export default function LoginScreen() {
  const dummyAuth = resolveDummyAuthSettings().enabled;
  const [method, setMethod] = useState<LoginAuthMethod>("phone");

  const tabs = <LoginAuthMethodTabs method={method} onChange={setMethod} />;

  if (method === "phone") {
    return (
      <LoginPhoneOtpScreen methodTabs={tabs} useTestAccountCopy={dummyAuth} />
    );
  }
  return (
    <LoginEmailOtpScreen
      methodTabs={tabs}
      showSmsComingSoon={false}
      useTestAccountCopy={dummyAuth}
    />
  );
}
