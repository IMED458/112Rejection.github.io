/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { api } from '../lib/api';
import { KeyRound, Lock, CheckCircle, AlertCircle } from 'lucide-react';

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('გთხოვთ შეავსოთ ყველა ველი');
      return;
    }

    if (newPassword.length < 6) {
      setError('ახალი პაროლი უნდა შედგებოდეს მინიმუმ 6 სიმბოლოსგან');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('ახალი პაროლები არ ემთხვევა ერთმანეთს');
      return;
    }

    setLoading(true);

    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess('თქვენი პაროლი წარმატებით შეიცვალა.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || 'პაროლის შეცვლა ვერ მოხერხდა. მიმდინარე პაროლი არასწორია');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 sm:px-6">
      <div className="text-center mb-6">
        <div className="mx-auto bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center text-slate-700 mb-3 border border-slate-200">
          <Lock size={20} />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">საკუთარი პაროლის შეცვლა</h1>
        <p className="text-xs text-slate-500 mt-1">
          უსაფრთხოების დასაცავად რეგულარულად განაახლეთ თქვენი პაროლი
        </p>
      </div>

      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm text-xs font-semibold">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 rounded font-bold flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 text-emerald-800 rounded font-bold flex items-center gap-1.5">
              <CheckCircle size={14} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-600 mb-1">მიმდინარე (ძველი) პაროლი <span className="text-red-500">*</span></label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="******"
                className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 mb-1">ახალი უსაფრთხო პაროლი <span className="text-red-500">*</span></label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="მინიმუმ 6 სიმბოლო"
                className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 mb-1">გაიმეორეთ ახალი პაროლი <span className="text-red-500">*</span></label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="მინიმუმ 6 სიმბოლო"
                className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 font-bold"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-50">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound size={16} />
              {loading ? 'მიმდინარეობს პროცესი...' : 'პაროლის განახლება / შეცვლა'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
