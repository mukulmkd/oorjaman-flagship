import { registeredAddressFields } from "../lib/vendor-approval-utils";

export function RegisteredAddressFields({ value }: { value: unknown }) {
  const fields = registeredAddressFields(value);
  if (fields.length === 0) {
    return (
      <dl className="dash-dl">
        <dd>-</dd>
      </dl>
    );
  }
  return (
    <dl className="dash-dl">
      {fields.map((field, index) => (
        <div key={field.label}>
          <dt style={index > 0 ? { marginTop: "0.75rem" } : undefined}>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
