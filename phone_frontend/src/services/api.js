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
    getUnifiedPrices,
    getStats,
    getPriceSummary
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

// Legacy axios instance - kept for any code that might still use it
// Can be removed once fully migrated to Supabase
import axios from 'axios';

const API_URL = 'http://169.233.132.123:8000';

export const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
});
