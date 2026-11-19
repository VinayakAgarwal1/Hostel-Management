/* =====================================================================
   Hostel Services — front-end controller
   ---------------------------------------------------------------------
   Talks to the Spring Boot REST API (unchanged contract):
     GET  /api/dashboard/stats          GET  /api/users
     GET  /api/departments              GET  /api/categories
     GET  /api/complaints               GET  /api/staff
     GET  /api/staff/performance        GET  /api/complaints/{id}/history
     POST /api/complaints               PATCH /api/complaints/{id}/status
     POST /api/complaints/{id}/assign   POST /api/complaints/{id}/feedback
     POST /api/staff                    POST /api/auth/login
   When the API is unreachable the page falls back to sample records so
   the interface can be demonstrated without a running server.
   ===================================================================== */

const API_BASE = window.location.origin.includes(":8080")
  ? "/api"
  : `${window.location.protocol === "file:" ? "http://localhost:8080" : window.location.origin.replace(/:\d+$/, ":8080")}/api`;

let isBackendLive = false;
let users = [];
let departments = [];
let categories = [];
let complaints = [];
let staffList = [];
let staffPerformance = [];
let dashboardStats = null;
let currentView = "dashboard";

/* Default session — resident student */
let currentUser = {
  userId: 1,
  name: "Aarav Sharma",
  email: "aarav.sharma@example.com",
  roomNumber: "A-101",
  hostelBlock: "Block A",
  role: "STUDENT"
};

/* ---------------------------------------------------------------------
   Offline sample data (mirrors backend seed records for previews)
   --------------------------------------------------------------------- */
const fallbackUsers = [
  { userId: 1, name: "Aarav Sharma", email: "aarav.sharma@example.com", roomNumber: "A-101", hostelBlock: "Block A", role: "STUDENT" },
  { userId: 2, name: "Ananya Iyer", email: "ananya.iyer@example.com", roomNumber: "A-102", hostelBlock: "Block A", role: "STUDENT" },
  { userId: 3, name: "Rohan Verma", email: "rohan.verma@example.com", roomNumber: "A-201", hostelBlock: "Block A", role: "STUDENT" },
  { userId: 4, name: "Priya Nair", email: "priya.nair@example.com", roomNumber: "B-105", hostelBlock: "Block B", role: "STUDENT" },
  { userId: 5, name: "Karan Mehta", email: "karan.mehta@example.com", roomNumber: "B-210", hostelBlock: "Block B", role: "STUDENT" },
  { userId: 16, name: "Hostel Warden (Admin)", email: "warden@hostel.edu", roomNumber: "Admin-01", hostelBlock: "Admin Block", role: "WARDEN" }
];

const fallbackDepartments = [
  { departmentId: 1, departmentName: "Maintenance" },
  { departmentId: 2, departmentName: "IT & Wi-Fi" },
  { departmentId: 3, departmentName: "Housekeeping" },
  { departmentId: 4, departmentName: "Security" },
  { departmentId: 5, departmentName: "Mess & Cafeteria" },
  { departmentId: 6, departmentName: "Hostel Administration" },
  { departmentId: 7, departmentName: "Electrical" },
  { departmentId: 8, departmentName: "Plumbing" }
];

const fallbackCategories = [
  { categoryId: 1, categoryName: "Noise & Disturbance" },
  { categoryId: 2, categoryName: "Water Leakage & Supply" },
  { categoryId: 3, categoryName: "Power Outage & Geyser" },
  { categoryId: 4, categoryName: "Wi-Fi & LAN Network" },
  { categoryId: 5, categoryName: "Cleanliness & Garbage" },
  { categoryId: 6, categoryName: "Pest Control & Insects" },
  { categoryId: 7, categoryName: "Furniture Damage & Carpentry" },
  { categoryId: 8, categoryName: "Mess Food Quality" }
];

const fallbackStaff = [
  { staffId: 1, name: "Ramesh Yadav", departmentId: 1, departmentName: "Maintenance", phone: "9876543201" },
  { staffId: 3, name: "Kunal Bedi", departmentId: 2, departmentName: "IT & Wi-Fi", phone: "9876543203" },
  { staffId: 4, name: "Farah Khan", departmentId: 2, departmentName: "IT & Wi-Fi", phone: "9876543204" },
  { staffId: 6, name: "Lata More", departmentId: 3, departmentName: "Housekeeping", phone: "9876543206" },
  { staffId: 8, name: "Prakash Rawat", departmentId: 4, departmentName: "Security", phone: "9876543208" },
  { staffId: 10, name: "Joseph Dsouza", departmentId: 5, departmentName: "Mess & Cafeteria", phone: "9876543210" },
  { staffId: 12, name: "Mahesh Pillai", departmentId: 6, departmentName: "Hostel Administration", phone: "9876543212" },
  { staffId: 14, name: "Vivek Pandey", departmentId: 7, departmentName: "Electrical", phone: "9876543214" },
  { staffId: 16, name: "Bharat Lal", departmentId: 8, departmentName: "Plumbing", phone: "9876543216" }
];

function sampleComplaint(id, userId, categoryId, departmentId, priority, status, daysAgo, description, staff, rating) {
  const user = fallbackUsers.find(u => u.userId === userId) || fallbackUsers[0];
  const category = fallbackCategories.find(c => c.categoryId === categoryId) || {};
  const department = fallbackDepartments.find(d => d.departmentId === departmentId) || {};
  const registered = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return {
    complaintId: id,
    userId,
    userName: user.name,
    userEmail: user.email,
    roomNumber: user.roomNumber,
    hostelBlock: user.hostelBlock,
    categoryId,
    categoryName: category.categoryName,
    departmentId,
    departmentName: department.departmentName,
    priority,
    status,
    description,
    dateRegistered: registered,
    dateResolved: status === "Resolved" ? new Date(Date.now() - (daysAgo - 2) * 86400000).toISOString() : null,
    assignedStaffId: staff ? staff.staffId : null,
    assignedStaffName: staff ? staff.name : null,
    feedbackRating: rating || null,
    feedbackComments: rating ? "Work completed as reported. Thanks to the maintenance team." : null
  };
}

const fallbackComplaints = [
  sampleComplaint(18, 1, 4, 2, "High", "In Progress", 1, "Wi-Fi drops every few minutes on the first floor of Block A since Monday.", fallbackStaff[1]),
  sampleComplaint(17, 4, 2, 8, "Medium", "Pending", 2, "Continuous drip from the washroom tap in B-105; the floor stays wet.", null),
  sampleComplaint(16, 3, 7, 1, "Low", "Resolved", 4, "Study table drawer is jammed and the lock no longer latches.", fallbackStaff[0], 4),
  sampleComplaint(15, 5, 3, 7, "High", "Resolved", 6, "Geyser in B-210 trips the MCB whenever switched on.", fallbackStaff[7], 5),
  sampleComplaint(14, 2, 5, 3, "Medium", "Resolved", 8, "Garbage not collected from the A-block corridor for two days.", fallbackStaff[3], 4),
  sampleComplaint(13, 1, 6, 1, "Medium", "Resolved", 11, "Cockroaches reported in the A-101 pantry area.", fallbackStaff[0], 3),
  sampleComplaint(12, 6, 8, 5, "Low", "Resolved", 13, "Mess dinner quality has dropped; dal was undercooked twice this week.", fallbackStaff[5], 4),
  sampleComplaint(11, 5, 9, 4, "High", "Resolved", 16, "Unauthorised entry attempt through the B-block rear gate at night.", fallbackStaff[4], 5),
  sampleComplaint(10, 3, 1, 4, "Medium", "Resolved", 19, "Loud music from the adjacent room after quiet hours.", fallbackStaff[4], 4)
];

/* ---------------------------------------------------------------------
   Element references
   --------------------------------------------------------------------- */
const views = {
  dashboard: document.getElementById("dashboard-view"),
  complaints: document.getElementById("complaints-view"),
  departments: document.getElementById("departments-view"),
  staff: document.getElementById("staff-view"),
  new: document.getElementById("new-view")
};

const pageTitle = document.getElementById("page-title");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const priorityFilter = document.getElementById("priority-filter");
const departmentFilter = document.getElementById("department-filter");
const userField = document.getElementById("user-field");
const categoryField = document.getElementById("category-field");
const departmentField = document.getElementById("department-field");
const complaintForm = document.getElementById("complaint-form");
const detailDialog = document.getElementById("detail-dialog");
const closeDialog = document.getElementById("close-dialog");
const detailBody = document.getElementById("detail-body");
const backendStatusText = document.getElementById("backend-status-text");
const backendStatusBadge = document.getElementById("backend-status");
const offlineBanner = document.getElementById("offline-banner");

const loginDialog = document.getElementById("login-dialog");
const closeLoginDialog = document.getElementById("close-login-dialog");
const switchUserBtn = document.getElementById("switch-user-btn");
const userAvatar = document.getElementById("user-avatar");
const currentUserName = document.getElementById("current-user-name");
const currentUserRole = document.getElementById("current-user-role");
const sessionRole = document.getElementById("session-role");
const currentUserExtra = document.getElementById("current-user-extra");
const staffNavTab = document.getElementById("staff-nav-tab");
const formResidentName = document.getElementById("form-resident-name");
const formResidentRoom = document.getElementById("form-resident-room");

const feedbackDialog = document.getElementById("feedback-dialog");
const closeFeedbackDialog = document.getElementById("close-feedback-dialog");
const feedbackForm = document.getElementById("feedback-form");
const feedbackComplaintId = document.getElementById("feedback-complaint-id");
const feedbackRatingSelect = document.getElementById("feedback-rating-select");
const feedbackCommentsText = document.getElementById("feedback-comments-text");

const openAddStaffBtn = document.getElementById("open-add-staff-btn");
const addStaffDialog = document.getElementById("add-staff-dialog");
const closeAddStaffDialog = document.getElementById("close-add-staff-dialog");
const addStaffForm = document.getElementById("add-staff-form");
const newStaffName = document.getElementById("new-staff-name");
const newStaffDepartment = document.getElementById("new-staff-department");
const newStaffPhone = document.getElementById("new-staff-phone");
const staffRows = document.getElementById("staff-rows");
const toastStack = document.getElementById("toast-stack");

/* ---------------------------------------------------------------------
   Small utilities
   --------------------------------------------------------------------- */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return String(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch (e) {
    return String(dateStr);
  }
}

function roomLine(complaint) {
  const parts = [complaint.roomNumber, complaint.hostelBlock].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Hostel resident";
}

function sortByNewest(list) {
  return list.slice().sort((a, b) => {
    const ta = new Date(a.dateRegistered || 0).getTime() || 0;
    const tb = new Date(b.dateRegistered || 0).getTime() || 0;
    if (tb !== ta) return tb - ta;
    return (b.complaintId || 0) - (a.complaintId || 0);
  });
}

function statusClass(status) {
  return `status-${String(status || "").toLowerCase().replace(/\s+/g, "-")}`;
}

function statusPill(status) {
  return `<span class="pill ${statusClass(status)}">${escapeHtml(status)}</span>`;
}

function priorityPill(priority) {
  return `<span class="pill priority-${String(priority || "medium").toLowerCase()}">${escapeHtml(priority)}</span>`;
}

function toast(message, tone = "info") {
  if (!toastStack) return;
  const el = document.createElement("div");
  el.className = `toast ${tone}`;
  el.innerHTML = `<span>${escapeHtml(message)}</span>`;
  toastStack.appendChild(el);
  window.setTimeout(() => {
    el.classList.add("is-leaving");
    window.setTimeout(() => el.remove(), 220);
  }, 4200);
}

/* ---------------------------------------------------------------------
   Connection state
   --------------------------------------------------------------------- */
function updateBackendStatus(live) {
  isBackendLive = live;
  if (backendStatusBadge && backendStatusText) {
    backendStatusBadge.dataset.state = live ? "live" : "offline";
    backendStatusText.textContent = live ? "Live database" : "Preview mode";
    backendStatusBadge.title = live
      ? "Connected to the Spring Boot API and MySQL/H2 database"
      : "Spring Boot API not reachable — showing sample records";
  }
  if (offlineBanner) offlineBanner.hidden = live;
  const meta = document.getElementById("page-meta");
  if (meta) meta.textContent = live ? "Spring Boot · Hibernate/JDBC · MySQL" : "Sample records (offline preview)";
}

/* ---------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------- */
async function loadInitialData() {
  try {
    const statsRes = await fetch(`${API_BASE}/dashboard/stats`, { signal: AbortSignal.timeout(3000) });
    if (!statsRes.ok) throw new Error("Backend not OK");

    const [uRes, dRes, cRes, compRes, stRes] = await Promise.all([
      fetch(`${API_BASE}/users`),
      fetch(`${API_BASE}/departments`),
      fetch(`${API_BASE}/categories`),
      fetch(`${API_BASE}/complaints`),
      fetch(`${API_BASE}/staff`)
    ]);

    dashboardStats = await statsRes.json();
    users = await uRes.json();
    departments = await dRes.json();
    categories = await cRes.json();
    complaints = sortByNewest(await compRes.json());
    staffList = await stRes.json();
    updateBackendStatus(true);
    await loadStaffPerformance();
  } catch (err) {
    console.warn("Spring Boot backend not reachable, using embedded sample data:", err);
    updateBackendStatus(false);
    dashboardStats = null;
    users = fallbackUsers;
    departments = fallbackDepartments;
    categories = fallbackCategories;
    staffList = fallbackStaff;
    complaints = fallbackComplaints.slice();
  }

  const savedUser = localStorage.getItem("hostel_cms_user");
  if (savedUser) {
    try { currentUser = JSON.parse(savedUser); } catch (e) { /* ignore corrupt session */ }
  }

  updateUserUI();
  populateDropdowns();
  switchView("dashboard");
  renderAll();
}

async function loadStaffPerformance() {
  if (!isBackendLive) return;
  try {
    const res = await fetch(`${API_BASE}/staff/performance`);
    if (res.ok) staffPerformance = await res.json();
  } catch (e) {
    console.warn("Could not load staff performance", e);
  }
}

/* ---------------------------------------------------------------------
   Session UI
   --------------------------------------------------------------------- */
function updateUserUI() {
  if (!currentUserName || !currentUserRole) return;

  currentUserName.textContent = currentUser.name || "Signed in";
  userAvatar.textContent = (currentUser.name || "U").charAt(0).toUpperCase();
  const roleLabel = { STUDENT: "Student", WARDEN: "Warden", STAFF: "Technician" }[currentUser.role] || "Student";
  currentUserRole.textContent = roleLabel;
  if (sessionRole) sessionRole.textContent = roleLabel;

  if (currentUser.role === "STUDENT") {
    currentUserExtra.textContent = currentUser.roomNumber || "Hostel";
  } else if (currentUser.role === "WARDEN") {
    currentUserExtra.textContent = "administrator";
  } else {
    currentUserExtra.textContent = currentUser.departmentName || "maintenance";
  }

  if (staffNavTab) {
    staffNavTab.style.display = currentUser.role === "WARDEN" ? "flex" : "none";
  }

  if (formResidentName) formResidentName.textContent = currentUser.name || "Resident";
  if (formResidentRoom) {
    formResidentRoom.textContent = [currentUser.roomNumber, currentUser.hostelBlock]
      .filter(Boolean)
      .join(", ") || "Hostel resident";
  }

  if (userField && currentUser.role === "STUDENT") {
    userField.value = currentUser.userId;
  }
}

function populateDropdowns() {
  departmentFilter.innerHTML = '<option value="All">All wings</option>' +
    departments.map(d => `<option value="${d.departmentId}">${escapeHtml(d.departmentName)}</option>`).join("");

  userField.innerHTML = users.map(u =>
    `<option value="${u.userId}" ${u.userId === currentUser.userId ? "selected" : ""}>${escapeHtml(u.name)} (${escapeHtml(u.roomNumber || "Hostel")})</option>`
  ).join("");

  categoryField.innerHTML = categories.map(c =>
    `<option value="${c.categoryId}">${escapeHtml(c.categoryName)}</option>`
  ).join("");

  departmentField.innerHTML = departments.map(d =>
    `<option value="${d.departmentId}">${escapeHtml(d.departmentName)}</option>`
  ).join("");

  if (newStaffDepartment) {
    newStaffDepartment.innerHTML = departments.map(d =>
      `<option value="${d.departmentId}">${escapeHtml(d.departmentName)}</option>`
    ).join("");
  }
}

/* ---------------------------------------------------------------------
   Rendering
   --------------------------------------------------------------------- */
function renderAll() {
  renderDashboard();
  renderComplaintsTable();
  renderDepartmentsView();
  renderStaffView();
}

function renderDashboard() {
  const total = complaints.length;
  const pending = complaints.filter(c => c.status === "Pending").length;
  const inProgress = complaints.filter(c => c.status === "In Progress").length;
  const resolved = complaints.filter(c => c.status === "Resolved").length;
  const high = complaints.filter(c => c.priority === "High").length;
  const medium = complaints.filter(c => c.priority === "Medium").length;
  const low = complaints.filter(c => c.priority === "Low").length;
  const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  document.getElementById("metric-grid").innerHTML = `
    <article class="stat">
      <div class="stat-head">
        <span class="stat-label">Total complaints</span>
        <span class="stat-icon"><svg class="i" aria-hidden="true"><use href="#i-doc"/></svg></span>
      </div>
      <span class="stat-value">${total}</span>
      <span class="stat-foot">${high} high-priority <span class="dot"></span> all wings</span>
    </article>
    <article class="stat" data-tone="amber">
      <div class="stat-head">
        <span class="stat-label">Pending review</span>
        <span class="stat-icon"><svg class="i" aria-hidden="true"><use href="#i-clock"/></svg></span>
      </div>
      <span class="stat-value">${pending}</span>
      <span class="stat-foot">Awaiting assignment</span>
    </article>
    <article class="stat" data-tone="blue">
      <div class="stat-head">
        <span class="stat-label">In progress</span>
        <span class="stat-icon"><svg class="i" aria-hidden="true"><use href="#i-wrench"/></svg></span>
      </div>
      <span class="stat-value">${inProgress}</span>
      <span class="stat-foot">Assigned to technicians</span>
    </article>
    <article class="stat" data-tone="green">
      <div class="stat-head">
        <span class="stat-label">Resolution rate</span>
        <span class="stat-icon"><svg class="i" aria-hidden="true"><use href="#i-shield"/></svg></span>
      </div>
      <span class="stat-value">${rate}<small>%</small></span>
      <span class="stat-foot">${resolved} of ${total} closed</span>
    </article>
  `;

  document.getElementById("status-total").textContent = `${total} complaints recorded`;

  const rows = [
    { label: "Pending", count: pending, cls: "pending" },
    { label: "In progress", count: inProgress, cls: "in-progress" },
    { label: "Resolved", count: resolved, cls: "resolved" }
  ];
  document.getElementById("status-bars").innerHTML = rows.map(r => {
    const pct = total ? Math.round((r.count / total) * 100) : 0;
    return `
      <div class="bar-row">
        <span class="bar-label">${r.label}</span>
        <div class="bar-track"><div class="bar-fill ${r.cls}" style="width:${pct}%"></div></div>
        <span class="bar-value">${r.count}</span>
      </div>
    `;
  }).join("");

  document.getElementById("priority-stack").innerHTML = `
    <div class="priority-segment priority-high ${high ? "" : "is-empty"}" style="flex:${high || 1}" title="High priority: ${high}">${high || ""}</div>
    <div class="priority-segment priority-medium ${medium ? "" : "is-empty"}" style="flex:${medium || 1}" title="Medium priority: ${medium}">${medium || ""}</div>
    <div class="priority-segment priority-low ${low ? "" : "is-empty"}" style="flex:${low || 1}" title="Low priority: ${low}">${low || ""}</div>
  `;

  document.getElementById("priority-legend").innerHTML = [
    { label: "High", count: high, cls: "priority-high" },
    { label: "Medium", count: medium, cls: "priority-medium" },
    { label: "Low", count: low, cls: "priority-low" }
  ].map(item => `
    <span class="legend-item">
      <span class="legend-swatch ${item.cls}"></span>
      ${item.label} <strong>${item.count}</strong>
    </span>
  `).join("");

  const openCount = pending + inProgress;
  const navBadge = document.getElementById("nav-open-count");
  if (navBadge) {
    navBadge.textContent = openCount;
    navBadge.hidden = openCount === 0;
  }

  const rated = complaints.filter(c => c.feedbackRating);
  const avgRating = rated.length
    ? rated.reduce((acc, c) => acc + c.feedbackRating, 0) / rated.length
    : (dashboardStats && dashboardStats.averageRating) || 0;

  const openTickets = complaints.filter(c => c.status !== "Resolved");
  const oldestOpen = openTickets.reduce((oldest, c) => {
    const t = new Date(c.dateRegistered).getTime();
    return Number.isFinite(t) && (oldest === null || t < oldest) ? t : oldest;
  }, null);
  const oldestDays = oldestOpen === null
    ? null
    : Math.max(0, Math.floor((Date.now() - oldestOpen) / 86400000));

  const oldestLabel = (() => {
    if (oldestOpen === null) return null;
    const days = oldestDays;
    if (days <= 0) return "Registered today";
    if (days === 1) return "1 day";
    if (days < 30) return `${days} days`;
    return "Since " + new Date(oldestOpen).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  })();

  const mixFoot = document.getElementById("mix-foot");
  if (mixFoot) {
    mixFoot.innerHTML = `
      <div class="mix-fact">
        <span class="mix-fact-label">Resident rating</span>
        <span class="mix-fact-value">${avgRating > 0
          ? `<span class="rating"><svg class="i" aria-hidden="true"><use href="#i-star"/></svg>${avgRating.toFixed(1)}<span class="rating-max">/ 5</span></span>`
          : `<span class="rating-empty">No ratings yet</span>`}</span>
      </div>
      <div class="mix-fact">
        <span class="mix-fact-label">Oldest open ticket</span>
        <span class="mix-fact-value">${oldestLabel === null
          ? `<span class="rating-empty">None open</span>`
          : escapeHtml(oldestLabel)}</span>
      </div>
    `;
  }

  const recent = complaints.slice(0, 6);
  const recentBody = document.getElementById("recent-rows");
  if (!recent.length) {
    recentBody.innerHTML = `<tr class="table-empty"><td colspan="6">No complaints recorded yet.</td></tr>`;
  } else {
    recentBody.innerHTML = recent.map(c => `
      <tr>
        <td class="col-id"><span class="cell-id">#${c.complaintId}</span></td>
        <td>
          <span class="cell-primary">${escapeHtml(c.userName || "Resident")}</span>
          <span class="cell-secondary">${escapeHtml(roomLine(c))}</span>
        </td>
        <td>${escapeHtml(c.departmentName || "Unassigned")}</td>
        <td>${priorityPill(c.priority)}</td>
        <td>${statusPill(c.status)}</td>
        <td class="col-date">${formatDate(c.dateRegistered)}</td>
      </tr>
    `).join("");
  }
}

function renderComplaintsTable() {
  const query = (searchInput.value || "").trim().toLowerCase();
  const statusVal = statusFilter.value;
  const priorityVal = priorityFilter.value;
  const deptVal = departmentFilter.value;

  const filtered = complaints.filter(c => {
    const matchesSearch = !query ||
      String(c.complaintId).includes(query) ||
      (c.userName && c.userName.toLowerCase().includes(query)) ||
      (c.roomNumber && c.roomNumber.toLowerCase().includes(query)) ||
      (c.hostelBlock && c.hostelBlock.toLowerCase().includes(query)) ||
      (c.categoryName && c.categoryName.toLowerCase().includes(query)) ||
      (c.description && c.description.toLowerCase().includes(query)) ||
      (c.departmentName && c.departmentName.toLowerCase().includes(query));

    const matchesStatus = statusVal === "All" || c.status.toLowerCase() === statusVal.toLowerCase();
    const matchesPriority = priorityVal === "All" || c.priority.toLowerCase() === priorityVal.toLowerCase();
    const matchesDept = deptVal === "All" || String(c.departmentId) === String(deptVal);

    return matchesSearch && matchesStatus && matchesPriority && matchesDept;
  });

  document.getElementById("complaint-count").textContent =
    `${filtered.length} of ${complaints.length} tickets`;

  const tbody = document.getElementById("complaint-rows");
  if (!filtered.length) {
    tbody.innerHTML = `<tr class="table-empty"><td colspan="8">No complaints match the current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const isOwner = currentUser.role === "STUDENT" && c.userId === currentUser.userId;
    const canRate = isOwner && c.status === "Resolved" && !c.feedbackRating;

    return `
      <tr>
        <td class="col-id"><span class="cell-id">#${c.complaintId}</span></td>
        <td>
          <span class="cell-primary">${escapeHtml(c.userName || "Student")}${isOwner ? '<span class="mine-tag">Mine</span>' : ""}</span>
          <span class="cell-secondary">${escapeHtml(roomLine(c))}</span>
        </td>
        <td>${escapeHtml(c.categoryName || "General")}</td>
        <td>${escapeHtml(c.departmentName || "Unassigned")}</td>
        <td>${priorityPill(c.priority)}</td>
        <td>${statusPill(c.status)}</td>
        <td class="col-date">${formatDate(c.dateRegistered)}</td>
        <td class="col-action">
          <button class="row-link" type="button" onclick="viewDetails(${c.complaintId})">${canRate ? "Inspect · Rate" : "Inspect"}</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderDepartmentsView() {
  const list = document.getElementById("department-list");
  const note = document.getElementById("wing-count-note");
  if (note) note.textContent = `${departments.length} maintenance wings`;
  list.innerHTML = departments.map(d => {
    const deptComplaints = complaints.filter(c => c.departmentId === d.departmentId);
    const total = deptComplaints.length;
    const resolved = deptComplaints.filter(c => c.status === "Resolved").length;
    const open = total - resolved;
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const technicians = staffList.filter(s => s.departmentId === d.departmentId).length;
    const hasHistory = total > 0;

    return `
      <div class="wing-row">
        <div>
          <span class="wing-name">${escapeHtml(d.departmentName)}</span>
          <span class="wing-sub">${total} ${total === 1 ? "ticket" : "tickets"} raised</span>
        </div>
        <div class="wing-progress">
          <div class="bar-track"><div class="bar-fill resolved" style="width:${rate}%"></div></div>
          <span>${hasHistory ? `${rate}%` : "—"}</span>
        </div>
        <span class="wing-num ${hasHistory ? "" : "muted"}">${hasHistory ? resolved : "—"}</span>
        <span class="wing-num ${open ? "" : "muted"}">${hasHistory ? open : "—"}</span>
        <span class="wing-num muted">${technicians}</span>
      </div>
    `;
  }).join("");
}

function renderStaffView() {
  if (!staffRows) return;

  const data = staffPerformance.length > 0 ? staffPerformance : staffList.map(s => {
    const assigned = complaints.filter(c => c.assignedStaffId === s.staffId);
    const resolved = assigned.filter(c => c.status === "Resolved");
    const pending = assigned.filter(c => c.status !== "Resolved");
    const rated = assigned.filter(c => c.feedbackRating);
    const avg = rated.length > 0 ? rated.reduce((acc, x) => acc + x.feedbackRating, 0) / rated.length : 0;
    return {
      staffId: s.staffId,
      name: s.name,
      departmentName: s.departmentName,
      phone: s.phone,
      totalAssigned: assigned.length,
      resolvedCount: resolved.length,
      pendingCount: pending.length,
      avgRating: Math.round(avg * 10) / 10
    };
  });

  if (!data.length) {
    staffRows.innerHTML = `<tr class="table-empty"><td colspan="8">No technicians on the roster yet.</td></tr>`;
    return;
  }

  staffRows.innerHTML = data.map(s => `
    <tr>
      <td class="col-id"><span class="cell-id">#${s.staffId}</span></td>
      <td><span class="cell-primary">${escapeHtml(s.name)}</span></td>
      <td>${escapeHtml(s.departmentName || "Maintenance")}</td>
      <td><span class="cell-mono">${escapeHtml(s.phone || "—")}</span></td>
      <td class="num">${s.totalAssigned}</td>
      <td class="num">${s.resolvedCount}</td>
      <td class="num">${s.pendingCount > 0
        ? `<span class="pill status-pending">${s.pendingCount} open</span>`
        : `<span class="cell-secondary">None</span>`}</td>
      <td>${s.avgRating > 0
        ? `<span class="rating"><svg class="i" aria-hidden="true"><use href="#i-star"/></svg>${s.avgRating.toFixed(1)}<span class="rating-max">/ 5</span></span>`
        : `<span class="rating-empty">No ratings yet</span>`}</td>
    </tr>
  `).join("");
}

/* ---------------------------------------------------------------------
   Complaint detail dialog
   --------------------------------------------------------------------- */
window.viewDetails = async function (id) {
  const complaint = complaints.find(c => c.complaintId === id);
  if (!complaint) return;

  renderModalContent(complaint, `<p class="timeline-empty">Loading audit trail…</p>`);
  if (typeof detailDialog.showModal === "function") detailDialog.showModal();

  if (!isBackendLive) {
    const events = [];
    events.push({ status: "Pending", at: complaint.dateRegistered });
    if (complaint.status === "In Progress") {
      events.push({ status: "In Progress", at: complaint.dateRegistered });
    }
    if (complaint.status === "Resolved") {
      events.push({ status: "In Progress", at: complaint.dateRegistered });
      events.push({ status: "Resolved", at: complaint.dateResolved || complaint.dateRegistered });
    }
    const fallbackHistory = events
      .slice()
      .reverse()
      .map(e => `
        <div class="timeline-item">
          <span>${statusPill(e.status)}</span>
          <time>${formatDate(e.at)}</time>
        </div>
      `)
      .join("");
    renderModalContent(complaint, fallbackHistory);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/complaints/${id}/history`);
    if (res.ok) {
      const history = await res.json();
      const html = history.length
        ? history.map(h => `
            <div class="timeline-item">
              <span>${statusPill(h.status)}</span>
              <time>${formatDate(h.updatedOn)}</time>
            </div>
          `).join("")
        : `<p class="timeline-empty">No status changes recorded.</p>`;
      renderModalContent(complaint, html);
    }
  } catch (e) {
    console.warn("Could not load history", e);
  }
};

function renderModalContent(complaint, historyHtml) {
  document.getElementById("detail-title").textContent = `Ticket #${complaint.complaintId}`;

  const eligibleStaff = staffList.filter(s => s.departmentId === complaint.departmentId);
  const staffOptions = eligibleStaff.map(s =>
    `<option value="${s.staffId}" ${complaint.assignedStaffId === s.staffId ? "selected" : ""}>${escapeHtml(s.name)} · ${escapeHtml(s.phone || "")}</option>`
  ).join("");

  const isOwner = currentUser.role === "STUDENT" && complaint.userId === currentUser.userId;
  const isWarden = currentUser.role === "WARDEN";
  const isStaff = currentUser.role === "STAFF";
  const canAssign = isWarden || isStaff;

  detailBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">Resident</span>
        <strong>${escapeHtml(complaint.userName || "Student")}</strong>
        <span class="sub">${escapeHtml(complaint.userEmail || "")}</span>
        <span class="meta">${escapeHtml(roomLine(complaint))}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Wing &amp; category</span>
        <strong>${escapeHtml(complaint.departmentName || "Unassigned")}</strong>
        <span class="sub">${escapeHtml(complaint.categoryName || "General")}</span>
        <span class="meta">Priority ${priorityPill(complaint.priority)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Status</span>
        ${statusPill(complaint.status)}
        <span class="meta">Registered ${formatDate(complaint.dateRegistered)}</span>
        ${complaint.dateResolved ? `<span class="meta">Resolved ${formatDate(complaint.dateResolved)}</span>` : ""}
      </div>
      <div class="detail-item">
        <span class="detail-label">Assigned technician</span>
        <strong>${complaint.assignedStaffName ? escapeHtml(complaint.assignedStaffName) : '<span class="rating-empty">Not assigned</span>'}</strong>
        ${complaint.feedbackRating
          ? `<span class="meta" style="display:inline-flex;align-items:center;gap:4px;">Resident rating
               <span class="rating"><svg class="i" aria-hidden="true"><use href="#i-star"/></svg>${complaint.feedbackRating}.0</span></span>
             ${complaint.feedbackComments ? `<span class="sub">“${escapeHtml(complaint.feedbackComments)}”</span>` : ""}`
          : ""}
      </div>
    </div>

    <div class="detail-block">
      <div class="detail-block-head">
        <span class="detail-label">Issue description</span>
      </div>
      <p class="detail-description">${escapeHtml(complaint.description)}</p>
    </div>

    <div class="detail-block">
      <div class="detail-block-head">
        <span class="detail-label">Status history</span>
        <span class="cell-secondary">Audit trail from complaint_status_history</span>
      </div>
      <div class="timeline">${historyHtml}</div>
    </div>

    <div class="detail-actions">
      <span class="detail-actions-label">Actions · ${escapeHtml(currentUser.role)}</span>

      ${canAssign ? `
        <select id="assign-staff-select" aria-label="Assign technician">
          <option value="">Assign a technician…</option>
          ${staffOptions}
        </select>
        <button class="btn btn-secondary btn-sm" type="button" onclick="doAssignStaff(${complaint.complaintId})">Assign</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="doUpdateStatus(${complaint.complaintId}, 'In Progress')">Mark in progress</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="doUpdateStatus(${complaint.complaintId}, 'Resolved')">Resolve ticket</button>
      ` : ""}

      ${isOwner && complaint.status === "Resolved" && !complaint.feedbackRating ? `
        <button class="btn btn-primary btn-sm" type="button" onclick="openFeedbackModal(${complaint.complaintId})">Rate this resolution</button>
      ` : ""}

      ${isOwner && complaint.status !== "Resolved" ? `
        <span class="note">This ticket is with the hostel maintenance team. You will be notified when the status changes.</span>
      ` : ""}

      ${!canAssign && !isOwner ? `
        <span class="note">Signed in as ${escapeHtml(currentUser.name)} — no actions available for this ticket.</span>
      ` : ""}
    </div>
  `;
}

window.doAssignStaff = async function (complaintId) {
  const select = document.getElementById("assign-staff-select");
  const staffId = select ? select.value : null;
  if (!staffId) {
    toast("Select a technician before assigning.", "error");
    return;
  }

  if (isBackendLive) {
    try {
      const res = await fetch(`${API_BASE}/complaints/${complaintId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: parseInt(staffId) })
      });
      if (res.ok) {
        await refreshData();
        await loadStaffPerformance();
        renderStaffView();
        viewDetails(complaintId);
        toast("Technician assigned and ticket moved to in progress.", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || "Could not assign the technician.", "error");
      }
    } catch (e) {
      toast("Assignment failed: " + e.message, "error");
    }
    return;
  }

  const c = complaints.find(x => x.complaintId === complaintId);
  if (c) {
    c.assignedStaffId = parseInt(staffId);
    const s = staffList.find(x => x.staffId === parseInt(staffId));
    if (s) c.assignedStaffName = s.name;
    c.status = "In Progress";
    renderAll();
    viewDetails(complaintId);
    toast("Technician assigned (preview mode).", "success");
  }
};

window.doUpdateStatus = async function (complaintId, newStatus) {
  if (isBackendLive) {
    try {
      const res = await fetch(`${API_BASE}/complaints/${complaintId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        await refreshData();
        await loadStaffPerformance();
        renderStaffView();
        viewDetails(complaintId);
        toast(`Ticket marked as ${newStatus.toLowerCase()}.`, "success");
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || "Could not update the status.", "error");
      }
    } catch (e) {
      toast("Status update failed: " + e.message, "error");
    }
    return;
  }

  const c = complaints.find(x => x.complaintId === complaintId);
  if (c) {
    c.status = newStatus;
    if (newStatus === "Resolved") c.dateResolved = new Date().toISOString();
    renderAll();
    viewDetails(complaintId);
    toast(`Ticket marked as ${newStatus.toLowerCase()} (preview mode).`, "success");
  }
};

/* ---------------------------------------------------------------------
   Feedback
   --------------------------------------------------------------------- */
window.openFeedbackModal = function (complaintId) {
  feedbackComplaintId.value = complaintId;
  feedbackForm.reset();
  if (typeof feedbackDialog.showModal === "function") feedbackDialog.showModal();
};

feedbackForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const complaintId = parseInt(feedbackComplaintId.value);
  const rating = parseInt(feedbackRatingSelect.value);
  const comments = feedbackCommentsText.value.trim();

  if (isBackendLive) {
    try {
      const res = await fetch(`${API_BASE}/complaints/${complaintId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comments })
      });
      if (res.ok) {
        feedbackDialog.close();
        await refreshData();
        await loadStaffPerformance();
        renderStaffView();
        viewDetails(complaintId);
        toast("Feedback recorded — thank you for rating the resolution.", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || "Failed to submit feedback.", "error");
      }
    } catch (err) {
      toast("Submission error: " + err.message, "error");
    }
    return;
  }

  const c = complaints.find(x => x.complaintId === complaintId);
  if (c) {
    c.feedbackRating = rating;
    c.feedbackComments = comments;
    feedbackDialog.close();
    renderAll();
    viewDetails(complaintId);
    toast("Feedback saved (preview mode).", "success");
  }
});

/* ---------------------------------------------------------------------
   Technician roster
   --------------------------------------------------------------------- */
if (openAddStaffBtn) {
  openAddStaffBtn.addEventListener("click", () => {
    if (addStaffDialog) {
      addStaffForm.reset();
      addStaffDialog.showModal();
    }
  });
}

if (closeAddStaffDialog) {
  closeAddStaffDialog.addEventListener("click", () => addStaffDialog.close());
}

if (addStaffForm) {
  addStaffForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = newStaffName.value.trim();
    const departmentId = parseInt(newStaffDepartment.value);
    const phone = newStaffPhone.value.trim();
    if (!name || !departmentId) return;

    if (isBackendLive) {
      try {
        const res = await fetch(`${API_BASE}/staff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, departmentId, phone })
        });
        if (res.ok) {
          const created = await res.json();
          addStaffDialog.close();
          const stRes = await fetch(`${API_BASE}/staff`);
          staffList = await stRes.json();
          await loadStaffPerformance();
          renderStaffView();
          populateDropdowns();
          toast(`${created.name} added to the technician roster.`, "success");
        } else {
          const err = await res.json().catch(() => ({}));
          toast(err.error || "Could not add the technician.", "error");
        }
      } catch (err) {
        toast("Error: " + err.message, "error");
      }
      return;
    }

    staffList.push({
      staffId: (staffList[staffList.length - 1]?.staffId || 30) + 1,
      name,
      departmentId,
      departmentName: departments.find(d => d.departmentId === departmentId)?.departmentName || "Maintenance",
      phone
    });
    addStaffDialog.close();
    renderStaffView();
    populateDropdowns();
    toast(`${name} added (preview mode).`, "success");
  });
}

/* ---------------------------------------------------------------------
   Role switching / sign-in
   --------------------------------------------------------------------- */
window.loginAsRole = function (roleType) {
  if (roleType === "student") {
    currentUser = {
      userId: 1,
      name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      roomNumber: "A-101",
      hostelBlock: "Block A",
      role: "STUDENT"
    };
  } else if (roleType === "warden") {
    currentUser = {
      userId: 16,
      name: "Hostel Warden (Admin)",
      email: "warden@hostel.edu",
      roomNumber: "Admin-01",
      hostelBlock: "Admin Block",
      role: "WARDEN"
    };
  } else if (roleType === "staff") {
    currentUser = {
      userId: 1003,
      staffId: 3,
      name: "Kunal Bedi",
      email: "kunal.bedi@staff.hostel.edu",
      departmentName: "IT & Wi-Fi",
      role: "STAFF"
    };
  }

  localStorage.setItem("hostel_cms_user", JSON.stringify(currentUser));
  updateUserUI();
  populateDropdowns();
  renderAll();
  loginDialog.close();
  toast(`Now viewing as ${currentUser.name} · ${currentUser.role.toLowerCase()}.`, "info");
};

window.submitCustomLogin = async function () {
  const input = document.getElementById("custom-email-input").value.trim();
  if (!input) return;

  if (isBackendLive) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: input })
      });
      if (res.ok) {
        currentUser = await res.json();
        localStorage.setItem("hostel_cms_user", JSON.stringify(currentUser));
        updateUserUI();
        populateDropdowns();
        renderAll();
        loginDialog.close();
        toast(`Signed in as ${currentUser.name}.`, "success");
        return;
      }
    } catch (e) {
      console.warn("Auth endpoint fallback", e);
    }
  }

  const foundUser = users.find(u =>
    u.email.toLowerCase() === input.toLowerCase() || String(u.userId) === input
  );

  if (foundUser) {
    currentUser = { ...foundUser, role: foundUser.role || "STUDENT" };
    localStorage.setItem("hostel_cms_user", JSON.stringify(currentUser));
    updateUserUI();
    populateDropdowns();
    renderAll();
    loginDialog.close();
    toast(`Signed in as ${currentUser.name}.`, "success");
  } else {
    toast("No account found for that email. Try aarav.sharma@example.com or warden@hostel.edu.", "error");
  }
};

switchUserBtn.addEventListener("click", () => loginDialog.showModal());
closeLoginDialog.addEventListener("click", () => loginDialog.close());
closeFeedbackDialog.addEventListener("click", () => feedbackDialog.close());

/* ---------------------------------------------------------------------
   Data refresh
   --------------------------------------------------------------------- */
async function refreshData() {
  if (!isBackendLive) return;
  try {
    const res = await fetch(`${API_BASE}/complaints`);
    if (res.ok) complaints = sortByNewest(await res.json());
    renderAll();
  } catch (e) {
    console.warn("Refresh failed", e);
  }
}

/* ---------------------------------------------------------------------
   Create complaint
   --------------------------------------------------------------------- */
complaintForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userId = parseInt(userField.value);
  const categoryId = parseInt(categoryField.value);
  const departmentId = parseInt(departmentField.value);
  const priority = document.getElementById("priority-field").value;
  const description = document.getElementById("description-field").value.trim();

  if (!description) return;

  const payload = { userId, categoryId, departmentId, priority, description };

  if (isBackendLive) {
    try {
      const res = await fetch(`${API_BASE}/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const created = await res.json();
        complaintForm.reset();
        await refreshData();
        await loadStaffPerformance();
        renderStaffView();
        switchView("complaints");
        toast(`Complaint #${created.complaintId} registered. The warden will assign it shortly.`, "success");
      } else {
        const err = await res.json().catch(() => ({}));
        toast("Submission failed: " + (err.error || "unknown error"), "error");
      }
    } catch (err) {
      toast("Connection error: " + err.message, "error");
    }
    return;
  }

  const newId = (complaints[0]?.complaintId || 100) + 1;
  const u = users.find(x => x.userId === userId) || {};
  const d = departments.find(x => x.departmentId === departmentId) || {};
  const cat = categories.find(x => x.categoryId === categoryId) || {};

  complaints.unshift({
    complaintId: newId,
    userId,
    userName: u.name,
    roomNumber: u.roomNumber,
    hostelBlock: u.hostelBlock,
    categoryId,
    categoryName: cat.categoryName,
    departmentId,
    departmentName: d.departmentName,
    priority,
    description,
    status: "Pending",
    dateRegistered: new Date().toISOString()
  });

  complaintForm.reset();
  renderAll();
  switchView("complaints");
  toast(`Complaint #${newId} recorded (preview mode — start the backend to persist).`, "info");
});

/* ---------------------------------------------------------------------
   Navigation
   --------------------------------------------------------------------- */
const VIEW_META = {
  dashboard: {
    title: "Maintenance overview",
    eyebrow: "Overview",
    subtitle: "Every hostel complaint, assignment and resolution in one place.",
    crumb: "Dashboard"
  },
  complaints: {
    title: "Complaint register",
    eyebrow: "Records",
    subtitle: "Search, filter and inspect every ticket raised across hostel blocks.",
    crumb: "Complaint register"
  },
  departments: {
    title: "Maintenance wings",
    eyebrow: "Operations",
    subtitle: "Resolution progress and open workload for each maintenance wing.",
    crumb: "Maintenance wings"
  },
  staff: {
    title: "Technician roster",
    eyebrow: "Operations",
    subtitle: "Workload, closed tickets and resident ratings for the maintenance team.",
    crumb: "Technician roster"
  },
  new: {
    title: "Lodge a complaint",
    eyebrow: "Resident services",
    subtitle: "Raise a maintenance or services ticket for your hostel room.",
    crumb: "Lodge a complaint"
  }
};

function switchView(viewName) {
  Object.keys(views).forEach(key => {
    if (views[key]) views[key].classList.remove("is-active");
  });
  document.querySelectorAll(".nav-item").forEach(tab => {
    const active = tab.dataset.view === viewName;
    tab.classList.toggle("is-active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  if (views[viewName]) views[viewName].classList.add("is-active");
  currentView = viewName;

  const meta = VIEW_META[viewName] || VIEW_META.dashboard;
  if (pageTitle) pageTitle.textContent = meta.title;
  const eyebrow = document.getElementById("page-eyebrow");
  const subtitle = document.getElementById("page-subtitle");
  const crumb = document.getElementById("crumb-current");
  if (eyebrow) eyebrow.textContent = meta.eyebrow;
  if (subtitle) subtitle.textContent = meta.subtitle;
  if (crumb) crumb.textContent = meta.crumb;

  window.scrollTo({ top: 0, behavior: "auto" });
}

document.querySelectorAll(".nav-item").forEach(tab => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

document.querySelectorAll("[data-view-target]").forEach(btn => {
  btn.addEventListener("click", () => {
    switchView(btn.dataset.viewTarget);
    renderComplaintsTable();
  });
});

/* ---------------------------------------------------------------------
   Search & filters
   --------------------------------------------------------------------- */
searchInput.addEventListener("input", () => {
  renderComplaintsTable();
  if (searchInput.value.trim() && currentView !== "complaints" && currentView !== "dashboard") {
    switchView("complaints");
  }
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && searchInput.value.trim()) switchView("complaints");
});
statusFilter.addEventListener("change", renderComplaintsTable);
priorityFilter.addEventListener("change", renderComplaintsTable);
departmentFilter.addEventListener("change", renderComplaintsTable);

closeDialog.addEventListener("click", () => detailDialog.close());
detailDialog.addEventListener("click", (e) => {
  if (e.target === detailDialog) detailDialog.close();
});

/* ---------------------------------------------------------------------
   Start
   --------------------------------------------------------------------- */
loadInitialData();
