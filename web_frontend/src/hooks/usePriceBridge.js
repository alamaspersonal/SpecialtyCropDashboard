/**
 * usePriceBridge — React Hook for Period A vs. Period B comparison
 *
 * Fetches data for two date ranges in parallel, then runs the
 * shared priceBridge engine to produce bridge objects for each market type.
 *
 * @param {Object}  filters    - Top-level filters { commodity, category, ... }
 * @param {Date}    startA     - Period A start date
 * @param {Date}    endA       - Period A end date
 * @param {Date}    startB     - Period B start date
 * @param {Date}    endB       - Period B end date
 * @param {Object}  options    - { organicOnly, selectedVariety }
 * @returns {Object} { bridges, loading, error }
 */

import { useState, useEffect, useCallback } from 'react';
import { getPricesByDateRange } from '../services/supabaseApi';
import { computeAllBridges } from '../shared/priceBridge';

export default function usePriceBridge(filters, startA, endA, startB, endB, options = {}) {
    const { organicOnly = false, selectedVariety = '' } = options;

    const [bridges, setBridges] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchAndCompute = useCallback(async () => {
        if (!filters?.commodity || !startA || !endA || !startB || !endB) {
            setBridges(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Build API filters (strip non-API fields)
            const apiFilters = { ...filters };
            delete apiFilters.date;
            delete apiFilters.package;
            delete apiFilters.variety;

            // Parallel fetch
            const isoA = [toISO(startA), toISO(endA)];
            const isoB = [toISO(startB), toISO(endB)];

            const [dataA, dataB] = await Promise.all([
                getPricesByDateRange(apiFilters, isoA[0], isoA[1]),
                getPricesByDateRange(apiFilters, isoB[0], isoB[1]),
            ]);

            // Apply local filters
            let filteredA = dataA;
            let filteredB = dataB;

            if (organicOnly) {
                filteredA = filteredA.filter(d => d.organic === 'yes');
                filteredB = filteredB.filter(d => d.organic === 'yes');
            }
            if (selectedVariety) {
                filteredA = filteredA.filter(d => d.variety === selectedVariety);
                filteredB = filteredB.filter(d => d.variety === selectedVariety);
            }

            // Compute bridges
            const result = computeAllBridges(filteredA, filteredB);
            setBridges(result);
        } catch (err) {
            console.error('[usePriceBridge] Error:', err);
            setError(err);
            setBridges(null);
        } finally {
            setLoading(false);
        }
    }, [
        JSON.stringify(filters),
        startA?.toISOString(), endA?.toISOString(),
        startB?.toISOString(), endB?.toISOString(),
        organicOnly, selectedVariety,
    ]);

    useEffect(() => {
        fetchAndCompute();
    }, [fetchAndCompute]);

    return { bridges, loading, error };
}

function toISO(date) {
    if (!date) return '';
    if (typeof date === 'string') return date;
    return date.toISOString().split('T')[0];
}
