import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AppState,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import { colors, fontFamily, fontSize, lineHeight, spacing } from "@oorjaman/config";
import {
  APP_UPDATE_POLICY,
  isStoreVersionBelowMinimum,
  type AppUpdateAudience,
} from "./app-update-policy";
import { BrandLockup } from "./brand";
import { Button } from "./Button";

type Prompt = "store" | "refresh";

type AppUpdateGateProps = {
  audience: AppUpdateAudience;
  children: ReactNode;
};

/** Avoid hammering the update server on rapid background ↔ foreground flips. */
const FOREGROUND_CHECK_COOLDOWN_MS = 60_000;

function isUatBuild(): boolean {
  return Updates.channel === "uat";
}

function storeUrl(audience: AppUpdateAudience): string {
  const policy = APP_UPDATE_POLICY[audience];
  if (Platform.OS === "ios") {
    return (
      policy.iosAppStoreUrl ??
      `https://apps.apple.com/search?term=${encodeURIComponent(policy.storeSearch)}`
    );
  }
  return `https://play.google.com/store/apps/details?id=${policy.androidPackage}`;
}

/**
 * Blocks the app only when a newer store version is required, or when a
 * downloaded refresh is ready. Checks again whenever the app returns to the
 * foreground so OTA updates apply without force-closing. Web, local
 * development, and UAT builds pass through.
 */
export function AppUpdateGate({ audience, children }: AppUpdateGateProps) {
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [busy, setBusy] = useState(false);
  const policy = APP_UPDATE_POLICY[audience];
  const { isStartupProcedureRunning, isUpdatePending } = Updates.useUpdates();

  const promptRef = useRef<Prompt | null>(null);
  const startupRef = useRef(isStartupProcedureRunning);
  const pendingRef = useRef(isUpdatePending);
  const checkingRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  promptRef.current = prompt;
  startupRef.current = isStartupProcedureRunning;
  pendingRef.current = isUpdatePending;

  useEffect(() => {
    if (Platform.OS === "web" || __DEV__ || isUatBuild()) return;

    let cancelled = false;

    async function lookForUpdate(options?: { ignoreCooldown?: boolean }) {
      if (cancelled) return;

      if (isStoreVersionBelowMinimum(Updates.runtimeVersion, policy.minimumStoreVersion)) {
        setPrompt("store");
        return;
      }

      // Store gate already showing — do not downgrade to an OTA refresh prompt.
      if (promptRef.current === "store") return;

      if (!Updates.isEnabled || startupRef.current) return;

      // iOS may finish downloading while we were backgrounded.
      if (pendingRef.current || promptRef.current === "refresh") {
        setPrompt("refresh");
        return;
      }

      const now = Date.now();
      if (
        !options?.ignoreCooldown &&
        lastCheckAtRef.current > 0 &&
        now - lastCheckAtRef.current < FOREGROUND_CHECK_COOLDOWN_MS
      ) {
        return;
      }
      if (checkingRef.current) return;
      checkingRef.current = true;
      lastCheckAtRef.current = now;

      try {
        const available = await Updates.checkForUpdateAsync();
        if (cancelled || !available.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (!cancelled && fetched.isNew) setPrompt("refresh");
      } catch {
        // A failed check must not block bookings or jobs.
      } finally {
        checkingRef.current = false;
      }
    }

    void lookForUpdate({ ignoreCooldown: true });

    const onAppState = (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next !== "active" || prev === "active") return;
      void lookForUpdate();
    };

    const sub = AppState.addEventListener("change", onAppState);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [isStartupProcedureRunning, isUpdatePending, policy.minimumStoreVersion]);

  async function onPress() {
    if (busy) return;
    setBusy(true);
    try {
      if (prompt === "store") {
        await Linking.openURL(storeUrl(audience));
        setBusy(false);
        return;
      }
      await Updates.reloadAsync();
    } catch {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      {children}
      {prompt ? (
        <View
          style={[
            styles.overlay,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.panel}>
            <BrandLockup variant={audience === "partner" ? "partner" : "customer"} />
            <Text style={styles.message}>
              {prompt === "store" ? policy.storeMessage : policy.refreshMessage}
            </Text>
            <Button size="lg" style={styles.button} onPress={() => void onPress()} loading={busy}>
              {prompt === "store" ? policy.storeButton : policy.refreshButton}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1100,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  panel: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    gap: spacing.xl,
  },
  message: {
    alignSelf: "stretch",
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    color: colors.foreground,
    textAlign: "center",
  },
  button: {
    alignSelf: "stretch",
  },
});
