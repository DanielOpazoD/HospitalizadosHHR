/**
 * BaseModal Component
 * 
 * A reusable modal wrapper that provides consistent styling and behavior
 * across all modals in the application. Includes:
 * - Semi-transparent backdrop with blur effect
 * - Glass morphism container with animations
 * - Consistent header with title and close button
 * - Scrollable content area
 * 
 * @example
 * ```tsx
 * <BaseModal
 *     isOpen={showSettings}
 *     onClose={() => setShowSettings(false)}
 *     title="Configuración"
 *     icon={<Settings size={18} />}
 * >
 *     <ModalContent />
 * </BaseModal>
 * ```
 */

import React from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useScrollLock } from '../../hooks/useScrollLock';

/**
 * Size variants for the modal container
 */
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const sizeClasses: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl'
};

export interface BaseModalProps {
    /** Whether the modal is open/visible */
    isOpen: boolean;
    /** Callback when the modal should close */
    onClose: () => void;
    /** Title displayed in the modal header */
    title: React.ReactNode;
    /** Optional icon to display before the title */
    icon?: React.ReactNode;
    /** Size of the modal container */
    size?: ModalSize;
    /** Modal content */
    children: React.ReactNode;
    /** Optional custom class for the modal container */
    className?: string;
    /** Whether clicking the backdrop closes the modal (default: true) */
    closeOnBackdrop?: boolean;
    /** Whether to show the close button in header (default: true) */
    showCloseButton?: boolean;
    /** Custom header color class (default: 'text-medical-600') */
    headerIconColor?: string;
    /** Background variant (default: 'glass') */
    variant?: 'glass' | 'white';
}

/**
 * BaseModal Component
 * 
 * Provides a consistent modal layout with header, body, and styling.
 * Uses the application's glass morphism design system.
 */
export const BaseModal: React.FC<BaseModalProps> = ({
    isOpen,
    onClose,
    title,
    icon,
    size = 'md',
    children,
    className,
    closeOnBackdrop = true,
    showCloseButton = true,
    headerIconColor = 'text-medical-600',
    variant = 'glass'
}) => {
    // Unified scroll lock - MUST BE BEFORE EARLY RETURN
    useScrollLock(isOpen);

    // Handle ESC key - MUST BE BEFORE EARLY RETURN
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
        }

        return () => {
            document.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    // Don't render if not open
    if (!isOpen) return null;

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in print:hidden"
            style={{ isolation: 'isolate', willChange: 'opacity' }}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div
                className={clsx(
                    "rounded-2xl shadow-2xl w-full animate-scale-in overflow-hidden",
                    variant === 'white' ? "bg-white border border-slate-200" : "glass border border-white/40",
                    sizeClasses[size],
                    className
                )}
            >
                {/* Header */}
                <div className={clsx(
                    "p-4 border-b flex justify-between items-center sticky top-0 z-10",
                    variant === 'white' ? "bg-white border-slate-100" : "bg-white/30 border-white/20"
                )}>
                    <h3
                        id="modal-title"
                        className="font-display font-bold text-slate-800 flex items-center gap-2 tracking-tight"
                    >
                        {icon && <span className={headerIconColor}>{icon}</span>}
                        {title}
                    </h3>
                    {showCloseButton && (
                        <button
                            onClick={onClose}
                            className={clsx(
                                "transition-colors p-1.5 rounded-full",
                                variant === 'white'
                                    ? "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                    : "text-slate-400 hover:text-slate-600 bg-white/50"
                            )}
                            aria-label="Cerrar modal"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

/**
 * ModalSection Component
 * 
 * A styled section for use inside BaseModal body.
 * Provides consistent card styling for modal content groups.
 */
export interface ModalSectionProps {
    /** Section title */
    title: React.ReactNode;
    /** Optional icon for the section header */
    icon?: React.ReactNode;
    /** Description text or JSX below the title */
    description?: React.ReactNode;
    /** Section content */
    children: React.ReactNode;
    /** Border/header color variant */
    variant?: 'default' | 'success' | 'warning' | 'info' | 'danger';
}

const variantClasses: Record<string, { border: string; title: string; desc: string }> = {
    default: { border: 'border-white/60', title: 'text-slate-800', desc: 'text-slate-600/80' },
    success: { border: 'border-emerald-200', title: 'text-emerald-800', desc: 'text-emerald-600/80' },
    warning: { border: 'border-orange-200', title: 'text-orange-800', desc: 'text-orange-600/80' },
    info: { border: 'border-blue-200', title: 'text-blue-800', desc: 'text-blue-600/80' },
    danger: { border: 'border-red-200', title: 'text-red-800', desc: 'text-red-600/80' }
};

export const ModalSection: React.FC<ModalSectionProps> = ({
    title,
    icon,
    description,
    children,
    variant = 'default'
}) => {
    const colors = variantClasses[variant];

    return (
        <div className={clsx("bg-white/40 border p-5 rounded-2xl shadow-sm backdrop-blur-sm", colors.border)}>
            <h4 className={clsx("font-display font-bold flex items-center gap-2 mb-2", colors.title)}>
                {icon}
                {title}
            </h4>
            {description && (
                <p className={clsx("text-xs mb-4 leading-relaxed", colors.desc)}>
                    {description}
                </p>
            )}
            {children}
        </div>
    );
};

export default BaseModal;
