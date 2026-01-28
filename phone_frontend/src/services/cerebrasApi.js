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
 * @param {Array} marketNotes - Array of existing market notes from DB
 * @returns {Promise<string>} AI-generated market insights
 */
export const generateMarketInsights = async (commodity, marketNotes = []) => {
    try {
        // Build context from existing market notes
        const notesContext = marketNotes.length > 0 
            ? `Market notes from recent reports:\n- ${marketNotes.slice(0, 5).join('\n- ')}` 
            : 'No specific market notes available.';
        
        const prompt = `You are an agricultural market analyst. Read the following market report notes for ${commodity} and provide a concise summary of findings (2-3 sentences max).

${notesContext}

Focus on synthesizing the provided notes into a clear market overview.
Keep your response concise, professional, and directly based on the notes. Avoid generic advice.`;

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
