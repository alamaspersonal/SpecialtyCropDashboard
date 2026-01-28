/**
 * Cerebras AI Service
 * 
 * Uses Cerebras's fast inference API to generate market insights
 * based on existing market notes for Shipping Point and Terminal Market.
 */

const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';
const CEREBRAS_API_KEY = process.env.EXPO_PUBLIC_CEREBRAS_API_KEY || '';

/**
 * Build context string from comments array
 */
const buildContextSection = (label, comments) => {
    if (!comments || comments.length === 0) return '';
    const uniqueComments = [...new Set(comments.filter(Boolean))];
    if (uniqueComments.length === 0) return '';
    return `${label}:\n- ${uniqueComments.join('\n- ')}\n\n`;
};

/**
 * Generate AI-powered market insights with separate sections for each market type
 * 
 * @param {string} commodity - The commodity being analyzed
 * @param {Object} shippingData - Comments from Shipping Point data
 * @param {Object} terminalData - Comments from Terminal Market data
 * @returns {Promise<string>} AI-generated market insights
 */
export const generateMarketInsights = async (commodity, shippingData = {}, terminalData = {}) => {
    try {
        // Build Shipping Point context
        let shippingContext = '';
        shippingContext += buildContextSection('Supply Conditions', shippingData.supply);
        shippingContext += buildContextSection('Demand Conditions', shippingData.demand);
        shippingContext += buildContextSection('Market Tone', shippingData.market);
        shippingContext += buildContextSection('Commodity Notes', shippingData.commodity);
        
        // Build Terminal Market context
        let terminalContext = '';
        terminalContext += buildContextSection('Offerings', terminalData.offerings);
        terminalContext += buildContextSection('Reporter Notes', terminalData.reporter);
        terminalContext += buildContextSection('Market Tone', terminalData.market);
        terminalContext += buildContextSection('Commodity Notes', terminalData.commodity);

        // Check if we have any context at all
        const hasShippingContext = shippingContext.trim().length > 0;
        const hasTerminalContext = terminalContext.trim().length > 0;
        
        if (!hasShippingContext && !hasTerminalContext) {
            return `No market notes available for ${commodity} at this time.`;
        }

        const prompt = `You are an agricultural market analyst. Provide a brief market summary for ${commodity} based on the following report notes.

${hasShippingContext ? `## SHIPPING POINT DATA
${shippingContext}` : ''}
${hasTerminalContext ? `## TERMINAL MARKET DATA
${terminalContext}` : ''}
Respond with TWO short paragraphs (2-3 sentences each):
1. **Shipping Point Summary:** Summarize shipping point conditions (supply, demand, pricing trends)
2. **Terminal Market Summary:** Summarize terminal market conditions (offerings, quality, availability)

If data for a section is missing, state that briefly. Only report what is stated in the notes. Do not forecast or synthesize additional information.`;

        const response = await fetch(CEREBRAS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama3.1-8b',
                messages: [
                    { role: 'system', content: 'You are a concise agricultural market analyst providing factual market summaries.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300,
                temperature: 0.5,
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
        return `Market analysis for ${commodity} is currently unavailable.`;
    }
};

export default { generateMarketInsights };
