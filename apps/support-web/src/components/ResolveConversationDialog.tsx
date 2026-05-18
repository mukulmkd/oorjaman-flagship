import { useState } from "react";
import type { SupportResolutionTag } from "@oorjaman/api";

const TAGS: { id: SupportResolutionTag; label: string }[] = [
  { id: "resolved", label: "Resolved" },
  { id: "duplicate", label: "Duplicate" },
  { id: "policy_limitation", label: "Policy limitation" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (tag: SupportResolutionTag) => void;
  loading?: boolean;
};

export function ResolveConversationDialog({ open, onClose, onConfirm, loading }: Props) {
  const [tag, setTag] = useState<SupportResolutionTag>("resolved");

  if (!open) return null;

  return (
    <div className="support-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="support-modal"
        role="dialog"
        aria-labelledby="resolve-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="resolve-title">Mark resolved</h2>
        <p className="support-inbox-muted">Choose how this conversation was closed.</p>
        <div className="support-resolve-tags">
          {TAGS.map((t) => (
            <label key={t.id} className="support-resolve-tag">
              <input
                type="radio"
                name="resolution"
                checked={tag === t.id}
                onChange={() => setTag(t.id)}
              />
              {t.label}
            </label>
          ))}
        </div>
        <div className="support-modal-actions">
          <button type="button" className="support-inbox-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="support-inbox-btn-primary"
            disabled={loading}
            onClick={() => onConfirm(tag)}
          >
            {loading ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
