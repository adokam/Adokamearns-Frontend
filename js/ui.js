// ============================================================
//  ui.js — Navigation, dashboard, activation gate, toast
// ============================================================

import { handleLogout } from "./auth.js";
import { loadTasks, setTaskFilter, closeTaskModal, handleTaskSubmit } from "./tasks.js";
import { submitActivationPayment } from "./db.js";

let currentUser  = null;
let bonusClaimed = false;
let toastTimer   = null;
let notifOpen    = false;

// ════════════════════════════════════════════════════════
//  ACTIVATION GATE
//  Shown when user is unpaid or pending
// ════════════════════════════════════════════════════════
export function showActivationGate({ firebaseUser, profile, status }) {
  currentUser = { firebaseUser, profile };

  const name = profile?.firstName || "there";

  // Update name on activation page
  const nameEl = document.getElementById("activation-name");
  if (nameEl) nameEl.textContent = name;

  // Show correct state based on status
  const unpaidSection  = document.getElementById("activation-unpaid");
  const pendingSection = document.getElementById("activation-pending");

  if (status === "pending") {
    // Already submitted, waiting for admin
    if (unpaidSection)  unpaidSection.style.display  = "none";
    if (pendingSection) pendingSection.style.display = "block";
  } else {
    // Has not paid yet
    if (unpaidSection)  unpaidSection.style.display  = "block";
    if (pendingSection) pendingSection.style.display = "none";
  }

  // Wire the "I Have Sent The Money" button
  const submitBtn = document.getElementById("activation-submit-btn");
  if (submitBtn) {
    submitBtn.onclick = () => handleActivationSubmit(firebaseUser.uid);
  }

  // Wire logout on activation page
  const logoutBtn = document.getElementById("activation-logout-btn");
  if (logoutBtn) {
    logoutBtn.onclick = handleLogout;
  }
}

async function handleActivationSubmit(uid) {
  const btn = document.getElementById("activation-submit-btn");
  btn.disabled    = true;
  btn.textContent = "Submitting…";

  try {
    await submitActivationPayment(uid);

    // Switch to pending view
    document.getElementById("activation-unpaid").style.display  = "none";
    document.getElementById("activation-pending").style.display = "block";
    showToast("✅ Payment submitted! Waiting for admin approval.", "green");
  } catch (err) {
    showToast("❌ Failed to submit. Try again.", "crimson");
    btn.disabled    = false;
    btn.textContent = "✅ I Have Sent The Money";
  }
}

// ════════════════════════════════════════════════════════
//  BOOT APP (only called when user is fully active)
// ════════════════════════════════════════════════════════
export function initApp({ firebaseUser, profile }) {
  currentUser = { firebaseUser, profile };

  const firstName = profile?.firstName || firebaseUser.email.split("@")[0];
  const lastName  = profile?.lastName  || "";
  const fullName  = (firstName + " " + lastName).trim();
  const initials  = (firstName[0] || "U") + (lastName[0] || "");

  // Sidebar
  setEl("sidebar-avatar", initials.toUpperCase());
  setEl("sidebar-name",   fullName);

  // Topbar
  setEl("topbar-name", firstName);

  // Profile page
  setEl("profile-avatar",        initials.toUpperCase());
  setEl("profile-fullname",      fullName);
  setEl("profile-email-display", firebaseUser.email);
  setEl("pf-name",               fullName);
  setEl("pf-email",              firebaseUser.email);
  setEl("pf-refcode",            profile?.referralCode || "—");

  // Referral
  setEl("ref-code-display",   profile?.referralCode || "—");
  setEl("ref-link-val-text",  `adokamaearns.com/invite/${profile?.referralCode || "—"}`);

  // Balance
  renderBalance(profile?.balance || 0);

  // Go to dashboard tab by default
  showTab("dashboard");

  // Bind all nav + modal events
  bindNav();
  bindTaskModal();

  // Daily bonus popup
  if (!bonusClaimed) {
    setTimeout(() => openBonusModal(), 900);
  }
}

export function destroyApp() {
  currentUser  = null;
  bonusClaimed = false;
}

// ════════════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════════════
const TAB_META = {
  dashboard: { title: "Dashboard",  sub: "Your earnings overview" },
  tasks:     { title: "Tasks",      sub: "Complete tasks to earn ₦100 each" },
  referrals: { title: "Referrals",  sub: "Earn ₦500 per friend you invite" },
  withdraw:  { title: "Withdraw",   sub: "Withdrawals coming soon" },
  profile:   { title: "Profile",    sub: "Your account details" },
};

export function showTab(tab) {
  document.querySelectorAll(".inner-page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById("tab-" + tab);
  if (page) page.classList.add("active");

  document.querySelectorAll(".nav-item[data-tab]").forEach(n => {
    n.classList.toggle("active", n.dataset.tab === tab);
  });

  const meta = TAB_META[tab] || {};
  setEl("topbar-title", meta.title || tab);
  setEl("topbar-sub",   meta.sub   || "");

  // Load tasks when tab opens
  if (tab === "tasks" && currentUser) {
    loadTasks(currentUser.firebaseUser.uid);
  }
}

function bindNav() {
  document.querySelectorAll(".nav-item[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  document.getElementById("logout-btn")
    ?.addEventListener("click", handleLogout);
  document.getElementById("notif-btn")
    ?.addEventListener("click", () => toggleNotif());
  document.getElementById("daily-bonus-btn")
    ?.addEventListener("click", openBonusModal);
  document.getElementById("copy-ref-btn")
    ?.addEventListener("click", copyRefLink);

  // Close notif popup on outside click
  document.addEventListener("click", e => {
    if (!notifOpen) return;
    const popup = document.getElementById("notif-popup");
    const btn   = document.getElementById("notif-btn");
    if (popup && !popup.contains(e.target) && !btn?.contains(e.target)) {
      toggleNotif(false);
    }
  });
}

function bindTaskModal() {
  document.getElementById("task-modal-close")
    ?.addEventListener("click", closeTaskModal);
  document.getElementById("task-submit-btn")
    ?.addEventListener("click", handleTaskSubmit);

  document.querySelectorAll(".filter-btn[data-filter]").forEach(btn => {
    btn.addEventListener("click", () => setTaskFilter(btn.dataset.filter, btn));
  });
}

// ════════════════════════════════════════════════════════
//  BALANCE
// ════════════════════════════════════════════════════════
function renderBalance(balance) {
  const fmt = Number(balance).toLocaleString("en-NG");
  setEl("bal-display",         "₦" + fmt);
  setEl("withdraw-bal-amount", "₦" + fmt);
  setEl("profile-balance",     "₦" + fmt);

  const min    = 5000;
  const needed = Math.max(0, min - balance);
  const el     = document.getElementById("withdraw-min-notice");
  if (el) {
    el.innerHTML = balance >= min
      ? `✅ Balance eligible. Note: <strong>withdrawals are coming soon.</strong>`
      : `⚠️ Minimum is <strong>₦5,000.</strong> You need <strong>₦${needed.toLocaleString()} more.</strong>`;
  }
}

// ════════════════════════════════════════════════════════
//  BONUS MODAL
// ════════════════════════════════════════════════════════
function openBonusModal() {
  document.getElementById("bonus-modal")?.classList.add("open");
}

window.claimBonus = function () {
  document.getElementById("bonus-modal")?.classList.remove("open");
  bonusClaimed = true;
  showToast("🎉 ₦50 daily bonus added! Keep your streak.", "green");
};

window.closeBonusModal = function () {
  document.getElementById("bonus-modal")?.classList.remove("open");
};

// ════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════════════════════════
function toggleNotif(force) {
  notifOpen = typeof force === "boolean" ? force : !notifOpen;
  document.getElementById("notif-popup")?.classList.toggle("open", notifOpen);
}

// ════════════════════════════════════════════════════════
//  REFERRAL COPY
// ════════════════════════════════════════════════════════
function copyRefLink() {
  const val = document.getElementById("ref-link-val-text")?.textContent || "";
  navigator.clipboard.writeText(val)
    .then(() => showToast("📋 Referral link copied!", "green"))
    .catch(() => showToast("📋 Copy your link manually.", ""));
}

// ════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════
export function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toast-msg");
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.className   = "toast " + type;
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

// ════════════════════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════════════════════
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
