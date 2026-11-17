// ============================================================
// Admin Backend — 运营管理后台
// ============================================================

var adminState = {
  subView: "home",
  auditTab: "shows",
  auditPage: 1, auditTotal: 0,
  qualPage: 1, qualTotal: 0,
  userPage: 1, userTotal: 0, userKeyword: "",
  orderPage: 1, orderTotal: 0,
  currentUserId: null,
  currentShowId: null,
};

var adminEl = {};

function initAdminEl() {
  adminEl = {
    subNavBtns: document.querySelectorAll("[data-admin-sub]"),
    homeSection: document.querySelector("#adminHomeSection"),
    overviewStats: document.querySelector("#adminOverviewStats"),
    topShows: document.querySelector("#adminTopShows"),
    auditCenterSection: document.querySelector("#adminAuditCenterSection"),
    auditMeta: document.querySelector("#adminAuditMeta"),
    showAuditList: document.querySelector("#adminShowAuditList"),
    postAuditList: document.querySelector("#adminPostAuditList"),
    auditPager: document.querySelector("#adminAuditPager"),
    showDetailSection: document.querySelector("#adminShowDetailSection"),
    showDetailBody: document.querySelector("#adminShowDetailBody"),
    auditRemark: document.querySelector("#adminAuditRemark"),
    qualAuditSection: document.querySelector("#adminQualAuditSection"),
    qualMeta: document.querySelector("#adminQualMeta"),
    qualList: document.querySelector("#adminQualAuditList"),
    qualPager: document.querySelector("#adminQualPager"),
    userListSection: document.querySelector("#adminUserListSection"),
    userList: document.querySelector("#adminUserList"),
    userPager: document.querySelector("#adminUserPager"),
    userSearchForm: document.querySelector("#adminUserSearchForm"),
    userDetailSection: document.querySelector("#adminUserDetailSection"),
    userDetailBody: document.querySelector("#adminUserDetailBody"),
    orderListSection: document.querySelector("#adminOrderListSection"),
    orderMeta: document.querySelector("#adminOrderMeta"),
    orderList: document.querySelector("#adminOrderList"),
    orderPager: document.querySelector("#adminOrderPager"),
    orderFilterForm: document.querySelector("#adminOrderFilterForm"),
    recommendSection: document.querySelector("#adminRecommendSection"),
    recommendList: document.querySelector("#adminRecommendList"),
    addRecommendInput: document.querySelector("#adminAddRecommendInput"),
  };
}

// ---------- Sub-view switching ----------
function adminSwitchSub(name) {
  adminState.subView = name;
  adminEl.subNavBtns.forEach(function(b) {
    b.classList.toggle("active", b.dataset.adminSub === name);
  });
  var sections = {
    home: adminEl.homeSection,
    auditCenter: adminEl.auditCenterSection,
    showDetail: adminEl.showDetailSection,
    qualAudit: adminEl.qualAuditSection,
    users: adminEl.userListSection,
    userDetail: adminEl.userDetailSection,
    orders: adminEl.orderListSection,
    recommend: adminEl.recommendSection,
  };
  Object.keys(sections).forEach(function(k) {
    sections[k].classList.toggle("hidden", k !== name);
  });

  if (name === "home") loadAdminDashboard();
  if (name === "auditCenter") switchAuditTab("shows");
  if (name === "qualAudit") loadQualAudit(1);
  if (name === "users") loadUserList(1);
  if (name === "recommend") loadRecommends();
  if (name === "orders") loadOrderList(1);
}

// ==================== Dashboard ====================

async function loadAdminDashboard() {
  try {
    var overview = await requestD("/admin/dashboard/overview");
    adminEl.overviewStats.innerHTML =
      '<div class="stat-card"><span class="stat-label">今日订单</span><span class="stat-value">' + (overview.todayOrders || 0) + '</span></div>'
      + '<div class="stat-card"><span class="stat-label">今日销售额</span><span class="stat-value">' + fmtPrice(overview.todaySales) + '</span></div>'
      + '<div class="stat-card"><span class="stat-label">在售演出</span><span class="stat-value">' + (overview.activeShows || 0) + '</span></div>'
      + '<div class="stat-card"><span class="stat-label">本月订单</span><span class="stat-value">' + (overview.monthOrders || 0) + '</span></div>'
      + '<div class="stat-card"><span class="stat-label">本月销售额</span><span class="stat-value">' + fmtPrice(overview.monthSales) + '</span></div>';

    var tops = await requestD("/admin/dashboard/top-shows?limit=20");
    if (!tops || tops.length === 0) {
      adminEl.topShows.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="5">暂无数据</td></tr></table>';
    } else {
      var html = '<table class="data-table"><thead><tr><th>排名</th><th>演出ID</th><th>名称</th><th>类型</th><th>收藏数</th></tr></thead><tbody>';
      tops.forEach(function(s, i) {
        html += '<tr><td>' + (i + 1) + '</td><td>' + s.showId + '</td><td>' + esc(s.title) + '</td><td>' + esc(s.category || "") + '</td><td>' + (s.favCount || 0) + '</td></tr>';
      });
      html += '</tbody></table>';
      adminEl.topShows.innerHTML = html;
    }
  } catch (e) {
    adminEl.overviewStats.innerHTML = '<p class="muted">加载失败：' + esc(e.message) + '</p>';
  }
}

// ==================== Audit Center ====================

function switchAuditTab(tab) {
  adminState.auditTab = tab;
  adminEl.auditCenterSection.querySelectorAll(".tab-btn").forEach(function(b) {
    b.classList.toggle("active", b.dataset.auditTab === tab);
  });
  adminEl.showAuditList.classList.toggle("hidden", tab !== "shows");
  adminEl.postAuditList.classList.toggle("hidden", tab !== "posts");
  if (tab === "shows") loadShowAudit(1);
  if (tab === "posts") loadPostAudit(1);
}

async function loadShowAudit(page) {
  adminState.auditPage = page || 1;
  try {
    var data = await requestD("/admin/audit/shows?page=" + adminState.auditPage + "&size=10");
    adminState.auditTotal = data.total || 0;
    adminEl.auditMeta.textContent = "待审演出 " + (data.total || 0) + " 项";
    var rows = data.records || [];
    if (rows.length === 0) {
      adminEl.showAuditList.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="7">暂无待审演出</td></tr></table>';
    } else {
      var html = '<table class="data-table"><thead><tr><th>ID</th><th>演出名称</th><th>类型</th><th>演出方ID</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead><tbody>';
      rows.forEach(function(s) {
        html += '<tr>'
          + '<td>' + s.showId + '</td>'
          + '<td><a data-admin-show-detail="' + s.showId + '">' + esc(s.title) + '</a></td>'
          + '<td>' + esc(s.category || "") + '</td>'
          + '<td>' + (s.userId || "-") + '</td>'
          + '<td>' + statusChip(s.auditStatus) + '</td>'
          + '<td>' + fmtTime(s.createdTime) + '</td>'
          + '<td class="inline-actions">'
          + '<button class="ghost-btn" data-admin-show-detail="' + s.showId + '" style="font-size:12px;padding:6px 10px">查看</button>';
        if (s.auditStatus === 0) {
          html += '<button class="primary-btn" data-audit-approve-show="' + s.showId + '" style="font-size:12px;padding:6px 10px">通过</button>';
          html += '<button class="ghost-btn" data-audit-reject-show="' + s.showId + '" style="font-size:12px;padding:6px 10px">驳回</button>';
        }
        if (s.auditStatus === 1) {
          html += '<button class="ghost-btn" data-audit-offline-show="' + s.showId + '" style="font-size:12px;padding:6px 10px">下架</button>';
        }
        html += '</td></tr>';
      });
      html += '</tbody></table>';
      adminEl.showAuditList.innerHTML = html;
    }
    if (adminState.auditTab === "shows") {
      renderPager("#adminAuditPager", adminState.auditPage, adminState.auditTotal, 10, loadShowAudit);
    }
  } catch (e) {
    adminEl.showAuditList.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="7">加载失败：' + esc(e.message) + '</td></tr></table>';
  }
}

async function loadPostAudit(page) {
  adminState.auditPage = page || 1;
  try {
    var data = await requestD("/admin/audit/posts?page=" + adminState.auditPage + "&size=10");
    adminState.auditTotal = data.total || 0;
    adminEl.auditMeta.textContent = "待审帖子 " + (data.total || 0) + " 项";
    var rows = data.records || [];
    if (rows.length === 0) {
      adminEl.postAuditList.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="7">暂无待审帖子</td></tr></table>';
    } else {
      var html = '<table class="data-table"><thead><tr><th>ID</th><th>标题</th><th>作者ID</th><th>举报次数</th><th>状态</th><th>发布时间</th><th>操作</th></tr></thead><tbody>';
      rows.forEach(function(p) {
        var reportBadge = (p.reportCount || 0) >= 5 ? ' <span class="chip chip-rejected" style="font-size:10px">' + p.reportCount + '次举报</span>' : '';
        html += '<tr>'
          + '<td>' + p.postId + '</td>'
          + '<td>' + esc(p.title || "") + reportBadge + '</td>'
          + '<td>' + (p.userId || "-") + '</td>'
          + '<td>' + (p.reportCount || 0) + '</td>'
          + '<td>' + statusChip(p.auditStatus) + '</td>'
          + '<td>' + fmtTime(p.postTime) + '</td>'
          + '<td class="inline-actions">';
        if (p.auditStatus === 0) {
          html += '<button class="primary-btn" data-audit-approve-post="' + p.postId + '" style="font-size:12px;padding:6px 10px">通过</button>';
        }
        if (p.auditStatus === 0 || p.auditStatus === 1) {
          html += '<button class="ghost-btn" data-audit-block-post="' + p.postId + '" style="font-size:12px;padding:6px 10px">屏蔽</button>';
        }
        if (p.auditStatus === 2) {
          html += '<button class="ghost-btn" data-audit-unblock-post="' + p.postId + '" style="font-size:12px;padding:6px 10px">撤销屏蔽</button>';
        }
        html += '</td></tr>';
      });
      html += '</tbody></table>';
      adminEl.postAuditList.innerHTML = html;
    }
    if (adminState.auditTab === "posts") {
      renderPager("#adminAuditPager", adminState.auditPage, adminState.auditTotal, 10, loadPostAudit);
    }
  } catch (e) {
    adminEl.postAuditList.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="7">加载失败：' + esc(e.message) + '</td></tr></table>';
  }
}

function auditActionShow(showId, action) {
  var remark = adminEl.auditRemark ? adminEl.auditRemark.value.trim() : "";
  requestD("/admin/audit/shows/" + showId + "/" + action, { method: "PUT", body: JSON.stringify({ remark: remark }) })
    .then(function() { toast("操作成功"); loadShowAudit(adminState.auditPage); })
    .catch(function(e) { toast(e.message); });
}

function auditActionPost(postId, action) {
  requestD("/admin/audit/posts/" + postId + "/" + action, { method: "PUT" })
    .then(function() { toast("操作成功"); loadPostAudit(adminState.auditPage); })
    .catch(function(e) { toast(e.message); });
}

// ==================== Show Audit Detail ====================

async function openShowAuditDetail(showId) {
  adminState.currentShowId = showId;
  adminSwitchSub("showDetail");
  try {
    var data = await requestD("/admin/audit/shows/" + showId);
    var show = data.show || data;
    var html = '<div class="detail-section">'
      + '<h4>基本信息</h4>'
      + '<dl class="detail-grid">'
      + '<dt>演出ID</dt><dd>' + show.showId + '</dd>'
      + '<dt>演出名称</dt><dd>' + esc(show.title) + '</dd>'
      + '<dt>类型</dt><dd>' + esc(show.category || "") + '</dd>'
      + '<dt>场馆</dt><dd>' + esc(show.venue || "") + '</dd>'
      + '<dt>状态</dt><dd>' + statusChip(show.auditStatus) + '</dd>'
      + '<dt>描述</dt><dd>' + esc(show.description || "") + '</dd>'
      + '<dt>阵容</dt><dd>' + esc(show.lineup || "") + '</dd>'
      + '<dt>须知</dt><dd>' + esc(show.notice || "") + '</dd>'
      + '<dt>海报</dt><dd>' + (show.posterUrl ? '<a href="' + esc(show.posterUrl) + '" target="_blank">查看</a>' : '-') + '</dd>'
      + '</dl></div>';

    if (data.sessions && data.sessions.length > 0) {
      html += '<div class="detail-section"><h4>场次与分区</h4>';
      data.sessions.forEach(function(sm, i) {
        var s = sm.session || sm;
        html += '<div class="detail-block" style="margin-bottom:12px">'
          + '<strong>场次 ' + (i + 1) + '</strong>'
          + '<p class="muted" style="margin:4px 0">' + fmtTime(s.startTime) + ' ~ ' + fmtTime(s.endTime) + '</p>';
        if (sm.zones && sm.zones.length > 0) {
          html += '<table class="data-table" style="margin-top:8px"><thead><tr><th>分区</th><th>票价</th><th>座位数</th><th>已售</th></tr></thead><tbody>';
          sm.zones.forEach(function(z) {
            html += '<tr><td>' + esc(z.name) + '</td><td>' + fmtPrice(z.price) + '</td><td>' + (z.totalSeats || 0) + '</td><td>' + (z.soldCount || 0) + '</td></tr>';
          });
          html += '</tbody></table>';
        }
        html += '</div>';
      });
      html += '</div>';
    }
    adminEl.showDetailBody.innerHTML = html;
  } catch (e) {
    adminEl.showDetailBody.innerHTML = '<p class="muted">加载失败：' + esc(e.message) + '</p>';
  }
}

// ==================== Qualification Audit ====================

async function loadQualAudit(page) {
  adminState.qualPage = page || 1;
  try {
    var data = await requestD("/admin/audit/qualifications?page=" + adminState.qualPage + "&size=10");
    adminState.qualTotal = data.total || 0;
    adminEl.qualMeta.textContent = "共 " + adminState.qualTotal + " 条申请";
    var rows = data.records || [];
    if (rows.length === 0) {
      adminEl.qualList.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="7">暂无申请</td></tr></table>';
    } else {
      var html = '<table class="data-table"><thead><tr><th>ID</th><th>用户ID</th><th>公司名称</th><th>联系人</th><th>电话</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      rows.forEach(function(q) {
        html += '<tr>'
          + '<td>' + (q.qualId) + '</td>'
          + '<td>' + q.userId + '</td>'
          + '<td>' + esc(q.companyName) + '</td>'
          + '<td>' + esc(q.contactName) + '</td>'
          + '<td>' + esc(q.contactPhone) + '</td>'
          + '<td>' + statusChip(q.auditStatus) + '</td>'
          + '<td class="inline-actions">';
        if (q.auditStatus === 0) {
          html += '<button class="primary-btn" data-qual-approve="' + (q.qualId) + '" style="font-size:12px;padding:6px 10px">通过</button>';
          html += '<button class="ghost-btn" data-qual-reject="' + (q.qualId) + '" style="font-size:12px;padding:6px 10px">驳回</button>';
        }
        html += '</td></tr>';
      });
      html += '</tbody></table>';
      adminEl.qualList.innerHTML = html;
    }
    renderPager("#adminQualPager", adminState.qualPage, adminState.qualTotal, 10, loadQualAudit);
  } catch (e) {
    adminEl.qualList.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="7">加载失败：' + esc(e.message) + '</td></tr></table>';
  }
}

// ==================== User Management ====================

async function loadUserList(page) {
  adminState.userPage = page || 1;
  try {
    var params = "?page=" + adminState.userPage + "&size=10";
    if (adminState.userKeyword) params += "&keyword=" + encodeURIComponent(adminState.userKeyword);
    var data = await requestD("/admin/users" + params);
    adminState.userTotal = data.total || 0;
    var rows = data.records || [];
    if (rows.length === 0) {
      adminEl.userList.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="6">暂无用户</td></tr></table>';
    } else {
      var html = '<table class="data-table"><thead><tr><th>ID</th><th>手机号</th><th>昵称</th><th>角色</th><th>注册时间</th><th>操作</th></tr></thead><tbody>';
      rows.forEach(function(u) {
        var phone = u.phone || "";
        var masked = phone.length > 7 ? phone.substring(0, 3) + "****" + phone.substring(7) : phone;
        var roleMap = { 0: "普通用户", 1: "演出方", 2: "管理员" };
        html += '<tr>'
          + '<td>' + u.userId + '</td>'
          + '<td>' + esc(masked) + '</td>'
          + '<td>' + esc(u.nickname || "-") + '</td>'
          + '<td>' + (roleMap[u.role] || "普通用户") + '</td>'
          + '<td>' + fmtTime(u.registerTime) + '</td>'
          + '<td><a data-admin-user-detail="' + u.userId + '">查看详情</a></td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      adminEl.userList.innerHTML = html;
    }
    renderPager("#adminUserPager", adminState.userPage, adminState.userTotal, 10, loadUserList);
  } catch (e) {
    adminEl.userList.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="6">加载失败：' + esc(e.message) + '</td></tr></table>';
  }
}

// ==================== User Detail ====================

async function openUserDetail(userId) {
  adminState.currentUserId = userId;
  adminSwitchSub("userDetail");
  try {
    var data = await requestD("/admin/users/" + userId);
    var u = data.user || data;
    var roleMap = { 0: "普通用户", 1: "演出方", 2: "管理员" };
    var html = '<div class="detail-section"><h4>基本信息</h4>'
      + '<dl class="detail-grid">'
      + '<dt>用户ID</dt><dd>' + u.userId + '</dd>'
      + '<dt>手机号</dt><dd>' + esc(u.phone || "-") + '</dd>'
      + '<dt>昵称</dt><dd>' + esc(u.nickname || "-") + '</dd>'
      + '<dt>角色</dt><dd>' + (roleMap[u.role] || "普通用户") + '</dd>'
      + '<dt>注册时间</dt><dd>' + fmtTime(u.registerTime) + '</dd>'
      + '</dl></div>';

    // Orders
    if (data.orders && data.orders.length > 0) {
      html += '<div class="detail-section"><h4>订单记录 (' + data.orders.length + ')</h4>';
      html += '<table class="data-table"><thead><tr><th>订单ID</th><th>金额</th><th>状态</th><th>时间</th></tr></thead><tbody>';
      data.orders.forEach(function(o) {
        html += '<tr><td>' + o.orderId + '</td><td>' + fmtPrice(o.totalAmount) + '</td><td>' + statusChip(o.status) + '</td><td>' + fmtTime(o.createdTime) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    // Posts
    if (data.posts && data.posts.length > 0) {
      html += '<div class="detail-section"><h4>发帖记录 (' + data.posts.length + ')</h4>';
      html += '<table class="data-table"><thead><tr><th>帖子ID</th><th>标题</th><th>时间</th></tr></thead><tbody>';
      data.posts.forEach(function(p) {
        html += '<tr><td>' + p.postId + '</td><td>' + esc(p.title || "") + '</td><td>' + fmtTime(p.postTime) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    // Violation history
    if (data.violationLogs && data.violationLogs.length > 0) {
      html += '<div class="detail-section"><h4>违规记录 (' + data.violationLogs.length + ')</h4>';
      html += '<table class="data-table"><thead><tr><th>时间</th><th>类型</th><th>原因</th></tr></thead><tbody>';
      data.violationLogs.forEach(function(v) {
        html += '<tr><td>' + fmtTime(v.createdAt) + '</td><td>' + esc(v.action || "") + '</td><td>' + esc(v.remark || "") + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    html += '<div class="detail-block" style="margin-top:16px">'
      + '<h4 style="margin:0 0 10px">违规处理</h4>'
      + '<div class="inline-actions" style="margin-bottom:10px">'
      + '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><span>原因:</span><input id="adminViolationReason" placeholder="说明违规原因" style="max-width:300px"></label>'
      + '</div>'
      + '<div class="inline-actions">'
      + '<button class="ghost-btn" data-user-warn="' + userId + '">警告</button>'
      + '<button class="ghost-btn" data-user-mute="' + userId + '">禁言</button>'
      + '<button class="ghost-btn" data-user-ban="' + userId + '">封禁</button>'
      + '</div>'
      + '<div id="adminMuteOptions" class="chip-row hidden" style="margin-top:8px">'
      + '<button class="chip chip-btn" data-mute-days="7" data-mute-uid="' + userId + '">禁言7天</button>'
      + '<button class="chip chip-btn" data-mute-days="14" data-mute-uid="' + userId + '">禁言14天</button>'
      + '<button class="chip chip-btn" data-mute-days="30" data-mute-uid="' + userId + '">禁言30天</button>'
      + '</div></div>';

    adminEl.userDetailBody.innerHTML = html;
  } catch (e) {
    adminEl.userDetailBody.innerHTML = '<p class="muted">加载失败：' + esc(e.message) + '</p>';
  }
}

function getViolationReason() {
  var inp = document.querySelector("#adminViolationReason");
  return inp ? inp.value.trim() : "";
}

// ==================== Order Management ====================

async function loadOrderList(page) {
  adminState.orderPage = page || 1;
  try {
    var fd = new FormData(adminEl.orderFilterForm);
    var params = "?page=" + adminState.orderPage + "&size=10";
    fd.forEach(function(v, k) { if (v) params += "&" + k + "=" + encodeURIComponent(String(v).trim()); });
    var data = await requestD("/admin/orders" + params);
    adminState.orderTotal = data.total || 0;
    adminEl.orderMeta.textContent = "共 " + adminState.orderTotal + " 条订单";
    var rows = (data.records || []).map(function(r) { return r && r.order ? r.order : r; });
    if (rows.length === 0) {
      adminEl.orderList.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="8">暂无订单</td></tr></table>';
    } else {
      var statusMap = { 0: "待支付", 1: "已支付", 2: "已退款", 3: "已取消", 4: "已完成" };
      var html = '<table class="data-table"><thead><tr><th>订单ID</th><th>用户</th><th>演出</th><th>金额</th><th>状态</th><th>下单时间</th><th class="col-md">操作</th></tr></thead><tbody>';
      rows.forEach(function(o) {
        html += '<tr>'
          + '<td>' + o.orderId + '</td>'
          + '<td>' + esc(o.userPhone || o.userId || "-") + '</td>'
          + '<td>' + esc(o.showTitle || o.showId || "-") + '</td>'
          + '<td>' + fmtPrice(o.totalAmount) + '</td>'
          + '<td>' + (statusMap[o.status] || "未知") + '</td>'
          + '<td>' + fmtTime(o.createdTime) + '</td>'
          + '<td class="inline-actions">';
        if (o.status === 1 || o.status === 4) {
          html += '<button class="ghost-btn" data-order-refund="' + o.orderId + '" style="font-size:12px;padding:6px 10px">退款</button>';
        }
        html += '<button class="ghost-btn" data-order-reissue="' + o.orderId + '" style="font-size:12px;padding:6px 10px">补发</button>'
          + '</td></tr>';
      });
      html += '</tbody></table>';
      adminEl.orderList.innerHTML = html;
    }
    renderPager("#adminOrderPager", adminState.orderPage, adminState.orderTotal, 10, loadOrderList);
  } catch (e) {
    adminEl.orderList.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="8">加载失败：' + esc(e.message) + '</td></tr></table>';
  }
}

// ==================== Recommend ====================

async function loadRecommends() {
  try {
    var shows = await requestD("/admin/recommends");
    if (!shows || shows.length === 0) {
      adminEl.recommendList.innerHTML = '<p class="muted">暂无推荐位</p>';
    } else {
      var html = '<div class="stack-list">';
      shows.forEach(function(s) {
        html += '<div class="stack-item" style="display:flex;justify-content:space-between;align-items:center">'
          + '<div><strong>' + esc(s.title) + '</strong> <span class="muted">ID:' + s.showId + '</span> <span class="muted">排序:' + (s.recommendOrder || "-") + '</span></div>'
          + '<button class="ghost-btn" data-recommend-remove="' + s.showId + '" style="font-size:12px;padding:6px 10px">取消推荐</button>'
          + '</div>';
      });
      html += '</div>';
      adminEl.recommendList.innerHTML = html;
    }
  } catch (e) {
    adminEl.recommendList.innerHTML = '<p class="muted">加载失败：' + esc(e.message) + '</p>';
  }
}

// ==================== Event Delegation ====================

document.addEventListener("DOMContentLoaded", function() {
  initAdminEl();

  // Sub-nav clicks
  adminEl.subNavBtns.forEach(function(b) {
    b.addEventListener("click", function() {
      adminSwitchSub(this.dataset.adminSub);
    });
  });

  // Order filter form
  adminEl.orderFilterForm.addEventListener("submit", function(e) {
    e.preventDefault();
    loadOrderList(1);
  });
  adminEl.orderFilterForm.addEventListener("reset", function() {
    setTimeout(function() { loadOrderList(1); }, 0);
  });

  // User search form
  adminEl.userSearchForm.addEventListener("submit", function(e) {
    e.preventDefault();
    adminState.userKeyword = new FormData(adminEl.userSearchForm).get("keyword") || "";
    loadUserList(1);
  });

  // Body delegation
  document.body.addEventListener("click", function(e) {
    // Admin back buttons
    var backBtn = e.target.closest("[data-admin-back]");
    if (backBtn) {
      adminSwitchSub(backBtn.dataset.adminBack);
      return;
    }

    // Audit tab switch
    var tabBtn = e.target.closest("[data-audit-tab]");
    if (tabBtn) {
      switchAuditTab(tabBtn.dataset.auditTab);
      return;
    }

    // Show approve/reject/offline
    var approveShow = e.target.closest("[data-audit-approve-show]");
    if (approveShow) { auditActionShow(approveShow.dataset.auditApproveShow, "approve"); return; }
    var rejectShow = e.target.closest("[data-audit-reject-show]");
    if (rejectShow) { auditActionShow(rejectShow.dataset.auditRejectShow, "reject"); return; }
    var offlineShow = e.target.closest("[data-audit-offline-show]");
    if (offlineShow) { auditActionShow(offlineShow.dataset.auditOfflineShow, "offline"); return; }

    // Post approve/block/unblock
    var approvePost = e.target.closest("[data-audit-approve-post]");
    if (approvePost) { auditActionPost(approvePost.dataset.auditApprovePost, "approve"); return; }
    var blockPost = e.target.closest("[data-audit-block-post]");
    if (blockPost) { auditActionPost(blockPost.dataset.auditBlockPost, "block"); return; }
    var unblockPost = e.target.closest("[data-audit-unblock-post]");
    if (unblockPost) { auditActionPost(unblockPost.dataset.auditUnblockPost, "unblock"); return; }

    // Show audit detail
    var showDetail = e.target.closest("[data-admin-show-detail]");
    if (showDetail) {
      openShowAuditDetail(parseInt(showDetail.dataset.adminShowDetail));
      return;
    }

    // Qualification approve/reject
    var qualApprove = e.target.closest("[data-qual-approve]");
    if (qualApprove) {
      if (confirm("确认通过该入驻申请？")) {
        requestD("/admin/audit/qualifications/" + qualApprove.dataset.qualApprove + "/approve", { method: "PUT" })
          .then(function() { toast("已通过"); loadQualAudit(adminState.qualPage); })
          .catch(function(err) { toast(err.message); });
      }
      return;
    }
    var qualReject = e.target.closest("[data-qual-reject]");
    if (qualReject) {
      var r = prompt("驳回原因（可选）：");
      requestD("/admin/audit/qualifications/" + qualReject.dataset.qualReject + "/reject", { method: "PUT", body: JSON.stringify({ remark: r || "" }) })
        .then(function() { toast("已驳回"); loadQualAudit(adminState.qualPage); })
        .catch(function(err) { toast(err.message); });
      return;
    }

    // User detail
    var userDetail = e.target.closest("[data-admin-user-detail]");
    if (userDetail) {
      openUserDetail(parseInt(userDetail.dataset.adminUserDetail));
      return;
    }

    // User warn/mute/ban
    var warnBtn = e.target.closest("[data-user-warn]");
    if (warnBtn) {
      var reason = getViolationReason();
      if (!reason) { toast("请填写违规原因"); return; }
      requestD("/admin/users/" + warnBtn.dataset.userWarn + "/warn", { method: "PUT", body: JSON.stringify({ reason: reason }) })
        .then(function() { toast("已警告"); openUserDetail(adminState.currentUserId); })
        .catch(function(err) { toast(err.message); });
      return;
    }
    var muteBtn = e.target.closest("[data-user-mute]");
    if (muteBtn) {
      var elm = document.querySelector("#adminMuteOptions");
      if (elm) elm.classList.toggle("hidden");
      return;
    }
    var muteDays = e.target.closest("[data-mute-days]");
    if (muteDays) {
      var days = parseInt(muteDays.dataset.muteDays);
      var uid = parseInt(muteDays.dataset.muteUid);
      var mreason = getViolationReason() || "违规禁言";
      requestD("/admin/users/" + uid + "/mute", { method: "PUT", body: JSON.stringify({ durationDays: days, reason: mreason }) })
        .then(function() { toast("已禁言" + days + "天"); document.querySelector("#adminMuteOptions").classList.add("hidden"); openUserDetail(uid); })
        .catch(function(err) { toast(err.message); });
      return;
    }
    var banBtn = e.target.closest("[data-user-ban]");
    if (banBtn) {
      var breason = getViolationReason();
      if (!breason) { toast("请填写封禁原因"); return; }
      if (!confirm("确定封禁该用户？此操作不可逆。")) return;
      requestD("/admin/users/" + banBtn.dataset.userBan + "/ban", { method: "PUT", body: JSON.stringify({ reason: breason }) })
        .then(function() { toast("已封禁"); openUserDetail(adminState.currentUserId); })
        .catch(function(err) { toast(err.message); });
      return;
    }

    // Order refund/reissue
    var refundBtn = e.target.closest("[data-order-refund]");
    if (refundBtn) {
      var rreason = prompt("退款原因：");
      if (rreason === null) return;
      requestD("/admin/orders/" + refundBtn.dataset.orderRefund + "/refund", { method: "PUT", body: JSON.stringify({ reason: rreason || "" }) })
        .then(function() { toast("已退款"); loadOrderList(adminState.orderPage); })
        .catch(function(err) { toast(err.message); });
      return;
    }
    var reissueBtn = e.target.closest("[data-order-reissue]");
    if (reissueBtn) {
      if (!confirm("确认补发电子票？")) return;
      requestD("/admin/orders/" + reissueBtn.dataset.orderReissue + "/reissue", { method: "PUT" })
        .then(function() { toast("电子票已补发"); loadOrderList(adminState.orderPage); })
        .catch(function(err) { toast(err.message); });
      return;
    }

    // Recommend remove
    var recRemove = e.target.closest("[data-recommend-remove]");
    if (recRemove) {
      requestD("/admin/recommends/" + recRemove.dataset.recommendRemove, { method: "DELETE" })
        .then(function() { toast("已取消推荐"); loadRecommends(); })
        .catch(function(err) { toast(err.message); });
      return;
    }

    // Recommend add
    if (e.target.closest("#adminAddRecommendBtn")) {
      var showId = parseInt(adminEl.addRecommendInput.value);
      if (!showId) { toast("请输入演出ID"); return; }
      requestD("/admin/recommends", { method: "PUT", body: JSON.stringify([showId]) })
        .then(function() { toast("已添加推荐"); adminEl.addRecommendInput.value = ""; loadRecommends(); })
        .catch(function(err) { toast(err.message); });
      return;
    }
  });

  // Show approve/reject from detail page
  document.querySelector("#adminApproveShowBtn").addEventListener("click", function() {
    if (!adminState.currentShowId) return;
    auditActionShow(adminState.currentShowId, "approve");
    setTimeout(function() { adminSwitchSub("auditCenter"); }, 500);
  });
  document.querySelector("#adminRejectShowBtn").addEventListener("click", function() {
    if (!adminState.currentShowId) return;
    auditActionShow(adminState.currentShowId, "reject");
    setTimeout(function() { adminSwitchSub("auditCenter"); }, 500);
  });
  document.querySelector("#adminOfflineShowBtn").addEventListener("click", function() {
    if (!adminState.currentShowId) return;
    auditActionShow(adminState.currentShowId, "offline");
    setTimeout(function() { adminSwitchSub("auditCenter"); }, 500);
  });
});
