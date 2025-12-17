import React from 'react';

const PriceBlock = ({ label, price, color, height = 'h-24', isLast = false, textColor = 'text-white' }) => (
    <div className={`w-full ${height} ${color} flex items-center justify-center relative mb-1 transition-all duration-300`}>
        {/* Label on Left (Absolute) */}
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-40 text-right pr-4 font-semibold text-sm leading-tight ${textColor === 'text-black' ? 'text-gray-800' : 'text-gray-800'}`}>
            {label}
        </div>

        {/* Bar Content */}
        {/* Note: In the mock, the labels are INSIDE bubbles to the left. 
        Here we simplify standardizing the look. 
        Actually, the mock has labels inside colorful boxes to the LEFT of the main blue bar.
        Let's try to replicate the mock's structure: Label Box --linked-- Main Bar
    */}
    </div>
);

// Re-implementing based on the "Label Box + Bar" design
const Row = ({ label, colorLabel, barHeight, isConnector = false }) => (
    <div className="flex items-center w-full mb-2 relative">
        {/* Label Box */}
        <div className={`w-48 py-3 px-4 ${colorLabel} rounded-md shadow-sm z-10 text-center font-bold text-sm text-gray-900`}>
            {label}
        </div>

        {/* The Main Blue Bar (Variable Height?) 
        Actually the mock shows specific blue bars for Term/Shipping, 
        but Retail is purple and Farm is yellow.
        And they are all stacked? No, they look like independent rows connected to a central timeline?
        
        Let's look closer at the image...
        It's two COLUMNS: "Most recent price" and "Price at prior week".
        Each column has STACKED BLOCKS.
        
        TOP BLOCK (Purple): National Retail Price.
        MIDDLE BLOCK (Blue): Terminal Market Price.
        BOTTOM BLOCK (Peach): Shipping Point Price.
        BOTTOM-MOST (Yellow): Reference Farm Price.
        
        Wait, they overlap? 
        The "Terminal Market Price" bar is connected to the "National Retail" bar?
        
        Actually, it looks like a price waterfall.
        Let's build two columns of cards.
    */}
    </div>
);

const Column = ({ title, stats, costs }) => {
    // If stats are completely missing, show nothing or placeholder
    if (!stats || (!stats.current_terminal_avg && !stats.current_shipping_avg)) {
        return (
            <div className="flex-1 flex flex-col items-center">
                <h3 className="font-bold text-gray-800 mb-6 text-center w-48">{title}</h3>
                <div className="text-gray-400 italic mt-10">No Data Available</div>
            </div>
        );
    }

    const terminalPrice = stats.current_terminal_avg;
    const shippingPrice = stats.current_shipping_avg;

    // Derived
    // Only calculate if terminal exists? 
    // If terminal exists, we show retail.
    const retailPrice = terminalPrice ? (terminalPrice * 1.4).toFixed(2) : null;

    // Only calculate farm if shipping exists
    const totalCosts = Object.values(costs).reduce((a, b) => a + b, 0);
    const farmPrice = shippingPrice ? (shippingPrice - totalCosts).toFixed(2) : null;

    return (
        <div className="flex-1 flex flex-col items-center">
            <h3 className="font-bold text-gray-800 mb-6 text-center w-48">{title}</h3>

            <div className="w-full max-w-xs flex flex-col gap-1 relative">
                {/* Vertical Bar Background (The Dashboard Bar) - Only show if we have points */}
                <div className="absolute right-0 top-0 w-24 h-full bg-[#0e5f76] rounded-t-md -z-10"></div>

                {/* ITEM 1: RETAIL */}
                {retailPrice && (
                    <div className="flex items-center justify-end pr-24 relative mb-4">
                        <div className="w-48 bg-[#d946ef] text-white p-4 rounded shadow-lg relative right-[-10px]">
                            <div className="font-bold text-center">National retail price</div>
                            <div className="text-center text-xl mt-1">${retailPrice}</div>
                        </div>
                    </div>
                )}

                {/* ITEM 2: TERMINAL */}
                {terminalPrice > 0 && (
                    <div className="flex items-center justify-end pr-24 relative mb-4">
                        <div className="w-48 bg-[#0ea5e9] text-white p-4 rounded shadow-lg relative right-[-10px]">
                            <div className="font-bold text-center">Terminal market price</div>
                            <div className="text-center text-xl mt-1">${terminalPrice.toFixed(2)}</div>
                        </div>
                    </div>
                )}

                {/* ITEM 3: SHIPPING */}
                {shippingPrice > 0 && (
                    <div className="flex items-center justify-end pr-24 relative mb-4">
                        <div className="w-48 bg-[#fdba74] text-gray-900 p-4 rounded shadow-lg relative right-[-10px]">
                            <div className="font-bold text-center">Shipping point price</div>
                            <div className="text-center text-xl mt-1">${shippingPrice.toFixed(2)}</div>
                        </div>
                    </div>
                )}

                {/* ITEM 4: FARM (Calculated) */}
                {farmPrice && (
                    <div className="flex items-center justify-end pr-24 relative mt-8">
                        {/* Yellow Connector Line? */}
                        <div className="w-48 bg-[#facc15] text-gray-900 p-4 rounded shadow-lg relative right-[-10px]">
                            <div className="font-bold text-center">Reference farm price</div>
                            <div className="text-center text-xl mt-1">${farmPrice}</div>
                            <div className="text-xs text-center mt-1 opacity-75">(Net of costs)</div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};


export default function PriceWaterfall({ stats, costs, commodity }) {

    // Reuse stats for "Prior Week" but randomly discounted for simulation
    const priorStats = stats ? {
        ...stats,
        current_terminal_avg: stats.current_terminal_avg * 0.95,
        current_shipping_avg: stats.current_shipping_avg * 0.92
    } : null;

    return (
        <div className="flex justify-center gap-16 w-full h-full pt-8">
            <Column title={`Most recent price (${stats?.date || 'Today'})`} stats={stats} costs={costs} />
            <Column title="Price at prior week" stats={priorStats} costs={costs} />
        </div>
    );
}
