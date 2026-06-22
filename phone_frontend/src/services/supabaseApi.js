/**
 * Supabase API Service
 * 
 * This module provides API functions that mirror the FastAPI backend endpoints,
 * but query Supabase directly. This allows the app to work without the Python backend.
 * 
 * Tables:
 * - CropPrice: Detailed crop price data with all fields
 * - UnifiedCropPrice: Simplified unified price data
 */

import { supabase } from './supabase';
import { STATIC_FILTERS } from '../constants/staticFilters';

/**
 * Get distinct filter values for the filter UI.
 * Mirrors: GET /api/filters
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
 * Get commodities that have data for all 3 market types (Shipping Point, Terminal, Retail).
 * Used to filter the commodity dropdown when "complete data only" toggle is enabled.
 * 
 * @returns {Set<string>} Set of commodity names with complete market data
 */
export const getCommoditiesWithCompleteData = async () => {
    // Fetch all unique commodity names for a given market_type keyword, paginated.
    // Querying one market type at a time (in parallel) is far faster than a full
    // table scan, since Supabase filters server-side and we only transfer one column.
    const fetchCommoditiesForType = async (pattern) => {
        const commodities = new Set();
        let page = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from('UnifiedCropPrice')
                .select('commodity')
                .ilike('market_type', `%${pattern}%`)
                .range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            data.forEach(row => { if (row.commodity) commodities.add(row.commodity); });
            if (data.length < pageSize) break;
            page++;
        }
        return commodities;
    };

    const [terminal, shipping, retail] = await Promise.all([
        fetchCommoditiesForType('terminal'),
        fetchCommoditiesForType('shipping'),
        fetchCommoditiesForType('retail'),
    ]);

    // Intersect: only keep commodities present in all three market types
    const completeCommodities = new Set();
    for (const c of terminal) {
        if (shipping.has(c) && retail.has(c)) completeCommodities.add(c);
    }
    return completeCommodities;
};

/**
 * Get commodities that have organic data available.
 * Used to filter the commodity dropdown when "organic only" toggle is enabled.
 * 
 * @returns {Set<string>} Set of commodity names with organic data
 */
export const getCommoditiesWithOrganicData = async () => {
    const commodities = new Set();
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('UnifiedCropPrice')
            .select('commodity')
            .eq('organic', 'yes')
            .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        data.forEach(row => { if (row.commodity) commodities.add(row.commodity); });
        if (data.length < pageSize) break;
        page++;
    }
    return commodities;
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
            query = query.gte('report_date', cutoffDate.toISOString());
        }

        let { data, error } = await query;

        // FALLBACK: If date filter returns no data, retry without date filter
        // This handles cases where database has stale data
        if (days && (!data || data.length === 0) && !error) {
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

            if (allData.length > 20000) {
                break;
            }
        }

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

/**
 * Get full time-series price data for a commodity.
 * Fetches ALL rows from UnifiedCropPrice for the given commodity
 * (paginated), returning the fields needed for chart aggregation.
 *
 * Designed for the Price Over Time chart.
 *
 * @param {string} commodity - Required commodity name
 * @param {Object} filters - Optional { district, organic }
 * @returns {Array} Array of { report_date, market_type, price_avg, package, origin, variety, organic }
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
                .select('report_date, market_type, price_avg, package, origin, variety, organic, weight_lbs, weight_kgs, units')
                .eq('commodity', commodity)
                .not('report_date', 'is', null)
                .order('report_date', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (filters.district) query = query.eq('district', filters.district);

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

        return allData;
    } catch (error) {
        console.error('Error fetching time series data:', error);
        throw error;
    }
};

