import { useState, useEffect, useCallback } from 'react';
import { useConfirmDialog } from '../context/UIContext';
import { DailyRecord } from '../types';
import { buildCensusEmailBody, CENSUS_DEFAULT_RECIPIENTS } from '../constants/email';
import { formatDate, getMonthRecordsFromFirestore, triggerCensusEmail, initializeDay } from '../services';
import { isAdmin } from '../utils/permissions';

interface UseCensusEmailParams {
  record: DailyRecord | null;
  currentDateString: string;
  nurseSignature: string;
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  user: { email?: string | null; role?: string } | null;
  role: string;
}

interface UseCensusEmailReturn {
  // Config modal state
  showEmailConfig: boolean;
  setShowEmailConfig: (show: boolean) => void;

  // Recipients
  recipients: string[];
  setRecipients: (recipients: string[]) => void;

  // Message
  message: string;
  onMessageChange: (value: string) => void;
  onResetMessage: () => void;

  // Send state
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;

  // Actions
  resetStatus: () => void;
  sendEmail: () => Promise<void>;

  // Test mode
  testModeEnabled: boolean;
  setTestModeEnabled: (value: boolean) => void;
  testRecipient: string;
  setTestRecipient: (value: string) => void;
  isAdminUser: boolean;
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalizeEmail = (value: string) => value.trim().toLowerCase();

/**
 * Hook to manage census email configuration and sending.
 * Extracts email handling logic from App.tsx for cleaner separation of concerns.
 */
export const useCensusEmail = ({
  record,
  currentDateString,
  nurseSignature,
  selectedYear,
  selectedMonth,
  selectedDay,
  user,
  role,
}: UseCensusEmailParams): UseCensusEmailReturn => {
  const { confirm, alert } = useConfirmDialog();
  const isAdminUser = isAdmin(role);

  // ========== RECIPIENTS STATE ==========
  const [recipients, setRecipients] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = window.localStorage.getItem('censusEmailRecipients');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {
        // ignore parsing errors and fallback to defaults
      }
    }
    return CENSUS_DEFAULT_RECIPIENTS;
  });

  // ========== MESSAGE STATE ==========
  // Message is always generated dynamically based on date and nurses
  // No localStorage persistence to ensure it always reflects current data
  const [message, setMessage] = useState<string>(() => {
    return buildCensusEmailBody(currentDateString, nurseSignature);
  });

  // Track if user has manually edited the message in this session
  const [messageEdited, setMessageEdited] = useState(false);

  // ========== TEST MODE (ADMIN) ==========
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  // ========== UI STATE ==========
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Reset status when navigating between days to avoid locking the button for other dates
  useEffect(() => {
    setStatus('idle');
    setError(null);
  }, [currentDateString]);

  useEffect(() => {
    if (!isAdminUser) {
      setTestModeEnabled(false);
      setTestRecipient('');
    }
  }, [isAdminUser]);

  // ========== PERSISTENCE EFFECTS ==========
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('censusEmailRecipients', JSON.stringify(recipients));
    }
  }, [recipients]);

  // Auto-update message when date/signature changes (if not manually edited in this session)
  useEffect(() => {
    if (!messageEdited) {
      setMessage(buildCensusEmailBody(currentDateString, nurseSignature));
    }
  }, [currentDateString, nurseSignature, messageEdited]);

  // Reset messageEdited when date changes (so new date gets fresh message)
  useEffect(() => {
    setMessageEdited(false);
  }, [currentDateString]);

  // ========== HANDLERS ==========
  const onMessageChange = useCallback((value: string) => {
    setMessage(value);
    setMessageEdited(true);
  }, []);

  const onResetMessage = useCallback(() => {
    setMessage(buildCensusEmailBody(currentDateString, nurseSignature));
    setMessageEdited(false);
  }, [currentDateString, nurseSignature]);

  const resetStatus = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const sendEmail = useCallback(async () => {
    if (!record) {
      alert('No hay datos del censo para enviar.');
      return;
    }

    if (status === 'loading' || status === 'success') return;

    const shouldUseTestMode = isAdminUser && testModeEnabled;

    let resolvedRecipients = recipients.filter(r => r.trim()).length > 0
      ? recipients.map(r => normalizeEmail(r)).filter(Boolean)
      : CENSUS_DEFAULT_RECIPIENTS;

    if (shouldUseTestMode) {
      const normalizedTestRecipient = normalizeEmail(testRecipient);
      if (!normalizedTestRecipient || !isValidEmail(normalizedTestRecipient)) {
        const errorMessage = 'Ingresa un correo de prueba válido para el modo prueba.';
        setError(errorMessage);
        alert(errorMessage, 'Modo prueba');
        return;
      }
      resolvedRecipients = [normalizedTestRecipient];
    }

    const confirmationText = [
      `Enviar correo de censo del ${formatDate(currentDateString)}?`,
      `Destinatarios: ${resolvedRecipients.join(', ')}`,
      shouldUseTestMode ? '(Modo prueba activo - solo se enviará al destinatario indicado)' : '',
      '',
      '¿Confirmas el envío?'
    ].filter(Boolean).join('\n');

    const confirmed = await confirm({
      title: 'Confirmar Envío de Censo',
      message: confirmationText,
      confirmText: 'Aceptar',
      cancelText: 'Cancelar',
      variant: 'info'
    });
    if (!confirmed) return;

    setError(null);
    setStatus('loading');

    try {
      // 1. Ensure all days of the month up to the selected day are initialized
      // This is CRITICAL to ensure the report is complete and carries over patients correctly
      const ensureAllDaysInitialized = async () => {
        const [year, month, day] = currentDateString.split('-').map(Number);
        const dayNum = parseInt(selectedDay.toString(), 10);

        console.log(`[useCensusEmail] Starting month integrity check up to ${currentDateString}`);

        for (let d = 1; d <= dayNum; d++) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          // Check if day exists (either in provided month records or is the current one)
          // Note: we'll re-fetch below, but here we ensure they exist in DB
          try {
            await initializeDay(dateStr, d > 1 ? `${year}-${String(month).padStart(2, '0')}-${String(d - 1).padStart(2, '0')}` : undefined);
          } catch (e) {
            console.warn(`[useCensusEmail] Failed to initialize day ${dateStr}:`, e);
          }
        }
      };

      await ensureAllDaysInitialized();

      const finalMessage = message?.trim() ? message : buildCensusEmailBody(currentDateString, nurseSignature);
      const monthRecords = await getMonthRecordsFromFirestore(selectedYear, selectedMonth);
      const limitDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

      const filteredRecords = monthRecords
        .filter(r => r.date <= limitDate)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (!filteredRecords.some(r => r.date === currentDateString) && record) {
        filteredRecords.push(record);
      }

      if (filteredRecords.length === 0) {
        throw new Error('No hay registros del mes para generar el Excel maestro.');
      }

      filteredRecords.sort((a, b) => a.date.localeCompare(b.date));
      await triggerCensusEmail({
        date: currentDateString,
        records: filteredRecords,
        recipients: resolvedRecipients,
        nursesSignature: nurseSignature || undefined,
        body: finalMessage,
        userEmail: user?.email,
        userRole: user?.role || role
      });
      setStatus('success');
      // Button stays in 'success' state (disabled) for this date session
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error('Error enviando correo de censo', err);
      const errorMessage = error?.message || 'No se pudo enviar el correo.';
      setError(errorMessage);
      setStatus('error');
      alert(errorMessage, 'Error al enviar');
    }
  }, [
    record,
    status,
    recipients,
    currentDateString,
    message,
    nurseSignature,
    selectedYear,
    selectedMonth,
    selectedDay,
    user,
    role,
    testModeEnabled,
    testRecipient,
    isAdminUser
  ]);

  return {
    showEmailConfig,
    setShowEmailConfig,
    recipients,
    setRecipients,
    message,
    onMessageChange,
    onResetMessage,
    status,
    error,
    resetStatus,
    sendEmail,
    testModeEnabled,
    setTestModeEnabled,
    testRecipient,
    setTestRecipient,
    isAdminUser,
  };
};
