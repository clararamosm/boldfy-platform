// src/lib/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  "projectId": "boldfy-app",
  "appId": "1:217540524134:web:fa840dec8fec7b48d415a7",
  "storageBucket": "boldfy-app.firebasestorage.app",
  "apiKey": "AIzaSyB48qj4ZJFsw1VslamUkGpmVM884ssNfB8",
  "authDomain": "boldfy-app.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "217540524134"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
