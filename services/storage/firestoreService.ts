import {
    collection,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    getDocs,
    query,
    orderBy,
    Timestamp,
    onSnapshot,
    where,
    updateDoc
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { DailyRecord } from '../../types';
import { DailyRecordSchema } from '../../schemas/zodSchemas';
import {
    HOSPITAL_ID,
    COLLECTIONS,
    HOSPITAL_COLLECTIONS,
    SETTINGS_DOCS
} from '../../constants/firestorePaths';

// Get collection reference using typed constants
const getRecordsCollection = () => collection(
    db,
    COLLECTIONS.HOSPITALS,
    HOSPITAL_ID,
    HOSPITAL_COLLECTIONS.DAILY_RECORDS
);

/**
 * Recursively convert undefined values to null for Firestore compatibility.
 * Firestore's merge mode ignores undefined values, but respects null.
 * This ensures that deleted fields (like clinicalCrib) are properly synced.
 */
const sanitizeForFirestore = (obj: unknown): unknown => {
    if (obj === undefined) {
        return null;
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirestore);
    }
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof Timestamp)) {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
            result[k] = sanitizeForFirestore(v);
        }
        return result;
    }
    return obj;
};

// Sanitize beds to convert null clinicalCrib to undefined
const sanitizeBeds = (beds: DailyRecord['beds']): DailyRecord['beds'] => {
    const result: DailyRecord['beds'] = {};
    for (const [bedId, patient] of Object.entries(beds)) {
        result[bedId] = {
            ...patient,
            // Convert null clinicalCrib to undefined
            clinicalCrib: patient.clinicalCrib === null ? undefined : patient.clinicalCrib
        };
    }
    return result;
};

// Convert Firestore data to DailyRecord
// Preserves ALL data from Firestore with minimal validation
const docToRecord = (docData: Record<string, unknown>, docId: string): DailyRecord => {
    const rawBeds = (docData.beds as DailyRecord['beds']) || {};

    // Transform Firestore Timestamp to ISO string
    const lastUpdated = docData.lastUpdated instanceof Timestamp
        ? docData.lastUpdated.toDate().toISOString()
        : (docData.lastUpdated as string) || new Date().toISOString();

    // Return record preserving ALL fields from Firestore
    // Using spread of docData first, then overriding with sanitized values

    return {
        // Spread ALL Firestore data first
        ...(docData as Partial<DailyRecord>),
        // Override with sanitized/required values
        date: docId,
        beds: sanitizeBeds(rawBeds),
        lastUpdated,
        discharges: (docData.discharges as DailyRecord['discharges']) || [],
        transfers: (docData.transfers as DailyRecord['transfers']) || [],
        cma: (docData.cma as DailyRecord['cma']) || [],
        nurses: (docData.nurses as string[]) || ['', ''],
        nursesDayShift: Array.isArray(docData.nursesDayShift) ? [...docData.nursesDayShift, '', ''].slice(0, 2) : ['', ''],
        nursesNightShift: Array.isArray(docData.nursesNightShift) ? [...docData.nursesNightShift, '', ''].slice(0, 2) : ['', ''],
        tensDayShift: Array.isArray(docData.tensDayShift) ? [...docData.tensDayShift, '', '', ''].slice(0, 3) : ['', '', ''],
        tensNightShift: Array.isArray(docData.tensNightShift) ? [...docData.tensNightShift, '', '', ''].slice(0, 3) : ['', '', ''],
        activeExtraBeds: (docData.activeExtraBeds as string[]) || [],

        // === Explicitly preserve/convert medical handoff fields ===
        // IMPORTANT: Firestore stores undefined as null. We convert back to undefined.
        medicalHandoffDoctor: (docData.medicalHandoffDoctor as string) || undefined,
        medicalHandoffSentAt: (docData.medicalHandoffSentAt as string) || undefined,
        medicalSignature: (docData.medicalSignature as DailyRecord['medicalSignature']) || undefined
    } as DailyRecord;
};

/**
 * Saves a complete DailyRecord to Firestore.
 * Performs sanitization to ensure compatibility with Firestore.
 * 
 * @param record - The DailyRecord object to persist
 * @returns Promise that resolves when the save operation is finished
 * 
 * @example
 * ```typescript
 * await saveRecordToFirestore(myRecord);
 * ```
 */
export const saveRecordToFirestore = async (record: DailyRecord): Promise<void> => {
    try {
        const docRef = doc(getRecordsCollection(), record.date);

        // Sanitize data to convert undefined to null
        // This ensures deletions (like removing clinicalCrib) are properly synced
        const sanitizedRecord = sanitizeForFirestore({
            ...record,
            lastUpdated: Timestamp.now()
        });

        // Use setDoc WITHOUT merge to ensure deletions are reflected
        await setDoc(docRef, sanitizedRecord as Record<string, unknown>);
        console.log('✅ Saved to Firestore:', record.date);
    } catch (error) {
        console.error('❌ Error saving to Firestore:', error);
        throw error;
    }
};

/**
 * Performs a partial update to a DailyRecord in Firestore using dot-notation paths.
 * This is efficient as it only modifies the specified fields.
 * 
 * @param date - The date identifier (YYYY-MM-DD)
 * @param partialData - Object containing flattened key paths
 * @returns Promise that resolves when the update is finished
 * 
 * @example
 * ```typescript
 * await updateRecordPartial('2024-12-24', { 'beds.BED_01.isBlocked': true });
 * ```
 */
export const updateRecordPartial = async (date: string, partialData: Partial<DailyRecord>): Promise<void> => {
    try {
        const docRef = doc(getRecordsCollection(), date);

        // Add timestamp and sanitize
        const sanitizedData = sanitizeForFirestore({
            ...partialData,
            lastUpdated: Timestamp.now()
        });

        await updateDoc(docRef, sanitizedData as Record<string, unknown>);
        console.log('✅ Partial update to Firestore:', date, Object.keys(partialData));
    } catch (error) {
        console.error('❌ Error in partial update to Firestore:', error);
        throw error;
    }
};

/**
 * Retrieves a DailyRecord from Firestore for a specific date.
 * 
 * @param date - Date identifier in YYYY-MM-DD format
 * @returns The DailyRecord if found, null otherwise
 */
export const getRecordFromFirestore = async (date: string): Promise<DailyRecord | null> => {
    try {
        const docRef = doc(getRecordsCollection(), date);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docToRecord(docSnap.data(), date);
        }
        return null;
    } catch (error) {
        console.error('❌ Error getting record from Firestore:', error);
        return null;
    }
};

// Delete a record from Firestore
export const deleteRecordFromFirestore = async (date: string): Promise<void> => {
    try {
        const docRef = doc(getRecordsCollection(), date);
        await deleteDoc(docRef);
        console.log('🗑️ Deleted from Firestore:', date);
    } catch (error) {
        console.error('❌ Error deleting from Firestore:', error);
        throw error;
    }
};

// Get all records from Firestore
export const getAllRecordsFromFirestore = async (): Promise<Record<string, DailyRecord>> => {
    try {
        const q = query(getRecordsCollection(), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);

        const records: Record<string, DailyRecord> = {};
        querySnapshot.forEach((doc) => {
            records[doc.id] = docToRecord(doc.data(), doc.id);
        });

        return records;
    } catch (error) {
        console.error('❌ Error getting all records from Firestore:', error);
        return {};
    }
};

// Get records for a specific month
export const getMonthRecordsFromFirestore = async (year: number, month: number): Promise<DailyRecord[]> => {
    try {
        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-31`;

        const q = query(
            getRecordsCollection(),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => docToRecord(doc.data(), doc.id));
    } catch (error) {
        console.error('❌ Error getting month records:', error);
        return [];
    }
};

// Real-time listener for a specific date
export const subscribeToRecord = (
    date: string,
    callback: (record: DailyRecord | null) => void
): (() => void) => {
    const docRef = doc(getRecordsCollection(), date);

    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docToRecord(docSnap.data(), date));
        } else {
            callback(null);
        }
    }, (error) => {
        console.error('❌ Firestore subscription error:', error);
        callback(null);
    });
};

// Check if Firestore is available (online)
export const isFirestoreAvailable = async (): Promise<boolean> => {
    try {
        // Try a simple read operation
        const docRef = doc(db, 'hospitals', HOSPITAL_ID);
        await getDoc(docRef);
        return true;
    } catch (error) {
        return false;
    }
};

// ============================================================================
// Nurse Catalog Persistence
// ============================================================================

/**
 * Get the nurse catalog from Firestore
 */
export const getNurseCatalogFromFirestore = async (): Promise<string[]> => {
    try {
        const docRef = doc(db, COLLECTIONS.HOSPITALS, HOSPITAL_ID, HOSPITAL_COLLECTIONS.SETTINGS, SETTINGS_DOCS.NURSES);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return (data.list as string[]) || [];
        }
        return [];
    } catch (error) {
        console.error('Error fetching nurse catalog from Firestore:', error);
        return [];
    }
};

/**
 * Save the nurse catalog to Firestore
 */
export const saveNurseCatalogToFirestore = async (nurses: string[]): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTIONS.HOSPITALS, HOSPITAL_ID, HOSPITAL_COLLECTIONS.SETTINGS, SETTINGS_DOCS.NURSES);
        await setDoc(docRef, {
            list: nurses,
            lastUpdated: new Date().toISOString()
        });
        console.log('✅ Nurse catalog saved to Firestore');
    } catch (error) {
        console.error('Error saving nurse catalog to Firestore:', error);
        throw error;
    }
};

/**
 * Subscribe to nurse catalog changes in real-time
 */
export const subscribeToNurseCatalog = (callback: (nurses: string[]) => void): (() => void) => {
    const docRef = doc(db, COLLECTIONS.HOSPITALS, HOSPITAL_ID, HOSPITAL_COLLECTIONS.SETTINGS, SETTINGS_DOCS.NURSES);
    console.log('[Firestore] Setting up nurse catalog subscription...');

    return onSnapshot(docRef, (docSnap) => {
        console.log('[Firestore] Nurse catalog snapshot received, exists:', docSnap.exists());
        if (docSnap.exists()) {
            const data = docSnap.data();
            const nurses = (data.list as string[]) || [];
            console.log('[Firestore] Nurse catalog data:', nurses);
            callback(nurses);
        } else {
            console.log('[Firestore] Nurse catalog document does not exist');
            callback([]);
        }
    }, (error) => {
        console.error('❌ Error subscribing to nurse catalog:', error);
        callback([]);
    });
};




// ============================================================================
// TENS Catalog Persistence
// ============================================================================

/**
 * Get the TENS catalog from Firestore
 */
export const getTensCatalogFromFirestore = async (): Promise<string[]> => {
    try {
        const docRef = doc(db, COLLECTIONS.HOSPITALS, HOSPITAL_ID, HOSPITAL_COLLECTIONS.SETTINGS, SETTINGS_DOCS.TENS);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return (data.list as string[]) || [];
        }
        return [];
    } catch (error) {
        console.error('Error fetching TENS catalog from Firestore:', error);
        return [];
    }
};

/**
 * Save the TENS catalog to Firestore
 */
export const saveTensCatalogToFirestore = async (tens: string[]): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTIONS.HOSPITALS, HOSPITAL_ID, HOSPITAL_COLLECTIONS.SETTINGS, SETTINGS_DOCS.TENS);
        await setDoc(docRef, {
            list: tens,
            lastUpdated: new Date().toISOString()
        });
        console.log('✅ TENS catalog saved to Firestore');
    } catch (error) {
        console.error('Error saving TENS catalog to Firestore:', error);
        throw error;
    }
};

/**
 * Subscribe to TENS catalog changes in real-time
 */
export const subscribeToTensCatalog = (callback: (tens: string[]) => void): (() => void) => {
    const docRef = doc(db, COLLECTIONS.HOSPITALS, HOSPITAL_ID, HOSPITAL_COLLECTIONS.SETTINGS, SETTINGS_DOCS.TENS);
    console.log('[Firestore] Setting up TENS catalog subscription...');

    return onSnapshot(docRef, (docSnap) => {
        console.log('[Firestore] TENS catalog snapshot received, exists:', docSnap.exists());
        if (docSnap.exists()) {
            const data = docSnap.data();
            const tens = (data.list as string[]) || [];
            console.log('[Firestore] TENS catalog data:', tens);
            callback(tens);
        } else {
            console.log('[Firestore] TENS catalog document does not exist');
            callback([]);
        }
    }, (error) => {
        console.error('❌ Error subscribing to TENS catalog:', error);
        callback([]);
    });
};
