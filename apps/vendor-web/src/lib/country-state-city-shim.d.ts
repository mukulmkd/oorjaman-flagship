/** Fallback types when the package is not installed locally (Vercel partial installs). */
declare module "country-state-city" {
  export interface ICountry {
    name: string;
    phonecode: string;
    isoCode: string;
    flag: string;
    currency: string;
    latitude: string;
    longitude: string;
  }

  export interface IState {
    name: string;
    isoCode: string;
    countryCode: string;
    latitude?: string | null;
    longitude?: string | null;
  }

  export interface ICity {
    name: string;
    countryCode: string;
    stateCode: string;
    latitude?: string | null;
    longitude?: string | null;
  }

  export const Country: {
    getAllCountries(): ICountry[];
    getCountryByCode(code: string): ICountry | undefined;
  };

  export const State: {
    getStatesOfCountry(countryCode: string): IState[];
  };

  export const City: {
    getCitiesOfState(countryCode: string, stateCode: string): ICity[];
  };
}
