'use client';

/**
 * Onboarding Page — First-run experience for name input.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, User, Leaf } from 'lucide-react';
import { setUserName, setOnboardingComplete, hasCompletedOnboarding } from '../../services/userStorage';

export default function OnboardingPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (hasCompletedOnboarding()) {
            router.replace('/');
        }
    }, [router]);

    const handleContinue = () => {
        const trimmedName = name.trim();

        if (!trimmedName) {
            setError('Please enter your name');
            return;
        }

        if (trimmedName.length < 2) {
            setError('Name must be at least 2 characters');
            return;
        }

        setUserName(trimmedName);
        setOnboardingComplete();
        router.push('/');
    };

    return (
        <div className="flex min-h-[calc(100dvh-var(--header-height))] flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-green-50 px-4 [html[data-theme='dark']_&]:from-slate-900 [html[data-theme='dark']_&]:via-slate-800 [html[data-theme='dark']_&]:to-emerald-950">
            {/* Background decoration */}
            <div className="pointer-events-none absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-[var(--color-accent)] opacity-5 blur-3xl" />
            <div className="pointer-events-none absolute -left-32 bottom-1/4 h-96 w-96 rounded-full bg-emerald-400 opacity-5 blur-3xl" />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                className="relative w-full max-w-sm text-center"
            >
                {/* Logo */}
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 200 }}
                    className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-white shadow-lg"
                >
                    <Leaf size={28} />
                </motion.div>

                <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
                    Welcome!
                </h1>
                <p className="mt-2 text-[var(--color-text-secondary)]">
                    Let's personalize your experience
                </p>

                {/* Input */}
                <div className="mt-8">
                    <label htmlFor="name-input" className="mb-2 block text-left text-sm font-medium text-[var(--color-text-secondary)]">
                        What should we call you?
                    </label>
                    <div className="relative">
                        <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <input
                            id="name-input"
                            type="text"
                            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3.5 pl-11 pr-4 text-base text-[var(--color-text-primary)] shadow-[var(--shadow-card)] transition-all duration-200 placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:shadow-[var(--shadow-card-hover)] focus:outline-none"
                            placeholder="Enter your name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setError('');
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                            autoFocus
                            maxLength={30}
                            autoComplete="off"
                        />
                    </div>
                    {error && (
                        <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 text-left text-xs text-[var(--color-error)]"
                        >
                            {error}
                        </motion.p>
                    )}
                </div>

                {/* Button */}
                <motion.button
                    whileTap={{ scale: 0.97 }}
                    className={`group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all duration-300
                        ${name.trim()
                            ? 'bg-[var(--color-accent)] text-white shadow-md hover:bg-[var(--color-accent-hover)] hover:shadow-lg hover:-translate-y-0.5'
                            : 'cursor-not-allowed bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'
                        }`}
                    onClick={handleContinue}
                >
                    Let's Go
                    <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </motion.button>
            </motion.div>

            <p className="mt-12 text-xs text-[var(--color-text-muted)]">
                USDA Specialty Crop Dashboard
            </p>
        </div>
    );
}
