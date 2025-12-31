/**
 * Audit Summary Generator
 * Provides human-readable descriptions for audit log entries.
 */

import { AuditAction } from '../../../types/audit';

/**
 * Generate human-readable summary for audit entry
 */
export const generateSummary = (
    action: AuditAction,
    details: Record<string, unknown>,
    entityId: string
): string => {
    const patientName = (details.patientName as string) || 'Paciente';
    const bedId = (details.bedId as string) || entityId;

    switch (action) {
        case 'PATIENT_ADMITTED':
            const dx = (details.pathology as string) ? ` [Dx: ${details.pathology}]` : '';
            return `Ingreso: ${patientName}${dx} → Cama ${bedId}`;
        case 'PATIENT_DISCHARGED':
            return `Alta: ${patientName} (${(details.status as string) || 'Egreso'})`;
        case 'PATIENT_TRANSFERRED':
            return `Traslado: ${patientName} → ${(details.destination as string) || 'otro centro'}`;
        case 'PATIENT_MODIFIED':
            return `Datos actualizados: ${patientName}`;
        case 'PATIENT_CLEARED':
            return `Cama liberada: ${bedId}`;
        case 'DAILY_RECORD_CREATED':
            return `Registro creado: ${entityId}${details.copiedFrom ? ` (copiado de ${details.copiedFrom})` : ''}`;
        case 'DAILY_RECORD_DELETED':
            return `Registro eliminado: ${entityId}`;
        case 'CUDYR_MODIFIED':
            return `CUDYR modificado: ${patientName}`;
        case 'NURSE_HANDOFF_MODIFIED':
            return `Nota enfermería (${(details.shift as string) === 'day' ? 'Día' : 'Noche'})`;
        case 'MEDICAL_HANDOFF_MODIFIED':
            return `Evolución médica actualizada`;
        case 'HANDOFF_NOVEDADES_MODIFIED':
            return `Novedades actualizadas (${(details.shift as string) || 'turno'})`;
        case 'VIEW_CUDYR':
            return `Vista: Planilla CUDYR`;
        case 'VIEW_NURSING_HANDOFF':
            return `Vista: Entrega Enfermería`;
        case 'VIEW_MEDICAL_HANDOFF':
            return `Vista: Entrega Médica`;
        case 'USER_LOGIN':
            return `Inicio de sesión`;
        case 'USER_LOGOUT':
            return `Cierre de sesión${details.durationFormatted ? ` (${details.durationFormatted})` : ''}`;
        case 'PATIENT_VIEWED':
            return `Ficha visualizada: ${patientName}`;
        case 'BED_BLOCKED':
            return `Cama bloqueada: ${bedId}${details.reason ? ` (${details.reason})` : ''}`;
        case 'BED_UNBLOCKED':
            return `Cama desbloqueada: ${bedId}`;
        case 'EXTRA_BED_TOGGLED':
            return `${details.active ? 'Activada' : 'Desactivada'} cama extra: ${bedId}`;
        case 'MEDICAL_HANDOFF_SIGNED':
            return `Entrega médica firmada: ${(details.doctorName as string) || 'Médico'}`;
        default:
            return action;
    }
};
