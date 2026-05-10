// ============================================================
//  db.js — Firebase config + all API calls
//  REPLACE the firebaseConfig values with your real ones
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── REPLACE WITH YOUR REAL FIREBASE CONFIG ──────────────────
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
// ─────────────────────────────────────────────────────────────

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db   = getFirestore(firebaseApp);

// ─── YOUR RAILWAY BACKEND URL ─────────────────────────────────
// Change this to your Railway URL after deploying backend
export const API_BASE = "https://YOUR-RAILWAY-URL.up.railway.app";
// ─────────────────────────────────────────────────────────────


// ════════════════════════════════════════════════════════
//  AUTH FUNCTIONS
// ════════════════════════════════════════════════════════

export async function registerUser({ firstName, lastName, email, password, referredBy }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, email, firstName, lastName, referredBy: referredBy || null })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Registration failed');
  }

  return credential.user;
}

export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}


// ════════════════════════════════════════════════════════
//  USER FUNCTIONS
// ════════════════════════════════════════════════════════

export async function fetchUser(uid) {
  const res = await fetch(`${API_BASE}/user/${uid}`);
  if (!res.ok) return null;
  return await res.json();
}


// ════════════════════════════════════════════════════════
//  ACTIVATION PAYMENT
// ════════════════════════════════════════════════════════

/**
 * Called when user clicks "I Have Sent The Money"
 * Saves payment record, sets user status to "pending"
 */
export async function submitActivationPayment(uid) {
  const res = await fetch(`${API_BASE}/activation/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Submission failed');
  return data;
}


// ════════════════════════════════════════════════════════
//  TASK FUNCTIONS
// ════════════════════════════════════════════════════════

export async function fetchTasks() {
  const res = await fetch(`${API_BASE}/tasks`);
  if (!res.ok) throw new Error('Failed to load tasks');
  return await res.json();
}

export async function submitTaskProof({ userId, taskId, proof }) {
  const res = await fetch(`${API_BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, taskId, proof })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Submission failed');
  return data;
}

export async function fetchUserSubmissions(userId) {
  const q = query(
    collection(db, 'submissions'),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
