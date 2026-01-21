/**
 * Cerebras AI Service
 * 
 * Uses Cerebras's fast inference API to generate market insights
 * based on price data and existing market notes.
 */

const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';
const CEREBRAS_API_KEY = process.env.EXPO_PUBLIC_CEREBRAS_API_KEY || '';

/**
 * Generate AI-powered market insights
 * 
 * @param {string} commodity - The commodity being analyzed
 * @param {Object} priceStats - Object containing price statistics
 * @param {Array} marketNotes - Array of existing market notes from DB
 * @returns {Promise<string>} AI-generated market insights
 */
export const generateMarketInsights = async (commodity, priceStats, marketNotes = []) => {
    try {
        // Build context from price stats
        const priceContext = buildPriceContext(priceStats);
        
        // Build context from existing market notes
        const notesContext = marketNotes.length > 0 
            ? `Existing market notes from reports: "${marketNotes.slice(0, 3).join('; ')}"` 
            : 'No specific market notes available from reports.';
        
        const prompt = `You are an agricultural market analyst. Based on the following data for ${commodity}, provide a brief, insightful market summary (2-3 sentences max).

${priceContext}

${notesContext}

Focus on:
1. Price trend direction (up/down/stable)
2. Supply/demand implications
3. Brief outlook

Keep your response concise and professional. Do not use bullet points.`;

        const response = await fetch(CEREBRAS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama3.1-8b',
                messages: [
                    { role: 'system', content: 'You are a concise agricultural market analyst.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 150,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Cerebras] API Error:', response.status, errorText);
            throw new Error(`Cerebras API error: ${response.status}`);
        }

        const data = await response.json();
        const insight = data.choices?.[0]?.message?.content?.trim();
        
        if (!insight) {
            throw new Error('No insight generated');
        }

        return insight;

    } catch (error) {
        console.error('[Cerebras] Error generating insights:', error);
        // Return a fallback message
        return `Market analysis for ${commodity} is currently unavailable. Based on available data, supply and demand conditions appear stable.`;
    }
};

/**
 * Build price context string from stats object
 */
const buildPriceContext = (stats) => {
    if (!stats) return 'No price data available.';

    const lines = [];
    
    if (stats.terminal?.avg > 0) {
        const trend = stats.terminal.pct_change > 0 ? 'up' : stats.terminal.pct_change < 0 ? 'down' : 'stable';
        lines.push(`Terminal market: $${stats.terminal.avg.toFixed(2)} avg (${trend} ${Math.abs(stats.terminal.pct_change || 0).toFixed(1)}% this week)`);
    }
    
    if (stats.shipping?.avg > 0) {
        const trend = stats.shipping.pct_change > 0 ? 'up' : stats.shipping.pct_change < 0 ? 'down' : 'stable';
        lines.push(`Shipping point: $${stats.shipping.avg.toFixed(2)} avg (${trend} ${Math.abs(stats.shipping.pct_change || 0).toFixed(1)}% this week)`);
    }
    
    if (stats.retail?.avg > 0) {
        const trend = stats.retail.pct_change > 0 ? 'up' : stats.retail.pct_change < 0 ? 'down' : 'stable';
        lines.push(`Retail: $${stats.retail.avg.toFixed(2)} avg (${trend} ${Math.abs(stats.retail.pct_change || 0).toFixed(1)}% this week)`);
    }

    if (stats.spread) {
        lines.push(`Terminal-Shipping spread: $${stats.spread.toFixed(2)}`);
    }

    return lines.length > 0 
        ? `Price data from past month:\n${lines.join('\n')}`
        : 'Limited price data available.';
};

export default { generateMarketInsights };
