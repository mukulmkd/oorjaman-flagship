import type { ReactNode } from "react";
import { useBodyScrollLock } from "./use-body-scroll-lock";

export type ModalSize = "sm" | "md" | "lg";

export type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  onClose: () => void;
  /** sm ≈ 400px · md ≈ 560px (default) · lg ≈ 720px */
  size?: ModalSize;
};

export function Modal({ open, title, description, children, onClose, size = "md" }: ModalProps) {
  useBodyScrollLock(open);
  if (!open) return null;
  return (
    <div className="web-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`web-modal web-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="web-modal-header">
          <div className="web-modal-header-copy">
            <h3 id="web-modal-title">{title}</h3>
            {description ? <p className="web-modal-description">{description}</p> : null}
          </div>
          <button
            type="button"
            className="web-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>
        <div className="web-modal-body">{children}</div>
      </div>
    </div>
  );
}
