/**
 * useDailyRecordSyncQuery Hook
 * Replaces useDailyRecordSync logic with TanStack Query.
 * Provides the same interface for compatibility.
 */

import { useCallback, useMemo } from 'react';
import { useDailyRecordQuery, useSaveDailyRecordMutation, usePatchDailyRecordMutation } from './useDailyRecordQuery';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { SyncStatus, UseDailyRecordSyncResult } from './useDailyRecordSync';
import { DailyRecord } from '../types';
import { DailyRecordPatchLoose } from './useDailyRecordTypes';

export const useDailyRecordSyncQuery = (
    currentDateString: string,
    _isOfflineMode: boolean = false, // Handled implicitly by TanStack Query & Repository
    _isFirebaseConnected: boolean = false
): UseDailyRecordSyncResult => {
    const queryClient = useQueryClient();

    // 1. Fetching
    const {
        data: record,
        status,
        dataUpdatedAt,
        fetchStatus,
        refetch
    } = useDailyRecordQuery(currentDateString, _isOfflineMode, _isFirebaseConnected);

    // 2. Mutations
    const saveMutation = useSaveDailyRecordMutation();
    const patchMutation = usePatchDailyRecordMutation(currentDateString);

    // 3. Status Mapping
    const syncStatus = useMemo((): SyncStatus => {
        if (saveMutation.isPending || patchMutation.isPending) return 'saving';
        if (saveMutation.isError || patchMutation.isError) return 'error';
        if (saveMutation.isSuccess || patchMutation.isSuccess) return 'saved';
        return 'idle';
    }, [saveMutation.isPending, patchMutation.isPending, saveMutation.isError, patchMutation.isError, saveMutation.isSuccess, patchMutation.isSuccess]);

    const lastSyncTime = useMemo(() =>
        dataUpdatedAt ? new Date(dataUpdatedAt) : null,
        [dataUpdatedAt]);

    // 4. Compatibility handlers
    const saveAndUpdate = useCallback(async (updatedRecord: DailyRecord) => {
        await saveMutation.mutateAsync(updatedRecord);
    }, [saveMutation]);

    const patchRecord = useCallback(async (partial: DailyRecordPatchLoose) => {
        await patchMutation.mutateAsync(partial);
    }, [patchMutation]);

    const setRecord = useCallback((updater: DailyRecord | null | ((prev: DailyRecord | null) => DailyRecord | null)) => {
        const key = queryKeys.dailyRecord.byDate(currentDateString);
        queryClient.setQueryData(key, updater);
        queryClient.invalidateQueries({ queryKey: key });
    }, [queryClient, currentDateString]);

    const markLocalChange = useCallback(() => {
        // TanStack Query handles local changes via optimistic updates in mutations.
        // For ad-hoc changes not through mutations, we can manual update cache if needed.
    }, []);

    const refresh = useCallback(() => {
        refetch();
    }, [refetch]);

    return {
        record: record ?? null,
        setRecord,
        syncStatus,
        lastSyncTime,
        saveAndUpdate,
        patchRecord,
        markLocalChange,
        refresh
    };
};
