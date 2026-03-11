/**
 * Cerebras AI Client — Calls the server-side API route
 *
 * Unlike the mobile version which calls Cerebras directly,
 * the web version proxies through /api/insights to keep the key secret.
 */

export const generateMarketInsights = async (
    commodity,
    shippingData = {},
    terminalData = {},
    dateInfo = null,
    filterContext = null
) => {
    try {
        const response = await fetch('/api/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commodity,
                shippingData,
                terminalData,
                dateInfo,
                filterContext,
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        return data.insight;
    } catch (error) {
        console.error('[AI Insights] Error:', error);
        return `Market analysis for ${commodity} is currently unavailable.`;
    }
};

export default { generateMarketInsights };
