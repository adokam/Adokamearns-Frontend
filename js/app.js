// ============================================================
//  app.js — Entry point. Boots auth gate, wires form events.
// ============================================================

import {
  initCaptchas,
  refreshRegCaptcha,
  refreshLoginCaptcha,
  verifyRegCaptcha,
  verifyLoginCaptcha,
  showLoginPanel,
  showRegisterPanel,
  handleRegister,
  handleLogin,
  initAuthGate
} from "./auth.js";

// Boot Firebase auth listener immediately
initAuthGate();
initCaptchas();

// Auth form buttons
document.getElementById("reg-btn")?.addEventListener("click", handleRegister);
document.getElementById("login-btn")?.addEventListener("click", handleLogin);
document.getElementById("go-login")?.addEventListener("click", showLoginPanel);
document.getElementById("go-register")?.addEventListener("click", showRegisterPanel);

// Captcha buttons
document.getElementById("captcha-refresh-reg")?.addEventListener("click", refreshRegCaptcha);
document.getElementById("captcha-refresh-login")?.addEventListener("click", refreshLoginCaptcha);
document.getElementById("captcha-verify-reg")?.addEventListener("click", verifyRegCaptcha);
document.getElementById("captcha-verify-login")?.addEventListener("click", verifyLoginCaptcha);

// Allow Enter key to submit
document.getElementById("reg-pass")?.addEventListener("keydown",   e => { if (e.key === "Enter") handleRegister(); });
document.getElementById("login-pass")?.addEventListener("keydown",  e => { if (e.key === "Enter") handleLogin(); });
