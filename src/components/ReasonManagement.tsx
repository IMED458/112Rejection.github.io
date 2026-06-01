/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { subscribeToReasons } from '../lib/firebase';
import { RefusalReason } from '../types';
import { Settings, Plus, ToggleLeft, ToggleRight, Trash2, Edit, CheckCircle, RefreshCw } from 'lucide-react';

export function ReasonManagement() {
  const [reasons, setReasons] = useState<RefusalReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const fetchReasons = () => { /* live sync via onSnapshot */ };

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToReasons(
      data => { setReasons(data as RefusalReason[]); setLoading(false); },
      () => { setLoading(false); setError('მიზეზების ჩატვირთვა ვერ მოხერხდა'); }
    );
    return () => unsub();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setError('');
    try {
      await api.createReason(newName.trim());
      setNewName('');
    } catch (err: any) {
      setError(err?.message || 'მიზეზის დამატება ვერ მოხერხდა');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await api.updateReason(id, { isActive: !currentStatus });
    } catch (err: any) {
      alert(err?.message || 'სტატუსის შეცვლა ვერ მოხერხდა');
    }
  };

  const handleStartEdit = (reason: RefusalReason) => {
    setEditingId(reason.id);
    setEditingName(reason.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await api.updateReason(id, { name: editingName.trim() });
      setEditingId(null);
    } catch (err: any) {
      alert(err?.message || 'რედაქტირება ვერ მოხერხდა');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`ნამდვილად გსურთ უარის მიზეზის [ ${name} ] წაშლა საიტიდან?`)) {
      try {
        await api.deleteReason(id);
      } catch (err: any) {
        alert(err?.message || 'წაშლა ვერ მოხერხდა');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 font-sans">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="text-blue-600 text-slate-800" />
            უარის მიზეზების მართვა
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ჩამოსაშლელი მენიუსთვის უარის თქმის მიზეზების სიის კონფიგურაცია
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-800 p-4 rounded-md border border-red-100 text-sm">
          {error}
        </div>
      )}

      {/* Add New Reason Selector Form - Inline */}
      <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm mb-6">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
          ახალი უარის მიზეზის დამატება
        </h3>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="მაგ: სპეციალისტის არყოფნა, თავისუფალი საწოლის დეფიციტი..."
            className="flex-1 p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm font-semibold"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-md flex items-center gap-1 cursor-pointer"
          >
            <Plus size={16} />
            დამატება
          </button>
        </form>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm flex flex-col justify-center items-center gap-2">
          <RefreshCw className="animate-spin text-blue-600" size={24} /> იტვირთება სია...
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-xs">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
              <tr>
                <th className="px-5 py-4 w-12">N</th>
                <th className="px-5 py-4">მიზეზის დასახელება</th>
                <th className="px-5 py-4 text-center w-28">სტატუსი დაშვებაში</th>
                <th className="px-5 py-4 text-right w-40">ქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
              {reasons.map((r, index) => (
                <tr key={r.id} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-4 font-bold text-slate-400">{index + 1}</td>
                  <td className="px-5 py-4 text-sm font-bold">
                    {editingId === r.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 p-1 bg-white border border-blue-500 rounded-md font-semibold text-slate-900 focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveEdit(r.id)}
                          className="px-3 py-1 bg-blue-600 text-white font-bold rounded-md cursor-pointer text-xs"
                        >
                          შენახვა
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md cursor-pointer text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className={r.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}>
                        {r.name}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleToggleActive(r.id, r.isActive)}
                      className="cursor-pointer inline-flex items-center gap-1 font-bold text-[11px]"
                    >
                      {r.isActive ? (
                        <div className="text-emerald-700 flex items-center gap-0.5">
                          <ToggleRight size={22} className="text-emerald-600" />
                          <span>აქტიური</span>
                        </div>
                      ) : (
                        <div className="text-slate-400 flex items-center gap-0.5">
                          <ToggleLeft size={22} className="text-slate-300" />
                          <span>პასიური</span>
                        </div>
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleStartEdit(r)}
                        className="p-1 px-2 text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition font-bold cursor-pointer"
                      >
                        რედაქტირება
                      </button>
                      <button
                        onClick={() => handleDelete(r.id, r.name)}
                        className="p-1.5 text-red-600 hover:text-red-700 bg-red-50 border border-red-200 rounded-md transition cursor-pointer"
                        title="წაშლა"
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
    </div>
  );
}
