import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function TextArea({ label, id, className, ...rest }: TextAreaProps) {
  const fid = id ?? label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className={className}>
      <label className="web-field-label" htmlFor={fid}>
        {label}
      </label>
      <textarea id={fid} className="web-textarea" {...rest} />
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, id, className, ...rest }: InputProps) {
  const fid = id ?? label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className={className}>
      <label className="web-field-label" htmlFor={fid}>
        {label}
      </label>
      <input id={fid} className="web-input" {...rest} />
    </div>
  );
}
