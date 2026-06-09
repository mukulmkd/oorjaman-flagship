/**
 * AMC contract ledger (customer-facing: AMC plan payment held by OorjaMan).
 * Backed by internal `amc_wallets` / `amc_wallet_entries` tables.
 */
export {
  computeAmcPerVisitAllocPaise,
  ensureAmcWalletForSubscription as ensureAmcContractForSubscription,
  getAmcWalletBySubscriptionId as getAmcContractBySubscriptionId,
  listAmcWalletEntries as listAmcContractEntries,
  adminListAmcWallets as adminListAmcContracts,
  adminAssignAmcSubscriptionVendor,
  fundAmcWalletFromPayment as fundAmcContractFromPayment,
  releaseAmcWalletVisitPayout as releaseAmcContractVisitPayout,
  type AmcWalletAdminRow as AmcContractAdminRow,
  type AmcWalletAdminRow,
} from "./amc-wallet-api";

import type { AmcWalletRow, AmcWalletStatus } from "../database.types";

export type AmcContractRow = AmcWalletRow;
export type AmcContractStatus = AmcWalletStatus;

export function amcContractStatusLabel(status: AmcContractStatus): string {
  switch (status) {
    case "pending_funding":
      return "Awaiting payment";
    case "funded":
      return "Active";
    case "depleted":
      return "Fully allocated";
    case "cancelled":
      return "Cancelled";
    default:
      return String(status).replace(/_/g, " ");
  }
}

export function amcContractIsReadyForVisits(
  contract: Pick<AmcContractRow, "status"> | null | undefined,
): boolean {
  return contract?.status === "funded";
}
