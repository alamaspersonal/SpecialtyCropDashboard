'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { Moon, Sun, Leaf, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
    const { isDark, toggleTheme } = useTheme();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems = [
        { href: '/', label: 'Home' },
        { href: '/filters', label: 'Filters' },
        { href: '/account', label: 'Account' },
    ];

    return (
        <header className="glass sticky top-0 z-50 h-[var(--header-height)] border-b border-[var(--color-border)]">
            <div className="mx-auto flex h-full max-w-[var(--max-content)] items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Brand */}
                <Link href="/" className="flex items-center gap-2.5 no-underline group">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white shadow-sm transition-transform duration-200 group-hover:scale-110">
                        <Leaf size={18} />
                    </div>
                    <span className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
                        SpecialtyCrop
                        <span className="text-[var(--color-accent)]">Dashboard</span>
                    </span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden items-center gap-1 md:flex">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`relative rounded-lg px-3.5 py-2 text-sm font-medium no-underline transition-colors duration-200
                                    ${isActive
                                        ? 'text-[var(--color-accent)]'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
                                    }`}
                            >
                                {item.label}
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-indicator"
                                        className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[var(--color-accent)]"
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-2">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        <motion.div
                            key={isDark ? 'dark' : 'light'}
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </motion.div>
                    </button>

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-elevated)] md:hidden"
                        aria-label="Toggle menu"
                    >
                        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.nav
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="glass overflow-hidden border-t border-[var(--color-border)] md:hidden"
                    >
                        <div className="flex flex-col gap-1 px-4 py-3">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={`rounded-lg px-4 py-2.5 text-sm font-medium no-underline transition-colors
                                            ${isActive
                                                ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.nav>
                )}
            </AnimatePresence>
        </header>
    );
}
