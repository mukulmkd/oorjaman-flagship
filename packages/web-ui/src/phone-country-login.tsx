import "./phone-country-login.css";

export type PhoneCountryOption = { dialCode: string; label: string };

export type PhoneCountryLoginProps = {
  countries: readonly PhoneCountryOption[];
  countryDialCode: string;
  onCountryDialCodeChange: (dial: string) => void;
  nationalDigits: string;
  onNationalDigitsChange: (digits: string) => void;
  disabled?: boolean;
  label: string;
  nationalInputId?: string;
};

export function PhoneCountryLogin({
  countries,
  countryDialCode,
  onCountryDialCodeChange,
  nationalDigits,
  onNationalDigitsChange,
  disabled,
  label,
  nationalInputId = "login-phone-national",
}: PhoneCountryLoginProps) {
  return (
    <div className="web-phone-country">
      <label className="web-field-label" htmlFor={nationalInputId}>
        {label}
      </label>
      <div className="web-phone-country__row">
        <select
          className="web-input web-phone-country__select"
          value={countryDialCode}
          onChange={(e) => onCountryDialCodeChange(e.target.value)}
          disabled={disabled}
          aria-label="Country calling code"
        >
          {countries.map((c) => (
            <option key={c.dialCode} value={c.dialCode}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          id={nationalInputId}
          className="web-input web-phone-country__national"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          placeholder="9876543210"
          value={nationalDigits}
          onChange={(e) => onNationalDigitsChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
