'use client';

/**
 * PageTransition — Framer Motion wrapper for smooth page enter/exit.
 */

import { motion } from 'framer-motion';

const pageVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
};

const pageTransition = {
    type: 'tween',
    ease: [0.4, 0, 0.2, 1],
    duration: 0.3,
};

export default function PageTransition({ children, className = '' }) {
    return (
        <motion.div
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className={className}
        >
            {children}
        </motion.div>
    );
}
