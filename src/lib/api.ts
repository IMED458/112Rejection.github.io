/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { auth, db } from './firebase';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAsA-igD7jTJGWldYDU_gsMTzWBzKBICMM",
  authDomain: "rejection-f96c5.firebaseapp.com",
  projectId: "rejection-f96c5",
  storageBucket: "rejection-f96c5.firebasestorage.app",
  messagingSenderId: "1070127116016",
  appId: "1:1070127116016:web:03030315e771a699041c35",
};

const TOKEN_KEY = '112_auth_token';

// Synthetic email for Firebase Auth: username@112rejection.local
const toAuthEmail = (username: string) => `${username.toLowerCase().trim()}@112rejection.local`;

export { onAuthStateChanged, auth };

export const api = {
  getToken(): string | null {
    return auth.currentUser?.uid ?? localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    signOut(auth).catch(() => {});
  },

  async login(username: string, password: string) {
    const email = toAuthEmail(username);
    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error('მომხმარებლის სახელი ან პაროლი არასწორია');
      }
      throw new Error('სისტემაში შესვლა ვერ მოხერხდა');
    }

    const uid = cred.user.uid;
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) {
      await signOut(auth);
      throw new Error('მომხმარებლის პროფილი ვერ მოიძებნა');
    }

    const userData = userSnap.data();
    if (userData.status === 'inactive') {
      await signOut(auth);
      throw new Error('თქვენი ანგარიში დეაქტივირებულია');
    }

    localStorage.setItem(TOKEN_KEY, uid);

    // Apply pending password reset if admin set one
    if (userData.pendingPassword) {
      try {
        await updatePassword(cred.user, userData.pendingPassword);
        await updateDoc(doc(db, 'users', uid), { pendingPassword: null, updatedAt: new Date().toISOString() });
      } catch (_) {}
    }

    // Update last login (fire-and-forget)
    updateDoc(doc(db, 'users', uid), { lastLoginAt: new Date().toISOString() }).catch(() => {});
    this._log(uid, `${userData.firstName} ${userData.lastName}`, 'სისტემაში შესვლა', 'user', uid);

    const { passwordHash: _p, usernameLower: _u, ...safe } = userData as any;
    return { token: uid, firebaseToken: null, user: { id: uid, ...safe } };
  },

  async getMe() {
    const uid = auth.currentUser?.uid ?? localStorage.getItem(TOKEN_KEY);
    if (!uid) throw new Error('Not authenticated');
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) throw new Error('User not found');
    const { passwordHash: _p, usernameLower: _u, ...safe } = snap.data() as any;
    return { id: snap.id, ...safe };
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('Not authenticated');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    try {
      await reauthenticateWithCredential(user, cred);
    } catch {
      throw new Error('მიმდინარე პაროლი არასწორია');
    }
    await updatePassword(user, newPassword);
    await updateDoc(doc(db, 'users', user.uid), { updatedAt: new Date().toISOString() });
    this._log(user.uid, '', 'საკუთარი პაროლის შეცვლა', 'user', user.uid);
    return { message: 'პაროლი წარმატებით შეიცვალა' };
  },

  // =================== REFUSALS ===================
  async getRefusals() {
    const snap = await getDocs(query(collection(db, 'refusals'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async createRefusal(data: any) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const userSnap = await getDoc(doc(db, 'users', uid));
    const user = userSnap.data()!;

    const id = crypto.randomUUID();
    const refusal = {
      id,
      doctorId: uid,
      doctorFullNameSnapshot: `${user.firstName} ${user.lastName}`,
      patientIdentifier: data.patientIdentifier || '',
      diagnosis: data.diagnosis,
      refusalReason: data.refusalReason,
      refusalReasonCustom: data.refusalReason === 'სხვა' ? (data.refusalReasonCustom || '') : null,
      comment: data.comment || '',
      hospitalizationOperator: data.hospitalizationOperator || '',
      ambulanceInfo: data.ambulanceInfo || '',
      shiftType: data.shiftType || 'other',
      refusalDate: data.refusalDate,
      refusalTime: data.refusalTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: uid,
      updatedBy: uid,
    };

    await setDoc(doc(db, 'refusals', id), refusal);
    this._log(uid, `${user.firstName} ${user.lastName}`, `ახალი უარის დამატება (${data.diagnosis?.substring(0, 30)})`, 'refusal', id, null, refusal);
    return refusal;
  },

  async updateRefusal(id: string, data: any) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    const docSnap = await getDoc(doc(db, 'refusals', id));
    if (!docSnap.exists()) throw new Error('ჩანაწერი ვერ მოიძებნა');
    const old = docSnap.data();

    const userSnap = await getDoc(doc(db, 'users', uid));
    const user = userSnap.data()!;

    if (user.role !== 'admin' && old.doctorId !== uid) {
      throw new Error('სხვა ექიმის ჩანაწერის რედაქტირება დაშვებულია მხოლოდ ადმინისტრატორისთვის');
    }

    const updated = {
      ...old,
      patientIdentifier: data.patientIdentifier || '',
      diagnosis: data.diagnosis,
      refusalReason: data.refusalReason,
      refusalReasonCustom: data.refusalReason === 'სხვა' ? (data.refusalReasonCustom || '') : null,
      comment: data.comment || '',
      hospitalizationOperator: data.hospitalizationOperator || '',
      ambulanceInfo: data.ambulanceInfo || '',
      shiftType: data.shiftType || 'other',
      refusalDate: data.refusalDate,
      refusalTime: data.refusalTime,
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
    };

    await setDoc(doc(db, 'refusals', id), updated);
    this._log(uid, `${user.firstName} ${user.lastName}`, `უარის რედაქტირება (ID: ${id})`, 'refusal', id, old, updated);
    return updated;
  },

  async deleteRefusal(id: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    const docSnap = await getDoc(doc(db, 'refusals', id));
    if (!docSnap.exists()) throw new Error('ჩანაწერი ვერ მოიძებნა');
    const old = docSnap.data();

    const userSnap = await getDoc(doc(db, 'users', uid));
    const user = userSnap.data()!;

    if (user.role !== 'admin' && old.doctorId !== uid) {
      throw new Error('სხვისი ჩანაწერის წაშლის უფლება არ გაქვთ!');
    }

    await deleteDoc(doc(db, 'refusals', id));
    this._log(uid, `${user.firstName} ${user.lastName}`, `უარის წაშლა (${old.patientIdentifier || 'უცნობი'}, ${old.diagnosis})`, 'refusal', id, old, null);
    return { message: 'ჩანაწერი წარმატებით წაიშალა' };
  },

  // =================== REASONS ===================
  async getReasons() {
    const snap = await getDocs(query(collection(db, 'refusalReasons'), orderBy('createdAt', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async createReason(name: string) {
    const uid = auth.currentUser?.uid!;
    const id = crypto.randomUUID();
    const reason = { id, name, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'refusalReasons', id), reason);
    return reason;
  },

  async updateReason(id: string, data: { name?: string; isActive?: boolean }) {
    const docSnap = await getDoc(doc(db, 'refusalReasons', id));
    if (!docSnap.exists()) throw new Error('მიზეზი ვერ მოიძებნა');
    const updated = { ...docSnap.data(), ...data, updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'refusalReasons', id), updated);
    return updated;
  },

  async deleteReason(id: string) {
    await deleteDoc(doc(db, 'refusalReasons', id));
    return { message: 'მიზეზი წარმატებით წაიშალა' };
  },

  // =================== USERS ===================
  async getUsers() {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'asc')));
    return snap.docs.map(d => {
      const { passwordHash: _p, usernameLower: _u, ...safe } = d.data() as any;
      return { id: d.id, ...safe };
    });
  },

  async createUser(data: any) {
    const { firstName, lastName, username, email, password, role, status } = data;
    if (!password) throw new Error('პაროლი აუცილებელია');

    // Check username uniqueness in Firestore
    const existing = await getDocs(
      query(collection(db, 'users'), where('usernameLower', '==', username.toLowerCase()))
    );
    if (!existing.empty) throw new Error('ეს მომხმარებლის სახელი უკვე დაკავებულია');

    // Use secondary Firebase app so current admin session isn't replaced
    const secondaryApp = initializeApp(FIREBASE_CONFIG, `tmp-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        toAuthEmail(username),
        password
      );
      const uid = cred.user.uid;
      const newUser = {
        id: uid,
        firstName,
        lastName,
        username,
        usernameLower: username.toLowerCase(),
        email: email || '',
        role,
        status: status || 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', uid), newUser);
      await signOut(secondaryAuth);

      const adminUid = auth.currentUser?.uid;
      if (adminUid) this._log(adminUid, '', `მომხმარებლის დამატება: ${firstName} ${lastName} (${username})`, 'user', uid);

      return newUser;
    } finally {
      await deleteApp(secondaryApp).catch(() => {});
    }
  },

  async updateUser(id: string, data: any) {
    const docSnap = await getDoc(doc(db, 'users', id));
    if (!docSnap.exists()) throw new Error('მომხმარებელი ვერ მოიძებნა');
    const old = docSnap.data();

    const updates: any = {
      firstName: data.firstName ?? old.firstName,
      lastName: data.lastName ?? old.lastName,
      email: data.email ?? old.email,
      role: data.role ?? old.role,
      status: data.status ?? old.status,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(doc(db, 'users', id), updates);
    const { passwordHash: _p, usernameLower: _u, ...safe } = { ...old, ...updates, id } as any;
    return safe;
  },

  async resetUserPassword(id: string, data: { newPassword: string }) {
    const userSnap = await getDoc(doc(db, 'users', id));
    if (!userSnap.exists()) throw new Error('მომხმარებელი ვერ მოიძებნა');
    const u = userSnap.data();

    const userEmail = u.email;
    const authEmail = toAuthEmail(u.username);

    // Try sending a password reset email to real email if available
    if (userEmail && userEmail.includes('@') && !userEmail.endsWith('@112rejection.local')) {
      await sendPasswordResetEmail(auth, userEmail);
      return { message: `პაროლის გადაყენების ბმული გაიგზავნა ${userEmail}-ზე` };
    }

    // Fallback: store pending password in Firestore — applied on next login
    await updateDoc(doc(db, 'users', id), {
      pendingPassword: data.newPassword,
      updatedAt: new Date().toISOString(),
    });
    return { message: 'პაროლი განახლდება მომხმარებლის შემდეგი შესვლისას' };
  },

  async deleteUser(id: string) {
    const docSnap = await getDoc(doc(db, 'users', id));
    if (!docSnap.exists()) throw new Error('მომხმარებელი ვერ მოიძებნა');
    const u = docSnap.data();
    // Delete Firestore profile — user can't log in without it even if Firebase Auth account exists
    await deleteDoc(doc(db, 'users', id));
    const adminUid = auth.currentUser?.uid;
    if (adminUid) this._log(adminUid, '', `მომხმარებლის წაშლა: ${u.firstName} ${u.lastName} (${u.username})`, 'user', id);
    return { message: 'მომხმარებელი წარმატებით წაიშალა' };
  },

  // =================== STATS ===================
  async getStats() {
    return this.getRefusals();
  },

  // =================== AUDIT LOGS ===================
  async getAuditLogs() {
    const snap = await getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // =================== INTERNAL ===================
  async _log(userId: string, userFullName: string, action: string, entityType: string, entityId: string, oldValue?: any, newValue?: any) {
    const id = crypto.randomUUID();
    setDoc(doc(db, 'auditLogs', id), {
      id, userId, userFullName, action, entityType, entityId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      createdAt: new Date().toISOString(),
    }).catch(() => {});
  },
};
