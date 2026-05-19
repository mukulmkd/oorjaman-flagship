import { useId, useRef } from "react";
import { SupportMacrosPicker } from "./SupportMacrosPicker";

type Props = {
  composer: string;
  onComposerChange: (value: string) => void;
  onSend: () => void;
  sendPending: boolean;
  readOnly: boolean;
  internalNote: boolean;
  onInternalNoteChange: (checked: boolean) => void;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  categorySlug?: string;
  compact?: boolean;
};

export function SupportComposer({
  composer,
  onComposerChange,
  onSend,
  sendPending,
  readOnly,
  internalNote,
  onInternalNoteChange,
  pendingFile,
  onPendingFileChange,
  categorySlug,
  compact = false,
}: Props) {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = (!readOnly && composer.trim().length > 0) || (!readOnly && pendingFile != null);

  return (
    <footer className={`support-composer${compact ? " support-composer-compact" : ""}`}>
      <div className="support-composer-main">
        <textarea
          className="support-composer-input"
          rows={compact ? 2 : 3}
          placeholder={
            readOnly
              ? "Reopen to reply…"
              : internalNote
                ? "Internal note…"
                : "Reply to customer…"
          }
          value={composer}
          disabled={readOnly}
          onChange={(e) => onComposerChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend && !sendPending) onSend();
            }
          }}
        />
        <button
          type="button"
          className="support-inbox-btn-primary support-composer-send"
          disabled={!canSend || sendPending || readOnly}
          onClick={onSend}
        >
          {internalNote ? "Note" : "Send"}
        </button>
      </div>

      {!readOnly ? (
        <div className="support-composer-tools">
          <details className="support-composer-details">
            <summary className="support-composer-details-summary">Macros</summary>
            <div className="support-composer-details-body">
              <SupportMacrosPicker
                categorySlug={categorySlug}
                onInsert={(body) => onComposerChange(composer ? `${composer}\n${body}` : body)}
              />
            </div>
          </details>

          <label className="support-composer-attach" htmlFor={fileInputId}>
            <span className="support-composer-attach-label">Attach</span>
            <input
              ref={fileRef}
              id={fileInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="support-composer-attach-input"
              onChange={(e) => onPendingFileChange(e.target.files?.[0] ?? null)}
            />
            {pendingFile ? (
              <span className="support-composer-attach-name" title={pendingFile.name}>
                {pendingFile.name}
              </span>
            ) : (
              <span className="support-inbox-muted">file</span>
            )}
          </label>

          {pendingFile ? (
            <button
              type="button"
              className="support-composer-clear-file"
              onClick={() => {
                onPendingFileChange(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Clear
            </button>
          ) : null}

          <label className="support-composer-internal">
            <input
              type="checkbox"
              checked={internalNote}
              onChange={(e) => onInternalNoteChange(e.target.checked)}
            />
            Internal
          </label>
        </div>
      ) : null}
    </footer>
  );
}
