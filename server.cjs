var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  gemini: () => gemini
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var admin = null;
var db = null;
var firebaseReady = false;
async function initFirebaseAdmin() {
  try {
    const adminModule = await import("firebase-admin");
    admin = adminModule;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      const svc = JSON.parse(serviceAccountJson);
      admin.initializeApp({ credential: admin.credential.cert(svc) });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: "rejection-f96c5"
      });
    }
    db = admin.firestore();
    firebaseReady = true;
    console.log("[Firebase] Admin SDK initialized successfully.");
  } catch (err) {
    console.error("[Firebase] Admin SDK failed to initialize:", err?.message || err);
    console.warn("[Firebase] Running without database. Set FIREBASE_SERVICE_ACCOUNT env var.");
    firebaseReady = false;
  }
}
var geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
var gemini = geminiApiKey ? new import_genai.GoogleGenAI({ apiKey: geminiApiKey }) : null;
if (gemini) {
  console.log("[Gemini] Google AI Studio initialized.");
} else {
  console.warn("[Gemini] GEMINI_API_KEY not set.");
}
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT) : 3e3;
app.use(import_express.default.json());
function hashPassword(password) {
  return import_crypto.default.createHash("sha256").update(password).digest("hex");
}
function generateId() {
  return import_crypto.default.randomUUID();
}
function dbCheck(res) {
  if (!firebaseReady || !db) {
    res.status(503).json({
      error: "Firebase \u10D9\u10DD\u10DC\u10E4\u10D8\u10D2\u10E3\u10E0\u10D0\u10EA\u10D8\u10D0 \u10D0\u10E0 \u10D0\u10E0\u10D8\u10E1 \u10D3\u10D0\u10E7\u10D4\u10DC\u10D4\u10D1\u10E3\u10DA\u10D8. \u10D2\u10D7\u10EE\u10DD\u10D5\u10D7 \u10D3\u10D0\u10D0\u10DB\u10D0\u10E2\u10DD\u10D7 FIREBASE_SERVICE_ACCOUNT \u10D2\u10D0\u10E0\u10D4\u10DB\u10DD\u10E1 \u10EA\u10D5\u10DA\u10D0\u10D3\u10D8."
    });
    return false;
  }
  return true;
}
async function getUserById(id) {
  if (!db) return null;
  const doc = await db.collection("users").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}
async function getUserByUsername(username) {
  if (!db) return null;
  const snap = await db.collection("users").where("usernameLower", "==", username.toLowerCase()).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}
async function logAction(userId, userFullName, action, entityType, entityId, oldValue, newValue) {
  if (!db) return;
  const id = generateId();
  await db.collection("auditLogs").doc(id).set({
    id,
    userId,
    userFullName,
    action,
    entityType,
    entityId,
    oldValue: oldValue ? JSON.stringify(oldValue) : null,
    newValue: newValue ? JSON.stringify(newValue) : null,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function seedIfEmpty() {
  if (!db) return;
  const usersSnap = await db.collection("users").limit(1).get();
  if (!usersSnap.empty) return;
  console.log("[Server] Seeding default Firestore data...");
  const batch = db.batch();
  const defaultReasons = [
    "\u10DE\u10D0\u10DA\u10D8\u10D0\u10E2\u10D8\u10E3\u10E0\u10D8",
    "\u10E1\u10EE\u10D5\u10D0 \u10D9\u10DA\u10D8\u10DC\u10D8\u10D9\u10D8\u10E1 \u10DD\u10DC\u10D9\u10DD\u10DA\u10DD\u10D2\u10D8\u10D0",
    "\u10D0\u10DA\u10D9\u10DD\u10F0\u10DD\u10DA\u10E3\u10E0\u10D8 \u10D8\u10DC\u10E2\u10DD\u10E5\u10E1\u10D8\u10D9\u10D0\u10EA\u10D8\u10D0",
    "\u10DB\u10EC\u10DD\u10DA\u10D8\u10D0\u10E0\u10D4 \u10DE\u10D0\u10EA\u10D8\u10D4\u10DC\u10E2\u10D8\u10D0(\u10D3\u10D4\u10DB\u10D4\u10DC\u10EA\u10D8\u10D0, \u10D4\u10DC\u10EA\u10D4\u10E4\u10D0\u10DA\u10DD\u10DE\u10D0\u10D7\u10D8\u10D0)",
    "\u10E1\u10D0\u10ED\u10D8\u10E0\u10DD \u10D9\u10D5\u10DA\u10D4\u10D5\u10D0 \u10D0\u10DC \u10E1\u10D4\u10E0\u10D5\u10D8\u10E1\u10D8 \u10DB\u10D8\u10E3\u10EC\u10D5\u10D3\u10DD\u10DB\u10D4\u10DA\u10D8\u10D0",
    "\u10E1\u10EE\u10D5\u10D0"
  ].map((name) => ({
    id: generateId(),
    name,
    isActive: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }));
  for (const r of defaultReasons) {
    batch.set(db.collection("refusalReasons").doc(r.id), r);
  }
  const adminUser = {
    id: generateId(),
    firstName: "\u10E1\u10D8\u10E1\u10E2\u10D4\u10DB\u10D8\u10E1",
    lastName: "\u10D0\u10D3\u10DB\u10D8\u10DC\u10D8\u10E1\u10E2\u10E0\u10D0\u10E2\u10DD\u10E0\u10D8",
    username: "admin",
    usernameLower: "admin",
    role: "admin",
    status: "active",
    passwordHash: hashPassword("Admin12345"),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const doctorUser = {
    id: generateId(),
    firstName: "\u10D2\u10D8\u10DD\u10E0\u10D2\u10D8",
    lastName: "\u10D4\u10E5\u10D8\u10DB\u10D8",
    username: "doctor",
    usernameLower: "doctor",
    role: "doctor",
    status: "active",
    passwordHash: hashPassword("Doctor12345"),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  batch.set(db.collection("users").doc(adminUser.id), adminUser);
  batch.set(db.collection("users").doc(doctorUser.id), doctorUser);
  await batch.commit();
  console.log("[Server] Default data seeded.");
}
async function authenticateToken(req, res, next) {
  if (!dbCheck(res)) return;
  const token = (req.headers["authorization"] || "").split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "\u10D0\u10D5\u10E2\u10DD\u10E0\u10D8\u10D6\u10D0\u10EA\u10D8\u10D0 \u10D0\u10E3\u10EA\u10D8\u10DA\u10D4\u10D1\u10D4\u10DA\u10D8\u10D0" });
    return;
  }
  const user = await getUserById(token);
  if (!user) {
    res.status(401).json({ error: "\u10E1\u10D4\u10E1\u10D8\u10D0 \u10D5\u10D0\u10D3\u10D0\u10D2\u10D0\u10E1\u10E3\u10DA\u10D8\u10D0" });
    return;
  }
  if (user.status === "inactive") {
    res.status(403).json({ error: "\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10D4\u10DA\u10D8 \u10D3\u10D4\u10D0\u10E5\u10E2\u10D8\u10D5\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8\u10D0" });
    return;
  }
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "\u10EC\u10D5\u10D3\u10DD\u10DB\u10D0 \u10E3\u10D0\u10E0\u10E7\u10DD\u10E4\u10D8\u10DA\u10D8\u10D0: \u10DB\u10EE\u10DD\u10DA\u10DD\u10D3 \u10D0\u10D3\u10DB\u10D8\u10DC\u10D8\u10E1\u10E2\u10E0\u10D0\u10E2\u10DD\u10E0\u10D4\u10D1\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1" });
    return;
  }
  next();
}
app.post("/api/auth/login", async (req, res) => {
  if (!dbCheck(res)) return;
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "\u10D2\u10D7\u10EE\u10DD\u10D5\u10D7 \u10E8\u10D4\u10D0\u10D5\u10E1\u10DD\u10D7 \u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10DA\u10D8\u10E1 \u10E1\u10D0\u10EE\u10D4\u10DA\u10D8 \u10D3\u10D0 \u10DE\u10D0\u10E0\u10DD\u10DA\u10D8" });
      return;
    }
    const user = await getUserByUsername(username);
    if (!user || user.passwordHash !== hashPassword(password)) {
      res.status(400).json({ error: "\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10DA\u10D8\u10E1 \u10E1\u10D0\u10EE\u10D4\u10DA\u10D8 \u10D0\u10DC \u10DE\u10D0\u10E0\u10DD\u10DA\u10D8 \u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8\u10D0" });
      return;
    }
    if (user.status === "inactive") {
      res.status(403).json({ error: "\u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8 \u10D3\u10D4\u10D0\u10E5\u10E2\u10D8\u10D5\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8\u10D0" });
      return;
    }
    await db.collection("users").doc(user.id).update({ lastLoginAt: (/* @__PURE__ */ new Date()).toISOString() });
    await logAction(user.id, `${user.firstName} ${user.lastName}`, "\u10E1\u10D8\u10E1\u10E2\u10D4\u10DB\u10D0\u10E8\u10D8 \u10E8\u10D4\u10E1\u10D5\u10DA\u10D0", "user", user.id);
    let firebaseToken = null;
    try {
      if (admin) firebaseToken = await admin.auth().createCustomToken(user.id);
    } catch (_) {
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
        status: user.status
      }
    });
  } catch (err) {
    console.error("[Login]", err);
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  const u = req.user;
  res.json({ id: u.id, firstName: u.firstName, lastName: u.lastName, username: u.username, role: u.role, status: u.status });
});
app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
  if (!dbCheck(res)) return;
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "\u10D2\u10D7\u10EE\u10DD\u10D5\u10D7 \u10E8\u10D4\u10D0\u10D5\u10E1\u10DD\u10D7 \u10E7\u10D5\u10D4\u10DA\u10D0 \u10D5\u10D4\u10DA\u10D8" });
      return;
    }
    if (user.passwordHash !== hashPassword(currentPassword)) {
      res.status(400).json({ error: "\u10DB\u10D8\u10DB\u10D3\u10D8\u10DC\u10D0\u10E0\u10D4 \u10DE\u10D0\u10E0\u10DD\u10DA\u10D8 \u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8\u10D0" });
      return;
    }
    await db.collection("users").doc(user.id).update({
      passwordHash: hashPassword(newPassword),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await logAction(user.id, `${user.firstName} ${user.lastName}`, "\u10E1\u10D0\u10D9\u10E3\u10D7\u10D0\u10E0\u10D8 \u10DE\u10D0\u10E0\u10DD\u10DA\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D5\u10DA\u10D0", "user", user.id);
    res.json({ message: "\u10DE\u10D0\u10E0\u10DD\u10DA\u10D8 \u10EC\u10D0\u10E0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D8\u10D7 \u10E8\u10D4\u10D8\u10EA\u10D5\u10D0\u10DA\u10D0" });
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.get("/api/refusals", authenticateToken, async (req, res) => {
  try {
    const snap = await db.collection("refusals").orderBy("createdAt", "desc").get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.post("/api/refusals", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { patientIdentifier, diagnosis, refusalReason, refusalReasonCustom, comment, hospitalizationOperator, ambulanceInfo, shiftType, refusalDate, refusalTime } = req.body;
    if (!diagnosis || !refusalReason || !refusalDate || !refusalTime) {
      res.status(400).json({ error: "\u10E1\u10D0\u10D5\u10D0\u10DA\u10D3\u10D4\u10D1\u10E3\u10DA\u10DD \u10D5\u10D4\u10DA\u10D4\u10D1\u10D8 \u10E8\u10D4\u10D0\u10D5\u10E1\u10D4\u10D7 (\u10D3\u10D8\u10D0\u10D2\u10DC\u10DD\u10D6\u10D8, \u10DB\u10D8\u10D6\u10D4\u10D6\u10D8, \u10D7\u10D0\u10E0\u10D8\u10E6\u10D8, \u10D3\u10E0\u10DD)" });
      return;
    }
    const id = generateId();
    const newRefusal = {
      id,
      doctorId: user.id,
      doctorFullNameSnapshot: `${user.firstName} ${user.lastName}`,
      patientIdentifier: patientIdentifier || "",
      diagnosis,
      refusalReason,
      refusalReasonCustom: refusalReason === "\u10E1\u10EE\u10D5\u10D0" ? refusalReasonCustom || "" : void 0,
      comment: comment || "",
      hospitalizationOperator: hospitalizationOperator || "",
      ambulanceInfo: ambulanceInfo || "",
      shiftType: shiftType || "other",
      refusalDate,
      refusalTime,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: user.id,
      updatedBy: user.id
    };
    await db.collection("refusals").doc(id).set(newRefusal);
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `\u10D0\u10EE\u10D0\u10DA\u10D8 \u10E3\u10D0\u10E0\u10D8\u10E1 \u10D3\u10D0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D0 (${diagnosis.substring(0, 30)})`, "refusal", id, null, newRefusal);
    res.status(201).json(newRefusal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.put("/api/refusals/:id", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { patientIdentifier, diagnosis, refusalReason, refusalReasonCustom, comment, hospitalizationOperator, ambulanceInfo, shiftType, refusalDate, refusalTime } = req.body;
    const doc = await db.collection("refusals").doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "\u10E9\u10D0\u10DC\u10D0\u10EC\u10D4\u10E0\u10D8 \u10D5\u10D4\u10E0 \u10DB\u10DD\u10D8\u10EB\u10D4\u10D1\u10DC\u10D0" });
      return;
    }
    const oldRefusal = { id: doc.id, ...doc.data() };
    if (user.role !== "admin" && oldRefusal.doctorId !== user.id) {
      res.status(403).json({ error: "\u10E1\u10EE\u10D5\u10D0 \u10D4\u10E5\u10D8\u10DB\u10D8\u10E1 \u10E9\u10D0\u10DC\u10D0\u10EC\u10D4\u10E0\u10D8\u10E1 \u10E0\u10D4\u10D3\u10D0\u10E5\u10E2\u10D8\u10E0\u10D4\u10D1\u10D0 \u10DB\u10EE\u10DD\u10DA\u10DD\u10D3 \u10D0\u10D3\u10DB\u10D8\u10DC\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1\u10D0\u10D0" });
      return;
    }
    if (!diagnosis || !refusalReason || !refusalDate || !refusalTime) {
      res.status(400).json({ error: "\u10E1\u10D0\u10D5\u10D0\u10DA\u10D3\u10D4\u10D1\u10E3\u10DA\u10DD \u10D5\u10D4\u10DA\u10D4\u10D1\u10D8 \u10E8\u10D4\u10D0\u10D5\u10E1\u10D4\u10D7" });
      return;
    }
    const updated = {
      ...oldRefusal,
      patientIdentifier: patientIdentifier || "",
      diagnosis,
      refusalReason,
      refusalReasonCustom: refusalReason === "\u10E1\u10EE\u10D5\u10D0" ? refusalReasonCustom || "" : void 0,
      comment: comment || "",
      hospitalizationOperator: hospitalizationOperator || "",
      ambulanceInfo: ambulanceInfo || "",
      shiftType: shiftType || "other",
      refusalDate,
      refusalTime,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: user.id
    };
    await db.collection("refusals").doc(id).set(updated);
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `\u10E3\u10D0\u10E0\u10D8\u10E1 \u10E0\u10D4\u10D3\u10D0\u10E5\u10E2\u10D8\u10E0\u10D4\u10D1\u10D0 (ID: ${id})`, "refusal", id, oldRefusal, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.delete("/api/refusals/:id", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const doc = await db.collection("refusals").doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "\u10E9\u10D0\u10DC\u10D0\u10EC\u10D4\u10E0\u10D8 \u10D5\u10D4\u10E0 \u10DB\u10DD\u10D8\u10EB\u10D4\u10D1\u10DC\u10D0" });
      return;
    }
    const old = { id: doc.id, ...doc.data() };
    if (user.role !== "admin" && old.doctorId !== user.id) {
      res.status(403).json({ error: "\u10E1\u10EE\u10D5\u10D8\u10E1\u10D8 \u10E9\u10D0\u10DC\u10D0\u10EC\u10D4\u10E0\u10D8\u10E1 \u10EC\u10D0\u10E8\u10DA\u10D8\u10E1 \u10E3\u10E4\u10DA\u10D4\u10D1\u10D0 \u10D0\u10E0 \u10D2\u10D0\u10E5\u10D5\u10D7!" });
      return;
    }
    await db.collection("refusals").doc(id).delete();
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `\u10E3\u10D0\u10E0\u10D8\u10E1 \u10EC\u10D0\u10E8\u10DA\u10D0 (${old.patientIdentifier || "\u10E3\u10EA\u10DC\u10DD\u10D1\u10D8"}, ${old.diagnosis})`, "refusal", id, old, null);
    res.json({ message: "\u10E9\u10D0\u10DC\u10D0\u10EC\u10D4\u10E0\u10D8 \u10EC\u10D0\u10E0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D8\u10D7 \u10EC\u10D0\u10D8\u10E8\u10D0\u10DA\u10D0" });
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.get("/api/reasons", authenticateToken, async (req, res) => {
  try {
    const snap = await db.collection("refusalReasons").orderBy("createdAt", "asc").get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.post("/api/reasons", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "\u10D3\u10D0\u10E1\u10D0\u10EE\u10D4\u10DA\u10D4\u10D1\u10D0 \u10D0\u10E3\u10EA\u10D8\u10DA\u10D4\u10D1\u10D4\u10DA\u10D8\u10D0" });
      return;
    }
    const existing = await db.collection("refusalReasons").where("name", "==", name).limit(1).get();
    if (!existing.empty) {
      res.status(400).json({ error: "\u10D4\u10E1 \u10DB\u10D8\u10D6\u10D4\u10D6\u10D8 \u10E3\u10D9\u10D5\u10D4 \u10D0\u10E0\u10E1\u10D4\u10D1\u10DD\u10D1\u10E1" });
      return;
    }
    const id = generateId();
    const r = { id, name, isActive: true, createdAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await db.collection("refusalReasons").doc(id).set(r);
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `\u10D0\u10EE\u10D0\u10DA\u10D8 \u10DB\u10D8\u10D6\u10D4\u10D6\u10D8\u10E1 \u10D3\u10D0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D0: ${name}`, "reason", id, null, r);
    res.status(201).json(r);
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.put("/api/reasons/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { name, isActive } = req.body;
    const doc = await db.collection("refusalReasons").doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "\u10DB\u10D8\u10D6\u10D4\u10D6\u10D8 \u10D5\u10D4\u10E0 \u10DB\u10DD\u10D8\u10EB\u10D4\u10D1\u10DC\u10D0" });
      return;
    }
    const old = { id: doc.id, ...doc.data() };
    const updated = {
      ...old,
      name: name !== void 0 ? name : old.name,
      isActive: isActive !== void 0 ? isActive : old.isActive,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await db.collection("refusalReasons").doc(id).set(updated);
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `\u10DB\u10D8\u10D6\u10D4\u10D6\u10D8\u10E1 \u10EA\u10D5\u10DA\u10D8\u10DA\u10D4\u10D1\u10D0 (ID: ${id})`, "reason", id, old, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.delete("/api/reasons/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const doc = await db.collection("refusalReasons").doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "\u10DB\u10D8\u10D6\u10D4\u10D6\u10D8 \u10D5\u10D4\u10E0 \u10DB\u10DD\u10D8\u10EB\u10D4\u10D1\u10DC\u10D0" });
      return;
    }
    const old = { id: doc.id, ...doc.data() };
    await db.collection("refusalReasons").doc(id).delete();
    await logAction(user.id, `${user.firstName} ${user.lastName}`, `\u10DB\u10D8\u10D6\u10D4\u10D6\u10D8\u10E1 \u10EC\u10D0\u10E8\u10DA\u10D0: ${old.name}`, "reason", id, old, null);
    res.json({ message: "\u10DB\u10D8\u10D6\u10D4\u10D6\u10D8 \u10EC\u10D0\u10E0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D8\u10D7 \u10EC\u10D0\u10D8\u10E8\u10D0\u10DA\u10D0" });
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.get("/api/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("users").orderBy("createdAt", "asc").get();
    res.json(snap.docs.map((d) => {
      const { passwordHash: _p, usernameLower: _u, ...safe } = d.data();
      return { id: d.id, ...safe };
    }));
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.post("/api/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const admin_ = req.user;
    const { firstName, lastName, username, email, password, role, status } = req.body;
    if (!firstName || !lastName || !username || !password || !role) {
      res.status(400).json({ error: "\u10D2\u10D7\u10EE\u10DD\u10D5\u10D7 \u10E8\u10D4\u10D0\u10D5\u10E1\u10DD\u10D7 \u10E7\u10D5\u10D4\u10DA\u10D0 \u10E1\u10D0\u10D5\u10D0\u10DA\u10D3\u10D4\u10D1\u10E3\u10DA\u10DD \u10D5\u10D4\u10DA\u10D8" });
      return;
    }
    const ex = await db.collection("users").where("usernameLower", "==", username.toLowerCase()).limit(1).get();
    if (!ex.empty) {
      res.status(400).json({ error: "\u10D4\u10E1 \u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10DA\u10D8\u10E1 \u10E1\u10D0\u10EE\u10D4\u10DA\u10D8 \u10E3\u10D9\u10D5\u10D4 \u10D3\u10D0\u10D9\u10D0\u10D5\u10D4\u10D1\u10E3\u10DA\u10D8\u10D0" });
      return;
    }
    const id = generateId();
    const u = { id, firstName, lastName, username, usernameLower: username.toLowerCase(), email: email || "", role, status: status || "active", passwordHash: hashPassword(password), createdAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await db.collection("users").doc(id).set(u);
    await logAction(admin_.id, `${admin_.firstName} ${admin_.lastName}`, `\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10DA\u10D8\u10E1 \u10D3\u10D0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D0: ${firstName} ${lastName} (${username})`, "user", id, null, { id, username, role, status });
    const { passwordHash: _p, usernameLower: _u, ...safe } = u;
    res.status(201).json(safe);
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.put("/api/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const adminUser = req.user;
    const { id } = req.params;
    const { firstName, lastName, username, email, role, status } = req.body;
    const doc = await db.collection("users").doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10D4\u10DA\u10D8 \u10D5\u10D4\u10E0 \u10DB\u10DD\u10D8\u10EB\u10D4\u10D1\u10DC\u10D0" });
      return;
    }
    const old = { id: doc.id, ...doc.data() };
    if (adminUser.id === id && (status === "inactive" || role === "doctor")) {
      res.status(400).json({ error: "\u10D0\u10E0 \u10E8\u10D4\u10D2\u10D8\u10EB\u10DA\u10D8\u10D0\u10D7 \u10E1\u10D0\u10D9\u10E3\u10D7\u10D0\u10E0 \u10D7\u10D0\u10D5\u10D6\u10D4 \u10E1\u10E2\u10D0\u10E2\u10E3\u10E1\u10D8\u10E1/\u10E0\u10DD\u10DA\u10D8\u10E1 \u10D0\u10DB\u10D2\u10D5\u10D0\u10E0\u10D0\u10D3 \u10E8\u10D4\u10EA\u10D5\u10DA\u10D0" });
      return;
    }
    if (username && username.toLowerCase() !== old.usernameLower) {
      const ex = await db.collection("users").where("usernameLower", "==", username.toLowerCase()).limit(1).get();
      if (!ex.empty && ex.docs[0].id !== id) {
        res.status(400).json({ error: "\u10D4\u10E1 \u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10DA\u10D8\u10E1 \u10E1\u10D0\u10EE\u10D4\u10DA\u10D8 \u10E3\u10D9\u10D5\u10D4 \u10D3\u10D0\u10D9\u10D0\u10D5\u10D4\u10D1\u10E3\u10DA\u10D8\u10D0" });
        return;
      }
    }
    const upd = {
      firstName: firstName || old.firstName,
      lastName: lastName || old.lastName,
      username: username || old.username,
      usernameLower: (username || old.username).toLowerCase(),
      email: email !== void 0 ? email : old.email,
      role: role || old.role,
      status: status || old.status,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await db.collection("users").doc(id).update(upd);
    await logAction(adminUser.id, `${adminUser.firstName} ${adminUser.lastName}`, `\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10DA\u10D8\u10E1 \u10E0\u10D4\u10D3\u10D0\u10E5\u10E2\u10D8\u10E0\u10D4\u10D1\u10D0: ${upd.username}`, "user", id);
    const { passwordHash: _p, usernameLower: _u, ...safe } = { ...old, ...upd, id };
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.post("/api/users/:id/reset-password", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const adminUser = req.user;
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) {
      res.status(400).json({ error: "\u10D0\u10EE\u10D0\u10DA\u10D8 \u10DE\u10D0\u10E0\u10DD\u10DA\u10D8\u10E1 \u10D5\u10D4\u10DA\u10D8 \u10EA\u10D0\u10E0\u10D8\u10D4\u10DA\u10D8\u10D0" });
      return;
    }
    const doc = await db.collection("users").doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10D4\u10DA\u10D8 \u10D5\u10D4\u10E0 \u10DB\u10DD\u10D8\u10EB\u10D4\u10D1\u10DC\u10D0" });
      return;
    }
    const u = doc.data();
    await db.collection("users").doc(id).update({ passwordHash: hashPassword(newPassword), updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    await logAction(adminUser.id, `${adminUser.firstName} ${adminUser.lastName}`, `\u10DE\u10D0\u10E0\u10DD\u10DA\u10D8\u10E1 \u10D0\u10E6\u10D3\u10D2\u10D4\u10DC\u10D0: ${u.username}`, "user", id);
    res.json({ message: "\u10DE\u10D0\u10E0\u10DD\u10DA\u10D8 \u10EC\u10D0\u10E0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D8\u10D7 \u10E8\u10D4\u10D8\u10EA\u10D5\u10D0\u10DA\u10D0!" });
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.delete("/api/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const adminUser = req.user;
    const { id } = req.params;
    if (adminUser.id === id) {
      res.status(400).json({ error: "\u10E1\u10D0\u10D9\u10E3\u10D7\u10D0\u10E0 \u10D7\u10D0\u10D5\u10E1 \u10D5\u10D4\u10E0 \u10EC\u10D0\u10E8\u10DA\u10D8\u10D7" });
      return;
    }
    const doc = await db.collection("users").doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10D4\u10DA\u10D8 \u10D5\u10D4\u10E0 \u10DB\u10DD\u10D8\u10EB\u10D4\u10D1\u10DC\u10D0" });
      return;
    }
    const u = doc.data();
    await db.collection("users").doc(id).delete();
    await logAction(adminUser.id, `${adminUser.firstName} ${adminUser.lastName}`, `\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10DA\u10D8\u10E1 \u10EC\u10D0\u10E8\u10DA\u10D0: ${u.firstName} ${u.lastName} (${u.username})`, "user", id);
    res.json({ message: "\u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10D4\u10DA\u10D8 \u10EC\u10D0\u10E0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D8\u10D7 \u10EC\u10D0\u10D8\u10E8\u10D0\u10DA\u10D0" });
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.get("/api/audit-logs", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("auditLogs").orderBy("createdAt", "desc").limit(500).get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
app.get("/api/stats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("refusals").orderBy("createdAt", "desc").get();
    const refusals = snap.docs.map((d) => d.data());
    const total = refusals.length;
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const monthStr = todayStr.substring(0, 7);
    const todayCount = refusals.filter((r) => r.refusalDate === todayStr).length;
    const monthCount = refusals.filter((r) => r.refusalDate.startsWith(monthStr)).length;
    const doctorCounts = {};
    refusals.forEach((r) => {
      doctorCounts[r.doctorFullNameSnapshot] = (doctorCounts[r.doctorFullNameSnapshot] || 0) + 1;
    });
    const topDoctors = Object.entries(doctorCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const reasonCounts = {};
    refusals.forEach((r) => {
      const label = r.refusalReason === "\u10E1\u10EE\u10D5\u10D0" ? `\u10E1\u10EE\u10D5\u10D0: ${r.refusalReasonCustom || ""}` : r.refusalReason;
      reasonCounts[label] = (reasonCounts[label] || 0) + 1;
    });
    const topReasons = Object.entries(reasonCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const diagnosisCounts = {};
    refusals.forEach((r) => {
      const d = r.diagnosis.trim();
      diagnosisCounts[d] = (diagnosisCounts[d] || 0) + 1;
    });
    const topDiagnoses = Object.entries(diagnosisCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    const shiftCounts = { day: 0, night: 0, other: 0 };
    refusals.forEach((r) => {
      shiftCounts[r.shiftType in shiftCounts ? r.shiftType : "other"]++;
    });
    const dateCounts = {};
    refusals.forEach((r) => {
      dateCounts[r.refusalDate] = (dateCounts[r.refusalDate] || 0) + 1;
    });
    const dailyHistory = Object.entries(dateCounts).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
    res.json({ total, todayCount, monthCount, topDoctors, topReasons, topDiagnoses, shiftCounts, dailyHistory });
  } catch (err) {
    res.status(500).json({ error: "\u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D0" });
  }
});
async function initServer() {
  await initFirebaseAdmin();
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => res.sendFile(import_path.default.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`[Server] 112 Emergency Refusals running at http://0.0.0.0:${PORT}`);
    if (firebaseReady) await seedIfEmpty();
  });
}
initServer();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  gemini
});
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
