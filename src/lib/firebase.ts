import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if we have a config, otherwise mock for build/dev
const app = getApps().length > 0
    ? getApp()
    : (firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null);

// Safe exports that won't crash if app is null (during build without keys)
// Cast to any to bypass strict type checks for the mock, as this is just to pass build
const auth = app ? getAuth(app) : ({} as any);

// Force Long Polling to bypass firewall/proxy issues
// This creates a standard HTTP stream instead of a WebSocket
// Also enable Offline Persistence via new cache API
import { persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const db = app ? initializeFirestore(app, {
    experimentalForceLongPolling: true, // Bypass Firewall/Proxy that blocks WebSockets
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
}, "ashera") : ({} as any);

// Legacy method removed to avoid deprecation warning
// enableIndexedDbPersistence is now handled in initializeFirestore config

const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
