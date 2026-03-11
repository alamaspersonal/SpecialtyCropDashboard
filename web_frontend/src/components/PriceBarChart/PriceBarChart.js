'use client';

/**
 * PriceBarChart — Current vs prior week prices as custom horizontal bars.
 */

export default function PriceBarChart({ currentPrice, priorPrice, currentDate, priorDate }) {
    if (!currentPrice && !priorPrice) return null;

    return (
        <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Current Price */}
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
                    <h4 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">Most Recent Price</h4>
                    <p className="mb-3 text-xs text-[var(--color-text-muted)]">{currentDate || '—'}</p>
                    <PriceBar
                        label="Terminal Market"
                        high={currentPrice?.high}
                        low={currentPrice?.low}
                        color="var(--color-terminal)"
                        maxPrice={Math.max(currentPrice?.high || 0, priorPrice?.high || 0) * 1.2}
                    />
                </div>

                {/* Prior Price */}
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
                    <h4 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">Prior Week Price</h4>
                    <p className="mb-3 text-xs text-[var(--color-text-muted)]">{priorDate || 'N/A'}</p>
                    <PriceBar
                        label="Terminal Market"
                        high={priorPrice?.high}
                        low={priorPrice?.low}
                        color="var(--color-terminal)"
                        maxPrice={Math.max(currentPrice?.high || 0, priorPrice?.high || 0) * 1.2}
                    />
                </div>
            </div>
        </div>
    );
}

function PriceBar({ label, high, low, color, maxPrice }) {
    const widthPct = maxPrice && high ? `${(high / maxPrice) * 100}%` : '0%';
    const lowPct = maxPrice && low ? `${(low / maxPrice) * 100}%` : null;

    return (
        <div className="space-y-2">
            <span
                className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: color }}
            >
                {label}
            </span>
            <div className="relative h-5 overflow-hidden rounded-full bg-[var(--color-surface-elevated)]">
                <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{ width: widthPct, backgroundColor: color }}
                />
                {lowPct && (
                    <div
                        className="absolute top-0 h-full w-0.5 bg-[var(--color-text-primary)] opacity-40"
                        style={{ left: lowPct }}
                    />
                )}
            </div>
            <div className="flex gap-3 text-xs text-[var(--color-text-secondary)]">
                {high != null && <span className="font-medium">${high.toFixed(2)}</span>}
                {low != null && <span className="text-[var(--color-text-muted)]">(Low: ${low.toFixed(2)})</span>}
            </div>
        </div>
    );
}
