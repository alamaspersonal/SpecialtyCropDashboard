/**
 * API entry point for screens and hooks.
 *
 * Re-exports the Supabase query functions the app uses (see supabaseApi.js).
 * Tests mock this module to stub the network layer.
 */
export {
    getFilters,
    getDateRange,
    getPricesByDateRange,
    getStats,
    getTimeSeriesWindow,
    countPricesByDateRange,
    getMonthlyPriceRollup,
} from './supabaseApi';
