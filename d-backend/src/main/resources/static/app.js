// ============================================================
// App Framework — auth, API client, router
// ============================================================

const API_BASE = "/api";
const TOKEN_KEY = "ticket_token";
const state = {
  role: 0,           // 0=未登录, 1=organizer, 2=admin
  user: null,        // {userId, phone, nickname, role, isVerified, status}
  token: "",         // JWT token
};

// ---------- DOM refs ----------
const el = {
  navBtns: document.querySelectorAll("[data-role]"),
  organizerView: document.querySelector("#organizerView"),
  adminView: document.querySelector("#adminView"),
  authBtn: document.querySelector("#authBtn"),
  authModal: document.querySelector("#authModal"),
  closeAuthBtn: document.querySelector("#closeAuthBtn"),
  loginForm: document.querySelector("#loginForm"),
  registerForm: document.querySelector("#registerForm"),
  authTabs: document.querySelectorAll("[data-auth-tab]"),
  authModalTitle: document.querySelector("#authModalTitle"),
  userInfo: document.querySelector("#userInfo"),
  userName: document.querySelector("#userName"),
  logoutBtn: document.querySelector("#logoutBtn"),
  toast: document.querySelector("#toast"),
};

// ---------- Toast ----------
let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.toast.classList.add("hidden"); }, 2600);
}

// ---------- API client ----------
async function requestD(path, options) {
  var opts = options || {};
  var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  if (state.token) {
    headers["Authorization"] = "Bearer " + state.token;
  }
  var res = await fetch(API_BASE + path, Object.assign({}, opts, { headers: headers }));
  var payload;
  try { payload = await res.json(); } catch (e) { throw new Error("响应格式错误"); }
  if (!payload || payload.code !== 200) {
    throw new Error((payload && payload.message) || "请求失败");
  }
  return payload.data;
}

// ---------- Escape HTML ----------
function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------- Formatting ----------
function fmtTime(val) {
  if (!val) return "-";
  var d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  var m = d.getMonth() + 1, day = d.getDate(), h = d.getHours(), min = d.getMinutes();
  return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day)
    + " " + (h < 10 ? "0" + h : h) + ":" + (min < 10 ? "0" + min : min);
}

function fmtPrice(val) {
  return "¥" + Number(val || 0).toFixed(2);
}

// ---------- Status chip ----------
function statusChip(auditStatus) {
  var map = { 0: ["chip-pending", "待审核"], 1: ["chip-approved", "已上线"], 2: ["chip-rejected", "已驳回"], 3: ["chip-offline", "已下架"], 4: ["chip-draft", "草稿"] };
  var s = map[auditStatus] || ["chip-draft", "未知"];
  return '<span class="chip ' + s[0] + '">' + s[1] + '</span>';
}

// ---------- Pagination ----------
function renderPager(containerId, page, total, size, loadFn) {
  var el2 = document.querySelector(containerId);
  if (!el2) return;
  var pages = Math.ceil(total / size) || 0;
  if (pages <= 1) { el2.innerHTML = ""; return; }
  var html = '<button ' + (page <= 1 ? "disabled" : "") + ' data-page="' + (page - 1) + '">◀</button>';
  for (var i = 1; i <= pages; i++) {
    html += '<button class="' + (i === page ? "active" : "") + '" data-page="' + i + '">' + i + '</button>';
  }
  html += '<button ' + (page >= pages ? "disabled" : "") + ' data-page="' + (page + 1) + '">▶</button>';
  el2.innerHTML = html;
  el2.querySelectorAll("button:not([disabled])").forEach(function(b) {
    b.addEventListener("click", function() { loadFn(parseInt(this.dataset.page)); });
  });
}

// ---------- Auth ----------
function login(phone, password) {
  requestD("/auth/login", { method: "POST", body: JSON.stringify({ phone: phone, password: password }) })
    .then(function(data) {
      setToken(data.token);
      state.user = data;
      state.role = data.role || 0;
      saveUserInfo();
      syncAuthUI();
      el.authModal.classList.add("hidden");
      toast("登录成功");
      afterLogin();
    })
    .catch(function(e) { toast(e.message); });
}

function register(phone, password, nickname) {
  requestD("/auth/register", { method: "POST", body: JSON.stringify({ phone: phone, password: password, nickname: nickname || "" }) })
    .then(function(data) {
      setToken(data.token);
      state.user = data;
      state.role = data.role || 0;
      saveUserInfo();
      syncAuthUI();
      el.authModal.classList.add("hidden");
      toast("注册成功，请完成资质入驻");
      afterLogin();
    })
    .catch(function(e) { toast(e.message); });
}

function setToken(token) {
  state.token = token || "";
  if (state.token) {
    localStorage.setItem(TOKEN_KEY, state.token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function saveUserInfo() {
  if (state.user) {
    localStorage.setItem("ticket_user", JSON.stringify(state.user));
  } else {
    localStorage.removeItem("ticket_user");
  }
}

function restoreSession() {
  var savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken) {
    state.token = savedToken;
    var savedUser = localStorage.getItem("ticket_user");
    if (savedUser) {
      try {
        state.user = JSON.parse(savedUser);
        state.role = state.user.role || 0;
      } catch (e) {
        state.user = null;
        state.role = 0;
      }
    }
  }
}

function afterLogin() {
  if (state.role === 0 || state.role === 1) {
    if (typeof orgSwitchSub === "function") orgSwitchSub("qual");
  } else if (state.role === 2) {
    if (typeof adminSwitchSub === "function") adminSwitchSub("home");
  }
}

function logout() {
  setToken("");
  state.user = null;
  state.role = 0;
  saveUserInfo();
  syncAuthUI();
  toast("已退出登录");
}

function syncAuthUI() {
  if (state.user) {
    el.authBtn.classList.add("hidden");
    el.userInfo.classList.remove("hidden");
    var roleMap = {0:"普通用户",1:"演出方",2:"管理员"};
    el.userName.textContent = (state.user.nickname || state.user.phone) + " (" + (roleMap[state.user.role]||"") + ")";
    // role=0 or 1 see organizer view (role=0 only qualification), role=2 sees admin
    el.organizerView.classList.toggle("hidden", state.user.role === 2);
    el.adminView.classList.toggle("hidden", state.user.role !== 2);
  } else {
    el.authBtn.classList.remove("hidden");
    el.userInfo.classList.add("hidden");
    el.organizerView.classList.add("hidden");
    el.adminView.classList.add("hidden");
  }
  // role=0/1 see organizer nav, role=2 sees admin nav
  el.navBtns.forEach(function(b) {
    var r = parseInt(b.dataset.role);
    if (state.user && state.user.role === 2) {
      b.style.display = r === 2 ? "" : "none";
    } else if (state.user) {
      b.style.display = r === 1 ? "" : "none";
    } else {
      b.style.display = "none";
    }
  });
}

// ---------- Role switching ----------
function switchRole(role) {
  state.role = role;
  el.navBtns.forEach(function(b) {
    b.classList.toggle("active", parseInt(b.dataset.role) === role);
  });
  el.organizerView.classList.toggle("hidden", role !== 1);
  el.adminView.classList.toggle("hidden", role !== 2);
  if (role === 1 && typeof orgSwitchSub === "function") orgSwitchSub("qual");
  if (role === 2 && typeof adminSwitchSub === "function") adminSwitchSub("home");
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", function () {
  // Login form
  el.loginForm.addEventListener("submit", function(e) {
    e.preventDefault();
    var fd = new FormData(el.loginForm);
    var phone = fd.get("phone").trim();
    var password = fd.get("password").trim();
    if (!phone) { toast("请输入手机号"); return; }
    if (!password) { toast("请输入密码"); return; }
    login(phone, password);
  });

  // Register form
  el.registerForm.addEventListener("submit", function(e) {
    e.preventDefault();
    var fd = new FormData(el.registerForm);
    var phone = fd.get("phone").trim();
    var password = fd.get("password").trim();
    var nickname = (fd.get("nickname") || "").trim();
    if (!phone) { toast("请输入手机号"); return; }
    if (!password) { toast("请输入密码"); return; }
    register(phone, password, nickname);
  });

  // Auth tab switching
  el.authTabs.forEach(function(btn) {
    btn.addEventListener("click", function() {
      var tab = this.dataset.authTab;
      el.authTabs.forEach(function(b) { b.classList.toggle("active", b === btn); });
      el.loginForm.classList.toggle("hidden", tab !== "login");
      el.registerForm.classList.toggle("hidden", tab !== "register");
      el.authModalTitle.textContent = tab === "login" ? "登录后台管理" : "注册新账号";
    });
  });

  // Auth modal
  el.authBtn.addEventListener("click", function() { el.authModal.classList.remove("hidden"); });
  el.closeAuthBtn.addEventListener("click", function() { el.authModal.classList.add("hidden"); });

  // Logout
  el.logoutBtn.addEventListener("click", logout);

  // Role nav
  el.navBtns.forEach(function(b) {
    b.addEventListener("click", function () {
      switchRole(parseInt(this.dataset.role));
    });
  });

  // Restore session from localStorage
  restoreSession();
  syncAuthUI();
  if (state.user && state.role === 1) {
    if (typeof orgSwitchSub === "function") orgSwitchSub("list");
  }
  if (state.user && state.role === 2) {
    if (typeof adminSwitchSub === "function") adminSwitchSub("home");
  }
});
