/**
 * API Service Layer
 * 
 * This module now uses Supabase directly instead of the FastAPI backend.
 * Maintains backward compatibility with existing function signatures.
 * 
 * For React components, prefer using the hooks from useQueries.js for
 * automatic caching, loading states, and offline support.
 */

// Re-export Supabase API functions for backward compatibility
export {
    getFilters,
    getPrices,
    getDateRange,
    getPricesByDateRange,
    getUnifiedPrices,
    getStats,
    getPriceSummary,
    getCommoditiesWithCompleteData,
    getCommoditiesWithOrganicData,
    getTimeSeriesData
} from './supabaseApi';

// Re-export hooks for new components
export {
    useFilters,
    usePrices,
    useUnifiedPrices,
    useStats,
    usePriceSummary,
    usePrefetchData,
} from './useQueries';

