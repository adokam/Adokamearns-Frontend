// ============================================================
//  tasks.js — Fetch tasks from backend, render, handle submit
// ============================================================

import { fetchTasks, fetchUserSubmissions, submitTaskProof } from "./db.js";
import { showToast } from "./ui.js";

// Platform display config
const PLATFORM_META = {
  Instagram: { icon: "📸", bg: "#fce7f3", label: "Follow Account" },
  YouTube:   { icon: "▶️", bg: "#fee2e2", label: "Subscribe" },
  "X":       { icon: "𝕏",  bg: "#dbeafe", label: "Follow Account" },
  Twitter:   { icon: "𝕏",  bg: "#dbeafe", label: "Follow Account" },
  Snapchat:  { icon: "👻", bg: "#fffbeb", label: "Add & Follow" },
  Telegram:  { icon: "💬", bg: "#e0f2fe", label: "Join Channel" },
  TikTok:    { icon: "🎵", bg: "#f0fdf4", label: "Follow Account" },
  Facebook:  { icon: "👤", bg: "#eff6ff", label: "Like Page" },
  WhatsApp:  { icon: "📱", bg: "#ede9fe", label: "Join Community" },
  Default:   { icon: "🔗", bg: "#f4f4f6", label: "Complete Task" },
};

let allTasks        = [];
let userSubmissions = []; // { taskId, status }
let currentUserId   = null;
let currentFilter   = "all";
let pendingTaskId   = null; // task being confirmed in modal

// ────────────────────────────────────────────────────────────
//  LOAD
// ────────────────────────────────────────────────────────────
export async function loadTasks(userId) {
  currentUserId = userId;

  const grid = document.getElementById("tasks-grid");
  grid.innerHTML = `<div class="tasks-loading">⏳ Loading tasks…</div>`;

  try {
    [allTasks, userSubmissions] = await Promise.all([
      fetchTasks(),
      fetchUserSubmissions(userId)
    ]);
    renderTasks();
  } catch (err) {
    grid.innerHTML = `<div class="tasks-error">⚠️ Could not load tasks. Check your connection and refresh.</div>`;
    console.error(err);
  }
}

// ────────────────────────────────────────────────────────────
//  RENDER
// ────────────────────────────────────────────────────────────
function getSubmission(taskId) {
  return userSubmissions.find(s => s.taskId === taskId) || null;
}

function renderTasks() {
  const grid = document.getElementById("tasks-grid");
  grid.innerHTML = "";

  const filtered = currentFilter === "all"
    ? allTasks
    : allTasks.filter(t => {
        const sub = getSubmission(t.id);
        if (currentFilter === "available") return !sub;
        if (currentFilter === "pending")   return sub && sub.status === "pending";
        if (currentFilter === "done")      return sub && sub.status === "approved";
        return true;
      });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="tasks-empty">No tasks in this category yet.</div>`;
    return;
  }

  filtered.forEach((task, i) => {
    const sub  = getSubmission(task.id);
    const meta = PLATFORM_META[task.platform] || PLATFORM_META.Default;

    let statusClass = "available";
    let badgeHTML   = `<span class="task-badge badge-available">Available</span>`;
    let btnHTML     = `<button class="task-btn task-btn-go" data-taskid="${task.id}">Go to Page →</button>`;

    if (sub) {
      if (sub.status === "pending") {
        statusClass = "pending-review";
        badgeHTML   = `<span class="task-badge badge-pending">Under Review</span>`;
        btnHTML     = `<button class="task-btn task-btn-pending" disabled>⏳ Reviewing…</button>`;
      } else if (sub.status === "approved") {
        statusClass = "completed";
        badgeHTML   = `<span class="task-badge badge-done">✓ Approved</span>`;
        btnHTML     = `<button class="task-btn task-btn-done" disabled>✓ Done</button>`;
      } else if (sub.status === "rejected") {
        statusClass = "available"; // allow resubmit
        badgeHTML   = `<span class="task-badge badge-rejected">✗ Rejected</span>`;
        btnHTML     = `<button class="task-btn task-btn-go" data-taskid="${task.id}">Resubmit →</button>`;
      }
    }

    const card = document.createElement("div");
    card.className   = `task-card ${statusClass} fade-in`;
    card.style.animationDelay = `${i * 0.05}s`;
    card.innerHTML = `
      <div class="task-header">
        <div class="task-platform">
          <div class="platform-icon" style="background:${meta.bg};">${meta.icon}</div>
          <div>
            <div class="task-platform-name">${task.platform}</div>
            <div class="task-platform-type">${meta.label}</div>
          </div>
        </div>
        ${badgeHTML}
      </div>
      <p class="task-desc">${task.title}</p>
      <div class="task-footer">
        <div class="task-reward">
          <span class="amount">₦${Number(task.reward).toLocaleString()}</span>
          <span class="curr">Reward</span>
        </div>
        ${btnHTML}
      </div>`;

    // Attach event to "Go" button
    const btn = card.querySelector("[data-taskid]");
    if (btn) {
      btn.addEventListener("click", () => openTaskModal(task));
    }

    grid.appendChild(card);
  });

  updateProgressBanner();
}

// ────────────────────────────────────────────────────────────
//  FILTER
// ────────────────────────────────────────────────────────────
export function setTaskFilter(filter, btnEl) {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
  renderTasks();
}

// ────────────────────────────────────────────────────────────
//  PROGRESS BANNER
// ────────────────────────────────────────────────────────────
function updateProgressBanner() {
  const done    = userSubmissions.length;
  const goal    = 5;
  const pct     = Math.min(100, Math.round((done / goal) * 100));
  const fill    = document.getElementById("prog-fill");
  const text    = document.getElementById("prog-text");
  const banner  = document.getElementById("progress-banner");

  if (!fill || !text) return;
  fill.style.width = pct + "%";
  text.textContent = `${done} of ${goal} tasks completed this batch`;

  if (done >= goal) {
    banner.querySelector(".progress-reward .reward-label").textContent = "Bonus Unlocked! 🎉";
  }
}

// ────────────────────────────────────────────────────────────
//  TASK MODAL
// ────────────────────────────────────────────────────────────
function openTaskModal(task) {
  pendingTaskId = task.id;
  document.getElementById("task-modal-title").textContent = `${task.platform} Task`;
  document.getElementById("task-modal-desc").textContent  =
    `Follow the link below. Once done, come back and click "I've Done It" to submit for admin review. You'll earn ₦${Number(task.reward).toLocaleString()} once approved.`;
  document.getElementById("task-modal-link").href         = task.link || "#";
  document.getElementById("task-proof-input").value       = "";
  document.getElementById("task-modal").classList.add("open");
}

export function closeTaskModal() {
  document.getElementById("task-modal").classList.remove("open");
  pendingTaskId = null;
}

// ────────────────────────────────────────────────────────────
//  SUBMIT PROOF
// ────────────────────────────────────────────────────────────
export async function handleTaskSubmit() {
  if (!pendingTaskId || !currentUserId) return;

  const proof   = document.getElementById("task-proof-input").value.trim();
  const submitBtn = document.getElementById("task-submit-btn");

  submitBtn.disabled    = true;
  submitBtn.textContent = "Submitting…";

  try {
    await submitTaskProof({ userId: currentUserId, taskId: pendingTaskId, proof });

    // Update local submissions so UI reflects immediately
    userSubmissions.push({ taskId: pendingTaskId, status: "pending" });
    closeTaskModal();
    renderTasks();
    showToast("✅ Submitted! Admin will review within 24 hours.", "green");
  } catch (err) {
    if (err.message === "Already submitted") {
      showToast("⚠️ You already submitted this task.", "orange");
      closeTaskModal();
    } else {
      showToast("❌ Submission failed. Try again.", "crimson");
    }
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = "✅ I've Done It — Submit for Review";
  }
}
