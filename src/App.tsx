/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { api, onAuthStateChanged, auth } from './lib/api';
import { db } from './lib/firebase';
import { LoginScreen } from './components/LoginScreen';
import { NewRefusalForm } from './components/NewRefusalForm';
import { ArchiveView } from './components/ArchiveView';
import { PdfPrintView } from './components/PdfPrintView';
import { StatsDashboard } from './components/StatsDashboard';
import { UserManagement } from './components/UserManagement';
import { ReasonManagement } from './components/ReasonManagement';
import { ChangePasswordForm } from './components/ChangePasswordForm';
import { SetupScreen } from './components/SetupScreen';

import { 
  Shield, 
  FileText, 
  Archive, 
  Printer, 
  KeyRound, 
  BarChart, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  User as UserIcon,
  RefreshCw
} from 'lucide-react';
import { Refusal, ShiftType } from './types';

type ActivePage = 'new_refusal' | 'archive' | 'pdf_print' | 'change_password' | 'stats' | 'users' | 'reasons';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [currentPage, setCurrentPage] = useState<ActivePage>('new_refusal');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editRefusal, setEditRefusal] = useState<Refusal | null>(null);

  // States for printing selection
  const [allRefusalsForPrint, setAllRefusalsForPrint] = useState<Refusal[]>([]);
  const [initialPrintDate, setInitialPrintDate] = useState('');
  const [initialPrintShift, setInitialPrintShift] = useState<ShiftType>('day');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        try {
          const snap = await getDocs(collection(db, 'users'));
          setNeedsSetup(snap.empty);
        } catch {
          setNeedsSetup(false);
        }
        setCurrentUser(null);
        setLoading(false);
        return;
      }
      try {
        const user = await api.getMe();
        setCurrentUser(user);
        setNeedsSetup(false);
        setCurrentPage(user.role === 'admin' ? 'stats' : 'new_refusal');
      } catch {
        api.clearToken();
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setCurrentPage('stats');
    } else {
      setCurrentPage('new_refusal');
    }
  };

  const handleLogout = () => {
    if (window.confirm('დარწმუნებული ხართ რომ გსურთ სისტემიდან გამოსვლა?')) {
      api.clearToken();
      setCurrentUser(null);
      setMobileMenuOpen(false);
    }
  };

  // Callback after adding new refusal -> automatically open refusal archive
  const handleRefusalSuccess = (savedRefusal?: Refusal) => {
    api.getRefusals().then(data => {
      setAllRefusalsForPrint(data);
      if (savedRefusal) {
        // Trigger print immediately on "Save and Print" option
        setInitialPrintDate(savedRefusal.refusalDate);
        setInitialPrintShift(savedRefusal.shiftType);
        setCurrentPage('pdf_print');
      } else {
        setCurrentPage('archive');
      }
    });
  };

  // Triggers print option from the archive with filtered records pre-selected
  const handleTriggerPrintFromArchive = (filteredList: Refusal[]) => {
    setAllRefusalsForPrint(filteredList);
    // Determine defaults from list if available
    if (filteredList.length > 0) {
      setInitialPrintDate(filteredList[0].refusalDate);
      setInitialPrintShift(filteredList[0].shiftType);
    }
    setCurrentPage('pdf_print');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center gap-3">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
        <span className="text-sm font-bold text-slate-600 tracking-wide">აღრიცხვის სისტემა იტვირთება...</span>
      </div>
    );
  }

  if (!currentUser) {
    if (needsSetup) {
      return <SetupScreen onSetupComplete={() => setNeedsSetup(false)} />;
    }
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // List of navigation items for sidebars / topbars
  const navItems = [
    { page: 'new_refusal', label: 'ახალი უარი', icon: <FileText size={18} /> },
    { page: 'archive', label: 'არქივი', icon: <Archive size={18} /> },
    { page: 'pdf_print', label: 'PDF ბეჭდვა', icon: <Printer size={18} /> },
  ];

  const adminNavItems = [
    { page: 'stats', label: 'სტატისტიკა', icon: <BarChart size={18} /> },
    { page: 'users', label: 'მომხმარებლები', icon: <Users size={18} /> },
    { page: 'reasons', label: 'მიზეზები', icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased font-sans">
      {/* 1. Header (Dynamic Navigation Header for Screen) - Hides on Print! */}
      <nav className="no-print bg-[#1E293B] text-white shadow-sm sticky top-0 z-40 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and App Title */}
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <Shield size={20} />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight block">
                  <span className="text-red-500">112</span> რეესტრი
                </span>
                <span className="text-[10px] text-gray-400 font-bold block -mt-1 tracking-widest leading-none">უარების აღრიცხვის ჟურნალი</span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold">
              {/* Doctor Standard Items */}
              {navItems.map(item => (
                <button
                  key={item.page}
                  onClick={() => setCurrentPage(item.page as ActivePage)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg transition duration-150 cursor-pointer ${
                    currentPage === item.page
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}

              {/* Admin Special Items */}
              {currentUser.role === 'admin' && (
                <>
                  <div className="h-5 w-px bg-slate-700 mx-2" />
                  {adminNavItems.map(item => (
                    <button
                      key={item.page}
                      onClick={() => setCurrentPage(item.page as ActivePage)}
                      className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg transition duration-150 cursor-pointer ${
                        currentPage === item.page
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Right details - Account Details & Action Buttons */}
            <div className="hidden lg:flex items-center gap-4">
              <div className="text-right text-xs">
                <span className="font-bold block text-blue-400">
                  {currentUser.firstName} {currentUser.lastName}
                </span>
                <span className="text-[10px] text-gray-400 block font-semibold">
                  {currentUser.role === 'admin' ? 'ადმინისტრატორი' : 'მორიგე ექიმი'}
                </span>
              </div>

              {/* Setting profile button */}
              <button
                onClick={() => setCurrentPage('change_password')}
                className={`p-2 rounded-lg transition cursor-pointer ${
                  currentPage === 'change_password' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="პაროლის შეცვლა"
              >
                <KeyRound size={16} />
              </button>

              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-slate-800 transition cursor-pointer"
                title="გამოსვლა კაბინეტიდან"
              >
                <LogOut size={16} />
              </button>
            </div>

            {/* Mobile menu trigger toggle */}
            <div className="flex lg:hidden items-center gap-2">
              <span className="text-xs font-bold text-blue-400 mr-1">
                {currentUser.firstName}
              </span>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-300 hover:text-white focus:outline-none"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* 2. Mobile Nav Drawer Block */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-2 pt-2 pb-4 space-y-1 bg-slate-850 border-t border-slate-700/50">
            {navItems.map(item => (
              <button
                key={item.page}
                onClick={() => {
                  setCurrentPage(item.page as ActivePage);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-left text-sm transition font-semibold ${
                  currentPage === item.page ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}

            {currentUser.role === 'admin' && (
              <>
                <div className="border-t border-slate-700 my-2" />
                <p className="px-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">ადმინისტრაცია</p>
                {adminNavItems.map(item => (
                  <button
                    key={item.page}
                    onClick={() => {
                      setCurrentPage(item.page as ActivePage);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-left text-sm transition font-semibold ${
                      currentPage === item.page ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </>
            )}

            <div className="border-t border-slate-700 my-2" />
            
            <button
              onClick={() => {
                setCurrentPage('change_password');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 p-2.5 rounded-lg text-left text-sm text-gray-300 hover:bg-slate-700 hover:text-white transition font-semibold"
            >
              <KeyRound size={18} />
              <span>პაროლის შეცვლა</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 p-2.5 rounded-lg text-left text-sm text-red-400 hover:bg-slate-900/50 hover:text-red-300 transition font-bold"
            >
              <LogOut size={18} />
              <span>გამოსვლა</span>
            </button>
          </div>
        )}
      </nav>

      {/* 3. Main Workspace Area */}
      <main className="flex-1 py-6">
        {(() => {
          switch (currentPage) {
            case 'new_refusal':
              return (
                <NewRefusalForm 
                  currentUser={currentUser} 
                  editRefusal={editRefusal}
                  onSuccess={(savedRefusal) => {
                    setEditRefusal(null);
                    handleRefusalSuccess(savedRefusal);
                  }} 
                  onCancel={() => {
                    setEditRefusal(null);
                    setCurrentPage('archive');
                  }}
                />
              );
            case 'archive':
              return (
                <ArchiveView 
                  currentUser={currentUser}
                  onEdit={(refusal) => {
                    setEditRefusal(refusal);
                    setCurrentPage('new_refusal');
                  }}
                  onTriggerPrint={handleTriggerPrintFromArchive}
                />
              );
            case 'pdf_print':
              return (
                <PdfPrintView
                  refusals={allRefusalsForPrint}
                  defaultDate={initialPrintDate}
                  defaultShift={initialPrintShift}
                  onBack={() => {
                    setCurrentPage('archive');
                  }}
                />
              );
            case 'stats':
              return <StatsDashboard />;
            case 'users':
              return <UserManagement />;
            case 'reasons':
              return <ReasonManagement />;
            case 'change_password':
              return <ChangePasswordForm />;
            default:
              return <NewRefusalForm currentUser={currentUser} onSuccess={handleRefusalSuccess} />;
          }
        })()}
      </main>

      {/* 4. Footer info - Hides on Print! */}
      <footer className="no-print bg-slate-900 border-t border-slate-800 py-6 text-slate-500 text-center text-xs mt-auto">
        <p className="font-semibold text-slate-400">112-ის სასწრაფო პაციენტებზე უარის აღრიცხვის რეესტრი</p>
        <p className="text-[10px] text-slate-600 mt-1">კლინიკის ემერჯენსის საინფორმაციო სისტემა © 2026</p>
      </footer>
    </div>
  );
}
