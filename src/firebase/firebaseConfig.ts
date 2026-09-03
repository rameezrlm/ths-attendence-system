import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.trim() !== '' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId.trim() !== ''
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

    // Connect to (default) database if not a custom database
    const dbId =
      firebaseConfig.firestoreDatabaseId &&
      firebaseConfig.firestoreDatabaseId !== '(default)'
        ? firebaseConfig.firestoreDatabaseId
        : undefined;

    db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    auth = getAuth(app);

    // Attempt anonymous sign-in in background so request.auth is populated if enabled
    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch(() => {
        // Fallback gracefully if anonymous sign-in is disabled in project console
      });
    }
  } catch (error) {
    console.warn('Firebase initialization error, fallback active:', error);
  }
}

export { app, db, auth };

