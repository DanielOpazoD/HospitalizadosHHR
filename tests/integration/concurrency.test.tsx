import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useDailyRecordSyncQuery } from '../../hooks/useDailyRecordSyncQuery';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DailyRecord } from '../../types';
import { ConcurrencyError } from '../../services/storage/firestoreService';

// Mocks
const mockSave = vi.fn();
const mockGetForDate = vi.fn();
const mockNotificationError = vi.fn();

vi.mock('../../services/repositories/DailyRecordRepository', () => ({
    getForDate: (date: string) => mockGetForDate(date),
    save: (record: DailyRecord, expected?: string) => mockSave(record, expected),
    subscribe: () => () => { },
    syncWithFirestore: () => Promise.resolve(null),
    updatePartial: vi.fn(),
}));

vi.mock('../../context/UIContext', () => ({
    useNotification: () => ({
        error: mockNotificationError,
        success: vi.fn(),
    }),
}));

vi.mock('../../firebaseConfig', () => ({
    auth: { onAuthStateChanged: vi.fn(() => () => { }) },
}));

vi.mock('../../services/storage/localStorageService', () => ({
    saveRecordLocal: vi.fn(),
}));

const createMockRecord = (date: string): DailyRecord => ({
    date,
    lastUpdated: '2024-12-28T10:00:00Z',
    beds: {}, discharges: [], transfers: [], cma: [], nurses: []
} as any);

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient} > {children} </QueryClientProvider>
    );
};

describe('Concurrency Handling Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetForDate.mockResolvedValue(createMockRecord('2024-12-28'));
    });

    it('should handle ConcurrencyError correctly', async () => {
        // Setup: Repository throws ConcurrencyError on save
        mockSave.mockRejectedValue(new ConcurrencyError('Remote is newer'));

        const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28'), {
            wrapper: createWrapper()
        });

        // Wait for mount
        await act(async () => { await Promise.resolve(); });

        const newRecord = { ...result.current.record!, lastUpdated: '2024-12-28T10:00:01Z' };

        // Action: Try to save
        await act(async () => {
            try {
                await result.current.saveAndUpdate(newRecord);
            } catch (e) {
                // Expected to throw or be handled
            }
        });

        // Assertions
        // Assertions
        await waitFor(() => {
            expect(result.current.syncStatus).toBe('error');
            expect(mockNotificationError).toHaveBeenCalledWith('Conflicto de Edición', 'Remote is newer');
        });

        // Verify Refresh Logic
        // The hook sets a timeout of 2000ms to refresh
        mockGetForDate.mockClear(); // Clear initial load call

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 2100));
        });

        expect(mockGetForDate).toHaveBeenCalledWith('2024-12-28');
    });
});
