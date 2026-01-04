import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    formatDateDDMMYYYY,
    getTodayISO,
    formatDateForDisplay,
    daysBetween,
    getTimeRoundedToStep,
    isFutureDate,
    parseISODate,
    isBusinessDay,
    getShiftSchedule,
    isWithinDayShift,
    isAdmittedDuringShift
} from '../../utils/dateUtils';

describe('dateUtils', () => {
    describe('formatDateDDMMYYYY', () => {
        it('should format YYYY-MM-DD to DD-MM-YYYY', () => {
            expect(formatDateDDMMYYYY('2024-12-25')).toBe('25-12-2024');
        });

        it('should return "-" if no date is provided', () => {
            expect(formatDateDDMMYYYY()).toBe('-');
        });

        it('should return original string if it does not have 3 parts', () => {
            expect(formatDateDDMMYYYY('invalid')).toBe('invalid');
        });
    });

    describe('getTodayISO', () => {
        it('should return today date in YYYY-MM-DD format', () => {
            vi.useFakeTimers();
            const date = new Date(2024, 11, 26); // Dec 26, 2024
            vi.setSystemTime(date);
            expect(getTodayISO()).toBe('2024-12-26');
            vi.useRealTimers();
        });
    });

    describe('formatDateForDisplay', () => {
        it('should format date for Spanish display', () => {
            const date = new Date(2024, 11, 25);
            const result = formatDateForDisplay(date);
            // Result depends on environment locale but should include the month and day
            expect(result).toContain('diciembre');
            expect(result).toContain('25');
        });
    });

    describe('daysBetween', () => {
        it('should calculate days between two dates correctly', () => {
            expect(daysBetween('2024-12-01', '2024-12-05')).toBe(4);
            expect(daysBetween('2024-12-01', '2024-12-01')).toBe(0);
        });
    });

    describe('getTimeRoundedToStep', () => {
        it('should round time to default 5 minute step', () => {
            const date = new Date(2024, 11, 25, 10, 12, 0); // 10:12
            expect(getTimeRoundedToStep(date)).toBe('10:10');

            const date2 = new Date(2024, 11, 25, 10, 13, 0); // 10:13
            expect(getTimeRoundedToStep(date2)).toBe('10:15');
        });

        it('should round time to custom step', () => {
            const date = new Date(2024, 11, 25, 10, 22, 0); // 10:22
            expect(getTimeRoundedToStep(date, 30)).toBe('10:30');
        });
    });

    describe('isFutureDate', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2024, 11, 25)); // Dec 25, 2024
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return true for a future date', () => {
            expect(isFutureDate('2024-12-26')).toBe(true);
        });

        it('should return false for today', () => {
            expect(isFutureDate('2024-12-25')).toBe(false);
        });

        it('should return false for a past date', () => {
            expect(isFutureDate('2024-12-24')).toBe(false);
        });
    });

    describe('parseISODate', () => {
        it('should return a Date object for a valid ISO string', () => {
            const result = parseISODate('2024-12-25');
            expect(result).toBeInstanceOf(Date);
            expect(result?.getFullYear()).toBe(2024);
        });

        it('should return null for invalid date string', () => {
            expect(parseISODate('invalid')).toBeNull();
        });

        it('should return null if no date is provided', () => {
            expect(parseISODate()).toBeNull();
        });
    });

    describe('isBusinessDay', () => {
        it('should return true for a regular business day', () => {
            // Dec 26, 2024 is Thursday
            expect(isBusinessDay('2024-12-26')).toBe(true);
        });

        it('should return false for a weekend', () => {
            // Dec 28, 2024 is Saturday
            expect(isBusinessDay('2024-12-28')).toBe(false);
            // Dec 29, 2024 is Sunday
            expect(isBusinessDay('2024-12-29')).toBe(false);
        });

        it('should return false for a holiday', () => {
            // Dec 25, 2024 is Christmas (holiday)
            expect(isBusinessDay('2024-12-25')).toBe(false);
        });
    });

    describe('getShiftSchedule', () => {
        it('should return correct schedule for a regular business day', () => {
            // Dec 26, 2024 (Thursday, biz) -> Dec 27 (Friday, biz)
            const schedule = getShiftSchedule('2024-12-26');
            expect(schedule.dayStart).toBe('08:00');
            expect(schedule.nightEnd).toBe('08:00');
            expect(schedule.description).toBe('Día Hábil');
        });

        it('should return holiday schedule if today is a holiday', () => {
            // Dec 25, 2024 (Holiday)
            const schedule = getShiftSchedule('2024-12-25');
            expect(schedule.dayStart).toBe('09:00');
        });

        it('should adjust nightEnd if tomorrow is not a business day', () => {
            // Dec 27, 2024 (Friday, biz) -> Dec 28 (Saturday, no biz)
            const schedule = getShiftSchedule('2024-12-27');
            expect(schedule.nightEnd).toBe('09:00');
            expect(schedule.description).toContain('→ No Hábil');
        });

        it('should adjust nightEnd if tomorrow is a business day', () => {
            // Dec 29, 2024 (Sunday, no biz) -> Dec 30 (Monday, biz)
            const schedule = getShiftSchedule('2024-12-29');
            expect(schedule.nightEnd).toBe('08:00');
            expect(schedule.description).toContain('→ Día Hábil');
        });
    });

    describe('isWithinDayShift', () => {
        it('should return true for times during day shift (08:00-20:00)', () => {
            expect(isWithinDayShift('08:00')).toBe(true);
            expect(isWithinDayShift('12:00')).toBe(true);
            expect(isWithinDayShift('19:59')).toBe(true);
        });

        it('should return false for times during night shift (20:00-08:00)', () => {
            expect(isWithinDayShift('20:00')).toBe(false);
            expect(isWithinDayShift('22:00')).toBe(false);
            expect(isWithinDayShift('02:00')).toBe(false);
            expect(isWithinDayShift('07:59')).toBe(false);
        });

        it('should return true if no time provided (backwards compatibility)', () => {
            expect(isWithinDayShift()).toBe(true);
            expect(isWithinDayShift(undefined)).toBe(true);
        });

        it('should return true for invalid time format', () => {
            expect(isWithinDayShift('invalid')).toBe(true);
        });
    });

    describe('isAdmittedDuringShift', () => {
        const recordDate = '2026-01-03';
        const nextDay = '2026-01-04';

        describe('day shift filtering', () => {
            it('should include patients admitted during day shift on same date', () => {
                expect(isAdmittedDuringShift(recordDate, recordDate, '10:00', 'day')).toBe(true);
                expect(isAdmittedDuringShift(recordDate, recordDate, '15:00', 'day')).toBe(true);
            });

            it('should exclude patients admitted during night shift on same date', () => {
                expect(isAdmittedDuringShift(recordDate, recordDate, '22:00', 'day')).toBe(false);
                expect(isAdmittedDuringShift(recordDate, recordDate, '20:00', 'day')).toBe(false);
            });

            it('should exclude patients admitted on next day', () => {
                expect(isAdmittedDuringShift(recordDate, nextDay, '02:00', 'day')).toBe(false);
                expect(isAdmittedDuringShift(recordDate, nextDay, '10:00', 'day')).toBe(false);
            });

            it('should include patients already hospitalized (earlier date)', () => {
                expect(isAdmittedDuringShift(recordDate, '2026-01-02', '10:00', 'day')).toBe(true);
            });
        });

        describe('night shift filtering (cross-day)', () => {
            it('should include patients admitted during day shift on record date', () => {
                expect(isAdmittedDuringShift(recordDate, recordDate, '10:00', 'night')).toBe(true);
            });

            it('should include patients admitted during night hours on record date', () => {
                expect(isAdmittedDuringShift(recordDate, recordDate, '22:00', 'night')).toBe(true);
            });

            it('should include patients admitted on NEXT day early morning (cross-day)', () => {
                // This is the key test: patient admitted Jan 4th 02:00 should appear in Jan 3rd night shift
                expect(isAdmittedDuringShift(recordDate, nextDay, '02:00', 'night')).toBe(true);
                expect(isAdmittedDuringShift(recordDate, nextDay, '07:00', 'night')).toBe(true);
            });

            it('should exclude patients admitted on next day during day shift', () => {
                // Patient admitted Jan 4th 10:00 should NOT appear in Jan 3rd night shift
                expect(isAdmittedDuringShift(recordDate, nextDay, '10:00', 'night')).toBe(false);
            });

            it('should include patients already hospitalized (earlier date)', () => {
                expect(isAdmittedDuringShift(recordDate, '2026-01-02', '10:00', 'night')).toBe(true);
            });
        });

        it('should use record date if admission date is missing', () => {
            expect(isAdmittedDuringShift(recordDate, undefined, '10:00', 'day')).toBe(true);
            expect(isAdmittedDuringShift(recordDate, undefined, '22:00', 'day')).toBe(false);
        });
    });
});
