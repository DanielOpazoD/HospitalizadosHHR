/**
 * Date Formatting Utilities
 * Pure functions for date manipulation and formatting.
 */

/**
 * Format ISO date string (YYYY-MM-DD) to DD-MM-YYYY format
 */
export const formatDateDDMMYYYY = (isoDate?: string): string => {
    if (!isoDate) return '-';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export const getTodayISO = (): string => {
    return new Date().toISOString().split('T')[0];
};

/**
 * Format date for display in UI (Spanish locale)
 * Example: "miércoles, 11 de diciembre de 2024"
 */
export const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

/**
 * Calculate days between two ISO date strings
 */
export const daysBetween = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Get a HH:MM string rounded to the nearest time step.
 * Defaults to 5-minute granularity for aligning time pickers.
 */
export const getTimeRoundedToStep = (date: Date = new Date(), stepMinutes = 5): string => {
    const stepMs = stepMinutes * 60 * 1000;
    const roundedMs = Math.round(date.getTime() / stepMs) * stepMs;
    const roundedDate = new Date(roundedMs);
    return roundedDate.toTimeString().slice(0, 5);
};

/**
 * Check if a date string is in the future
 */
export const isFutureDate = (dateString: string): boolean => {
    const today = getTodayISO();
    return dateString > today;
};

/**
 * Parse ISO date to Date object, with fallback
 */
export const parseISODate = (isoDate?: string): Date | null => {
    if (!isoDate) return null;
    const date = new Date(isoDate);
    return isNaN(date.getTime()) ? null : date;
};

// ==========================================
// CONFIGURACIÓN DE FERIADOS (CHILE)
// ==========================================
// Lista de feriados para cálculo de horarios de turno.
// Formato: YYYY-MM-DD
// IMPORTANTE: Mantener actualizado este listado cada año.
export const CHILEAN_HOLIDAYS = [
    // 2024
    '2024-01-01', // Año Nuevo
    '2024-03-29', // Viernes Santo
    '2024-03-30', // Sábado Santo
    '2024-05-01', // Día del Trabajo
    '2024-05-21', // Glorias Navales
    '2024-06-09', // Elecciones Primarias (Irrenunciable)
    '2024-06-20', // Pueblos Indígenas
    '2024-06-29', // San Pedro y San Pablo
    '2024-07-16', // Virgen del Carmen
    '2024-08-15', // Asunción de la Virgen
    '2024-09-18', // Independencia Nacional
    '2024-09-19', // Día de las Glorias del Ejército
    '2024-09-20', // Feriado Adicional
    '2024-10-12', // Encuentro de Dos Mundos
    '2024-10-27', // Elecciones Municipales
    '2024-10-31', // Iglesias Evangélicas
    '2024-11-01', // Todos los Santos
    '2024-12-08', // Inmaculada Concepción
    '2024-12-25', // Navidad

    // 2025
    '2025-01-01', // Año Nuevo
    '2025-04-18', // Viernes Santo
    '2025-04-19', // Sábado Santo
    '2025-05-01', // Día del Trabajo
    '2025-05-21', // Glorias Navales
    '2025-06-20', // Pueblos Indígenas
    '2025-06-29', // San Pedro y San Pablo (se mueve al lunes 30)
    '2025-06-30', // San Pedro y San Pablo (movido)
    '2025-07-16', // Virgen del Carmen
    '2025-08-15', // Asunción de la Virgen
    '2025-09-18', // Independencia Nacional
    '2025-09-19', // Día de las Glorias del Ejército
    '2025-10-12', // Encuentro de Dos Mundos (se mueve al lunes 13)
    '2025-10-13', // Encuentro de Dos Mundos (movido)
    '2025-10-31', // Iglesias Evangélicas
    '2025-11-01', // Todos los Santos
    '2025-12-08', // Inmaculada Concepción
    '2025-12-25', // Navidad

    // 2026
    '2026-01-01', // Año Nuevo
    '2026-04-03', // Viernes Santo
    '2026-04-04', // Sábado Santo
    '2026-05-01', // Día del Trabajo
    '2026-05-21', // Glorias Navales
    '2026-06-20', // Pueblos Indígenas (sábado)
    '2026-06-29', // San Pedro y San Pablo
    '2026-07-16', // Virgen del Carmen
    '2026-08-15', // Asunción de la Virgen
    '2026-09-18', // Independencia Nacional
    '2026-09-19', // Día de las Glorias del Ejército
    '2026-10-12', // Encuentro de Dos Mundos
    '2026-10-31', // Iglesias Evangélicas
    '2026-11-01', // Todos los Santos (domingo)
    '2026-11-02', // Todos los Santos (movido al lunes)
    '2026-12-08', // Inmaculada Concepción
    '2026-12-25', // Navidad

    // 2027
    '2027-01-01', // Año Nuevo
    '2027-03-26', // Viernes Santo
    '2027-03-27', // Sábado Santo
    '2027-05-01', // Día del Trabajo (sábado)
    '2027-05-21', // Glorias Navales
    '2027-06-20', // Pueblos Indígenas (domingo)
    '2027-06-21', // Pueblos Indígenas (movido al lunes)
    '2027-06-28', // San Pedro y San Pablo (movido al lunes)
    '2027-07-16', // Virgen del Carmen
    '2027-08-15', // Asunción de la Virgen (domingo)
    '2027-08-16', // Asunción de la Virgen (movido al lunes)
    '2027-09-18', // Independencia Nacional (sábado)
    '2027-09-19', // Día de las Glorias del Ejército (domingo)
    '2027-09-20', // Feriado adicional (lunes)
    '2027-10-11', // Encuentro de Dos Mundos (movido al lunes)
    '2027-10-31', // Iglesias Evangélicas (domingo)
    '2027-11-01', // Todos los Santos
    '2027-12-08', // Inmaculada Concepción
    '2027-12-25', // Navidad (sábado)

    // 2028
    '2028-01-01', // Año Nuevo (sábado)
    '2028-04-14', // Viernes Santo
    '2028-04-15', // Sábado Santo
    '2028-05-01', // Día del Trabajo
    '2028-05-21', // Glorias Navales (domingo)
    '2028-05-22', // Glorias Navales (movido al lunes)
    '2028-06-20', // Pueblos Indígenas
    '2028-06-29', // San Pedro y San Pablo
    '2028-07-16', // Virgen del Carmen (domingo)
    '2028-07-17', // Virgen del Carmen (movido al lunes)
    '2028-08-15', // Asunción de la Virgen
    '2028-09-18', // Independencia Nacional
    '2028-09-19', // Día de las Glorias del Ejército
    '2028-10-12', // Encuentro de Dos Mundos
    '2028-10-31', // Iglesias Evangélicas
    '2028-11-01', // Todos los Santos
    '2028-12-08', // Inmaculada Concepción
    '2028-12-25', // Navidad
];

/**
 * Check if a date is a Business Day (Lunes a Viernes, no feriado)
 * Returns FALSE for Weekends (Sat/Sun) and Holidays.
 */
export const isBusinessDay = (dateString: string): boolean => {
    // 1. Check Holiday List
    if (CHILEAN_HOLIDAYS.includes(dateString)) {
        return false; // Es feriado -> No es día hábil
    }

    // 2. Check Weekend
    // Note: new Date('YYYY-MM-DD') creates a UTC date.
    // We want local semantic date. A safe way is to append T12:00:00 to avoid timezone shifts affecting the day
    const date = new Date(`${dateString}T12:00:00`);
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday

    if (day === 0 || day === 6) {
        return false; // Fin de semana -> No es día hábil
    }

    return true; // Lunes-Viernes y no feriado
};

/**
 * Get the next calendar day from a given date string
 */
const getNextDay = (dateString: string): string => {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
};

interface ShiftSchedule {
    dayStart: string;
    dayEnd: string;
    nightStart: string;
    nightEnd: string;
    description: string;
}

/**
 * Get Shift Hours based on date type (Business Day vs Weekend/Holiday)
 * 
 * IMPORTANTE: El turno NOCHE cruza dos días calendario.
 * - El inicio del turno noche depende del día ACTUAL
 * - El fin del turno noche depende del día SIGUIENTE
 * 
 * Ejemplos:
 * - Viernes (hábil) -> Sábado (no hábil): Noche 20:00 - 09:00
 * - Domingo (no hábil) -> Lunes (hábil): Noche 20:00 - 08:00
 */
export const getShiftSchedule = (dateString: string): ShiftSchedule => {
    const todayIsBusinessDay = isBusinessDay(dateString);
    const nextDay = getNextDay(dateString);
    const tomorrowIsBusinessDay = isBusinessDay(nextDay);

    // Horario de INICIO del turno largo (basado en HOY)
    const dayStart = todayIsBusinessDay ? '08:00' : '09:00';

    // El turno largo siempre termina a las 20:00
    const dayEnd = '20:00';

    // El turno noche siempre empieza a las 20:00
    const nightStart = '20:00';

    // Horario de FIN del turno noche (basado en MAÑANA)
    const nightEnd = tomorrowIsBusinessDay ? '08:00' : '09:00';

    // Descripción para UI
    let description = todayIsBusinessDay ? 'Día Hábil' : 'Fin de Semana / Feriado';
    if (todayIsBusinessDay !== tomorrowIsBusinessDay) {
        description += tomorrowIsBusinessDay ? ' → Día Hábil' : ' → No Hábil';
    }

    return {
        dayStart,
        dayEnd,
        nightStart,
        nightEnd,
        description
    };
};

/**
 * Determines if a given time (HH:MM) falls within the day shift (Turno Largo)
 * Day shift: 08:00 - 20:00
 * Night shift: 20:00 - 08:00
 * 
 * @param time - Time string in HH:MM format
 * @returns true if the time is within day shift, false for night shift
 *          Returns true if time is undefined for backwards compatibility
 */
export const isWithinDayShift = (time?: string): boolean => {
    if (!time) return true; // Default to day shift for backwards compatibility
    const [hours] = time.split(':').map(Number);
    if (isNaN(hours)) return true; // Invalid time format, assume day shift
    return hours >= 8 && hours < 20;
};

/**
 * Determines if a patient was admitted during a specific shift.
 * 
 * IMPORTANT: Night shift spans two calendar days!
 * - Night shift of Jan 3rd = Jan 3rd 20:00 → Jan 4th 08:00
 * - A patient admitted on Jan 4th at 02:00 belongs to the night shift of Jan 3rd
 * 
 * @param recordDate - The date of the DailyRecord (YYYY-MM-DD)
 * @param admissionDate - The patient's admission date (YYYY-MM-DD)
 * @param admissionTime - The patient's admission time (HH:MM)
 * @param shift - The selected shift ('day' or 'night')
 * @returns true if the patient should be visible in the selected shift
 */
export const isAdmittedDuringShift = (
    recordDate: string,
    admissionDate?: string,
    admissionTime?: string,
    shift: 'day' | 'night' = 'day'
): boolean => {
    // If no admission date, use record date (backwards compatibility)
    const patientAdmissionDate = admissionDate || recordDate;

    // Calculate next day from record date for night shift cross-day logic
    const nextDay = getNextDay(recordDate);

    // Determine if admission time is during day shift (08:00-20:00)
    const isDayTime = isWithinDayShift(admissionTime);

    if (shift === 'day') {
        // Day shift: Only include patients admitted on the same date AND during day hours
        // OR patients admitted on earlier dates (already hospitalized)
        if (patientAdmissionDate < recordDate) {
            return true; // Already hospitalized before this record date
        }
        if (patientAdmissionDate === recordDate && isDayTime) {
            return true; // Admitted on the same day during day shift
        }
        return false; // Admitted at night or on a future date
    } else {
        // Night shift: Include all patients from day shift PLUS:
        // 1. Patients admitted on record date during night hours (after 20:00)
        // 2. Patients admitted on the NEXT day during early morning (before 08:00)

        if (patientAdmissionDate < recordDate) {
            return true; // Already hospitalized before this record date
        }
        if (patientAdmissionDate === recordDate) {
            return true; // Admitted on the same day (any time - day shift already ended)
        }
        if (patientAdmissionDate === nextDay && !isDayTime) {
            // Admitted on next day during early morning (part of this night shift)
            return true;
        }
        return false; // Admitted on a future date beyond the next morning
    }
};
