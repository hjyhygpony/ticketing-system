import { request, setToken } from "./api.js";
import { parseWaitlistMessage, refreshOrders } from "./commerce.js";
import { el, state } from "./state.js";
import {
  buildFavoriteButton,
  currentSearchKeyword,
  formatPrice,
  formatTime,
  posterFallback,
  toast,
} from "./helpers.js";
import {
  applyFavoriteState,
  closeVerifyModal,
  openAuth,
  openVerifyModal,
  renderBasicInfo,
  renderFeatured,
  renderHomeShows,
  renderSearchResults,
  renderStack,
  renderSummary,
  syncAuthButton,
} from "./render.js";

export async function sendAuthCode(phone) {
  return request("/auth/code", {
    method: "POST",
    body: JSON.stringify({ phone: phone }),
  });
}

export async function loginUser(formData) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(formData),
  });
}

export async function registerUser(formData) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(formData),
  });
}

export async function resetUserPassword(formData) {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(formData),
  });
}

export async function ensureVerified() {
  if (!state.token) {
    openAuth("login");
    return false;
  }

  if (!state.user) {
    await loadProfile();
  }

  if (!state.user || !state.user.is_verified) {
    state.verifyPromptDismissed = false;
    openVerifyModal();
    toast("请先完成实名认证");
    return false;
  }

  return true;
}

export async function loadFeatured() {
  state.featured = await request("/shows/featured");
  renderFeatured();
}

export async function loadHomeShows() {
  const data = await request("/shows?sort=nearest&upcoming_only=true");
  state.homeShows = data.items;
  state.homeTotal = data.total;
  renderHomeShows();
}

export async function loadSearchResults() {
  const formData = new FormData(el.filterForm);
  const params = new URLSearchParams();
  const keyword = currentSearchKeyword();

  if (keyword) {
    params.append("keyword", keyword);
  }

  formData.forEach(function (value, key) {
    if (value !== "") {
      params.append(key, value);
    }
  });

  const data = await request("/shows?" + params.toString());
  state.resultShows = data.items;
  state.resultTotal = data.total;
  renderSearchResults();
}

function clearProfileView() {
  renderSummary(null);
  renderBasicInfo(null);
  renderStack(el.favoriteList, [], "还没有收藏任何演出。", function () { return ""; });
  renderStack(el.reservationList, [], "还没有预约记录。", function () { return ""; });
  renderStack(el.orderList, [], "订单模块由交易部分接入，这里先预留展示区。", function () { return ""; });
  renderStack(el.messageList, [], "登录后可查看站内消息。", function () { return ""; });
}

export async function loadProfile() {
  if (!state.token) {
    state.user = null;
    state.favoriteShowIds = new Set();
    state.verifyPromptDismissed = false;
    closeVerifyModal();
    clearProfileView();
    return;
  }

  try {
    const user = await request("/users/me");
    const favorites = await request("/users/favorites");
    const reservations = await request("/users/reservations");
    const messages = await request("/users/messages");

    state.user = user;
    syncAuthButton();
    state.favoriteShowIds = new Set(favorites.map(function (item) {
      return Number(item.show_id);
    }));

    renderSummary(user);
    renderBasicInfo(user);

    renderStack(el.favoriteList, favorites, "还没有收藏任何演出。", function (item) {
      return `
        <div class="stack-item">
          <strong>${item.title}</strong>
          <span class="muted">${item.venue}</span>
          <span class="muted">最近场次：${formatTime(item.first_session)}</span>
          <span class="muted">最低票价：${formatPrice(item.min_price)}</span>
          <div class="inline-actions">
            <button class="ghost-btn" data-favorite="${item.show_id}" type="button">
              取消收藏
            </button>
          </div>
        </div>
      `;
    });

    renderStack(el.reservationList, reservations, "还没有预约记录。", function (item) {
      return `
        <div class="stack-item">
          <strong>${item.title}</strong>
          <span class="muted">场次时间：${formatTime(item.start_time)}</span>
          <span class="muted">意向分区：${item.zone_name || "未指定"}</span>
          <div class="inline-actions">
            <button class="ghost-btn" data-cancel="${item.reservation_id}" type="button">取消预约</button>
          </div>
        </div>
      `;
    });

    renderStack(el.orderList, [], "订单查看、电子票和退票将由交易模块接入。", function () { return ""; });
    await refreshOrders();

    renderStack(el.messageList, messages, "暂时没有站内消息。", function (item) {
      return `
        <div class="stack-item ${item.is_read ? "message-read" : "message-unread"}">
          <strong>${item.title}</strong>
          <span class="muted">${parseWaitlistMessage(item.content).text}</span>
          <span class="muted">${formatTime(item.created_at)}</span>
          <div class="inline-actions">
            ${parseWaitlistMessage(item.content).waitingId ? `<button class="primary-btn" data-waitlist-checkout="${parseWaitlistMessage(item.content).waitingId}" data-read-after-pay="${item.message_id}" type="button">去支付</button>` : ""}
            <button
              class="${item.is_read ? "message-read-btn" : "message-mark-btn"}"
              data-read-message="${item.message_id}"
              type="button"
              ${item.is_read ? "disabled" : ""}
            >
              ${item.is_read ? "已读" : "标记已读"}
            </button>
          </div>
        </div>
      `;
    });

    if (user.is_verified) {
      closeVerifyModal();
      state.verifyPromptDismissed = false;
    } else if (!state.verifyPromptDismissed) {
      openVerifyModal();
    }
  } catch (error) {
    setToken("");
    state.user = null;
    syncAuthButton();
    state.favoriteShowIds = new Set();
    state.verifyPromptDismissed = false;
    closeVerifyModal();
    clearProfileView();
    toast(error.message);
  }
}

export async function openDetail(showId) {
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
        <button class="primary-btn" data-reserve="${session.session_id}" type="button">
          预约该场次
        </button>
      `;
    } else if (session.can_buy) {
      actionHtml = `
        <button class="primary-btn" data-buy="${session.session_id}" type="button">
          开始购票
        </button>
      `;
    } else if (session.is_sold_out) {
      actionHtml = `
        <button class="ghost-btn" type="button" disabled>
          已售罄
        </button>
      `;
    } else {
      actionHtml = `
        <button class="ghost-btn" type="button" disabled>
          已开票
        </button>
      `;
    }

    return `
      <div class="stack-item">
        <strong>${formatTime(session.start_time)} 开演</strong>
        <span class="muted">开票时间：${formatTime(session.ticket_open_time)}</span>
        <span class="muted">单次限购：${session.max_per_order} 张</span>
        <div class="chip-row">
          ${session.zones.map(function (zone) {
            return `<span class="chip">${zone.name} · ${formatPrice(zone.price)} · 余票 ${zone.remaining_count}</span>`;
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

  el.detailDrawer.classList.remove("hidden");
}

export async function toggleFavorite(showId) {
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

export async function createReservation(sessionId) {
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

export async function startPurchase(sessionId) {
  if (!(await ensureVerified())) {
    return;
  }

  const select = document.querySelector('[data-zone-select="' + sessionId + '"]');
  const zoneText = select && select.value ? select.options[select.selectedIndex].text : "任意分区";
  toast("该场次已开票，可开始购票： " + zoneText);
}

export function nextSlide() {
  if (!state.featured.length) {
    return;
  }

  state.featuredIndex = (state.featuredIndex + 1) % state.featured.length;
  renderFeatured();
}

export function prevSlide() {
  if (!state.featured.length) {
    return;
  }

  state.featuredIndex = (state.featuredIndex - 1 + state.featured.length) % state.featured.length;
  renderFeatured();
}

export async function doLogout() {
  if (!state.user) {
    openAuth("login");
    return;
  }

  await request("/auth/logout", { method: "POST" });
  setToken("");
  state.user = null;
  syncAuthButton();
  state.verifyPromptDismissed = false;
  closeVerifyModal();
  await loadProfile();
  toast("已退出登录");
}

export async function submitVerify(formElement) {
  if (!state.token) {
    closeVerifyModal();
    openAuth("login");
    return;
  }

  const formData = Object.fromEntries(new FormData(formElement).entries());
  formData.promise = Boolean(formData.promise);

  try {
    await request("/users/verify", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    toast("实名认证成功");
    el.verifyForm.reset();
    if (el.verifyModalForm) {
      el.verifyModalForm.reset();
    }
    closeVerifyModal();
    await loadProfile();
  } catch (error) {
    toast(error.message);
  }
}
