/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'doctor';
export type UserStatus = 'active' | 'inactive';
export type ShiftType = 'day' | 'night' | 'other';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email?: string;
  passwordHash: string; // Stored server-side only
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface Refusal {
  id: string;
  doctorId: string;
  doctorFullNameSnapshot: string;
  patientIdentifier: string; // Initials or short identifier (optional-safe)
  diagnosis: string;
  refusalReason: string;
  refusalReasonCustom?: string;
  comment: string;
  hospitalizationOperator: string;
  ambulanceInfo: string;
  shiftType: ShiftType;
  refusalDate: string; // YYYY-MM-DD
  refusalTime: string; // HH:MM
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface RefusalReason {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userFullName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface DatabaseState {
  users: User[];
  refusals: Refusal[];
  refusalReasons: RefusalReason[];
  auditLogs: AuditLog[];
}
