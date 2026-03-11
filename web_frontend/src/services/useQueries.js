/**
 * React Query Hooks for Crop Price Data
 * 
 * Provides caching, background refetching, and offline support via TanStack Query.
 * Data is cached locally and persisted for offline access.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFilters, getPrices, getUnifiedPrices, getStats, getPriceSummary } from './supabaseApi';

// Cache configuration
const STALE_TIME = 5 * 60 * 1000; // 5 minutes - data is fresh
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes - keep in cache

/**
 * Hook to fetch filter options
 * @param {Object} currentFilters - Currently selected filters
 */
export const useFilters = (currentFilters = {}) => {
    return useQuery({
        queryKey: ['filters', currentFilters],
        queryFn: () => getFilters(currentFilters),
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
    });
};

/**
 * Hook to fetch prices with filters
 * @param {Object} filters - Filter criteria
 * @param {number} limit - Maximum results
 * @param {number} days - Days to look back
 */
export const usePrices = (filters = {}, limit = 100, days = null) => {
    return useQuery({
        queryKey: ['prices', filters, limit, days],
        queryFn: () => getPrices(filters, limit, days),
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
        enabled: !!filters.commodity, // Only fetch when commodity is selected
    });
};

/**
 * Hook to fetch unified prices for charts
 * @param {string} commodity - Required commodity
 * @param {Object} options - Additional filter options
 */
export const useUnifiedPrices = (commodity, options = {}) => {
    return useQuery({
        queryKey: ['unifiedPrices', commodity, options],
        queryFn: () => getUnifiedPrices(commodity, options),
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
        enabled: !!commodity,
    });
};

/**
 * Hook to fetch KPI statistics
 * @param {string} commodity - Commodity to get stats for
 */
export const useStats = (commodity) => {
    return useQuery({
        queryKey: ['stats', commodity],
        queryFn: () => getStats(commodity),
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
        enabled: !!commodity,
    });
};

/**
 * Hook to fetch price summary
 * @param {Object} options - Filter options
 */
export const usePriceSummary = (options = {}) => {
    return useQuery({
        queryKey: ['priceSummary', options],
        queryFn: () => getPriceSummary(options),
        staleTime: STALE_TIME,
        gcTime: CACHE_TIME,
    });
};

/**
 * Hook to prefetch data for offline use
 * Call this when user has internet to cache data for later
 */
export const usePrefetchData = () => {
    const queryClient = useQueryClient();

    const prefetchForCommodity = async (commodity) => {
        await queryClient.prefetchQuery({
            queryKey: ['prices', { commodity }, 500, 30],
            queryFn: () => getPrices({ commodity }, 500, 30),
        });
        await queryClient.prefetchQuery({
            queryKey: ['stats', commodity],
            queryFn: () => getStats(commodity),
        });
    };

    return { prefetchForCommodity };
};
