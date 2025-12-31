import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import { logPatientAdmission } from '@/services/admin/auditService';
import { useBedManagement } from '@/hooks/useBedManagement';
import { DailyRecord, PatientData, Specialty, PatientStatus } from '@/types';

// Mock createEmptyPatient from the correct location
vi.mock('@/services/factories/patientFactory', () => ({
    createEmptyPatient: vi.fn((bedId: string) => ({
        bedId,
        patientName: '',
        rut: '',
        age: '',
        pathology: '',
        specialty: Specialty.MEDICINA,
        status: PatientStatus.ESTABLE,
        admissionDate: '',
        hasWristband: false,
        devices: [],
        surgicalComplication: false,
        isUPC: false,
        isBlocked: false,
        bedMode: 'Cama' as const,
        hasCompanionCrib: false
    })),
    clonePatient: vi.fn((patient: PatientData, newBedId: string) => ({
        ...patient,
        bedId: newBedId
    }))
}));

vi.mock('@/services/admin/auditService', () => ({
    logPatientAdmission: vi.fn(),
    logPatientCleared: vi.fn()
}));

describe('useBedManagement', () => {
    const mockSaveAndUpdate = vi.fn();
    const mockPatchRecord = vi.fn().mockResolvedValue(undefined);

    const createMockPatient = (bedId: string, overrides: Partial<PatientData> = {}): PatientData => ({
        bedId,
        patientName: 'Test Patient',
        rut: '12.345.678-9',
        age: '45',
        pathology: 'Test Diagnosis',
        specialty: Specialty.MEDICINA,
        status: PatientStatus.ESTABLE,
        admissionDate: '2025-01-01',
        hasWristband: true,
        devices: [],
        surgicalComplication: false,
        isUPC: false,
        isBlocked: false,
        bedMode: 'Cama',
        hasCompanionCrib: false,
        ...overrides
    });

    const createMockRecord = (beds: Record<string, PatientData> = {}): DailyRecord => ({
        date: '2025-01-01',
        beds,
        discharges: [],
        transfers: [],
        lastUpdated: new Date().toISOString(),
        nurses: [],
        activeExtraBeds: [],
        cma: []
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('updatePatient', () => {
        it('should update a single patient field via patchRecord', () => {
            const patient = createMockPatient('R1');
            const record = createMockRecord({ R1: patient });

            const { result } = renderHook(() => useBedManagement(record, mockSaveAndUpdate, mockPatchRecord));

            act(() => {
                result.current.updatePatient('R1', 'patientName', 'New Name');
            });

            expect(mockPatchRecord).toHaveBeenCalledWith({
                'beds.R1.patientName': 'New Name'
            });
        });

        it('should not update admissionDate to future date', () => {
            const patient = createMockPatient('R1');
            const record = createMockRecord({ R1: patient });
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 5);

            const { result } = renderHook(() => useBedManagement(record, mockSaveAndUpdate, mockPatchRecord));

            act(() => {
                result.current.updatePatient('R1', 'admissionDate', futureDate.toISOString().split('T')[0]);
            });

            expect(mockPatchRecord).not.toHaveBeenCalled();
        });
    });

    describe('updatePatientMultiple', () => {
        it('should update multiple fields atomically via patchRecord', () => {
            const patient = createMockPatient('R1');
            const record = createMockRecord({ R1: patient });

            const { result } = renderHook(() => useBedManagement(record, mockSaveAndUpdate, mockPatchRecord));

            act(() => {
                result.current.updatePatientMultiple('R1', {
                    patientName: 'Updated Name',
                    age: '50'
                });
            });

            expect(mockPatchRecord).toHaveBeenCalledWith({
                'beds.R1.patientName': 'Updated Name',
                'beds.R1.age': '50'
            });
        });
    });

    describe('clearPatient', () => {
        it('should reset patient via patchRecord', () => {
            const patient = createMockPatient('R1', { patientName: 'Test' });
            const record = createMockRecord({ R1: patient });

            const { result } = renderHook(() => useBedManagement(record, mockSaveAndUpdate, mockPatchRecord));

            act(() => {
                result.current.clearPatient('R1');
            });

            expect(mockPatchRecord).toHaveBeenCalledWith(expect.objectContaining({
                'beds.R1': expect.objectContaining({ patientName: '' })
            }));
        });
    });

    describe('toggleBlockBed', () => {
        it('should block bed via patchRecord', () => {
            const patient = createMockPatient('R1', { isBlocked: false });
            const record = createMockRecord({ R1: patient });

            const { result } = renderHook(() => useBedManagement(record, mockSaveAndUpdate, mockPatchRecord));

            act(() => {
                result.current.toggleBlockBed('R1', 'Mantenimiento');
            });

            expect(mockPatchRecord).toHaveBeenCalledWith({
                'beds.R1.isBlocked': true,
                'beds.R1.blockedReason': 'Mantenimiento'
            });
        });
    });

    describe('toggleExtraBed', () => {
        it('should update activeExtraBeds via patchRecord', () => {
            const record = createMockRecord();

            const { result } = renderHook(() => useBedManagement(record, mockSaveAndUpdate, mockPatchRecord));

            act(() => {
                result.current.toggleExtraBed('E1');
            });

            expect(mockPatchRecord).toHaveBeenCalledWith({
                activeExtraBeds: ['E1']
            });
        });
    });

    describe('updateCudyr', () => {
        it('should update Cudyr score field via patchRecord', () => {
            const patient = createMockPatient('R1');
            const record = createMockRecord({ R1: patient });

            const { result } = renderHook(() => useBedManagement(record, mockSaveAndUpdate, mockPatchRecord));

            act(() => {
                result.current.updateCudyr('R1', 'changeClothes', 3);
            });

            expect(mockPatchRecord).toHaveBeenCalledWith({
                'beds.R1.cudyr.changeClothes': 3
            });
        });
    });

    describe('Audit Logging', () => {
        it('should log patient admission when patientName is set for the first time', () => {
            const emptyPatient = createEmptyPatient('R1');
            const record = createMockRecord({ R1: emptyPatient });

            const { result } = renderHook(() => useBedManagement(record, mockSaveAndUpdate, mockPatchRecord));

            act(() => {
                result.current.updatePatient('R1', 'patientName', 'New Admission');
            });

            expect(logPatientAdmission).toHaveBeenCalledWith(
                'R1',
                'New Admission',
                emptyPatient.rut,
                '', // pathology
                record.date
            );
        });
    });
});
