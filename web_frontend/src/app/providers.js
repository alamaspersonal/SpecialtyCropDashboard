'use client';

/**
 * Providers — Wraps the application with React Query and Theme context
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../context/ThemeContext';
import { useState } from 'react';

export default function Providers({ children }) {
    // Create QueryClient once per component lifecycle (not per render)
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000, // 5 minutes
                gcTime: 30 * 60 * 1000,    // 30 minutes
                retry: 2,
                refetchOnWindowFocus: true, // Web: leverage tab visibility
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                {children}
            </ThemeProvider>
        </QueryClientProvider>
    );
}
