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
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAsA-igD7jTJGWldYDU_gsMTzWBzKBICMM",
  authDomain: "rejection-f96c5.firebaseapp.com",
  projectId: "rejection-f96c5",
  storageBucket: "rejection-f96c5.firebasestorage.app",
  messagingSenderId: "1070127116016",
  appId: "1:1070127116016:web:03030315e771a699041c35",
  measurementId: "G-XE68F7WYFX",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);

type Callback = (data: DocumentData[]) => void;
type ErrCallback = (err: Error) => void;

export function subscribeToRefusals(cb: Callback, onErr?: ErrCallback): Unsubscribe {
  const q = query(collection(db, 'refusals'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('refusals subscription:', err); onErr?.(err); }
  );
}

export function subscribeToReasons(cb: Callback, onErr?: ErrCallback): Unsubscribe {
  const q = query(collection(db, 'refusalReasons'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('reasons subscription:', err); onErr?.(err); }
  );
}

export function subscribeToUsers(cb: Callback, onErr?: ErrCallback): Unsubscribe {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    snap => cb(snap.docs.map(d => {
      const { passwordHash: _p, usernameLower: _u, pendingPassword: _pp, ...safe } = d.data() as any;
      return { id: d.id, ...safe };
    })),
    err => { console.error('users subscription:', err); onErr?.(err); }
  );
}
