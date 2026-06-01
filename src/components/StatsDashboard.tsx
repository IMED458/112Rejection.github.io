/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Refusal } from '../types';
import { BarChart, TrendingUp, User, ClipboardList, Clock, Sparkles, Filter, Calendar, RefreshCw } from 'lucide-react';

interface StatsDashboardProps {
  refusalsList?: Refusal[];
}

export function StatsDashboard({ refusalsList }: StatsDashboardProps) {
  const [refusals, setRefusals] = useState<Refusal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Date Filter range
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterReason, setFilterReason] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getRefusals();
      setRefusals(data);
    } catch (err: any) {
      setError(err?.message || 'სტატისტიკის ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (refusalsList) {
      setRefusals(refusalsList);
    } else {
      fetchStats();
    }
  }, [refusalsList]);

  // Extract filters items
  const uniqueDoctors = Array.from(new Set(refusals.map(r => r.doctorFullNameSnapshot)));
  const uniqueReasons = Array.from(new Set(refusals.map(r => r.refusalReason)));

  // Filtered dataset
  const filteredRefusals = refusals.filter(r => {
    if (dateFrom && r.refusalDate < dateFrom) return false;
    if (dateTo && r.refusalDate > dateTo) return false;
    if (filterDoctor && r.doctorFullNameSnapshot !== filterDoctor) return false;
    if (filterShift && r.shiftType !== filterShift) return false;
    if (filterReason && r.refusalReason !== filterReason) return false;
    return true;
  });

  // Calculate Metrics based on filtered dataset
  const totalCount = filteredRefusals.length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = filteredRefusals.filter(r => r.refusalDate === todayStr).length;

  const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM
  const monthCount = filteredRefusals.filter(r => r.refusalDate.startsWith(currentMonthStr)).length;

  // Doctor with highest refusals
  const docCounts: Record<string, number> = {};
  filteredRefusals.forEach(r => {
    docCounts[r.doctorFullNameSnapshot] = (docCounts[r.doctorFullNameSnapshot] || 0) + 1;
  });
  const sortedDoctors = Object.entries(docCounts).sort((a, b) => b[1] - a[1]);
  const peakDoctor = sortedDoctors.length > 0 ? `${sortedDoctors[0][0]} (${sortedDoctors[0][1]} უარი)` : '-';

  // Common refusal reason
  const reasonCounts: Record<string, number> = {};
  filteredRefusals.forEach(r => {
    const lbl = r.refusalReason === 'სხვა' ? `სხვა: ${r.refusalReasonCustom || ''}` : r.refusalReason;
    reasonCounts[lbl] = (reasonCounts[lbl] || 0) + 1;
  });
  const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
  const topReason = sortedReasons.length > 0 ? sortedReasons[0][0] : '-';
  const topReasonCount = sortedReasons.length > 0 ? sortedReasons[0][1] : 0;

  // Common Diagnosis
  const diagCounts: Record<string, number> = {};
  filteredRefusals.forEach(r => {
    const simplified = r.diagnosis.trim();
    if (simplified) {
      diagCounts[simplified] = (diagCounts[simplified] || 0) + 1;
    }
  });
  const sortedDiags = Object.entries(diagCounts).sort((a, b) => b[1] - a[1]);
  const topDiagnosis = sortedDiags.length > 0 ? sortedDiags[0][0] : '-';
  const topDiagnosisCount = sortedDiags.length > 0 ? sortedDiags[0][1] : 0;

  // Shifts distribution counts
  const shiftDay = filteredRefusals.filter(r => r.shiftType === 'day').length;
  const shiftNight = filteredRefusals.filter(r => r.shiftType === 'night').length;
  const shiftOther = filteredRefusals.filter(r => r.shiftType === 'other').length;

  // Group by Date for Chronology
  const dateCounts: Record<string, number> = {};
  filteredRefusals.forEach(r => {
    dateCounts[r.refusalDate] = (dateCounts[r.refusalDate] || 0) + 1;
  });
  const chronology = Object.entries(dateCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10); // Take last 10 record dates

  const maxChronologyVal = chronology.length > 0 ? Math.max(...chronology.map(c => c.count)) : 10;

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 font-sans">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart className="text-blue-600" />
            ადმინისტრაციული სტატისტიკა
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            სისტემური ჩანაწერების ინტელექტუალური ანალიზი და გრაფიკული ანგარიშები
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-md transition duration-150 cursor-pointer"
        >
          <RefreshCw size={14} className="text-blue-600" />
          განახლება
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-800 p-4 rounded-md border border-red-100 text-sm">
          {error}
        </div>
      )}

      {/* Stats Filter Area */}
      <div className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm mb-6 space-y-3 font-sans">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Filter size={15} className="text-blue-600" />
          <span>სტატისტიკის გაფილტვრა პერიოდის ან პერსონალის მიხედვით</span>
          {(dateFrom || dateTo || filterDoctor || filterShift || filterReason) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setFilterDoctor('');
                setFilterShift('');
                setFilterReason('');
              }}
              className="ml-auto text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
            >
              ფილტრების მოხსნა
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">თარიღიდან</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full p-2 bg-white border border-gray-300 rounded-md font-bold"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">თარიღამდე</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full p-2 bg-white border border-gray-300 rounded-md font-bold"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">ექიმი</label>
            <select
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
              className="w-full p-2 bg-white border border-gray-300 rounded-md font-bold"
            >
              <option value="">ყველა ექიმი</option>
              {uniqueDoctors.map(doc => (
                <option key={doc} value={doc}>{doc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-500 mb-1">უარის მიზეზი</label>
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="w-full p-2 bg-white border border-gray-300 rounded-md font-bold"
            >
              <option value="">ყველა მიზეზი</option>
              {uniqueReasons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          იტვირთება ანალიტიკა...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bento-grid Indicators Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Total count */}
            <div className="bg-[#1E293B] text-white p-5 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">უარების საერთო რაოდენობა</span>
                <span className="text-3xl font-extrabold block">{totalCount}</span>
                <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                  <TrendingUp size={12} /> ბაზის სრული მოცულობა
                </span>
              </div>
              <div className="bg-slate-850 p-3 rounded-md text-blue-400">
                <ClipboardList size={22} />
              </div>
            </div>

            {/* Today counts */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">დღევანდელი უარები</span>
                <span className="text-3xl font-extrabold text-slate-900 block">{todayCount}</span>
                <span className="text-[10px] text-slate-400 block font-mono">თარიღი: {todayStr}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-md text-yellow-600 border border-slate-100">
                <Calendar size={22} />
              </div>
            </div>

            {/* Current month count */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">მიმდინარე თვე ({currentMonthStr})</span>
                <span className="text-3xl font-extrabold text-slate-900 block">{monthCount}</span>
                <span className="text-[10px] text-slate-400 block">ამ თვის რეგისტრირებული შემთხვევები</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-md text-indigo-600 border border-slate-100">
                <Clock size={22} />
              </div>
            </div>

            {/* Peak Doctor */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">აქტიური მორიგე ექიმი</span>
                <span className="text-sm font-black text-slate-950 block truncate max-w-[190px]">{peakDoctor}</span>
                <span className="text-[10px] text-slate-400 block">ყველაზე მეტი გაფორმებული უარი</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-md text-red-600 border border-slate-100">
                <User size={22} />
              </div>
            </div>
          </div>

          {/* Special highlights section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Top Diagnoses card */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5 pb-2 border-b border-slate-50">
                <Sparkles className="text-blue-600" size={16} />
                ყველაზე ხშირი დიაგნოზები (TOP 5)
              </h3>

              {sortedDiags.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">მონაცემები ცარიელია</p>
              ) : (
                <div className="space-y-3">
                  {sortedDiags.slice(0, 5).map(([name, count], index) => {
                    const percentage = Math.round((count / totalCount) * 100);
                    return (
                      <div key={name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-700 truncate max-w-[280px]">{index + 1}. {name}</span>
                          <span className="text-slate-900">{count} შემთხვევა ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.max(percentage, 3)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Reasons card */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5 pb-2 border-b border-slate-50">
                <ClipboardList className="text-red-500" size={16} />
                უარების ძირითადი მიზეზები (TOP 5)
              </h3>

              {sortedReasons.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">მონაცემები ცარიელია</p>
              ) : (
                <div className="space-y-3">
                  {sortedReasons.slice(0, 5).map(([name, count], index) => {
                    const percentage = Math.round((count / totalCount) * 100);
                    return (
                      <div key={name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-700 truncate max-w-[280px]">{index + 1}. {name}</span>
                          <span className="text-slate-900">{count} შემთხვევა ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-slate-700 h-2 rounded-full"
                            style={{ width: `${Math.max(percentage, 3)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Graphics Plots and Chronological Area */}
          <div className="grid grid-cols-1 gap-5">
            {/* chronological dynamic stats chart (Last 10 Days) */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5 pb-2 border-b border-slate-50">
                <TrendingUp className="text-blue-600" size={16} />
                უარების დინამიკა (ბოლო 10 თარიღი)
              </h3>

              {chronology.length === 0 ? (
                <div className="h-36 flex items-center justify-center text-slate-400 text-xs">
                  მონაცემები ცარიელია
                </div>
              ) : (
                <div className="space-y-4 font-sans">
                  {/* Visual Chart Bars */}
                  <div className="flex items-end justify-between h-28 pt-2 px-2 border-b border-gray-155">
                    {chronology.map((col) => {
                      const heightPercent = Math.max(Math.round((col.count / maxChronologyVal) * 100), 8);
                      return (
                        <div key={col.date} className="flex flex-col items-center group w-full px-1">
                          {/* Value tooltip on hover */}
                          <div className="bg-slate-900 text-white rounded px-1.5 py-0.5 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition absolute mb-14">
                            {col.count}
                          </div>
                          
                          {/* Bar */}
                          <div
                            className="bg-gradient-to-t from-blue-600 to-blue-500 hover:brightness-105 w-6 sm:w-8 rounded-t-md transition duration-200 shadow-sm relative flex items-end justify-center text-[10px] font-extrabold text-white pb-1"
                            style={{ height: `${heightPercent}%` }}
                          >
                            <span className="pointer-events-none">{col.count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dates labels row */}
                  <div className="flex justify-between text-[10px] text-slate-400 px-2 font-semibold">
                    {chronology.map((col) => {
                      // format date string "2026-06-01" -> "01.06"
                      const parts = col.date.split('-');
                      const displayDate = parts.length === 3 ? `${parts[2]}.${parts[1]}` : col.date;
                      return (
                        <div key={col.date} className="w-full text-center truncate">
                          {displayDate}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
