import { request, setToken } from "./api.js";
import { el, state } from "./state.js";
import {
  buildFavoriteButton,
  formatPrice,
  formatTime,
  posterFallback,
  toast,
} from "./helpers.js";
import {
  applyFavoriteState,
  openAuth,
  hideDrawer,
  renderFeatured,
  renderHomeShows,
  renderSearchResults,
  showDrawer,
  switchView,
} from "./render.js";
import { ensureVerified, loadProfile } from "./actions.js";
function orderStatusTone(status) {
  return {
    0: "pending",
    1: "paid",
    2: "refunded",
    3: "canceled",
    4: "completed",
  }[Number(status)] || "pending";
}

function paymentMethodLabel(value) {
  return {
    wechat: "微信支付",
    alipay: "支付宝",
    bank: "银行卡",
  }[value || ""] || "微信支付";
}

function savePaymentMethod(orderId, method) {
  state.paymentMethods[String(orderId)] = method || "wechat";
  localStorage.setItem("ticket_payment_methods", JSON.stringify(state.paymentMethods));
}

function getPaymentMethod(orderId) {
  return state.paymentMethods[String(orderId)] || "wechat";
}

function renderOrderPanel(orders, waitlist) {
  const filters = [
    ["", "全部"],
    ["0", "待支付"],
    ["1", "已支付"],
    ["2", "已退款"],
    ["3", "已取消"],
  ];
  const orderItems = orders || [];
  const waitlistItems = (waitlist || []).filter(function (item) {
    return Number(item.status) === 0 || Number(item.status) === 1;
  });

  el.orderList.innerHTML = `
    <div class="order-filter-bar">
      ${filters.map(function (item) {
        return `<button class="ghost-btn ${String(state.orderStatusFilter) === item[0] ? "active" : ""}" data-order-filter="${item[0]}" type="button">${item[1]}</button>`;
      }).join("")}
    </div>
    <div class="stack-list">
      ${orderItems.length ? orderItems.map(function (item) {
        return `
          <article class="order-card">
            <img src="${item.poster_url || posterFallback(item.title)}" alt="${item.title}">
            <div class="order-card-body">
              <div class="detail-tags">
                <span class="chip order-status-${orderStatusTone(item.status)}">${item.status_label}</span>
                <span class="chip">订单 ${item.order_id}</span>
              </div>
              <strong>${item.title}</strong>
              <span class="muted">${formatTime(item.start_time)} · ${item.zone_name}</span>
              <span class="muted">${item.seat_labels || "未选座位"} · ${item.ticket_count} 张</span>
              <div class="order-card-foot">
                <strong>${formatPrice(item.total_amount)}</strong>
                <button class="ghost-btn" data-order-detail="${item.order_id}" type="button">查看订单</button>
              </div>
            </div>
          </article>
        `;
      }).join("") : '<div class="placeholder-card">暂无订单。</div>'}
    </div>
    <div class="waitlist-mini">
      <div class="sub-head">
        <h4>候补订单</h4>
        <span>${waitlistItems.length} 条</span>
      </div>
      <div class="stack-list">
        ${waitlistItems.length ? waitlistItems.map(function (item) {
          return `
            <div class="stack-item waitlist-card">
              <div class="detail-tags">
                <span class="chip">${item.status_label}</span>
                <span class="chip">排队号 ${item.queue_order}</span>
              </div>
              <strong>${item.title}</strong>
              <span class="muted">${formatTime(item.start_time)} · ${item.zone_name} · ${formatPrice(item.price)}</span>
              ${item.expire_time ? `<span class="muted">候补截止：${formatTime(item.expire_time)}</span>` : ""}
              <div class="inline-actions">
                <button class="ghost-btn" data-detail="${item.show_id}" type="button">查看演出</button>
              </div>
            </div>
          `;
        }).join("") : '<div class="placeholder-card">暂无候补记录。</div>'}
      </div>
    </div>
  `;
}


function parseWaitlistMessage(content) {
  const text = String(content || "");
  const match = text.match(/\[\[WAITLIST_PAY:(\d+)\]\]/);
  return {
    text: text.replace(/\s*\[\[WAITLIST_PAY:\d+\]\]/, ""),
    waitingId: match ? match[1] : "",
  };
}

async function refreshOrders() {
  if (!state.token) {
    return;
  }
  const params = new URLSearchParams();
  if (state.orderStatusFilter !== "") {
    params.append("status", state.orderStatusFilter);
  }
  const orders = await request("/orders" + (params.toString() ? "?" + params.toString() : ""));
  let waitlist = [];
  try {
    waitlist = await request("/waitlist");
  } catch (error) {
    waitlist = [];
  }
  renderOrderPanel(orders.items || [], waitlist);
}

async function openDetail(showId) {
  state.currentDetailShowId = Number(showId);
  const detail = await request("/shows/" + showId);

  const sessionHtml = detail.sessions.map(function (session) {
    let actionHtml = "";

    if (session.is_ended) {
      actionHtml = `
        <button class="ghost-btn" type="button" disabled>已结束</button>
      `;
    } else if (session.can_reserve) {
      actionHtml = `
        <button class="primary-btn" data-reserve="${session.session_id}" type="button">预约该场次</button>
      `;
    } else if (session.can_buy) {
      actionHtml = `
        <button class="primary-btn" data-buy="${session.session_id}" type="button">开始购票</button>
      `;
    } else if (session.is_sold_out) {
      actionHtml = `
        <button class="ghost-btn" type="button" disabled>已售罄</button>
      `;
    } else {
      actionHtml = `
        <button class="ghost-btn" type="button" disabled>未开票</button>
      `;
    }

    return `
      <div class="stack-item">
        <strong>${formatTime(session.start_time)} 开演</strong>
        <span class="muted">开票时间：${formatTime(session.ticket_open_time)}</span>
        <span class="muted">单次限购：${session.max_per_order} 张</span>
        <div class="chip-row">
          ${session.zones.map(function (zone) {
            const soldOut = Number(zone.remaining_count || 0) <= 0;
            const waitable = soldOut && Number(session.waiting_enabled || 0) === 1;
            return `
              <span class="zone-summary-chip ${soldOut ? "is-sold-out" : ""}">
                <strong>${zone.name}</strong>
                <span>${formatPrice(zone.price)} · ${soldOut ? "已售罄" : "余票 " + zone.remaining_count}</span>
                ${waitable ? `<button class="ghost-btn" data-waitlist-session="${session.session_id}" data-waitlist-zone="${zone.zone_id}" type="button">加入候补</button>` : ""}
              </span>
            `;
          }).join("")}
        </div>
        <div class="detail-session-actions">
          <select data-zone-select="${session.session_id}">
            <option value="">不指定分区</option>
            ${session.zones.map(function (zone) {
              return `<option value="${zone.zone_id}">${zone.name}</option>`;
            }).join("")}
          </select>
          ${actionHtml}
        </div>
      </div>
    `;
  }).join("");

  el.drawerBody.innerHTML = `
    <img class="detail-poster" src="${detail.poster_url || posterFallback(detail.title)}" alt="${detail.title}">
    <div class="detail-block">
      <div class="detail-tags">
        <span class="chip">${detail.category}</span>
        <span class="chip">收藏 ${detail.fav_count || 0}</span>
      </div>
      <h3>${detail.title}</h3>
      <p class="muted">${detail.venue}</p>
      <p>${detail.description || "暂无演出简介。"}</p>
      <p class="muted">演出阵容：${detail.lineup || "暂无阵容信息"}</p>
      <p class="muted">购票须知：${detail.notice || "暂无购票须知"}</p>
      <div class="inline-actions">
        ${buildFavoriteButton(detail.show_id, detail.is_favorite)}
      </div>
    </div>
    <div class="detail-block">
      <h3>场次与票价</h3>
      <div class="stack-list">${sessionHtml || '<div class="placeholder-card">暂无场次信息。</div>'}</div>
    </div>
  `;

  showDrawer("detail", "演出详情");
}

async function toggleFavorite(showId) {
  if (!state.token) {
    openAuth("login");
    return;
  }
  const result = await request("/shows/" + showId + "/favorite", { method: "POST" });
  applyFavoriteState(showId, result.favorited);
  toast("收藏状态已更新");
  await loadProfile();
  if (!el.detailDrawer.classList.contains("hidden") && state.currentDetailShowId === Number(showId)) {
    await openDetail(showId);
  }
}
async function createReservation(sessionId) {
  if (!(await ensureVerified())) {
    return;
  }

  const select = document.querySelector('[data-zone-select="' + sessionId + '"]');
  const zoneId = select && select.value ? Number(select.value) : null;

  await request("/reservations", {
    method: "POST",
    body: JSON.stringify({
      session_id: Number(sessionId),
      zone_id: zoneId,
    }),
  });

  toast("预约成功，系统会在开票前提醒你");
  await loadProfile();
}
async function joinWaitlist(sessionId, zoneId) {
  if (!state.token) {
    openAuth("login");
    return;
  }

  const data = await request("/waitlist", {
    method: "POST",
    body: JSON.stringify({
      session_id: Number(sessionId),
      zone_id: Number(zoneId),
    }),
  });
  toast(data.already_joined ? "你已加入候补" : "候补成功，当前排队号 " + data.queue_order);
  await refreshOrders();
}

async function checkoutWaitlist(waitingId, messageId) {
  const order = await request("/waitlist/" + waitingId + "/checkout", { method: "POST" });
  if (messageId) {
    try {
      await request("/users/messages/" + messageId + "/read", { method: "POST" });
    } catch (error) {
      // 消息已读失败不影响购票流程
    }
  }
  toast("候补购票订单已创建");
  renderPaymentPanel(order);
  await refreshOrders();
}


function clearPurchaseQueueTimer() {
  if (state.purchaseQueueTimer) {
    clearTimeout(state.purchaseQueueTimer);
    state.purchaseQueueTimer = null;
  }
}

function clearPurchaseEntryTimer() {
  if (state.purchaseEntryTimer) {
    clearTimeout(state.purchaseEntryTimer);
    state.purchaseEntryTimer = null;
  }
}

function handlePurchaseEntryExpired() {
  clearPurchaseEntryTimer();
  state.purchaseSession = null;
  state.selectedSeatIds = [];
  state.purchaseQueue = null;
  hideDrawer();
  switchView("home");
  toast("超时未下单，请重新排队");
}

function schedulePurchaseEntryTimeout(queueInfo) {
  clearPurchaseEntryTimer();
  if (!queueInfo || !queueInfo.expire_time) {
    return;
  }
  const expireAt = new Date(queueInfo.expire_time).getTime();
  if (!Number.isFinite(expireAt)) {
    return;
  }
  const delay = expireAt - Date.now();
  if (delay <= 0) {
    handlePurchaseEntryExpired();
    return;
  }
  state.purchaseEntryTimer = setTimeout(handlePurchaseEntryExpired, delay);
}

async function cancelActivePurchaseQueue() {
  clearPurchaseQueueTimer();
  clearPurchaseEntryTimer();
  const queueId = state.purchaseQueue && state.purchaseQueue.queueId;
  state.purchaseQueue = null;
  state.purchaseSession = null;
  state.selectedSeatIds = [];
  if (!queueId) {
    return;
  }
  try {
    await request("/purchase-queue/" + queueId + "/cancel", { method: "POST" });
  } catch (error) {
    // 取消排队失败不影响关闭页面
  }
}

function renderPurchaseQueuePanel(queueInfo, sessionId, initialZoneId) {
  state.purchaseQueue = {
    queueId: queueInfo.queue_id,
    sessionId: Number(sessionId),
    initialZoneId: initialZoneId || "",
    expireTime: queueInfo.expire_time || null,
  };
  const aheadCount = Number(queueInfo.ahead_count || 0);
  const position = Number(queueInfo.position || aheadCount + 1);
  const limit = Number(queueInfo.limit || 0);

  el.drawerBody.innerHTML = `
    <section class="purchase-queue-page">
      <div class="queue-ring">
        <span>${position}</span>
      </div>
      <div class="queue-copy">
        <div class="detail-tags">
          <span class="chip">排队号 ${Number(queueInfo.queue_no || 0)}</span>
          <span class="chip">当前第 ${position} 位</span>
        </div>
        <h3>正在为你保留购票入口</h3>
        <p class="muted">当前前方还有 ${aheadCount} 人。</p>
        <p class="muted">同时放行人数：${limit} 人。放行后你有 ${10} 分钟完成选座和支付。</p>
      </div>
      <div class="queue-progress">
        <i></i><i></i><i></i>
      </div>
      <div class="inline-actions">
        <button class="ghost-btn" data-queue-refresh="${queueInfo.queue_id}" type="button">刷新状态</button>
        <button class="ghost-btn" data-return-home type="button">返回首页</button>
      </div>
    </section>
  `;
  showDrawer("transaction", "排队等待");
}

async function checkPurchaseQueue(queueId) {
  const info = await request("/purchase-queue/" + queueId);
  if (info.released) {
    clearPurchaseQueueTimer();
    toast("已为你放行，请在10分钟内完成选座和支付");
    const queued = state.purchaseQueue || {};
    await openPurchasePanel(info.session_id || queued.sessionId, queued.initialZoneId || "", info);
    return;
  }
  const queued = state.purchaseQueue || {};
  renderPurchaseQueuePanel(info, info.session_id || queued.sessionId, queued.initialZoneId || "");
  clearPurchaseQueueTimer();
  state.purchaseQueueTimer = setTimeout(function () {
    checkPurchaseQueue(info.queue_id).catch(function (error) {
      toast(error.message);
      clearPurchaseQueueTimer();
    });
  }, 3000);
}

async function enterPurchaseQueue(sessionId, initialZoneId) {
  clearPurchaseQueueTimer();
  const info = await request("/purchase-queue/enter", {
    method: "POST",
    body: JSON.stringify({ session_id: Number(sessionId) }),
  });
  if (info.released) {
    await openPurchasePanel(sessionId, initialZoneId, info);
    return;
  }
  toast("当前购票人数较多，已进入排队");
  renderPurchaseQueuePanel(info, sessionId, initialZoneId);
  state.purchaseQueueTimer = setTimeout(function () {
    checkPurchaseQueue(info.queue_id).catch(function (error) {
      toast(error.message);
      clearPurchaseQueueTimer();
    });
  }, 3000);
}

async function startPurchase(sessionId) {
  if (!(await ensureVerified())) {
    return;
  }

  const select = document.querySelector('[data-zone-select="' + sessionId + '"]');
  const initialZoneId = select && select.value ? select.value : "";
  await enterPurchaseQueue(sessionId, initialZoneId);
}
function renderSeatButtons(seats) {
  const selectedZone = selectedPurchaseZone();
  const allSeats = purchaseMapSeats();
  if (!allSeats.length) {
    return '<div class="placeholder-card">该场次暂无座位数据。</div>';
  }

  const rows = allSeats.map(function (seat) { return seat.mapRow; });
  const cols = allSeats.map(function (seat) { return seat.mapCol; });
  const minRow = Math.min.apply(null, rows);
  const minCol = Math.min.apply(null, cols);
  const maxRow = Math.max.apply(null, rows);
  const maxCol = Math.max.apply(null, cols);
  const seatStepX = 34;
  const seatStepY = 34;
  const seatBlockWidth = (maxCol - minCol) * seatStepX;
  const seatBlockHeight = (maxRow - minRow) * seatStepY;
  const floorWidth = Math.max(220, seatBlockWidth + 92);
  const floorLeft = Math.max(22, Math.round((mapWidthBase(maxCol, minCol, seatStepX, floorWidth) - floorWidth) / 2));
  const floorTop = 100;
  const floorHeight = Math.max(150, seatBlockHeight + 86);
  const mapWidth = mapWidthBase(maxCol, minCol, seatStepX, floorWidth);
  const mapHeight = Math.max(310, floorTop + floorHeight + 42);
  const seatBaseX = floorLeft + Math.round((floorWidth - seatBlockWidth) / 2);
  const seatBaseY = floorTop + 40;
  const miniWidth = 170;
  const miniHeight = 108;
  const miniScale = Math.min(1, miniWidth / mapWidth, miniHeight / mapHeight);
  const miniOffsetX = Math.max(0, (miniWidth - mapWidth * miniScale) / 2);
  const miniOffsetY = Math.max(0, (miniHeight - mapHeight * miniScale) / 2);

  return `
    <div class="seat-map-shell" data-seat-map-shell>
      <div class="seat-map-toolbar">
        <div class="seat-map-title">
          <strong>${selectedZone ? selectedZone.name : "当前分区"}</strong>
          <span>${selectedZone ? formatPrice(selectedZone.price) : ""}</span>
        </div>
        <div class="seat-map-tools">
          <button class="ghost-btn" data-seat-zoom="-0.15" type="button">-</button>
          <button class="ghost-btn" data-seat-reset-view type="button">复位</button>
          <button class="ghost-btn" data-seat-zoom="0.15" type="button">+</button>
        </div>
      </div>
      <div class="seat-map-viewport" data-seat-map-viewport>
        <div class="seat-map-mini" data-seat-map-mini data-mini-scale="${miniScale}" data-mini-offset-x="${miniOffsetX}" data-mini-offset-y="${miniOffsetY}">
          <div class="mini-stage"></div>
          ${allSeats.map(function (seat) {
            const x = seatBaseX + (seat.mapCol - minCol) * seatStepX;
            const y = seatBaseY + (seat.mapRow - minRow) * seatStepY;
            const statusClass = seat.status === 2 ? "sold" : (seat.status === 1 ? "locked" : "available");
            const isActiveZone = String(seat.zone_id) === String(state.selectedZoneId);
            const zoneColor = seatZoneColor(seat.zone_id);
            const dotColor = isActiveZone
              ? (seat.status === 2 ? `color-mix(in srgb, ${zoneColor}, #f2f2f2 72%)` : zoneColor)
              : "#d8dde4";
            return `<i class="mini-seat ${statusClass} ${isActiveZone ? "active-zone" : "muted-zone"}" style="left:${miniOffsetX + x * miniScale}px;top:${miniOffsetY + y * miniScale}px;background:${dotColor};"></i>`;
          }).join("")}
          <span class="mini-window" data-mini-window></span>
        </div>
        <div
          class="seat-map-canvas"
          data-seat-map-canvas
          style="width:${mapWidth}px;height:${mapHeight}px;"
        >
          <div class="seat-map-stage">
            <span>舞台</span>
          </div>
          <div class="seat-map-floor" style="left:${floorLeft}px;top:${floorTop}px;width:${floorWidth}px;height:${floorHeight}px;">
          </div>
          ${allSeats.map(function (seat) {
            const selected = state.selectedSeatIds.includes(seat.seat_id);
            const disabled = seat.status !== 0;
            const statusClass = seat.status === 2 ? "sold" : (seat.status === 1 ? "locked" : "available");
            const statusText = seat.status === 2 ? "已售" : (seat.status === 1 ? (seat.locked_by_me ? "已锁定" : "锁定") : "可选");
            const isActiveZone = String(seat.zone_id) === String(state.selectedZoneId);
            const x = seatBaseX + (seat.mapCol - minCol) * seatStepX;
            const y = seatBaseY + (seat.mapRow - minRow) * seatStepY;
            return `
              <button
                class="seat-dot ${statusClass} ${selected ? "selected" : ""} ${isActiveZone ? "active-zone" : "muted-zone"}"
                ${isActiveZone ? `data-seat-toggle="${seat.seat_id}"` : `data-zone-pick="${seat.zone_id}"`}
                type="button"
                ${isActiveZone && disabled ? "disabled" : ""}
                title="${seat.zone_name} · ${seat.seat_label} · ${isActiveZone ? (selected ? "已选择" : statusText) : "点击切换分区"}"
                style="left:${x}px;top:${y}px;--zone-color:${isActiveZone ? seatZoneColor(seat.zone_id) : "#eef1f5"};"
              >
                <span></span>
              </button>
            `;
          }).join("")}
        </div>
      </div>
      <div class="selected-seat-strip">
        ${state.selectedSeatIds.length ? allSeats.filter(function (seat) {
          return state.selectedSeatIds.includes(seat.seat_id);
        }).map(function (seat) {
          return `<button data-seat-toggle="${seat.seat_id}" type="button">${seat.seat_label}<span>×</span></button>`;
        }).join("") : '<span class="muted">请选择座位</span>'}
      </div>
    </div>
  `;
}

function purchaseMapSeats() {
  const zones = state.purchaseSession && state.purchaseSession.zones ? state.purchaseSession.zones : [];
  const rawSeats = [];
  zones.forEach(function (zone, zoneIndex) {
    (zone.seats || []).forEach(function (seat) {
      rawSeats.push(Object.assign({}, seat, {
        zone_id: zone.zone_id,
        zone_name: zone.name,
        zone_index: zoneIndex,
        mapRow: Number(seat.row_no || 1),
        mapCol: Number(seat.col_no || 1),
      }));
    });
  });

  const occupied = {};
  rawSeats.forEach(function (seat) {
    const key = seat.mapRow + ":" + seat.mapCol;
    occupied[key] = (occupied[key] || 0) + 1;
  });
  const hasOverlap = Object.keys(occupied).some(function (key) { return occupied[key] > 1; });
  if (!hasOverlap) {
    return rawSeats;
  }

  const zoneStats = {};
  rawSeats.forEach(function (seat) {
    const stat = zoneStats[seat.zone_id] || {
      minRow: seat.mapRow,
      maxRow: seat.mapRow,
      minCol: seat.mapCol,
      maxCol: seat.mapCol,
      zoneIndex: seat.zone_index,
    };
    stat.minRow = Math.min(stat.minRow, seat.mapRow);
    stat.maxRow = Math.max(stat.maxRow, seat.mapRow);
    stat.minCol = Math.min(stat.minCol, seat.mapCol);
    stat.maxCol = Math.max(stat.maxCol, seat.mapCol);
    zoneStats[seat.zone_id] = stat;
  });

  const sortedZones = Object.keys(zoneStats).sort(function (left, right) {
    return zoneStats[left].zoneIndex - zoneStats[right].zoneIndex;
  });
  const offsets = {};
  let nextCol = 1;
  sortedZones.forEach(function (zoneId) {
    const stat = zoneStats[zoneId];
    offsets[zoneId] = nextCol - stat.minCol;
    nextCol += (stat.maxCol - stat.minCol + 1) + 2;
  });

  return rawSeats.map(function (seat) {
    seat.mapCol = seat.mapCol + offsets[seat.zone_id];
    return seat;
  });
}

function mapWidthBase(maxCol, minCol, seatStepX, floorWidth) {
  return Math.max(420, Math.max((maxCol - minCol + 1) * seatStepX + 180, floorWidth + 84));
}

function seatZoneColor(zoneId) {
  const colors = ["#68d86d", "#5ec8e5", "#f1d64b", "#9b8cff", "#ff9f6e", "#7bd3a9"];
  return colors[Math.abs(Number(zoneId || 0)) % colors.length];
}

function resetSeatMapView() {
  state.seatMap.scale = 1;
  state.seatMap.panX = 0;
  state.seatMap.panY = 0;
  state.seatMap.dragging = false;
}

function centerSeatMapView() {
  const canvas = document.querySelector("[data-seat-map-canvas]");
  const viewport = document.querySelector("[data-seat-map-viewport]");
  state.seatMap.scale = 1;
  state.seatMap.dragging = false;
  if (canvas && viewport) {
    state.seatMap.panX = Math.max(0, Math.round((viewport.clientWidth - canvas.offsetWidth) / 2));
    state.seatMap.panY = Math.max(10, Math.min(42, Math.round((viewport.clientHeight - canvas.offsetHeight) / 2)));
  } else {
    state.seatMap.panX = 0;
    state.seatMap.panY = 0;
  }
  updateSeatMapView();
}

function updateSeatMapView() {
  const canvas = document.querySelector("[data-seat-map-canvas]");
  const viewport = document.querySelector("[data-seat-map-viewport]");
  const mini = document.querySelector("[data-seat-map-mini]");
  const miniWindow = document.querySelector("[data-mini-window]");
  if (!canvas || !viewport) {
    return;
  }

  const scale = state.seatMap.scale;
  const scaledWidth = canvas.offsetWidth * scale;
  const scaledHeight = canvas.offsetHeight * scale;
  const spareX = viewport.clientWidth - scaledWidth;
  const spareY = viewport.clientHeight - scaledHeight;
  const centerX = spareX > 0 ? spareX / 2 : 0;
  const centerY = spareY > 0 ? Math.min(42, Math.max(10, spareY / 2)) : 0;
  const maxPanX = spareX > 0 ? centerX + 80 : 80;
  const minPanX = spareX > 0 ? centerX - 80 : spareX - 80;
  const maxPanY = spareY > 0 ? centerY + 60 : 80;
  const minPanY = spareY > 0 ? centerY - 60 : spareY - 80;
  state.seatMap.panX = Math.max(minPanX, Math.min(maxPanX, state.seatMap.panX));
  state.seatMap.panY = Math.max(minPanY, Math.min(maxPanY, state.seatMap.panY));
  canvas.style.transform = `translate(${state.seatMap.panX}px, ${state.seatMap.panY}px) scale(${scale})`;

  if (mini && miniWindow) {
    const miniScale = Number(mini.dataset.miniScale || 1);
    const miniOffsetX = Number(mini.dataset.miniOffsetX || 0);
    const miniOffsetY = Number(mini.dataset.miniOffsetY || 0);
    const contentWidth = canvas.offsetWidth * miniScale;
    const contentHeight = canvas.offsetHeight * miniScale;
    const winW = Math.max(24, Math.min(contentWidth, viewport.clientWidth * miniScale / scale));
    const winH = Math.max(20, Math.min(contentHeight, viewport.clientHeight * miniScale / scale));
    const rawLeft = miniOffsetX + (-state.seatMap.panX / (canvas.offsetWidth * scale)) * contentWidth;
    const rawTop = miniOffsetY + (-state.seatMap.panY / (canvas.offsetHeight * scale)) * contentHeight;
    const left = Math.max(miniOffsetX, Math.min(miniOffsetX + contentWidth - winW, rawLeft));
    const top = Math.max(miniOffsetY, Math.min(miniOffsetY + contentHeight - winH, rawTop));
    miniWindow.style.width = winW + "px";
    miniWindow.style.height = winH + "px";
    miniWindow.style.left = left + "px";
    miniWindow.style.top = top + "px";
  }
}

function selectedPurchaseZone() {
  const session = state.purchaseSession || {};
  const zones = session.zones || [];
  return zones.find(function (zone) {
    return String(zone.zone_id) === String(state.selectedZoneId);
  }) || zones[0];
}

function renderQuantityPurchase(selectedZone) {
  if (!selectedZone) {
    return '<div class="placeholder-card">暂无可购分区。</div>';
  }
  const maxCount = Math.min(Number(state.purchaseSession.max_per_order || 1), Number(selectedZone.remaining_count || 0));
  if (maxCount < 1) {
    return '<div class="placeholder-card">该分区已售罄，可以选择其他分区。</div>';
  }
  if (state.purchaseQuantity > maxCount) {
    state.purchaseQuantity = maxCount;
  }
  if (state.purchaseQuantity < 1) {
    state.purchaseQuantity = 1;
  }
  const total = Number(selectedZone.price || 0) * state.purchaseQuantity;
  return `
    <div class="quick-buy-box">
      <div>
        <strong>${selectedZone.name}</strong>
        <span class="muted">单价 ${formatPrice(selectedZone.price)} · 余票 ${selectedZone.remaining_count}</span>
      </div>
      <div class="quantity-stepper">
        <button class="ghost-btn" data-quantity-step="-1" type="button" ${state.purchaseQuantity <= 1 ? "disabled" : ""}>-</button>
        <strong>${state.purchaseQuantity}</strong>
        <button class="ghost-btn" data-quantity-step="1" type="button" ${state.purchaseQuantity >= maxCount ? "disabled" : ""}>+</button>
      </div>
      <div class="muted">合计 ${formatPrice(total)}</div>
      <button class="primary-btn" data-confirm-purchase type="button">确认订单</button>
    </div>
  `;
}

function renderPurchasePanel() {
  const session = state.purchaseSession;
  const zones = session.zones || [];
  const needsSeatSelection = Number(session.seat_select_enabled) === 1;
  const selectedZone = selectedPurchaseZone();

  state.purchaseMode = needsSeatSelection ? "seat" : "quick";

  if (selectedZone) {
    state.selectedZoneId = String(selectedZone.zone_id);
  }
  const entryExpireTime = state.purchaseQueue && state.purchaseQueue.expireTime;

  el.drawerBody.innerHTML = `
    <div class="detail-block">
      <div class="detail-tags">
        <span class="chip">${state.purchaseMode === "seat" ? "选座购票" : "快捷购票"}</span>
        <span class="chip">${state.purchaseMode === "seat" ? "已选 " + state.selectedSeatIds.length + " 张" : "数量 " + state.purchaseQuantity + " 张"}</span>
        ${entryExpireTime ? `<span class="chip">入口截止 ${formatTime(entryExpireTime)}</span>` : ""}
      </div>
      <h3>${session.title}</h3>
      <p class="muted">${session.venue}</p>
      <p class="muted">开演时间：${formatTime(session.start_time)} · 单次限购 ${session.max_per_order} 张</p>
      ${entryExpireTime ? `<p class="muted">请在 ${formatTime(entryExpireTime)} 前完成选座/选票并确认订单。</p>` : ""}
    </div>
    <div class="detail-block">
      <h3>选择分区</h3>
      <div class="zone-tabs">
        ${zones.map(function (zone) {
          const soldOut = Number(zone.remaining_count || 0) <= 0;
          return `
            <button class="${String(zone.zone_id) === String(state.selectedZoneId) ? "active" : ""}" data-zone-pick="${zone.zone_id}" type="button" ${soldOut ? "disabled" : ""}>
              <strong>${zone.name}</strong>
              <span>${formatPrice(zone.price)}</span>
              <small>${soldOut ? "已售罄" : "余票 " + zone.remaining_count}</small>
            </button>
          `;
        }).join("")}
      </div>
    </div>
    <div class="detail-block">
      <h3>${state.purchaseMode === "seat" ? "选择座位" : "确认数量"}</h3>
      ${state.purchaseMode === "seat" ? `
        ${selectedZone ? renderSeatButtons(selectedZone.seats || []) : '<div class="placeholder-card">请选择分区。</div>'}
        <div class="seat-legend" style="--legend-zone-color:${selectedZone ? seatZoneColor(selectedZone.zone_id) : "#68d86d"};">
          <span><i class="seat-mark available"></i>可选</span>
          <span><i class="seat-mark selected"></i>已选</span>
          <span><i class="seat-mark locked"></i>锁定</span>
          <span><i class="seat-mark sold"></i>已售</span>
          <span><i class="seat-mark muted"></i>其他分区</span>
        </div>
        <div class="inline-actions">
          <button class="ghost-btn" data-refresh-seats type="button">刷新座位</button>
          <button class="primary-btn" data-confirm-purchase type="button">确认订单</button>
        </div>
      ` : renderQuantityPurchase(selectedZone)}
    </div>
  `;

  showDrawer("transaction", state.purchaseMode === "seat" ? "选择座位" : "快捷购票");
  if (state.purchaseMode === "seat") {
    centerSeatMapView();
  }
}


async function openPurchasePanel(sessionId, initialZoneId, queueInfo) {
  clearPurchaseQueueTimer();
  if (queueInfo) {
    state.purchaseQueue = {
      queueId: queueInfo.queue_id,
      sessionId: Number(sessionId),
      initialZoneId: initialZoneId || "",
      expireTime: queueInfo.expire_time || null,
    };
    schedulePurchaseEntryTimeout(queueInfo);
  }
  state.purchaseSession = await request("/sessions/" + sessionId + "/seats");
  state.selectedSeatIds = [];
  state.purchaseMode = Number(state.purchaseSession.seat_select_enabled) === 1 ? "seat" : "quick";
  state.purchaseQuantity = 1;
  const zones = state.purchaseSession.zones || [];
  const initialZone = zones.find(function (zone) {
    return String(zone.zone_id) === String(initialZoneId);
  });
  state.selectedZoneId = initialZone ? String(initialZone.zone_id) : (zones[0] ? String(zones[0].zone_id) : "");
  resetSeatMapView();
  renderPurchasePanel();
}

function renderPaymentPanel(order) {
  clearPurchaseEntryTimer();
  clearPurchaseQueueTimer();
  state.purchaseQueue = null;
  state.purchaseSession = null;
  state.selectedSeatIds = [];
  const seats = order.seats || [];
  const seatText = seats.map(function (seat) {
    return seat.seat_label;
  }).join("、") || "未选座位";
  const currentMethod = getPaymentMethod(order.order_id);

  el.drawerBody.innerHTML = `
    <div class="detail-block">
      <div class="detail-tags">
        <span class="chip">待支付</span>
        <span class="chip">订单待确认</span>
      </div>
      <h3>订单 ${order.order_id}</h3>
      <p class="muted">座位：${seatText}</p>
      <p class="muted">数量：${order.ticket_count} 张 · 合计：${formatPrice(order.total_amount)}</p>
      <p class="muted">请在 ${formatTime(order.expire_time)} 前完成支付</p>
    </div>
    <form id="payOrderForm" class="detail-block form-stack" data-pay-order="${order.order_id}">
      <div class="payment-method-group">
        <span>支付方式</span>
        <label><input type="radio" name="payment_method" value="wechat" ${currentMethod === "wechat" ? "checked" : ""}><strong>微信支付</strong></label>
        <label><input type="radio" name="payment_method" value="alipay" ${currentMethod === "alipay" ? "checked" : ""}><strong>支付宝</strong></label>
        <label><input type="radio" name="payment_method" value="bank" ${currentMethod === "bank" ? "checked" : ""}><strong>银行卡</strong></label>
      </div>
      <label>
        <span>支付密码</span>
        <input name="pay_password" maxlength="6" placeholder="请输入 6 位支付密码">
      </label>
      <button class="primary-btn" type="submit">确认支付</button>
    </form>
  `;
  showDrawer("transaction", "订单支付");
}


async function renderPurchaseSuccess(orderId) {
  const order = await request("/orders/" + orderId);
  const seatText = (order.seats || []).map(function (seat) {
    return seat.seat_label;
  }).join("、") || "未选座位";

  el.drawerBody.innerHTML = `
    <section class="purchase-success-page">
      <div class="success-badge">✓</div>
      <div>
        <div class="detail-tags">
          <span class="chip">支付成功</span>
          <span class="chip">订单 ${order.order_id}</span>
        </div>
        <h3>${order.title}</h3>
        <p class="muted">${order.venue}</p>
      </div>
      <div class="success-summary">
        <div><span>演出时间</span><strong>${formatTime(order.start_time)}</strong></div>
        <div><span>座位信息</span><strong>${order.zone_name} · ${seatText}</strong></div>
        <div><span>支付金额</span><strong>${formatPrice(order.total_amount)}</strong></div>
      </div>
      <div class="inline-actions">
        <button class="primary-btn" data-success-ticket="${order.order_id}" type="button">查看电子票</button>
        <button class="ghost-btn" data-return-home type="button">返回首页</button>
      </div>
    </section>
  `;
  showDrawer("transaction", "购票成功");
}


async function confirmPurchase() {
  if (!state.purchaseSession || !state.selectedZoneId) {
    toast("请选择购票分区");
    return;
  }
  if (state.purchaseMode === "quick") {
    const order = await request("/orders/quick", {
      method: "POST",
      body: JSON.stringify({
        session_id: state.purchaseSession.session_id,
        zone_id: Number(state.selectedZoneId),
        quantity: state.purchaseQuantity,
      }),
    });
    toast("快捷购票订单已创建");
    renderPaymentPanel(order);
    return;
  }
  if (!state.selectedSeatIds.length) {
    toast("请选择座位");
    return;
  }
  const locked = await request("/seats/lock", {
    method: "POST",
    body: JSON.stringify({
      session_id: state.purchaseSession.session_id,
      zone_id: Number(state.selectedZoneId),
      seat_ids: state.selectedSeatIds,
    }),
  });
  const order = await request("/orders", {
    method: "POST",
    body: JSON.stringify({ lock_token: locked.lock_token }),
  });
  toast("订单已创建，请完成支付");
  renderPaymentPanel(order);
}


function qrBit(seed, row, col) {
  let value = 0;
  const text = String(seed || "");
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i) + row * 17 + col * 13) >>> 0;
  }
  return ((value >> ((row + col) % 16)) & 1) === 1;
}

function renderTicketQr(code) {
  const size = 29;
  const cell = 6;
  const quiet = 3;
  const total = (size + quiet * 2) * cell;
  function isFinder(row, col, startRow, startCol) {
    const r = row - startRow;
    const c = col - startCol;
    if (r < 0 || c < 0 || r > 6 || c > 6) {
      return false;
    }
    return r === 0 || c === 0 || r === 6 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
  }
  const blocks = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const finder = isFinder(row, col, 0, 0) || isFinder(row, col, 0, size - 7) || isFinder(row, col, size - 7, 0);
      const filled = finder || qrBit(code, row, col);
      if (filled) {
        blocks.push(`<rect x="${(col + quiet) * cell}" y="${(row + quiet) * cell}" width="${cell}" height="${cell}" rx="1"/>`);
      }
    }
  }
  return `
    <svg class="ticket-qr" viewBox="0 0 ${total} ${total}" role="img" aria-label="电子票二维码">
      <rect width="${total}" height="${total}" fill="#fff"/>
      <g fill="#1d1d1d">${blocks.join("")}</g>
    </svg>
  `;
}

async function openOrderDetail(orderId) {
  const order = await request("/orders/" + orderId);
  const ticketsVisible = String(state.ticketVisibleOrderId) === String(orderId);
  const seatText = (order.seats || []).map(function (seat) {
    return seat.seat_label;
  }).join("、") || "未选座位";
  const refundable = Boolean(order.can_refund);

  el.drawerBody.innerHTML = `
    <div class="detail-block">
      <div class="detail-tags">
        <span class="chip order-status-${orderStatusTone(order.status)}">${order.status_label}</span>
        <span class="chip">订单 ${order.order_id}</span>
      </div>
      <h3>${order.title}</h3>
      <p class="muted">${order.venue}</p>
      <p class="muted">演出时间：${formatTime(order.start_time)}</p>
      <p class="muted">分区：${order.zone_name} · ${order.ticket_count} 张 · ${formatPrice(order.total_amount)}</p>
      <p class="muted">座位：${seatText}</p>
      <p class="muted">支付时间：${order.paid_time ? formatTime(order.paid_time) : "未支付"} · 支付方式：${paymentMethodLabel(order.pay_method || getPaymentMethod(order.order_id))}</p>
    </div>
    <div class="detail-block">
      <div class="sub-head">
        <h3>电子票</h3>
        ${(order.tickets || []).length ? `<button class="ghost-btn" data-toggle-ticket="${order.order_id}" type="button">${ticketsVisible ? "隐藏电子票" : "显示电子票"}</button>` : ""}
      </div>
      <div class="stack-list ticket-list ${ticketsVisible ? "" : "ticket-hidden"}">
        ${(order.tickets || []).length ? (ticketsVisible ? order.tickets.map(function (ticket) {
          return `
            <div class="stack-item ticket-card">
              ${renderTicketQr(ticket.qr_code)}
              <strong>${ticket.qr_code}</strong>
              <span class="muted">票号：${ticket.ticket_id} · 状态：${ticket.status === 1 ? "有效" : "已失效"}</span>
            </div>
          `;
        }).join("") : '<div class="placeholder-card">电子票暂不可见。</div>') : '<div class="placeholder-card">暂无电子票。</div>'}
      </div>
    </div>
    <div class="detail-block refund-policy-card">
      <h3>退票规则</h3>
      <p class="muted">${order.allow_refund === 1 ? "支持退票" : "不支持退票"} · 截止时间：${formatTime(order.refund_deadline_final)}</p>
      <div class="refund-grid">
        <div><span>手续费率</span><strong>${Number(order.refund_fee_rate || 0).toFixed(2)}%</strong></div>
        <div><span>手续费</span><strong>${formatPrice(order.refund_fee_amount)}</strong></div>
        <div><span>预计退款</span><strong>${formatPrice(order.refund_amount_estimate)}</strong></div>
      </div>
      ${order.refunds && order.refunds.length ? `<p class="muted">已退款：${formatPrice(order.refunds[0].refund_amount)} · ${formatTime(order.refunds[0].completed_at || order.refunds[0].created_at)}</p>` : ""}
    </div>
    <div class="detail-block">
      <div class="inline-actions">
        ${order.status === 0 ? `<button class="primary-btn" data-pay-existing="${order.order_id}" type="button">立即支付</button>` : ""}
        ${refundable ? `<button class="ghost-btn" data-refund-order="${order.order_id}" type="button">申请退票</button>` : ""}
        ${order.status === 1 && !refundable ? `<button class="ghost-btn" type="button" disabled>当前不可退票</button>` : ""}
      </div>
    </div>
  `;

  showDrawer("transaction", ticketsVisible ? "电子票详情" : "订单详情");
}


async function payExistingOrder(orderId) {
  const existing = document.querySelector('#payOrderForm[data-pay-order="' + orderId + '"]');
  if (existing) {
    existing.remove();
  }
  const method = getPaymentMethod(orderId);
  el.drawerBody.innerHTML += `
    <form id="payOrderForm" class="detail-block form-stack" data-pay-order="${orderId}">
      <div class="payment-method-group">
        <span>支付方式</span>
        <label><input type="radio" name="payment_method" value="wechat" ${method === "wechat" ? "checked" : ""}><strong>微信支付</strong></label>
        <label><input type="radio" name="payment_method" value="alipay" ${method === "alipay" ? "checked" : ""}><strong>支付宝</strong></label>
        <label><input type="radio" name="payment_method" value="bank" ${method === "bank" ? "checked" : ""}><strong>银行卡</strong></label>
      </div>
      <label>
        <span>支付密码</span>
        <input name="pay_password" maxlength="6" placeholder="请输入 6 位支付密码">
      </label>
      <button class="primary-btn" type="submit">确认支付</button>
    </form>
  `;
}


async function refundOrder(orderId) {
  const order = await request("/orders/" + orderId);
  const existing = document.querySelector("#refundConfirmForm");
  if (existing) {
    existing.remove();
  }
  el.drawerBody.innerHTML += `
    <form id="refundConfirmForm" class="detail-block form-stack refund-confirm-card" data-refund-confirm="${orderId}">
      <h3>申请退票</h3>
      <div class="refund-grid">
        <div><span>订单金额</span><strong>${formatPrice(order.total_amount)}</strong></div>
        <div><span>手续费</span><strong>${formatPrice(order.refund_fee_amount)}</strong></div>
        <div><span>预计退款</span><strong>${formatPrice(order.refund_amount_estimate)}</strong></div>
      </div>
      <p class="muted">提交退票后，系统会按照退票规则处理，退款将原路返回。</p>
      <label>
        <span>退票原因</span>
        <input name="reason" maxlength="255" value="行程有变">
      </label>
      <button class="primary-btn" type="submit">确认退票</button>
    </form>
  `;
}


function nextSlide() {
  if (!state.featured.length) {
    return;
  }
  state.featuredIndex = (state.featuredIndex + 1) % state.featured.length;
  renderFeatured();
}

function prevSlide() {
  if (!state.featured.length) {
    return;
  }
  state.featuredIndex = (state.featuredIndex - 1 + state.featured.length) % state.featured.length;
  renderFeatured();
}

async function doLogout() {
  if (!state.user) {
    openAuth("login");
    return;
  }
  await request("/auth/logout", { method: "POST" });
  setToken("");
  state.user = null;
  await loadProfile();
  toast("已退出登录");
}
export {
  refreshOrders,
  paymentMethodLabel,
  savePaymentMethod,
  getPaymentMethod,
  parseWaitlistMessage,
  openDetail,
  toggleFavorite,
  createReservation,
  joinWaitlist,
  checkoutWaitlist,
  checkPurchaseQueue,
  clearPurchaseQueueTimer,
  clearPurchaseEntryTimer,
  cancelActivePurchaseQueue,
  startPurchase,
  renderSeatButtons,
  purchaseMapSeats,
  resetSeatMapView,
  centerSeatMapView,
  updateSeatMapView,
  selectedPurchaseZone,
  renderPurchasePanel,
  openPurchasePanel,
  renderPaymentPanel,
  renderPurchaseSuccess,
  confirmPurchase,
  openOrderDetail,
  payExistingOrder,
  refundOrder,
};
