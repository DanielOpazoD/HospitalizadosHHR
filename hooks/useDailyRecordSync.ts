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

// Debounce for sync protection - prevents flickering during rapid local changes
const SYNC_DEBOUNCE_MS = 1000;

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

        // Wait for auth to be ready before subscribing to Firestore
        const unregisterAuthObserver = auth.onAuthStateChanged((user) => {
            if (user) {
                if (unsubRepo) unsubRepo();

                unsubRepo = subscribe(currentDateString, (remoteRecord, hasPendingWrites) => {
                    if (!remoteRecord) {
                        setRecord(null);
                        setSyncStatus('idle');
                        return;
                    }

                    const now = Date.now();
                    const timeSinceLastChange = now - lastLocalChangeRef.current;

                    // 1. If Firestore says it's a pending local write, IGNORE it.
                    // This is the absolute best way to avoid flickering from our own "echoes".
                    if (hasPendingWrites) {
                        console.log('[Sync] Ignoring local pending write (echo protection)');
                        return;
                    }

                    // 2. If we are currently saving and the change is VERY fresh, ignore to be safe.
                    // But since hasPendingWrites covers most echos, we can keep this window very short.
                    if (isSavingRef.current && timeSinceLastChange < 500) {
                        console.log(`[Sync] Ignoring update due to active saving (${timeSinceLastChange}ms)`);
                        return;
                    }

                    // 3. Otherwise, ACCEPT the remote update.
                    // Our DebouncedInput and DebouncedTextarea components will protect themselves if they are focused.
                    console.log('[Sync] Applying remote change, lastUpdated:', remoteRecord.lastUpdated);
                    setRecord(remoteRecord);
                    setLastSyncTime(new Date());
                    setSyncStatus('saved');

                    // Mirror to localStorage (if repo didn't already do it)
                    import('../services/storage/localStorageService').then(({ saveRecordLocal }) => {
                        saveRecordLocal(remoteRecord);
                    });
                });
            }
        });

        return () => {
            unregisterAuthObserver();
            if (unsubRepo) unsubRepo();
        };
    }, [currentDateString]);

    // ========================================================================
    // Initial / Reconnection Sync (Force Pull from Firestore)
    // ========================================================================
    useEffect(() => {
        // This effect runs once when date changes and auth is ready.
        // It ensures we have the absolute latest version from Firestore at boot.
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user && navigator.onLine) {
                console.log('[useDailyRecordSync] Component mount/online - performing deep sync for:', currentDateString);

                // Always check Firestore for the latest version
                syncWithFirestore(currentDateString).then((remoteRecord: DailyRecord | null) => {
                    const localRecord = getForDate(currentDateString);

                    if (remoteRecord) {
                        // We found a record in Firestore
                        if (!localRecord || new Date(remoteRecord.lastUpdated) > new Date(localRecord.lastUpdated)) {
                            console.log('[useDailyRecordSync] Firestore version is newer (or no local data). Updating state.');
                            setRecord(remoteRecord);
                            setSyncStatus('saved');
                            setLastSyncTime(new Date());
                        } else {
                            console.log('[useDailyRecordSync] Local version is newer or equal. Keeping local.');
                            setRecord(localRecord);
                        }
                    } else if (localRecord) {
                        // No Firestore record but we have local record (maybe newly created offline)
                        console.log('[useDailyRecordSync] Local data found but no Firestore record. Pushing local to cloud.');
                        save(localRecord).then(() => {
                            setSyncStatus('saved');
                            setLastSyncTime(new Date());
                        });
                    }
                }).catch(err => {
                    console.error('[useDailyRecordSync] Deep sync failed:', err);
                });
            }
        });

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
            }, 1000); // Wait 1s after operation ends to release lock
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
            }, 1000); // Wait 1s after operation ends to release lock
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
