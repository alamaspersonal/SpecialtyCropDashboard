'use client';

/**
 * PriceWaterfall — Three market-type price blocks (Terminal, Shipping, Retail)
 * with per-market sub-filters for package, origin, and district.
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import FilterDropdown from '../FilterDropdown/FilterDropdown';

function PriceBlock({
    label,
    avgPrice,
    bg,
    zIndex,
    packageOptions,
    selectedPackage,
    onPackageChange,
    originOptions,
    selectedOrigin,
    onOriginChange,
    districtOptions,
    selectedDistrict,
    onDistrictChange,
    weightLbs,
    units,
    dateRange,
    reportCount,
}) {
    const formatPrice = (val) => {
        if (val == null || isNaN(val)) return '—';
        return `$${Number(val).toFixed(2)}`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div 
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)] relative"
            style={{ zIndex }}
        >
            {/* Colored Header */}
            <div className="rounded-t-[calc(1rem-1px)] px-4 py-2.5" style={{ backgroundColor: bg }}>
                <span className="text-sm font-semibold text-white">{label}</span>
            </div>

            <div className="p-4 space-y-3">
                {/* Price */}
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[var(--color-text-primary)]">{formatPrice(avgPrice)}</span>
                    {weightLbs && (
                        <span className="text-xs text-[var(--color-text-muted)]">/ {weightLbs} lbs</span>
                    )}
                    {units && !weightLbs && (
                        <span className="text-xs text-[var(--color-text-muted)]">/ {units} ct</span>
                    )}
                </div>

                {/* Date Range */}
                {dateRange && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                        {formatDate(dateRange.start)} — {formatDate(dateRange.end)}
                        {reportCount > 0 && (
                            <span className="ml-1 font-medium text-[var(--color-text-secondary)]">· {reportCount} reports</span>
                        )}
                    </p>
                )}

                {/* Sub-Filters */}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {packageOptions && packageOptions.length > 0 && (
                        <FilterDropdown label="Package" options={packageOptions} value={selectedPackage} onChange={onPackageChange} color={bg} />
                    )}
                    {originOptions && originOptions.length > 0 && (
                        <FilterDropdown label="Origin" options={originOptions} value={selectedOrigin} onChange={onOriginChange} color={bg} />
                    )}
                    {districtOptions && districtOptions.length > 0 && (
                        <FilterDropdown label="District" options={districtOptions} value={selectedDistrict} onChange={onDistrictChange} color={bg} />
                    )}
                </div>
            </div>
        </div>
    );
}

export default function PriceWaterfall({
    stats,
    costs,
    packageData,
    actions,
    weightData,
    originData,
    districtData,
    dateRanges,
    reportCounts,
}) {
    const blocks = [
        { key: 'terminal', label: 'Terminal Market', bg: 'var(--color-terminal)', price: stats?.terminal },
        { key: 'shipping', label: 'Shipping Point', bg: 'var(--color-shipping)', price: stats?.shipping },
        { key: 'retail', label: 'National Retail', bg: 'var(--color-retail)', price: stats?.retail },
    ];

    const chartData = blocks
        .filter((b) => b.price != null && !isNaN(b.price))
        .map((b) => ({ name: b.label, price: Number(b.price), fill: b.bg }));

    const chartColors = ['var(--color-terminal)', 'var(--color-shipping)', 'var(--color-retail)'];

    return (
        <div className="space-y-6">
            {/* Summary Bar Chart */}
            {chartData.length > 0 && (
                <div>
                    <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">Price Comparison</h3>
                    <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(2)}`} fontSize={12} />
                                <YAxis type="category" dataKey="name" width={120} fontSize={12} />
                                <Tooltip
                                    formatter={(value) => [`$${value.toFixed(2)}`, 'Avg Price']}
                                    contentStyle={{
                                        background: 'var(--color-surface)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '12px',
                                        fontSize: '13px',
                                        boxShadow: 'var(--shadow-dropdown)',
                                    }}
                                />
                                <Bar dataKey="price" radius={[0, 6, 6, 0]} barSize={32}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={index} fill={chartColors[index]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Price Blocks */}
            <div className="grid gap-4 md:grid-cols-3">
                {blocks.map((b, idx) => (
                    <PriceBlock
                        key={b.key}
                        label={b.label}
                        avgPrice={b.price}
                        bg={b.bg}
                        zIndex={20 - idx}
                        packageOptions={packageData?.[b.key]?.options}
                        selectedPackage={packageData?.[b.key]?.selected}
                        onPackageChange={(val) => actions?.setPackage?.(b.key, val)}
                        originOptions={originData?.[b.key]?.options}
                        selectedOrigin={originData?.[b.key]?.selected}
                        onOriginChange={(val) => actions?.setOrigin?.(b.key, val)}
                        districtOptions={districtData?.[b.key]?.options}
                        selectedDistrict={districtData?.[b.key]?.selected}
                        onDistrictChange={(val) => actions?.setDistrict?.(b.key, val)}
                        weightLbs={weightData?.[b.key]?.weight_lbs}
                        units={weightData?.[b.key]?.units}
                        dateRange={dateRanges?.[b.key]}
                        reportCount={reportCounts?.[b.key]}
                    />
                ))}
            </div>
        </div>
    );
}
