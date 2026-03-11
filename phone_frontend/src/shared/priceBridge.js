/**
 * priceBridge.js — Platform-Agnostic Price Bridge Calculation Engine
 *
 * Decomposes the price change between two periods into:
 *   1. Price Level Effect    — same-scope repricing (Laspeyres)
 *   2. Package Mix Effect    — shift in package-type composition
 *   3. Origin Mix Effect     — shift in origin composition
 *   4. Residual              — interaction terms, new/lost segments
 *
 * Uses report counts as weights (no volume data in USDA dataset).
 *
 * No React, React Native, or Next.js imports — runs in any JS environment.
 */

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Group rows into segments by (package, origin), computing
 * the weighted average price and relative weight for each segment.
 *
 * @param {Array} rows - Array of { price_avg, package, origin, ... }
 * @returns {Map<string, { avg: number, weight: number, count: number, package: string, origin: string }>}
 */
function buildSegmentMap(rows) {
    const segments = new Map();
    const total = rows.length;

    if (total === 0) return segments;

    for (const row of rows) {
        const price = parseFloat(row.price_avg);
        if (isNaN(price)) continue;

        const pkg = row.package || '__none__';
        const origin = row.origin || '__none__';
        const key = `${pkg}|||${origin}`;

        if (!segments.has(key)) {
            segments.set(key, { sum: 0, count: 0, package: pkg, origin: origin });
        }
        const seg = segments.get(key);
        seg.sum += price;
        seg.count += 1;
    }

    // Finalize: compute average and weight (proportion of total reports)
    for (const [key, seg] of segments) {
        seg.avg = seg.sum / seg.count;
        seg.weight = seg.count / total;
        delete seg.sum; // cleanup
    }

    return segments;
}

/**
 * Group rows by a single dimension (e.g., 'package') and compute
 * avg price and weight for each group.
 *
 * @param {Array} rows
 * @param {string} field
 * @returns {Map<string, { avg: number, weight: number, count: number }>}
 */
function buildDimensionMap(rows, field) {
    const groups = new Map();
    const total = rows.length;

    if (total === 0) return groups;

    for (const row of rows) {
        const price = parseFloat(row.price_avg);
        if (isNaN(price)) continue;

        const key = row[field] || '__none__';
        if (!groups.has(key)) {
            groups.set(key, { sum: 0, count: 0 });
        }
        const g = groups.get(key);
        g.sum += price;
        g.count += 1;
    }

    for (const [key, g] of groups) {
        g.avg = g.sum / g.count;
        g.weight = g.count / total;
        delete g.sum;
    }

    return groups;
}

/**
 * Compute weighted average across all rows.
 */
function overallAvg(rows) {
    if (!rows || rows.length === 0) return 0;
    const prices = rows.map(r => parseFloat(r.price_avg)).filter(v => !isNaN(v));
    if (prices.length === 0) return 0;
    return prices.reduce((a, b) => a + b, 0) / prices.length;
}

// ─── Core Decomposition ─────────────────────────────────────────

/**
 * Decompose the price change between Period A and Period B data
 * for a single market type.
 *
 * @param {Array} periodA - Rows for Period A (already filtered to one market_type)
 * @param {Array} periodB - Rows for Period B (already filtered to one market_type)
 * @returns {Object} PriceBridge object
 */
export function computeBridge(periodA, periodB) {
    const avgA = overallAvg(periodA);
    const avgB = overallAvg(periodB);
    const totalDelta = avgB - avgA;

    // Handle edge cases
    if (periodA.length === 0 && periodB.length === 0) {
        return createEmptyBridge(avgA, avgB);
    }
    if (periodA.length === 0) {
        return createBridge(avgA, avgB, [
            { label: 'New Data', value: totalDelta },
        ], periodA, periodB);
    }
    if (periodB.length === 0) {
        return createBridge(avgA, avgB, [
            { label: 'Data Removed', value: totalDelta },
        ], periodA, periodB);
    }

    // Step 1: Price Level Effect (Laspeyres — hold A weights, swap B prices)
    const segA = buildSegmentMap(periodA);
    const segB = buildSegmentMap(periodB);

    let priceLevelEffect = 0;
    let priceLevelWeight = 0;

    for (const [key, sA] of segA) {
        const sB = segB.get(key);
        if (sB) {
            // Segment exists in both periods
            priceLevelEffect += sA.weight * (sB.avg - sA.avg);
            priceLevelWeight += sA.weight;
        }
    }

    // Step 2: Package Mix Effect
    const pkgA = buildDimensionMap(periodA, 'package');
    const pkgB = buildDimensionMap(periodB, 'package');

    let packageMixEffect = 0;
    const allPackages = new Set([...pkgA.keys(), ...pkgB.keys()]);
    for (const pkg of allPackages) {
        const wA = pkgA.get(pkg)?.weight || 0;
        const wB = pkgB.get(pkg)?.weight || 0;
        const priceRef = pkgA.get(pkg)?.avg || pkgB.get(pkg)?.avg || 0;
        packageMixEffect += (wB - wA) * priceRef;
    }

    // Step 3: Origin Mix Effect
    const origA = buildDimensionMap(periodA, 'origin');
    const origB = buildDimensionMap(periodB, 'origin');

    let originMixEffect = 0;
    const allOrigins = new Set([...origA.keys(), ...origB.keys()]);
    for (const orig of allOrigins) {
        const wA = origA.get(orig)?.weight || 0;
        const wB = origB.get(orig)?.weight || 0;
        const priceRef = origA.get(orig)?.avg || origB.get(orig)?.avg || 0;
        originMixEffect += (wB - wA) * priceRef;
    }

    // Step 4: Residual (ensures bridge sums exactly to totalDelta)
    const residual = totalDelta - priceLevelEffect - packageMixEffect - originMixEffect;

    const effects = [
        { label: 'Price Level', value: round(priceLevelEffect) },
        { label: 'Package Mix', value: round(packageMixEffect) },
        { label: 'Origin Mix', value: round(originMixEffect) },
        { label: 'Other / Residual', value: round(residual) },
    ];

    return createBridge(avgA, avgB, effects, periodA, periodB);
}

// ─── Bridge for all three market types ──────────────────────────

/**
 * Compute bridges for all three market types from raw period data.
 *
 * @param {Array} allDataA - All rows for Period A (unfiltered by market_type)
 * @param {Array} allDataB - All rows for Period B
 * @returns {Object} { terminal: PriceBridge, shipping: PriceBridge, retail: PriceBridge, summary: {...} }
 */
export function computeAllBridges(allDataA, allDataB) {
    const partition = (data, type) => {
        return data.filter(d => {
            const mt = (d.market_type || '').toLowerCase();
            if (type === 'terminal') return mt.includes('terminal') || !d.market_type;
            if (type === 'shipping') return mt.includes('shipping');
            if (type === 'retail') return mt.includes('retail');
            return false;
        });
    };

    const terminal = computeBridge(partition(allDataA, 'terminal'), partition(allDataB, 'terminal'));
    const shipping = computeBridge(partition(allDataA, 'shipping'), partition(allDataB, 'shipping'));
    const retail = computeBridge(partition(allDataA, 'retail'), partition(allDataB, 'retail'));

    // Summary: overall deltas
    const summary = {
        terminal_delta: round(terminal.period_b_avg - terminal.period_a_avg),
        shipping_delta: round(shipping.period_b_avg - shipping.period_a_avg),
        retail_delta: round(retail.period_b_avg - retail.period_a_avg),
        terminal_pct: terminal.period_a_avg ? round(((terminal.period_b_avg - terminal.period_a_avg) / terminal.period_a_avg) * 100) : 0,
        shipping_pct: shipping.period_a_avg ? round(((shipping.period_b_avg - shipping.period_a_avg) / shipping.period_a_avg) * 100) : 0,
        retail_pct: retail.period_a_avg ? round(((retail.period_b_avg - retail.period_a_avg) / retail.period_a_avg) * 100) : 0,
    };

    return { terminal, shipping, retail, summary };
}

// ─── Factory helpers ────────────────────────────────────────────

function createBridge(avgA, avgB, effects, rowsA, rowsB) {
    const datesA = extractDateRange(rowsA);
    const datesB = extractDateRange(rowsB);

    return {
        period_a_avg: round(avgA),
        period_b_avg: round(avgB),
        effects,
        period_a: { start: datesA.start, end: datesA.end, reportCount: rowsA.length },
        period_b: { start: datesB.start, end: datesB.end, reportCount: rowsB.length },
    };
}

function createEmptyBridge(avgA, avgB) {
    return {
        period_a_avg: round(avgA),
        period_b_avg: round(avgB),
        effects: [
            { label: 'Price Level', value: 0 },
            { label: 'Package Mix', value: 0 },
            { label: 'Origin Mix', value: 0 },
            { label: 'Other / Residual', value: 0 },
        ],
        period_a: { start: null, end: null, reportCount: 0 },
        period_b: { start: null, end: null, reportCount: 0 },
    };
}

function extractDateRange(rows) {
    if (!rows || rows.length === 0) return { start: null, end: null };
    const dates = rows.map(r => r.report_date).filter(Boolean).sort();
    return { start: dates[0] || null, end: dates[dates.length - 1] || null };
}

function round(val) {
    if (val == null || isNaN(val)) return 0;
    return Math.round(val * 100) / 100;
}
