/**
 * Hooks Index
 * Centralized exports for all custom hooks
 * 
 * Usage: import { useAuthState, useDailyRecord } from './hooks';
 */

// Authentication
export { useAuthState } from './useAuthState';

// UI State Management
export { useModal } from './useModal';
export type { UseModalReturn } from './useModal';
export { useAppState } from './useAppState';
export type { UseAppStateReturn } from './useAppState';

// Daily Record Management
export { useDailyRecord } from './useDailyRecord';
export { useBedManagement } from './useBedManagement';
export { useClinicalCrib } from './useClinicalCrib';
export { useNurseManagement } from './useNurseManagement';
export { usePatientDischarges } from './usePatientDischarges';
export { usePatientTransfers } from './usePatientTransfers';
export { useCMA } from './useCMA';

// Extracted Hooks (from useBedManagement)
export { usePatientValidation } from './usePatientValidation';
export { useBedOperations } from './useBedOperations';

// Date Navigation
export { useDateNavigation } from './useDateNavigation';
export { useExistingDays } from './useExistingDays';
export { useExistingDaysQuery, usePrefetchAdjacentMonths } from './useExistingDaysQuery';
export { useSignatureMode } from './useSignatureMode';

// React Query Hooks
export { useDailyRecordQuery, useSaveDailyRecordMutation, usePrefetchDailyRecord, useInvalidateDailyRecord } from './useDailyRecordQuery';
export { useFileOperations } from './useFileOperations';

// Email
export { useCensusEmail } from './useCensusEmail';
export { useHandoffLogic } from './useHandoffLogic';

// Re-export types from hooks that define them
export type { DailyRecordContextType, DailyRecordPatch, DailyRecordPatchLoose } from './useDailyRecordTypes';
export type { SyncStatus } from './useDailyRecordTypes';
export type { BedManagementActions } from './useBedManagement';
export type { ClinicalCribActions } from './useClinicalCrib';
export type { ValidationResult, PatientValidationActions } from './usePatientValidation';
export type { BedOperationsActions } from './useBedOperations';

// Internal sync hook (exposed for testing/advanced use)


// Feature Flags
export { useFeatureFlag, useAllFeatureFlags } from './useFeatureFlag';

