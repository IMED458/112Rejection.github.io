/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Refusal, ShiftType } from '../types';
import { Printer, Calendar, ArrowLeft, Grid, FileText } from 'lucide-react';

export function formatToGeorgianDate(yyyyMmDd: string): string {
  if (!yyyyMmDd) return '';
  const parts = yyyyMmDd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return yyyyMmDd;
}

export function getNextDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

interface PdfPrintViewProps {
  refusals: Refusal[];
  defaultDate?: string;
  defaultShift?: ShiftType;
  onBack: () => void;
}

export function PdfPrintView({ refusals, defaultDate, defaultShift, onBack }: PdfPrintViewProps) {
  const [printDate, setPrintDate] = useState('');
  const [printShift, setPrintShift] = useState<ShiftType>('day');
  const [printableRecords, setPrintableRecords] = useState<Refusal[]>([]);

  // Default parameters on load
  useEffect(() => {
    // default to today's date
    const today = new Date().toISOString().split('T')[0];
    setPrintDate(defaultDate || today);
    setPrintShift(defaultShift || 'day');
  }, [defaultDate, defaultShift]);

  // Compute print records matching 24-hour shift starting at 09:00
  useEffect(() => {
    if (!printDate) {
      setPrintableRecords([]);
      return;
    }

    const nextDate = getNextDateStr(printDate);
    const startBoundary = `${printDate}T09:00`;
    const endBoundary = `${nextDate}T09:00`;

    const records = refusals.filter(r => {
      const refuseDateTime = `${r.refusalDate}T${r.refusalTime}`;
      return refuseDateTime >= startBoundary && refuseDateTime < endBoundary;
    });

    // Sort by chronological date-time
    const sorted = [...records].sort((a, b) => {
      const dtA = `${a.refusalDate}T${a.refusalTime}`;
      const dtB = `${b.refusalDate}T${b.refusalTime}`;
      return dtA.localeCompare(dtB);
    });

    setPrintableRecords(sorted);
  }, [refusals, printDate, printShift]);

  const handlePrintTrigger = () => {
    window.print();
  };

  // Get Doctors unique names for header
  const doctorsInShift = Array.from(new Set(printableRecords.map(r => r.doctorFullNameSnapshot)));

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6">
      {/* Configuration controller - Hidden during print! */}
      <div className="no-print bg-white p-5 border border-slate-200 rounded-2xl shadow-sm mb-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Printer className="text-emerald-600" />
              საყოველდღეო ბეჭდვის პანელი (A4 PDF)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              აირჩიეთ თარიღი ბეჭდვის ჟურნალის გენერირებისთვის
            </p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 py-2 px-3.5 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft size={15} />
            უკან
          </button>
        </div>

        <div className="text-xs font-semibold max-w-sm">
          <div>
            <label className="block text-slate-500 mb-1">მორიგეობის თარიღი</label>
            <input
              type="date"
              value={printDate}
              onChange={(e) => setPrintDate(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-1 focus:ring-emerald-500 font-bold"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
          <div className="text-xs text-slate-500">
            {printableRecords.length === 0 ? (
              <span className="text-red-500 font-semibold">ამ თარიღზე ჩანაწერები არ ირიცხება</span>
            ) : (
              <span>ნაპოვნია <strong className="text-slate-800 text-sm">{printableRecords.length}</strong> ჩანაწერი დასაბეჭდად</span>
            )}
          </div>
          <button
            onClick={handlePrintTrigger}
            disabled={printableRecords.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md cursor-pointer transition uppercase tracking-wide disabled:opacity-50"
          >
            <Printer size={16} /> ბეჭდვა (Save as PDF)
          </button>
        </div>
      </div>

      {/* Styled Printable Page Sheet Area */}
      <div className="bg-white border border-slate-200 p-8 sm:p-12 rounded-2xl shadow-md min-h-[297mm] relative overflow-hidden text-slate-900 select-text print-layout">
        <style>{`
          /* Inline Print CSS Overrides */
          @media print {
            body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            .print-layout {
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              min-h: auto !important;
              font-size: 11px !important;
            }
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            @page {
              size: A4 portrait;
              margin: 1.5cm 1cm 1.5cm 1cm;
            }
          }
        `}</style>
        
        {/* Document Header */}
        <div className="text-center space-y-2 border-b-2 border-double border-slate-900 pb-5 mb-6 text-slate-900">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
            112-თან შეთანხმებულ პაციენტებზე უარის აღრიცხვის ფორმა
          </h1>
          <p className="text-sm font-bold tracking-widest text-slate-500 uppercase">
            საგანგებო და გადაუდებელი მედიცინის დეპარტამენტი
          </p>
        </div>

        {/* Top Details Block */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="space-y-1">
            <span className="text-slate-400 block text-[10px]">მორიგეობის თარიღი:</span>
            <span className="font-bold text-slate-800 text-sm">
              {formatToGeorgianDate(printDate) || 'N/A'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block text-[10px]">მორიგეობის გრაფიკი:</span>
            <span className="font-bold text-slate-800 text-sm">
              {formatToGeorgianDate(printDate)} 09:00 - {formatToGeorgianDate(getNextDateStr(printDate))} 09:00 (24 სთ)
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block text-[10px]">მორიგე ექიმ(ებ)ი:</span>
            <span className="font-bold text-slate-800 text-sm">
              {doctorsInShift.length > 0 ? doctorsInShift.join(', ') : 'არ არის მითითებული'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block text-[10px]">გენერირების დრო:</span>
            <span className="font-bold text-slate-800 text-sm">
              {new Date().toLocaleString('ka-GE')}
            </span>
          </div>
        </div>

        {/* Tabular data check */}
        {printableRecords.length === 0 ? (
          <div className="py-20 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl space-y-1">
            <FileText className="mx-auto text-slate-300" size={32} />
            <p className="font-bold text-slate-700">ამ თარიღის მონაცემები ცარიელია</p>
            <p className="text-[11px]">ჩანაწერების დასაბეჭდად გთხოვთ მიუთითოთ კორექტული მორიგეობის თარიღი</p>
          </div>
        ) : (
          <table className="w-full text-left text-slate-900 border-collapse border border-slate-300 text-[11px] mb-8">
            <thead className="bg-slate-100 font-bold text-slate-800 text-center">
              <tr>
                <th className="border border-slate-300 p-2 text-center w-8">№</th>
                <th className="border border-slate-300 p-2 w-16">თარიღი / დრო</th>
                <th className="border border-slate-300 p-2 w-32">ექიმი</th>
                <th className="border border-slate-300 p-2">დიაგნოზი / მდგომარეობა</th>
                <th className="border border-slate-300 p-2">უარის მიზეზი</th>
                <th className="border border-slate-300 p-2">კომენტარი</th>
                <th className="border border-slate-300 p-2 w-28">ოპერატორი</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 text-center">
              {printableRecords.map((r, index) => {
                const reasonLabel = r.refusalReason === 'სხვა' ? `სხვა: ${r.refusalReasonCustom || ''}` : r.refusalReason;
                return (
                  <tr key={r.id}>
                    <td className="border border-slate-300 p-2 text-center font-bold text-slate-500">{index + 1}</td>
                    <td className="border border-slate-300 p-2 text-center whitespace-normal font-semibold text-slate-800 leading-tight">
                      <div className="text-[11px]">{formatToGeorgianDate(r.refusalDate)}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{r.refusalTime} სთ</div>
                    </td>
                    <td className="border border-slate-300 p-2 font-medium text-slate-700 text-left">{r.doctorFullNameSnapshot}</td>
                    <td className="border border-slate-300 p-2 text-slate-900 font-bold text-left">
                      {r.patientIdentifier && (
                        <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-[9px] mr-1 inline-block font-mono">
                          {r.patientIdentifier}
                        </span>
                      )}
                      {r.diagnosis}
                    </td>
                    <td className="border border-slate-300 p-2 font-semibold text-red-950 text-[10px] text-left">{reasonLabel}</td>
                    <td className="border border-slate-300 p-2 text-slate-500 italic leading-snug text-left">
                      {r.comment || '-'}
                      {r.ambulanceInfo && <div className="text-[9px] text-slate-400 not-italic mt-1">ბრიგადა: {r.ambulanceInfo}</div>}
                    </td>
                    <td className="border border-slate-300 p-2 text-slate-600 whitespace-nowrap text-left">{r.hospitalizationOperator || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Signatures section - Formulated strictly at the base of A4 page */}
        <div className="pt-8 border-t border-slate-300 grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-slate-800">
          <div className="space-y-4">
            <h3 className="font-bold underline text-slate-900">მორიგე ექიმის დასტური:</h3>
            <div className="space-y-3 pt-1">
              <div>
                ხელმოწერა: ___________________________________________
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                სახელი და გვარი: _____________________________________
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                თარიღი: {printDate ? `${formatToGeorgianDate(printDate)}` : '____/____/________'}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold underline text-slate-900">დეპარტამენტის ხელმძღვანელი: ანა დალაქიშვილი</h3>
            <div className="space-y-3 pt-1">
              <div>
                ხელმოწერა: ___________________________________________
              </div>
            </div>
          </div>
        </div>

        {/* Minimal Footer Print stamp */}
        <div className="text-center text-xs font-bold text-slate-600 mt-12 pt-6 border-t border-slate-200">
          ფორმა შევსებულია მორიგე ექიმის მიერ.
        </div>
      </div>
    </div>
  );
}
