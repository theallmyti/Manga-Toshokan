// =====================================
// Supabase Client Setup
// =====================================
const SUPABASE_URL = "https://qdbfokgiwrococaxifkn.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkYmZva2dpd3JvY29jYXhpZmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDU0MTcsImV4cCI6MjA3NzkyMTQxN30.rQz9t-NnU_Ahn-8avkUlhry4BFYyw6PVfgZNo-KFK1A";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (s, p = document) => p.querySelector(s);

// Cached Elements
const el = {
  sidebar: $("#sidebar"),
  scrim: $("#scrim"),
  openSidebar: $("#openSidebar"),
  themeSwitch: $("#themeSwitch"),
  userEmail: $("#userEmail"),
  logoutBtn: $("#logoutBtn"),
  openAdd: $("#openAdd"),
  modalScrim: $("#modalScrim"),
  addModal: $("#addModal"),
  saveAdd: $("#saveAdd"),
  cancelAdd: $("#cancelAdd"),
  m_title: $("#m_title"),
  m_chapter: $("#m_chapter"),
  m_status: $("#m_status"),
  m_url: $("#m_url"),
  m_cover: $("#m_cover"),
  delScrim: $("#delScrim"),
  delModal: $("#delModal"),
  delCancel: $("#delCancel"),
  delConfirm: $("#delConfirm"),
  toastWrap: $("#toastWrap"),
  auth: $("#auth"),
  app: $("#app"),
  grid: $("#grid"),
  search: $("#searchInput"),
  status: $("#statusFilter"),
  refresh: $("#refreshBtn"),
  resultCount: $("#resultCount"),

  // Inline status popup
  statusPopup: $("#statusPopup"),
  statusDropdown: $("#statusDropdown"),
  statusCustomInput: $("#statusCustomInput"),
  statusCancel: $("#statusCancel"),
  statusSave: $("#statusSave"),

  // Edit modal (right click)
  editScrim: $("#editScrim"),
  editModal: $("#editModal"),
  edit_title: $("#edit_title"),
  edit_chapter: $("#edit_chapter"),
  edit_status: $("#edit_status"),
  edit_custom_status: $("#edit_custom_status"),
  edit_url: $("#edit_url"),
  edit_cover: $("#edit_cover"),
  editCancel: $("#editCancel"),
  editSave: $("#editSave"),
};

// Footer Year
$("#year").textContent = new Date().getFullYear();

// =====================================
// Sidebar
// =====================================
function openSidebar() {
  el.sidebar.classList.add("open");
  el.scrim.classList.add("show");
}
function closeSidebar() {
  el.sidebar.classList.remove("open");
  el.scrim.classList.remove("show");
}
el.openSidebar.onclick = openSidebar;
el.scrim.onclick = closeSidebar;

// =====================================
// Theme Persistence
// =====================================
(function () {
  const t = localStorage.getItem("theme") || "dark";
  setTheme(t);
  el.themeSwitch.checked = t === "light";
  el.themeSwitch.onchange = () => {
    const m = el.themeSwitch.checked ? "light" : "dark";
    setTheme(m);
    localStorage.setItem("theme", m);
  };
  function setTheme(m) {
    if (m === "light") document.body.classList.add("light");
    else document.body.classList.remove("light");
  }
})();

// =====================================
// Auth System
// =====================================
let cache = [],
  userId = null,
  pendingDelete = null,
  activeStatusId = null,
  editingId = null;

initAuth();

async function initAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  renderAuth(session?.user || null);
  supabase.auth.onAuthStateChange((_e, s) => renderAuth(s?.user || null));
}

function renderAuth(user) {
  if (user) {
    userId = user.id;
    el.userEmail.textContent = user.email;
    el.logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      location.reload();
    };

    el.auth.innerHTML = "";
    el.app.classList.remove("hidden");
    el.openAdd.classList.remove("hidden");
    el.openAdd.onclick = openAddModal;
    wire();
    loadData();
  } else {
    el.app.classList.add("hidden");
    el.openAdd.classList.add("hidden");
    el.auth.innerHTML = `
      <div class="glass p-3 mt-3">
        <h5>Login or Sign Up</h5>
        <input id="email" class="form-control mb-2" placeholder="Email">
        <input id="password" type="password" class="form-control mb-2" placeholder="Password">
        <div class="d-flex gap-2">
          <button id="login" class="btnx flex-fill">Login</button>
          <button id="signup" class="btnx flex-fill">Sign Up</button>
        </div>
      </div>`;

    $("#login").onclick = login;
    $("#signup").onclick = signup;

    const emailInput = $("#email");
    const passwordInput = $("#password");
    [emailInput, passwordInput].forEach((input) => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          $("#login").click();
        }
      });
    });
  }
}

// =====================================
// Login & Signup
// =====================================
async function login() {
  const e = $("#email").value.trim(),
    p = $("#password").value.trim();
  const { error } = await supabase.auth.signInWithPassword({
    email: e,
    password: p,
  });
  if (error) toast(error.message, "danger");
}

async function signup() {
  const e = $("#email").value.trim(),
    p = $("#password").value.trim();
  const { error } = await supabase.auth.signUp({ email: e, password: p });
  if (error) toast(error.message, "danger");
  else toast("Check your email to verify, then log in.", "success");
}

// =====================================
// CRUD
// =====================================
function wire() {
  el.refresh.onclick = loadData;
  el.search.oninput = () => apply();
  el.status.onchange = apply;

  document.addEventListener("mousedown", (e) => {
    if (el.statusPopup.classList.contains("hidden")) return;
    if (el.statusPopup.contains(e.target)) return;
    if (e.target.classList.contains("status-pill")) return;
    closeStatusPopup();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeStatusPopup();
  });
}

async function loadData() {
  el.resultCount.textContent = "Loading...";
  const { data, error } = await supabase
    .from("manga")
    .select("*")
    .eq("user_id", userId)
    .order("title", { ascending: true });
  if (error) return console.error(error);
  cache = data || [];
  apply();
}

function apply() {
  const q = el.search.value.toLowerCase();
  const s = el.status.value;
  let r = cache.filter((x) => x.title.toLowerCase().includes(q));
  if (s) r = r.filter((x) => (x.status || "") === s);
  render(r);
  el.resultCount.textContent = `${r.length} result${r.length !== 1 ? "s" : ""}`;
}

function render(rows) {
  el.grid.innerHTML = "";
  for (const row of rows) {
    const c = document.createElement("div");
    c.className = "cardx";

    const t = document.createElement("div");
    t.className = "thumb";

    const a = document.createElement("a");
    a.href = row.url || "#";
    a.target = "_blank";

    const i = document.createElement("img");
    if (row.cover_url) {
      i.dataset.src = row.cover_url;
      i.loading = "lazy";
      i.alt = row.title;
      observer.observe(i);
    } else t.classList.add("placeholder");

    a.append(i);
    t.append(a);

    const b = document.createElement("div");
    b.className = "card-bodyx";

    const ti = document.createElement("h3");
    ti.className = "title";
    ti.textContent = row.title;

    const inf = document.createElement("div");
    inf.className = "info-row";
    inf.innerHTML = `
      <div class='meta'>Ch ${row.chapter || 0}</div>
      <span class='status-pill' style='cursor:pointer;'>${row.status || "Ongoing"}</span>
    `;

    const statusEl = inf.querySelector(".status-pill");
    statusEl.onclick = (e) => {
      e.stopPropagation();
      openStatusPopup(statusEl, row.id, row.status || "Ongoing");
    };

    // Right-click to edit
    c.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openEditModal(row);
    });

    const act = document.createElement("div");
    act.className = "actions";

    const plus = btn("+1"),
      set = btn("Set"),
      done = btn("Done"),
      del = btnSvg();

    plus.onclick = () => updChap(row.id, (row.chapter || 0) + 1);
    set.onclick = () => {
      const v = prompt("Set chapter:", row.chapter);
      if (v !== null) updChap(row.id, Number(v));
    };
    done.onclick = () => markDone(row.id);
    del.onclick = () => openDel(row.id);

    act.append(plus, set, done, del);
    b.append(ti, inf, act);
    c.append(t, b);
    el.grid.append(c);
  }
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((x) => {
      if (x.isIntersecting) {
        x.target.src = x.target.dataset.src;
        observer.unobserve(x.target);
      }
    });
  },
  { rootMargin: "200px" }
);

function btn(t) {
  const b = document.createElement("button");
  b.className = "btnx";
  b.textContent = t;
  return b;
}

function btnSvg() {
  const b = document.createElement("button");
  b.className = "btnx btn-dangerx";
  b.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' fill='currentColor' viewBox='0 0 24 24'><path d='M9 3h6a1 1 0 0 1 1 1v1h4a1 1 0 1 1 0 2h-1v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4a1 1 0 1 1 0-2h4V4a1 1 0 0 1 1-1zm1 4v12h4V7h-4z'/></svg>`;
  return b;
}

async function updChap(id, val) {
  await supabase.from("manga").update({ chapter: val }).eq("id", id);
  loadData();
}

async function markDone(id) {
  await supabase.from("manga").update({ status: "Completed" }).eq("id", id);
  loadData();
}

// =====================================
// Add Modal
// =====================================
function openAddModal() {
  el.modalScrim.classList.add("show");
  el.addModal.classList.add("show");
}
function closeAddModal() {
  el.modalScrim.classList.remove("show");
  el.addModal.classList.remove("show");
}
el.cancelAdd.onclick = closeAddModal;
el.modalScrim.onclick = closeAddModal;

el.saveAdd.onclick = async () => {
  const title = el.m_title.value.trim();
  if (!title) return toast("Title is required", "danger");

  const chapter = Number(el.m_chapter.value) || 0;
  const status = el.m_status.value;
  const url = el.m_url.value.trim() || null;
  const cover = el.m_cover.value.trim() || null;

  let source = null;
  if (url) {
    try {
      source = new URL(url).hostname;
    } catch {
      source = null;
    }
  }

  await supabase.from("manga").insert({
    user_id: userId,
    title,
    chapter,
    status,
    url,
    cover_url: cover,
    source,
  });

  closeAddModal();
  loadData();
  toast("Series added successfully", "success");
};

// =====================================
// Delete Modal
// =====================================
function openDel(id) {
  pendingDelete = id;
  el.delScrim.classList.add("show");
  el.delModal.classList.add("show");
}
function closeDel() {
  el.delScrim.classList.remove("show");
  el.delModal.classList.remove("show");
}
el.delCancel.onclick = closeDel;
el.delScrim.onclick = closeDel;

el.delConfirm.onclick = async () => {
  if (!pendingDelete) return;
  await supabase.from("manga").delete().eq("id", pendingDelete);
  if (navigator.vibrate) navigator.vibrate(40);
  closeDel();
  loadData();
  toast("Deleted successfully", "danger");
};

// =====================================
// Edit Modal (Right-click)
// =====================================
function openEditModal(row) {
  editingId = row.id;
  el.edit_title.value = row.title || "";
  el.edit_chapter.value = row.chapter || 0;
  el.edit_status.value = ["Ongoing", "Completed", "On Hold"].includes(row.status)
    ? row.status
    : "Custom";
  el.edit_custom_status.value =
    el.edit_status.value === "Custom" ? row.status || "" : "";
  el.edit_custom_status.style.display =
    el.edit_status.value === "Custom" ? "block" : "none";
  el.edit_url.value = row.url || "";
  el.edit_cover.value = row.cover_url || "";
  el.editScrim.classList.add("show");
  el.editModal.classList.add("show");
}

function closeEditModal() {
  el.editScrim.classList.remove("show");
  el.editModal.classList.remove("show");
  editingId = null;
}
el.editCancel.onclick = closeEditModal;
el.editScrim.onclick = closeEditModal;

el.edit_status.onchange = () => {
  if (el.edit_status.value === "Custom") {
    el.edit_custom_status.style.display = "block";
  } else {
    el.edit_custom_status.style.display = "none";
  }
};

el.editSave.onclick = async () => {
  if (!editingId) return;

  let newStatus = el.edit_status.value;
  if (newStatus === "Custom") {
    newStatus = el.edit_custom_status.value.trim() || "Custom";
  }

  const updates = {
    title: el.edit_title.value.trim(),
    chapter: Number(el.edit_chapter.value) || 0,
    status: newStatus,
    url: el.edit_url.value.trim(),
    cover_url: el.edit_cover.value.trim(),
  };

  await supabase.from("manga").update(updates).eq("id", editingId);
  closeEditModal();
  loadData();
  toast("Entry updated successfully", "success");
};

// =====================================
// Inline Status Popup
// =====================================
function openStatusPopup(targetEl, id, currentStatus) {
  activeStatusId = id;
  el.statusDropdown.value = ["Ongoing", "Completed", "On Hold"].includes(currentStatus)
    ? currentStatus
    : "Custom";
  el.statusCustomInput.value =
    el.statusDropdown.value === "Custom" ? currentStatus || "" : "";
  el.statusCustomInput.style.display =
    el.statusDropdown.value === "Custom" ? "block" : "none";

  const rect = targetEl.getBoundingClientRect();
  const sx = window.scrollX || document.documentElement.scrollLeft;
  const sy = window.scrollY || document.documentElement.scrollTop;
  let top = rect.bottom + sy + 6;
  let left = rect.left + sx;
  const approxH = 160;
  if (top + approxH > sy + window.innerHeight) top = rect.top + sy - approxH - 6;
  const maxLeft = sx + window.innerWidth - 240;
  left = Math.min(left, maxLeft);
  el.statusPopup.style.top = `${top}px`;
  el.statusPopup.style.left = `${left}px`;
  el.statusPopup.classList.remove("hidden");
  if (el.statusDropdown.value === "Custom") el.statusCustomInput.focus();
  else el.statusDropdown.focus();
}
function closeStatusPopup() {
  el.statusPopup.classList.add("hidden");
  activeStatusId = null;
}
el.statusDropdown.onchange = () => {
  const isCustom = el.statusDropdown.value === "Custom";
  el.statusCustomInput.style.display = isCustom ? "block" : "none";
  if (isCustom) el.statusCustomInput.focus();
};
el.statusSave.onclick = async (e) => {
  e.stopPropagation();
  if (!activeStatusId) return;
  let newStatus = el.statusDropdown.value;
  if (newStatus === "Custom") {
    newStatus = el.statusCustomInput.value.trim() || "Custom";
  }
  await supabase.from("manga").update({ status: newStatus }).eq("id", activeStatusId);
  closeStatusPopup();
  loadData();
  toast("Status updated successfully", "success");
};
el.statusCancel.onclick = (e) => {
  e.stopPropagation();
  closeStatusPopup();
};

// =====================================
// Toasts
// =====================================
function toast(msg, type) {
  const t = document.createElement("div");
  t.className = `glass-toast ${
    type === "danger" ? "toast-danger" : "toast-success"
  }`;
  t.textContent = msg;
  el.toastWrap.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  const duration = type === "danger" ? 4000 : 2000;
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, duration);
}
