import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
const db = app ? getFirestore(app) : ({} as any);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
