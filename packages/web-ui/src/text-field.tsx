import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function TextArea({ label, id, className, ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id?.trim() ? id : autoId;
  const labelText = label.trim();

  return (
    <div className={className}>
      {labelText ? (
        <label className="web-field-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <textarea id={fieldId} className="web-textarea" {...rest} />
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const fieldId = id?.trim() ? id : autoId;
  const labelText = label.trim();

  return (
    <div className={className}>
      {labelText ? (
        <label className="web-field-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <input id={fieldId} className="web-input" {...rest} />
    </div>
  );
}
