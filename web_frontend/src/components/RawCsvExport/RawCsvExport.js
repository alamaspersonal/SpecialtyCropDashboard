'use client';

/**
 * RawCsvExport — "Export CSV" for the price-over-time chart. Downloads every
 * raw report row (all columns, all price units) behind the chart's current
 * range, filters and package, even when the chart itself shows monthly
 * averages. Large exports ask first, then show progress with Cancel.
 *
 * Renders the button plus, while active, a full-width panel — place it last in
 * a flex-wrap row so the panel drops onto its own line.
 */

import { useState, useRef, useEffect } from 'react';
import { Download, Check, X, AlertCircle } from 'lucide-react';
import { downloadRawPriceCsv } from '../../services/supabaseApi';
import { downloadBlob } from '../../utils/exportUtils';

const CONFIRM_ROWS = 20000; // ask before downloading more rows than this
const BYTES_PER_ROW = 230;  // measured 200–240 bytes per CSV row (Apples, Kiwifruit)

const slug = (s) => String(s).replace(/[^a-z0-9-]+/gi, '_').replace(/^_+|_+$/g, '');

// e.g. Apples_Gala_organic_2005-01_2026-10_raw.csv
function exportFilename(commodity, plan) {
    const f = plan.filters;
    return [commodity, f.variety, f.district, f.organic === 'yes' && 'organic', f.package, plan.from, plan.to, 'raw']
        .filter(Boolean).map(slug).join('_') + '.csv';
}

// Plan spans are YYYY-MM (monthly ranges) or YYYY-MM-DD (daily ranges), in UTC.
function fmtSpanDate(d) {
    const monthly = d.length === 7;
    return new Date(`${monthly ? `${d}-01` : d}T00:00:00Z`).toLocaleDateString('en-US', monthly
        ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
        : { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function fmtSize(bytes) {
    if (bytes < 1e6) return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
    return `${(bytes / 1e6).toFixed(bytes < 1e7 ? 1 : 0)} MB`;
}

export default function RawCsvExport({ commodity, plan, cpiAdjusted = false, disabled = false }) {
    const [status, setStatus] = useState('idle'); // idle | confirm | running | done | error
    const [progress, setProgress] = useState({ rows: 0, total: 0 });
    const [result, setResult] = useState(null);   // done: { filename, rows } · error: { message }
    const abortRef = useRef(null);

    // Stop an in-flight export if the chart goes away (e.g. switching views).
    useEffect(() => () => abortRef.current?.abort(), []);

    // The "saved" note clears itself.
    useEffect(() => {
        if (status !== 'done') return undefined;
        const t = setTimeout(() => setStatus('idle'), 6000);
        return () => clearTimeout(t);
    }, [status]);

    const start = async () => {
        const job = plan; // a range/filter change mid-export doesn't affect it
        const controller = new AbortController();
        abortRef.current = controller;
        setStatus('running');
        setProgress({ rows: 0, total: job.rows });
        try {
            const { parts, rows } = await downloadRawPriceCsv(commodity, job.filters, job.chunks, {
                signal: controller.signal,
                onProgress: (n) => setProgress({ rows: n, total: Math.max(job.rows, n) }),
            });
            const filename = exportFilename(commodity, job);
            if (rows) downloadBlob(new Blob(parts, { type: 'text/csv;charset=utf-8' }), filename);
            setResult({ filename, rows });
            setStatus('done');
        } catch (e) {
            if (controller.signal.aborted) {
                setStatus('idle');
            } else {
                setResult({ message: e?.message || 'Unknown error' });
                setStatus('error');
            }
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
        }
    };

    const span = plan.from && plan.to ? `${fmtSpanDate(plan.from)} – ${fmtSpanDate(plan.to)}` : '';
    const pct = progress.total ? Math.min(100, Math.round((progress.rows / progress.total) * 100)) : 0;
    const panel = 'basis-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-xs';
    const textButton = 'rounded-lg px-3 py-1.5 font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]';

    return (
        <>
            <button
                onClick={() => (plan.rows > CONFIRM_ROWS ? setStatus('confirm') : start())}
                disabled={disabled || status === 'running' || !plan.rows}
                title="Download every raw report row behind this chart as CSV"
                className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-text-secondary)]"
            >
                <Download size={13} />
                Export CSV
            </button>

            {status === 'confirm' && (
                <div className={panel} role="dialog" aria-label="Confirm raw data export">
                    <p className="text-[var(--color-text-primary)]">
                        <span className="font-semibold">{plan.rows.toLocaleString()} raw rows</span>
                        {' '}(≈ {fmtSize(plan.rows * BYTES_PER_ROW)}) for {commodity}{span && `, ${span}`}.
                    </p>
                    <p className="mt-0.5 text-[var(--color-text-muted)]">
                        Every report row and column, all price units
                        {cpiAdjusted ? ', with prices as reported (not inflation-adjusted)' : ''}.
                        {' '}Large exports can take a minute.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                        <button
                            onClick={start}
                            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-accent-hover)]"
                        >
                            Download
                        </button>
                        <button onClick={() => setStatus('idle')} className={textButton}>Cancel</button>
                    </div>
                </div>
            )}

            {status === 'running' && (
                <div className={panel} role="status">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--color-text-secondary)]">
                            Downloading raw data… <span className="font-semibold text-[var(--color-text-primary)]">{progress.rows.toLocaleString()}</span> of {progress.total.toLocaleString()} rows
                        </span>
                        <button onClick={() => abortRef.current?.abort()} className={textButton}>Cancel</button>
                    </div>
                    <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]"
                        role="progressbar" aria-label="Export progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
                    >
                        <div className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
                    </div>
                </div>
            )}

            {status === 'done' && (
                <div className={`${panel} flex items-center gap-2`} role="status">
                    <Check size={14} className="shrink-0 text-[var(--color-accent)]" />
                    <span className="flex-1 text-[var(--color-text-secondary)]">
                        {result.rows
                            ? <>Saved <span className="font-semibold text-[var(--color-text-primary)]">{result.filename}</span> ({result.rows.toLocaleString()} rows).</>
                            : 'No raw rows found for this selection.'}
                    </span>
                    <button onClick={() => setStatus('idle')} aria-label="Dismiss" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                        <X size={14} />
                    </button>
                </div>
            )}

            {status === 'error' && (
                <div className={`${panel} flex flex-wrap items-center gap-2`} role="alert">
                    <AlertCircle size={14} className="shrink-0 text-red-500" />
                    <span className="flex-1 text-[var(--color-text-secondary)]">Export failed: {result.message}</span>
                    <button onClick={start} className={textButton}>Retry</button>
                    <button onClick={() => setStatus('idle')} aria-label="Dismiss" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                        <X size={14} />
                    </button>
                </div>
            )}
        </>
    );
}
