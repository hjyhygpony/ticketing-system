import { el, state } from "./state.js";

export function posterFallback(seed) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1080">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#2f160f"/>
          <stop offset="100%" stop-color="#d46a3d"/>
        </linearGradient>
      </defs>
      <rect width="800" height="1080" fill="url(#g)"/>
      <circle cx="630" cy="210" r="170" fill="rgba(255,223,186,.24)"/>
      <circle cx="160" cy="830" r="220" fill="rgba(255,246,232,.16)"/>
      <text x="72" y="160" fill="#fff7ef" font-size="40" font-family="Microsoft YaHei, sans-serif">电子票务系统</text>
      <text x="72" y="315" fill="#fff7ef" font-size="68" font-family="Georgia, serif">${String(seed || "演出海报").slice(0, 12)}</text>
      <text x="72" y="405" fill="#f8d9ca" font-size="28" font-family="Microsoft YaHei, sans-serif">Live Show Poster</text>
    </svg>
  `)}`;
}

export function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(function () {
    el.toast.classList.add("hidden");
  }, 2600);
}

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatTime(value) {
  if (!value) {
    return "待定";
  }

  const time = new Date(value);
  if (Number.isNaN(time.getTime())) {
    return value;
  }

  return time.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPrice(value) {
  return "¥" + Number(value || 0).toFixed(0);
}

export function buildStatusChip(item) {
  const key = item.sale_status || "pending";
  const label = item.sale_status_label || "未开票";
  return `<span class="chip status-chip status-${key}">${label}</span>`;
}

export function currentSearchKeyword() {
  return String(new FormData(el.searchForm).get("keyword") || "").trim();
}

export function isFavoriteShow(showId) {
  return state.favoriteShowIds.has(Number(showId));
}

export function buildFavoriteButton(showId, favorited) {
  return `
    <button
      class="favorite-toggle ${favorited ? "is-active" : ""}"
      data-favorite="${showId}"
      type="button"
      aria-label="${favorited ? "取消收藏" : "收藏演出"}"
      title="${favorited ? "取消收藏" : "收藏演出"}"
    >
      &#9829;
    </button>
  `;
}

export function passwordState(password) {
  const value = String(password || "");
  const hasLength = value.length >= 8 && value.length <= 20;
  const hasLetter = /[A-Za-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const ruleCount = [hasLength, hasLetter, hasNumber].filter(Boolean).length;
  let level = "weak";
  let text = "弱";

  if (ruleCount === 3 && value.length >= 12) {
    level = "strong";
    text = "强";
  } else if (ruleCount >= 2) {
    level = "medium";
    text = "中";
  }

  return {
    level: level,
    text: text,
    hasLength: hasLength,
    hasLetter: hasLetter,
    hasNumber: hasNumber,
  };
}

export function setRuleState(node, passed) {
  node.classList.remove("ok", "bad");
  node.classList.add(passed ? "ok" : "bad");
}

export function syncFavoriteButton(button, favorited) {
  if (!button) {
    return;
  }

  button.classList.toggle("is-active", favorited);
  button.setAttribute("aria-label", favorited ? "取消收藏" : "收藏演出");
  button.setAttribute("title", favorited ? "取消收藏" : "收藏演出");
}
