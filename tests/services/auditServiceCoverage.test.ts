// Must unmock to test real implementation, as setup.ts mocks it globally
vi.unmock('../../services/admin/auditService');

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as auditService from '../../services/admin/auditService';
import { auth } from '../../firebaseConfig';
import { setDoc } from 'firebase/firestore';

// Mock dependencies
vi.mock('../../firebaseConfig', () => ({
    auth: { currentUser: { email: 'tester@hospital.cl' } },
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn(), // We will override this
    getDocs: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    where: vi.fn(),
    Timestamp: { now: () => 'MOCK_TIMESTAMP' }
}));

const mockSaveAuditLog = vi.fn();
const mockGetAuditLogs = vi.fn();

vi.mock('../../services/storage/indexedDBService', () => ({
    saveAuditLog: (log: any) => mockSaveAuditLog(log),
    getAuditLogs: (limit: number) => mockGetAuditLogs(limit),
    getAuditLogsForDate: vi.fn()
}));

const { mockAuditUtils } = vi.hoisted(() => ({
    mockAuditUtils: {
        getCurrentUserEmail: vi.fn(() => 'tester@hospital.cl'),
        getCurrentUserDisplayName: vi.fn(),
        getCurrentUserUid: vi.fn(),
        getCachedIpAddress: vi.fn(),
        fetchAndCacheIpAddress: vi.fn()
    }
}));

vi.mock('../../services/admin/utils/auditUtils', () => mockAuditUtils);

vi.mock('../../services/admin/utils/auditSummaryGenerator', () => ({
    generateSummary: vi.fn((action, details, entityId) => `Summary for ${action}`)
}));

const AUDIT_STORAGE_KEY = 'hanga_roa_audit_logs';

describe('AuditService Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
    });

    it('should catch Firestore errors silently and rely on local storage', async () => {
        // Setup: Firestore throws error
        (setDoc as any).mockRejectedValue(new Error('Firestore Offline'));

        const spyConsole = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Act
        await auditService.logAuditEvent('user1', 'USER_LOGIN', 'user', 'user1', {});

        // Assert
        expect(setDoc).toHaveBeenCalled();
        expect(spyConsole).toHaveBeenCalledWith('Failed to save audit log to Firestore:', expect.any(Error));

        // Verify local storage is still populated (via mock)
        expect(mockSaveAuditLog).toHaveBeenCalled();
        expect(mockSaveAuditLog.mock.calls[0][0].action).toBe('USER_LOGIN');
    });

    it('should call saveAuditLog regardless of Firestore status', async () => {
        // Act: Add 1 new log
        await auditService.logAuditEvent('user1', 'USER_LOGOUT' as any, 'user', 'user1', {});

        // Assert
        expect(mockSaveAuditLog).toHaveBeenCalled();
        expect(mockSaveAuditLog.mock.calls[0][0].action).toBe('USER_LOGOUT');
    });

    it('should exclude view logging for specific emails', async () => {
        // Setup: Mock current user as restricted email via mockAuditUtils
        mockAuditUtils.getCurrentUserEmail.mockReturnValue('daniel.opazo@hospitalhangaroa.cl');

        // Act
        await auditService.logPatientView('B01', 'Patient', '11.111.111-1', '2024-01-01');

        // Assert
        expect(setDoc).not.toHaveBeenCalled();

        // Check local storage is empty
        expect(localStorage.getItem(AUDIT_STORAGE_KEY)).toBeNull();
    });

    it('should log view access for non-excluded users', async () => {
        // Setup: Normal user via mockAuditUtils
        mockAuditUtils.getCurrentUserEmail.mockReturnValue('random.doctor@hospital.cl');

        // Act
        await auditService.logPatientView('B01', 'Patient', '11.111.111-1', '2024-01-01');

        // Assert
        expect(setDoc).toHaveBeenCalled();
    });

    it('should calculate session duration on logout', async () => {
        // Setup login time 1 minute ago
        const startTime = new Date(Date.now() - 60000).toISOString();
        sessionStorage.setItem('hhr_session_start', startTime);

        // Act
        await auditService.logUserLogout('user1', 'manual');

        // Assert
        const callArgs = (setDoc as any).mock.calls[0][1];
        expect(callArgs.details.durationSeconds).toBeGreaterThanOrEqual(60);
        expect(callArgs.details.durationFormatted).toMatch(/1m/);
        expect(sessionStorage.getItem('hhr_session_start')).toBeNull();
    });
});
