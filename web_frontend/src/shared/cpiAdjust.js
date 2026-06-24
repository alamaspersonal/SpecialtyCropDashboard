/**
 * cpiAdjust — CPI inflation-adjustment utilities
 *
 * Converts nominal prices to real prices denominated in CPI_BASE_VALUE dollars
 * (January 2026). Operates on BLS CPI-U All Items monthly index values.
 *
 * No React dependencies — safe to use in hooks, utilities, and tests.
 */

import { CPI_U_ALL_ITEMS, CPI_BASE_VALUE } from '../constants/cpiData';

/**
 * Look up the CPI index value for a given date.
 * Accepts 'YYYY-MM-DD', 'YYYY-MM-DDT...' (ISO), or 'YYYY-MM'.
 * Returns null if no data is available for that month.
 */
export function getCpiForDate(dateStr) {
    if (!dateStr) return null;
    const key = String(dateStr).substring(0, 7); // 'YYYY-MM'
    const value = CPI_U_ALL_ITEMS[key];
    return value !== undefined ? value : null;
}

/**
 * Adjust a nominal price to January 2026 dollars using CPI-U All Items.
 *
 * Formula: adjustedPrice = nominalPrice × (CPI_BASE_VALUE / CPI_for_period)
 *
 * If CPI data is unavailable for the given date (out-of-range or missing month),
 * the nominal price is returned unchanged — never null or NaN.
 */
export function adjustToCurrent(nominalPrice, dateStr) {
    const cpiPeriod = getCpiForDate(dateStr);
    if (cpiPeriod == null) return nominalPrice;
    return nominalPrice * (CPI_BASE_VALUE / cpiPeriod);
}
