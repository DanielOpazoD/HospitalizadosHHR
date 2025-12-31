import React from 'react';
import {
    Navbar,
    DateStrip,
    SettingsModal,
    TestAgent,
    SyncWatcher,
    DemoModePanel
} from '@/components';
import { AppRouter } from '@/components/AppRouter';
import { AppProviders } from '@/components/AppProviders';
import { generateCensusMasterExcel } from '@/services';
import { CensusEmailConfigModal } from '@/components/census/CensusEmailConfigModal';

import { useAuth } from '@/context/AuthContext';
import { UseDateNavigationReturn } from '@/hooks/useDateNavigation';
import { UseUIStateReturn } from '@/hooks/useUIState';
import { DailyRecordContextType } from '@/hooks/useDailyRecord';
import { UseCensusEmailReturn } from '@/hooks/useCensusEmail';
import { UseFileOperationsReturn } from '@/hooks/useFileOperations';
import { UseNurseSignatureReturn } from '@/hooks/useNurseSignature';

interface AppContentProps {
    dateNav: UseDateNavigationReturn & {
        isSignatureMode: boolean;
        existingDaysInMonth: number[];
    };
    ui: UseUIStateReturn;
    dailyRecordHook: DailyRecordContextType;
    censusEmail: UseCensusEmailReturn;
    fileOps: UseFileOperationsReturn;
    nurseSignature: UseNurseSignatureReturn;
}

export const AppContent: React.FC<AppContentProps> = ({
    dateNav,
    ui,
    dailyRecordHook,
    censusEmail,
    fileOps,
    nurseSignature
}) => {
    const auth = useAuth();
    const { record, syncStatus, lastSyncTime } = dailyRecordHook;
    const { isSignatureMode, currentDateString } = dateNav;

    return (
        <AppProviders dailyRecordHook={dailyRecordHook} userId={auth.user?.uid || 'anon'}>
            <div className="min-h-screen bg-slate-100 font-sans flex flex-col print:bg-white print:p-0">
                {/* Navigation */}
                {!isSignatureMode && (
                    <Navbar
                        currentModule={ui.currentModule}
                        setModule={ui.setCurrentModule}
                        censusViewMode={ui.censusViewMode}
                        setCensusViewMode={ui.setCensusViewMode}
                        onOpenBedManager={ui.bedManagerModal.open}
                        onExportJSON={fileOps.handleExportJSON}
                        onExportCSV={fileOps.handleExportCSV}
                        onImportJSON={fileOps.handleImportJSON}
                        onOpenSettings={ui.settingsModal.open}
                        userEmail={auth.user?.email}
                        onLogout={auth.signOut}
                        isFirebaseConnected={auth.isFirebaseConnected}
                    />
                )}

                {/* Date Strip */}
                {ui.censusViewMode === 'REGISTER' && !isSignatureMode && (
                    <DateStrip
                        selectedYear={dateNav.selectedYear} setSelectedYear={dateNav.setSelectedYear}
                        selectedMonth={dateNav.selectedMonth} setSelectedMonth={dateNav.setSelectedMonth}
                        selectedDay={dateNav.selectedDay} setSelectedDay={dateNav.setSelectedDay}
                        currentDateString={currentDateString}
                        daysInMonth={dateNav.daysInMonth}
                        existingDaysInMonth={dateNav.existingDaysInMonth}
                        onPrintPDF={ui.showPrintButton ? () => window.print() : undefined}
                        onOpenBedManager={ui.currentModule === 'CENSUS' ? ui.bedManagerModal.open : undefined}
                        onExportExcel={ui.currentModule === 'CENSUS'
                            ? () => generateCensusMasterExcel(dateNav.selectedYear, dateNav.selectedMonth, dateNav.selectedDay)
                            : undefined}
                        onConfigureEmail={ui.currentModule === 'CENSUS' ? () => censusEmail.setShowEmailConfig(true) : undefined}
                        onSendEmail={ui.currentModule === 'CENSUS' ? censusEmail.sendEmail : undefined}
                        emailStatus={censusEmail.status}
                        emailErrorMessage={censusEmail.error}
                        syncStatus={syncStatus}
                        lastSyncTime={lastSyncTime}
                    />
                )}

                {/* Main Content */}
                <main className="max-w-screen-2xl mx-auto px-4 pt-4 pb-20 flex-1 w-full print:p-0 print:pb-0 print:max-w-none">
                    <AppRouter
                        currentModule={ui.currentModule}
                        censusViewMode={ui.censusViewMode}
                        selectedDay={dateNav.selectedDay}
                        selectedMonth={dateNav.selectedMonth}
                        currentDateString={currentDateString}
                        role={auth.role}
                        isSignatureMode={isSignatureMode}
                        onOpenBedManager={ui.bedManagerModal.open}
                        showBedManagerModal={ui.bedManagerModal.isOpen}
                        onCloseBedManagerModal={ui.bedManagerModal.close}
                    />
                </main>

                {/* Global Modals */}
                <SettingsModal
                    isOpen={ui.settingsModal.isOpen}
                    onClose={ui.settingsModal.close}
                    onGenerateDemo={ui.demoModal.open}
                    onRunTest={() => ui.setIsTestAgentRunning(true)}
                    canDownloadPassport={auth.canDownloadPassport}
                    onDownloadPassport={auth.handleDownloadPassport}
                    isOfflineMode={auth.isOfflineMode}
                />

                <CensusEmailConfigModal
                    isOpen={censusEmail.showEmailConfig}
                    onClose={() => censusEmail.setShowEmailConfig(false)}
                    recipients={censusEmail.recipients}
                    onRecipientsChange={censusEmail.setRecipients}
                    message={censusEmail.message}
                    onMessageChange={censusEmail.onMessageChange}
                    onResetMessage={censusEmail.onResetMessage}
                    date={currentDateString}
                    nursesSignature={nurseSignature}
                    isAdminUser={censusEmail.isAdminUser}
                    testModeEnabled={censusEmail.testModeEnabled}
                    onTestModeChange={censusEmail.setTestModeEnabled}
                    testRecipient={censusEmail.testRecipient}
                    onTestRecipientChange={censusEmail.setTestRecipient}
                />

                <TestAgent
                    isRunning={ui.isTestAgentRunning}
                    onComplete={() => ui.setIsTestAgentRunning(false)}
                    currentRecord={record}
                />

                <SyncWatcher />
                <DemoModePanel isOpen={ui.demoModal.isOpen} onClose={ui.demoModal.close} />
            </div>
        </AppProviders>
    );
};
