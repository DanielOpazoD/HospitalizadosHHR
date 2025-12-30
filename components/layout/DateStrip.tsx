import React, { useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Settings, Cloud, RefreshCw, AlertTriangle, Database, FileSpreadsheet, Send, Printer, Lock } from 'lucide-react';
import clsx from 'clsx';
import { MONTH_NAMES } from '../../constants';
import { useDemoMode } from '../../context/DemoModeContext';

// ============================================================================
// Grouped Props Interfaces
// ============================================================================

/**
 * Date navigation state and setters
 */
export interface DateNavigationProps {
    selectedYear: number;
    setSelectedYear: React.Dispatch<React.SetStateAction<number>>;
    selectedMonth: number;
    setSelectedMonth: React.Dispatch<React.SetStateAction<number>>;
    selectedDay: number;
    setSelectedDay: React.Dispatch<React.SetStateAction<number>>;
    currentDateString: string;
    daysInMonth: number;
    existingDaysInMonth: number[];
}

/**
 * Optional action callbacks for the DateStrip buttons
 */
export interface DateStripActionsProps {
    onPrintPDF?: () => void;
    onOpenBedManager?: () => void;
    onExportExcel?: () => void;
}

/**
 * Email configuration and status
 */
export interface EmailConfigProps {
    onConfigureEmail?: () => void;
    onSendEmail?: () => void;
    emailStatus?: 'idle' | 'loading' | 'success' | 'error';
    emailErrorMessage?: string | null;
}

/**
 * Sync status for Firebase connection
 */
export interface SyncConfigProps {
    syncStatus?: 'idle' | 'saving' | 'saved' | 'error';
    lastSyncTime?: Date | null;
}

/**
 * Combined DateStrip props - composed from grouped interfaces
 */
export interface DateStripProps extends DateNavigationProps, DateStripActionsProps, EmailConfigProps, SyncConfigProps { }

// ============================================================================
// Component Implementation
// ============================================================================

export const DateStrip: React.FC<DateStripProps> = ({
    // Date Navigation
    selectedYear, setSelectedYear,
    selectedMonth, setSelectedMonth,
    selectedDay, setSelectedDay,
    currentDateString,
    daysInMonth,
    existingDaysInMonth,
    // Actions
    onPrintPDF,
    onOpenBedManager,
    onExportExcel,
    // Email
    onConfigureEmail,
    onSendEmail,
    emailStatus = 'idle',
    emailErrorMessage,
    // Sync
    syncStatus,
    lastSyncTime
}) => {
    const daysContainerRef = useRef<HTMLDivElement>(null);
    const { isActive: isDemoMode } = useDemoMode();

    const changeMonth = (delta: number) => {
        let newM = selectedMonth + delta;
        let newY = selectedYear;
        if (newM > 11) { newM = 0; newY++; }
        if (newM < 0) { newM = 11; newY--; }
        setSelectedMonth(newM);
        setSelectedYear(newY);
        setSelectedDay(1);
    };

    // Check if today is selected
    const today = new Date();
    const isCurrentMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;

    // Navigate days with scroll wheel (independent of page scroll)
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.deltaY > 0) {
            // Scroll down = go forward in days
            setSelectedDay(d => Math.min(d + 1, daysInMonth));
        } else if (e.deltaY < 0) {
            // Scroll up = go back in days
            setSelectedDay(d => Math.max(d - 1, 1));
        }
    }, [daysInMonth, setSelectedDay]);

    return (
        <div
            className="bg-white border-b border-slate-200 shadow-sm sticky top-[60px] z-40 print:hidden"
            style={{ transform: 'translateZ(0)' }}
        >
            <div className="max-w-screen-2xl mx-auto px-4 py-1.5">
                <div className="flex items-center gap-3">

                    {/* Print PDF Button */}
                    {onPrintPDF && (
                        <button
                            onClick={onPrintPDF}
                            className="btn btn-secondary bg-slate-800 text-white hover:bg-slate-900 border-none !px-3 !py-1.5 text-[10px]"
                            title="Imprimir vista en PDF"
                        >
                            <Printer size={14} />
                            PDF
                        </button>
                    )}

                    {/* Excel Export Button */}
                    {onExportExcel && (
                        <button
                            onClick={onExportExcel}
                            className="btn btn-primary bg-green-600 hover:bg-green-700 border-none !px-3 !py-1.5 text-[10px]"
                            title="Descargar Excel Maestro del Mes"
                        >
                            <FileSpreadsheet size={14} />
                            EXCEL
                        </button>
                    )}

                    {/* Send Email Button */}
                    {onSendEmail && (
                        <button
                            onClick={onSendEmail}
                            disabled={emailStatus === 'loading'}
                            className={clsx(
                                "btn !px-3 !py-1.5 text-[10px]",
                                emailStatus === 'success'
                                    ? 'bg-blue-700 text-white shadow-inner'
                                    : 'btn-primary bg-blue-600 hover:bg-blue-700',
                                emailStatus === 'loading' && 'opacity-70 cursor-not-allowed'
                            )}
                            title={emailStatus === 'error' ? (emailErrorMessage || 'Ocurrió un error al enviar el correo') : "Enviar censo por correo"}
                        >
                            <Send size={14} />
                            {emailStatus === 'loading' ? 'Enviando...' : emailStatus === 'success' ? 'Enviado' : 'Enviar correo'}
                        </button>
                    )}

                    {/* Configure Email Button */}
                    {onConfigureEmail && (
                        <button
                            onClick={onConfigureEmail}
                            className="btn btn-secondary !p-1.5"
                            title="Configurar destinatarios y mensaje"
                            aria-label="Configurar correo"
                        >
                            <Settings size={14} />
                        </button>
                    )}

                    <div className="h-5 w-px bg-slate-200"></div>

                    {/* Year Selector */}
                    <div className="flex items-center text-slate-700 font-bold shrink-0">
                        <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 hover:bg-slate-100 rounded">
                            <ChevronLeft size={14} />
                        </button>
                        <span className="mx-1 text-sm font-bold">{selectedYear}</span>
                        <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 hover:bg-slate-100 rounded">
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="h-5 w-px bg-slate-200"></div>

                    {/* Month Selector */}
                    <div className="flex items-center text-slate-700 font-bold shrink-0">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded">
                            <ChevronLeft size={14} />
                        </button>
                        <span className="mx-1 uppercase text-xs tracking-wide min-w-[80px] text-center">{MONTH_NAMES[selectedMonth]}</span>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded">
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="h-5 w-px bg-slate-200"></div>

                    {/* Day Strip - Scrollable with mouse wheel */}
                    <div
                        ref={daysContainerRef}
                        className="flex gap-1 py-1 overflow-hidden flex-1 justify-center"
                        onWheel={handleWheel}
                    >
                        {(() => {
                            // Calculate visible range: 6 days before + selected + 6 days after = 13 days
                            const VISIBLE_DAYS = 13;
                            const OFFSET = 6;

                            let startDay = selectedDay - OFFSET;
                            let endDay = selectedDay + OFFSET;

                            // Adjust if we're near the start of the month
                            if (startDay < 1) {
                                startDay = 1;
                                endDay = Math.min(VISIBLE_DAYS, daysInMonth);
                            }

                            // Adjust if we're near the end of the month
                            if (endDay > daysInMonth) {
                                endDay = daysInMonth;
                                startDay = Math.max(1, daysInMonth - VISIBLE_DAYS + 1);
                            }

                            // Calculate Max Allowed Date (Today + 1)
                            const maxAllowedDate = new Date();
                            maxAllowedDate.setHours(0, 0, 0, 0);
                            maxAllowedDate.setDate(maxAllowedDate.getDate() + 1); // Tomorrow is the last allowed day

                            const days = [];
                            for (let day = startDay; day <= endDay; day++) {
                                const hasData = existingDaysInMonth.includes(day);
                                const isSelected = day === selectedDay;
                                const isTodayReal = isCurrentMonth && today.getDate() === day;

                                // Construct date for this button
                                const buttonDate = new Date(selectedYear, selectedMonth, day);
                                buttonDate.setHours(0, 0, 0, 0);

                                const isFutureBlocked = buttonDate > maxAllowedDate;

                                days.push(
                                    <button
                                        key={day}
                                        onClick={() => !isFutureBlocked && setSelectedDay(day)}
                                        disabled={isFutureBlocked}
                                        className={clsx(
                                            "flex items-center justify-center w-8 h-8 rounded-lg text-xs font-semibold transition-all shrink-0 relative border",
                                            isFutureBlocked
                                                ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                                                : isSelected
                                                    ? isTodayReal
                                                        // Today selected: bright cyan/teal color
                                                        ? "bg-gradient-to-br from-cyan-500 to-teal-500 text-white border-cyan-600 shadow-lg shadow-cyan-200 scale-110"
                                                        // Other day selected: slate color
                                                        : "bg-slate-700 text-white border-slate-700 shadow-md scale-105"
                                                    : [
                                                        "hover:bg-slate-100",
                                                        isTodayReal
                                                            // Today not selected: highlighted but not as much
                                                            ? "bg-cyan-50 border-cyan-300 text-cyan-700 font-bold"
                                                            : "bg-white border-slate-100 text-slate-500"
                                                    ]
                                        )}
                                    >
                                        <span>{day}</span>
                                        {hasData && (
                                            <span className={clsx(
                                                "absolute -bottom-0.5 w-1 h-1 rounded-full",
                                                isFutureBlocked ? "bg-slate-300" : (isSelected ? "bg-green-400" : "bg-green-500")
                                            )}></span>
                                        )}
                                    </button>
                                );
                            }
                            return days;
                        })()}
                    </div>

                    <div className="h-5 w-px bg-slate-200"></div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-2 shrink-0">

                        {/* Sync Status - Always Visible */}
                        <div className="flex items-center gap-1 text-[10px] font-medium"
                            title={
                                isDemoMode
                                    ? `Modo Demo - Guardado local: ${lastSyncTime?.toLocaleTimeString() || '...'}`
                                    : syncStatus === 'error'
                                        ? 'Error de conexión con Firebase'
                                        : `Conectado a Firebase: ${lastSyncTime?.toLocaleTimeString() || 'Esperando...'}`
                            }>
                            {syncStatus === 'saving' && <RefreshCw size={12} className="animate-spin text-blue-500" />}
                            {syncStatus === 'saved' && (
                                isDemoMode
                                    ? <div className="flex items-center gap-1 text-amber-600"><Database size={12} /> <span>LOCAL</span></div>
                                    : <Cloud size={12} className="text-green-500" />
                            )}
                            {syncStatus === 'error' && <AlertTriangle size={12} className="text-red-500" />}
                            {(!syncStatus || syncStatus === 'idle') && (
                                isDemoMode
                                    ? <div className="flex items-center gap-1 text-amber-500"><Database size={12} /></div>
                                    : <Cloud size={12} className="text-slate-300" />
                            )}
                        </div>

                        {/* Bed Manager Button */}
                        {onOpenBedManager && (
                            <button
                                onClick={onOpenBedManager}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-md border border-slate-200 transition-colors text-[11px] font-semibold"
                                title="Bloqueo de camas"
                            >
                                <Lock size={14} />
                                <span className="hidden sm:inline">Camas</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
