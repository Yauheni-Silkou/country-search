function normalizeName(rawName) {
    if (typeof rawName === 'string') {
        return rawName;
    }
    return rawName?.common ?? rawName?.official ?? 'Unknown';
}
function normalizeLanguages(rawLanguages) {
    if (!rawLanguages) {
        return [];
    }
    return rawLanguages
        .map((item) => (typeof item === 'string' ? item : (item.name ?? item.code ?? '')))
        .filter((label) => label.length > 0);
}
function normalizeCurrencies(rawCurrencies) {
    if (!rawCurrencies) {
        return [];
    }
    return rawCurrencies
        .map((item) => {
        if (typeof item === 'string') {
            return item;
        }
        const name = item.name ?? item.code ?? '';
        if (!name) {
            return '';
        }
        const meta = [item.code, item.symbol].filter((part) => Boolean(part && part.length > 0));
        return meta.length > 0 ? `${name} (${meta.join(', ')})` : name;
    })
        .filter((label) => label.length > 0);
}
export function mapCountryResponse(raw) {
    const name = normalizeName(raw.name);
    return {
        name,
        flagUrl: raw.flags?.svg ?? raw.flags?.png ?? '',
        flagAlt: raw.flags?.alt ?? `Flag of ${name}`,
        capital: raw.capital ?? 'N/A',
        region: raw.region ?? 'N/A',
        population: raw.population ?? 0,
        languages: normalizeLanguages(raw.languages),
        currencies: normalizeCurrencies(raw.currencies),
        area: raw.area ?? 0,
        borders: raw.borders ? [...raw.borders] : [],
        description: raw.description ?? '',
    };
}
