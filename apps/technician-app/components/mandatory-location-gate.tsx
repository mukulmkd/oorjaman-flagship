/**
 * @deprecated App-wide location hard-gate removed for App Store Guideline 5.1.1(iv).
 * Location is requested only when marking en route (see ensureEnRouteLocationFix).
 * Kept as a no-op pass-through so any stale imports keep compiling.
 */
type Props = {
  children: React.ReactNode;
};

export function MandatoryLocationGate({ children }: Props) {
  return <>{children}</>;
}
