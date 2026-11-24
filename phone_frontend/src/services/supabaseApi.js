/**
 * Supabase API Service
 *
 * All price reads: UnifiedCropPrice (raw rows) and UnifiedCropPriceMonthly (monthly rollup).
 */

import { supabase } from './supabase';
import {
    STATIC_FILTERS,
} from '../constants/staticFilters';
import { toDateKey, addDaysToKey } from '../shared/dates';

const PAGE_SIZE = 1000; // PostgREST's max rows per request

/**
 * Fetch up to maxRows rows newest-first, paging with a (report_date, id)
 * cursor. The query from buildQuery() must select `id` and `report_date`.
 *
 * OFFSET paging re-scans every earlier row on each page, so deep pages for
 * large commodities (Apples: ~86k rows over 2 years) ran past the anon role's
 * 3s statement timeout; sorting on report_date alone could also repeat or skip
 * rows that share a date at a page boundary. Each cursor page is an index
 * range scan of ~1000 rows.
 */
async function fetchNewestFirst(buildQuery, maxRows) {
    const rows = [];
    let cursor = null;
    while (rows.length < maxRows) {
        let query = buildQuery()
            .order('report_date', { ascending: false })
            .order('id', { ascending: false })
            .limit(PAGE_SIZE);
        if (cursor) {
            // The lte is redundant with the or() but lets Postgres use it as an
            // index bound instead of filtering every newer row.
            query = query
                .lte('report_date', cursor.date)
                .or(`report_date.lt."${cursor.date}",and(report_date.eq."${cursor.date}",id.lt.${cursor.id})`);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < PAGE_SIZE) break;
        const last = data[data.length - 1];
        cursor = { date: last.report_date, id: last.id };
    }
    return rows;
}

/**
 * Get distinct filter values for the filter UI.
 * 
 * When fetching options for a filter, we exclude that filter's current value
 * but keep parent filters applied. This ensures users see all available options
 * within their parent filter selections, not just their previous choice.
 * 
 * Filter hierarchy: category -> commodity -> variety
 * Independent filters: district, organic
 * 
 * @param {Object} currentFilters - Currently selected filters
 * @returns {Object} Object containing arrays of distinct values for each filter field
 */
export const getFilters = async (currentFilters = {}) => {
    try {
        // Check if any filters are actually active
        const hasActiveFilters = Object.values(currentFilters).some(
            val => val !== null && val !== undefined && val !== ''
        );

        if (!hasActiveFilters) {
            return STATIC_FILTERS;
        }
        
        // Helper function to fetch options for a specific field
        // excludeField: don't apply filter for this field (so user sees all options)
        // applyFilters: which filters to apply (parent/sibling filters)
        const fetchOptionsForField = async (field, applyFilters) => {
            let allData = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                let query = supabase
                    .from('UnifiedCropPrice')
                    .select(field)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                // Apply only the specified filters (not the field being fetched)
                if (applyFilters.category) query = query.eq('category', applyFilters.category);
                if (applyFilters.commodity) query = query.eq('commodity', applyFilters.commodity);
                if (applyFilters.variety) query = query.eq('variety', applyFilters.variety);
                if (applyFilters.district) query = query.eq('district', applyFilters.district);
                if (applyFilters.organic) query = query.eq('organic', applyFilters.organic);

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

                if (allData.length > 50000) {
                    break;
                }
            }

            // Extract unique values
            const values = allData
                .map(row => row[field])
                .filter(val => val && val !== 'N/A');
            return [...new Set(values)].sort();
        };

        // Build filter sets for each field, excluding the field itself
        // Category: no parent filters, just use other independent filters
        const categoryFilters = {
            district: currentFilters.district,
            organic: currentFilters.organic,
        };

        // Commodity: apply category filter (parent), exclude commodity itself
        const commodityFilters = {
            category: currentFilters.category,
            district: currentFilters.district,
            organic: currentFilters.organic,
        };

        // Variety: apply category and commodity filters (parents), exclude variety itself
        const varietyFilters = {
            category: currentFilters.category,
            commodity: currentFilters.commodity,
            district: currentFilters.district,
            organic: currentFilters.organic,
        };

        // District: apply main filters but exclude district itself
        const districtFilters = {
            category: currentFilters.category,
            commodity: currentFilters.commodity,
            variety: currentFilters.variety,
            organic: currentFilters.organic,
        };

        // Organic: apply main filters but exclude organic itself
        const organicFilters = {
            category: currentFilters.category,
            commodity: currentFilters.commodity,
            variety: currentFilters.variety,
            district: currentFilters.district,
        };

        // Fetch all filter options in parallel
        const [categories, commodities, varieties, districts, organics] = await Promise.all([
            fetchOptionsForField('category', categoryFilters),
            fetchOptionsForField('commodity', commodityFilters),
            fetchOptionsForField('variety', varietyFilters),
            fetchOptionsForField('district', districtFilters),
            fetchOptionsForField('organic', organicFilters),
        ]);

        return {
            categories,
            commodities,
            varieties,
            packages: [],
            districts,
            organics,
        };

    } catch (error) {
        console.error('Error fetching filters:', error);
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

        return {
            minDate: minResult.data?.[0]?.report_date || null,
            maxDate: maxResult.data?.[0]?.report_date || null,
        };
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
        // Rows come back newest-first, so the 20k safety cap drops the oldest.
        return await fetchNewestFirst(() => {
            let query = supabase
                .from('UnifiedCropPrice')
                .select('*')
                .gte('report_date', startDate)
                .lte('report_date', endDate);

            // Apply filters (only columns that exist on UnifiedCropPrice)
            if (filters.commodity) query = query.eq('commodity', filters.commodity);
            if (filters.variety) query = query.eq('variety', filters.variety);
            if (filters.district) query = query.eq('district', filters.district);
            if (filters.package) query = query.eq('package', filters.package);
            return query;
        }, 20000);
    } catch (error) {
        console.error('Error fetching prices by date range:', error);
        throw error;
    }
};

/**
 * Get KPI statistics for a commodity.
 * 
 * @param {string} commodity - Commodity to get stats for
 * @returns {Object} Statistics including terminal/shipping averages and spread
 */
export const getStats = async (commodity) => {
    try {
        // Fetch the most recent rows for this commodity, then keep the 14 days
        // ending on its latest report. (Anchoring on the device's date returned
        // nothing for any commodity that hadn't reported in the last 2 weeks.)
        const { data: recent, error } = await supabase
            .from('UnifiedCropPrice')
            .select('*')
            .eq('commodity', commodity)
            .not('report_date', 'is', null)
            .order('report_date', { ascending: false })
            .limit(1000);

        if (error) throw error;
        if (!recent || recent.length === 0) {
            return { error: 'No data found' };
        }
        const windowStartKey = addDaysToKey(toDateKey(recent[0].report_date), -14);
        const data = recent.filter(d => toDateKey(d.report_date) >= windowStartKey);

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
                .filter(r => r.market_type?.includes(type))
                .map(r => r.price_avg)
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
        const calcPct = (curr, prev) => (prev && curr != null) ? ((curr - prev) / prev) * 100 : null;

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
 * Raw price rows for the chart's short (daily) ranges: report dates from
 * `startDate` (inclusive) through `beforeDate` (exclusive; omit for the
 * latest). Only the columns the chart needs. Rows are fetched newest-first so
 * the 50k safety cap trims the oldest, and returned oldest-first.
 *
 * @param {string} commodity
 * @param {Object} filters - Optional { district }
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} [beforeDate] - 'YYYY-MM-DD'
 */
export const getTimeSeriesWindow = async (commodity, filters = {}, startDate, beforeDate = null) => {
    try {
        const rows = await fetchNewestFirst(() => {
            let query = supabase
                .from('UnifiedCropPrice')
                .select('id, report_date, market_type, price_avg, price_per_lb, price_per_unit, package, origin, variety, organic')
                .eq('commodity', commodity)
                .not('report_date', 'is', null)
                .gte('report_date', startDate);
            if (beforeDate) query = query.lt('report_date', beforeDate);
            if (filters.district) query = query.eq('district', filters.district);
            return query;
        }, 50000);
        return rows.reverse();
    } catch (error) {
        console.error('Error fetching time series window:', error);
        throw error;
    }
};

/**
 * Number of raw rows getPricesByDateRange would return (same filters), so a
 * caller can switch to the monthly rollup before fetching a huge range.
 */
export const countPricesByDateRange = async (filters = {}, startDate, endDate) => {
    try {
        let query = supabase
            .from('UnifiedCropPrice')
            .select('id', { count: 'exact', head: true })
            .gte('report_date', startDate)
            .lte('report_date', endDate);
        if (filters.commodity) query = query.eq('commodity', filters.commodity);
        if (filters.variety) query = query.eq('variety', filters.variety);
        if (filters.district) query = query.eq('district', filters.district);
        if (filters.package) query = query.eq('package', filters.package);
        const { count, error } = await query;
        if (error) throw error;
        return count ?? 0;
    } catch (error) {
        console.error('Error counting prices by date range:', error);
        throw error;
    }
};

// Primary-key order of UnifiedCropPriceMonthly: deterministic paging, served
// by the PK index.
const MONTHLY_ORDER = ['month', 'market_type', 'variety', 'package', 'district', 'organic', 'price_basis'];

/**
 * Monthly rollup rows (UnifiedCropPriceMonthly) for a commodity: month in
 * [fromMonth, toMonth), either bound optional. Used by the chart's 1Y/2Y
 * ranges and by custom waterfall ranges too large for raw rows. A full
 * commodity history is ~15k rows at most.
 *
 * @param {string} commodity
 * @param {Object} filters - Optional { district }
 * @param {string} [fromMonth] - 'YYYY-MM-01', inclusive
 * @param {string} [toMonth] - 'YYYY-MM-01', exclusive
 */
export const getMonthlyPriceRollup = async (commodity, filters = {}, fromMonth = null, toMonth = null) => {
    try {
        const rows = [];
        for (let from = 0; from < 50000; from += PAGE_SIZE) {
            let query = supabase
                .from('UnifiedCropPriceMonthly')
                .select('month, market_type, variety, package, district, organic, price_basis, price_sum, price_count, row_count')
                .eq('commodity', commodity);
            if (filters.district) query = query.eq('district', filters.district);
            if (fromMonth) query = query.gte('month', fromMonth);
            if (toMonth) query = query.lt('month', toMonth);
            for (const col of MONTHLY_ORDER) query = query.order(col, { ascending: true });
            const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
            if (error) throw error;
            if (data?.length) rows.push(...data);
            if (!data || data.length < PAGE_SIZE) break;
        }
        return rows;
    } catch (error) {
        console.error('Error fetching monthly price rollup:', error);
        throw error;
    }
};
