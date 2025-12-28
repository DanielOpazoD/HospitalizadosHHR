import React from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { DeviceInfo } from '../../types';
import { VVP_DEVICE_KEYS } from '../../constants';

// Devices that require date tracking (IAAS surveillance)
export const TRACKED_DEVICES = ['CUP', 'CVC', 'VMI', ...VVP_DEVICE_KEYS] as const;
export type TrackedDevice = typeof TRACKED_DEVICES[number];

export const DEVICE_LABELS: Record<TrackedDevice, string> = {
    'CUP': 'Sonda Foley',
    'CVC': 'Catéter Venoso Central',
    'VMI': 'Ventilación Mecánica Invasiva',
    'VVP#1': 'Vía Venosa Periférica #1',
    'VVP#2': 'Vía Venosa Periférica #2',
    'VVP#3': 'Vía Venosa Periférica #3'
};

/**
 * Calculate days since installation
 * Inclusion: The installation day counts as Day 1.
 */
export const calculateDeviceDays = (installDate?: string, currentDate?: string): number | null => {
    if (!installDate || !currentDate) return null;
    const start = new Date(installDate);
    const end = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diff = end.getTime() - start.getTime();
    const days = Math.floor(diff / (1000 * 3600 * 24));
    // The first day (installation) counts as Day 1
    const totalDays = days + 1;
    return totalDays >= 1 ? totalDays : 1;
};

interface DeviceDateConfigModalProps {
    device: TrackedDevice;
    deviceInfo: DeviceInfo;
    currentDate?: string;
    onSave: (info: DeviceInfo) => void;
    onClose: () => void;
}

export const DeviceDateConfigModal: React.FC<DeviceDateConfigModalProps> = ({
    device,
    deviceInfo,
    currentDate,
    onSave,
    onClose
}) => {
    const [tempDetails, setTempDetails] = React.useState<DeviceInfo>(deviceInfo);

    const handleSave = () => {
        onSave(tempDetails);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xs animate-scale-in">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Calendar size={16} className="text-medical-600" />
                        {device} - {DEVICE_LABELS[device]}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            {device === 'VMI' ? 'Fecha de Inicio' : 'Fecha de Instalación'}
                        </label>
                        <input
                            type="date"
                            className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-medical-500 focus:outline-none"
                            value={tempDetails.installationDate || ''}
                            max={currentDate}
                            onChange={(e) => setTempDetails({ ...tempDetails, installationDate: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            {device === 'VMI' ? 'Fecha de Término' : 'Fecha de Retiro'}
                            <span className="font-normal text-slate-400 ml-1">(opcional)</span>
                        </label>
                        <input
                            type="date"
                            className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-medical-500 focus:outline-none"
                            value={tempDetails.removalDate || ''}
                            min={tempDetails.installationDate}
                            max={currentDate}
                            onChange={(e) => setTempDetails({ ...tempDetails, removalDate: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Nota <span className="font-normal text-slate-400">(opcional)</span>
                        </label>
                        <textarea
                            className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-medical-500 focus:outline-none resize-none min-h-[70px]"
                            value={tempDetails.note || ''}
                            onChange={(e) => setTempDetails({ ...tempDetails, note: e.target.value })}
                            placeholder="Registrar detalles relevantes del dispositivo"
                        />
                    </div>

                    {/* Days counter */}
                    {tempDetails.installationDate && (
                        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                            <Clock size={14} className="text-slate-500" />
                            <span className="text-sm text-slate-600">
                                Días con dispositivo: <strong>{calculateDeviceDays(tempDetails.installationDate, currentDate)}</strong>
                            </span>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-slate-500 hover:bg-slate-200 rounded text-sm transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-3 py-1.5 bg-medical-600 text-white rounded text-sm font-medium hover:bg-medical-700 transition-colors shadow-sm"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};
