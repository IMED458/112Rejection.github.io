/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { subscribeToUsers } from '../lib/firebase';
import { User, UserRole, UserStatus } from '../types';
import { Users, UserPlus, ShieldAlert, CheckCircle, XCircle, Trash2, Edit, KeyRound, Clock, RefreshCw } from 'lucide-react';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form controls
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('doctor');
  const [status, setStatus] = useState<UserStatus>('active');

  // Password reset controls
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUsername, setResetUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = () => { /* live sync via onSnapshot */ };

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToUsers(data => {
      setUsers(data as User[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleOpenAdd = () => {
    setEditingUserId(null);
    setFirstName('');
    setLastName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('doctor');
    setStatus('active');
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUserId(user.id);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setUsername(user.username);
    setEmail(user.email || '');
    setPassword('****'); // place holder, password not loaded
    setRole(user.role);
    setStatus(user.status);
    setError('');
    setShowModal(true);
  };

  const handleOpenReset = (user: User) => {
    setResetUserId(user.id);
    setResetUsername(user.username);
    setNewPassword('');
    setError('');
    setShowResetModal(true);
  };

  const handleDelete = async (id: string, fullName: string) => {
    if (window.confirm(`ნამდვილად გსურთ მომხმარებლის [ ${fullName} ] სამუდამოდ წაშლა?`)) {
      try {
        await api.deleteUser(id);
        alert('მომხმარებელი წარმატებით წაიშალა');
      } catch (err: any) {
        alert(err?.message || 'წაშლა ვერ მოხერხდა');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      setError('გთხოვთ შეავსოთ სავალდებულო ველები');
      return;
    }

    const payload: any = {
      firstName,
      lastName,
      username,
      email,
      role,
      status
    };

    try {
      if (editingUserId) {
        await api.updateUser(editingUserId, payload);
      } else {
        if (!password.trim()) {
          setError('საწყისი პაროლი აუცილებელია ახალი კაბინეტისთვის');
          return;
        }
        payload.password = password;
        await api.createUser(payload);
      }
      setShowModal(false);
    } catch (err: any) {
      setError(err?.message || 'შენახვისას დაფიქსირდა შეცდომა');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setError('პაროლი არ შეიძლება იყოს ცარიელი');
      return;
    }

    try {
      await api.resetUserPassword(resetUserId!, { newPassword });
      alert('მომხმარებლის პაროლი წარმატებით შეიცვალა/აღდგა');
      setShowResetModal(false);
    } catch (err: any) {
      setError(err?.message || 'შეცდომა პაროლის განახლებისას');
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-4 px-4 sm:px-6 font-sans">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="text-blue-600" />
            პერსონალის / მომხმარებლების მართვა
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            მორიგე ექიმების და ადმინისტრატორების ანგარიშების რეგისტრაცია, რედაქტირება და პაროლების მართვა
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            className="flex items-center gap-1 p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-md border border-gray-200 transition cursor-pointer"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-sm transition cursor-pointer"
          >
            <UserPlus size={15} />
            ახალი მომხმარებელი
          </button>
        </div>
      </div>

      {error && !showModal && !showResetModal && (
        <div className="mb-6 bg-red-50 text-red-800 p-4 rounded-md border border-red-100 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
          <RefreshCw className="animate-spin text-blue-600" size={24} />
          იტვირთება მომხმარებლების ბაზა...
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">სახელი და გვარი</th>
                <th className="px-5 py-4">ქსელის მომხმარებელი</th>
                <th className="px-5 py-4">ელფოსტა</th>
                <th className="px-5 py-4">როლი</th>
                <th className="px-5 py-4 text-center">სტატუსი</th>
                <th className="px-5 py-4">ბოლო შესვლა</th>
                <th className="px-5 py-4 text-right">ქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/75 transition duration-75">
                  <td className="px-5 py-4 font-bold text-slate-900">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-5 py-4 font-mono text-slate-600 font-semibold bg-slate-50/50">
                    @{u.username}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{u.email || '-'}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.role === 'admin' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}>
                      {u.role === 'admin' ? 'ადმინისტრატორი' : 'მორიგე ექიმი'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center gap-1 justify-center">
                      {u.status === 'active' ? (
                        <>
                          <CheckCircle size={14} className="text-emerald-500" />
                          <span className="font-semibold text-emerald-700 text-[11px]">აქტიური</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={14} className="text-red-400" />
                          <span className="font-semibold text-slate-400 text-[11px]">პასიური</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                    {u.lastLoginAt ? (
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-slate-400" />
                        {new Date(u.lastLoginAt).toLocaleString('ka-GE')}
                      </span>
                    ) : 'არ შესულა'}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenReset(u)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition"
                        title="პაროლის აღდგენა/შეცვლა"
                      >
                        <KeyRound size={13} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 rounded-lg transition"
                        title="რედაქტირება"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, `${u.firstName} ${u.lastName}`)}
                        className="p-1.5 text-red-600 hover:text-red-700 bg-red-50 border border-red-200 rounded-lg transition"
                        title="სრული წაშლა"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Main Registration Add / Edit Modal Drawer */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg border border-gray-200 overflow-hidden transform transition-all duration-150">
            <div className="bg-[#1E293B] px-6 py-4 flex items-center justify-between text-white">
              <h3 className="text-sm font-bold tracking-tight">
                {editingUserId ? 'მომხმარებლის მონაცემების კორექტირება' : 'ახალი მომხმარებლის რეგისტრაცია'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-semibold">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 rounded-md text-xs font-semibold">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">სახელი <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="მაგ: გიორგი"
                    className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">გვარი <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="მაგ: ერისთავი"
                    className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-505"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">მომხმარებლის სახელი (ქსელის ავტორიზაციისთვის) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  disabled={!!editingUserId}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="მაგ: g_eristavi"
                  className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">ელექტრონული ფოსტა <span className="text-slate-400 font-normal">(არასავალდებულო)</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@clinic.ge"
                  className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {!editingUserId && (
                <div>
                  <label className="block text-slate-600 mb-1">საწყისი უსაფრთხო პაროლი <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="მინიმუმ 6 სიმბოლო"
                    className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">როლი კლინიკაში</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="doctor">მორიგე ექიმი</option>
                    <option value="admin">ადმინისტრატორი</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">სტატუსი</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserStatus)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="active">აქტიური</option>
                    <option value="inactive">დეაქტივირებული</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-md text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 hover:bg-blue-700 text-white bg-blue-600 rounded-md font-bold cursor-pointer"
                >
                  შენახვა / დასტური
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal Box */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg border border-gray-200 overflow-hidden transform transition-all duration-150">
            <div className="bg-[#1E293B] px-6 py-4 flex items-center justify-between text-white">
              <h3 className="text-sm font-bold tracking-tight">მომხმარებლის პაროლის აღდგენა / შეცვლა</h3>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <div className="bg-slate-50 p-3.5 rounded-md border border-gray-200">
                მომხმარებელი: <strong className="text-slate-900 text-sm">@{resetUsername}</strong>
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 rounded-md font-bold">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-slate-600 mb-1">ახალი უსაფრთხო პაროლი <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="ჩაწერეთ ახალი ადმინისტრაციული პაროლი..."
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-md text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 hover:bg-blue-700 text-white bg-blue-600 rounded-md font-bold cursor-pointer"
                >
                  განახლება
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
