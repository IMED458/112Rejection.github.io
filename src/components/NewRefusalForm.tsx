/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Refusal, RefusalReason, ShiftType } from '../types';
import { Save, RefreshCw, Printer, ArrowLeft, AlertCircle, FileText } from 'lucide-react';

interface NewRefusalFormProps {
  currentUser: any;
  editRefusal?: Refusal | null;
  onSuccess: (savedRefusal?: Refusal, shouldPrint?: boolean) => void;
  onCancel?: () => void;
}

export function NewRefusalForm({ currentUser, editRefusal, onSuccess, onCancel }: NewRefusalFormProps) {
  const [patientIdentifier, setPatientIdentifier] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [refusalReason, setRefusalReason] = useState('');
  const [refusalReasonCustom, setRefusalReasonCustom] = useState('');
  const [comment, setComment] = useState('');
  const [hospitalizationOperator, setHospitalizationOperator] = useState('');
  const [ambulanceInfo, setAmbulanceInfo] = useState('');
  const [refusalDate, setRefusalDate] = useState('');
  const [refusalTime, setRefusalTime] = useState('');
  const [shiftType, setShiftType] = useState<ShiftType>('other');

  const [reasons, setReasons] = useState<RefusalReason[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Set initial dates and auto shift calculations
  useEffect(() => {
    // Fetch reasons from server
    const fetchReasons = async () => {
      setLoadingReasons(true);
      try {
        const loaded = await api.getReasons() as RefusalReason[];
        const activeOnly = loaded.filter((r: RefusalReason) => r.isActive);
        setReasons(activeOnly);
        if (activeOnly.length > 0 && !editRefusal) {
          setRefusalReason(activeOnly[0].name);
        }
      } catch (err) {
        console.error('Failed to load active reasons, falling back to typical items', err);
        // typical items fallback
        const typical = ['პალიატიური', 'სხვა კლინიკის ონკოლოგია', 'ალკოჰოლური ინტოქსიკაცია', 'მწოლიარე პაციენტია(დემენცია, ენცეფალოპათია)', 'საჭირო კვლევა ან სერვისი მიუწვდომელია', 'სხვა'];
        setReasons(typical.map((name, i) => ({ id: String(i), name, isActive: true, createdAt: '', updatedAt: '' })));
        if (!editRefusal) setRefusalReason(typical[0]);
      } finally {
        setLoadingReasons(false);
      }
    };

    fetchReasons();

    if (editRefusal) {
      // populate for editing
      setPatientIdentifier(editRefusal.patientIdentifier);
      setDiagnosis(editRefusal.diagnosis);
      setRefusalReason(editRefusal.refusalReason);
      setRefusalReasonCustom(editRefusal.refusalReasonCustom || '');
      setComment(editRefusal.comment);
      setHospitalizationOperator(editRefusal.hospitalizationOperator);
      setAmbulanceInfo(editRefusal.ambulanceInfo);
      setRefusalDate(editRefusal.refusalDate);
      setRefusalTime(editRefusal.refusalTime);
      setShiftType(editRefusal.shiftType);
    } else {
      // defaults for new refusal
      const now = new Date();
      // YYYY-MM-DD
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      setRefusalDate(dateStr);

      // HH:MM
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${mins}`;
      setRefusalTime(timeStr);

      autoCalculateShift(timeStr);
    }
  }, [editRefusal]);

  // Handle auto calculation of shifts
  const autoCalculateShift = (time: string) => {
    if (!time || !time.includes(':')) return;
    const [hoursStr] = time.split(':');
    const hours = parseInt(hoursStr, 10);
    // Day shift is defined as 09:00 - 21:00 (9 to 20 inclusive)
    if (hours >= 9 && hours < 21) {
      setShiftType('day');
    } else {
      setShiftType('night');
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeVal = e.target.value;
    setRefusalTime(timeVal);
    autoCalculateShift(timeVal);
  };

  const handleClear = () => {
    if (window.confirm('დარწმუნებული ხართ რომ გსურთ ფორმის გასუფთავება?')) {
      setPatientIdentifier('');
      setDiagnosis('');
      if (reasons.length > 0) setRefusalReason(reasons[0].name);
      setRefusalReasonCustom('');
      setComment('');
      setHospitalizationOperator('');
      setAmbulanceInfo('');
      setError('');
      setSuccessMsg('');
    }
  };

  const handleSubmit = async (e: React.FormEvent, andPrint = false) => {
    e.preventDefault();
    if (!diagnosis.trim()) {
      setError('გთხოვთ შეავსოთ დიაგნოზის ველი');
      return;
    }
    if (!refusalReason) {
      setError('გთხოვთ აირჩიოთ უარის მიზეზი');
      return;
    }
    if (refusalReason === 'სხვა' && !refusalReasonCustom.trim()) {
      setError('გთხოვთ მიუთითოთ სხვა კონკრეტული მიზეზი');
      return;
    }

    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    const payload = {
      patientIdentifier,
      diagnosis,
      refusalReason,
      refusalReasonCustom: refusalReason === 'სხვა' ? refusalReasonCustom : undefined,
      comment,
      hospitalizationOperator,
      ambulanceInfo,
      shiftType,
      refusalDate,
      refusalTime
    };

    try {
      let result: Refusal;
      if (editRefusal) {
        result = await api.updateRefusal(editRefusal.id, payload) as Refusal;
        setSuccessMsg('მონაცემები წარმატებით განახლდა.');
      } else {
        result = await api.createRefusal(payload) as Refusal;
        setSuccessMsg('ჩანაწერი წარმატებით დაემატა.');
        setPatientIdentifier('');
        setDiagnosis('');
        setRefusalReasonCustom('');
        setComment('');
        setHospitalizationOperator('');
        setAmbulanceInfo('');
      }

      setTimeout(() => {
        onSuccess(result, andPrint);
      }, 800);
    } catch (err: any) {
      setError(err?.message || 'ჩანაწერის შენახვა ვერ მოხერხდა');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 font-sans">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="text-blue-600 animate-pulse" />
            {editRefusal ? 'ჩანაწერის რედაქტირება' : 'ახალი უარის დაფიქსირება'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            შეავსეთ 112/სასწრაფოს მიერ შემოთავაზებულ პაციენტზე უარის აღრიცხვის ფორმა
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition duration-150 cursor-pointer"
          >
            <ArrowLeft size={16} />
            უკან
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 text-green-800 rounded-r-md shadow-sm text-sm">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-800 rounded-r-md shadow-sm text-sm flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form className="space-y-6" onSubmit={(e) => handleSubmit(e, false)}>
        {/* Automatics Fields - Info Box */}
        <div className="bg-slate-50 p-4 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
          <div>
            <span className="font-semibold text-slate-500 block text-xs">მორიგე ექიმი:</span>
            <span className="font-bold text-slate-800 text-base">{editRefusal ? editRefusal.doctorFullNameSnapshot : `${currentUser.firstName} ${currentUser.lastName}`}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500 block text-xs">თარიღი:</span>
            <input
              type="date"
              value={refusalDate}
              onChange={(e) => setRefusalDate(e.target.value)}
              className="mt-1 font-bold text-slate-800 border-none bg-transparent focus:ring-0 p-0 cursor-pointer"
            />
          </div>
          <div>
            <span className="font-semibold text-slate-500 block text-xs">დრო:</span>
            <input
              type="time"
              value={refusalTime}
              onChange={handleTimeChange}
              className="mt-1 font-bold text-slate-800 border-none bg-transparent focus:ring-0 p-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Inputs Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 border border-gray-200 rounded-xl shadow-sm">
          {/* Patient identifier */}
          <div>
            <label htmlFor="patientId" className="block text-sm font-semibold text-slate-700 mb-1">
              პაციენტის ინიციალი ან ID <span className="text-slate-400 font-normal">(კონფიდენციალური)</span>
            </label>
            <input
              id="patientId"
              type="text"
              value={patientIdentifier}
              onChange={(e) => setPatientIdentifier(e.target.value)}
              placeholder="მაგ: გ.მ. ან ID: 251"
              className="block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Operator name */}
          <div>
            <label htmlFor="operator" className="block text-sm font-semibold text-slate-700 mb-1">
              ჰოსპიტალიზაციის ოპერატორი <span className="text-slate-400 font-normal">(თუ ცნობილია)</span>
            </label>
            <input
              id="operator"
              type="text"
              value={hospitalizationOperator}
              onChange={(e) => setHospitalizationOperator(e.target.value)}
              placeholder="ოპერატორის სახელი და გვარი"
              className="block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Diagnosis */}
          <div className="md:col-span-2">
            <label htmlFor="diagnosis" className="block text-sm font-semibold text-slate-700 mb-1">
              დიაგნოზი / მდგომარეობა <span className="text-red-500">*</span>
            </label>
            <input
              id="diagnosis"
              type="text"
              required
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="მაგ: მწვავე აპენდიციტი, ორმხრივი პნევმონია, STEMI..."
              className="block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Refusal Reason Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              უარის თქმის მიზეზი <span className="text-red-500">*</span>
            </label>
            {loadingReasons ? (
              <div className="text-xs text-slate-500 py-3 flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin text-blue-600" /> მიზეზები იტვირთება...
              </div>
            ) : (
              <select
                value={refusalReason}
                onChange={(e) => setRefusalReason(e.target.value)}
                className="block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {reasons.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Custom refusal reason details (Shown if "სხვა" chosen) */}
          <div>
            {refusalReason === 'სხვა' && (
              <div>
                <label htmlFor="refusalCustom" className="block text-sm font-semibold text-red-700 mb-1">
                  კონკრეტული სხვა მიზეზი <span className="text-red-500">*</span>
                </label>
                <input
                  id="refusalCustom"
                  type="text"
                  required
                  value={refusalReasonCustom}
                  onChange={(e) => setRefusalReasonCustom(e.target.value)}
                  placeholder="ჩაწერეთ კონკრეტული უარის მიზეზი..."
                  className="block w-full px-4 py-2.5 bg-white border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                />
              </div>
            )}
          </div>

          {/* Comment */}
          <div className="md:col-span-2">
            <label htmlFor="comment" className="block text-sm font-semibold text-slate-700 mb-1">
              კომენტარი
            </label>
            <textarea
              id="comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="დააფიქსირეთ დამატებითი კლინიკური გარემოებები ან კომენტარი..."
              className="block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Buttons Action footer */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-gray-200">
          {!editRefusal && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition duration-150 order-2 sm:order-none cursor-pointer"
            >
              გასუფთავება
            </button>
          )}

          <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={submitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition duration-150 disabled:opacity-55 cursor-pointer"
              >
            <Printer size={16} />
            {submitting ? 'ინახება...' : 'შენახვა და PDF-ზე გადასვლა'}
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm hover:shadow transition duration-150 disabled:opacity-55 cursor-pointer"
          >
            <Save size={16} />
            {submitting ? 'ინახება...' : 'შენახვა'}
          </button>
        </div>
      </form>
    </div>
  );
}
