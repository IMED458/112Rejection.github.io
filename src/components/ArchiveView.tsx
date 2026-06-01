/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Refusal, RefusalReason } from '../types';
import { Search, Filter, Calendar, Trash2, Edit, Printer, FileSpreadsheet, Eye, RefreshCw, X } from 'lucide-react';

const formatToGeorgianDate = (yyyyMmDd: string): string => {
  if (!yyyyMmDd) return '';
  const parts = yyyyMmDd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return yyyyMmDd;
};

interface ArchiveViewProps {
  currentUser: any;
  onEdit: (refusal: Refusal) => void;
  onTriggerPrint: (filteredRefusals: Refusal[]) => void;
}

export function ArchiveView({ currentUser, onEdit, onTriggerPrint }: ArchiveViewProps) {
  const [refusals, setRefusals] = useState<Refusal[]>([]);
  const [reasons, setReasons] = useState<RefusalReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filter States
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterDiagnosis, setFilterDiagnosis] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [textSearch, setTextSearch] = useState('');

  // Selected refusal modal/details state
  const [selectedRefusal, setSelectedRefusal] = useState<Refusal | null>(null);

  const fetchArchive = async () => {
    setLoading(true);
    setError('');
    try {
      const [refData, reasonsData] = await Promise.all([
        api.getRefusals(),
        api.getReasons()
      ]);
      setRefusals(refData);
      setReasons(reasonsData);
    } catch (err: any) {
      setError(err?.message || 'არქივის ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  const handleDelete = async (id: string, diagnosis: string) => {
    if (window.confirm(`დარწმუნებული ხართ რომ გსურთ ჩანაწერის სამუდამოდ წაშლა?\nდიაგნოზი: ${diagnosis}`)) {
      try {
        await api.deleteRefusal(id);
        alert('ჩანაწერი წარმატებით წაიშალა');
        fetchArchive();
      } catch (err: any) {
        alert(err?.message || 'წაშლისას დაფიქსირდა შეცდომა');
      }
    }
  };

  // Extract unique doctors and operators for selectors
  const uniqueDoctors = Array.from(new Set(refusals.map(r => r.doctorFullNameSnapshot)));
  const uniqueOperators = Array.from(new Set(refusals.map(r => r.hospitalizationOperator).filter(Boolean)));

  // Filter logic
  const filteredRefusals = refusals.filter(r => {
    // 1. Date Range
    if (dateFrom && r.refusalDate < dateFrom) return false;
    if (dateTo && r.refusalDate > dateTo) return false;

    // 2. Specific Date
    if (specificDate && r.refusalDate !== specificDate) return false;

    // 3. Doctor
    if (filterDoctor && r.doctorFullNameSnapshot !== filterDoctor) return false;

    // 4. Shift
    if (filterShift && r.shiftType !== filterShift) return false;

    // 5. Diagnosis lookup
    if (filterDiagnosis && !r.diagnosis.toLowerCase().includes(filterDiagnosis.toLowerCase())) return false;

    // 6. Reason
    if (filterReason) {
      if (filterReason === 'სხვა') {
        if (r.refusalReason !== 'სხვა') return false;
      } else {
        if (r.refusalReason !== filterReason) return false;
      }
    }

    // 7. Operator
    if (filterOperator && r.hospitalizationOperator !== filterOperator) return false;

    // 8. General Text Search (Comments, Ambulance details)
    if (textSearch) {
      const q = textSearch.toLowerCase();
      const matchComment = r.comment.toLowerCase().includes(q);
      const matchAmbulance = r.ambulanceInfo.toLowerCase().includes(q);
      const matchDiag = r.diagnosis.toLowerCase().includes(q);
      if (!matchComment && !matchAmbulance && !matchDiag) return false;
    }

    return true;
  });

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSpecificDate('');
    setFilterDoctor('');
    setFilterShift('');
    setFilterDiagnosis('');
    setFilterReason('');
    setFilterOperator('');
    setTextSearch('');
  };

  // Helper for shift display in Georgian
  const getShiftLabel = (shift: string) => {
    if (shift === 'day') return 'დღე';
    if (shift === 'night') return 'ღამე';
    return 'სხვა';
  };

  // Export to Excel compatible CSV
  const exportToExcel = () => {
    if (filteredRefusals.length === 0) {
      alert('საექსპორტო მონაცემები ცარიელია');
      return;
    }

    let csvContent = '\uFEFF'; // UTF-8 Byte Order Mark (BOM) so Excel reads Georgian characters correctly!
    
    // Headers list
    const headers = [
      '№',
      'თარიღი',
      'დრო',
      'ექიმი',
      'ცვლა',
      'დიაგნოზი',
      'უარის მიზეზი',
      'კომენტარი',
      'ოპერატორი',
      'სასწრაფოს ბრიგადა / დამატებითი ინფო',
      'სისტემაში შექმნის დრო'
    ];
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\r\n';

    // Rows list
    filteredRefusals.forEach((r, idx) => {
      const reasonLabel = r.refusalReason === 'სხვა' ? `სხვა: ${r.refusalReasonCustom || ''}` : r.refusalReason;
      const row = [
        filteredRefusals.length - idx,
        formatToGeorgianDate(r.refusalDate),
        r.refusalTime,
        r.doctorFullNameSnapshot,
        getShiftLabel(r.shiftType),
        r.diagnosis,
        reasonLabel,
        r.comment,
        r.hospitalizationOperator,
        r.ambulanceInfo,
        new Date(r.createdAt).toLocaleString('ka-GE')
      ];
      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\r\n';
    });

    // Download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `112_uarebi_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            უარების არქივი
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            სისტემაში დაფიქსირებული 112-ის სასწრაფო პაციენტებზე უარების სრული ბაზა
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchArchive}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-md transition duration-150 cursor-pointer"
          >
            <RefreshCw size={15} />
            განახლება
          </button>
          
          <button
            onClick={() => onTriggerPrint(filteredRefusals)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition duration-150 cursor-pointer"
          >
            <Printer size={15} />
            PDF ბეჭდვა ({filteredRefusals.length})
          </button>

          {currentUser.role === 'admin' && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-gray-300 rounded-md transition duration-150 cursor-pointer"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              ექსპორტი Excel-ში
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-800 p-4 rounded-md border border-red-100 text-sm">
          {error}
        </div>
      )}

      {/* Advanced Filter Box */}
      <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm mb-6 space-y-4 font-sans">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm pb-1 border-b border-slate-50">
          <Filter size={16} className="text-blue-600" />
          <span>ძებნა და ფილტრაცია</span>
          {(dateFrom || dateTo || specificDate || filterDoctor || filterShift || filterDiagnosis || filterReason || filterOperator || textSearch) && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
            >
              გაფილტვრის გასუფთავება
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
          {/* Specific Date */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">კონკრეტული თარიღი</label>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => {
                setSpecificDate(e.target.value);
                setDateFrom('');
                setDateTo('');
              }}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
            />
          </div>

          {/* Date range From */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">თარიღიდან</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setSpecificDate('');
              }}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
            />
          </div>

          {/* Date range To */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">თარიღამდე</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setSpecificDate('');
              }}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
            />
          </div>

          {/* Doctor Selector */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">მორიგე ექიმი</label>
            <select
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
            >
              <option value="">ყველა ექიმი</option>
              {uniqueDoctors.map(doc => (
                <option key={doc} value={doc}>{doc}</option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">უარის მიზეზი</label>
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
            >
              <option value="">ყველა მიზეზი</option>
              {reasons.map(r => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Diagnostics keywords */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">დიაგნოზი</label>
            <input
              type="text"
              value={filterDiagnosis}
              onChange={(e) => setFilterDiagnosis(e.target.value)}
              placeholder="მაგ: STEMI, აპენდიციტი..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
            />
          </div>

          {/* Operator Selector */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">კლინიკის ოპერატორი</label>
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
            >
              <option value="">ყველა ოპერატორი</option>
              {uniqueOperators.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          {/* General comment text query */}
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-4">
            <label className="block text-slate-500 font-semibold mb-1">ძებნა კომენტარსა და ბრიგადის ინფორმაციაში</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                placeholder="ჩაწერეთ სიტყვა კომენტარიდან ან დამატებითი ინფორმაციიდან მოსაძებნად..."
                className="w-full pl-9 pr-4 p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm flex flex-col justify-center items-center gap-3">
          <RefreshCw className="animate-spin text-emerald-600" size={24} />
          იტვირთება არქივის ბაზა...
        </div>
      ) : filteredRefusals.length === 0 ? (
        <div className="bg-amber-50 rounded-2xl p-8 border border-amber-200 text-center text-amber-800">
          <p className="text-base font-semibold">ჩანაწერები ვერ მოიძებნა</p>
          <p className="text-xs text-amber-600 mt-1">შეცვალეთ ფილტრის პარამეტრები ან დაამატეთ ახალი უარის ჩანაწერი</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 font-semibold flex items-center justify-between">
            <span>სულ ნაპოვნია: <strong className="text-slate-800 text-sm">{filteredRefusals.length}</strong> უარი</span>
            <span>მორიგეობის არქივი</span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-[13px] text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3.5 text-center">№</th>
                  <th className="px-4 py-3.5">თარიღი / დრო</th>
                  <th className="px-4 py-3.5">მორიგე ექიმი</th>
                  <th className="px-4 py-3.5">დიაგნოზი / მდგომარეობა</th>
                  <th className="px-4 py-3.5">უარის მიზეზი</th>
                  <th className="px-4 py-3.5">კომენტარი / ბრიგადა</th>
                  <th className="px-4 py-3.5 text-right">ქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                {filteredRefusals.map((r, index) => {
                  const displayIndex = filteredRefusals.length - index;
                  const canEdit = currentUser.role === 'admin' || r.doctorId === currentUser.id;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/75 transition duration-75">
                      <td className="px-4 py-4 text-center font-bold text-slate-400">{displayIndex}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 block">{formatToGeorgianDate(r.refusalDate)}</span>
                        <span className="text-slate-400 text-xs block mt-0.5">{r.refusalTime} სთ</span>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-800 whitespace-nowrap">
                        {r.doctorFullNameSnapshot}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900 max-w-xs truncate" title={r.diagnosis}>
                        {r.patientIdentifier && (
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] mr-1.5 inline-block font-mono">
                            {r.patientIdentifier}
                          </span>
                        )}
                        {r.diagnosis}
                      </td>
                      <td className="px-4 py-4 text-xs font-medium max-w-xs">
                        {r.refusalReason === 'სხვა' ? (
                          <div className="text-red-700">სხვა: {r.refusalReasonCustom}</div>
                        ) : (
                          <div className="text-slate-800">{r.refusalReason}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500 max-w-sm">
                        {r.comment && <p className="line-clamp-1 italic text-slate-600 mb-1">„{r.comment}“</p>}
                        {r.hospitalizationOperator && (
                          <p className="text-[11px] text-slate-400">
                            ოპერატორი: <span className="text-slate-600 font-medium">{r.hospitalizationOperator}</span>
                          </p>
                        )}
                        {r.ambulanceInfo && (
                          <p className="text-[11px] text-slate-400">
                            ბრიგადა: <span className="text-slate-600 font-medium">{r.ambulanceInfo}</span>
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-xs">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedRefusal(r)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                            title="დეტალები"
                          >
                            <Eye size={14} />
                          </button>
                          
                          {canEdit && (
                            <>
                              <button
                                onClick={() => onEdit(r)}
                                className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                                title="რედაქტირება"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(r.id, r.diagnosis)}
                                className="p-1.5 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition"
                                title="წაშლა"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile responsive Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
            {filteredRefusals.map((r, index) => {
              const displayIndex = filteredRefusals.length - index;
              const canEdit = currentUser.role === 'admin' || r.doctorId === currentUser.id;

              return (
                <div key={r.id} className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-400 text-sm">№{displayIndex}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-slate-400 text-[10px] uppercase font-bold">ექიმი</span>
                    <span className="text-slate-800 text-xs font-semibold">{r.doctorFullNameSnapshot}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-slate-400 text-[10px] uppercase font-bold">თარიღი და დრო</span>
                    <span className="text-slate-800 text-xs font-semibold">{formatToGeorgianDate(r.refusalDate)} - {r.refusalTime} სთ</span>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-slate-400 text-[10px] uppercase font-bold">დიაგნოზი / მდგომარეობა</span>
                    <div className="text-slate-900 text-sm font-bold">
                      {r.patientIdentifier && (
                        <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-[10px] mr-1 inline-block font-mono">
                          {r.patientIdentifier}
                        </span>
                      )}
                      {r.diagnosis}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-slate-400 text-[10px] uppercase font-bold">მიზეზი</span>
                    <p className="text-slate-800 text-xs font-medium">
                      {r.refusalReason === 'სხვა' ? `სხვა: ${r.refusalReasonCustom}` : r.refusalReason}
                    </p>
                  </div>

                  {(r.comment || r.hospitalizationOperator || r.ambulanceInfo) && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] space-y-1">
                      {r.comment && <p className="italic text-slate-600">„{r.comment}“</p>}
                      {r.hospitalizationOperator && <p className="text-slate-400">ოპერატორი: <span className="text-slate-700 font-medium">{r.hospitalizationOperator}</span></p>}
                      {r.ambulanceInfo && <p className="text-slate-400">ბრიგადა: <span className="text-slate-700 font-medium">{r.ambulanceInfo}</span></p>}
                    </div>
                  )}

                  {/* Actions mobile panel */}
                  <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setSelectedRefusal(r)}
                      className="px-3 py-1.5 flex items-center gap-1 text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-xl text-xs transition font-semibold"
                    >
                      <Eye size={12} />
                      ნახვა
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => onEdit(r)}
                          className="px-3 py-1.5 flex items-center gap-1 text-blue-700 hover:text-blue-800 bg-blue-50 border border-blue-200 rounded-xl text-xs transition font-semibold"
                        >
                          <Edit size={12} />
                          შეცვლა
                        </button>
                        <button
                          onClick={() => handleDelete(r.id, r.diagnosis)}
                          className="px-3 py-1.5 flex items-center gap-1 text-red-700 hover:text-red-800 bg-red-50 border border-red-200 rounded-xl text-xs transition font-semibold"
                        >
                          <Trash2 size={12} />
                          წაშლა
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {selectedRefusal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg border border-gray-200 overflow-hidden transform transition-all duration-150 font-sans">
            {/* Header */}
            <div className="bg-[#1E293B] px-6 py-4 flex items-center justify-between text-white">
              <h3 className="text-base font-bold tracking-tight">უარის სრული საინფორმაციო ბარათი</h3>
              <button
                onClick={() => setSelectedRefusal(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4 text-sm scrollbar">
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <div>
                  <span className="block text-slate-400 text-xs font-semibold mb-0.5">მორიგე ექიმი</span>
                  <span className="text-slate-800 font-bold text-base">{selectedRefusal.doctorFullNameSnapshot}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-xs font-semibold mb-0.5">მორიგეობა</span>
                  <span className="text-slate-800 font-bold text-sm bg-slate-100 px-2.5 py-1 rounded-md inline-block">
                    24 საათიანი მორიგეობა
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400 text-xs font-semibold mb-0.5">უარის თარიღი</span>
                  <span className="text-slate-800 font-bold">{formatToGeorgianDate(selectedRefusal.refusalDate)}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-xs font-semibold mb-0.5">უარის ზუსტი დრო</span>
                  <span className="text-slate-800 font-bold">{selectedRefusal.refusalTime} სთ</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <span className="block text-slate-400 text-xs font-semibold mb-1">პაციენტის იდენტიფიკატორი</span>
                <p className="text-slate-800 font-bold font-mono text-base">
                  {selectedRefusal.patientIdentifier || 'არ არის მითითებული (ანონიმური)'}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <span className="block text-slate-400 text-xs font-semibold mb-1">დიაგნოზი / მდგომარეობა</span>
                <p className="text-slate-900 font-extrabold text-lg bg-blue-50/50 p-3 rounded-md border border-blue-100">
                  {selectedRefusal.diagnosis}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <span className="block text-slate-400 text-xs font-semibold mb-1">უარის თქმის ოფიციალური მიზეზი</span>
                <p className="text-slate-950 font-bold text-base p-3 bg-red-50/55 rounded-md border border-red-100">
                  {selectedRefusal.refusalReason === 'სხვა' ? `სხვა: ${selectedRefusal.refusalReasonCustom}` : selectedRefusal.refusalReason}
                </p>
              </div>

              {(selectedRefusal.hospitalizationOperator || selectedRefusal.ambulanceInfo) && (
                <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                  {selectedRefusal.hospitalizationOperator && (
                    <div>
                      <span className="block text-slate-400 text-xs font-semibold mb-0.5">ჰოსპიტალიზაციის ოპერატორი</span>
                      <span className="text-slate-800 font-medium">{selectedRefusal.hospitalizationOperator}</span>
                    </div>
                  )}
                  {selectedRefusal.ambulanceInfo && (
                    <div>
                      <span className="block text-slate-400 text-xs font-semibold mb-0.5">სასწრაფო ბრიგადის ინფორმაცია</span>
                      <span className="text-slate-800 font-medium">{selectedRefusal.ambulanceInfo}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedRefusal.comment && (
                <div className="border-t border-gray-100 pt-4">
                  <span className="block text-slate-400 text-xs font-semibold mb-1">დამატებითი კომენტარი</span>
                  <div className="bg-slate-50 p-4 rounded-md border border-gray-200 font-medium text-slate-700 italic">
                    „{selectedRefusal.comment}“
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 text-[11px] text-slate-400 flex items-center justify-between">
                <span>ჩანაწერი დაემატა: {new Date(selectedRefusal.createdAt).toLocaleString('ka-GE')}</span>
                <span>ბოლოს განახლდა: {new Date(selectedRefusal.updatedAt).toLocaleString('ka-GE')}</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end border-t border-gray-100 gap-2">
              <button
                onClick={() => {
                  setSelectedRefusal(null);
                  onTriggerPrint([selectedRefusal]);
                }}
                className="px-4 py-2 border border-gray-200 hover:border-gray-300 text-sm font-semibold rounded-md text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
              >
                <Printer size={14} /> ბეჭდვა
              </button>
              <button
                onClick={() => setSelectedRefusal(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-md transition cursor-pointer"
              >
                დახურვა
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
