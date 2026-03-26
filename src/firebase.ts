import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Sign in anonymously to enable data sync without login
export const initAuth = async () => {
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error: any) {
    if (error.code === 'auth/admin-restricted-operation') {
      console.warn("Firebase Anonymous Auth is not enabled in the console. Falling back to local mode.");
    } else {
      console.error("Error signing in anonymously:", error);
    }
    return null;
  }
};
