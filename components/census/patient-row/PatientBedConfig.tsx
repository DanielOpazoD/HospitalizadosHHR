import React from 'react';
import { BedDefinition, PatientData } from '../../../types';
import { Baby, User, Trash2, Clock } from 'lucide-react';
import clsx from 'clsx';

/**
 * Calculate days since admission (reused from HandoffRow)
 */
const calculateHospitalizedDays = (admissionDate?: string, currentDate?: string): number | null => {
    if (!admissionDate || !currentDate) return null;
    // Append T12:00:00 to ensure local time noon, avoiding timezone shifts affecting the day
    const start = new Date(`${admissionDate}T12:00:00`);
    const end = new Date(`${currentDate}T12:00:00`);
    const diff = end.getTime() - start.getTime();
    // Use Math.round to handle potential DST offsets (23h or 25h days)
    const days = Math.round(diff / (1000 * 3600 * 24));
    return days >= 0 ? days : 0;
};

interface PatientBedConfigProps {
    bed: BedDefinition;
    data: PatientData;
    currentDateString: string;
    isBlocked: boolean;
    showCribControls: boolean;
    hasCompanion: boolean;
    hasClinicalCrib: boolean;
    isCunaMode: boolean;
    onToggleMode: () => void;
    onToggleCompanion: () => void;
    onToggleClinicalCrib: () => void;
    onTextChange: (field: keyof PatientData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUpdateClinicalCrib: (action: 'remove') => void;
    onShowCribDemographics: () => void;
    readOnly?: boolean;
}

export const PatientBedConfig: React.FC<PatientBedConfigProps> = ({
    bed,
    data,
    currentDateString,
    isBlocked,
    showCribControls,
    hasCompanion,
    hasClinicalCrib,
    isCunaMode,
    onToggleMode,
    onToggleCompanion,
    onToggleClinicalCrib,
    onTextChange,
    onUpdateClinicalCrib,
    onShowCribDemographics,
    readOnly = false
}) => {
    const daysHospitalized = calculateHospitalizedDays(data.admissionDate, currentDateString);
    const hasPatient = !!data.patientName;

    return (
        <td className="p-[2px] border-r border-slate-200 text-center w-24 relative">
            <div className="flex flex-col items-center gap-0.5">
                {/* BED NAME */}
                <div className="font-display font-bold text-lg text-slate-800 flex items-center gap-1.5 leading-none tracking-tight">
                    {bed.name}
                    {isCunaMode && <Baby size={16} className="text-pink-500 drop-shadow-sm" />}
                </div>

                {/* Days Hospitalized Counter */}
                {!isBlocked && hasPatient && daysHospitalized !== null && !showCribControls && (
                    <div
                        className="flex items-center gap-0.5 text-slate-500"
                        title={`${daysHospitalized} días hospitalizado`}
                    >
                        <Clock size={10} className="text-slate-400" />
                        <span className="text-[10px] font-semibold">{daysHospitalized}d</span>
                    </div>
                )}

                {/* Config Controls (Visible via Prop and NOT readOnly) */}
                {!isBlocked && showCribControls && !readOnly && (
                    <div className="flex flex-col gap-1 mt-2 w-full animate-fade-in">
                        {/* Mode Toggle */}
                        <button
                            onClick={onToggleMode}
                            className={clsx(
                                "text-[9px] font-bold uppercase tracking-tight px-1 py-0.5 rounded border transition-all duration-200 w-full shadow-sm",
                                isCunaMode
                                    ? "bg-pink-50 border-pink-200 text-pink-700 shadow-pink-100/50"
                                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            {isCunaMode ? "Cuna" : "Cama"}
                        </button>

                        {/* Companion Toggle */}
                        <button
                            onClick={onToggleCompanion}
                            className={clsx(
                                "text-[9px] font-bold uppercase tracking-tight px-1 py-0.5 rounded border transition-all duration-200 w-full shadow-sm",
                                hasCompanion
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-100/50"
                                    : "bg-white border-slate-200 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                            )}
                        >
                            {hasCompanion ? "RN Sano" : "+ RN Sano"}
                        </button>

                        {/* Clinical Crib Toggle */}
                        {!isCunaMode && (
                            <button
                                onClick={onToggleClinicalCrib}
                                className={clsx(
                                    "text-[9px] font-bold uppercase tracking-tight px-1 py-0.5 rounded border transition-all duration-200 w-full shadow-sm flex items-center justify-center gap-1",
                                    hasClinicalCrib
                                        ? "bg-purple-50 border-purple-200 text-purple-700 shadow-purple-100/50"
                                        : "bg-white border-slate-200 text-slate-400 hover:bg-purple-50 hover:text-purple-600"
                                )}
                            >
                                {hasClinicalCrib ? "Cuna Cli" : "+ Cuna Cli"}
                            </button>
                        )}

                        {/* Additional Clinical Crib Controls (Delete/Edit) */}
                        {hasClinicalCrib && (
                            <div className="flex gap-1 mt-0.5">
                                <button
                                    onClick={onShowCribDemographics}
                                    className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-600 p-1 rounded border border-purple-200 transition-colors shadow-sm"
                                    title="Datos Personales Cuna Clínica"
                                >
                                    <User size={12} className="mx-auto" />
                                </button>
                                <button
                                    onClick={() => onUpdateClinicalCrib('remove')}
                                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 p-1 rounded border border-red-200 transition-colors shadow-sm"
                                    title="Eliminar Cuna Clínica Adicional"
                                >
                                    <Trash2 size={12} className="mx-auto" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Static Indicators when controls are hidden */}
                {!showCribControls && !isBlocked && (
                    <div className="flex gap-1 mt-1">
                        {hasCompanion && <span className="text-[9px] bg-green-100 text-green-800 px-1 rounded-sm border border-green-200" title="RN Sano">RN</span>}
                        {hasClinicalCrib && <span className="text-[9px] bg-purple-100 text-purple-800 px-1 rounded-sm border border-purple-200" title="Cuna Clínica">+CC</span>}
                    </div>
                )}
            </div>

            {/* Extra beds allow editing location */}
            {bed.isExtra && (
                <input
                    type="text"
                    placeholder="Ubicación"
                    className="w-full text-[10px] p-1 mt-1.5 border border-amber-200 rounded text-center bg-amber-50/50 text-amber-900 placeholder:text-amber-400 focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 focus:outline-none transition-all duration-200"
                    value={data.location || ''}
                    onChange={onTextChange('location')}
                    disabled={readOnly}
                />
            )}
        </td>
    );
};
