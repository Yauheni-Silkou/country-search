export interface RawCountryFlags {
  svg?: string;
  png?: string;
  alt?: string;
}

export interface RawCountryLanguage {
  name?: string;
  code?: string;
}

export interface RawCountryCurrency {
  name?: string;
  code?: string;
  symbol?: string;
}

export interface RawCountryResponse {
  name?: string | { common?: string; official?: string };
  capital?: string;
  region?: string;
  population?: number;
  flags?: RawCountryFlags;
  languages?: Array<RawCountryLanguage | string>;
  currencies?: Array<RawCountryCurrency | string>;
  area?: number;
  borders?: string[];
  description?: string;
}

export interface Country {
  name: string;
  flagUrl: string;
  flagAlt: string;
  capital: string;
  region: string;
  population: number;
  languages: string[];
  currencies: string[];
  area: number;
  borders: string[];
  description: string;
}

export function mapCountryResponse(raw: RawCountryResponse): Country {
  void raw;
  throw new Error('Not implemented');
}
