/**
 * Sync Watcher
 * Observes sync status changes and shows notifications accordingly.
 * This component must be placed inside NotificationProvider.
 */

import React, { useEffect, useRef } from 'react';
import { useNotification } from '../../context/UIContext';
import { useDailyRecordContext } from '../../context/DailyRecordContext';
import { useAuth } from '../../context/AuthContext';
import { useDemoMode } from '../../context/DemoModeContext';

export const SyncWatcher: React.FC = () => {
    const { syncStatus } = useDailyRecordContext();
    const { error, success, warning } = useNotification();
    const { isFirebaseConnected } = useAuth();
    const { isActive: isDemoMode } = useDemoMode();

    // Track previous status to detect changes
    const prevStatusRef = useRef(syncStatus);

    useEffect(() => {
        const prevStatus = prevStatusRef.current;
        prevStatusRef.current = syncStatus;

        // Only show notification when status changes
        if (prevStatus === syncStatus) return;

        if (syncStatus === 'error' && prevStatus !== 'error') {
            error('Error de sincronización', 'Los cambios se guardaron localmente pero no se pudieron sincronizar con el servidor.');
        }

        // Warn if saved but offline (and not in demo mode)
        if (syncStatus === 'saved' && prevStatus !== 'saved') {
            if (!isDemoMode && !isFirebaseConnected) {
                warning('Sin conexión', 'Guardado localmente. Se sincronizará al recuperar conexión.');
            }
        }

        // Optionally show success after saving (uncomment if desired)
        // if (syncStatus === 'saved' && prevStatus === 'saving') {
        //     success('Guardado', 'Cambios sincronizados correctamente');
        // }

    }, [syncStatus, error, success, warning]);

    return null; // This component doesn't render anything
};
