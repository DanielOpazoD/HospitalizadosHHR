/**
 * Daily Record Repository
 * Provides a unified interface for accessing and persisting daily records.
 * Abstracts localStorage and Firestore operations.
 * Supports demo mode with isolated storage.
 */

import { DailyRecord, PatientData } from '../../types';
import { DailyRecordPatchLoose } from '../../hooks/useDailyRecordTypes';
import { BEDS } from '../../constants';
import {
    saveRecordLocal,
    getRecordForDate as getRecordFromLocal,
    getPreviousDayRecord,
    getStoredRecords,
    deleteRecordLocal,
    // Demo storage functions
    saveDemoRecord,
    getDemoRecordForDate,
    getPreviousDemoDayRecord,
    getDemoRecords,
    deleteDemoRecord
} from '../storage/localStorageService';
import {
    saveRecordToFirestore,
    subscribeToRecord,
    deleteRecordFromFirestore,
    updateRecordPartial,
    getRecordFromFirestore
} from '../storage/firestoreService';
import { createEmptyPatient, clonePatient } from '../factories/patientFactory';
import { applyPatches } from '../../utils/patchUtils';

// ============================================================================
// Configuration
// ============================================================================

let firestoreEnabled = true;
let demoModeActive = false;

export const setFirestoreEnabled = (enabled: boolean): void => {
    firestoreEnabled = enabled;
};

export const isFirestoreEnabled = (): boolean => firestoreEnabled;

export const setDemoModeActive = (active: boolean): void => {
    demoModeActive = active;
};

export const isDemoModeActive = (): boolean => demoModeActive;

// ============================================================================
// Repository Interface
// ============================================================================

export interface IDailyRecordRepository {
    getForDate(date: string): DailyRecord | null;
    getPreviousDay(date: string): DailyRecord | null;
    save(record: DailyRecord): Promise<void>;
    subscribe(date: string, callback: (r: DailyRecord | null, hasPendingWrites: boolean) => void): () => void;
    initializeDay(date: string, copyFromDate?: string): Promise<DailyRecord>;
    deleteDay(date: string): Promise<void>;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Retrieves the daily record for a specific date.
 * 
 * @param date - Date in YYYY-MM-DD format
 * @returns The daily record if it exists, null otherwise
 * 
 * @example
 * ```typescript
 * const record = getForDate('2024-12-24');
 * if (record) {
 *   console.log(`Beds: ${Object.keys(record.beds).length}`);
 * }
 * ```
 * 
 * @remarks
 * Uses demo storage when demo mode is active, otherwise reads from localStorage.
 */
export const getForDate = (date: string): DailyRecord | null => {
    if (demoModeActive) {
        return getDemoRecordForDate(date);
    }
    return getRecordFromLocal(date);
};

/**
 * Retrieves the previous day's record relative to the given date.
 * 
 * @param date - Reference date in YYYY-MM-DD format
 * @returns The previous day's record if it exists, null otherwise
 * 
 * @example
 * ```typescript
 * const prevRecord = getPreviousDay('2024-12-24');
 * // Returns record for 2024-12-23 if it exists
 * ```
 * 
 * @remarks
 * Useful for copying patient data when initializing a new day.
 */
export const getPreviousDay = (date: string): DailyRecord | null => {
    if (demoModeActive) {
        return getPreviousDemoDayRecord(date);
    }
    return getPreviousDayRecord(date);
};

/**
 * Saves a daily record to storage.
 * 
 * @param record - The daily record to save
 * @returns Promise that resolves when save is complete
 * @throws Error if Firestore sync fails (data still saved locally)
 * 
 * @example
 * ```typescript
 * await save({
 *   date: '2024-12-24',
 *   beds: {},
 *   nurses: ['Juan Pérez'],
 *   lastUpdated: new Date().toISOString()
 * });
 * ```
 * 
 * @remarks
 * - In demo mode: saves only to demo localStorage (no Firestore)
 * - In normal mode: saves to localStorage first (instant), then syncs to Firestore
 */
export const save = async (record: DailyRecord): Promise<void> => {
    if (demoModeActive) {
        // Demo mode: only save to demo localStorage, no Firestore
        saveDemoRecord(record);
        return;
    }

    // Normal mode: save to localStorage first (instant, works offline)
    saveRecordLocal(record);

    // Sync to Firestore in background (if enabled)
    if (firestoreEnabled) {
        try {
            await saveRecordToFirestore(record);
        } catch (err) {
            console.warn('Firestore sync failed, data saved locally:', err);
            throw err;
        }
    }
};

/**
 * Updates specific fields of a daily record without overwriting the entire document.
 * This is the safest way to handle concurrent edits from different users.
 * 
 * @param date - Date in YYYY-MM-DD format
 * @param partialData - Object containing keys (possibly with dot notation) and values to update
 * @returns Promise that resolves when the update is propagated
 * 
 * @example
 * ```typescript
 * await updatePartial('2024-12-24', {
 *   'beds.BED_01.patientName': 'Nuevo Paciente',
 *   'beds.BED_01.isBlocked': false
 * });
 * ```
 */
export const updatePartial = async (date: string, partialData: DailyRecordPatchLoose): Promise<void> => {
    console.log('[Repository] updatePartial called:', date, Object.keys(partialData));

    // 1. Update local storage (Merge with dot notation support)
    if (demoModeActive) {
        const current = getDemoRecordForDate(date);
        if (current) {
            const updated = applyPatches(current, partialData);
            updated.lastUpdated = new Date().toISOString();
            saveDemoRecord(updated);
        }
    } else {
        const current = getRecordFromLocal(date);
        if (current) {
            const updated = applyPatches(current, partialData);
            updated.lastUpdated = new Date().toISOString();
            saveRecordLocal(updated);
        }
    }

    // 2. Update Firestore (always update since auth is verified by caller)
    if (!demoModeActive) {
        try {
            console.log('[Repository] Sending partial update to Firestore:', date);
            await updateRecordPartial(date, partialData);
        } catch (err) {
            console.warn('Firestore partial update failed:', err);
        }
    }
};

/**
 * Subscribes to real-time updates for a specific date.
 * 
 * @param date - Date in YYYY-MM-DD format to subscribe to
 * @param callback - Function called when the record changes
 * @returns Unsubscribe function to stop listening
 * 
 * @example
 * ```typescript
 * const unsubscribe = subscribe('2024-12-24', (record) => {
 *   if (record) {
 *     console.log('Record updated:', record.lastUpdated);
 *   }
 * });
 * 
 * // Later, when component unmounts:
 * unsubscribe();
 * ```
 * 
 * @remarks
 * In demo mode, returns a no-op unsubscribe function (no real-time sync).
 */
export const subscribe = (
    date: string,
    callback: (r: DailyRecord | null, hasPendingWrites: boolean) => void
): (() => void) => {
    if (demoModeActive) {
        console.log('⚠️ Subscribing in DEMO MODE (No real-time sync)');
        // Demo mode: no real-time sync, just return no-op
        callback(getDemoRecordForDate(date), false);
        return () => { };
    }

    // Note: firestoreEnabled check removed - auth is verified by caller (useDailyRecordSync)
    console.log('🔌 Subscribing to LIVE Firestore updates:', date);
    return subscribeToRecord(date, (record, hasPendingWrites) => {
        console.log('[Repository] Firestore subscription callback for', date, '- record exists:', !!record, 'hasPendingWrites:', hasPendingWrites);
        if (record && !hasPendingWrites) {
            // Mirror to localStorage whenever we get an update from Firestore
            // ONLY if it's not a local echo (hasPendingWrites === false)
            saveRecordLocal(record);
        }
        callback(record, hasPendingWrites);
    });
};

/**
 * Manually pulls the latest data from Firestore for a specific date
 * and updates local storage.
 */
export const syncWithFirestore = async (date: string): Promise<DailyRecord | null> => {
    if (demoModeActive || !firestoreEnabled) return null;

    try {
        const record = await getRecordFromFirestore(date);
        if (record) {
            saveRecordLocal(record);
            return record;
        }
    } catch (err) {
        console.warn(`[Repository] Sync failed for ${date}:`, err);
    }
    return null;
};

/**
 * Initializes a new daily record for the given date.
 * If the record already exists, it is returned immediately.
 * 
 * @param date - Date in YYYY-MM-DD format to initialize
 * @param copyFromDate - Optional date to copy active patients and settings from
 * @returns Promise that resolves to the initialized or existing DailyRecord
 * 
 * @example
 * ```typescript
 * const record = await initializeDay('2024-12-25', '2024-12-24');
 * ```
 * 
 * @remarks
 * When copying from a previous date:
 * - Active patients are copied (name, rut, etc.)
 * - CUDYR scoring is reset for the new day
 * - Nursing shift notes are inherited (Previous night -> New day)
 * - Bed configurations (blocking, modes) are preserved
 */
export const initializeDay = async (
    date: string,
    copyFromDate?: string
): Promise<DailyRecord> => {
    // 1. Check if record already exists in LocalStorage or Firestore
    const localRecords = demoModeActive ? getDemoRecords() : getStoredRecords();
    if (localRecords[date]) return localRecords[date];

    if (!demoModeActive && firestoreEnabled) {
        try {
            const remoteRecord = await getRecordFromFirestore(date);
            if (remoteRecord) {
                console.log(`[Repository] Found existing record in Firestore for ${date}. Skipping initialization.`);
                saveRecordLocal(remoteRecord);
                return remoteRecord;
            }
        } catch (err) {
            console.warn(`[Repository] Failed to check Firestore for ${date} during init:`, err);
        }
    }

    let initialBeds: Record<string, PatientData> = {};
    let activeExtras: string[] = [];

    // Initialize empty beds structure
    BEDS.forEach(bed => {
        initialBeds[bed.id] = createEmptyPatient(bed.id);
    });

    let nursesDay: string[] = ["", ""];
    let nursesNight: string[] = ["", ""];
    let tensDay: string[] = ["", "", ""];
    let tensNight: string[] = ["", "", ""];

    // If a copyFromDate is provided, copy active patients and staff
    if (copyFromDate && localRecords[copyFromDate]) {
        const prevRecord = localRecords[copyFromDate];
        const prevBeds = prevRecord.beds;

        // Inherit staff: Previous night shift becomes the starting staff for the new day shift
        nursesDay = [...(prevRecord.nursesNightShift || ["", ""])];
        tensDay = [...(prevRecord.tensNightShift || ["", "", ""])];

        // Night shifts start empty for the new day
        nursesNight = ["", ""];
        tensNight = ["", "", ""];

        // Copy active extra beds setting
        activeExtras = [...(prevRecord.activeExtraBeds || [])];

        BEDS.forEach(bed => {
            const prevPatient = prevBeds[bed.id];
            if (prevPatient) {
                if (prevPatient.patientName || prevPatient.isBlocked) {
                    // Deep copy to prevent reference issues
                    initialBeds[bed.id] = clonePatient(prevPatient);

                    // Reset daily CUDYR scoring while keeping patient assignment
                    initialBeds[bed.id].cudyr = undefined;

                    // Inherit nursing shift notes from previous night to new day
                    // Previous night's notes become the starting point for the new day
                    const prevNightNote = prevPatient.handoffNoteNightShift || prevPatient.handoffNote || '';
                    initialBeds[bed.id].handoffNoteDayShift = prevNightNote;
                    initialBeds[bed.id].handoffNoteNightShift = prevNightNote;

                    // Clinical crib inheritance
                    if (initialBeds[bed.id].clinicalCrib && prevPatient.clinicalCrib) {
                        const cribPrevNight = prevPatient.clinicalCrib.handoffNoteNightShift || prevPatient.clinicalCrib.handoffNote || '';
                        initialBeds[bed.id].clinicalCrib!.handoffNoteDayShift = cribPrevNight;
                        initialBeds[bed.id].clinicalCrib!.handoffNoteNightShift = cribPrevNight;
                    }
                } else {
                    // Preserve configuration even if empty
                    initialBeds[bed.id].bedMode = prevPatient.bedMode || initialBeds[bed.id].bedMode;
                    initialBeds[bed.id].hasCompanionCrib = prevPatient.hasCompanionCrib || false;
                }

                // Keep location for extras
                if (prevPatient.location && bed.isExtra) {
                    initialBeds[bed.id].location = prevPatient.location;
                }
            }
        });
    }

    const newRecord: DailyRecord = {
        date,
        beds: initialBeds,
        discharges: [],
        transfers: [],
        cma: [],
        lastUpdated: new Date().toISOString(),
        nurses: ["", ""],
        nursesDayShift: nursesDay,
        nursesNightShift: nursesNight,
        tensDayShift: tensDay,
        tensNightShift: tensNight,
        activeExtraBeds: activeExtras
    };

    await save(newRecord);
    return newRecord;
};

/**
 * Deletes a daily record from both local and remote storage.
 * 
 * @param date - Date in YYYY-MM-DD format of the record to delete
 * @returns Promise that resolves when the record is deleted
 * 
 * @example
 * ```typescript
 * await deleteDay('2024-12-24');
 * ```
 */
export const deleteDay = async (date: string): Promise<void> => {
    if (demoModeActive) {
        deleteDemoRecord(date);
    } else {
        deleteRecordLocal(date);

        // Also delete from Firestore if enabled
        if (firestoreEnabled) {
            try {
                await deleteRecordFromFirestore(date);
            } catch (error) {
                console.error('Failed to delete from Firestore:', error);
            }
        }
    }
};

// ============================================================================
// Catalog Operations (Nurses, TENS)
// Centralizes all catalog storage in the repository
// ============================================================================

import {
    getStoredNurses,
    saveStoredNurses
} from '../storage/localStorageService';
import {
    subscribeToNurseCatalog,
    subscribeToTensCatalog,
    saveNurseCatalogToFirestore,
    saveTensCatalogToFirestore
} from '../storage/firestoreService';

const TENS_STORAGE_KEY = 'hanga_roa_tens_list';

/**
 * Retrieves the current catalog of nurse names from local storage.
 * 
 * @returns Array of nurse names
 */
export const getNurses = (): string[] => {
    return getStoredNurses();
};

/**
 * Saves the nurse catalog to local storage and syncs it with Firestore.
 * 
 * @param nurses - Array of nurse names to save
 * @returns Promise that resolves when saving is complete
 */
export const saveNurses = async (nurses: string[]): Promise<void> => {
    saveStoredNurses(nurses);
    if (firestoreEnabled && !demoModeActive) {
        try {
            await saveNurseCatalogToFirestore(nurses);
        } catch (err) {
            console.warn('Firestore nurse catalog sync failed:', err);
        }
    }
};

/**
 * Subscribes to real-time updates for the nurse catalog.
 * 
 * @param callback - Function called when the nurse catalog changes
 * @returns Unsubscribe function
 */
export const subscribeNurses = (callback: (nurses: string[]) => void): (() => void) => {
    // Demo mode check (but don't check firestoreEnabled since auth is verified by caller)
    if (demoModeActive) {
        console.log('[CatalogRepository] subscribeNurses: No-op (demo mode)');
        return () => { };
    }
    console.log('[CatalogRepository] subscribeNurses: Setting up Firestore subscription');
    return subscribeToNurseCatalog((nurses) => {
        console.log('[CatalogRepository] Received nurse catalog from Firestore:', nurses.length, 'items');
        // Mirror to localStorage for persistence
        saveStoredNurses(nurses);
        callback(nurses);
    });
};

/**
 * Retrieves the current catalog of TENS names from local storage.
 * 
 * @returns Array of TENS names
 */
export const getTens = (): string[] => {
    try {
        const data = localStorage.getItem(TENS_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

/**
 * Saves the TENS catalog to local storage and syncs it with Firestore.
 * 
 * @param tens - Array of TENS names to save
 * @returns Promise that resolves when saving is complete
 */
export const saveTens = async (tens: string[]): Promise<void> => {
    localStorage.setItem(TENS_STORAGE_KEY, JSON.stringify(tens));
    if (firestoreEnabled && !demoModeActive) {
        try {
            await saveTensCatalogToFirestore(tens);
        } catch (err) {
            console.warn('Firestore TENS catalog sync failed:', err);
        }
    }
};

/**
 * Subscribes to real-time updates for the TENS catalog.
 * 
 * @param callback - Function called when the TENS catalog changes
 * @returns Unsubscribe function
 */
export const subscribeTens = (callback: (tens: string[]) => void): (() => void) => {
    // Demo mode check (but don't check firestoreEnabled since auth is verified by caller)
    if (demoModeActive) {
        console.log('[CatalogRepository] subscribeTens: No-op (demo mode)');
        return () => { };
    }
    console.log('[CatalogRepository] subscribeTens: Setting up Firestore subscription');
    return subscribeToTensCatalog((tens) => {
        console.log('[CatalogRepository] Received TENS catalog from Firestore:', tens.length, 'items');
        // Mirror to localStorage for persistence
        localStorage.setItem(TENS_STORAGE_KEY, JSON.stringify(tens));
        callback(tens);
    });
};

// ============================================================================
// Repository Object Export (Alternative API)
// ============================================================================

/**
 * Repository interface for daily records.
 * Provides methods for CRUD operations and real-time synchronization.
 */
export const DailyRecordRepository: IDailyRecordRepository & { syncWithFirestore: typeof syncWithFirestore } = {
    getForDate,
    getPreviousDay,
    save,
    subscribe,
    initializeDay,
    deleteDay,
    syncWithFirestore
};

/**
 * Repository for managing catalogs (Nurses and TENS).
 */
export const CatalogRepository = {
    /** Gets the list of available nurses */
    getNurses,
    /** Saves the list of nurses */
    saveNurses,
    /** Subscribes to changes in the nurse list */
    subscribeNurses,
    /** Gets the list of available TENS */
    getTens,
    /** Saves the list of TENS */
    saveTens,
    /** Subscribes to changes in the TENS list */
    subscribeTens
};
