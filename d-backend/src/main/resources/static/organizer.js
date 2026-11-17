// ============================================================
// Organizer Backend — 演出方后台
// ============================================================

var orgState = {
  subView: "qual",
  qualApproved: false,
  statusFilter: "",
  showPage: 1, showTotal: 0,
  editShowId: null,
  editStep: 1,
  editSessions: [],
  salesShowId: null,
  myShows: [],
};

var orgEl = {};

function initOrgEl() {
  orgEl = {
    subNavBtns: document.querySelectorAll("[data-org-sub]"),
    qualSection: document.querySelector("#orgQualSection"),
    qualStatus: document.querySelector("#orgQualStatus"),
    qualForm: document.querySelector("#orgQualForm"),
    showListSection: document.querySelector("#orgShowListSection"),
    showMeta: document.querySelector("#orgShowMeta"),
    showTable: document.querySelector("#orgShowTable"),
    showPager: document.querySelector("#orgShowPager"),
    statusFilters: document.querySelector("#orgStatusFilters"),
    editSection: document.querySelector("#orgShowEditSection"),
    editTitle: document.querySelector("#orgEditTitle"),
    editNavBtn: document.querySelector("#orgEditNavBtn"),
    editSteps: document.querySelector("#orgEditSteps"),
    editStep1: document.querySelector("#orgEditStep1"),
    editStep2: document.querySelector("#orgEditStep2"),
    editStep3: document.querySelector("#orgEditStep3"),
    sessionList: document.querySelector("#orgSessionList"),
    step3Sessions: document.querySelector("#orgEditStep3Sessions"),
    salesSection: document.querySelector("#orgSalesSection"),
    salesShowSelect: document.querySelector("#orgSalesShowSelect"),
    salesOverview: document.querySelector("#orgSalesOverview"),
    salesZoneTable: document.querySelector("#orgSalesZoneTable"),
  };
}

// ---------- Sub-view switching ----------
function orgSwitchSub(name) {
  // role=0 can only access qualification
  if (state.user && state.user.role === 0 && name !== "qual") {
    toast("请先完成资质入驻并通过审核，才能进行演出管理");
    name = "qual";
  }
  orgState.subView = name;

  // Show/hide sub-nav tabs based on role
  var isConsumer = state.user && state.user.role === 0;
  var qualBtn = document.querySelector("[data-org-sub=\"qual\"]");
  var listBtn = document.querySelector("[data-org-sub=\"list\"]");
  var salesBtn = document.querySelector("[data-org-sub=\"sales\"]");
  if (qualBtn) qualBtn.style.display = isConsumer ? "" : "none";
  if (listBtn) listBtn.style.display = isConsumer ? "none" : "";
  if (salesBtn) salesBtn.style.display = isConsumer ? "none" : "";

  // Show/hide sections
  if (orgEl.qualSection) orgEl.qualSection.classList.toggle("hidden", name !== "qual");
  if (orgEl.showListSection) orgEl.showListSection.classList.toggle("hidden", name !== "list");
  if (orgEl.editSection) orgEl.editSection.classList.toggle("hidden", name !== "edit");
  if (orgEl.salesSection) orgEl.salesSection.classList.toggle("hidden", name !== "sales");
  if (orgEl.editNavBtn) orgEl.editNavBtn.style.display = name === "edit" ? "" : "none";

  // Active state on sub-nav
  orgEl.subNavBtns.forEach(function(b) { b.classList.toggle("active", b.dataset.orgSub === name); });

  if (name === "qual") loadQualStatus();
  if (name === "list") loadShowList(1);
  if (name === "sales") loadSalesShows();
}

// ==================== Qualification ====================

async function loadQualStatus() {
  try {
    var data = await requestD("/organizer/qualification/status");
    if (!data) {
      orgState.qualApproved = false;
      orgEl.qualStatus.innerHTML = '<div class="detail-block"><p class="muted">尚未提交入驻申请。请先申请资质入驻，审核通过后即可发布演出。</p></div>';
      orgEl.qualForm.classList.remove("hidden");
    } else {
      orgState.qualApproved = data.auditStatus === 1;
      orgEl.qualForm.classList.add("hidden");
      var sc = statusChip(data.auditStatus != null ? data.auditStatus : 0);
      var html = '<div class="detail-block"><dl class="detail-grid">'
        + '<dt>公司名称</dt><dd>' + esc(data.companyName) + '</dd>'
        + '<dt>信用代码</dt><dd>' + esc(data.creditCode) + '</dd>'
        + '<dt>联系人</dt><dd>' + esc(data.contactName) + '</dd>'
        + '<dt>联系电话</dt><dd>' + esc(data.contactPhone) + '</dd>'
        + '<dt>审核状态</dt><dd>' + sc + '</dd>';
      if (data.auditRemark) html += '<dt>审核备注</dt><dd>' + esc(data.auditRemark) + '</dd>';
      if (!orgState.qualApproved) {
        html += '</dl><p class="muted" style="margin-top:8px">审核通过后即可管理演出。</p></div>';
      } else {
        html += '</dl></div>';
      }
      orgEl.qualStatus.innerHTML = html;
    }
  } catch (e) {
    orgState.qualApproved = false;
    orgEl.qualStatus.innerHTML = '<div class="detail-block"><p class="muted">' + esc(e.message) + '</p></div>';
    orgEl.qualForm.classList.remove("hidden");
  }
  // Hide qual tab if approved, show list instead
  updateQualNav();
}

function updateQualNav() {
  // Only auto-redirect: if approved and still on qual, go to list
  if (orgState.qualApproved && orgState.subView === "qual") {
    orgSwitchSub("list");
  }
}

function submitQualApply(e) {
  e.preventDefault();
  var fd = new FormData(orgEl.qualForm);
  var body = {};
  fd.forEach(function(v, k) { body[k] = v.trim(); });
  requestD("/organizer/qualification/apply", { method: "POST", body: JSON.stringify(body) })
    .then(function() { toast("申请已提交，请等待审核"); loadQualStatus(); })
    .catch(function(err) { toast(err.message); });
}

// ==================== Show List ====================

async function loadShowList(page) {
  orgState.showPage = page || 1;
  try {
    var params = "?page=" + orgState.showPage + "&size=10";
    if (orgState.statusFilter !== "") params += "&auditStatus=" + orgState.statusFilter;
    var data = await requestD("/organizer/show/my" + params);
    orgState.showTotal = data.total || 0;
    orgEl.showMeta.textContent = "共 " + orgState.showTotal + " 场演出";
    var rows = data.records || [];
    if (rows.length === 0) {
      orgEl.showTable.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="7">暂无演出</td></tr></table>';
    } else {
      var html = '<table class="data-table"><thead><tr><th>ID</th><th>演出名称</th><th>类型</th><th>状态</th><th>创建时间</th><th class="col-lg">操作</th></tr></thead><tbody>';
      rows.forEach(function(s) {
        html += '<tr><td>' + s.showId + '</td>'
          + '<td><a data-org-edit="' + s.showId + '">' + esc(s.title) + '</a></td>'
          + '<td>' + esc(s.category || "") + '</td>'
          + '<td>' + statusChip(s.auditStatus) + '</td>'
          + '<td>' + fmtTime(s.createdTime) + '</td>'
          + '<td class="inline-actions">'
          + '<button class="ghost-btn" data-org-edit="' + s.showId + '" style="font-size:12px;padding:6px 10px">编辑</button>';
        if (s.auditStatus === 4) {
          html += '<button class="primary-btn" data-org-submit="' + s.showId + '" style="font-size:12px;padding:6px 10px">提交审核</button>';
        }
        html += '<button class="ghost-btn" data-org-sales="' + s.showId + '" style="font-size:12px;padding:6px 10px">销售数据</button></td></tr>';
      });
      html += '</tbody></table>';
      orgEl.showTable.innerHTML = html;
    }
    renderPager("#orgShowPager", orgState.showPage, orgState.showTotal, 10, loadShowList);
    orgState.myShows = rows;
    updateSalesSelect();
  } catch (e) {
    orgEl.showTable.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="7">加载失败：' + esc(e.message) + '</td></tr></table>';
  }
}

function updateSalesSelect() {
  if (!orgEl.salesShowSelect) return;
  var opts = '<option value="">请选择演出</option>';
  orgState.myShows.forEach(function(s) { opts += '<option value="' + s.showId + '">' + esc(s.title) + ' (ID:' + s.showId + ')</option>'; });
  orgEl.salesShowSelect.innerHTML = opts;
  if (orgState.salesShowId && orgState.myShows.length > 0) orgEl.salesShowSelect.value = orgState.salesShowId;
}

// ==================== Show Edit ====================

function openShowEdit(showId) {
  orgState.editShowId = showId;
  orgState.editStep = 1;
  orgState.editSessions = [];
  orgEl.editTitle.textContent = showId ? "编辑演出 #" + showId : "新建演出";
  orgSwitchSub("edit");
  orgEl.editStep1.reset();
  orgEl.editStep1.classList.remove("hidden");
  orgEl.editStep2.classList.add("hidden");
  orgEl.editStep3.classList.add("hidden");
  updateEditSteps(1);

  if (showId) {
    requestD("/organizer/show/" + showId + "/detail").then(function(data) {
      var s = data.show || data;
      var f = orgEl.editStep1;
      f.title.value = s.title || "";
      f.category.value = s.category || "";
      f.venue.value = s.venue || "";
      f.description.value = s.description || "";
      f.lineup.value = s.lineup || "";
      f.notice.value = s.notice || "";
      f.posterUrl.value = s.posterUrl || "";

      var sessionList = data.sessions || [];
      orgState.editSessions = sessionList.map(function(sm) {
        var sess = sm.session || sm;
        return {
          sessionId: sess.sessionId,
          startTime: sess.startTime ? sess.startTime.substring(0, 16) : "",
          endTime: sess.endTime ? sess.endTime.substring(0, 16) : "",
          ticketOpenTime: sess.ticketOpenTime ? sess.ticketOpenTime.substring(0, 16) : "",
          refundDeadline: sess.refundDeadline ? sess.refundDeadline.substring(0, 16) : "",
          maxPerOrder: sess.maxPerOrder || 5,
          allowRefund: sess.allowRefund != null ? sess.allowRefund : 1,
          refundFeeRate: sess.refundFeeRate || 0,
          waitingEnabled: sess.waitingEnabled || 0,
          seatSelectEnabled: sess.seatSelectEnabled != null ? sess.seatSelectEnabled : 1,
          zones: (sm.zones || []).map(function(z) {
            return {
              zoneId: z.zoneId, name: z.name || "",
              price: z.price || "", totalSeats: z.totalSeats || ""
            };
          })
        };
      });
    }).catch(function(e) { toast(e.message); });
  }
}

function updateEditSteps(step) {
  orgState.editStep = step;
  orgEl.editSteps.querySelectorAll(".step").forEach(function(s) {
    var n = parseInt(s.dataset.n);
    s.classList.remove("active", "done");
    if (n < step) s.classList.add("done");
    if (n === step) s.classList.add("active");
  });
  orgEl.editSteps.querySelectorAll(".step-line").forEach(function(l, i) { l.classList.toggle("done", i < step - 1); });
}

function goStep(step) {
  if (step >= 2) {
    var f = orgEl.editStep1;
    if (!f.title.value.trim()) { toast("请输入演出名称"); return; }
    if (!f.category.value) { toast("请选择演出类型"); return; }
    if (!f.venue.value.trim()) { toast("请输入场馆"); return; }
  }
  if (step === 2) renderStep2();
  if (step === 3) { readStep2Inputs(); renderStep3(); }
  orgEl.editStep1.classList.toggle("hidden", step !== 1);
  orgEl.editStep2.classList.toggle("hidden", step !== 2);
  orgEl.editStep3.classList.toggle("hidden", step !== 3);
  updateEditSteps(step);
}

function renderStep2() {
  if (orgState.editSessions.length === 0) {
    orgState.editSessions.push({
      startTime: "", endTime: "", ticketOpenTime: "", refundDeadline: "",
      maxPerOrder: 5, allowRefund: 1, refundFeeRate: 0, waitingEnabled: 0, seatSelectEnabled: 1,
      seatRows: null, seatCols: null,
      zones: [{ name: "", price: "", totalSeats: "" }]
    });
  }
  var html = "";
  orgState.editSessions.forEach(function(s, i) {
    var seatSel = s.seatSelectEnabled != null ? s.seatSelectEnabled : 1;
    html += '<div class="session-card">'
      + '<div class="session-head"><h4>场次 ' + (i + 1) + '</h4>'
      + '<button class="ghost-btn" data-session-remove="' + i + '" style="font-size:12px;padding:6px 10px">删除</button></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
      + '<label><span>开始时间</span><input data-sess="' + i + '" data-field="startTime" type="datetime-local" value="' + esc(s.startTime) + '"></label>'
      + '<label><span>结束时间</span><input data-sess="' + i + '" data-field="endTime" type="datetime-local" value="' + esc(s.endTime) + '"></label>'
      + '</div>'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:8px">'
      + '<input type="checkbox" class="seat-select-toggle" data-sess="' + i + '" data-field="seatSelectEnabled" ' + (seatSel == 1 ? 'checked' : '') + '>'
      + '<span>支持手动选座（勾选后消费者可按具体座位选座）</span></label>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">'
      + '<label style="' + (seatSel == 1 ? '' : 'display:none') + '"><span>座位行数</span><input data-sess="' + i + '" data-field="seatRows" type="number" min="1" value="' + (s.seatRows || '') + '" placeholder="如：20"></label>'
      + '<label style="' + (seatSel == 1 ? '' : 'display:none') + '"><span>座位列数</span><input data-sess="' + i + '" data-field="seatCols" type="number" min="1" value="' + (s.seatCols || '') + '" placeholder="如：30"></label>'
      + '</div>'
      + '<div class="zone-list"><strong style="font-size:13px;color:var(--muted)">分区配置</strong>';
    s.zones.forEach(function(z, j) {
      html += '<div class="zone-row" style="display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:10px;align-items:end;margin-top:8px">'
        + '<label><span>分区名</span><input data-sess="' + i + '" data-zone="' + j + '" data-zfield="name" value="' + esc(z.name) + '" placeholder="如：A区/VIP"></label>'
        + '<label><span>票价</span><input data-sess="' + i + '" data-zone="' + j + '" data-zfield="price" type="number" value="' + z.price + '" step="0.01" min="0"></label>'
        + '<label><span>可售数量</span><input data-sess="' + i + '" data-zone="' + j + '" data-zfield="totalSeats" type="number" value="' + z.totalSeats + '" min="1"></label>'
        + '<button class="ghost-btn" data-zone-remove="' + i + '" data-zone-idx="' + j + '" style="font-size:12px;padding:6px 8px">×</button>'
        + '</div>';
    });
    html += '<button class="ghost-btn" data-zone-add="' + i + '" style="font-size:12px;margin-top:8px">+ 添加分区</button></div></div>';
  });
  orgEl.sessionList.innerHTML = html;
}

function addSession() {
  readStep2Inputs();
  orgState.editSessions.push({
    startTime: "", endTime: "", ticketOpenTime: "", refundDeadline: "",
    maxPerOrder: 5, allowRefund: 1, refundFeeRate: 0, waitingEnabled: 0, seatSelectEnabled: 1,
    seatRows: null, seatCols: null,
    zones: [{ name: "", price: "", totalSeats: "" }]
  });
  renderStep2();
}

function removeSession(i) {
  readStep2Inputs();
  orgState.editSessions.splice(i, 1);
  renderStep2();
}

function addZone(si) {
  readStep2Inputs();
  orgState.editSessions[si].zones.push({ name: "", price: "", totalSeats: "" });
  renderStep2();
}

function removeZone(si, zi) {
  readStep2Inputs();
  orgState.editSessions[si].zones.splice(zi, 1);
  renderStep2();
}

function readStep2Inputs() {
  orgEl.sessionList.querySelectorAll("[data-field]").forEach(function(inp) {
    var si = parseInt(inp.dataset.sess), field = inp.dataset.field;
    if (!orgState.editSessions[si]) return;
    if (field === "seatSelectEnabled") {
      orgState.editSessions[si][field] = inp.checked ? 1 : 0;
    } else if (field === "seatRows" || field === "seatCols") {
      var v = parseInt(inp.value);
      orgState.editSessions[si][field] = isNaN(v) ? null : v;
    } else if (inp.type === "number") {
      orgState.editSessions[si][field] = parseInt(inp.value) || 0;
    } else {
      orgState.editSessions[si][field] = inp.value;
    }
  });
  orgEl.sessionList.querySelectorAll("[data-zfield]").forEach(function(inp) {
    var si = parseInt(inp.dataset.sess), zi = parseInt(inp.dataset.zone), field = inp.dataset.zfield;
    if (orgState.editSessions[si] && orgState.editSessions[si].zones[zi]) {
      if (field === "price") {
        orgState.editSessions[si].zones[zi].price = parseFloat(inp.value) || 0;
      } else if (field === "totalSeats") {
        orgState.editSessions[si].zones[zi].totalSeats = parseInt(inp.value) || 0;
      } else {
        orgState.editSessions[si].zones[zi][field] = inp.value;
      }
    }
  });
}

function renderStep3() {
  var html = "";
  orgState.editSessions.forEach(function(s, i) {
    html += '<div class="session-card">'
      + '<h4 style="margin:0 0 12px">场次 ' + (i + 1) + ' 票务规则</h4>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
      + '<label><span>开票时间</span><input id="step3_ses' + i + '_ticketOpenTime" type="datetime-local" value="' + esc(s.ticketOpenTime || "") + '"></label>'
      + '<label><span>退票截止时间</span><input id="step3_ses' + i + '_refundDeadline" type="datetime-local" value="' + esc(s.refundDeadline || "") + '"></label>'
      + '<label><span>每单限购</span><input id="step3_ses' + i + '_maxPerOrder" type="number" min="1" value="' + s.maxPerOrder + '"></label>'
      + '<label><span>退票手续费率(%)</span><input id="step3_ses' + i + '_refundFeeRate" type="number" min="0" max="100" value="' + s.refundFeeRate + '"></label>'
      + '</div>'
      + '<div class="inline-actions" style="margin-top:10px">'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:13px"><input id="step3_ses' + i + '_allowRefund" type="checkbox" ' + (s.allowRefund ? "checked" : "") + '><span>支持退票</span></label>'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:13px"><input id="step3_ses' + i + '_waitingEnabled" type="checkbox" ' + (s.waitingEnabled ? "checked" : "") + '><span>开启候补</span></label>'
      + '</div></div>';
  });
  orgEl.step3Sessions.innerHTML = html;
}

function readStep3Inputs() {
  orgState.editSessions.forEach(function(s, i) {
    var pref = "#step3_ses" + i + "_";
    var el2 = function(id) { return document.querySelector(pref + id); };
    if (el2("ticketOpenTime")) s.ticketOpenTime = el2("ticketOpenTime").value;
    if (el2("refundDeadline")) s.refundDeadline = el2("refundDeadline").value;
    if (el2("maxPerOrder")) s.maxPerOrder = parseInt(el2("maxPerOrder").value) || 5;
    if (el2("refundFeeRate")) s.refundFeeRate = parseInt(el2("refundFeeRate").value) || 0;
    if (el2("allowRefund")) s.allowRefund = el2("allowRefund").checked ? 1 : 0;
    if (el2("waitingEnabled")) s.waitingEnabled = el2("waitingEnabled").checked ? 1 : 0;
  });
}

function buildShowDTO() {
  var f = orgEl.editStep1;
  return {
    title: f.title.value.trim(), category: f.category.value, venue: f.venue.value.trim(),
    description: f.description.value.trim(), lineup: f.lineup.value.trim(),
    notice: f.notice.value.trim(), posterUrl: f.posterUrl.value.trim(),
    sessions: orgState.editSessions.map(function(s) {
      return {
        startTime: s.startTime ? s.startTime + ":00" : "",
        endTime: s.endTime ? s.endTime + ":00" : "",
        ticketOpenTime: s.ticketOpenTime ? s.ticketOpenTime + ":00" : null,
        refundDeadline: s.refundDeadline ? s.refundDeadline + ":00" : null,
        maxPerOrder: s.maxPerOrder, allowRefund: s.allowRefund,
        refundFeeRate: s.refundFeeRate, waitingEnabled: s.waitingEnabled,
        seatSelectEnabled: s.seatSelectEnabled != null ? s.seatSelectEnabled : 1,
        seatRows: s.seatRows || null,
        seatCols: s.seatCols || null,
        zones: s.zones.map(function(z) {
          return {
            name: z.name, price: parseFloat(z.price), totalSeats: parseInt(z.totalSeats)
          };
        })
      };
    })
  };
}

// Fix 5: saveShow distinguishes between update+save and update+submit
async function saveShow(submit) {
  readStep2Inputs(); readStep3Inputs();
  var dto = buildShowDTO();
  if (orgState.editShowId) {
    if (submit) {
      // Editing existing show: first save, then submit
      await requestD("/organizer/show/" + orgState.editShowId, { method: "PUT", body: JSON.stringify(dto) });
      await requestD("/organizer/show/" + orgState.editShowId + "/submit", { method: "PUT" });
    } else {
      await requestD("/organizer/show/" + orgState.editShowId, { method: "PUT", body: JSON.stringify(dto) });
    }
  } else {
    var url = submit ? "/organizer/show/create-and-submit" : "/organizer/show/create";
    await requestD(url, { method: "POST", body: JSON.stringify(dto) });
  }
  toast(submit ? "已提交审核" : "草稿已保存");
  orgSwitchSub("list");
  loadShowList(1);
}

// ==================== Sales ====================

function loadSalesShows() {
  // Refresh my shows to populate select
  requestD("/organizer/show/my?page=1&size=50").then(function(data) {
    orgState.myShows = data.records || [];
    updateSalesSelect();
  }).catch(function() {});
}

async function loadSalesData(showId) {
  orgState.salesShowId = showId;
  if (!showId) { orgEl.salesOverview.innerHTML = ""; orgEl.salesZoneTable.innerHTML = ""; return; }
  try {
    var overview = await requestD("/organizer/sales/" + showId + "/overview");
    var rate = overview.sellRate != null ? (overview.sellRate * 100).toFixed(1) + "%" : "0.0%";
    orgEl.salesOverview.innerHTML =
      '<div class="stat-card"><span class="stat-label">总订单</span><span class="stat-value">' + (overview.totalOrders || 0) + '</span></div>'
      + '<div class="stat-card"><span class="stat-label">销售额</span><span class="stat-value">' + fmtPrice(overview.totalSales) + '</span></div>'
      + '<div class="stat-card"><span class="stat-label">售出率</span><span class="stat-value">' + rate + '</span></div>'
      + '<div class="stat-card"><span class="stat-label">已售座位</span><span class="stat-value">' + (overview.soldSeats || 0) + '</span></div>';

    var zones = await requestD("/organizer/sales/" + showId + "/zone-detail");
    if (!zones || zones.length === 0) {
      orgEl.salesZoneTable.innerHTML = '<table class="data-table"><tr class="empty-row"><td colspan="6">暂无分区数据</td></tr></table>';
    } else {
      var html = '<table class="data-table"><thead><tr><th>分区名</th><th>票价</th><th>总座位</th><th>已售</th><th>销售额</th><th>售出率</th></tr></thead><tbody>';
      zones.forEach(function(z) {
        html += '<tr><td>' + esc(z.zoneName) + '</td><td>' + fmtPrice(z.price) + '</td><td>' + (z.totalSeats || 0)
          + '</td><td>' + (z.soldCount || 0) + '</td><td>' + fmtPrice(z.salesAmount) + '</td>'
          + '<td>' + (z.sellRate != null ? (z.sellRate * 100).toFixed(1) + "%" : "-") + '</td></tr>';
      });
      html += '</tbody></table>';
      orgEl.salesZoneTable.innerHTML = html;
    }
  } catch (e) {
    orgEl.salesOverview.innerHTML = '<p class="muted">加载失败：' + esc(e.message) + '</p>';
  }
}

// ==================== Event Delegation ====================

document.addEventListener("DOMContentLoaded", function() {
  initOrgEl();
  orgEl.subNavBtns.forEach(function(b) {
    b.addEventListener("click", function() { orgSwitchSub(this.dataset.orgSub); });
  });
  orgEl.qualForm.addEventListener("submit", submitQualApply);

  orgEl.statusFilters.addEventListener("click", function(e) {
    var chip = e.target.closest("[data-org-status]");
    if (!chip) return;
    orgEl.statusFilters.querySelectorAll(".chip-btn").forEach(function(c) { c.classList.remove("active"); });
    chip.classList.add("active");
    orgState.statusFilter = chip.dataset.orgStatus;
    loadShowList(1);
  });

  document.querySelector("#orgNewShowBtn").addEventListener("click", function() { openShowEdit(null); });

  document.body.addEventListener("click", function(e) {
    if (e.target.closest("[data-org-back]")) { orgSwitchSub("list"); return; }
    var editBtn = e.target.closest("[data-org-edit]");
    if (editBtn) { openShowEdit(parseInt(editBtn.dataset.orgEdit)); return; }
    var submitBtn = e.target.closest("[data-org-submit]");
    if (submitBtn) {
      var sid = parseInt(submitBtn.dataset.orgSubmit);
      if (confirm("确定提交审核？")) {
        requestD("/organizer/show/" + sid + "/submit", { method: "PUT" })
          .then(function() { toast("已提交审核"); loadShowList(1); })
          .catch(function(e) { toast(e.message); });
      }
      return;
    }
    var salesBtn = e.target.closest("[data-org-sales]");
    if (salesBtn) { orgState.salesShowId = parseInt(salesBtn.dataset.orgSales); orgSwitchSub("sales"); loadSalesData(orgState.salesShowId); return; }
    if (e.target.closest("[data-step-next]")) { goStep(parseInt(e.target.closest("[data-step-next]").dataset.stepNext)); return; }
    if (e.target.closest("[data-step-prev]")) { goStep(parseInt(e.target.closest("[data-step-prev]").dataset.stepPrev)); return; }
    if (e.target.closest("#orgAddSessionBtn")) { addSession(); return; }
    var srem = e.target.closest("[data-session-remove]");
    if (srem) { removeSession(parseInt(srem.dataset.sessionRemove)); return; }
    var zadd = e.target.closest("[data-zone-add]");
    if (zadd) { addZone(parseInt(zadd.dataset.zoneAdd)); return; }
    var zrem = e.target.closest("[data-zone-remove]");
    if (zrem) { removeZone(parseInt(zrem.dataset.zoneRemove), parseInt(zrem.dataset.zoneIdx)); return; }
    if (e.target.closest("#orgSaveDraftBtn")) { saveShow(false); return; }
    if (e.target.closest("#orgSubmitReviewBtn")) { saveShow(true); return; }
  });

  orgEl.salesShowSelect.addEventListener("change", function() { loadSalesData(this.value ? parseInt(this.value) : null); });

  // Seat select toggle — show/hide rows/cols inputs
  document.body.addEventListener("change", function(e) {
    var cb = e.target.closest(".seat-select-toggle");
    if (!cb) return;
    var si = cb.dataset.sess;
    var rows = document.querySelector('[data-sess="' + si + '"][data-field="seatRows"]');
    var cols = document.querySelector('[data-sess="' + si + '"][data-field="seatCols"]');
    var show = cb.checked;
    if (rows) rows.closest("label").style.display = show ? "" : "none";
    if (cols) cols.closest("label").style.display = show ? "" : "none";
  });
});
