/**
 * BaseModal z-index Test
 * Verifies that the modal covers all application content (Navbar, DateStrip, etc.)
 */

import { render, screen } from '@testing-library/react';
import { BaseModal } from '../../components/shared/BaseModal';
import { describe, it, expect, vi } from 'vitest';

// Mock useScrollLock to avoid DOM side effects
vi.mock('../../hooks/useScrollLock', () => ({
    useScrollLock: () => { },
    default: () => { }
}));

describe('BaseModal z-index behavior', () => {
    it('should have a z-index higher than Navbar (z-50)', () => {
        const { container } = render(
            <BaseModal isOpen={true} onClose={() => { }} title="Test Modal">
                <div data-testid="modal-content">Content</div>
            </BaseModal>
        );

        // The backdrop is the first child of the container
        const backdrop = container.firstChild as HTMLElement;
        expect(backdrop).toBeTruthy();
        expect(backdrop.className).toContain('z-[100]');
    });

    it('should render with fixed positioning and cover the entire viewport', () => {
        const { container } = render(
            <BaseModal isOpen={true} onClose={() => { }} title="Test Modal">
                <div data-testid="modal-content">Content</div>
            </BaseModal>
        );

        const backdrop = container.firstChild as HTMLElement;
        expect(backdrop).toBeTruthy();
        expect(backdrop.className).toContain('fixed');
        expect(backdrop.className).toContain('inset-0');
    });

    it('should not render when isOpen is false', () => {
        const { container } = render(
            <BaseModal isOpen={false} onClose={() => { }} title="Test Modal">
                <div data-testid="modal-content">Content</div>
            </BaseModal>
        );

        expect(container.firstChild).toBeNull();
    });

    it('should have backdrop blur effect', () => {
        const { container } = render(
            <BaseModal isOpen={true} onClose={() => { }} title="Test Modal">
                <div data-testid="modal-content">Content</div>
            </BaseModal>
        );

        const backdrop = container.firstChild as HTMLElement;
        expect(backdrop.className).toContain('backdrop-blur');
    });
});
