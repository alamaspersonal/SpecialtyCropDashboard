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

/**
 * Get the full price history for a commodity, for the price-over-time chart.
 * Paginates through ALL matching rows (oldest first) up to a safety cap, and
 * selects only the columns the time-series aggregation needs.
 *
 * @param {string} commodity - Required commodity filter
 * @param {Object} filters - Optional { district, organic }
 * @returns {Array} All matching rows ordered by report_date ascending
 */
export const getTimeSeriesData = async (commodity, filters = {}) => {
    try {
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('UnifiedCropPrice')
                .select('report_date, market_type, price_avg, price_per_lb, price_per_unit, package, origin, variety, organic')
                .eq('commodity', commodity)
                .not('report_date', 'is', null)
                .order('report_date', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (filters.district) query = query.eq('district', filters.district);
            if (filters.organic) query = query.eq('organic', filters.organic);

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

            // Safety cap — generous to allow multi-year trends
            if (allData.length > 50000) {
                console.warn('[DEBUG supabaseApi] Reached 50k row safety limit for time-series query');
                break;
            }
        }

        console.log('[DEBUG supabaseApi] getTimeSeriesData result:', allData.length, 'rows');
        return allData;
    } catch (error) {
        console.error('Error fetching time-series data:', error);
        throw error;
    }
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
