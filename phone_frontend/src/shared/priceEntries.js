/**
 * Price entries — one shape for raw UnifiedCropPrice rows and monthly rollup
 * rows (UnifiedCropPriceMonthly), so the waterfall and the chart can average
 * either without caring where the numbers came from.
 *
 * Price basis (same rule as the rollup and the web chart):
 *   'lb'   price_per_lb is set   — the package has a known net weight
 *   'unit' else price_per_unit   — count packs, shown as $/each
 *   'pkg'  else price_avg        — price per package, no weight or count known
 *   'none' no price at all
 *
 * Units are never averaged together. $/lb prices are comparable across
 * package sizes, so they average together; $/each and $/package prices stay
 * separate per package (see groupPrices).
 */

import { toDateKey, addDaysToKey } from './dates';

export const PRICE_UNITS = [
    { key: 'lb', label: '$/lb', suffix: '/lb', title: 'Price / lb' },
    { key: 'unit', label: '$/each', suffix: '/each', title: 'Price / each' },
    { key: 'pkg', label: '$/package', suffix: '/pkg', title: 'Price / package' },
];

export const unitInfo = (basis) => PRICE_UNITS.find(u => u.key === basis) || PRICE_UNITS[2];

export function classifyMarketType(mt) {
    const s = String(mt || '').toLowerCase();
    if (s.includes('terminal')) return 'terminal';
    if (s.includes('shipping')) return 'shipping';
    if (s.includes('retail')) return 'retail';
    return null;
}

const isNum = (v) => v != null && v !== '' && !Number.isNaN(Number(v));

export function rowBasis(row) {
    if (isNum(row.price_per_lb)) return { basis: 'lb', price: Number(row.price_per_lb) };
    if (isNum(row.price_per_unit)) return { basis: 'unit', price: Number(row.price_per_unit) };
    if (isNum(row.price_avg)) return { basis: 'pkg', price: Number(row.price_avg) };
    return { basis: 'none', price: 0 };
}

/** One raw row as a single (priced or unpriced) observation on its day. */
export function entryFromRow(row) {
    const market = classifyMarketType(row.market_type);
    const date = toDateKey(row.report_date);
    if (!market || !date) return null;
    const { basis, price } = rowBasis(row);
    const priced = price > 0;
    const pkgPrice = isNum(row.price_avg) ? Number(row.price_avg) : 0;
    return {
        date, start: date, end: date, isMonth: false,
        market, basis,
        package: row.package || '',
        variety: row.variety || '',
        district: row.district || '',
        organic: row.organic || '',
        origin: row.origin || '',
        sum: priced ? price : 0,
        count: priced ? 1 : 0,
        rows: 1,
        // Package price, for the "$X per package" line under a single $/lb package
        pkgSum: priced && pkgPrice > 0 ? pkgPrice : 0,
        pkgCount: priced && pkgPrice > 0 ? 1 : 0,
    };
}

/** Last day of the month a 'YYYY-MM-DD' key falls in. */
export function monthEndKey(key) {
    return addDaysToKey(nextMonthStartKey(key), -1);
}

/** First day of the month after the one a 'YYYY-MM-DD' key falls in. */
export function nextMonthStartKey(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/**
 * One monthly rollup row. The rollup has no origin, and no per-row dates
 * inside the month, so start/end span the month (clipped to the caller's
 * range when given).
 */
export function entryFromRollup(row, clip = {}) {
    const market = classifyMarketType(row.market_type);
    if (!market) return null;
    const month = String(row.month).slice(0, 10);
    let start = month;
    let end = monthEndKey(month);
    if (clip.from && start < clip.from) start = clip.from;
    if (clip.to && end > clip.to) end = clip.to;
    return {
        date: month, start, end, isMonth: true,
        market, basis: row.price_basis,
        package: row.package || '',
        variety: row.variety || '',
        district: row.district || '',
        organic: row.organic || '',
        origin: null,
        sum: Number(row.price_sum) || 0,
        count: Number(row.price_count) || 0,
        rows: Number(row.row_count) || 0,
        pkgSum: 0,
        pkgCount: 0,
    };
}

/**
 * Average prices without mixing units: every $/lb price averages together;
 * $/each and $/package prices are grouped per package. `factorFor(entry)`
 * optionally scales each entry (CPI adjustment).
 *
 * Returns [{ key, basis, packages, avg, count, packageAvg }], $/lb first, then
 * the most-reported. packageAvg (average package price) is only set when every
 * price in the group came with one, i.e. from raw rows.
 */
export function groupPrices(entries, factorFor = null) {
    const groups = new Map();
    for (const e of entries) {
        if (!e.count || e.basis === 'none') continue;
        const key = e.basis === 'lb' ? 'lb' : `${e.basis}:${e.package}`;
        let g = groups.get(key);
        if (!g) {
            g = { key, basis: e.basis, packages: new Set(), sum: 0, count: 0, pkgSum: 0, pkgCount: 0 };
            groups.set(key, g);
        }
        const f = factorFor ? factorFor(e) : 1;
        g.sum += e.sum * f;
        g.count += e.count;
        g.pkgSum += e.pkgSum * f;
        g.pkgCount += e.pkgCount;
        if (e.package) g.packages.add(e.package);
    }
    return [...groups.values()]
        .map(g => ({
            key: g.key,
            basis: g.basis,
            packages: [...g.packages].sort(),
            avg: g.sum / g.count,
            count: g.count,
            packageAvg: g.pkgCount === g.count ? g.pkgSum / g.pkgCount : null,
        }))
        .sort((a, b) =>
            (b.basis === 'lb') - (a.basis === 'lb') ||
            b.count - a.count ||
            (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
