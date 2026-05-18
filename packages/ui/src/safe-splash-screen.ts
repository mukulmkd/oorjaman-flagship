import * as SplashScreen from "expo-splash-screen";

let keepVisibleRequested = false;
let hideAttempted = false;

/**
 * Keep the native splash visible until {@link hideNativeSplashScreenOnce}.
 * Call once at module scope in the root `_layout` (before the layout component).
 */
export function keepNativeSplashScreenVisible(): void {
  if (keepVisibleRequested) return;
  keepVisibleRequested = true;
  void SplashScreen.preventAutoHideAsync().catch(() => {
    // Web, fast refresh, or prevent already called.
  });
}

/**
 * Hide the native splash a single time. Swallows iOS races where `hideAsync` runs on a
 * view controller that never registered a splash (stack modals, expo-router double-hide).
 */
export async function hideNativeSplashScreenOnce(): Promise<void> {
  if (hideAttempted) return;
  hideAttempted = true;
  try {
    await SplashScreen.hideAsync();
  } catch {
    // e.g. "No native splash screen registered for given view controller"
  }
}
