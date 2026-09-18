import Constants from "expo-constants";

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

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutConstructor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutConstructor;
  }
}

/** Public test/live key id from env (never the secret). */
export function getRazorpayKeyIdFromEnv(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID?.trim();
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as { razorpayKeyId?: string } | undefined;
  const fromExtra = extra?.razorpayKeyId?.trim();
  return fromExtra || null;
}

function isWebPaymentsFlagOn(): boolean {
  const raw = process.env.EXPO_PUBLIC_WEB_PAYMENTS?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Web Checkout.js — gated by EXPO_PUBLIC_WEB_PAYMENTS until Edge verify is proven. */
export function isRazorpayCheckoutEnabled(): boolean {
  return isWebPaymentsFlagOn() && Boolean(getRazorpayKeyIdFromEnv());
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let checkoutScriptPromise: Promise<void> | null = null;

function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout requires a browser."));
  }
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScriptPromise) return checkoutScriptPromise;

  checkoutScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Razorpay Checkout.js")),
      );
      if (window.Razorpay) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      checkoutScriptPromise = null;
      reject(new Error("Failed to load Razorpay Checkout.js"));
    };
    document.body.appendChild(script);
  });

  return checkoutScriptPromise;
}

/**
 * Opens Razorpay Standard Checkout.js (web).
 * Call sites verify via `paymentApi.verifyRazorpayCheckoutCallback` (same as native).
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
): Promise<RazorpayCheckoutSuccess> {
  if (!isRazorpayCheckoutEnabled()) {
    throw new Error(
      "Razorpay Checkout on web is disabled. Set EXPO_PUBLIC_WEB_PAYMENTS=1 after Edge verify is proven.",
    );
  }

  await loadRazorpayCheckoutScript();
  const RazorpayCtor = window.Razorpay;
  if (!RazorpayCtor) {
    throw new Error("Razorpay Checkout.js did not initialize.");
  }

  const key = options.keyId.trim() || getRazorpayKeyIdFromEnv();
  if (!key) throw new Error("Razorpay key is not configured.");

  return new Promise<RazorpayCheckoutSuccess>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const rzp = new RazorpayCtor({
      key,
      amount: options.amountPaise,
      currency: options.currency ?? "INR",
      order_id: options.orderId,
      name: options.name ?? "OorjaMan",
      description: options.description ?? "Solar panel cleaning",
      theme: { color: "#1f8660" },
      prefill: options.prefill ?? {},
      handler: (response: RazorpayHandlerResponse) => {
        settle(() =>
          resolve({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          }),
        );
      },
      modal: {
        ondismiss: () => {
          settle(() => reject(new Error("Payment cancelled.")));
        },
      },
    });

    rzp.on("payment.failed", (response: unknown) => {
      const desc =
        response &&
        typeof response === "object" &&
        "error" in response &&
        response.error &&
        typeof response.error === "object" &&
        "description" in response.error
          ? String((response.error as { description?: unknown }).description)
          : "Razorpay checkout failed.";
      settle(() => reject(new Error(desc || "Razorpay checkout failed.")));
    });

    rzp.open();
  });
}
