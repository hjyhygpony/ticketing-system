import { request, setToken } from "./api.js";
import { el, state } from "./state.js";
import { toast } from "./helpers.js";
import {
  closeAuth,
  closeVerifyModal,
  hideDrawer,
  openAuth,
  openVerifyGuide,
  openVerifyModal,
  renderFeatured,
  resetPasswordHint,
  setPanelExpanded,
  switchView,
  syncAuthButton,
  syncHomeMode,
  updatePasswordHint,
} from "./render.js";
import {
  doLogout,
  loadFeatured,
  loadHomeShows,
  loadProfile,
  loadSearchResults,
  loginUser,
  nextSlide,
  prevSlide,
  registerUser,
  resetUserPassword,
  sendAuthCode,
  submitVerify,
} from "./actions.js";
import {
  centerSeatMapView,
  cancelActivePurchaseQueue,
  checkPurchaseQueue,
  clearPurchaseEntryTimer,
  clearPurchaseQueueTimer,
  checkoutWaitlist,
  confirmPurchase,
  createReservation,
  joinWaitlist,
  openDetail,
  openOrderDetail,
  openPurchasePanel,
  payExistingOrder,
  purchaseMapSeats,
  getPaymentMethod,
  refreshOrders,
  renderPurchasePanel,
  renderPurchaseSuccess,
  resetSeatMapView,
  savePaymentMethod,
  selectedPurchaseZone,
  startPurchase,
  toggleFavorite,
  updateSeatMapView,
  refundOrder,
} from "./commerce.js";
import {
  loadForum,
  openForumDetail,
  openMyForum,
  openNewPostPanel,
  showForumPanel,
} from "./forum.js";
el.navBtns.forEach(function (button) {
  button.addEventListener("click", function () {
    const viewName = button.dataset.view;
    switchView(viewName);
    if (viewName === "user") {
      loadProfile();
    }
    if (viewName === "forum") {
      showForumPanel("list");
      loadForum().catch(function (error) { toast(error.message); });
    }
  });
});


el.openNewPostBtn.addEventListener("click", openNewPostPanel);
el.myForumBtn.addEventListener("click", function () {
  openMyForum().catch(function (error) {
    toast(error.message);
  });
});

el.forumSearchForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  try {
    showForumPanel("list");
    await loadForum();
  } catch (error) {
    toast(error.message);
  }
});

const forumSortSelect = el.forumSearchForm.querySelector('[name="sort"]');
if (forumSortSelect) {
  forumSortSelect.addEventListener("change", async function () {
    try {
      showForumPanel("list");
      await loadForum();
    } catch (error) {
      toast(error.message);
    }
  });
}

el.forumNewPostForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  if (!state.token) {
    openAuth("login");
    return;
  }
  try {
    const formData = Object.fromEntries(new FormData(el.forumNewPostForm).entries());
    const data = await request("/forum/posts", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    el.forumNewPostForm.reset();
    toast("帖子发布成功");
    await loadForum();
    await openForumDetail(data.post_id);
  } catch (error) {
    toast(error.message);
  }
});

el.authBtn.addEventListener("click", function () {
  if (state.user) {
    doLogout().catch(function (error) {
      toast(error.message);
    });
  } else {
    openAuth("login");
  }
});
el.closeAuthBtn.addEventListener("click", closeAuth);
el.closeDrawerBtn.addEventListener("click", async function () {
  await cancelActivePurchaseQueue();
  hideDrawer();
});
el.prevSlideBtn.addEventListener("click", prevSlide);
el.nextSlideBtn.addEventListener("click", nextSlide);
el.openResetBtn.addEventListener("click", function () {
  openAuth("reset");
});

el.backHomeBtn.addEventListener("click", async function () {
  state.isSearching = false;
  el.searchForm.reset();
  el.filterForm.reset();
  syncHomeMode();
  await loadHomeShows();
});

document.querySelectorAll(".tab-btn").forEach(function (button) {
  button.addEventListener("click", function () {
    openAuth(button.dataset.tab);
  });
});

el.codeBtn.addEventListener("click", async function () {
  try {
    const phone = new FormData(el.registerForm).get("phone");
    const data = await request("/auth/code", {
      method: "POST",
      body: JSON.stringify({ phone: phone }),
    });
    toast("演示验证码：" + data.mock_code);
  } catch (error) {
    toast(error.message);
  }
});

el.resetCodeBtn.addEventListener("click", async function () {
  try {
    const phone = new FormData(el.resetForm).get("phone");
    const data = await request("/auth/code", {
      method: "POST",
      body: JSON.stringify({ phone: phone }),
    });
    toast("演示验证码：" + data.mock_code);
  } catch (error) {
    toast(error.message);
  }
});

el.loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  try {
    const formData = Object.fromEntries(new FormData(el.loginForm).entries());
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    setToken(data.token);
    el.registerForm.reset();
    resetPasswordHint("register");
    closeAuth();
    switchView("user");
    await loadProfile();
    if (state.user && !state.user.is_verified) {
      state.verifyPromptDismissed = false;
      openVerifyGuide();
      openVerifyModal();
    }
    toast("登录成功");
  } catch (error) {
    toast(error.message);
  }
});

el.registerForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  try {
    const formData = Object.fromEntries(new FormData(el.registerForm).entries());
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    setToken(data.token);
    closeAuth();
    switchView("user");
    await loadProfile();
    state.verifyPromptDismissed = false;
    openVerifyGuide();
    openVerifyModal();
    toast("注册成功，请继续完成实名认证");
  } catch (error) {
    toast(error.message);
  }
});

el.resetForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  try {
    const formData = Object.fromEntries(new FormData(el.resetForm).entries());
    await request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    el.resetForm.reset();
    resetPasswordHint("reset");
    openAuth("login");
    toast("密码重置成功，请重新登录");
  } catch (error) {
    toast(error.message);
  }
});

el.searchForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  try {
    state.isSearching = true;
    syncHomeMode();
    await loadSearchResults();
  } catch (error) {
    toast(error.message);
  }
});

el.filterForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  try {
    await loadSearchResults();
  } catch (error) {
    toast(error.message);
  }
});

el.resetBtn.addEventListener("click", async function () {
  el.filterForm.reset();
  await loadSearchResults();
});

el.registerPasswordInput.addEventListener("input", function () {
  updatePasswordHint("register");
});

el.resetPasswordInput.addEventListener("input", function () {
  updatePasswordHint("reset");
});

el.verifyForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  if (!state.token) {
    closeVerifyModal();
    openAuth("login");
    return;
  }

  const formData = Object.fromEntries(new FormData(el.verifyForm).entries());
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
});

if (el.verifyModalForm) {
  el.verifyModalForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!state.token) {
      closeVerifyModal();
      openAuth("login");
      return;
    }

    const formData = Object.fromEntries(new FormData(el.verifyModalForm).entries());
    formData.promise = Boolean(formData.promise);

    try {
      await request("/users/verify", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      toast("实名认证成功");
      el.verifyModalForm.reset();
      if (el.verifyForm) {
        el.verifyForm.reset();
      }
      closeVerifyModal();
      await loadProfile();
    } catch (error) {
      toast(error.message);
    }
  });
}

if (el.closeVerifyModalBtn) {
  el.closeVerifyModalBtn.addEventListener("click", function () {
    state.verifyPromptDismissed = true;
    closeVerifyModal();
  });
}

function stopSeatMapDrag() {
  state.seatMap.dragging = false;
}

document.body.addEventListener("click", async function (event) {
  const panelToggle = event.target.closest("[data-panel-toggle]");
  if (panelToggle) {
    const panelName = panelToggle.dataset.panelToggle;
    setPanelExpanded(panelName, !state.panelExpanded[panelName]);
    return;
  }

  const forumBack = event.target.closest("[data-forum-back]");
  if (forumBack) {
    showForumPanel("list");
    return;
  }

  const openLogin = event.target.closest("[data-open-login]");
  if (openLogin) {
    openAuth("login");
    return;
  }

  const forumTag = event.target.closest("[data-forum-tag]");
  if (forumTag) {
    const forumTagInput = el.forumSearchForm.querySelector('[name="tag"]');
    if (forumTagInput) {
      forumTagInput.value = forumTag.dataset.forumTag || "";
    }
    showForumPanel("list");
    try {
      await loadForum();
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const forumDetail = event.target.closest("[data-forum-detail]");
  if (forumDetail) {
    try {
      await openForumDetail(forumDetail.dataset.forumDetail);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const forumLike = event.target.closest("[data-forum-like]");
  if (forumLike) {
    if (!state.token) {
      openAuth("login");
      return;
    }
    try {
      await request("/forum/posts/" + forumLike.dataset.forumLike + "/like", { method: "POST" });
      await openForumDetail(forumLike.dataset.forumLike);
      await loadForum();
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const forumFavorite = event.target.closest("[data-forum-favorite]");
  if (forumFavorite) {
    if (!state.token) {
      openAuth("login");
      return;
    }
    try {
      await request("/forum/posts/" + forumFavorite.dataset.forumFavorite + "/favorite", { method: "POST" });
      await openForumDetail(forumFavorite.dataset.forumFavorite);
      await loadForum();
      if (!el.forumMeSection.classList.contains("hidden")) {
        await openMyForum();
      }
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const dot = event.target.closest("[data-dot]");
  if (dot) {
    state.featuredIndex = Number(dot.dataset.dot || 0);
    renderFeatured();
    return;
  }

  const favoriteButton = event.target.closest("button[data-favorite]");
  if (favoriteButton) {
    try {
      await toggleFavorite(favoriteButton.dataset.favorite);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const detailButton = event.target.closest("button[data-detail]");
  if (detailButton) {
    try {
      await openDetail(detailButton.dataset.detail);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const reserveButton = event.target.closest("[data-reserve]");
  if (reserveButton) {
    try {
      await createReservation(reserveButton.dataset.reserve);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const buyButton = event.target.closest("[data-buy]");
  if (buyButton) {
    try {
      await startPurchase(buyButton.dataset.buy);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const waitlistJoin = event.target.closest("[data-waitlist-session]");
  if (waitlistJoin) {
    try {
      await joinWaitlist(waitlistJoin.dataset.waitlistSession, waitlistJoin.dataset.waitlistZone);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const waitlistCheckout = event.target.closest("[data-waitlist-checkout]");
  if (waitlistCheckout) {
    try {
      await checkoutWaitlist(waitlistCheckout.dataset.waitlistCheckout, waitlistCheckout.dataset.readAfterPay);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const orderFilter = event.target.closest("[data-order-filter]");
  if (orderFilter) {
    state.orderStatusFilter = String(orderFilter.dataset.orderFilter || "");
    try {
      await refreshOrders();
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const toggleTicket = event.target.closest("[data-toggle-ticket]");
  if (toggleTicket) {
    const orderId = toggleTicket.dataset.toggleTicket;
    state.ticketVisibleOrderId = String(state.ticketVisibleOrderId) === String(orderId) ? null : orderId;
    try {
      await openOrderDetail(orderId);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const successTicket = event.target.closest("[data-success-ticket]");
  if (successTicket) {
    state.ticketVisibleOrderId = successTicket.dataset.successTicket;
    try {
      await openOrderDetail(successTicket.dataset.successTicket);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const returnHome = event.target.closest("[data-return-home]");
  if (returnHome) {
    await cancelActivePurchaseQueue();
    hideDrawer();
    switchView("home");
    return;
  }

  const queueRefresh = event.target.closest("[data-queue-refresh]");
  if (queueRefresh) {
    try {
      await checkPurchaseQueue(queueRefresh.dataset.queueRefresh);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const zonePick = event.target.closest("[data-zone-pick]");
  if (zonePick && state.purchaseSession) {
    state.selectedZoneId = String(zonePick.dataset.zonePick);
    state.selectedSeatIds = [];
    state.purchaseQuantity = 1;
    renderPurchasePanel();
    return;
  }

  const quantityStep = event.target.closest("[data-quantity-step]");
  if (quantityStep && state.purchaseSession) {
    const selectedZone = selectedPurchaseZone();
    if (!selectedZone) {
      return;
    }
    const maxCount = Math.min(Number(state.purchaseSession.max_per_order || 1), Number(selectedZone.remaining_count || 0));
    state.purchaseQuantity = Math.max(1, Math.min(maxCount, state.purchaseQuantity + Number(quantityStep.dataset.quantityStep || 0)));
    renderPurchasePanel();
    return;
  }

  const seatToggle = event.target.closest("[data-seat-toggle]");
  if (seatToggle && state.purchaseSession) {
    const seatId = Number(seatToggle.dataset.seatToggle);
    const seat = purchaseMapSeats().find(function (item) {
      return Number(item.seat_id) === seatId;
    });
    if (!seat || Number(seat.status) !== 0 || String(seat.zone_id) !== String(state.selectedZoneId)) {
      return;
    }
    if (state.selectedSeatIds.includes(seatId)) {
      state.selectedSeatIds = state.selectedSeatIds.filter(function (item) {
        return item !== seatId;
      });
    } else {
      const maxSeats = Number(state.purchaseSession.max_per_order || 1);
      if (state.selectedSeatIds.length >= maxSeats) {
        toast("已达到本场次限购数量");
        return;
      }
      state.selectedSeatIds = state.selectedSeatIds.concat(seatId);
    }
    renderPurchasePanel();
    return;
  }

  const seatZoom = event.target.closest("[data-seat-zoom]");
  if (seatZoom) {
    state.seatMap.scale = Math.max(0.6, Math.min(2.4, Number((state.seatMap.scale + Number(seatZoom.dataset.seatZoom || 0)).toFixed(2))));
    updateSeatMapView();
    return;
  }

  const seatResetView = event.target.closest("[data-seat-reset-view]");
  if (seatResetView) {
    centerSeatMapView();
    return;
  }

  const refreshSeats = event.target.closest("[data-refresh-seats]");
  if (refreshSeats && state.purchaseSession) {
    try {
      await openPurchasePanel(state.purchaseSession.session_id, state.selectedZoneId);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const confirmPurchaseBtn = event.target.closest("[data-confirm-purchase]");
  if (confirmPurchaseBtn) {
    try {
      await confirmPurchase();
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const orderDetail = event.target.closest("[data-order-detail]");
  if (orderDetail) {
    try {
      await openOrderDetail(orderDetail.dataset.orderDetail);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const payExisting = event.target.closest("[data-pay-existing]");
  if (payExisting) {
    await payExistingOrder(payExisting.dataset.payExisting);
    return;
  }

  const refundOrderBtn = event.target.closest("[data-refund-order]");
  if (refundOrderBtn) {
    try {
      await refundOrder(refundOrderBtn.dataset.refundOrder);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const readButton = event.target.closest("[data-read-message]");
  if (readButton) {
    try {
      await request("/users/messages/" + readButton.dataset.readMessage + "/read", { method: "POST" });
      toast("已标记为已读");
      await loadProfile();
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const cancelButton = event.target.closest("[data-cancel]");
  if (cancelButton) {
    try {
      await request("/reservations/" + cancelButton.dataset.cancel, { method: "DELETE" });
      toast("预约已取消");
      await loadProfile();
    } catch (error) {
      toast(error.message);
    }
  }
});

document.body.addEventListener("pointerdown", function (event) {
  const viewport = event.target.closest("[data-seat-map-viewport]");
  if (!viewport || event.target.closest("button")) {
    return;
  }
  state.seatMap.dragging = true;
  state.seatMap.startX = event.clientX;
  state.seatMap.startY = event.clientY;
  state.seatMap.startPanX = state.seatMap.panX;
  state.seatMap.startPanY = state.seatMap.panY;
  event.preventDefault();
});

document.body.addEventListener("pointermove", function (event) {
  if (!state.seatMap.dragging) {
    return;
  }
  state.seatMap.panX = state.seatMap.startPanX + (event.clientX - state.seatMap.startX);
  state.seatMap.panY = state.seatMap.startPanY + (event.clientY - state.seatMap.startY);
  updateSeatMapView();
});

document.body.addEventListener("pointerup", stopSeatMapDrag);
document.body.addEventListener("pointercancel", stopSeatMapDrag);

document.body.addEventListener("wheel", function (event) {
  const viewport = event.target.closest("[data-seat-map-viewport]");
  if (!viewport) {
    return;
  }
  event.preventDefault();
  state.seatMap.scale = Math.max(0.6, Math.min(2.4, Number((state.seatMap.scale + (event.deltaY < 0 ? 0.12 : -0.12)).toFixed(2))));
  updateSeatMapView();
}, { passive: false });

document.body.addEventListener("submit", async function (event) {
  const payForm = event.target.closest("#payOrderForm");
  if (payForm) {
    event.preventDefault();
    const orderId = payForm.dataset.payOrder;
    const formData = Object.fromEntries(new FormData(payForm).entries());
    formData.payment_method = formData.payment_method || getPaymentMethod(orderId);
    try {
      await request("/orders/" + orderId + "/pay", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      savePaymentMethod(orderId, formData.payment_method);
      toast("支付成功");
      await refreshOrders();
      await loadProfile();
      await renderPurchaseSuccess(orderId);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const refundForm = event.target.closest("#refundConfirmForm");
  if (refundForm) {
    event.preventDefault();
    const orderId = refundForm.dataset.refundConfirm;
    const formData = Object.fromEntries(new FormData(refundForm).entries());
    try {
      await request("/orders/" + orderId + "/refund", {
        method: "POST",
        body: JSON.stringify(formData),
      });
       toast("退票申请已提交");
      await refreshOrders();
      await loadProfile();
      state.ticketVisibleOrderId = null;
      await openOrderDetail(orderId);
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const forumCommentForm = event.target.closest("#forumCommentForm");
  if (forumCommentForm) {
    event.preventDefault();
    if (!state.token) {
      openAuth("login");
      return;
    }
    const formData = Object.fromEntries(new FormData(forumCommentForm).entries());
    try {
      await request("/forum/posts/" + state.forumCurrentPostId + "/comments", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      toast("评论成功");
      await openForumDetail(state.forumCurrentPostId);
      await loadForum();
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  const forumReportForm = event.target.closest("#forumReportForm");
  if (forumReportForm) {
    event.preventDefault();
    if (!state.token) {
      openAuth("login");
      return;
    }
    const formData = Object.fromEntries(new FormData(forumReportForm).entries());
    try {
      await request("/forum/posts/" + state.forumCurrentPostId + "/report", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      forumReportForm.reset();
      toast("举报已提交");
    } catch (error) {
      toast(error.message);
    }
  }
});

window.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeAuth();
    hideDrawer();
    closeVerifyModal();
  }
});

setInterval(function () {
  if (!document.hidden && state.featured.length > 1 && !el.homeView.classList.contains("hidden")) {
    nextSlide();
  }
}, 5000);

