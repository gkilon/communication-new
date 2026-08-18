
// @ts-ignore
import { initializeApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// פונקציה בטוחה לשליפת משתנים
const getEnv = (key: string) => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    return undefined;
  }
  return undefined;
};

// הגדרות Firebase - נלקחות אך ורק ממשתני סביבה!
// אין להכניס כאן ערכים קשיחים (Hardcoded strings)
const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID"),
  measurementId: getEnv("VITE_FIREBASE_MEASUREMENT_ID") || ""
};

let auth: Auth = { currentUser: null } as unknown as Auth;
let db: Firestore = {} as Firestore;
let isFirebaseInitialized = false;

// בדיקה האם הקונפיגורציה תקינה
const isConfigValid = (config: typeof firebaseConfig) => {
    if (!config) return false;
    return !!config.apiKey && !!config.authDomain && !!config.projectId;
};

if (isConfigValid(firebaseConfig)) {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isFirebaseInitialized = true;
        console.log("Firebase initialized securely via Environment Variables.");
    } catch (error) {
        console.error("Failed to initialize Firebase. Check Environment Variables.", error);
        isFirebaseInitialized = false;
    }
} else {
    console.warn("Firebase config missing. Please set VITE_FIREBASE_... environment variables in Netlify/Vercel.");
    isFirebaseInitialized = false;
}

export { auth, db, isFirebaseInitialized };
