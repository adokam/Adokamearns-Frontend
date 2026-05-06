// ============================================================
//  auth.js — Registration, login, captcha, auth gate
// ============================================================

import { registerUser, loginUser, logoutUser, onAuthChange, fetchUser } from "./db.js";
import { initApp, destroyApp } from "./ui.js";

// ────────────────────────────────────────────────────────────
//  CAPTCHA ENGINE
// ────────────────────────────────────────────────────────────
const CHARS  = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const COLORS = ["#c0182a","#1d4ed8","#059669","#7c3aed","#b45309","#0369a1","#be185d","#0f766e"];

let captchaReg   = { code: "", verified: false };
let captchaLogin = { code: "", verified: false };

function randomStr(len) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

function renderCaptcha(displayId, state) {
  const el = document.getElementById(displayId);
  if (!el) return;
  state.code     = randomStr(6);
  state.verified = false;
  el.innerHTML   = "";
  [...state.code].forEach((ch, i) => {
    const span = document.createElement("span");
    span.textContent  = ch;
    span.style.color  = COLORS[i % COLORS.length];
    span.style.display      = "inline-block";
    span.style.transform    = `rotate(${(Math.random() - 0.5) * 20}deg) translateY(${(Math.random() - 0.5) * 7}px)`;
    span.style.fontStyle    = Math.random() > 0.5 ? "italic" : "normal";
    span.style.fontWeight   = Math.random() > 0.5 ? "900" : "700";
    span.style.fontSize     = (18 + Math.random() * 6) + "px";
    span.style.letterSpacing = "2px";
    el.appendChild(span);
  });
}

function verifyCaptchaFor(inputId, statusId, state) {
  const input  = document.getElementById(inputId);
  const status = document.getElementById(statusId);
  if (!input || !status) return;

  const entered = input.value.toUpperCase().trim();
  if (entered === state.code) {
    state.verified      = true;
    status.textContent  = "✓ Verified successfully!";
    status.className    = "captcha-status ok";
  } else {
    state.verified      = false;
    status.textContent  = "✗ Wrong code. Try again.";
    status.className    = "captcha-status err";
    input.value         = "";
    renderCaptcha(inputId.replace("input", "display"), state);
  }
}

export function initCaptchas() {
  renderCaptcha("captcha-display",       captchaReg);
  renderCaptcha("login-captcha-display", captchaLogin);
}

export function refreshRegCaptcha()   { renderCaptcha("captcha-display",       captchaReg); }
export function refreshLoginCaptcha() { renderCaptcha("login-captcha-display", captchaLogin); }

export function verifyRegCaptcha()   { verifyCaptchaFor("captcha-input",       "captcha-status",       captchaReg);   }
export function verifyLoginCaptcha() { verifyCaptchaFor("login-captcha-input", "login-captcha-status", captchaLogin); }

// ────────────────────────────────────────────────────────────
//  PANEL SWITCHING
// ────────────────────────────────────────────────────────────
export function showLoginPanel() {
  document.getElementById("register-panel").style.display = "none";
  document.getElementById("login-panel").style.display    = "flex";
}

export function showRegisterPanel() {
  document.getElementById("login-panel").style.display    = "none";
  document.getElementById("register-panel").style.display = "flex";
}

// ────────────────────────────────────────────────────────────
//  REGISTER
// ────────────────────────────────────────────────────────────
export async function handleRegister() {
  if (!captchaReg.verified) {
    return showAuthError("register", "⚠️ Please verify the security code first.");
  }

  const firstName = document.getElementById("reg-fname").value.trim();
  const lastName  = document.getElementById("reg-lname").value.trim();
  const email     = document.getElementById("reg-email").value.trim();
  const phone     = document.getElementById("reg-phone").value.trim();
  const password  = document.getElementById("reg-pass").value;
  const referredBy= document.getElementById("reg-ref").value.trim();

  if (!firstName || !lastName) return showAuthError("register", "⚠️ Enter your full name.");
  if (!email)                  return showAuthError("register", "⚠️ Enter a valid email.");
  if (password.length < 8)    return showAuthError("register", "⚠️ Password must be at least 8 characters.");

  setAuthLoading("register", true);
  try {
    await registerUser({ firstName, lastName, email, password, referredBy });
    // onAuthChange listener in initAuthGate will take it from here
  } catch (err) {
    showAuthError("register", friendlyError(err.code || err.message));
  } finally {
    setAuthLoading("register", false);
  }
}

// ────────────────────────────────────────────────────────────
//  LOGIN
// ────────────────────────────────────────────────────────────
export async function handleLogin() {
  if (!captchaLogin.verified) {
    return showAuthError("login", "⚠️ Please verify the security code first.");
  }

  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-pass").value;

  if (!email || !password) return showAuthError("login", "⚠️ Enter your email and password.");

  setAuthLoading("login", true);
  try {
    await loginUser(email, password);
    // onAuthChange handles redirect
  } catch (err) {
    showAuthError("login", friendlyError(err.code || err.message));
  } finally {
    setAuthLoading("login", false);
  }
}

// ────────────────────────────────────────────────────────────
//  LOGOUT
// ────────────────────────────────────────────────────────────
export async function handleLogout() {
  await logoutUser();
  destroyApp();
  document.getElementById("page-auth").classList.add("active");
  document.getElementById("page-app").classList.remove("active");
  initCaptchas();
}

// ────────────────────────────────────────────────────────────
//  AUTH GATE — watches Firebase auth state
// ────────────────────────────────────────────────────────────
export function initAuthGate() {
  onAuthChange(async (firebaseUser) => {
    if (firebaseUser) {
      // Logged in — fetch full profile then boot app
      const profile = await fetchUser(firebaseUser.uid);
      document.getElementById("page-auth").classList.remove("active");
      document.getElementById("page-app").classList.add("active");
      initApp({ firebaseUser, profile });
    }
  });
}

// ────────────────────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────────────────────
function showAuthError(panel, msg) {
  const id = panel === "login" ? "login-error" : "reg-error";
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "flex";
  setTimeout(() => { el.style.display = "none"; }, 5000);
}

function setAuthLoading(panel, loading) {
  const btnId = panel === "login" ? "login-btn" : "reg-btn";
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading ? "Please wait…" : (panel === "login" ? "Sign In →" : "Create My Account →");
}

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use":  "This email is already registered. Try logging in.",
    "auth/invalid-email":          "Invalid email address.",
    "auth/weak-password":          "Password is too weak. Use at least 8 characters.",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect password. Try again.",
    "auth/too-many-requests":      "Too many attempts. Please wait a moment.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
