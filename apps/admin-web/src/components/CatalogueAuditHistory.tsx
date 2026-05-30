import { useState } from "react";
import type { PricingCatalogAuditRow } from "@oorjaman/api";
import { Button, Modal } from "@oorjaman/web-ui";
import { formatCatalogAuditDetail, formatCatalogAuditWhen } from "../lib/pricing-catalog-audit";
import { formatSqlOperationLabel } from "../lib/notification-labels";

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 8v4l3 2M21 12a9 9 0 1 1-2.64-6.36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type CatalogueAuditHistoryButtonProps = {
  rows: PricingCatalogAuditRow[];
  title?: string;
  description?: string;
};

export function CatalogueAuditHistoryButton({
  rows,
  title = "Change History",
  description,
}: CatalogueAuditHistoryButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`scp-audit-trigger${open ? " scp-audit-trigger--open" : ""}`}
        aria-label="View change history"
        title="View change history"
        onClick={() => setOpen(true)}
      >
        <HistoryIcon />
      </button>
      <Modal open={open} title={title} description={description} onClose={() => setOpen(false)}>
        {rows.length === 0 ? (
          <p className="scp-audit-modal-empty">No changes recorded yet. Save to create the first entry.</p>
        ) : (
          <ul className="scp-audit-modal-list">
            {rows.map((row) => (
              <li key={row.id}>
                <span className="scp-audit-mini-when">{formatCatalogAuditWhen(row.changed_at)}</span>
                <span
                  className={`scp-audit-mini-op scp-audit-mini-op--${row.operation}`}
                  title={formatSqlOperationLabel(row.operation)}
                >
                  {row.operation === "insert" ? "+" : row.operation === "delete" ? "−" : "↺"}
                </span>
                <span className="scp-audit-mini-detail">{formatCatalogAuditDetail(row)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="web-modal-actions">
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}
