import React, { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-4 border border-gray-200 shadow-lg rounded-lg">
                <p className="text-gray-600 font-medium mb-2">{new Date(label).toLocaleDateString()}</p>
                {payload.map((p) => (
                    <div key={p.dataKey} className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-sm font-semibold" style={{ color: p.color }}>
                            {p.name}: ${p.value?.toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function MarketChart({ data }) {
    // Transform data for Recharts: Group by date
    // { date: "YYYY-MM-DD", terminal: 12.5, shipping: 10.2 }
    const chartData = useMemo(() => {
        if (!data) return [];

        const combined = {};

        data.forEach(item => {
            const dateKey = item.report_date.split('T')[0]; // Simplify ISO date
            if (!combined[dateKey]) {
                combined[dateKey] = { date: dateKey };
            }

            const price = item.price_avg;
            if (item.market_type === 'Terminal') {
                combined[dateKey].terminal = price;
            } else if (item.market_type === 'Shipping Point') {
                combined[dateKey].shipping = price;
            }
        });

        return Object.values(combined).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [data]);

    return (
        <div className="h-[400px] w-full bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Price Trend: Terminal vs. Shipping Point</h3>

            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(str) => new Date(str).toLocaleDateString()}
                        stroke="#9ca3af"
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis
                        stroke="#9ca3af"
                        tickFormatter={(val) => `$${val}`}
                        tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />

                    <Line
                        type="monotone"
                        dataKey="terminal"
                        name="Terminal Market (Wholesale)"
                        stroke="#0ea5e9" // Blue-500
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6 }}
                        connectNulls
                    />
                    <Line
                        type="monotone"
                        dataKey="shipping"
                        name="Shipping Point (Farm Gate)"
                        stroke="#f97316" // Orange-500
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6 }}
                        connectNulls
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
