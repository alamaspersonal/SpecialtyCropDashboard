'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield } from 'lucide-react';
import PageTransition from '../../components/PageTransition/PageTransition';

const LAST_UPDATED = 'June 3, 2025';

const sections = [
    {
        title: 'Overview',
        body: `SpecialtyCrop Dashboard is a tool for viewing USDA specialty crop pricing data. We are committed to protecting your privacy. This policy explains what information is collected, how it is used, and your rights regarding that information.`,
    },
    {
        title: 'Information We Collect',
        body: `We collect only the minimum information needed to personalize your experience:

• Display name — stored locally in your browser (localStorage) and never transmitted to our servers.
• Theme preference (dark/light mode) — stored locally in your browser.
• Saved favorites and watchlist — stored locally in your browser.

We do not collect your email address, location, device identifiers, or any other personal information.`,
    },
    {
        title: 'How Your Information Is Used',
        body: `All personal preferences (name, theme, favorites) remain on your device and are used only to personalize the interface. They are never uploaded to our servers, shared with third parties, or used for advertising.`,
    },
    {
        title: 'USDA Market Data',
        body: `Crop pricing data is sourced from the USDA Agricultural Marketing Service (AMS) public API and stored in our Supabase database. This data is entirely public and contains no personal information.`,
    },
    {
        title: 'AI Market Insights (Cerebras)',
        body: `When you request an AI-generated market summary, anonymized crop market notes from the USDA report are sent to the Cerebras AI inference API. No personal information (name, preferences, account data) is ever included in these requests. Cerebras's own privacy policy governs how they handle API request data.`,
    },
    {
        title: 'Cookies and Tracking',
        body: `We do not use cookies, analytics trackers, or any third-party tracking scripts. No usage data is collected about how you interact with the dashboard.`,
    },
    {
        title: 'Data Storage and Security',
        body: `Your personal preferences are stored only in your browser's localStorage and are accessible solely by you on your device. Our Supabase database stores only public USDA crop price records — no user accounts, passwords, or personal data.`,
    },
    {
        title: 'Your Rights',
        body: `You can clear all locally stored data at any time from the Account page using the "Clear All Data" button. This removes your name, favorites, and preferences from your browser instantly.`,
    },
    {
        title: 'Changes to This Policy',
        body: `If this privacy policy changes materially, the "Last updated" date at the top of this page will be updated. We encourage you to review this page periodically.`,
    },
    {
        title: 'Contact',
        body: `If you have questions about this privacy policy, please reach out via the project's GitHub repository.`,
    },
];

export default function PrivacyPolicyPage() {
    const router = useRouter();

    return (
        <PageTransition>
            <div className="min-h-[calc(100dvh-var(--header-height))] py-8 sm:py-12">
                <div className="mx-auto max-w-2xl px-4 sm:px-6">
                    {/* Back */}
                    <button
                        onClick={() => router.back()}
                        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>

                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8 flex items-center gap-3"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Privacy Policy</h1>
                            <p className="text-xs text-[var(--color-text-muted)]">Last updated: {LAST_UPDATED}</p>
                        </div>
                    </motion.div>

                    {/* Sections */}
                    <div className="space-y-6">
                        {sections.map((section, i) => (
                            <motion.div
                                key={section.title}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]"
                            >
                                <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
                                    {section.title}
                                </h2>
                                <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-text-secondary)]">
                                    {section.body}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    <p className="mt-10 text-center text-xs text-[var(--color-text-muted)]">
                        SpecialtyCrop Dashboard — USDA Market Data
                    </p>
                </div>
            </div>
        </PageTransition>
    );
}
