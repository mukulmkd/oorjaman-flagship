import Constants from "expo-constants";
import { Platform } from "react-native";

export type RazorpayCheckoutOptions = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency?: string;
  name?: string;
  description?: string;
  prefill?: { contact?: string; email?: string; name?: string };
};

export type RazorpayCheckoutSuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

/** Public test/live key id from env (never the secret). */
export function getRazorpayKeyIdFromEnv(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID?.trim();
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as { razorpayKeyId?: string } | undefined;
  const fromExtra = extra?.razorpayKeyId?.trim();
  return fromExtra || null;
}

export function isRazorpayCheckoutEnabled(): boolean {
  return Boolean(getRazorpayKeyIdFromEnv()) && Platform.OS !== "web";
}

/**
 * Opens Razorpay Standard Checkout (native). Requires a custom/dev client or UAT APK
 * with `react-native-razorpay` linked — not Expo Go.
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
): Promise<RazorpayCheckoutSuccess> {
  if (Platform.OS === "web") {
    throw new Error("Razorpay Checkout is available in the iOS/Android app builds.");
  }

  let RazorpayCheckout: { open: (opts: Record<string, unknown>) => Promise<RazorpayCheckoutSuccess> };
  try {
    // Native module — missing in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RazorpayCheckout = require("react-native-razorpay").default;
  } catch {
    throw new Error(
      "Razorpay native module is not available. Rebuild the customer app (dev client or UAT APK) after installing react-native-razorpay.",
    );
  }

  const key = options.keyId.trim() || getRazorpayKeyIdFromEnv();
  if (!key) throw new Error("Razorpay key is not configured.");

  try {
    const result = await RazorpayCheckout.open({
      key,
      amount: options.amountPaise,
      currency: options.currency ?? "INR",
      order_id: options.orderId,
      name: options.name ?? "OorjaMan",
      description: options.description ?? "Solar panel cleaning",
      theme: { color: "#1f8660" },
      prefill: options.prefill ?? {},
    });
    return result;
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code) : "";
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel|user.?closed|payment.?cancelled/i.test(msg) || code === "2" || code === "0") {
      throw new Error("Payment cancelled.");
    }
    throw new Error(msg || "Razorpay checkout failed.");
  }
}
