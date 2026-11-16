import { describe, expect, it } from 'vitest';
import { mapCountryResponse, type RawCountryResponse } from '../../src/core/mapCountryResponse.js';

describe('mapCountryResponse', () => {
  it('maps a complete valid countries.dev API response into normalized Country model', () => {
    const raw: RawCountryResponse = {
      name: 'Spain',
      capital: 'Madrid',
      region: 'Europe',
      population: 47351567,
      flags: {
        svg: 'https://countries.dev',
        png: 'https://countries.dev',
        alt: 'The flag of Spain',
      },
      languages: [
        { name: 'Spanish', code: 'es' },
        { name: 'Catalan', code: 'ca' },
      ],
      currencies: [{ name: 'Euro', code: 'EUR', symbol: '€' }],
      area: 505992,
      borders: ['AND', 'FRA', 'GIB', 'PRT', 'MAR'],
      description: 'Kingdom of Spain in Southwestern Europe',
    };

    const result = mapCountryResponse(raw);

    expect(result).toEqual({
      name: 'Spain',
      flagUrl: 'https://countries.dev',
      flagAlt: 'The flag of Spain',
      capital: 'Madrid',
      region: 'Europe',
      population: 47351567,
      languages: ['Spanish', 'Catalan'],
      currencies: ['Euro (EUR, €)'],
      area: 505992,
      borders: ['AND', 'FRA', 'GIB', 'PRT', 'MAR'],
      description: 'Kingdom of Spain in Southwestern Europe',
    });
  });

  it('provides safe fallback values when optional fields are missing', () => {
    const incompleteRaw: RawCountryResponse = {
      name: 'Antarctica',
    };

    const result = mapCountryResponse(incompleteRaw);

    expect(result).toEqual({
      name: 'Antarctica',
      flagUrl: '',
      flagAlt: 'Flag of Antarctica',
      capital: 'N/A',
      region: 'N/A',
      population: 0,
      languages: [],
      currencies: [],
      area: 0,
      borders: [],
      description: '',
    });
  });

  it('does not mutate the input object or its nested arrays', () => {
    const raw: RawCountryResponse = {
      name: 'Japan',
      capital: 'Tokyo',
      region: 'Asia',
      population: 125836021,
      flags: {
        svg: 'https://countries.dev',
        alt: 'Flag of Japan',
      },
      languages: [{ name: 'Japanese', code: 'ja' }],
      currencies: [{ name: 'Japanese yen', code: 'JPY', symbol: '¥' }],
      area: 377930,
      borders: [],
      description: 'Island country in East Asia',
    };

    Object.freeze(raw);
    Object.freeze(raw.flags);
    Object.freeze(raw.languages);
    Object.freeze(raw.currencies);
    Object.freeze(raw.borders);

    const snapshot = structuredClone(raw);

    expect(() => mapCountryResponse(raw)).not.toThrow();
    const result = mapCountryResponse(raw);

    expect(raw).toEqual(snapshot);
    expect(result.borders).not.toBe(raw.borders);
  });
});
