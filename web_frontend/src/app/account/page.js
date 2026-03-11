'use client';

/**
 * Account Page — User profile, settings, and dark mode toggle.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Moon, Sun, Trash2, ArrowLeft, Edit3, Check, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getUserName, setUserName, clearUserData } from '../../services/userStorage';
import PageTransition from '../../components/PageTransition/PageTransition';

export default function AccountPage() {
    const router = useRouter();
    const { isDark, toggleTheme } = useTheme();

    const [name, setName] = useState('');
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        const stored = getUserName();
        if (stored) setName(stored);
    }, []);

    const startEditing = () => {
        setEditName(name);
        setEditing(true);
    };

    const saveName = () => {
        const trimmed = editName.trim();
        if (trimmed) {
            setUserName(trimmed);
            setName(trimmed);
        }
        setEditing(false);
    };

    const cancelEditing = () => {
        setEditName(name);
        setEditing(false);
    };

    const handleClearData = () => {
        if (window.confirm('Clear all user data? This will remove your name, favorites, and preferences.')) {
            clearUserData();
            setName('');
            router.push('/onboarding');
        }
    };

    return (
        <PageTransition>
            <div className="min-h-[calc(100dvh-var(--header-height))] py-8 sm:py-12">
                <div className="mx-auto max-w-lg px-4 sm:px-6">
                    {/* Back Button */}
                    <button
                        onClick={() => router.back()}
                        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 text-2xl font-bold text-[var(--color-text-primary)]"
                    >
                        Account
                    </motion.h1>

                    {/* Profile Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]"
                    >
                        <div className="flex flex-col items-center">
                            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-lg">
                                <User size={36} />
                            </div>

                            {editing ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-center text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                                        autoFocus
                                        maxLength={30}
                                        onKeyDown={(e) => e.key === 'Enter' && saveName()}
                                    />
                                    <button
                                        onClick={saveName}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-light)]"
                                    >
                                        <Check size={18} />
                                    </button>
                                    <button
                                        onClick={cancelEditing}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-elevated)]"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                                        {name || 'Anonymous'}
                                    </span>
                                    <button
                                        onClick={startEditing}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Settings Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]"
                    >
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Settings
                        </h2>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]">
                                    {isDark ? <Moon size={18} /> : <Sun size={18} />}
                                </div>
                                <span className="text-sm font-medium text-[var(--color-text-primary)]">Dark Mode</span>
                            </div>

                            {/* Toggle Switch */}
                            <button
                                onClick={toggleTheme}
                                className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${isDark ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
                            >
                                <motion.div
                                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                                    animate={{ left: isDark ? '22px' : '2px' }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>
                    </motion.div>

                    {/* Danger Zone */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="mb-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]"
                    >
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Data
                        </h2>
                        <button
                            onClick={handleClearData}
                            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-100 hover:shadow-sm [html[data-theme='dark']_&]:border-red-900/30 [html[data-theme='dark']_&]:bg-red-950/30 [html[data-theme='dark']_&]:text-red-400 [html[data-theme='dark']_&]:hover:bg-red-950/50"
                        >
                            <Trash2 size={16} />
                            Clear All Data
                        </button>
                    </motion.div>

                    {/* App Info */}
                    <div className="text-center text-xs text-[var(--color-text-muted)]">
                        <p>SpecialtyCrop Dashboard v2.0</p>
                        <p className="mt-0.5">USDA Market Data</p>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
}
