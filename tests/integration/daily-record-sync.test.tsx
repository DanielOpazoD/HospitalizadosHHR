/**
 * Integration Tests for DailyRecord Sync Flow
 * Tests useDailyRecordSync hook and its interaction with the repository and Firestore logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useDailyRecordSyncQuery } from '../../hooks/useDailyRecordSyncQuery';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DailyRecord } from '../../types';

// ============================================================================
// Mocks
// ============================================================================

// Mock Repository
const mockSubscribe = vi.fn();
const mockSyncWithFirestore = vi.fn();
const mockSave = vi.fn();
const mockUpdatePartial = vi.fn();
const mockGetForDate = vi.fn();

vi.mock('../../services/repositories/DailyRecordRepository', () => ({
    getForDate: (date: string) => mockGetForDate(date),
    save: (record: DailyRecord) => mockSave(record),
    updatePartial: (date: string, partial: any) => mockUpdatePartial(date, partial),
    subscribe: (date: string, cb: any) => {
        mockSubscribe(date, cb);
        return () => { }; // Unsubscribe
    },
    syncWithFirestore: (date: string) => mockSyncWithFirestore(date),
}));

// Mock Firebase Auth
vi.mock('../../firebaseConfig', () => ({
    auth: {
        onAuthStateChanged: vi.fn((cb) => {
            cb({ uid: 'test-user-123' }); // Simulate logged in user
            return () => { }; // Unsubscribe
        }),
    },
}));

// Mock UI Context
vi.mock('../../context/UIContext', () => ({
    useNotification: () => ({
        success: vi.fn(),
        error: vi.fn(),
    }),
}));

// Mock Utils
vi.mock('../../services/utils/errorService', () => ({
    logFirebaseError: vi.fn(),
    getUserFriendlyErrorMessage: vi.fn((err) => 'Friendly Error'),
}));

vi.mock('../../services/storage/localStorageService', () => ({
    saveRecordLocal: vi.fn(),
}));

// ============================================================================
// Helper Data
// ============================================================================

const createMockRecord = (date: string): DailyRecord => ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: '2024-12-28T12:00:00Z',
    nurses: [],
} as any);

// ============================================================================
// Tests
// ============================================================================

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};


describe('DailyRecord Sync Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetForDate.mockReturnValue(null);
        mockSyncWithFirestore.mockResolvedValue(null);
        mockSave.mockResolvedValue(undefined);
        mockUpdatePartial.mockResolvedValue(undefined);
    });

    it('should load local record on mount', async () => {
        const localRecord = createMockRecord('2024-12-28');
        mockGetForDate.mockResolvedValue(localRecord); // Mocking async return based on implementation if needed

        const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), { wrapper: createWrapper() });



        // Wait for state update
        // Using wait for implied by hook usage is tricky without waitFor from testing-library
        // But renderHook returns result which mutates.
        // We can just rely on state being there if act waited enough.
        await waitFor(() => {
            expect(result.current.record).toEqual(localRecord);
        });
        expect(mockGetForDate).toHaveBeenCalledWith('2024-12-28');
    });

    it('should subscribe to remote changes on mount', async () => {
        renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), { wrapper: createWrapper() });



        expect(mockSubscribe).toHaveBeenCalledWith('2024-12-28', expect.any(Function));
    });

    it('should update record when remote change is received (no local pending)', async () => {
        const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), { wrapper: createWrapper() });

        const remoteRecord = createMockRecord('2024-12-28');
        remoteRecord.lastUpdated = '2024-12-28T13:00:00Z';



        // Trigger the callback passed to mockSubscribe
        // We need to capture it after it's been called
        const subscribeCallback = mockSubscribe.mock.calls[0][1];

        // Update mock to return the remote record on next fetch (if invalidation happens)
        mockGetForDate.mockResolvedValue(remoteRecord);

        await act(async () => {
            subscribeCallback(remoteRecord, false); // hasPendingWrites = false
        });

        await waitFor(() => {
            expect(result.current.record).toEqual(remoteRecord);
        });
    });

    // ... (skipping some unchanged tests) ...

    it('should save and update state on saveAndUpdate call', async () => {
        const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), { wrapper: createWrapper() });
        const newRecord = createMockRecord('2024-12-28');
        newRecord.nurses = ['Nurse A'];



        await act(async () => {
            // Update mock to return new record on refetch
            mockGetForDate.mockResolvedValue(newRecord);
            // Note: saveAndUpdate sets record immediately
            await result.current.saveAndUpdate(newRecord);
            // Do NOT run all timers here, or it will flip back to idle
            // Just enough to resolve promises

        });

        // Updated expectation: save now receives 2 arguments (record, previousTimestamp)
        // Since record is initially loaded as null in this test setup (unless we wait for load),
        // baseLastUpdated might be undefined.
        // Let's verify we at least call save with the record. 
        // Note: createMockRecord provides lastUpdated, but if previous state was null...
        // renderHook starts null. loadInitial runs async. 
        // We didn't wait for loadInitial in this specific test! So record is null.
        expect(mockSave).toHaveBeenCalledTimes(1);
        expect(mockSave.mock.calls[0][0]).toEqual(newRecord);
        await waitFor(() => {
            expect(result.current.record).toEqual(newRecord);
            expect(result.current.syncStatus).toBe('saved');
        });
    });

    it('should perform patch update and keep state in sync', async () => {
        const initialRecord = createMockRecord('2024-12-28');
        mockGetForDate.mockReturnValue(initialRecord);

        const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), { wrapper: createWrapper() });
        const partial = { 'beds.R1.patientName': 'Nuevo Paciente' };

        // WAITING FOR INITIAL LOAD for optimistic update to work (needs previous record)
        await waitFor(() => {
            expect(result.current.record).toEqual(initialRecord);
        });



        await act(async () => {
            // Manually update the mock return for the NEXT call
            mockGetForDate.mockResolvedValue({ ...initialRecord, beds: { R1: { patientName: 'Nuevo Paciente' } } } as any);

            await result.current.patchRecord(partial);
            // Run timers just enough to process async state updates but NOT the 2000ms idle timeout

        });

        expect(mockUpdatePartial).toHaveBeenCalledWith('2024-12-28', partial);
        expect(result.current.record?.beds.R1.patientName).toBe('Nuevo Paciente');
        expect(result.current.syncStatus).toBe('saved');
    });

    it('should handle save errors and update syncStatus', async () => {
        mockSave.mockRejectedValue(new Error('Firebase error'));
        const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), { wrapper: createWrapper() });

        await act(async () => {
            try { await result.current.saveAndUpdate(createMockRecord('2024-12-28')); } catch { }
        });

        await waitFor(() => {
            expect(result.current.syncStatus).toBe('error');
        });
    });
});
