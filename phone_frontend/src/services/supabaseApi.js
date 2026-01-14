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

/**
 * Get distinct filter values for the filter UI.
 * Mirrors: GET /api/filters
 * 
 * @param {Object} currentFilters - Currently selected filters to narrow down options
 * @returns {Object} Object containing arrays of distinct values for each filter field
 */
export const getFilters = async (currentFilters = {}) => {
    try {
        // Build query with current filters applied
        let query = supabase.from('CropPrice').select('category, commodity, variety, package, district, organic');

        // Apply existing filters to narrow down options
        if (currentFilters.commodity) {
            query = query.eq('commodity', currentFilters.commodity);
        }
        if (currentFilters.variety) {
            query = query.eq('variety', currentFilters.variety);
        }
        if (currentFilters.category) {
            query = query.eq('category', currentFilters.category);
        }
        if (currentFilters.district) {
            query = query.eq('district', currentFilters.district);
        }
        if (currentFilters.organic) {
            query = query.eq('organic', currentFilters.organic);
        }

        const { data, error } = await query.limit(5000);

        if (error) throw error;

        // Extract unique values for each field
        const extractUnique = (field) => {
            const values = data
                .map(row => row[field])
                .filter(val => val && val !== 'N/A');
            return [...new Set(values)].sort();
        };

        return {
            categories: extractUnique('category'),
            commodities: extractUnique('commodity'),
            varieties: extractUnique('variety'),
            packages: extractUnique('package'),
            districts: extractUnique('district'),
            organics: extractUnique('organic'),
        };
    } catch (error) {
        console.error('Error fetching filters:', error);
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
            query = query.gte('report_date', cutoffDate.toISOString());
        }

        const { data, error } = await query;

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
        // First get the latest date
        const { data: latestData, error: latestError } = await supabase
            .from('UnifiedCropPrice')
            .select('report_date')
            .order('report_date', { ascending: false })
            .limit(1);

        if (latestError) throw latestError;
        if (!latestData || latestData.length === 0) {
            return { error: 'No data found' };
        }

        const targetDate = latestData[0].report_date;

        // Get data for target date and commodity
        const { data, error } = await supabase
            .from('UnifiedCropPrice')
            .select('*')
            .eq('report_date', targetDate)
            .eq('commodity', commodity);

        if (error) throw error;

        // Partition by market type
        const terminalRows = data.filter(d => d.market_type === 'Terminal');
        const shippingRows = data.filter(d =>
            d.market_type === 'Shipping Point' || d.market_type === 'Shipping'
        );

        // Calculate averages (filtering nulls)
        const calcAvg = (rows, field) => {
            const validVals = rows
                .map(r => r[field])
                .filter(v => v !== null && v !== undefined);
            return validVals.length > 0
                ? validVals.reduce((a, b) => a + b, 0) / validVals.length
                : 0;
        };

        const tAvg = calcAvg(terminalRows, 'price_retail') || calcAvg(terminalRows, 'price_max');
        const sAvg = calcAvg(shippingRows, 'price_retail') || calcAvg(shippingRows, 'price_max');
        const spread = (tAvg && sAvg) ? tAvg - sAvg : null;

        return {
            current_terminal_avg: Math.round(tAvg * 100) / 100,
            terminal_count: terminalRows.length,
            current_shipping_avg: Math.round(sAvg * 100) / 100,
            shipping_count: shippingRows.length,
            spread: spread ? Math.round(spread * 100) / 100 : null,
            date: targetDate,
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
