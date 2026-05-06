// ============================================================
//  db.js — Firebase config + all Firestore/Auth functions
//  Replace the firebaseConfig values with your own from:
//  Firebase Console → Project Settings → Your Apps → SDK setup
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
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── REPLACE THESE WITH YOUR REAL FIREBASE CONFIG ───────────
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD3UEVt8QwB6zzNklSSRbvWY6TK_WETsXY",
  authDomain: "adokamaearns.firebaseapp.com",
  projectId: "adokamaearns",
  storageBucket: "adokamaearns.firebasestorage.app",
  messagingSenderId: "319442922783",
  appId: "1:319442922783:web:bc9698c1d8768928d3542a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// ─────────────────────────────────────────────────────────────

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db   = getFirestore(firebaseApp);

// ── BACKEND API BASE (your Node.js server) ───────────────────
// When running locally: "http://localhost:3000"
// When deployed:        "https://your-backend-url.com"
export const API_BASE = "http://localhost:3000";

// ────────────────────────────────────────────────────────────
//  AUTH FUNCTIONS
// ────────────────────────────────────────────────────────────

/**
 * Register a new user.
 * Creates Firebase Auth account, then calls backend /register
 * to write the Firestore user document.
 */
export async function registerUser({ firstName, lastName, email, password, referredBy }) {
  // 1. Create Firebase Auth account
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  // 2. Generate a referral code for this user
  const referralCode = "ADK-" + Math.random().toString(36).substring(2, 7).toUpperCase();

  // 3. Write user record to Firestore via backend
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, email, firstName, lastName, referralCode, referredBy: referredBy || null })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Registration failed");
  }

  return credential.user;
}

/**
 * Log in an existing user with email + password.
 */
export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Log out the current user.
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Listen for auth state changes.
 * Calls callback(user) when state changes — user is null when logged out.
 */
export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}

// ────────────────────────────────────────────────────────────
//  USER FUNCTIONS
// ────────────────────────────────────────────────────────────

/**
 * Fetch user profile from Firestore via backend.
 * Returns the user object or null.
 */
export async function fetchUser(uid) {
  const res = await fetch(`${API_BASE}/user/${uid}`);
  if (!res.ok) return null;
  return await res.json();
}

// ────────────────────────────────────────────────────────────
//  TASK FUNCTIONS
// ────────────────────────────────────────────────────────────

/**
 * Fetch all active tasks from backend.
 */
export async function fetchTasks() {
  const res = await fetch(`${API_BASE}/tasks`);
  if (!res.ok) throw new Error("Failed to load tasks");
  return await res.json();
}

/**
 * Submit task proof.
 * Returns { success, message } or throws on error/duplicate.
 */
export async function submitTaskProof({ userId, taskId, proof }) {
  const res = await fetch(`${API_BASE}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, taskId, proof })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Submission failed");
  return data;
}

/**
 * Get all submissions by this user (to know which tasks they've done).
 * Reads directly from Firestore client-side.
 */
export async function fetchUserSubmissions(userId) {
  const q = query(
    collection(db, "submissions"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
