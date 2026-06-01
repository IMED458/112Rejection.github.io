/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Shield, RefreshCw } from 'lucide-react';

interface SetupScreenProps {
  onSetupComplete: () => void;
}

export function SetupScreen({ onSetupComplete }: SetupScreenProps) {
  const [adminPassword, setAdminPassword] = useState('');
  const [doctorPassword, setDoctorPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim() || !doctorPassword.trim()) {
      setError('გთხოვთ შეავსოთ ორივე პაროლი');
      return;
    }
    if (adminPassword.length < 6 || doctorPassword.length < 6) {
      setError('პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const now = new Date().toISOString();

      // Check if already seeded
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        onSetupComplete();
        return;
      }

      // Create admin Firebase Auth + Firestore user
      const adminCred = await createUserWithEmailAndPassword(
        auth,
        'admin@112rejection.local',
        adminPassword
      );
      const adminId = adminCred.user.uid;

      await setDoc(doc(db, 'users', adminId), {
        id: adminId,
        firstName: 'სისტემის',
        lastName: 'ადმინისტრატორი',
        username: 'admin',
        usernameLower: 'admin',
        email: '',
        role: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      // Seed default refusal reasons
      const defaultReasons = [
        'პალიატიური',
        'სხვა კლინიკის ონკოლოგია',
        'ალკოჰოლური ინტოქსიკაცია',
        'მწოლიარე პაციენტია(დემენცია, ენცეფალოპათია)',
        'საჭირო კვლევა ან სერვისი მიუწვდომელია',
        'სხვა',
      ];
      for (const name of defaultReasons) {
        const id = crypto.randomUUID();
        await setDoc(doc(db, 'refusalReasons', id), {
          id, name, isActive: true, createdAt: now, updatedAt: now,
        });
      }

      // Create doctor Firebase Auth + Firestore user via secondary app
      const { initializeApp, deleteApp } = await import('firebase/app');
      const { getAuth, createUserWithEmailAndPassword: createUser, signOut } = await import('firebase/auth');
      const secondaryApp = initializeApp({
        apiKey: "AIzaSyAsA-igD7jTJGWldYDU_gsMTzWBzKBICMM",
        authDomain: "rejection-f96c5.firebaseapp.com",
        projectId: "rejection-f96c5",
        storageBucket: "rejection-f96c5.firebasestorage.app",
        messagingSenderId: "1070127116016",
        appId: "1:1070127116016:web:03030315e771a699041c35",
      }, `setup-doctor-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const doctorCred = await createUser(secondaryAuth, 'doctor@112rejection.local', doctorPassword);
      const doctorId = doctorCred.user.uid;
      await setDoc(doc(db, 'users', doctorId), {
        id: doctorId,
        firstName: 'მორიგე',
        lastName: 'ექიმი',
        username: 'doctor',
        usernameLower: 'doctor',
        email: '',
        role: 'doctor',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      onSetupComplete();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        onSetupComplete();
        return;
      }
      setError(err?.message || 'დაყენება ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-emerald-600 p-3 rounded-lg shadow-sm text-white">
            <Shield size={36} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-extrabold text-slate-900 tracking-tight">
          სისტემის პირველი დაყენება
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          შექმენით admin და doctor ანგარიშების საწყისი პაროლები
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm rounded-xl border border-slate-100 sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSetup} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ადმინისტრატორის პაროლი (<span className="font-mono text-blue-600">admin</span>)
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                placeholder="მინ. 6 სიმბოლო"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ექიმის პაროლი (<span className="font-mono text-emerald-600">doctor</span>)
              </label>
              <input
                type="password"
                value={doctorPassword}
                onChange={e => setDoctorPassword(e.target.value)}
                placeholder="მინ. 6 სიმბოლო"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-70 cursor-pointer"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
              {loading ? 'იქმნება...' : 'სისტემის გაშვება'}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-slate-400 text-center">
            ეს გვერდი მხოლოდ ერთხელ გამოჩნდება — პირველი გაშვებისას
          </p>
        </div>
      </div>
    </div>
  );
}
