'use client';

/**
 * LoadingSkeleton — Reusable shimmer loading skeletons.
 */

export function SkeletonBlock({ className = '', height = 'h-4', width = 'w-full' }) {
    return <div className={`skeleton ${height} ${width} rounded-lg ${className}`} />;
}

export function SkeletonCard({ className = '' }) {
    return (
        <div className={`bg-[var(--color-surface)] rounded-2xl p-5 shadow-[var(--shadow-card)] space-y-3 ${className}`}>
            <SkeletonBlock height="h-5" width="w-2/3" />
            <SkeletonBlock height="h-4" width="w-1/2" />
            <SkeletonBlock height="h-3" width="w-full" />
            <SkeletonBlock height="h-3" width="w-4/5" />
        </div>
    );
}

export function SkeletonChart({ className = '' }) {
    return (
        <div className={`bg-[var(--color-surface)] rounded-2xl p-6 shadow-[var(--shadow-card)] ${className}`}>
            <SkeletonBlock height="h-5" width="w-1/3" className="mb-4" />
            <div className="flex items-end gap-2 h-40">
                {[60, 80, 45, 90, 70, 55, 85, 40, 75, 65].map((h, i) => (
                    <div key={i} className="flex-1">
                        <SkeletonBlock height={`h-[${h}%]`} className="!rounded-t-md" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SkeletonText({ lines = 3, className = '' }) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonBlock
                    key={i}
                    height="h-3"
                    width={i === lines - 1 ? 'w-3/5' : 'w-full'}
                />
            ))}
        </div>
    );
}
