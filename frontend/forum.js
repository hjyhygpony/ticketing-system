import { request } from "./api.js";
import { el, state } from "./state.js";
import { escapeHtml, formatTime, toast } from "./helpers.js";
import { openAuth } from "./render.js";
function forumExcerpt(content) {
  const value = String(content || "").trim();
  if (value.length <= 96) {
    return value;
  }
  return value.slice(0, 96) + "...";
}

function forumTagsHtml(tags) {
  const list = Array.isArray(tags) ? tags : [];
  if (!list.length) {
    return '<span class="chip">无标签</span>';
  }
  return list.map(function (tag) {
    return `<button class="chip chip-btn" data-forum-tag="${escapeHtml(tag)}" type="button">#${escapeHtml(tag)}</button>`;
  }).join("");
}

function showForumPanel(panelName) {
  const map = {
    list: el.forumListSection,
    new: el.forumNewPostSection,
    detail: el.forumDetailSection,
    me: el.forumMeSection,
  };
  Object.keys(map).forEach(function (key) {
    map[key].classList.toggle("hidden", key !== panelName);
  });
}

function renderHotTags(tags) {
  const list = Array.isArray(tags) ? tags : [];
  if (!list.length) {
    el.forumHotTags.innerHTML = '<span class="muted">暂无热门标签</span>';
    return;
  }
  el.forumHotTags.innerHTML = list.map(function (item) {
    return `<button class="chip chip-btn" data-forum-tag="${escapeHtml(item.tag)}" type="button">#${escapeHtml(item.tag)} · ${item.count}</button>`;
  }).join("");
}

function renderForumPosts(posts) {
  const list = Array.isArray(posts) ? posts : [];
  state.forumPosts = list;
  if (!list.length) {
    el.forumPostList.innerHTML = '<div class="placeholder-card">暂时没有匹配的帖子，可以换个标签搜索，或者发布第一篇帖子。</div>';
    return;
  }

  el.forumPostList.innerHTML = list.map(function (post) {
    return `
      <article class="forum-post-card">
        <div class="forum-post-main">
          <div class="chip-row">${forumTagsHtml(post.tags)}</div>
          <h4>${escapeHtml(post.title)}</h4>
          <p>${escapeHtml(forumExcerpt(post.content))}</p>
          <div class="forum-post-meta">
            <span>${escapeHtml(post.author_name)}</span>
            <span>${formatTime(post.post_time)}</span>
          </div>
        </div>
        <div class="forum-post-side">
          <span>👍 ${post.like_count || 0}</span>
          <span>💬 ${post.comment_count || 0}</span>
          <span>收藏 ${post.fav_count || 0}</span>
          <button class="ghost-btn" data-forum-detail="${post.post_id}" type="button">查看详情</button>
        </div>
      </article>
    `;
  }).join("");
}

async function loadForum() {
  const formData = new FormData(el.forumSearchForm);
  const tag = String(formData.get("tag") || "").trim();
  const sort = String(formData.get("sort") || "latest");
  const query = new URLSearchParams();
  if (tag) {
    query.set("tag", tag);
  }
  query.set("sort", sort);
  const data = await request("/forum/posts?" + query.toString());
  renderHotTags(data.hot_tags || []);
  renderForumPosts(data.posts || []);
  const sortText = sort === "hot" ? "最热" : "最新";
  el.forumMeta.textContent = tag ? `当前按标签“${tag}”筛选，排序：${sortText}` : `全部帖子，排序：${sortText}`;
}


function openNewPostPanel() {
  if (!state.token) {
    openAuth("login");
    return;
  }
  el.forumNewPostForm.reset();
  showForumPanel("new");
}

async function openForumDetail(postId) {
  state.forumCurrentPostId = Number(postId);
  const post = await request("/forum/posts/" + postId);
  renderForumDetail(post);
  showForumPanel("detail");
}

function renderForumDetail(post) {
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const commentHtml = comments.length ? comments.map(function (comment) {
    return `
      <div class="forum-comment-item">
        <div class="forum-post-meta">
          <strong>${escapeHtml(comment.author_name)}</strong>
          <span>${formatTime(comment.comment_time)}</span>
        </div>
        <p>${escapeHtml(comment.content)}</p>
      </div>
    `;
  }).join("") : '<div class="placeholder-card">暂无评论。</div>';

  const commentForm = state.token ? `
    <form id="forumCommentForm" class="forum-comment-form">
      <textarea name="content" rows="4" maxlength="500" placeholder="请输入评论，最多 500 字"></textarea>
      <button class="primary-btn" type="submit">发表评论</button>
    </form>
  ` : '<div class="placeholder-card">登录后才能评论，请<button class="ghost-btn" data-open-login type="button">先登录</button></div>';

  el.forumDetailBody.innerHTML = `
    <article class="forum-detail-card">
      <div class="chip-row">${forumTagsHtml(post.tags)}</div>
      <h2>${escapeHtml(post.title)}</h2>
      <div class="forum-post-meta">
        <span>${escapeHtml(post.author_name)}</span>
        <span>${formatTime(post.post_time)}</span>
      </div>
      <p class="forum-detail-content">${escapeHtml(post.content).replace(/\n/g, "<br>")}</p>
      <div class="forum-action-row">
        <button class="ghost-btn ${post.liked ? "active-action" : ""}" data-forum-like="${post.post_id}" type="button">${post.liked ? "已点赞" : "点赞"} · ${post.like_count || 0}</button>
        <button class="ghost-btn ${post.favorited ? "active-action" : ""}" data-forum-favorite="${post.post_id}" type="button">${post.favorited ? "已收藏" : "收藏"} · ${post.fav_count || 0}</button>
      </div>
      <details class="forum-report-box">
        <summary>举报帖子</summary>
        <form id="forumReportForm" class="inline-row">
          <input name="reason" maxlength="500" placeholder="请输入举报原因">
          <button class="ghost-btn" type="submit">提交举报</button>
        </form>
      </details>
    </article>
    <section class="forum-comments" id="comments">
      <h3>评论 <span class="muted">${comments.length}</span></h3>
      ${commentForm}
      <div class="forum-comment-list">${commentHtml}</div>
    </section>
  `;
}


async function openMyForum() {
  if (!state.token) {
    openAuth("login");
    return;
  }
  const data = await request("/forum/me");
  renderForumMe(data);
  showForumPanel("me");
}

function renderForumMiniList(items, emptyText) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return `<div class="placeholder-card">${emptyText}</div>`;
  }
  return list.map(function (post) {
    return `
      <article class="mini-card forum-mini-card">
        <button data-forum-detail="${post.post_id}" type="button">${escapeHtml(post.title)}</button>
        <p class="muted">点赞 ${post.like_count || 0} · 评论 ${post.comment_count || 0} · 收藏 ${post.fav_count || 0}</p>
        <div class="chip-row">${forumTagsHtml(post.tags)}</div>
      </article>
    `;
  }).join("");
}

function renderForumMe(data) {
  el.forumMeBody.innerHTML = `
    <section>
      <h4>我发布的帖子</h4>
      ${renderForumMiniList(data.my_posts, "还没有发布帖子。")}
    </section>
    <section>
      <h4>我收藏的帖子</h4>
      ${renderForumMiniList(data.favorites, "还没有收藏帖子。")}
    </section>
  `;
}


export {
  showForumPanel,
  loadForum,
  openNewPostPanel,
  openForumDetail,
  openMyForum,
};
