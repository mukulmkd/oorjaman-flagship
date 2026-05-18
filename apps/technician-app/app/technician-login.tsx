import { Redirect } from "expo-router";

/** Legacy route — use `/login` for technician OTP sign-in. */
export default function TechnicianLoginRedirect() {
  return <Redirect href="/login" />;
}
