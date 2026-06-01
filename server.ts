/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import crypto from 'crypto';
import * as admin from 'firebase-admin';
import { createServer as createViteServer } from 'vite';
import { User, Refusal, RefusalReason, AuditLog, ShiftType } from './src/types';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// =================== FIREBASE ADMIN INIT ===================
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccountJson) {
  const serviceAccount = JSON.parse(serviceAccountJson);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'rejection-f96c5',
  });
}

const db = admin.firestore();

// =================== GEMINI (GOOGLE AI STUDIO) INIT ===================
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
export const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
if (gemini) {
  console.log('[Gemini] Google AI Studio initialized successfully.');
} else {
  console.warn('[Gemini] GEMINI_API_KEY not set — AI features disabled.');
}

// =================== EXPRESS SETUP ===================
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.use(express.json());

// =================== HELPERS ===================
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateId(): string {
  return crypto.randomUUID();
}

async function getUserById(id: string): Promise<User | null> {
  const doc = await db.collection('users').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as User;
}

async function getUserByUsername(username: string): Promise<User | null> {
  const snap = await db.collection('users')
    .where('usernameLower', '==', username.toLowerCase())
    .limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as User;
}

async function logAction(
  userId: string,
  userFullName: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValue?: any,
  newValue?: any
): Promise<void> {
  const log: Omit<AuditLog, 'id'> & { id: string } = {
    id: generateId(),
    userId,
    userFullName,
    action,
    entityType,
    entityId,
    oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
    newValue: newValue ? JSON.stringify(newValue) : undefined,
    createdAt: new Date().toISOString(),
  };
  await db.collection('auditLogs').doc(log.id).set(log);
}

// =================== DB SEED (first run) ===================
async function seedIfEmpty(): Promise<void> {
  const usersSnap = await db.collection('users').limit(1).get();
  if (!usersSnap.empty) return;

  console.log('[Server] Seeding default data into Firestore...');

  const defaultReasons: RefusalReason[] = [
    { id: generateId(), name: 'პალიატიური', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'სხვა კლინიკის ონკოლოგია', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'ალკოჰოლური ინტოქსიკაცია', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'მწოლიარე პაციენტია(დემენცია, ენცეფალოპათია)', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'საჭირო კვლევა ან სერვისი მიუწვდომელია', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'სხვა', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];

  const batch = db.batch();
  for (const r of defaultReasons) {
    batch.set(db.collection('refusalReasons').doc(r.id), r);
  }

  const adminUser: User = {
    id: generateId(),
    firstName: 'სისტემის',
    lastName: 'ადმინისტრატორი',
    username: 'admin',
    role: 'admin',
    status: 'active',
    passwordHash: hashPassword('Admin12345'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const doctorUser: User = {
    id: generateId(),
    firstName: 'გიორგი',
    lastName: 'ექიმი',
    username: 'doctor',
    role: 'doctor',
    status: 'active',
    passwordHash: hashPassword('Doctor12345'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  batch.set(db.collection('users').doc(adminUser.id), { ...adminUser, usernameLower: 'admin' });
  batch.set(db.collection('users').doc(doctorUser.id), { ...doctorUser, usernameLower: 'doctor' });

  await batch.commit();
  console.log('[Server] Default data seeded successfully.');
}

// =================== AUTH MIDDLEWARE ===================
async function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'ავტორიზაცია აუცილებელია' });
    return;
  }
  const user = await getUserById(token);
  if (!user) {
    res.status(401).json({ error: 'სესია ვადაგასულია' });
    return;
  }
  if (user.status === 'inactive') {
    res.status(403).json({ error: 'მომხმარებელი დეაქტივირებულია' });
    return;
  }
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

// =================== AUTH ENDPOINTS ===================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'გთხოვთ შეავსოთ მომხმარებლის სახელი და პაროლი' });
      return;
    }

    const user = await getUserByUsername(username);
    if (!user || user.passwordHash !== hashPassword(password)) {
      res.status(400).json({ error: 'მომხმარებლის სახელი ან პაროლი არასწორია' });
      return;
    }
    if (user.status === 'inactive') {
      res.status(403).json({ error: 'თქვენი ანგარიში დეაქტივირებულია' });
      return;
    }

    await db.collection('users').doc(user.id).update({ lastLoginAt: new Date().toISOString() });
    await logAction(user.id, `${user.firstName} ${user.lastName}`, 'სისტემაში შესვლა', 'user', user.id);

    let firebaseToken: string | null = null;
    try {
      firebaseToken = await admin.auth().createCustomToken(user.id);
    } catch (err) {
      console.warn('[Auth] Could not generate Firebase custom token:', err);
    }

    res.json({
      token: user.id,
      firebaseToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    console.error('[Login]', err);
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.get('/api/auth/me', authenticateToken as any, async (req, res) => {
  const user = (req as any).user as User;
  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: user.role,
    status: user.status,
  });
});

app.post('/api/auth/change-password', authenticateToken as any, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = (req as any).user as User;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'გთხოვთ შეავსოთ ყველა ველი' });
      return;
    }
    if (user.passwordHash !== hashPassword(currentPassword)) {
      res.status(400).json({ error: 'მიმდინარე პაროლი არასწორია' });
      return;
    }
    await db.collection('users').doc(user.id).update({
      passwordHash: hashPassword(newPassword),
      updatedAt: new Date().toISOString(),
    });
    await logAction(user.id, `${user.firstName} ${user.lastName}`, 'საკუთარი პაროლის შეცვლა', 'user', user.id);
    res.json({ message: 'პაროლი წარმატებით შეიცვალა' });
  } catch (err) {
    console.error('[ChangePassword]', err);
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

// =================== REFUSALS API ===================
app.get('/api/refusals', authenticateToken as any, async (req, res) => {
  try {
    const snap = await db.collection('refusals').orderBy('createdAt', 'desc').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.post('/api/refusals', authenticateToken as any, async (req, res) => {
  try {
    const user = (req as any).user as User;
    const { patientIdentifier, diagnosis, refusalReason, refusalReasonCustom, comment, hospitalizationOperator, ambulanceInfo, shiftType, refusalDate, refusalTime } = req.body;

    if (!diagnosis || !refusalReason || !refusalDate || !refusalTime) {
      res.status(400).json({ error: 'სავალდებულო ველები შეავსეთ (დიაგნოზი, უარის მიზეზი, თარიღი, დრო)' });
      return;
    }

    const id = generateId();
    const newRefusal: Refusal = {
      id,
      doctorId: user.id,
      doctorFullNameSnapshot: `${user.firstName} ${user.lastName}`,
      patientIdentifier: patientIdentifier || '',
      diagnosis,
      refusalReason,
      refusalReasonCustom: refusalReason === 'სხვა' ? refusalReasonCustom || '' : undefined,
      comment: comment || '',
      hospitalizationOperator: hospitalizationOperator || '',
      ambulanceInfo: ambulanceInfo || '',
      shiftType: (shiftType as ShiftType) || 'other',
      refusalDate,
      refusalTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
      updatedBy: user.id,
    };

    await db.collection('refusals').doc(id).set(newRefusal);
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `ახალი უარის დამატება (${diagnosis.substring(0, 30)})`, 'refusal', id, null, newRefusal);
    res.status(201).json(newRefusal);
  } catch (err) {
    console.error('[CreateRefusal]', err);
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.put('/api/refusals/:id', authenticateToken as any, async (req, res) => {
  try {
    const user = (req as any).user as User;
    const { id } = req.params;
    const { patientIdentifier, diagnosis, refusalReason, refusalReasonCustom, comment, hospitalizationOperator, ambulanceInfo, shiftType, refusalDate, refusalTime } = req.body;

    const doc = await db.collection('refusals').doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა' });
      return;
    }

    const oldRefusal = { id: doc.id, ...doc.data() } as Refusal;
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
      shiftType: (shiftType as ShiftType) || 'other',
      refusalDate,
      refusalTime,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };

    await db.collection('refusals').doc(id).set(updatedRefusal);
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `უარის ჩანაწერის რედაქტირება (ID: ${id})`, 'refusal', id, oldRefusal, updatedRefusal);
    res.json(updatedRefusal);
  } catch (err) {
    console.error('[UpdateRefusal]', err);
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.delete('/api/refusals/:id', authenticateToken as any, async (req, res) => {
  try {
    const user = (req as any).user as User;
    const { id } = req.params;

    const doc = await db.collection('refusals').doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა' });
      return;
    }

    const oldRefusal = { id: doc.id, ...doc.data() } as Refusal;
    if (user.role !== 'admin' && oldRefusal.doctorId !== user.id) {
      res.status(403).json({ error: 'სხვისი ჩანაწერის წაშლის უფლება არ გაქვთ!' });
      return;
    }

    await db.collection('refusals').doc(id).delete();
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `უარის ჩანაწერის წაშლა (პაციენტი: ${oldRefusal.patientIdentifier || 'უცნობი'}, დიაგნოზი: ${oldRefusal.diagnosis})`, 'refusal', id, oldRefusal, null);
    res.json({ message: 'ჩანაწერი წარმატებით წაიშალა' });
  } catch (err) {
    console.error('[DeleteRefusal]', err);
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

// =================== REASONS API ===================
app.get('/api/reasons', authenticateToken as any, async (req, res) => {
  try {
    const snap = await db.collection('refusalReasons').orderBy('createdAt', 'asc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.post('/api/reasons', authenticateToken as any, requireAdmin, async (req, res) => {
  try {
    const user = (req as any).user as User;
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'დასახელება აუცილებელია' });
      return;
    }

    const existing = await db.collection('refusalReasons').where('name', '==', name).limit(1).get();
    if (!existing.empty) {
      res.status(400).json({ error: 'ეს მიზეზი უკვე არსებობს' });
      return;
    }

    const id = generateId();
    const newReason: RefusalReason = { id, name, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.collection('refusalReasons').doc(id).set(newReason);
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `ახალი უარის მიზეზის დამატება: ${name}`, 'reason', id, null, newReason);
    res.status(201).json(newReason);
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.put('/api/reasons/:id', authenticateToken as any, requireAdmin, async (req, res) => {
  try {
    const user = (req as any).user as User;
    const { id } = req.params;
    const { name, isActive } = req.body;

    const doc = await db.collection('refusalReasons').doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'მიზეზი ვერ მოიძებნა' });
      return;
    }

    const oldReason = { id: doc.id, ...doc.data() } as RefusalReason;
    const updated: RefusalReason = {
      ...oldReason,
      name: name !== undefined ? name : oldReason.name,
      isActive: isActive !== undefined ? isActive : oldReason.isActive,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('refusalReasons').doc(id).set(updated);
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `უარის მიზეზის ცვლილება (ID: ${id})`, 'reason', id, oldReason, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.delete('/api/reasons/:id', authenticateToken as any, requireAdmin, async (req, res) => {
  try {
    const user = (req as any).user as User;
    const { id } = req.params;

    const doc = await db.collection('refusalReasons').doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'მიზეზი ვერ მოიძებნა' });
      return;
    }

    const old = { id: doc.id, ...doc.data() } as RefusalReason;
    await db.collection('refusalReasons').doc(id).delete();
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `უარის მიზეზის წაშლა: ${old.name}`, 'reason', id, old, null);
    res.json({ message: 'მიზეზი წარმატებით წაიშალა' });
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

// =================== USERS API (Admin Only) ===================
app.get('/api/users', authenticateToken as any, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('users').orderBy('createdAt', 'asc').get();
    const users = snap.docs.map(d => {
      const { passwordHash: _ph, usernameLower: _ul, ...safe } = d.data() as any;
      return { id: d.id, ...safe };
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.post('/api/users', authenticateToken as any, requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as any).user as User;
    const { firstName, lastName, username, email, password, role, status } = req.body;

    if (!firstName || !lastName || !username || !password || !role) {
      res.status(400).json({ error: 'გთხოვთ შეავსოთ ყველა სავალდებულო ველი' });
      return;
    }

    const existing = await db.collection('users').where('usernameLower', '==', username.toLowerCase()).limit(1).get();
    if (!existing.empty) {
      res.status(400).json({ error: 'ეს მომხმარებლის სახელი უკვე დაკავებულია' });
      return;
    }

    const id = generateId();
    const newUser: User & { usernameLower: string } = {
      id, firstName, lastName, username,
      usernameLower: username.toLowerCase(),
      email: email || '',
      role,
      status: status || 'active',
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(id).set(newUser);
    await logAction(adminUser.id, `${adminUser.firstName} ${adminUser.lastName}`, `მომხმარებლის დამატება: ${firstName} ${lastName} (${username})`, 'user', id, null, { id, username, role, status });

    const { passwordHash: _ph, usernameLower: _ul, ...safeUser } = newUser as any;
    res.status(201).json(safeUser);
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.put('/api/users/:id', authenticateToken as any, requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as any).user as User;
    const { id } = req.params;
    const { firstName, lastName, username, email, role, status } = req.body;

    const doc = await db.collection('users').doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა' });
      return;
    }

    const oldUser = { id: doc.id, ...doc.data() } as User;

    if (adminUser.id === id && (status === 'inactive' || role === 'doctor')) {
      res.status(400).json({ error: 'არ შეგიძლიათ საკუთარ თავზე სტატუსის/როლის ამგვარად შეცვლა' });
      return;
    }

    if (username && username.toLowerCase() !== (oldUser as any).usernameLower) {
      const exists = await db.collection('users').where('usernameLower', '==', username.toLowerCase()).limit(1).get();
      if (!exists.empty && exists.docs[0].id !== id) {
        res.status(400).json({ error: 'ეს მომხმარებლის სახელი უკვე დაკავებულია' });
        return;
      }
    }

    const updatedFields: any = {
      firstName: firstName || oldUser.firstName,
      lastName: lastName || oldUser.lastName,
      username: username || oldUser.username,
      usernameLower: (username || oldUser.username).toLowerCase(),
      email: email !== undefined ? email : oldUser.email,
      role: role || oldUser.role,
      status: status || oldUser.status,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(id).update(updatedFields);
    await logAction(adminUser.id, `${adminUser.firstName} ${adminUser.lastName}`, `მომხმარებლის რედაქტირება: ${updatedFields.username}`, 'user', id, { username: oldUser.username, role: oldUser.role, status: oldUser.status }, { username: updatedFields.username, role: updatedFields.role, status: updatedFields.status });

    const { passwordHash: _ph, usernameLower: _ul, ...safe } = { ...oldUser, ...updatedFields, id } as any;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.post('/api/users/:id/reset-password', authenticateToken as any, requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as any).user as User;
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({ error: 'ახალი პაროლის ველი ცარიელია' });
      return;
    }

    const doc = await db.collection('users').doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა' });
      return;
    }

    const u = doc.data() as User;
    await db.collection('users').doc(id).update({ passwordHash: hashPassword(newPassword), updatedAt: new Date().toISOString() });
    await logAction(adminUser.id, `${adminUser.firstName} ${adminUser.lastName}`, `მომხმარებლის პაროლის აღდგენა: ${u.username}`, 'user', id);
    res.json({ message: 'მომხმარებლის პაროლი წარმატებით შეიცვალა/აღდგა!' });
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

app.delete('/api/users/:id', authenticateToken as any, requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as any).user as User;
    const { id } = req.params;

    if (adminUser.id === id) {
      res.status(400).json({ error: 'საკუთარ თავს ვერ წაშლით' });
      return;
    }

    const doc = await db.collection('users').doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა' });
      return;
    }

    const u = doc.data() as User;
    await db.collection('users').doc(id).delete();
    await logAction(adminUser.id, `${adminUser.firstName} ${adminUser.lastName}`, `მომხმარებლის სრული წაშლა: ${u.firstName} ${u.lastName} (${u.username})`, 'user', id, { username: u.username, role: u.role });
    res.json({ message: 'მომხმარებელი წარმატებით წაიშალა' });
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

// =================== AUDIT LOGS ===================
app.get('/api/audit-logs', authenticateToken as any, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('auditLogs').orderBy('createdAt', 'desc').limit(500).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

// =================== STATS ===================
app.get('/api/stats', authenticateToken as any, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('refusals').orderBy('createdAt', 'desc').get();
    const refusals = snap.docs.map(d => d.data() as Refusal);

    const total = refusals.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7);
    const todayCount = refusals.filter(r => r.refusalDate === todayStr).length;
    const monthCount = refusals.filter(r => r.refusalDate.startsWith(currentMonthStr)).length;

    const doctorCounts: Record<string, number> = {};
    refusals.forEach(r => { doctorCounts[r.doctorFullNameSnapshot] = (doctorCounts[r.doctorFullNameSnapshot] || 0) + 1; });
    const topDoctors = Object.entries(doctorCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const reasonCounts: Record<string, number> = {};
    refusals.forEach(r => {
      const label = r.refusalReason === 'სხვა' ? `სხვა: ${r.refusalReasonCustom || ''}` : r.refusalReason;
      reasonCounts[label] = (reasonCounts[label] || 0) + 1;
    });
    const topReasons = Object.entries(reasonCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const diagnosisCounts: Record<string, number> = {};
    refusals.forEach(r => { const d = r.diagnosis.trim(); diagnosisCounts[d] = (diagnosisCounts[d] || 0) + 1; });
    const topDiagnoses = Object.entries(diagnosisCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    const shiftCounts: Record<string, number> = { day: 0, night: 0, other: 0 };
    refusals.forEach(r => { shiftCounts[r.shiftType in shiftCounts ? r.shiftType : 'other']++; });

    const dateCounts: Record<string, number> = {};
    refusals.forEach(r => { dateCounts[r.refusalDate] = (dateCounts[r.refusalDate] || 0) + 1; });
    const dailyHistory = Object.entries(dateCounts).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)).slice(-15);

    res.json({ total, todayCount, monthCount, topDoctors, topReasons, topDiagnoses, shiftCounts, dailyHistory });
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' });
  }
});

// =================== VITE / STATIC ===================
async function initServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[Server] 112 Emergency Refusals running at http://0.0.0.0:${PORT}`);
    await seedIfEmpty();
  });
}

initServer();
