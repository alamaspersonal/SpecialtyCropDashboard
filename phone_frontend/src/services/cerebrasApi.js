/**
 * Cerebras AI Service
 * 
 * Uses Cerebras's fast inference API to generate market insights
 * based on existing market notes.
 */

const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';
const CEREBRAS_API_KEY = process.env.EXPO_PUBLIC_CEREBRAS_API_KEY || '';

/**
 * Generate AI-powered market insights
 * 
 * @param {string} commodity - The commodity being analyzed
 * @param {Object} toneComments - Object with market, supply, and demand tone comments
 * @returns {Promise<string>} AI-generated market insights
 */
export const generateMarketInsights = async (commodity, toneComments = {}) => {
    try {
        // Build context from all tone comments
        const { market = [], supply = [], demand = [] } = toneComments;
        
        let notesContext = '';
        
        if (market.length > 0) {
            notesContext += `Market Tone:\n- ${market.join('\n- ')}\n\n`;
        }
        if (supply.length > 0) {
            notesContext += `Supply Conditions:\n- ${supply.join('\n- ')}\n\n`;
        }
        if (demand.length > 0) {
            notesContext += `Demand Conditions:\n- ${demand.join('\n- ')}\n\n`;
        }
        
        if (!notesContext) {
            notesContext = 'No specific market notes available.';
        }
        
        const prompt = `You are an agricultural market analyst. Summarize the following market report notes for ${commodity} in 2-3 sentences.

${notesContext}
Only report what is stated in the notes above. Do not forecast, predict, or synthesize additional information. Keep your response factual and concise.`;

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
        return `Market notes analysis for ${commodity} is currently unavailable.`;
    }
};

export default { generateMarketInsights };
