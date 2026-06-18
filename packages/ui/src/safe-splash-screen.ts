import * as SplashScreen from "expo-splash-screen";

/**
 * Keep the native splash visible until {@link hideNativeSplashScreenOnce}.
 * Call once at module scope in the root `_layout` (before the layout component).
 */
export function keepNativeSplashScreenVisible(): void {
  void SplashScreen.preventAutoHideAsync().catch(() => {
    // Web, fast refresh, or prevent already called.
  });
}

/**
 * Hide the native splash. Swallows iOS races where `hideAsync` runs on a
 * view controller that never registered a splash (stack modals, expo-router).
 */
export async function hideNativeSplashScreenOnce(): Promise<void> {
  try {
    await SplashScreen.hideAsync();
  } catch {
    // e.g. "No native splash screen registered for given view controller"
  }
}
