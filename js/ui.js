// ============================================================
//  ui.js — DOM rendering, navigation, toasts, modals
// ============================================================

import { handleLogout } from "./auth.js";
import { loadTasks, setTaskFilter, closeTaskModal, handleTaskSubmit } from "./tasks.js";

let currentUser    = null; // { firebaseUser, profile }
let bonusClaimed   = false;
let toastTimer     = null;
let notifOpen      = false;

// ────────────────────────────────────────────────────────────
//  BOOT APP
// ────────────────────────────────────────────────────────────
export function initApp({ firebaseUser, profile }) {
  currentUser = { firebaseUser, profile };

  const name    = profile?.firstName || firebaseUser.email.split("@")[0];
  const initial = (profile?.firstName?.[0] || "U") + (profile?.lastName?.[0] || "");

  // Sidebar
  setEl("sidebar-avatar", initial.toUpperCase());
  setEl("sidebar-name",   (profile?.firstName || "") + " " + (profile?.lastName || ""));
  // Topbar
  setEl("topbar-name",    name);
  // Profile page
  setEl("profile-avatar",       initial.toUpperCase());
  setEl("profile-fullname",     (profile?.firstName || "") + " " + (profile?.lastName || ""));
  setEl("profile-email-display",firebaseUser.email);
  setEl("pf-name",  (profile?.firstName || "") + " " + (profile?.lastName || ""));
  setEl("pf-email", firebaseUser.email);
  setEl("pf-refcode", profile?.referralCode || "—");
  setEl("ref-code-display", profile?.referralCode || "—");
  setEl("ref-link-val-text", `adokamaearns.com/invite/${profile?.referralCode || "—"}`);

  // Balance is always read-only (real balance comes from Firestore via profile)
  renderDashboardBalance(profile?.balance || 0);

  // Default tab
  showTab("dashboard");

  // Bind nav
  bindNav();
  bindTaskModal();

  // Bonus modal after small delay
  if (!bonusClaimed) {
    setTimeout(() => openBonusModal(), 900);
  }
}

export function destroyApp() {
  currentUser  = null;
  bonusClaimed = false;
}

// ────────────────────────────────────────────────────────────
//  NAVIGATION
// ────────────────────────────────────────────────────────────
const TAB_META = {
  dashboard: { title: "Dashboard",  sub: "Your earnings overview" },
  tasks:     { title: "Tasks",      sub: "Complete tasks to earn ₦100 each" },
  referrals: { title: "Referrals",  sub: "Earn ₦500 per friend you invite" },
  withdraw:  { title: "Withdraw",   sub: "Withdrawal is coming soon" },
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

  // Lazy-load tasks when tab opens
  if (tab === "tasks" && currentUser) {
    loadTasks(currentUser.firebaseUser.uid);
  }
}

function bindNav() {
  document.querySelectorAll(".nav-item[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });
  document.getElementById("logout-btn")?.addEventListener("click", handleLogout);
  document.getElementById("notif-btn")?.addEventListener("click", toggleNotif);
  document.getElementById("daily-bonus-btn")?.addEventListener("click", openBonusModal);

  // Ref copy
  document.getElementById("copy-ref-btn")?.addEventListener("click", copyRefLink);

  // Close notif on outside click
  document.addEventListener("click", e => {
    if (notifOpen) {
      const popup = document.getElementById("notif-popup");
      const btn   = document.getElementById("notif-btn");
      if (popup && !popup.contains(e.target) && !btn?.contains(e.target)) {
        toggleNotif(false);
      }
    }
  });
}

function bindTaskModal() {
  document.getElementById("task-modal-close")?.addEventListener("click", closeTaskModal);
  document.getElementById("task-submit-btn")?.addEventListener("click", handleTaskSubmit);

  // Filter buttons
  document.querySelectorAll(".filter-btn[data-filter]").forEach(btn => {
    btn.addEventListener("click", () => setTaskFilter(btn.dataset.filter, btn));
  });
}

// ────────────────────────────────────────────────────────────
//  DASHBOARD
// ────────────────────────────────────────────────────────────
function renderDashboardBalance(balance) {
  const formatted = Number(balance).toLocaleString("en-NG");
  setEl("bal-display",        "₦" + formatted);
  setEl("withdraw-bal-amount","₦" + formatted);
  setEl("profile-balance",    "₦" + formatted);

  const min     = 5000;
  const needed  = Math.max(0, min - balance);
  const noticeEl = document.getElementById("withdraw-min-notice");
  if (noticeEl) {
    if (balance >= min) {
      noticeEl.innerHTML = `✅ You have enough to withdraw. Please note: <strong>withdrawals are coming soon.</strong>`;
    } else {
      noticeEl.innerHTML = `⚠️ Minimum withdrawal is <strong>₦5,000.</strong> You need <strong>₦${needed.toLocaleString()} more.</strong> Keep completing tasks!`;
    }
  }
}

// ────────────────────────────────────────────────────────────
//  BONUS MODAL
// ────────────────────────────────────────────────────────────
function openBonusModal() {
  document.getElementById("bonus-modal")?.classList.add("open");
}

// Exposed to inline onclick in HTML
window.claimBonus = function () {
  document.getElementById("bonus-modal")?.classList.remove("open");
  bonusClaimed = true;
  showToast("🎉 ₦50 daily bonus added! Keep your streak alive.", "green");
};

window.closeBonusModal = function () {
  document.getElementById("bonus-modal")?.classList.remove("open");
};

// ────────────────────────────────────────────────────────────
//  NOTIFICATIONS
// ────────────────────────────────────────────────────────────
function toggleNotif(force) {
  notifOpen = typeof force === "boolean" ? force : !notifOpen;
  document.getElementById("notif-popup")?.classList.toggle("open", notifOpen);
}

// ────────────────────────────────────────────────────────────
//  REFERRAL
// ────────────────────────────────────────────────────────────
function copyRefLink() {
  const val = document.getElementById("ref-link-val-text")?.textContent || "";
  navigator.clipboard.writeText(val).then(() => showToast("📋 Referral link copied!", "green"));
}

// ────────────────────────────────────────────────────────────
//  TOAST
// ────────────────────────────────────────────────────────────
export function showToast(msg, type = "") {
  const toast   = document.getElementById("toast");
  const msgEl   = document.getElementById("toast-msg");
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.className   = "toast " + type;
  void toast.offsetWidth; // reflow
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

// ────────────────────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────────────────────
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
