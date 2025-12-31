import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { saveErrorLog } from '../../services/storage/indexedDBService';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Global Error Boundary
 * Catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return {
            hasError: true,
            error
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // You can also log the error to an error reporting service
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);

        // Log to our persistent IndexedDB store
        saveErrorLog({
            id: `err_${Date.now()}`,
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            severity: 'critical',
            context: {
                componentStack: errorInfo.componentStack || undefined,
                boundary: 'ErrorBoundary'
            }
        });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    handleGoHome = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>

                            <h1 className="text-2xl font-bold text-slate-900 mb-2">
                                Algo salió mal
                            </h1>

                            <p className="text-slate-600 mb-8">
                                La aplicación encontró un error inesperado al renderizar esta sección.
                                Hemos registrado el fallo para solucionarlo.
                            </p>

                            <div className="w-full space-y-3">
                                <button
                                    onClick={this.handleReset}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-sm"
                                >
                                    <RefreshCcw className="w-5 h-5" />
                                    Recargar Aplicación
                                </button>

                                <button
                                    onClick={this.handleGoHome}
                                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-colors"
                                >
                                    <Home className="w-5 h-5" />
                                    Volver al Inicio
                                </button>
                            </div>

                            {process.env.NODE_ENV === 'development' && (
                                <div className="mt-8 w-full">
                                    <details className="text-left bg-slate-50 p-4 rounded-lg border border-slate-200 overflow-hidden">
                                        <summary className="text-sm font-medium text-slate-500 cursor-pointer hover:text-slate-700">
                                            Detalles técnicos (Desarrollo)
                                        </summary>
                                        <pre className="mt-2 text-xs text-red-700 overflow-x-auto whitespace-pre-wrap">
                                            {this.state.error?.toString()}
                                            {this.state.error?.stack}
                                        </pre>
                                    </details>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
