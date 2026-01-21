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
 * @param {Object} currentFilters - Currently selected filters (Ignored for static list)
 * @returns {Object} Object containing arrays of distinct values for each filter field
 */
export const getFilters = async (currentFilters = {}) => {
    try {
        // Check if any filters are actually active
        const hasActiveFilters = Object.values(currentFilters).some(
            val => val !== null && val !== undefined && val !== ''
        );

        if (!hasActiveFilters) {
            console.log('[DEBUG] No active filters, returning STATIC_FILTERS');
            return STATIC_FILTERS;
        }

        console.log('[DEBUG] Active filters detected, querying Supabase:', currentFilters);
        
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            // Build query with current filters applied
            let query = supabase
                .from('CropPrice')
                .select('category, commodity, variety, package, district, organic')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            // Apply existing filters to narrow down options
            if (currentFilters.commodity) query = query.eq('commodity', currentFilters.commodity);
            if (currentFilters.variety) query = query.eq('variety', currentFilters.variety);
            if (currentFilters.category) query = query.eq('category', currentFilters.category);
            if (currentFilters.district) query = query.eq('district', currentFilters.district);
            if (currentFilters.organic) query = query.eq('organic', currentFilters.organic);

            const { data, error } = await query;
            
            if (error) throw error;

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                console.log(`[DEBUG] Fetched page ${page}, rows: ${data.length}, total: ${allData.length}`);
                
                if (data.length < pageSize) {
                    hasMore = false; // Less than integer page size means last page
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
            
            // Safety break for massive datasets (optional, but good practice)
            if (allData.length > 50000) {
                console.warn('[DEBUG] Reached safety limit of 50k rows, stopping fetch.');
                break;
            }
        }

        console.log('[DEBUG] Total rows fetched for filters:', allData.length);

        // Extract unique values for each field
        const extractUnique = (field) => {
            const values = allData
                .map(row => row[field])
                .filter(val => val && val !== 'N/A');
            return [...new Set(values)].sort();
        };

        const result = {
            categories: extractUnique('category'),
            commodities: extractUnique('commodity'),
            varieties: extractUnique('variety'),
            packages: extractUnique('package'),
            districts: extractUnique('district'),
            organics: extractUnique('organic'),
        };
        
        return result;

    } catch (error) {
        console.error('Error fetching filters:', error);
        // Fallback to static filters on error?
        // return STATIC_FILTERS; 
        throw error;
    }
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
            .from('CropPrice')
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
                .from('CropPrice')
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
            
            spread: (currTerminal && currShipping) ? currTerminal - currShipping : null
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
            .from('CropPrice')
            .select('commodity, variety, low_price, high_price, market_tone_comments');

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
                    lowPrices: [],
                    highPrices: [],
                    marketTone: row.market_tone_comments,
                };
            }
            if (row.low_price) groups[key].lowPrices.push(row.low_price);
            if (row.high_price) groups[key].highPrices.push(row.high_price);
        });

        return Object.values(groups).map(g => ({
            commodity: g.commodity,
            variety: g.variety,
            avg_low_price: g.lowPrices.length > 0
                ? Math.round((g.lowPrices.reduce((a, b) => a + b, 0) / g.lowPrices.length) * 100) / 100
                : null,
            avg_high_price: g.highPrices.length > 0
                ? Math.round((g.highPrices.reduce((a, b) => a + b, 0) / g.highPrices.length) * 100) / 100
                : null,
            low_price_count: g.lowPrices.length,
            high_price_count: g.highPrices.length,
            market_tone: g.marketTone,
        })).slice(0, 50);
    } catch (error) {
        console.error('Error fetching price summary:', error);
        throw error;
    }
};
