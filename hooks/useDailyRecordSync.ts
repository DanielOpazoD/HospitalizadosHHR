/**
 * useDailyRecordSync Hook
 * Handles real-time synchronization with Firebase and local persistence.
 * Extracted from useDailyRecord for better separation of concerns.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { DailyRecord } from '../types';
import { useNotification } from '../context/UIContext';
import { validateDailyRecord } from '../schemas/validation';
import { DailyRecordPatchLoose } from './useDailyRecordTypes';
import { logFirebaseError, getUserFriendlyErrorMessage } from '../services/utils/errorService';

import {
    getForDate,
    save,
    updatePartial,
    subscribe,
    DailyRecordRepository,
    syncWithFirestore
} from '../services/repositories/DailyRecordRepository';
import { auth } from '../firebaseConfig';
import { saveRecordLocal } from '../services/storage/localStorageService';
import { applyPatches } from '../utils/patchUtils';

// Short debounce - only ignore Firebase "echo" updates immediately after saving
const SYNC_DEBOUNCE_MS = 500;

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseDailyRecordSyncResult {
    record: DailyRecord | null;
    setRecord: (record: DailyRecord | null | ((prev: DailyRecord | null) => DailyRecord | null)) => void;
    syncStatus: SyncStatus;
    lastSyncTime: Date | null;
    saveAndUpdate: (updatedRecord: DailyRecord) => Promise<void>;
    patchRecord: (partial: DailyRecordPatchLoose) => Promise<void>;
    markLocalChange: () => void;
    refresh: () => void;
}

/**
 * Hook that manages sync state and real-time updates from Firebase.
 */
export const useDailyRecordSync = (currentDateString: string, isOfflineMode: boolean = false): UseDailyRecordSyncResult => {
    const [record, setRecord] = useState<DailyRecord | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    const { error } = useNotification();

    // Refs for sync management
    const isSavingRef = useRef(false);
    const lastLocalChangeRef = useRef<number>(0);

    // ========================================================================
    // Initial Load
    // ========================================================================
    useEffect(() => {
        const existing = getForDate(currentDateString);
        setRecord(existing || null);
    }, [currentDateString]);

    // ========================================================================
    // Real-time Sync Subscription
    // ========================================================================
    useEffect(() => {
        let unsubRepo: (() => void) | null = null;

        // Subscription is now dynamic based on auth state
        // and doesn't explicitly block if in passport mode (hybrid)

        // Wait for auth to be ready before subscribing to Firestore
        const unregisterAuthObserver = auth.onAuthStateChanged((user) => {
            if (user) {
                if (unsubRepo) unsubRepo();

                unsubRepo = subscribe(currentDateString, (remoteRecord) => {
                    if (!remoteRecord) {
                        // Remote record deleted -> Clear local state
                        setRecord(null);
                        setSyncStatus('idle');
                        import('../services/storage/localStorageService').then(({ deleteRecordLocal }) => {
                            deleteRecordLocal(currentDateString);
                        });
                        return;
                    }

                    if (remoteRecord) {
                        const now = Date.now();
                        const timeSinceLastChange = now - lastLocalChangeRef.current;

                        // Only ignore updates if we are in the middle of saving (very short window)
                        if (isSavingRef.current && timeSinceLastChange < 200) {
                            console.log('[Sync] Ignoring echo during save operation');
                            return;
                        }

                        // Always accept remote updates - they are the source of truth
                        console.log('[Sync] Accepting remote update');
                        setRecord(remoteRecord);
                        setLastSyncTime(new Date());
                        setSyncStatus('saved');
                        saveRecordLocal(remoteRecord);
                    }
                });
            }
        });

        return () => {
            unregisterAuthObserver();
            if (unsubRepo) unsubRepo();
        };
    }, [currentDateString]);

    // ========================================================================
    // Initial / Reconnection Sync
    // ========================================================================
    useEffect(() => {
        // This effect runs once when date changes and auth is ready.
        // It implements offline-first: local changes take priority.
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user && navigator.onLine) {
                const localRecord = getForDate(currentDateString);

                // If we have local data, sync TO Firestore (push local changes)
                if (localRecord) {
                    console.log('[useDailyRecordSync] Auth ready + online - pushing local changes to Firestore for:', currentDateString);
                    save(localRecord).then(() => {
                        console.log('[useDailyRecordSync] ✅ Pushed local record to Firestore:', currentDateString);
                        setSyncStatus('saved');
                        setLastSyncTime(new Date());
                    }).catch((err) => {
                        console.warn('[useDailyRecordSync] Failed to push local to Firestore:', err);
                    });
                } else {
                    // No local data, pull from Firestore
                    console.log('[useDailyRecordSync] No local data - pulling from Firestore for:', currentDateString);
                    syncWithFirestore(currentDateString).then((syncedRecord: DailyRecord | null) => {
                        if (syncedRecord) {
                            setRecord(syncedRecord);
                            setSyncStatus('saved');
                            setLastSyncTime(new Date());
                            console.log('[useDailyRecordSync] ✅ Pulled record from Firestore to LocalStorage:', currentDateString);
                        }
                    });
                }
            }
        });

        // Cleanup to avoid memory leaks if effect re-runs
        return () => unsubscribe();
    }, [currentDateString]);

    // ========================================================================
    // Save Handler
    // ========================================================================
    /**
     * Saves the complete DailyRecord to both local storage and Firestore.
     * Updates the local state and sync status.
     * 
     * @param updatedRecord - The new record state to persist
     * @returns Promise that resolves when the save operation completes
     */
    const saveAndUpdate = useCallback(async (updatedRecord: DailyRecord) => {
        isSavingRef.current = true;
        lastLocalChangeRef.current = Date.now();

        setRecord(updatedRecord);
        setSyncStatus('saving');

        try {
            await save(updatedRecord);
            setSyncStatus('saved');
            setLastSyncTime(new Date());
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (err) {
            console.error('Save failed:', err);
            setSyncStatus('error');

            // Log error to centralized service
            logFirebaseError(err, 'saveAndUpdate', {
                date: updatedRecord.date,
                recordSize: JSON.stringify(updatedRecord).length,
            });

            // Show user-friendly error message
            const friendlyMessage = getUserFriendlyErrorMessage(err);
            error('Error al guardar', friendlyMessage);
        } finally {
            setTimeout(() => {
                isSavingRef.current = false;
            }, SYNC_DEBOUNCE_MS);
        }
    }, [error]);

    /**
     * Performs an optimistic partial update to the DailyRecord.
     * Uses dot-notation paths for efficient Firestore updates.
     * 
     * @param partial - Object containing key paths and values to update
     * @returns Promise that resolves when the patch is applied
     * 
     * @example
     * ```typescript
     * await patchRecord({ 'beds.B01.patientName': 'Juan Pérez' });
     * ```
     */
    const patchRecord = useCallback(async (partial: DailyRecordPatchLoose) => {
        isSavingRef.current = true;
        lastLocalChangeRef.current = Date.now();

        // Optimistic update
        setRecord(prev => {
            if (!prev) return null;
            const updated = applyPatches(prev, partial);
            updated.lastUpdated = new Date().toISOString();
            return updated;
        });

        setSyncStatus('saving');

        try {
            await updatePartial(currentDateString, partial);
            setSyncStatus('saved');
            setLastSyncTime(new Date());
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (err) {
            console.error('Patch failed:', err);
            setSyncStatus('error');
            error('Error al actualizar', getUserFriendlyErrorMessage(err));
        } finally {
            setTimeout(() => {
                isSavingRef.current = false;
            }, SYNC_DEBOUNCE_MS);
        }
    }, [currentDateString, error]);

    // ========================================================================
    // Utility Functions
    // ========================================================================
    const markLocalChange = useCallback(() => {
        lastLocalChangeRef.current = Date.now();
    }, []);

    const refresh = useCallback(() => {
        const existing = getForDate(currentDateString);
        setRecord(existing || null);
    }, [currentDateString]);

    return {
        record,
        setRecord,
        syncStatus,
        lastSyncTime,
        saveAndUpdate,
        patchRecord,
        markLocalChange,
        refresh
    };
};
