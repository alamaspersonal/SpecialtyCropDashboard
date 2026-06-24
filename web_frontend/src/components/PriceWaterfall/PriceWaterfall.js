'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import FilterDropdown from '../FilterDropdown/FilterDropdown';

function BreakdownSection({ title, items, bg }) {
    if (!items || items.length === 0) return null;

    return (
        <div className="pt-2 border-t border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide">{title}</p>
            <div className="space-y-2">
                {items.map((item) => {
                    const displayPrice = item.pricePerUnit
                        ? `$${item.pricePerUnit.value}/${item.pricePerUnit.unit}`
                        : `$${Number(item.avgPrice).toFixed(2)}`;
                    return (
                        <div key={item.name} className="space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                                <span
                                    className="text-xs text-[var(--color-text-secondary)] truncate min-w-0 flex-1"
                                    title={item.name}
                                >
                                    {item.name}
                                </span>
                                <span className="text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                                    {displayPrice}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                                    {item.count}
                                </span>
                            </div>
                            <div className="h-1 w-full rounded-full bg-[var(--color-surface-elevated)]">
                                <div
                                    className="h-1 rounded-full opacity-50 transition-all duration-500"
                                    style={{ width: `${Math.max(item.pct * 100, 3)}%`, backgroundColor: bg }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PriceBlock({
    label,
    avgPrice,
    pricePerLb,
    pricePerUnit,
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
    breakdownByPackage,
    breakdownByOrigin,
    breakdownByDistrict,
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

    const priceValue = avgPrice != null && !isNaN(avgPrice) ? Number(avgPrice) : null;

    // Headline is the backend-computed price/lb and/or price/unit (averaged per row,
    // so it stays comparable across mixed packages). Which one(s) show is driven by
    // the package: weight packages -> /lb, count packages -> /unit, both -> both.
    // Falls back to deriving from the selected package weight for any rows the
    // backfill hasn't reached yet.
    const perLb = (pricePerLb != null && !isNaN(pricePerLb)) ? Number(pricePerLb)
        : (priceValue != null && weightLbs > 0 ? priceValue / weightLbs : null);
    const perUnit = (pricePerUnit != null && !isNaN(pricePerUnit)) ? Number(pricePerUnit)
        : (priceValue != null && units > 0 ? priceValue / units : null);
    const normalized = [];
    if (perLb != null) normalized.push({ value: perLb.toFixed(2), unit: 'lb' });
    if (perUnit != null) normalized.push({ value: perUnit.toFixed(2), unit: 'unit' });

    // Apply selected package weight to origin/district breakdowns
    const applyWeightToBreakdown = (items) => {
        if (!items || items.length === 0) return items;
        if (!(weightLbs > 0) && !(units > 0)) return items;
        return items.map(item => ({
            ...item,
            pricePerUnit: weightLbs > 0
                ? { value: (item.avgPrice / weightLbs).toFixed(2), unit: 'lb' }
                : { value: (item.avgPrice / units).toFixed(2), unit: 'unit' },
        }));
    };

    const enrichedOriginBreakdown = applyWeightToBreakdown(breakdownByOrigin);
    const enrichedDistrictBreakdown = applyWeightToBreakdown(breakdownByDistrict);

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
                {/* Price — per lb and/or per unit, with avg package price underneath */}
                <div>
                    {normalized.length > 0 ? (
                        <>
                            <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                                {normalized.length > 1
                                    ? 'Price / lb · unit'
                                    : `Price / ${normalized[0].unit}`}
                            </p>
                            <div className="flex items-baseline gap-3 flex-wrap">
                                {normalized.map((n) => (
                                    <span key={n.unit} className="text-2xl font-bold text-[var(--color-text-primary)]">
                                        ${n.value}
                                        <span className="text-sm font-semibold text-[var(--color-text-muted)]">/{n.unit}</span>
                                    </span>
                                ))}
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                {formatPrice(avgPrice)} avg package price
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Avg Package Price</p>
                            <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                                {formatPrice(avgPrice)}
                            </span>
                        </>
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

                {/* Price Breakdowns */}
                {breakdownByPackage?.length > 1 && (
                    <BreakdownSection title="By Package" items={breakdownByPackage} bg={bg} />
                )}
                {enrichedOriginBreakdown?.length > 1 && (
                    <BreakdownSection title="By Origin" items={enrichedOriginBreakdown} bg={bg} />
                )}
                {enrichedDistrictBreakdown?.length > 1 && (
                    <BreakdownSection title="By District" items={enrichedDistrictBreakdown} bg={bg} />
                )}
            </div>
        </div>
    );
}

export default function PriceWaterfall({
    stats,
    normalizedData,
    costs,
    packageData,
    actions,
    weightData,
    originData,
    districtData,
    dateRanges,
    reportCounts,
    breakdownData,
}) {
    // Order: Shipping first (left-most card / bottom bar), then Terminal, then Retail.
    const blocks = [
        { key: 'shipping', label: 'Shipping Point', bg: 'var(--color-shipping)', price: stats?.shipping },
        { key: 'terminal', label: 'Terminal Market', bg: 'var(--color-terminal)', price: stats?.terminal },
        { key: 'retail', label: 'National Retail', bg: 'var(--color-retail)', price: stats?.retail },
    ];

    // Pick the primary normalized basis for each market: $/lb if available, else
    // $/unit, else fall back to the avg package price. The unit is shown per-bar so
    // a $/lb bar is never silently compared against a $/unit bar.
    const normPrimary = (key) => {
        const n = normalizedData?.[key];
        if (n?.pricePerLb != null && !isNaN(n.pricePerLb)) return { value: Number(n.pricePerLb), unit: 'lb' };
        if (n?.pricePerUnit != null && !isNaN(n.pricePerUnit)) return { value: Number(n.pricePerUnit), unit: 'unit' };
        const pkg = stats?.[key];
        return pkg != null && !isNaN(pkg) ? { value: Number(pkg), unit: 'pkg' } : null;
    };

    // Horizontal bars render the first row at the TOP, so reverse the block order
    // for the chart: Retail on top, Terminal in the middle, Shipping at the bottom.
    const chartData = [...blocks]
        .reverse()
        .map((b) => ({ block: b, norm: normPrimary(b.key) }))
        .filter((d) => d.norm != null)
        .map((d) => ({
            name: `${d.block.label} ($/${d.norm.unit})`,
            price: d.norm.value,
            unit: d.norm.unit,
            fill: d.block.bg,
        }));

    return (
        <div className="space-y-6">
            {/* Summary Bar Chart */}
            {chartData.length > 0 && (
                <div>
                    <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">Price Comparison (Price / lb or unit)</h3>
                    <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <XAxis
                                    type="number"
                                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                                    tick={{ fill: 'var(--chart-axis-text)', fontSize: 12 }}
                                    axisLine={{ stroke: 'var(--chart-grid-line)' }}
                                    tickLine={{ stroke: 'var(--chart-grid-line)' }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={150}
                                    tick={{ fill: 'var(--chart-axis-text)', fontSize: 12 }}
                                    axisLine={{ stroke: 'var(--chart-grid-line)' }}
                                    tickLine={{ stroke: 'var(--chart-grid-line)' }}
                                />
                                <Tooltip
                                    formatter={(value, _n, item) => [`$${value.toFixed(2)} / ${item?.payload?.unit ?? 'pkg'}`, 'Price']}
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
                                        <Cell key={index} fill={entry.fill} />
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
                        pricePerLb={normalizedData?.[b.key]?.pricePerLb}
                        pricePerUnit={normalizedData?.[b.key]?.pricePerUnit}
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
                        breakdownByPackage={breakdownData?.[b.key]?.byPackage}
                        breakdownByOrigin={breakdownData?.[b.key]?.byOrigin}
                        breakdownByDistrict={breakdownData?.[b.key]?.byDistrict}
                    />
                ))}
            </div>
        </div>
    );
}
