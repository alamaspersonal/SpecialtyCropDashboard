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
            console.log('[DEBUG] No active filters, returning STATIC_FILTERS');
            return STATIC_FILTERS;
        }

        console.log('[DEBUG] Active filters detected, querying Supabase:', currentFilters);
        
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
                    .from('CropPrice')
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
                    console.warn('[DEBUG] Reached safety limit of 50k rows, stopping fetch.');
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

        const result = {
            categories,
            commodities,
            varieties,
            packages: [], // Not needed in filter UI
            districts,
            organics,
        };
        
        console.log('[DEBUG] Filter options fetched:', {
            categories: categories.length,
            commodities: commodities.length,
            varieties: varieties.length,
            districts: districts.length,
            organics: organics.length,
        });

        return result;

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
    try {
        console.log('[DEBUG] Fetching commodities with complete market data...');
        
        // Paginate to get ALL commodity + market_type combinations
        // Supabase has a default limit of 1000 rows per request
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
            const { data, error } = await supabase
                .from('CropPrice')
                .select('commodity, market_type')
                .range(page * pageSize, (page + 1) * pageSize - 1);
            
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
            
            // Safety limit to prevent infinite loops
            if (allData.length > 100000) {
                console.warn('[DEBUG] Reached safety limit of 100k rows');
                break;
            }
        }
        
        console.log('[DEBUG] Total rows fetched:', allData.length);
        
        // Log all unique market_type values to understand the data
        const allMarketTypes = new Set(allData.map(r => r.market_type).filter(Boolean));
        console.log('[DEBUG] All unique market_type values:', [...allMarketTypes]);
        
        // Group by commodity and collect market types
        const commodityMarketTypes = {};
        allData.forEach(row => {
            if (!row.commodity || !row.market_type) return;
            if (!commodityMarketTypes[row.commodity]) {
                commodityMarketTypes[row.commodity] = new Set();
            }
            // Normalize market type (check if it contains the key words)
            const mt = row.market_type.toLowerCase();
            if (mt.includes('shipping')) commodityMarketTypes[row.commodity].add('shipping');
            if (mt.includes('terminal')) commodityMarketTypes[row.commodity].add('terminal');
            if (mt.includes('retail')) commodityMarketTypes[row.commodity].add('retail');
        });
        
        // Filter to commodities with all 3 market types
        const completeCommodities = new Set();
        for (const [commodity, types] of Object.entries(commodityMarketTypes)) {
            if (types.has('shipping') && types.has('terminal') && types.has('retail')) {
                completeCommodities.add(commodity);
            }
        }
        
        console.log('[DEBUG] Commodities with complete data:', completeCommodities.size);
        console.log('[DEBUG] Complete commodities list:', [...completeCommodities].slice(0, 10));
        return completeCommodities;
        
    } catch (error) {
        console.error('Error fetching complete data commodities:', error);
        return new Set(); // Return empty set on error
    }
};

/**
 * Get commodities that have organic data available.
 * Used to filter the commodity dropdown when "organic only" toggle is enabled.
 * 
 * @returns {Set<string>} Set of commodity names with organic data
 */
export const getCommoditiesWithOrganicData = async () => {
    try {
        console.log('[DEBUG] Fetching commodities with organic data...');
        
        // Query for distinct commodities where organic = 'yes' or 'Yes' or 'Y'
        const { data, error } = await supabase
            .from('CropPrice')
            .select('commodity')
            .or('organic.eq.yes,organic.eq.Yes,organic.eq.Y');
        
        if (error) throw error;
        
        // Extract unique commodities
        const organicCommodities = new Set(
            data?.map(row => row.commodity).filter(Boolean) || []
        );
        
        console.log('[DEBUG] Commodities with organic data:', organicCommodities.size);
        console.log('[DEBUG] Organic commodities list:', [...organicCommodities].slice(0, 10));
        return organicCommodities;
        
    } catch (error) {
        console.error('Error fetching organic commodities:', error);
        return new Set(); // Return empty set on error
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
