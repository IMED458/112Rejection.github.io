/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { DatabaseState, User, Refusal, RefusalReason, AuditLog, ShiftType } from './src/types';

const app = express();
const PORT = 3000;
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'db.json');

app.use(express.json());

// Helpers for Hashing Passwords (using pure Node crypto, safe & zero-dependency)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate secure random ID
function generateId(): string {
  return crypto.randomUUID();
}

// Database Helper
function loadDatabase(): DatabaseState {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const defaultReasons: RefusalReason[] = [
    { id: generateId(), name: 'პალიატიური', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'სხვა კლინიკის ონკოლოგია', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'ალკოჰოლური ინტოქსიკაცია', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'მწოლიარე პაციენტია(დემენცია, ენცეფალოპათია)', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'საჭირო კვლევა ან სერვისი მიუწვდომელია', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'სხვა', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ];

  const defaultUsers: User[] = [
    {
      id: generateId(),
      firstName: 'სისტემის',
      lastName: 'ადმინისტრატორი',
      username: 'admin',
      role: 'admin',
      status: 'active',
      passwordHash: hashPassword('Admin12345'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: generateId(),
      firstName: 'გიორგი',
      lastName: 'ექიმი',
      username: 'doctor',
      role: 'doctor',
      status: 'active',
      passwordHash: hashPassword('Doctor12345'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const defaultDb: DatabaseState = {
    users: defaultUsers,
    refusals: [],
    refusalReasons: defaultReasons,
    auditLogs: [
      {
        id: generateId(),
        userId: 'system',
        userFullName: 'სისტემა',
        action: 'სისტემის ინიციალიზაცია',
        entityType: 'system',
        entityId: 'system',
        createdAt: new Date().toISOString()
      }
    ]
  };

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2), 'utf-8');
    return defaultDb;
  }

  try {
    const rawData = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(rawData) as DatabaseState;
    // Safety checks for missing tables
    if (!parsed.users) parsed.users = defaultUsers;
    if (!parsed.refusals) parsed.refusals = [];
    if (!parsed.refusalReasons) parsed.refusalReasons = defaultReasons;
    if (!parsed.auditLogs) parsed.auditLogs = [];
    return parsed;
  } catch (error) {
    console.error('Error loading database, resetting default', error);
    return defaultDb;
  }
}

function saveDatabase(db: DatabaseState) {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

// Write Audit Log Helper
function logAction(userId: string, userFullName: string, action: string, entityType: string, entityId: string, oldValue?: any, newValue?: any) {
  const db = loadDatabase();
  const log: AuditLog = {
    id: generateId(),
    userId,
    userFullName,
    action,
    entityType,
    entityId,
    oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
    newValue: newValue ? JSON.stringify(newValue) : undefined,
    createdAt: new Date().toISOString()
  };
  db.auditLogs.unshift(log); // newest first
  saveDatabase(db);
}

// Authentication Middleware
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <userId>"

  if (!token) {
    res.status(401).json({ error: 'ავტორიზაცია აუცილებელია' });
    return;
  }

  const db = loadDatabase();
  const user = db.users.find(u => u.id === token);

  if (!user) {
    res.status(401).json({ error: 'სესია ვადაგასულია' });
    return;
  }

  if (user.status === 'inactive') {
    res.status(403).json({ error: 'მომხმარებელი დეაქტივირებულია' });
    return;
  }

  // Attach user to request
  (req as any).user = user;
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user as User;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'წვდომა უარყოფილია: ეს ქმედება ხელმისაწვდომია მხოლოდ ადმინისტრატორებისთვის' });
    return;
  }
  next();
}

// =================== API ENDPOINTS ===================

// Auth: Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'გთხოვთ შეავსოთ მომხმარებლის სახელი და პაროლი' });
    return;
  }

  const db = loadDatabase();
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(400).json({ error: 'მომხმარებლის სახელი ან პაროლი არასწორია' });
    return;
  }

  if (user.status === 'inactive') {
    res.status(403).json({ error: 'თქვენი ანგარიში დეაქტივირებულია' });
    return;
  }

  // Update last login
  user.lastLoginAt = new Date().toISOString();
  saveDatabase(db);

  logAction(user.id, `${user.firstName} ${user.lastName}`, 'სისტემაში შესვლა', 'user', user.id);

  // Return user details and token (token is standard userId in our lightweight setup)
  res.json({
    token: user.id,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      role: user.role,
      status: user.status
    }
  });
});

// Auth: Get Current Profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = (req as any).user as User;
  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: user.role,
    status: user.status
  });
});

// Auth: Change Password (Self-service)
app.post('/api/auth/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = (req as any).user as User;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'გთხოვთ შეავსოთ ყველა ველი' });
    return;
  }

  const db = loadDatabase();
  const dbUser = db.users.find(u => u.id === user.id)!;

  if (dbUser.passwordHash !== hashPassword(currentPassword)) {
    res.status(400).json({ error: 'მიმდინარე პაროლი არასწორია' });
    return;
  }

  dbUser.passwordHash = hashPassword(newPassword);
  dbUser.updatedAt = new Date().toISOString();
  saveDatabase(db);

  logAction(dbUser.id, `${dbUser.firstName} ${dbUser.lastName}`, 'საკუთარი პაროლის შეცვლა', 'user', dbUser.id);

  res.json({ message: 'პაროლი წარმატებით შეიცვალა' });
});

// Refusals API
app.get('/api/refusals', authenticateToken, (req, res) => {
  const db = loadDatabase();
  res.json(db.refusals);
});

app.post('/api/refusals', authenticateToken, (req, res) => {
  const user = (req as any).user as User;
  const {
    patientIdentifier,
    diagnosis,
    refusalReason,
    refusalReasonCustom,
    comment,
    hospitalizationOperator,
    ambulanceInfo,
    shiftType,
    refusalDate,
    refusalTime
  } = req.body;

  if (!diagnosis || !refusalReason || !refusalDate || !refusalTime) {
    res.status(400).json({ error: 'სავალდებულო ველები შეავსეთ (დიაგნოზი, უარის მიზეზი, თარიღი, დრო)' });
    return;
  }

  const db = loadDatabase();
  const newRefusal: Refusal = {
    id: generateId(),
    doctorId: user.id,
    doctorFullNameSnapshot: `${user.firstName} ${user.lastName}`,
    patientIdentifier: patientIdentifier || '',
    diagnosis,
    refusalReason,
    refusalReasonCustom: refusalReason === 'სხვა' ? refusalReasonCustom || '' : undefined,
    comment: comment || '',
    hospitalizationOperator: hospitalizationOperator || '',
    ambulanceInfo: ambulanceInfo || '',
    shiftType: shiftType || 'other',
    refusalDate,
    refusalTime,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: user.id,
    updatedBy: user.id
  };

  db.refusals.unshift(newRefusal); // Store newest first
  saveDatabase(db);

  logAction(
    user.id,
    `${user.firstName} ${user.lastName}`,
    `ახალი უარის დამატება (${diagnosis.substring(0, 30)})`,
    'refusal',
    newRefusal.id,
    null,
    newRefusal
  );

  res.status(201).json(newRefusal);
});

app.put('/api/refusals/:id', authenticateToken, (req, res) => {
  const user = (req as any).user as User;
  const { id } = req.params;
  const {
    patientIdentifier,
    diagnosis,
    refusalReason,
    refusalReasonCustom,
    comment,
    hospitalizationOperator,
    ambulanceInfo,
    shiftType,
    refusalDate,
    refusalTime
  } = req.body;

  const db = loadDatabase();
  const refusalIndex = db.refusals.findIndex(r => r.id === id);

  if (refusalIndex === -1) {
    res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა' });
    return;
  }

  const oldRefusal = db.refusals[refusalIndex];

  // Access Control: Only admin or the author can edit
  if (user.role !== 'admin' && oldRefusal.doctorId !== user.id) {
    res.status(403).json({ error: 'სხვა ექიმის ჩანაწერის რედაქტირება დაშვებულია მხოლოდ ადმინისტრატორისთვის' });
    return;
  }

  if (!diagnosis || !refusalReason || !refusalDate || !refusalTime) {
    res.status(400).json({ error: 'სავალდებულო ველები შეავსეთ (დიაგნოზი, უარის მიზეზი, თარიღი, დრო)' });
    return;
  }

  const updatedRefusal: Refusal = {
    ...oldRefusal,
    patientIdentifier: patientIdentifier || '',
    diagnosis,
    refusalReason,
    refusalReasonCustom: refusalReason === 'სხვა' ? refusalReasonCustom || '' : undefined,
    comment: comment || '',
    hospitalizationOperator: hospitalizationOperator || '',
    ambulanceInfo: ambulanceInfo || '',
    shiftType: shiftType || 'other',
    refusalDate,
    refusalTime,
    updatedAt: new Date().toISOString(),
    updatedBy: user.id
  };

  db.refusals[refusalIndex] = updatedRefusal;
  saveDatabase(db);

  logAction(
    user.id,
    `${user.firstName} ${user.lastName}`,
    `უარის ჩანაწერის რედაქტირება (ID: ${id})`,
    'refusal',
    id,
    oldRefusal,
    updatedRefusal
  );

  res.json(updatedRefusal);
});

// Soft-delete or record deletion
app.delete('/api/refusals/:id', authenticateToken, (req, res) => {
  const user = (req as any).user as User;
  const { id } = req.params;

  const db = loadDatabase();
  const refusalIndex = db.refusals.findIndex(r => r.id === id);

  if (refusalIndex === -1) {
    res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა' });
    return;
  }

  const oldRefusal = db.refusals[refusalIndex];

  // Access Control: Only admin, or the author of the refusal can delete
  if (user.role !== 'admin' && oldRefusal.doctorId !== user.id) {
    res.status(403).json({ error: 'სხვისი ჩანაწერის წაშლის უფლება არ გაქვთ!' });
    return;
  }

  db.refusals.splice(refusalIndex, 1);
  saveDatabase(db);

  logAction(
    user.id,
    `${user.firstName} ${user.lastName}`,
    `უარის ჩანაწერის წაშლა (პაციენტის ინიციალი: ${oldRefusal.patientIdentifier || 'უცნობი'}, დიაგნოზი: ${oldRefusal.diagnosis})`,
    'refusal',
    id,
    oldRefusal,
    null
  );

  res.json({ message: 'ჩანაწერი წარმატებით წაიშალა' });
});

// --- Refusal Reasons Management APIs (Admin Only) ---
app.get('/api/reasons', authenticateToken, (req, res) => {
  const db = loadDatabase();
  res.json(db.refusalReasons);
});

app.post('/api/reasons', authenticateToken, requireAdmin, (req, res) => {
  const user = (req as any).user as User;
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: 'დასახელება აუცილებელია' });
    return;
  }

  const db = loadDatabase();
  const nameExists = db.refusalReasons.some(r => r.name.toLowerCase() === name.toLowerCase());
  if (nameExists) {
    res.status(400).json({ error: 'ეს მიზეზი უკვე არსებობს' });
    return;
  }

  const newReason: RefusalReason = {
    id: generateId(),
    name,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.refusalReasons.push(newReason);
  saveDatabase(db);

  logAction(
    user.id,
    `${user.firstName} ${user.lastName}`,
    `ახალი უარის მიზეზის დამატება: ${name}`,
    'reason',
    newReason.id,
    null,
    newReason
  );

  res.status(201).json(newReason);
});

app.put('/api/reasons/:id', authenticateToken, requireAdmin, (req, res) => {
  const user = (req as any).user as User;
  const { id } = req.params;
  const { name, isActive } = req.body;

  const db = loadDatabase();
  const idx = db.refusalReasons.findIndex(r => r.id === id);

  if (idx === -1) {
    res.status(404).json({ error: 'მიზეზი ვერ მოიძებნა' });
    return;
  }

  const oldReason = db.refusalReasons[idx];
  const updated: RefusalReason = {
    ...oldReason,
    name: name !== undefined ? name : oldReason.name,
    isActive: isActive !== undefined ? isActive : oldReason.isActive,
    updatedAt: new Date().toISOString()
  };

  db.refusalReasons[idx] = updated;
  saveDatabase(db);

  logAction(
    user.id,
    `${user.firstName} ${user.lastName}`,
    `უარის მიზეზის ცვლილება (ID: ${id})`,
    'reason',
    id,
    oldReason,
    updated
  );

  res.json(updated);
});

app.delete('/api/reasons/:id', authenticateToken, requireAdmin, (req, res) => {
  const user = (req as any).user as User;
  const { id } = req.params;

  const db = loadDatabase();
  const idx = db.refusalReasons.findIndex(r => r.id === id);

  if (idx === -1) {
    res.status(404).json({ error: 'მიზეზი ვერ მოიძებნა' });
    return;
  }

  const old = db.refusalReasons[idx];
  db.refusalReasons.splice(idx, 1);
  saveDatabase(db);

  logAction(
    user.id,
    `${user.firstName} ${user.lastName}`,
    `უარის მიზეზის წაშლა: ${old.name}`,
    'reason',
    id,
    old,
    null
  );

  res.json({ message: 'მიზეზი წარმატებით წაიშალა' });
});

// --- User Management APIs (Admin Only) ---
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const db = loadDatabase();
  // Strip password hash before sending to client
  const safeUsers = db.users.map(({ passwordHash, ...rest }) => rest);
  res.json(safeUsers);
});

app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const adminUser = (req as any).user as User;
  const { firstName, lastName, username, email, password, role, status } = req.body;

  if (!firstName || !lastName || !username || !password || !role) {
    res.status(400).json({ error: 'გთხოვთ შეავსოთ ყველა სავალდებულო ველი (სახელი, გვარი, მომხმარებელი, პაროლი, როლი)' });
    return;
  }

  const db = loadDatabase();
  const userExists = db.users.some(u => u.username.toLowerCase() === username.toLowerCase());

  if (userExists) {
    res.status(400).json({ error: 'ეს მომხმარებლის სახელი უკვე დაკავებულია' });
    return;
  }

  const newUser: User = {
    id: generateId(),
    firstName,
    lastName,
    username,
    email: email || '',
    role,
    status: status || 'active',
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDatabase(db);

  logAction(
    adminUser.id,
    `${adminUser.firstName} ${adminUser.lastName}`,
    `მომხმარებლის დამატება: ${firstName} ${lastName} (${username})`,
    'user',
    newUser.id,
    null,
    { id: newUser.id, username: newUser.username, role: newUser.role, status: newUser.status }
  );

  const { passwordHash, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

app.put('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const adminUser = (req as any).user as User;
  const { id } = req.params;
  const { firstName, lastName, username, email, role, status } = req.body;

  const db = loadDatabase();
  const idx = db.users.findIndex(u => u.id === id);

  if (idx === -1) {
    res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა' });
    return;
  }

  const oldUser = db.users[idx];

  // Prevent admin from deactivating or changing their own role to doctor
  if (adminUser.id === id && (status === 'inactive' || role === 'doctor')) {
    res.status(400).json({ error: 'არ შეგიძლიათ საკუთარ თავზე სტატუსის/როლის ამგვარად შეცვლა' });
    return;
  }

  // Check unique username if username changed
  if (username && username.toLowerCase() !== oldUser.username.toLowerCase()) {
    const exists = db.users.some(u => u.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      res.status(400).json({ error: 'ეს მომხმარებლის სახელი უკვე დაკავებულია' });
      return;
    }
  }

  const updatedUser: User = {
    ...oldUser,
    firstName: firstName || oldUser.firstName,
    lastName: lastName || oldUser.lastName,
    username: username || oldUser.username,
    email: email !== undefined ? email : oldUser.email,
    role: role || oldUser.role,
    status: status || oldUser.status,
    updatedAt: new Date().toISOString()
  };

  db.users[idx] = updatedUser;
  saveDatabase(db);

  logAction(
    adminUser.id,
    `${adminUser.firstName} ${adminUser.lastName}`,
    `მომხმარებლის რედაქტირება: ${updatedUser.username}`,
    'user',
    id,
    { id: oldUser.id, username: oldUser.username, role: oldUser.role, status: oldUser.status },
    { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role, status: updatedUser.status }
  );

  const { passwordHash, ...safeUser } = updatedUser;
  res.json(safeUser);
});

app.post('/api/users/:id/reset-password', authenticateToken, requireAdmin, (req, res) => {
  const adminUser = (req as any).user as User;
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    res.status(400).json({ error: 'ახალი პაროლის ველი ცარიელია' });
    return;
  }

  const db = loadDatabase();
  const idx = db.users.findIndex(u => u.id === id);

  if (idx === -1) {
    res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა' });
    return;
  }

  db.users[idx].passwordHash = hashPassword(newPassword);
  db.users[idx].updatedAt = new Date().toISOString();
  saveDatabase(db);

  logAction(
    adminUser.id,
    `${adminUser.firstName} ${adminUser.lastName}`,
    `მომხმარებლის პაროლის აღდგენა/შეცვლა: ${db.users[idx].username}`,
    'user',
    id
  );

  res.json({ message: 'მომხმარებლის პაროლი წარმატებით შეიცვალა/აღდგა!' });
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const adminUser = (req as any).user as User;
  const { id } = req.params;

  if (adminUser.id === id) {
    res.status(400).json({ error: 'საკუთარ თავს ვერ წაშლით' });
    return;
  }

  const db = loadDatabase();
  const idx = db.users.findIndex(u => u.id === id);

  if (idx === -1) {
    res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა' });
    return;
  }

  const deletedUser = db.users[idx];
  db.users.splice(idx, 1);
  saveDatabase(db);

  logAction(
    adminUser.id,
    `${adminUser.firstName} ${adminUser.lastName}`,
    `მომხმარებლის სრული წაშლა: ${deletedUser.firstName} ${deletedUser.lastName} (${deletedUser.username})`,
    'user',
    id,
    { username: deletedUser.username, role: deletedUser.role }
  );

  res.json({ message: 'მომხმარებელი წარმატებით წაიშალა' });
});

// Audit Logs APIs (Admin Only)
app.get('/api/audit-logs', authenticateToken, requireAdmin, (req, res) => {
  const db = loadDatabase();
  res.json(db.auditLogs);
});

// Statistics endpoint (Available to Admins only)
app.get('/api/stats', authenticateToken, requireAdmin, (req, res) => {
  const db = loadDatabase();
  const refusals = db.refusals;

  // Total count
  const total = refusals.length;

  // Today's count (YYYY-MM-DD)
  // Timezone adjustment can be done client-side, but let's base it on our server local ISO string timestamp
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = refusals.filter(r => r.refusalDate === todayStr).length;

  // This month
  const currentMonthStr = todayStr.substring(0, 7); // e.g. "2026-06"
  const monthCount = refusals.filter(r => r.refusalDate.startsWith(currentMonthStr)).length;

  // Group by doctor
  const doctorCounts: Record<string, number> = {};
  refusals.forEach(r => {
    doctorCounts[r.doctorFullNameSnapshot] = (doctorCounts[r.doctorFullNameSnapshot] || 0) + 1;
  });
  const topDoctors = Object.entries(doctorCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Group by reason
  const reasonCounts: Record<string, number> = {};
  refusals.forEach(r => {
    const reasonLabel = r.refusalReason === 'სხვა' ? `სხვა: ${r.refusalReasonCustom || ''}` : r.refusalReason;
    reasonCounts[reasonLabel] = (reasonCounts[reasonLabel] || 0) + 1;
  });
  const topReasons = Object.entries(reasonCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Group by diagnosis
  const diagnosisCounts: Record<string, number> = {};
  refusals.forEach(r => {
    // Trim/normalize diagnosis
    const diag = r.diagnosis.trim();
    diagnosisCounts[diag] = (diagnosisCounts[diag] || 0) + 1;
  });
  const topDiagnoses = Object.entries(diagnosisCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // TOP 10

  // Group by shift
  const shiftCounts: Record<string, number> = { day: 0, night: 0, other: 0 };
  refusals.forEach(r => {
    if (r.shiftType in shiftCounts) {
      shiftCounts[r.shiftType]++;
    } else {
      shiftCounts.other++;
    }
  });

  // Group by day (for history chart)
  // Let's get the last 15 days which have records, or last 15 calendar days
  const dateCounts: Record<string, number> = {};
  refusals.forEach(r => {
    dateCounts[r.refusalDate] = (dateCounts[r.refusalDate] || 0) + 1;
  });
  const dailyHistory = Object.entries(dateCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-15); // last 15 entries

  res.json({
    total,
    todayCount,
    monthCount,
    topDoctors,
    topReasons,
    topDiagnoses,
    shiftCounts,
    dailyHistory
  });
});

// Configure Vite middleware or static server
async function initServer() {
  // Mount Vite middleware for asset serving in Development mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static directories
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Run server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] 112 Emergency Refusals application running at http://0.0.0.0:${PORT}`);
    // Load/verify database on boots
    const loaded = loadDatabase();
    console.log(`[Server] Database loaded. Active Refusal Reasons: ${loaded.refusalReasons.length}. Users: ${loaded.users.length}`);
  });
}

initServer();
