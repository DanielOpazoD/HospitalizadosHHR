import { initializeApp, type FirebaseOptions, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, enableMultiTabIndexedDbPersistence, type Firestore } from 'firebase/firestore';

const decodeBase64 = (rawValue: string) => {
    const value = rawValue?.trim();
    if (!value) return '';

    // Normalize base64 (remove whitespace, handle URL-safe variants, ensure padding)
    const normalized = value
        .replace(/\s+/g, '')
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(value.length / 4) * 4, '=');

    try {
        if (typeof atob === 'function') {
            return atob(normalized);
        }

        return Buffer.from(normalized, 'base64').toString('utf-8');
    } catch (error) {
        console.warn('Firebase API key could not be decoded from base64:', error);
        return '';
    }
};

const mountConfigWarning = (message: string) => {
    console.warn(message);

    if (typeof document === 'undefined') return;
    const root = document.getElementById('root');
    if (!root) return;

    root.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#0f172a;">
            <div style="max-width:520px;padding:24px;border-radius:12px;background:white;box-shadow:0 10px 40px rgba(15,23,42,0.12);font-family:Inter,sans-serif;">
                <h1 style="font-size:20px;font-weight:700;margin:0 0 12px 0;">Configuración de Firebase incompleta</h1>
                <p style="margin:0 0 8px 0;line-height:1.5;">La aplicación no puede iniciarse porque falta la clave API de Firebase.</p>
                <ol style="margin:0 0 12px 20px;line-height:1.5;">
                    <li>En Netlify, crea la variable <code>VITE_FIREBASE_API_KEY</code> (o <code>VITE_FIREBASE_API_KEY_B64</code> si prefieres base64) con tu API key de Firebase.</li>
                    <li>Vuelve a desplegar el sitio para que la configuración se aplique.</li>
                </ol>
                <p style="margin:0;color:#475569;font-size:14px;">Las claves se cargan en tiempo de ejecución desde una función serverless, por lo que no se incluyen en el bundle público.</p>
            </div>
        </div>
    `;
};

const fetchRuntimeConfig = async (): Promise<FirebaseOptions> => {
    try {
        const configUrl = `/.netlify/functions/firebase-config?t=${Date.now()}&mode=recovery`;
        const response = await fetch(configUrl, {
            headers: { 'Cache-Control': 'no-cache' }
        });

        if (!response.ok) {
            throw new Error(`Runtime config request failed (${response.status})`);
        }

        const config = await response.json();
        return config satisfies FirebaseOptions;
    } catch (error) {
        console.error('Failed to load Firebase config from Netlify function', error);
        mountConfigWarning('No se pudo cargar la configuración de Firebase desde Netlify. Verifica las variables en el panel de Netlify.');
        throw error;
    }
};

const buildDevConfig = (): FirebaseOptions => {
    const encodedKey = import.meta.env.VITE_FIREBASE_API_KEY_B64 || '';
    const plainKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
    const apiKey = encodedKey ? decodeBase64(encodedKey) : plainKey;

    return {
        apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
    } satisfies FirebaseOptions;
};

const loadFirebaseConfig = () => {
    if (import.meta.env.DEV) {
        return Promise.resolve(buildDevConfig());
    }

    return fetchRuntimeConfig();
};

let app!: FirebaseApp;
let auth!: Auth;
let db!: Firestore;

export const firebaseReady = (async () => {
    const firebaseConfig = await loadFirebaseConfig();

    if (!firebaseConfig.apiKey) {
        mountConfigWarning('Firebase API key is missing. Please configure it in Netlify.');
        throw new Error('Missing Firebase API key');
    }

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = initializeFirestore(app, { ignoreUndefinedProperties: true });

    enableMultiTabIndexedDbPersistence(db).catch((err) => {
        if ((err as any).code === 'failed-precondition') {
            console.warn('Firestore persistence failed: Multiple tabs open');
        } else if ((err as any).code === 'unimplemented') {
            console.warn('Firestore persistence not available in this browser');
        }
    });

    // If emulators are configured, connect (kept for compatibility with existing dev setups)
    const authEmulatorHost = import.meta.env.VITE_AUTH_EMULATOR_HOST;
    const firestoreEmulatorHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST;

    if (import.meta.env.DEV && authEmulatorHost) {
        connectAuthEmulator(auth, authEmulatorHost);
    }

    if (import.meta.env.DEV && firestoreEmulatorHost) {
        const [host, port] = firestoreEmulatorHost.split(':');
        connectFirestoreEmulator(db, host, Number(port));
    }

    return { app, auth, db };
})();

export { app, auth, db, mountConfigWarning };
export default app;
