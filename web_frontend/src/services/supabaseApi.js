/**
 * Supabase API Service
 * 
 * This module provides API functions that mirror the FastAPI backend endpoints,
 * but query Supabase directly. This allows the app to work without the Python backend.
 *
 * Table: UnifiedCropPrice
 */

import { supabase } from './supabase';
import {
    STATIC_FILTERS,
    FILTER_COMBOS,
    COMMODITIES_WITH_COMPLETE_DATA,
    COMMODITIES_WITH_ORGANIC_DATA,
} from '../constants/staticFilters';

// Simple API response cache for filter endpoints to prevent redundant network requests
const apiCache = {
    filters: new Map(),
    completeCommodities: null,
    organicCommodities: null
};

/**
 * Get cascading filter options, computed locally from FILTER_COMBOS (every distinct
 * category/commodity/variety/district/organic combination in the table, generated
 * by backend_update/extract_filters.py). No network round-trip.
 *
 * Each field's options honour the other relevant selections but ignore its own
 * (and, for parents, its children), so the user can always change a choice.
 */
const FIELD_INDEX = { category: 0, commodity: 1, variety: 2, district: 3, organic: 4 };
const FIELD_PARENTS = {
    category: ['district', 'organic'],
    commodity: ['category', 'district', 'organic'],
    variety: ['category', 'commodity', 'district', 'organic'],
    district: ['category', 'commodity', 'variety', 'organic'],
    organic: ['category', 'commodity', 'variety', 'district'],
};

export const getFilters = async (currentFilters = {}) => {
    const hasActiveFilters = Object.values(currentFilters).some(
        val => val !== null && val !== undefined && val !== ''
    );
    if (!hasActiveFilters) return STATIC_FILTERS;

    const optionsFor = (field) => {
        const active = FIELD_PARENTS[field]
            .filter(k => currentFilters[k])
            .map(k => [FIELD_INDEX[k], currentFilters[k]]);
        const idx = FIELD_INDEX[field];
        const values = new Set();
        for (const combo of FILTER_COMBOS) {
            if (active.every(([i, v]) => combo[i] === v) && combo[idx] && combo[idx] !== 'N/A') {
                values.add(combo[idx]);
            }
        }
        return [...values].sort();
    };

    return {
        categories: optionsFor('category'),
        commodities: optionsFor('commodity'),
        varieties: optionsFor('variety'),
        packages: [], // Not needed in filter UI
        districts: optionsFor('district'),
        organics: optionsFor('organic'),
    };
};

/**
 * Get commodities that have data for all 3 market types (Shipping Point, Terminal, Retail).
 * Used to filter the commodity dropdown when "complete data only" toggle is enabled.
 * 
 * @returns {Set<string>} Set of commodity names with complete market data
 */
export const getCommoditiesWithCompleteData = async () => {
    // Precomputed offline by backend_update/extract_filters.py, so no runtime
    // query is needed. (Previously read from a commodity_metadata table that
    // was never kept in sync, which left the toggle showing wrong/no results.)
    return new Set(COMMODITIES_WITH_COMPLETE_DATA);
};

/**
 * Get commodities that have organic data available.
 * Used to filter the commodity dropdown when "organic only" toggle is enabled.
 * 
 * @returns {Set<string>} Set of commodity names with organic data
 */
export const getCommoditiesWithOrganicData = async () => {
    // Precomputed offline by backend_update/extract_filters.py — see
    // getCommoditiesWithCompleteData above.
    return new Set(COMMODITIES_WITH_ORGANIC_DATA);
};

/**
 * Get crop prices with optional filters.
 * Mirrors: GET /api/prices
 * 
 * @param {Object} filters - Filter criteria
 * @param {number} limit - Maximum number of results
 * @param {number} days - Number of days to look back
 * @returns {Array} Array of price records
 */
export const getPrices = async (filters = {}, limit = 100, days = null) => {
    try {
        console.log('[DEBUG supabaseApi] getPrices called with:', { filters, limit, days });
        
        let query = supabase
            .from('UnifiedCropPrice')
            .select('*')
            .order('report_date', { ascending: false })
            .limit(limit);

        // Apply filters
        if (filters.commodity) {
            query = query.eq('commodity', filters.commodity);
        }
        if (filters.variety) {
            query = query.eq('variety', filters.variety);
        }
        if (filters.category) {
            query = query.eq('category', filters.category);
        }
        if (filters.package) {
            query = query.eq('package', filters.package);
        }
        if (filters.district) {
            query = query.eq('district', filters.district);
        }
        if (filters.organic) {
            query = query.eq('organic', filters.organic);
        }

        // Date filtering
        if (days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffISO = cutoffDate.toISOString();
            console.log('[DEBUG supabaseApi] Date filter - days:', days, 'cutoff:', cutoffISO);
            query = query.gte('report_date', cutoffISO);
        }

        let { data, error } = await query;

        console.log('[DEBUG supabaseApi] Query result - data length:', data?.length, 'error:', error);

        // FALLBACK: If date filter returns no data, retry without date filter
        // This handles cases where database has stale data
        if (days && (!data || data.length === 0) && !error) {
            console.log('[DEBUG supabaseApi] No data in timeframe, falling back to latest available data');

            // Rebuild query without date filter
            let fallbackQuery = supabase
                .from('UnifiedCropPrice')
                .select('*')
                .order('report_date', { ascending: false })
                .limit(limit);
            
            // Re-apply commodity filters
            if (filters.commodity) fallbackQuery = fallbackQuery.eq('commodity', filters.commodity);
            if (filters.variety) fallbackQuery = fallbackQuery.eq('variety', filters.variety);
            if (filters.category) fallbackQuery = fallbackQuery.eq('category', filters.category);
            if (filters.package) fallbackQuery = fallbackQuery.eq('package', filters.package);
            if (filters.district) fallbackQuery = fallbackQuery.eq('district', filters.district);
            if (filters.organic) fallbackQuery = fallbackQuery.eq('organic', filters.organic);
            
            const fallbackResult = await fallbackQuery;
            data = fallbackResult.data;
            error = fallbackResult.error;
            console.log('[DEBUG supabaseApi] Fallback result - data length:', data?.length);
        }
        
        if (data?.length > 0) {
            console.log('[DEBUG supabaseApi] Date range in data:', 
                data[data.length - 1]?.report_date, 'to', data[0]?.report_date);
        }

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching prices:', error);
        throw error;
    }
};

/**
 * Get the date range (oldest and newest report_date) for a given set of filters.
 * Uses two efficient single-row queries instead of scanning the full table.
 * 
 * @param {Object} filters - Filter criteria (commodity, category, district, etc.)
 * @returns {Object} { minDate: string|null, maxDate: string|null }
 */
export const getDateRange = async (filters = {}) => {
    try {
        console.log('[DEBUG supabaseApi] getDateRange called with:', filters);

        const applyFilters = (query) => {
            if (filters.commodity) query = query.eq('commodity', filters.commodity);
            if (filters.district) query = query.eq('district', filters.district);
            return query;
        };

        // Get oldest date (ascending, limit 1)
        let minQuery = supabase
            .from('UnifiedCropPrice')
            .select('report_date')
            .not('report_date', 'is', null)
            .order('report_date', { ascending: true })
            .limit(1);
        minQuery = applyFilters(minQuery);

        // Get newest date (descending, limit 1)
        let maxQuery = supabase
            .from('UnifiedCropPrice')
            .select('report_date')
            .not('report_date', 'is', null)
            .order('report_date', { ascending: false })
            .limit(1);
        maxQuery = applyFilters(maxQuery);

        const [minResult, maxResult] = await Promise.all([minQuery, maxQuery]);

        if (minResult.error) throw minResult.error;
        if (maxResult.error) throw maxResult.error;

        const minDate = minResult.data?.[0]?.report_date || null;
        const maxDate = maxResult.data?.[0]?.report_date || null;

        console.log('[DEBUG supabaseApi] Date range result:', { minDate, maxDate });
        return { minDate, maxDate };
    } catch (error) {
        console.error('Error fetching date range:', error);
        throw error;
    }
};

/**
 * Get all crop prices within a specific date range for the given filters.
 * Paginates to fetch ALL matching rows (no arbitrary row cap).
 * Designed for bounded queries — caller should limit to ~1 month windows.
 * 
 * @param {Object} filters - Filter criteria (commodity, category, etc.)
 * @param {string} startDate - ISO date string for the start of the range
 * @param {string} endDate - ISO date string for the end of the range
 * @returns {Array} Array of all matching price records
 */
export const getPricesByDateRange = async (filters = {}, startDate, endDate) => {
    try {
        console.log('[DEBUG supabaseApi] getPricesByDateRange called:', { filters, startDate, endDate });

        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('UnifiedCropPrice')
                .select('*')
                .gte('report_date', startDate)
                .lte('report_date', endDate)
                .order('report_date', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            // Apply filters (only columns that exist on UnifiedCropPrice)
            // Note: 'category' is NOT a column in UnifiedCropPrice — do not filter by it
            if (filters.commodity) query = query.eq('commodity', filters.commodity);
            if (filters.variety) query = query.eq('variety', filters.variety);
            if (filters.district) query = query.eq('district', filters.district);
            if (filters.package) query = query.eq('package', filters.package);

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }

            // Safety limit
            if (allData.length > 20000) {
                console.warn('[DEBUG supabaseApi] Reached 20k row safety limit for date range query');
                break;
            }
        }

        console.log('[DEBUG supabaseApi] getPricesByDateRange result: ', allData.length, 'rows');
        return allData;
    } catch (error) {
        console.error('Error fetching prices by date range:', error);
        throw error;
    }
};

/**
 * Get unified prices for charts and analysis.
 * Mirrors: GET /api/v2/prices
 * 
 * @param {string} commodity - Required commodity filter
 * @param {Object} options - Optional filters (variety, package, startDate, endDate)
 * @returns {Array} Array of unified price records
 */
export const getUnifiedPrices = async (commodity, options = {}) => {
    try {
        let query = supabase
            .from('UnifiedCropPrice')
            .select('*')
            .eq('commodity', commodity)
            .order('report_date', { ascending: true })
            .limit(2000);

        if (options.variety) {
            query = query.eq('variety', options.variety);
        }
        if (options.package) {
            query = query.eq('package', options.package);
        }
        if (options.startDate) {
            query = query.gte('report_date', options.startDate);
        }
        if (options.endDate) {
            query = query.lte('report_date', options.endDate);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching unified prices:', error);
        throw error;
    }
};

// ── Price-over-time chart ─────────────────────────────────────────────────────
// The chart never pulls a commodity's full raw history (Apples alone is ~574k
// rows). Short ranges read a date-bounded window of raw rows; long ranges read
// the monthly rollup table, which the daily pipeline keeps in sync.

const PAGE_SIZE = 1000;       // PostgREST's per-request row cap
const PAGE_CONCURRENCY = 10;  // parallel page requests after the first

/**
 * Fetch every row of a query. The first page also returns the exact total, so
 * the remaining pages are requested in parallel (a few at a time) instead of
 * one after another. `buildQuery(selectOptions)` must return a fresh query with
 * a fully deterministic order, or rows can repeat or go missing across pages.
 */
async function fetchAllPages(buildQuery, { maxRows = 100000 } = {}) {
    const first = await buildQuery({ count: 'exact' }).range(0, PAGE_SIZE - 1);
    if (first.error) throw first.error;

    const total = first.count ?? (first.data || []).length;
    if (total > maxRows) {
        console.warn(`[supabaseApi] ${total} rows exceeds the ${maxRows}-row cap; truncating.`);
    }
    const end = Math.min(total, maxRows);

    const offsets = [];
    for (let from = PAGE_SIZE; from < end; from += PAGE_SIZE) offsets.push(from);

    const pages = [];
    for (let i = 0; i < offsets.length; i += PAGE_CONCURRENCY) {
        const batch = offsets.slice(i, i + PAGE_CONCURRENCY);
        const results = await Promise.all(
            batch.map(from => buildQuery().range(from, from + PAGE_SIZE - 1))
        );
        for (const res of results) {
            if (res.error) throw res.error;
            pages.push(res.data || []);
        }
    }
    return (first.data || []).concat(...pages);
}

// Server-side filters shared by every time-series query.
function applySeriesFilters(query, { district, organic, variety } = {}) {
    if (district) query = query.eq('district', district);
    if (organic) query = query.eq('organic', organic);
    if (variety) query = query.eq('variety', variety);
    return query;
}

/**
 * First and latest report_date for a commodity (and filters). The chart's
 * ranges count back from the latest report, not from today, so seasonal crops
 * don't open on an empty window.
 *
 * @param {string} commodity
 * @param {Object} filters - Optional { district, organic, variety }
 * @returns {{ minDate: string|null, maxDate: string|null }}
 */
export const getTimeSeriesBounds = async (commodity, filters = {}) => {
    const edge = (ascending) => applySeriesFilters(
        supabase.from('UnifiedCropPrice').select('report_date').eq('commodity', commodity),
        filters,
    ).order('report_date', { ascending }).limit(1);

    const [minRes, maxRes] = await Promise.all([edge(true), edge(false)]);
    if (minRes.error) throw minRes.error;
    if (maxRes.error) throw maxRes.error;
    return {
        minDate: minRes.data?.[0]?.report_date || null,
        maxDate: maxRes.data?.[0]?.report_date || null,
    };
};

/**
 * Raw rows from `startDate` onward, for the chart's short (daily) ranges.
 *
 * @param {string} commodity
 * @param {Object} filters - Optional { district, organic, variety }
 * @param {string} startDate - Inclusive lower bound, YYYY-MM-DD
 * @returns {Array} Rows ordered by report_date ascending
 */
export const getTimeSeriesWindow = async (commodity, filters, startDate) => {
    return fetchAllPages((selectOptions) => applySeriesFilters(
        supabase
            .from('UnifiedCropPrice')
            .select('report_date, market_type, price_avg, price_per_lb, price_per_unit, package', selectOptions)
            .eq('commodity', commodity)
            .gte('report_date', startDate),
        filters,
    ).order('report_date', { ascending: true }).order('id', { ascending: true }));
};

/**
 * Every monthly rollup row for a commodity (and filters), for the chart's long
 * ranges and the raw export's row counts. A full history is ~15k rows at most.
 *
 * @param {string} commodity
 * @param {Object} filters - Optional { district, organic, variety }
 * @returns {Array} Rows of UnifiedCropPriceMonthly ordered by month ascending
 */
export const getMonthlyPriceRollup = async (commodity, filters = {}) => {
    return fetchAllPages((selectOptions) => applySeriesFilters(
        supabase
            .from('UnifiedCropPriceMonthly')
            .select('month, market_type, package, price_basis, price_sum, price_count, row_count', selectOptions)
            .eq('commodity', commodity),
        filters,
    )
        // Full primary-key order: deterministic paging, served by the PK index.
        .order('month').order('market_type').order('variety').order('package')
        .order('district').order('organic').order('price_basis'));
};

// ── Raw CSV export ────────────────────────────────────────────────────────────
// Exports always hand over every raw row (all columns) for the chosen range,
// even when the chart itself only showed the monthly rollup.
//
// The anon role has a 3 s statement timeout and most history is cold on disk
// (each row is roughly one random read), so no single request may scan many
// rows. Two rules keep requests small:
//   - Keyset paging ("rows after the last (report_date, id) seen") instead of
//     offsets, which make Postgres read and discard every skipped row.
//   - A request that still times out — typically a selective filter, where a
//     page scans many non-matching rows — splits what is left of its date
//     window in half, down to a single day, and both halves are retried.

const EXPORT_CONCURRENCY = 10;  // measured: more parallel requests got slower, not faster
const EXPORT_RETRIES = 2;       // per page, for transient network/server errors
const EXPORT_CHUNK_ROWS = 5000; // merge consecutive sparse months up to this many rows
const STATEMENT_TIMEOUT = '57014';
const DAY_MS = 86400000;

// Merge runs of consecutive month windows up to EXPORT_CHUNK_ROWS rows each, so
// sparse commodities don't spend a whole request per month on a few hundred rows.
function mergeExportChunks(chunks) {
    const merged = [];
    for (const c of chunks) {
        const last = merged[merged.length - 1];
        if (last && last.to === c.from && last.rows + c.rows <= EXPORT_CHUNK_ROWS) {
            last.to = c.to;
            last.rows += c.rows;
        } else {
            merged.push({ ...c });
        }
    }
    return merged;
}

// Data rows in a PostgREST CSV page, and where the last one starts. Newlines
// inside quoted fields (comment columns can hold line breaks) don't count. The
// header ends with one, each row after the first starts with one, and a page
// with no rows comes back as just "\n".
function scanCsvPage(csv) {
    if (!csv || !csv.trim()) return { rows: 0, lastRowStart: -1 };
    let rows = 0;
    let lastRowStart = -1;
    let quoted = false;
    for (let i = 0; i < csv.length; i++) {
        const c = csv.charCodeAt(i);
        if (c === 34) quoted = !quoted; // "
        else if (c === 10 && !quoted) { rows++; lastRowStart = i + 1; } // \n
    }
    return { rows, lastRowStart };
}

// The first `count` fields of one CSV record, unquoted.
function leadingCsvFields(record, count) {
    const fields = [];
    let i = 0;
    while (fields.length < count && i <= record.length) {
        let value = '';
        if (record[i] === '"') {
            for (i++; i < record.length; i++) {
                if (record[i] !== '"') value += record[i];
                else if (record[i + 1] === '"') value += record[i++];
                else { i++; break; }
            }
        } else {
            while (i < record.length && record[i] !== ',') value += record[i++];
        }
        fields.push(value);
        i++; // the comma
    }
    return fields;
}

// Epoch ms of a YYYY-MM-DD bound or a Postgres timestamptz ("2026-09-01 00:00:00+00").
const toMs = (ts) => Date.parse(ts.length === 10
    ? `${ts}T00:00:00Z`
    : ts.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));

// Order of window segments in the file: a split segment's halves sort right
// after it (key [3] < [3,0] < [3,1] < [4]).
function compareKeys(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
}

/**
 * Download every raw UnifiedCropPrice row (all columns) for an export, as CSV.
 *
 * `monthChunks` are the months that have rows, each with its expected row
 * count (from the rollup, or the rows the chart already loaded). Consecutive
 * sparse months are merged, then windows download in parallel
 * (EXPORT_CONCURRENCY at a time, largest first), each paged by keyset until a
 * page comes back short. Counts only size the windows and the progress total,
 * so a stale count can't drop rows inside a window. The last window should be
 * open-ended to pick up rows newer than the counts.
 *
 * @param {string} commodity
 * @param {Object} filters - Optional { district, organic, variety, package }
 * @param {Array<{from: string, to: string|null, rows: number}>} monthChunks -
 *        Ascending, non-overlapping windows [from, to); to = null means open-ended
 * @param {Object} options - { signal: AbortSignal, onProgress: (rowsDone) => void }
 * @returns {{ parts: string[], rows: number }} CSV text in file order (header
 *          first), ready for `new Blob(parts)`; parts is empty when rows is 0
 */
export const downloadRawPriceCsv = async (commodity, filters, monthChunks, { signal, onProgress } = {}) => {
    // One page of a window: its first rows, or the rows after `after`.
    const fetchPage = async ({ from, to }, after) => {
        for (let attempt = 0; ; attempt++) {
            let query = applySeriesFilters(
                supabase.from('UnifiedCropPrice').select('*').eq('commodity', commodity),
                filters,
            );
            if (filters.package) query = query.eq('package', filters.package);
            if (to) query = query.lt('report_date', to);
            query = after
                // The plain gte lets the (commodity, report_date) index start the
                // scan at the last date; the or() skips rows already taken on it.
                ? query.gte('report_date', after.date)
                    .or(`report_date.gt."${after.date}",and(report_date.eq."${after.date}",id.gt.${after.id})`)
                : query.gte('report_date', from);
            const { data, error, status } = await query
                .order('report_date', { ascending: true })
                .order('id', { ascending: true })
                .limit(PAGE_SIZE)
                .abortSignal(signal)
                .csv();
            signal?.throwIfAborted();
            if (!error) return data || '';
            // Timeouts aren't transient: the caller shrinks the window instead.
            // CSV-mode errors can arrive with an empty body, so keep the status.
            if (error.code === STATEMENT_TIMEOUT || attempt === EXPORT_RETRIES) {
                throw Object.assign(
                    new Error(error.message || `request failed (HTTP ${status})`, { cause: error }),
                    { code: error.code },
                );
            }
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
    };

    const windows = mergeExportChunks(monthChunks).map((w, i) => ({ ...w, after: null, key: [i] }));
    const segments = []; // { key, pages } — every window or half-window, in any order
    let header = null;
    let keyCols = null;  // positions of id and report_date in each row
    let rows = 0;
    let failed = false;

    // Largest windows first, so a long one isn't left running alone at the end.
    const queue = [...windows].sort((a, b) => b.rows - a.rows);

    const downloadWindow = async (win) => {
        const segment = { key: win.key, pages: [] };
        segments.push(segment);
        let { after } = win;
        while (!failed) {
            let csv;
            try {
                csv = await fetchPage(win, after);
            } catch (e) {
                if (e.code !== STATEMENT_TIMEOUT) throw e;
                // Too many rows to scan in one statement: split what's left of
                // this window at its midpoint and queue both halves (next up).
                const start = toMs(after ? after.date : win.from);
                const end = win.to ? toMs(win.to) : Math.max(Date.now(), start) + DAY_MS;
                if (end - start <= DAY_MS) throw e;
                // Whole days, at least one, so both halves are non-empty.
                const halfDays = Math.max(1, Math.floor((end - start) / 2 / DAY_MS));
                const mid = new Date(start + halfDays * DAY_MS).toISOString().substring(0, 10);
                queue.unshift(
                    { from: win.from, to: mid, after, key: [...win.key, 0] },
                    { from: mid, to: win.to, after: null, key: [...win.key, 1] },
                );
                return;
            }
            const { rows: n, lastRowStart } = scanCsvPage(csv);
            if (!n) return;
            const headerEnd = csv.indexOf('\n');
            if (!header) {
                header = csv.slice(0, headerEnd);
                const cols = header.split(',');
                keyCols = { id: cols.indexOf('id'), date: cols.indexOf('report_date') };
            }
            segment.pages.push(csv.slice(headerEnd + 1));
            rows += n;
            onProgress?.(rows);
            if (n < PAGE_SIZE) return;
            const last = leadingCsvFields(csv.slice(lastRowStart), Math.max(keyCols.id, keyCols.date) + 1);
            after = { id: last[keyCols.id], date: last[keyCols.date] };
        }
    };

    const worker = async () => {
        while (queue.length && !failed) {
            try {
                await downloadWindow(queue.shift());
            } catch (e) {
                failed = true; // stop the other workers from starting new pages
                throw e;
            }
        }
    };
    // A split can refill the queue after some workers have already exited, so
    // keep going until a full round finds nothing left to do.
    while (queue.length) {
        await Promise.all(Array.from({ length: EXPORT_CONCURRENCY }, worker));
    }

    if (!header) return { parts: [], rows: 0 };
    const parts = [header];
    for (const { pages } of segments.sort((a, b) => compareKeys(a.key, b.key))) {
        for (const body of pages) parts.push('\n', body);
    }
    return { parts, rows };
};

/**
 * Get KPI statistics for a commodity.
 * Mirrors: GET /api/v2/stats
 * 
 * @param {string} commodity - Commodity to get stats for
 * @returns {Object} Statistics including terminal/shipping averages and spread
 */
export const getStats = async (commodity) => {
    try {
        // Calculate date ranges
        const now = new Date();
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(now.getDate() - 14);
        
        // Fetch last 14 days of data for this commodity
        const { data, error } = await supabase
            .from('UnifiedCropPrice')
            .select('*')
            .eq('commodity', commodity)
            .gte('report_date', twoWeeksAgo.toISOString())
            .order('report_date', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) {
            return { error: 'No data found' };
        }

        // Get the most frequent package type (mode) to display appropriate units
        const packageCounts = {};
        data.forEach(r => {
            if (r.package) packageCounts[r.package] = (packageCounts[r.package] || 0) + 1;
        });
        const dominantPackage = Object.keys(packageCounts).reduce((a, b) => packageCounts[a] > packageCounts[b] ? a : b, 'lb');

        // Split into current week (last 7 days from latest data point) and previous week
        const latestDateStr = data[0].report_date;
        const latestDate = new Date(latestDateStr);
        const oneWeekBeforeLatest = new Date(latestDate);
        oneWeekBeforeLatest.setDate(latestDate.getDate() - 7);

        const currentWeekData = data.filter(d => new Date(d.report_date) >= oneWeekBeforeLatest);
        const prevWeekData = data.filter(d => new Date(d.report_date) < oneWeekBeforeLatest);

        // Calculate Average helper
        const calcAvg = (rows, type) => {
            const valid = rows
                .filter(r => r.market_type.includes(type))
                .map(r => r.price_retail || r.price_max) // Prioritize retail, fallback to max
                .filter(v => v !== null && v !== undefined);
            return valid.length > 0
                ? valid.reduce((a, b) => a + b, 0) / valid.length
                : null;
        };

        // Current Week Averages
        const currTerminal = calcAvg(currentWeekData, 'Terminal');
        const currShipping = calcAvg(currentWeekData, 'Shipping');
        const currRetail = calcAvg(currentWeekData, 'Retail');

        // Previous Week Averages
        const prevTerminal = calcAvg(prevWeekData, 'Terminal');
        const prevShipping = calcAvg(prevWeekData, 'Shipping');
        const prevRetail = calcAvg(prevWeekData, 'Retail');

        // Calculate % Changes
        const calcPct = (curr, prev) => prev ? ((curr - prev) / prev) * 100 : 0;

        return {
            date: latestDateStr,
            package_unit: dominantPackage,
            
            terminal: {
                avg: currTerminal || 0,
                pct_change: calcPct(currTerminal, prevTerminal)
            },
            shipping: {
                avg: currShipping || 0,
                pct_change: calcPct(currShipping, prevShipping)
            },
            retail: {
                avg: currRetail || 0,
                pct_change: calcPct(currRetail, prevRetail)
            },
            
            spread: (currTerminal && currShipping) ? currTerminal - currShipping : null,
            
            // Get the latest market note from the most recent data
            market_note: (() => {
                // Find the first non-empty market tone comment from most recent data
                for (const row of data) {
                    if (row.market_tone_comments && row.market_tone_comments.trim() !== '') {
                        return row.market_tone_comments;
                    }
                }
                return null;
            })()
        };

    } catch (error) {
        console.error('Error fetching stats:', error);
        throw error;
    }
};

/**
 * Get price summary aggregated by commodity and variety.
 * Mirrors: GET /api/price_summary
 * 
 * @param {Object} options - Filter options (commodity, date)
 * @returns {Array} Aggregated price summaries
 */
export const getPriceSummary = async (options = {}) => {
    try {
        let query = supabase
            .from('UnifiedCropPrice')
            .select('commodity, variety, price_avg, market_tone_comments');

        if (options.commodity) {
            query = query.eq('commodity', options.commodity);
        }

        const { data, error } = await query.limit(1000);

        if (error) throw error;

        // Group by commodity + variety and calculate averages
        const groups = {};
        data.forEach(row => {
            const key = `${row.commodity}|${row.variety}`;
            if (!groups[key]) {
                groups[key] = {
                    commodity: row.commodity,
                    variety: row.variety,
                    prices: [],
                    marketTone: row.market_tone_comments,
                };
            }
            if (row.price_avg != null) groups[key].prices.push(row.price_avg);
        });

        return Object.values(groups).map(g => ({
            commodity: g.commodity,
            variety: g.variety,
            avg_price: g.prices.length > 0
                ? Math.round((g.prices.reduce((a, b) => a + b, 0) / g.prices.length) * 100) / 100
                : null,
            price_count: g.prices.length,
            market_tone: g.marketTone,
        })).slice(0, 50);
    } catch (error) {
        console.error('Error fetching price summary:', error);
        throw error;
    }
};
