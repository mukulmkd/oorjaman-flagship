/**
 * Offline India geography via `country-state-city` (no API key, no rate limits).
 * @see https://www.npmjs.com/package/country-state-city
 */
import { City, Country, State, type ICity, type ICountry, type IState } from "country-state-city";

export const INDIA_COUNTRY_CODE = "IN";

export function listCountries(): ICountry[] {
  return Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name));
}

export function listStatesForCountry(countryCode: string): IState[] {
  return State.getStatesOfCountry(countryCode).sort((a, b) => a.name.localeCompare(b.name));
}

export function listCitiesForState(countryCode: string, stateCode: string): ICity[] {
  if (!countryCode.trim() || !stateCode.trim()) return [];
  return City.getCitiesOfState(countryCode, stateCode).sort((a, b) => a.name.localeCompare(b.name));
}

export function countryByCode(code: string): ICountry | undefined {
  return Country.getCountryByCode(code);
}

export function stateByCode(countryCode: string, stateCode: string): IState | undefined {
  return State.getStateByCodeAndCountry(stateCode, countryCode);
}

/** Match legacy saved state name to ISO code when code was missing. */
export function resolveStateCode(countryCode: string, stateName: string, stateCode?: string): string {
  if (stateCode?.trim()) return stateCode.trim();
  const normalized = stateName.trim().toLowerCase();
  if (!normalized) return "";
  const match = listStatesForCountry(countryCode).find(
    (s) => s.name.toLowerCase() === normalized || s.isoCode.toLowerCase() === normalized,
  );
  return match?.isoCode ?? "";
}
