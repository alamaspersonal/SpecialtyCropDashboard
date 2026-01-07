import React from 'react';
import { ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, Activity } from 'lucide-react';

export default function KPIScorecard({ stats }) {
    if (!stats) return null;

    const { current_terminal_avg, current_shipping_avg, spread, date } = stats;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Metric 1: Terminal Price */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Terminal Market Avg</p>
                    <h2 className="text-3xl font-bold text-gray-900">${current_terminal_avg || '0.00'}</h2>
                    <p className="text-xs text-gray-400 mt-2">Wholesale Price • {date}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
            </div>

            {/* Metric 2: Shipping Point Price */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Shipping Point Avg</p>
                    <h2 className="text-3xl font-bold text-gray-900">${current_shipping_avg || '0.00'}</h2>
                    <p className="text-xs text-gray-400 mt-2">Farm Gate Price • {date}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
            </div>

            {/* Metric 3: Price Spread */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Price Spread</p>
                    <h2 className="text-3xl font-bold text-emerald-600">${spread || '0.00'}</h2>
                    <div className="flex items-center mt-2 gap-1">
                        <span className="text-xs text-gray-400">Difference (Wholesale - Farm)</span>
                    </div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg">
                    <Activity className="w-6 h-6 text-emerald-600" />
                </div>
            </div>
        </div>
    );
}
