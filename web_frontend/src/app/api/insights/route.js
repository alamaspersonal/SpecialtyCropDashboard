/**
 * Cerebras AI API Route — Server-side proxy
 *
 * Keeps the API key secret (never exposed to client).
 * POST /api/insights
 */

export async function POST(request) {
    const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';
    const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

    if (!CEREBRAS_API_KEY) {
        return Response.json(
            { error: 'Cerebras API key not configured' },
            { status: 500 }
        );
    }

    try {
        const { commodity, shippingData, terminalData, dateInfo, filterContext } = await request.json();

        // Build context sections
        const buildContext = (label, comments) => {
            if (!comments || comments.length === 0) return '';
            const unique = [...new Set(comments.filter(Boolean))];
            if (unique.length === 0) return '';
            return `${label}:\n- ${unique.join('\n- ')}\n\n`;
        };

        let shippingContext = '';
        shippingContext += buildContext('Supply Conditions', shippingData?.supply);
        shippingContext += buildContext('Demand Conditions', shippingData?.demand);
        shippingContext += buildContext('Market Tone', shippingData?.market);
        shippingContext += buildContext('Commodity Notes', shippingData?.commodity);

        let terminalContext = '';
        terminalContext += buildContext('Offerings', terminalData?.offerings);
        terminalContext += buildContext('Reporter Notes', terminalData?.reporter);
        terminalContext += buildContext('Market Tone', terminalData?.market);
        terminalContext += buildContext('Commodity Notes', terminalData?.commodity);

        const hasShipping = shippingContext.trim().length > 0;
        const hasTerminal = terminalContext.trim().length > 0;

        if (!hasShipping && !hasTerminal) {
            return Response.json({
                insight: `No market notes available for ${commodity} at this time.`,
            });
        }

        // Format dates
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            if (isNaN(d)) return dateStr;
            return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        };

        let shippingDateStr = '';
        let terminalDateStr = '';
        if (dateInfo) {
            if (dateInfo.shipping) shippingDateStr = formatDate(dateInfo.shipping.end || dateInfo.shipping.start);
            if (dateInfo.terminal) terminalDateStr = formatDate(dateInfo.terminal.end || dateInfo.terminal.start);
        }

        let filterStr = '';
        if (filterContext) {
            const parts = [];
            if (filterContext.variety) parts.push(`Variety: ${filterContext.variety}`);
            if (filterContext.organic) parts.push('Organic only');
            if (filterContext.origin) parts.push(`Origin: ${filterContext.origin}`);
            if (filterContext.package) parts.push(`Package: ${filterContext.package}`);
            if (parts.length > 0) filterStr = `\n\nACTIVE FILTERS: ${parts.join(' | ')}`;
        }

        const prompt = `You are an agricultural market analyst. Provide a brief market summary for ${commodity} based on the following report notes.${filterStr}

${hasShipping ? `## SHIPPING POINT DATA\n${shippingContext}` : ''}
${hasTerminal ? `## TERMINAL MARKET DATA\n${terminalContext}` : ''}
Respond with TWO short paragraphs (2-3 sentences each) using EXACTLY these headers:
1. **Terminal Market Insights from ${terminalDateStr || 'latest report'}:** Summarize terminal market conditions (offerings, quality, availability)
2. **Shipping Point Insights from ${shippingDateStr || 'latest report'}:** Summarize shipping point conditions (supply, demand, pricing trends)

If data for a section is missing, still include the header and state that data is not available. Only report what is stated in the notes. Do not forecast or synthesize additional information.`;

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
                    { role: 'user', content: prompt },
                ],
                max_tokens: 300,
                temperature: 0.5,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Cerebras] API Error:', response.status, errorText);
            return Response.json({ error: 'AI service error' }, { status: 502 });
        }

        const data = await response.json();
        const insight = data.choices?.[0]?.message?.content?.trim();

        if (!insight) {
            return Response.json({ error: 'No insight generated' }, { status: 502 });
        }

        return Response.json({ insight });
    } catch (error) {
        console.error('[Cerebras] Error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
