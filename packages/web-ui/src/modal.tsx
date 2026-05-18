import type { ReactNode } from "react";

export type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  onClose: () => void;
};

export function Modal({ open, title, description, children, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <div className="web-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="web-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="web-modal-title">{title}</h3>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
    </div>
  );
}
