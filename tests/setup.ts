import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test case
afterEach(() => {
    cleanup();
});

// Mock Firebase Auth user
const mockUser = {
    uid: 'test-user-123',
    email: 'test@hospital.cl',
    displayName: 'Test User',
    getIdToken: vi.fn().mockResolvedValue('mock-token'),
};

// Mock Firebase Auth
const mockAuth = {
    currentUser: mockUser,
    onAuthStateChanged: vi.fn((callback: (user: typeof mockUser | null) => void) => {
        // Immediately call the callback with mock user synchronously for deterministic tests
        callback(mockUser);
        // Return unsubscribe function
        return vi.fn();
    }),
    signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user: mockUser }),
    signOut: vi.fn().mockResolvedValue(undefined),
    onIdTokenChanged: vi.fn(() => vi.fn()),
};

// Mock Firestore
const mockDoc = {
    id: 'mock-doc-id',
    data: () => ({}),
    exists: () => true,
};

const mockFirestore = {
    collection: vi.fn(() => ({
        doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue(mockDoc),
            set: vi.fn().mockResolvedValue(undefined),
            update: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
            onSnapshot: vi.fn(() => vi.fn()),
        })),
        add: vi.fn().mockResolvedValue({ id: 'new-doc-id' }),
        where: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ docs: [] }),
            onSnapshot: vi.fn(() => vi.fn()),
        })),
    })),
    doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue(mockDoc),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        onSnapshot: vi.fn(() => vi.fn()),
    })),
};

// Mock Firebase to prevent initialization errors in tests
const firebaseMock = {
    auth: mockAuth,
    db: mockFirestore,
    storage: {},
    firebaseReady: Promise.resolve({ auth: mockAuth, db: mockFirestore }),
    mountConfigWarning: () => { }
};

vi.mock('./firebaseConfig', () => firebaseMock);
vi.mock('@/firebaseConfig', () => firebaseMock);

// Mock firebase/auth module
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => mockAuth),
    onAuthStateChanged: vi.fn((auth, callback) => {
        callback(mockUser);
        return vi.fn();
    }),
    signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user: mockUser }),
    signOut: vi.fn().mockResolvedValue(undefined),
    onIdTokenChanged: vi.fn(() => vi.fn()),
    GoogleAuthProvider: class {
        static credential = vi.fn();
        setCustomParameters = vi.fn();
    },
}));

// Mock auditService globally to prevent Firebase dependency chain execution
vi.mock('./services/admin/auditService', () => ({
    logAuditEvent: vi.fn(),
    logPatientAdmission: vi.fn(),
    logPatientDischarge: vi.fn(),
    logPatientTransfer: vi.fn(),
    logPatientCleared: vi.fn(),
    logPatientView: vi.fn(),
    logDailyRecordDeleted: vi.fn(),
    logDailyRecordCreated: vi.fn(),
    getAuditLogs: vi.fn().mockResolvedValue([]),
    getAuditLogsForDate: vi.fn().mockResolvedValue([]),
    getLocalAuditLogs: vi.fn().mockReturnValue([]),
    AUDIT_ACTION_LABELS: {}
}));

vi.mock('@/services/admin/auditService', () => ({
    logAuditEvent: vi.fn(),
    logPatientAdmission: vi.fn(),
    logPatientDischarge: vi.fn(),
    logPatientTransfer: vi.fn(),
    logPatientCleared: vi.fn(),
    logPatientView: vi.fn(),
    logDailyRecordDeleted: vi.fn(),
    logDailyRecordCreated: vi.fn(),
    getAuditLogs: vi.fn().mockResolvedValue([]),
    getAuditLogsForDate: vi.fn().mockResolvedValue([]),
    getLocalAuditLogs: vi.fn().mockReturnValue([]),
    AUDIT_ACTION_LABELS: {}
}));

// Mock AuditContext to prevent "must be used within AuditProvider" errors
const mockAuditContextValue = {
    logPatientAdmission: vi.fn(),
    logPatientDischarge: vi.fn(),
    logPatientTransfer: vi.fn(),
    logPatientCleared: vi.fn(),
    logDailyRecordDeleted: vi.fn(),
    logDailyRecordCreated: vi.fn(),
    logPatientView: vi.fn(),
    logEvent: vi.fn(),
    logDebouncedEvent: vi.fn(),
    fetchLogs: vi.fn().mockResolvedValue([]),
    getActionLabel: vi.fn().mockReturnValue(''),
    userId: 'test-user-123'
};

vi.mock('./context/AuditContext', () => ({
    AuditProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuditContext: () => mockAuditContextValue
}));

vi.mock('@/context/AuditContext', () => ({
    AuditProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuditContext: () => mockAuditContextValue
}));

// Export mock user for use in tests
export { mockUser, mockAuth, mockFirestore, mockAuditContextValue };

