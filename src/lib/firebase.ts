/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
  DocumentData,
} from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAsA-igD7jTJGWldYDU_gsMTzWBzKBICMM",
  authDomain: "rejection-f96c5.firebaseapp.com",
  projectId: "rejection-f96c5",
  storageBucket: "rejection-f96c5.firebasestorage.app",
  messagingSenderId: "1070127116016",
  appId: "1:1070127116016:web:03030315e771a699041c35",
  measurementId: "G-XE68F7WYFX"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);

export async function signInWithFirebaseToken(customToken: string): Promise<void> {
  try {
    await signInWithCustomToken(auth, customToken);
  } catch (err) {
    console.warn('Firebase custom token sign-in failed', err);
  }
}

export function subscribeToRefusals(
  callback: (data: DocumentData[]) => void
): Unsubscribe {
  const q = query(collection(db, 'refusals'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snapshot => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(items);
  }, err => {
    console.error('Refusals subscription error:', err);
  });
}

export function subscribeToReasons(
  callback: (data: DocumentData[]) => void
): Unsubscribe {
  const q = query(collection(db, 'refusalReasons'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, snapshot => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(items);
  }, err => {
    console.error('Reasons subscription error:', err);
  });
}

export function subscribeToUsers(
  callback: (data: DocumentData[]) => void
): Unsubscribe {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, snapshot => {
    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      const { passwordHash: _ph, ...safeData } = data as any;
      return { id: doc.id, ...safeData };
    });
    callback(items);
  }, err => {
    console.error('Users subscription error:', err);
  });
}
