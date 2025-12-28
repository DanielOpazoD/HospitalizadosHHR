/**
 * Integration Tests for DailyRecord Sync Flow
 * Tests useDailyRecordSync hook and its interaction with the repository and Firestore logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDailyRecordSync } from '../../hooks/useDailyRecordSync';
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

describe('DailyRecord Sync Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetForDate.mockReturnValue(null);
        mockSyncWithFirestore.mockResolvedValue(null);
        mockSave.mockResolvedValue(undefined);
        mockUpdatePartial.mockResolvedValue(undefined);
    });

    it('should load local record on mount', () => {
        const localRecord = createMockRecord('2024-12-28');
        mockGetForDate.mockReturnValue(localRecord);

        const { result } = renderHook(() => useDailyRecordSync('2024-12-28'));

        expect(result.current.record).toEqual(localRecord);
        expect(mockGetForDate).toHaveBeenCalledWith('2024-12-28');
    });

    it('should subscribe to remote changes on mount', () => {
        renderHook(() => useDailyRecordSync('2024-12-28'));
        expect(mockSubscribe).toHaveBeenCalledWith('2024-12-28', expect.any(Function));
    });

    it('should update record when remote change is received (no local pending)', async () => {
        const { result } = renderHook(() => useDailyRecordSync('2024-12-28'));

        const remoteRecord = createMockRecord('2024-12-28');
        remoteRecord.lastUpdated = '2024-12-28T13:00:00Z';

        // Trigger the callback passed to mockSubscribe
        const subscribeCallback = mockSubscribe.mock.calls[0][1];

        await act(async () => {
            subscribeCallback(remoteRecord, false); // hasPendingWrites = false
        });

        expect(result.current.record).toEqual(remoteRecord);
    });

    it('should ignore remote change if it has pending local writes (echo protection)', async () => {
        const localRecord = createMockRecord('2024-12-28');
        mockGetForDate.mockReturnValue(localRecord);

        const { result } = renderHook(() => useDailyRecordSync('2024-12-28'));

        const echoRecord = { ...localRecord, lastUpdated: 'something-new' };

        // Trigger callback with pending local write flag
        const subscribeCallback = mockSubscribe.mock.calls[0][1];

        await act(async () => {
            subscribeCallback(echoRecord, true); // hasPendingWrites = true (ECHO)
        });

        // Record should NOT change
        expect(result.current.record).toEqual(localRecord);
    });

    it('should perform deep sync on mount if online', async () => {
        const remoteRecord = createMockRecord('2024-12-28');
        remoteRecord.lastUpdated = '2024-12-28T20:00:00Z';
        mockSyncWithFirestore.mockResolvedValue(remoteRecord);

        const { result } = renderHook(() => useDailyRecordSync('2024-12-28'));

        // We need to wait for the syncWithFirestore effect to run
        await act(async () => {
            await Promise.resolve(); // Wait for effect microtasks
        });

        expect(mockSyncWithFirestore).toHaveBeenCalledWith('2024-12-28');
        expect(result.current.record).toEqual(remoteRecord);
    });

    it('should save and update state on saveAndUpdate call', async () => {
        const { result } = renderHook(() => useDailyRecordSync('2024-12-28'));
        const newRecord = createMockRecord('2024-12-28');
        newRecord.nurses = ['Nurse A'];

        await act(async () => {
            await result.current.saveAndUpdate(newRecord);
        });

        expect(mockSave).toHaveBeenCalledWith(newRecord);
        expect(result.current.record).toEqual(newRecord);
        expect(result.current.syncStatus).toBe('saved'); // After await, it should be saved
    });

    it('should perform patch update and keep state in sync', async () => {
        const initialRecord = createMockRecord('2024-12-28');
        mockGetForDate.mockReturnValue(initialRecord);

        const { result } = renderHook(() => useDailyRecordSync('2024-12-28'));
        const partial = { 'beds.R1.patientName': 'Nuevo Paciente' };

        await act(async () => {
            await result.current.patchRecord(partial);
        });

        expect(mockUpdatePartial).toHaveBeenCalledWith('2024-12-28', partial);
        expect(result.current.record?.beds.R1.patientName).toBe('Nuevo Paciente');
        expect(result.current.syncStatus).toBe('saved');
    });

    it('should handle save errors and update syncStatus', async () => {
        mockSave.mockRejectedValue(new Error('Firebase error'));
        const { result } = renderHook(() => useDailyRecordSync('2024-12-28'));

        await act(async () => {
            try { await result.current.saveAndUpdate(createMockRecord('2024-12-28')); } catch { }
        });

        expect(result.current.syncStatus).toBe('error');
    });
});
