import React, { useState } from 'react';
import { Lock, BedDouble, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import { BEDS } from '../../constants';
import { useDailyRecordContext } from '../../context/DailyRecordContext';
import { BaseModal } from '../shared/BaseModal';
import { BedBlockSchema } from '../../schemas/inputSchemas';
import { useScrollLock } from '../../hooks/useScrollLock';

interface BedManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Sub-dialog component for blocking/editing moved outside to prevent flashing/re-mounting
const SubDialog = ({
  title,
  onConfirm,
  onCancel,
  confirmText,
  confirmClass,
  reason,
  setReason,
  error,
  setError,
  showUnblock = false,
  handleUnblock
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText: string;
  confirmClass: string;
  reason: string;
  setReason: (val: string) => void;
  error: string | null;
  setError: (val: string | null) => void;
  showUnblock?: boolean;
  handleUnblock?: () => void;
}) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
    <div className="bg-white border border-slate-200 shadow-2xl p-5 rounded-2xl w-full max-w-sm animate-scale-in">
      <h4 className="font-bold text-slate-800 mb-4 text-center tracking-tight">{title}</h4>

      <div className="mb-6">
        <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-wider">Motivo del Bloqueo</label>
        <input
          autoFocus
          type="text"
          className={clsx(
            "w-full p-2.5 border rounded-xl focus:ring-2 focus:outline-none text-slate-700 text-sm transition-all shadow-sm",
            error ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:ring-medical-500 focus:border-medical-500"
          )}
          placeholder="Ej: Mantención, Aislamiento..."
          value={reason}
          onChange={e => { setReason(e.target.value); setError(null); }}
          onKeyDown={e => e.key === 'Enter' && onConfirm()}
        />
        {error && <p className="text-[10px] text-red-500 mt-1.5 font-medium animate-fade-in pl-1">{error}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors border border-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={clsx("flex-1 py-2 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95", confirmClass)}
          >
            {confirmText}
          </button>
        </div>
        {showUnblock && handleUnblock && (
          <button
            onClick={handleUnblock}
            className="w-full py-2 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors border border-red-100 mt-2"
          >
            Desbloquear Cama
          </button>
        )}
      </div>
    </div>
  </div>
);

export const BedManagerModal: React.FC<BedManagerModalProps> = ({
  isOpen, onClose
}) => {
  const { record, toggleBlockBed, updateBlockedReason, toggleExtraBed } = useDailyRecordContext();
  const [blockingBedId, setBlockingBedId] = useState<string | null>(null);
  const [editingBedId, setEditingBedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!record) return null;

  // Lock scroll when SubDialog is open
  const isSubDialogOpen = blockingBedId !== null || editingBedId !== null;
  useScrollLock(isSubDialogOpen);

  const handleBedClick = (bedId: string, isBlocked: boolean) => {
    setError(null);
    if (isBlocked) {
      setEditingBedId(bedId);
      setReason(record.beds[bedId].blockedReason || '');
    } else {
      setBlockingBedId(bedId);
      setReason('');
    }
  };

  const handleUnblock = () => {
    if (editingBedId) {
      toggleBlockBed(editingBedId);
      setEditingBedId(null);
      setReason('');
      setError(null);
    }
  };

  const validateReason = () => {
    const result = BedBlockSchema.safeParse({ reason });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return false;
    }
    setError(null);
    return true;
  };

  const handleSaveReason = () => {
    if (editingBedId && validateReason()) {
      updateBlockedReason(editingBedId, reason);
      setEditingBedId(null);
      setReason('');
    }
  };

  const confirmBlock = () => {
    if (blockingBedId && validateReason()) {
      toggleBlockBed(blockingBedId, reason);
      setBlockingBedId(null);
      setReason('');
    }
  };

  const cancelBlock = () => {
    setBlockingBedId(null);
    setReason('');
    setError(null);
  };

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title="Gestión de Camas"
        icon={<Lock size={18} />}
        size="md"
        variant="white"
        headerIconColor="text-amber-600"
      >
        <div className="space-y-6">
          {/* Section 1: Block Beds */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Bloquear Camas</label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {BEDS.filter(b => !b.isExtra).map(bed => {
                const isBlocked = record.beds[bed.id]?.isBlocked;
                return (
                  <button
                    key={bed.id}
                    onClick={() => handleBedClick(bed.id, isBlocked)}
                    className={clsx(
                      "p-1.5 rounded-lg border text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 shadow-sm active:scale-95",
                      isBlocked
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-slate-100 bg-white text-slate-500 hover:border-medical-300 hover:bg-slate-50"
                    )}
                    disabled={blockingBedId !== null || editingBedId !== null}
                  >
                    <span>{bed.name}</span>
                    {isBlocked ? <Lock size={10} className="text-amber-500" /> : <div className="h-2.5" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2: Extra Beds */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Habilitar Camas Extras</label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {BEDS.filter(b => b.isExtra).map(bed => {
                const isEnabled = (record.activeExtraBeds || []).includes(bed.id);
                return (
                  <button
                    key={bed.id}
                    onClick={() => toggleExtraBed(bed.id)}
                    className={clsx(
                      "p-1.5 rounded-lg border text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 shadow-sm active:scale-95",
                      isEnabled
                        ? "border-medical-500 bg-medical-50 text-medical-700"
                        : "border-slate-100 bg-white text-slate-500 hover:border-medical-300 hover:bg-slate-50"
                    )}
                    disabled={blockingBedId !== null}
                  >
                    <span>{bed.name}</span>
                    {isEnabled ? <CheckCircle size={10} className="text-medical-600" /> : <div className="h-2.5" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </BaseModal>

      {/* Sub-dialogs */}
      {blockingBedId && (
        <SubDialog
          title={`Bloquear Cama ${blockingBedId}`}
          onConfirm={confirmBlock}
          onCancel={cancelBlock}
          confirmText="Confirmar"
          confirmClass="bg-red-600 hover:bg-red-700 shadow-red-600/20"
          reason={reason}
          setReason={setReason}
          error={error}
          setError={setError}
        />
      )}

      {/* Sub-dialog for editing blocked bed */}
      {editingBedId && (
        <SubDialog
          title={`Editar Cama ${editingBedId}`}
          onConfirm={handleSaveReason}
          onCancel={() => { setEditingBedId(null); setReason(''); }}
          confirmText="Guardar"
          confirmClass="bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
          reason={reason}
          setReason={setReason}
          error={error}
          setError={setError}
          showUnblock
          handleUnblock={handleUnblock}
        />
      )}
    </>
  );
};
