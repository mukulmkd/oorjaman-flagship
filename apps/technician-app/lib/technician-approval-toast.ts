import { router } from "expo-router";
import type { TechnicianAppPostAuthPath } from "@oorjaman/api";

let pendingApprovalToast = false;

function markTechnicianApprovalToastPending(): void {
  pendingApprovalToast = true;
}

export function consumeTechnicianApprovalToastPending(): boolean {
  if (!pendingApprovalToast) return false;
  pendingApprovalToast = false;
  return true;
}

export function navigateToTechnicianMainAfterApproval(): void {
  markTechnicianApprovalToastPending();
  router.replace("/(main)");
}

/** Post-gate navigation: toast only when entering main after approval, not other routes. */
export function navigateFromTechnicianPostAuthPath(path: TechnicianAppPostAuthPath): void {
  if (path === "/(main)") {
    navigateToTechnicianMainAfterApproval();
    return;
  }
  router.replace(path);
}
