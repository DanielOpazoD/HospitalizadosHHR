import React from 'react';
import clsx from 'clsx';
import { calculateDeviceDays, TRACKED_DEVICES, TrackedDevice } from './DeviceDateConfigModal';
import { DeviceDetails } from '../../types';
import { formatDateDDMMYYYY } from '../../services/dataService';

interface DeviceBadgeProps {
    device: string;
    deviceDetails?: DeviceDetails;
    currentDate?: string;
}

export const DeviceBadge: React.FC<DeviceBadgeProps> = ({
    device,
    deviceDetails = {},
    currentDate
}) => {
    let badgeText = device;
    if (device === '2 VVP') badgeText = '2VVP';

    const isTracked = TRACKED_DEVICES.includes(device as TrackedDevice);
    const details = isTracked ? deviceDetails[device as TrackedDevice] : undefined;
    const days = details?.installationDate ? calculateDeviceDays(details.installationDate, currentDate) : null;

    // Alert colors based on days (IAAS thresholds)
    const isAlert = isTracked && days !== null && (
        (device === 'CUP' && days >= 5) ||
        (device === 'CVC' && days >= 7) ||
        (device === 'VMI' && days >= 5)
    );

    return (
        <span className="relative group inline-flex">
            <span
                className={clsx(
                    "text-[9px] px-1 py-0.5 rounded border font-medium whitespace-nowrap flex items-center gap-0.5",
                    isAlert
                        ? "bg-orange-100 text-orange-700 border-orange-200"
                        : "bg-medical-50 text-medical-700 border-medical-100"
                )}
            >
                {badgeText}
                {days !== null && (
                    <span className="text-[8px] opacity-70 ml-0.5">({days}d)</span>
                )}
            </span>

            {isTracked && details?.installationDate && (
                <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-20 pointer-events-none">
                    FI: {formatDateDDMMYYYY(details.installationDate)}
                </span>
            )}
        </span>
    );
};
