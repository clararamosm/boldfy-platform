// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

let db: Firestore;
let auth: Auth;

if (!admin.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
        try {
            const serviceAccount = JSON.parse(serviceAccountKey);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } catch (error) {
            console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY or initialize Firebase Admin SDK", error);
        }
    } else {
        // Use Application Default Credentials (ADC) - works on Firebase App Hosting
        admin.initializeApp();
    }
}

// Get instances (whether initialized with service account key or ADC)
if (admin.apps.length) {
    db = admin.firestore();
    auth = admin.auth();
}

// @ts-ignore
export { db, auth };
