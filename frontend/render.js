import { el, state } from "./state.js";
import {
  buildFavoriteButton,
  buildStatusChip,
  formatPrice,
  formatTime,
  isFavoriteShow,
  passwordState,
  posterFallback,
  setRuleState,
  syncFavoriteButton,
} from "./helpers.js";

export function syncHomeMode() {
  el.homeDiscoverySection.classList.toggle("hidden", state.isSearching);
  el.searchResultSection.classList.toggle("hidden", !state.isSearching);
}

export function syncAuthButton() {
  el.authBtn.textContent = state.user ? "退出登录" : "登录 / 注册";
}

export function switchView(viewName) {
  const views = {
    home: el.homeView,
    forum: el.forumView,
    user: el.userView,
  };

  Object.keys(views).forEach(function (key) {
    views[key].classList.toggle("hidden", key !== viewName);
  });

  el.navBtns.forEach(function (button) {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
}

export function openAuth(tabName) {
  const tab = tabName || "login";
  el.authModal.classList.remove("hidden");

  document.querySelectorAll(".tab-btn").forEach(function (button) {
    button.classList.toggle("active", button.dataset.tab === tab);
  });

  el.loginForm.classList.toggle("hidden", tab !== "login");
  el.registerForm.classList.toggle("hidden", tab !== "register");
  el.resetForm.classList.toggle("hidden", tab !== "reset");
}

export function closeAuth() {
  el.authModal.classList.add("hidden");
}

export function closeVerifyModal() {
  if (!el.verifyModal) {
    return;
  }

  el.verifyModal.classList.add("hidden");
}

export function openVerifyModal() {
  if (!el.verifyModal || !el.verifyModalForm || !state.token || !state.user || state.user.is_verified) {
    return;
  }

  el.verifyModal.classList.remove("hidden");
  const firstInput = el.verifyModalForm.querySelector('input[name="real_name"]');
  if (firstInput) {
    setTimeout(function () {
      firstInput.focus();
    }, 120);
  }
}

export function openVerifyGuide() {
  setPanelExpanded("verify", true);
  const verifyPanel = document.querySelector('[data-panel-body="verify"]');
  const firstInput = el.verifyForm.querySelector('input[name="real_name"]');

  if (verifyPanel) {
    verifyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (firstInput) {
    setTimeout(function () {
      firstInput.focus();
    }, 180);
  }
}

export function updatePasswordHint(type) {
  const isRegister = type === "register";
  const input = isRegister ? el.registerPasswordInput : el.resetPasswordInput;
  const hint = isRegister ? el.registerPasswordHint : el.resetPasswordHint;
  const text = isRegister ? el.registerStrengthText : el.resetStrengthText;
  const bar = isRegister ? el.registerStrengthBar : el.resetStrengthBar;
  const ruleLength = isRegister ? el.registerRuleLength : el.resetRuleLength;
  const ruleLetter = isRegister ? el.registerRuleLetter : el.resetRuleLetter;
  const ruleNumber = isRegister ? el.registerRuleNumber : el.resetRuleNumber;
  const value = input.value.trim();

  hint.classList.toggle("hidden", !value);
  if (!value) {
    return;
  }

  const result = passwordState(value);
  text.textContent = result.text;
  text.className = "strength-text " + result.level;
  bar.className = "strength-fill " + result.level;

  setRuleState(ruleLength, result.hasLength);
  setRuleState(ruleLetter, result.hasLetter);
  setRuleState(ruleNumber, result.hasNumber);
}

export function resetPasswordHint(type) {
  const isRegister = type === "register";
  const hint = isRegister ? el.registerPasswordHint : el.resetPasswordHint;
  const text = isRegister ? el.registerStrengthText : el.resetStrengthText;
  const bar = isRegister ? el.registerStrengthBar : el.resetStrengthBar;
  const ruleLength = isRegister ? el.registerRuleLength : el.resetRuleLength;
  const ruleLetter = isRegister ? el.registerRuleLetter : el.resetRuleLetter;
  const ruleNumber = isRegister ? el.registerRuleNumber : el.resetRuleNumber;

  hint.classList.add("hidden");
  text.textContent = "弱";
  text.className = "strength-text weak";
  bar.className = "strength-fill weak";
  ruleLength.className = "rule-item";
  ruleLetter.className = "rule-item";
  ruleNumber.className = "rule-item";
}

export function hideDrawer() {
  state.currentDetailShowId = null;
  el.detailDrawer.classList.add("hidden");
  el.detailDrawer.classList.remove("transaction-drawer");
}

export function showDrawer(mode, title) {
  if (el.drawerTitle) {
    el.drawerTitle.textContent = title || (mode === "transaction" ? "票务交易" : "演出详情");
  }
  el.detailDrawer.classList.toggle("transaction-drawer", mode === "transaction");
  el.detailDrawer.classList.remove("hidden");
}

export function applyFavoriteState(showId, favorited) {
  const numericShowId = Number(showId);
  const delta = favorited ? 1 : -1;

  if (favorited) {
    state.favoriteShowIds.add(numericShowId);
  } else {
    state.favoriteShowIds.delete(numericShowId);
  }

  [state.featured, state.homeShows, state.resultShows].forEach(function (list) {
    list.forEach(function (item) {
      if (Number(item.show_id) === numericShowId) {
        item.fav_count = Math.max(Number(item.fav_count || 0) + delta, 0);
        item.is_favorite = favorited;
      }
    });
  });

  renderFeatured();
  renderHomeShows();
  if (state.isSearching) {
    renderSearchResults();
  }

  document.querySelectorAll('button[data-favorite="' + numericShowId + '"]').forEach(function (button) {
    syncFavoriteButton(button, favorited);
  });
}

export function renderFeatured() {
  if (!state.featured.length) {
    el.featuredTrack.innerHTML = '<div class="placeholder-card">当前没有推荐演出。</div>';
    el.featuredDots.innerHTML = "";
    return;
  }

  if (state.featuredIndex >= state.featured.length) {
    state.featuredIndex = 0;
  }

  el.featuredTrack.innerHTML = state.featured.map(function (item, index) {
    return `
      <article class="featured-slide ${index === state.featuredIndex ? "active" : ""}">
        <div class="featured-poster-box">
          <img src="${item.poster_url || posterFallback(item.title)}" alt="${item.title}">
        </div>
        <div class="slide-content">
          <div class="chip-row">
            ${buildStatusChip(item)}
            <span class="chip">${item.category}</span>
            <span class="chip">收藏 ${item.fav_count || 0}</span>
          </div>
          <h4>${item.title}</h4>
          <div class="muted">${item.venue}</div>
          <div class="muted">开演时间：${formatTime(item.first_session)}</div>
          <div class="muted">最低票价：${formatPrice(item.min_price)}</div>
          <div class="inline-actions">
            <button class="primary-btn" data-detail="${item.show_id}" type="button">查看详情</button>
            ${buildFavoriteButton(item.show_id, isFavoriteShow(item.show_id))}
          </div>
        </div>
      </article>
    `;
  }).join("");

  el.featuredDots.innerHTML = state.featured.map(function (_, index) {
    return `<span class="dot ${index === state.featuredIndex ? "active" : ""}" data-dot="${index}"></span>`;
  }).join("");
}

function buildShowCard(item) {
  return `
    <article class="show-card">
      <img src="${item.poster_url || posterFallback(item.title)}" alt="${item.title}">
      <div class="show-content">
        <div class="chip-row">
          ${buildStatusChip(item)}
          <span class="chip">${item.category}</span>
          <span class="chip">收藏 ${item.fav_count || 0}</span>
        </div>
        <h4>${item.title}</h4>
        <div class="muted">${item.venue}</div>
        <div class="muted">最近场次：${formatTime(item.first_session)}</div>
        <div class="muted">票价区间：${formatPrice(item.min_price)} - ${formatPrice(item.max_price)}</div>
        <div class="inline-actions">
          <button class="primary-btn" data-detail="${item.show_id}" type="button">查看详情</button>
          ${buildFavoriteButton(item.show_id, isFavoriteShow(item.show_id))}
        </div>
      </div>
    </article>
  `;
}

export function renderHomeShows() {
  el.homeResultMeta.textContent = "共 " + state.homeTotal + " 场近期演出";
  if (!state.homeShows.length) {
    el.homeShowGrid.innerHTML = '<div class="placeholder-card">当前没有可展示的近期演出。</div>';
    return;
  }

  el.homeShowGrid.innerHTML = state.homeShows.map(buildShowCard).join("");
}

export function renderSearchResults() {
  el.resultMeta.textContent = "共找到 " + state.resultTotal + " 场演出";
  if (!state.resultShows.length) {
    el.showGrid.innerHTML = '<div class="placeholder-card">没有找到符合条件的演出，可以试试换个关键词。</div>';
    return;
  }

  el.showGrid.innerHTML = state.resultShows.map(buildShowCard).join("");
}

export function renderSummary(user) {
  if (!user) {
    el.profileMeta.textContent = "登录后可查看个人信息、实名认证、收藏、预约、订单和消息。";
    el.profileSummary.innerHTML = '<div class="placeholder-card">请先登录后进入用户中心。</div>';
    return;
  }

  el.profileMeta.textContent = user.phone_masked + " · 注册时间 " + formatTime(user.register_time);
  el.profileSummary.innerHTML = [
    ["实名认证", user.is_verified ? "已完成" : "未完成"],
    ["我的收藏", user.favorite_count],
    ["我的预约", user.reservation_count],
    ["未读消息", user.unread_message_count],
  ].map(function (item) {
    return `
      <div class="summary-card">
        <span>${item[0]}</span>
        <strong>${item[1]}</strong>
      </div>
    `;
  }).join("");
}

export function renderBasicInfo(user) {
  if (!user) {
    el.basicInfoCard.innerHTML = '<div class="basic-box">请先登录后查看基本信息。</div>';
    el.verifyStatus.textContent = "未登录";
    renderVerifyPanel(null);
    return;
  }

  el.verifyStatus.textContent = user.is_verified ? "已实名" : "待认证";
  el.basicInfoCard.innerHTML = `
    <div class="basic-box">
      <span class="muted">手机号</span>
      <strong>${user.phone_masked}</strong>
    </div>
    <div class="basic-box">
      <span class="muted">实名认证</span>
      <strong>${user.is_verified ? "已完成" : "未完成"}</strong>
    </div>
    <div class="basic-box">
      <span class="muted">实名展示</span>
      <strong>${user.real_name_masked || "未实名"}</strong>
    </div>
    <div class="basic-box">
      <span class="muted">账号状态</span>
      <strong>${user.status === 1 ? "正常" : "受限"}</strong>
    </div>
  `;

  renderVerifyPanel(user);
}

export function setPanelExpanded(panelName, expanded) {
  state.panelExpanded[panelName] = Boolean(expanded);

  const body = document.querySelector('[data-panel-body="' + panelName + '"]');
  const toggle = document.querySelector('[data-panel-toggle="' + panelName + '"]');
  const arrow = document.querySelector('[data-panel-arrow="' + panelName + '"]');

  if (body) {
    body.classList.toggle("hidden", !state.panelExpanded[panelName]);
  }

  if (toggle) {
    toggle.classList.toggle("is-open", state.panelExpanded[panelName]);
  }

  if (arrow) {
    arrow.textContent = state.panelExpanded[panelName] ? "▾" : "▸";
  }
}

export function renderVerifyPanel(user) {
  if (!user) {
    el.verifyNote.textContent = "登录后可填写实名认证信息，认证通过后才能预约演出。";
    el.verifyNote.classList.remove("hidden");
    el.verifyDone.classList.add("hidden");
    el.verifyDone.innerHTML = "";
    el.verifyForm.classList.add("hidden");
    return;
  }

  if (user.is_verified) {
    el.verifyNote.classList.add("hidden");
    el.verifyForm.classList.add("hidden");
    el.verifyDone.classList.remove("hidden");
    el.verifyDone.innerHTML = `
      <div class="basic-box">
        <span class="muted">实名认证状态</span>
        <strong>已完成</strong>
      </div>
      <div class="basic-box">
        <span class="muted">实名展示</span>
        <strong>${user.real_name_masked || "已认证"}</strong>
      </div>
    `;
    return;
  }

  el.verifyNote.textContent = "未实名认证用户可浏览演出和论坛，但不可预约。";
  el.verifyNote.classList.remove("hidden");
  el.verifyDone.classList.add("hidden");
  el.verifyDone.innerHTML = "";
  el.verifyForm.classList.remove("hidden");
}

export function renderStack(target, items, emptyText, htmlBuilder) {
  if (!items.length) {
    target.innerHTML = '<div class="placeholder-card">' + emptyText + "</div>";
    return;
  }

  target.innerHTML = items.map(htmlBuilder).join("");
}
