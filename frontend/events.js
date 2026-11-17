import { request, setToken } from "./api.js";
import {
  createReservation,
  doLogout,
  loadHomeShows,
  loadProfile,
  loadSearchResults,
  nextSlide,
  openDetail,
  prevSlide,
  registerUser,
  resetUserPassword,
  sendAuthCode,
  startPurchase,
  submitVerify,
  toggleFavorite,
  loginUser,
} from "./actions.js";
import { toast } from "./helpers.js";
import { el, state } from "./state.js";
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
  syncHomeMode,
  updatePasswordHint,
} from "./render.js";

async function handleAsync(action) {
  try {
    await action();
  } catch (error) {
    toast(error.message);
  }
}

function handleAuthButton() {
  if (state.user) {
    handleAsync(doLogout);
    return;
  }

  openAuth("login");
}

export function bindEvents() {
  el.navBtns.forEach(function (button) {
    button.addEventListener("click", function () {
      const viewName = button.dataset.view;
      switchView(viewName);
      if (viewName === "user") {
        loadProfile();
      }
    });
  });

  el.authBtn.addEventListener("click", handleAuthButton);
  el.closeAuthBtn.addEventListener("click", closeAuth);
  el.closeDrawerBtn.addEventListener("click", hideDrawer);
  el.prevSlideBtn.addEventListener("click", prevSlide);
  el.nextSlideBtn.addEventListener("click", nextSlide);

  if (el.closeVerifyModalBtn) {
    el.closeVerifyModalBtn.addEventListener("click", function () {
      state.verifyPromptDismissed = true;
      closeVerifyModal();
    });
  }

  el.openResetBtn.addEventListener("click", function () {
    openAuth("reset");
  });

  el.backHomeBtn.addEventListener("click", function () {
    handleAsync(async function () {
      state.isSearching = false;
      el.searchForm.reset();
      el.filterForm.reset();
      syncHomeMode();
      await loadHomeShows();
    });
  });

  document.querySelectorAll(".tab-btn").forEach(function (button) {
    button.addEventListener("click", function () {
      openAuth(button.dataset.tab);
    });
  });

  el.codeBtn.addEventListener("click", function () {
    handleAsync(async function () {
      const phone = new FormData(el.registerForm).get("phone");
      const data = await sendAuthCode(phone);
      toast("演示验证码：" + data.mock_code);
    });
  });

  el.resetCodeBtn.addEventListener("click", function () {
    handleAsync(async function () {
      const phone = new FormData(el.resetForm).get("phone");
      const data = await sendAuthCode(phone);
      toast("演示验证码：" + data.mock_code);
    });
  });

  el.loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    handleAsync(async function () {
      const formData = Object.fromEntries(new FormData(el.loginForm).entries());
      const data = await loginUser(formData);
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
    });
  });

  el.registerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    handleAsync(async function () {
      const formData = Object.fromEntries(new FormData(el.registerForm).entries());
      const data = await registerUser(formData);
      setToken(data.token);
      closeAuth();
      switchView("user");
      await loadProfile();
      state.verifyPromptDismissed = false;
      openVerifyGuide();
      openVerifyModal();
      toast("注册成功，请继续完成实名认证");
    });
  });

  el.resetForm.addEventListener("submit", function (event) {
    event.preventDefault();
    handleAsync(async function () {
      const formData = Object.fromEntries(new FormData(el.resetForm).entries());
      await resetUserPassword(formData);
      el.resetForm.reset();
      resetPasswordHint("reset");
      openAuth("login");
      toast("密码重置成功，请重新登录");
    });
  });

  el.searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    handleAsync(async function () {
      state.isSearching = true;
      syncHomeMode();
      await loadSearchResults();
    });
  });

  el.filterForm.addEventListener("submit", function (event) {
    event.preventDefault();
    handleAsync(loadSearchResults);
  });

  el.resetBtn.addEventListener("click", function () {
    handleAsync(async function () {
      el.filterForm.reset();
      await loadSearchResults();
    });
  });

  el.registerPasswordInput.addEventListener("input", function () {
    updatePasswordHint("register");
  });

  el.resetPasswordInput.addEventListener("input", function () {
    updatePasswordHint("reset");
  });

  el.verifyForm.addEventListener("submit", function (event) {
    event.preventDefault();
    handleAsync(async function () {
      await submitVerify(el.verifyForm);
    });
  });

  if (el.verifyModalForm) {
    el.verifyModalForm.addEventListener("submit", function (event) {
      event.preventDefault();
      handleAsync(async function () {
        await submitVerify(el.verifyModalForm);
      });
    });
  }

  document.body.addEventListener("click", function (event) {
    const panelToggle = event.target.closest("[data-panel-toggle]");
    const favoriteButton = event.target.closest("button[data-favorite]");
    const detailButton = event.target.closest("button[data-detail]");
    const dot = event.target.closest("[data-dot]");
    const reserveButton = event.target.closest("[data-reserve]");
    const buyButton = event.target.closest("[data-buy]");
    const readButton = event.target.closest("[data-read-message]");
    const cancelButton = event.target.closest("[data-cancel]");

    if (panelToggle) {
      const panelName = panelToggle.dataset.panelToggle;
      setPanelExpanded(panelName, !state.panelExpanded[panelName]);
      return;
    }

    if (favoriteButton) {
      handleAsync(async function () {
        await toggleFavorite(favoriteButton.dataset.favorite);
      });
      return;
    }

    if (detailButton) {
      handleAsync(async function () {
        await openDetail(detailButton.dataset.detail);
      });
      return;
    }

    if (dot) {
      state.featuredIndex = Number(dot.dataset.dot);
      renderFeatured();
      return;
    }

    if (reserveButton) {
      handleAsync(async function () {
        await createReservation(reserveButton.dataset.reserve);
      });
      return;
    }

    if (buyButton) {
      handleAsync(async function () {
        await startPurchase(buyButton.dataset.buy);
      });
      return;
    }

    if (readButton) {
      handleAsync(async function () {
        await request("/users/messages/" + readButton.dataset.readMessage + "/read", { method: "POST" });
        toast("已标记为已读");
        await loadProfile();
      });
      return;
    }

    if (cancelButton) {
      handleAsync(async function () {
        await request("/reservations/" + cancelButton.dataset.cancel, { method: "DELETE" });
        toast("预约已取消");
        await loadProfile();
      });
    }
  });

  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeAuth();
      hideDrawer();
    }
  });
}

export function startCarouselTimer() {
  setInterval(function () {
    if (!document.hidden && state.featured.length > 1 && !el.homeView.classList.contains("hidden")) {
      nextSlide();
    }
  }, 5000);
}
