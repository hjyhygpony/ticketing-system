import re

from fastapi import APIRouter, Body, Depends

from .common import fail, get_current_user, get_optional_user, success
from .database import fetch_all, fetch_one, get_connection, run_in_transaction
from .security import mask_phone


router = APIRouter()


def normalize_tags(raw):
    """把用户输入的标签字符串切成最多 8 个标签，兼容空格、逗号、#。"""
    if not raw:
        return []
    if isinstance(raw, list):
        items = raw
    else:
        items = re.split(r"[,，#\s]+", str(raw))

    result = []
    seen = set()
    for item in items:
        tag = str(item).strip()
        if not tag:
            continue
        tag = tag[:40]
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(tag)
        if len(result) >= 8:
            break
    return result


def public_user_name(row):
    phone = str(row.get("phone") or "")
    return "用户" + mask_phone(phone) if phone else "匿名用户"


def split_tags(value):
    if not value:
        return []
    return [item for item in str(value).split(",") if item]


def map_post_row(row):
    item = dict(row)
    item["author_name"] = public_user_name(item)
    item["tags"] = split_tags(item.get("tags"))
    item.pop("phone", None)
    return item


def ensure_forum_schema():
    """兼容已经建好的票务数据库：只补充论坛需要的标签表和字段长度。"""
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS `post_tag` (
              `tag_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '标签ID',
              `post_id` integer NOT NULL COMMENT '帖子ID',
              `tag` varchar(40) NOT NULL COMMENT '标签名',
              UNIQUE KEY `uk_post_tag` (`post_id`, `tag`),
              INDEX `idx_tag` (`tag`),
              CONSTRAINT `post_tag_to_post` FOREIGN KEY (`post_id`) REFERENCES `post` (`post_id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        try:
            cursor.execute("ALTER TABLE `comment` MODIFY `content` varchar(500) NOT NULL COMMENT '评论内容（1-500字符）'")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE `report` MODIFY `reason` varchar(500) NOT NULL COMMENT '举报原因（≤500字）'")
        except Exception:
            pass
        connection.commit()
    finally:
        cursor.close()
        connection.close()


def seed_forum_demo_data():
    """如果没有任何标签数据，自动补几条论坛演示数据，方便首次打开就能看到效果。"""
    tag_count = fetch_one("SELECT COUNT(*) AS total FROM `post_tag`") or {"total": 0}
    if tag_count["total"] > 0:
        return

    users = fetch_all("SELECT user_id FROM `user` WHERE status = 1 ORDER BY user_id LIMIT 3")
    if not users:
        return

    user_ids = [item["user_id"] for item in users]
    while len(user_ids) < 3:
        user_ids.append(user_ids[-1])

    def work(cursor):
        demo_posts = [
            (
                user_ids[0],
                "开票前要不要先预约？",
                "我一般会先收藏演出，再关注开票时间。热门场次建议提前看好场次和票价区间，开票后少犹豫。",
                2,
                1,
                2,
                ["预约", "开票提醒", "抢票经验"],
            ),
            (
                user_ids[1],
                "演唱会抢票失败后还有机会吗？",
                "如果官方开启候补，可以关注退票释放。也可以多看看不同场次，工作日场次有时更容易买到。",
                4,
                2,
                1,
                ["候补", "演唱会", "抢票经验"],
            ),
            (
                user_ids[2],
                "大家会按什么标签找帖子？",
                "我想按演出类型、城市、艺人、抢票经验这些标签找内容，感觉比全文搜索简单很多。",
                1,
                0,
                0,
                ["标签搜索", "论坛建议"],
            ),
        ]

        post_ids = []
        for user_id, title, content, like_count, fav_count, comment_count, tags in demo_posts:
            cursor.execute(
                """
                INSERT INTO `post` (user_id, show_id, title, content, audit_status, like_count, fav_count, comment_count)
                VALUES (%s, NULL, %s, %s, 1, %s, %s, %s)
                """,
                (user_id, title, content, like_count, fav_count, comment_count),
            )
            post_id = cursor.lastrowid
            post_ids.append(post_id)
            for tag in tags:
                cursor.execute(
                    "INSERT IGNORE INTO `post_tag` (post_id, tag) VALUES (%s, %s)",
                    (post_id, tag),
                )

        cursor.execute(
            "INSERT INTO `comment` (post_id, user_id, content) VALUES (%s, %s, %s)",
            (post_ids[0], user_ids[1], "我也会提前收藏，开票当天直接进详情页。"),
        )
        cursor.execute(
            "INSERT INTO `comment` (post_id, user_id, content) VALUES (%s, %s, %s)",
            (post_ids[0], user_ids[2], "最好再看清楚退票规则和场次时间。"),
        )
        cursor.execute(
            "INSERT INTO `comment` (post_id, user_id, content) VALUES (%s, %s, %s)",
            (post_ids[1], user_ids[0], "候补有用，但也要看释放票量。"),
        )

    run_in_transaction(work)


def get_hot_tags():
    return fetch_all(
        """
        SELECT tag, COUNT(*) AS count
        FROM `post_tag`
        GROUP BY tag
        ORDER BY count DESC, tag ASC
        LIMIT 12
        """
    )


@router.get("/forum/posts")
def list_posts(tag: str = "", sort: str = "latest"):
    tag = str(tag or "").strip()
    sort = "hot" if sort == "hot" else "latest"

    params = []
    where_sql = "WHERE p.audit_status = 1"
    if tag:
        where_sql += """
        AND EXISTS (
          SELECT 1
          FROM `post_tag` st
          WHERE st.post_id = p.post_id
          AND st.tag LIKE %s
        )
        """
        params.append(f"%{tag}%")

    order_sql = "(p.like_count + p.comment_count + p.fav_count) DESC, p.post_time DESC" if sort == "hot" else "p.post_time DESC"
    rows = fetch_all(
        f"""
        SELECT
          p.post_id,
          p.title,
          p.content,
          p.like_count,
          p.fav_count,
          p.comment_count,
          p.post_time,
          u.phone,
          (
            SELECT GROUP_CONCAT(t.tag ORDER BY t.tag SEPARATOR ',')
            FROM `post_tag` t
            WHERE t.post_id = p.post_id
          ) AS tags
        FROM `post` p
        JOIN `user` u ON u.user_id = p.user_id
        {where_sql}
        ORDER BY {order_sql}
        LIMIT 50
        """,
        tuple(params),
    )
    return success({"posts": [map_post_row(row) for row in rows], "hot_tags": get_hot_tags(), "tag": tag, "sort": sort})


@router.post("/forum/posts")
def create_post(payload: dict = Body(...), user=Depends(get_current_user)):
    title = str(payload.get("title", "")).strip()
    content = str(payload.get("content", "")).strip()
    tags = normalize_tags(payload.get("tags", ""))

    if len(title) < 2 or len(title) > 100:
        fail(400, "标题需要 2-100 个字符")
    if len(content) < 1 or len(content) > 10000:
        fail(400, "正文需要 1-10000 个字符")
    if not tags:
        fail(400, "请至少填写一个标签，搜索只按标签匹配")

    def work(cursor):
        cursor.execute(
            """
            INSERT INTO `post` (user_id, show_id, title, content, audit_status)
            VALUES (%s, NULL, %s, %s, 1)
            """,
            (user["user_id"], title, content),
        )
        post_id = cursor.lastrowid
        for tag in tags:
            cursor.execute(
                "INSERT IGNORE INTO `post_tag` (post_id, tag) VALUES (%s, %s)",
                (post_id, tag),
            )
        return post_id

    post_id = run_in_transaction(work)
    return success({"post_id": post_id}, "帖子发布成功")


@router.get("/forum/posts/{post_id}")
def get_post_detail(post_id: int, user=Depends(get_optional_user)):
    current_user_id = user["user_id"] if user else 0
    row = fetch_one(
        """
        SELECT
          p.post_id,
          p.user_id,
          p.show_id,
          p.title,
          p.content,
          p.audit_status,
          p.like_count,
          p.fav_count,
          p.comment_count,
          p.post_time,
          u.phone,
          s.title AS show_title,
          (
            SELECT GROUP_CONCAT(t.tag ORDER BY t.tag SEPARATOR ',')
            FROM `post_tag` t
            WHERE t.post_id = p.post_id
          ) AS tags
        FROM `post` p
        JOIN `user` u ON u.user_id = p.user_id
        LEFT JOIN `show` s ON s.show_id = p.show_id
        WHERE p.post_id = %s AND p.audit_status = 1
        """,
        (post_id,),
    )
    if not row:
        fail(404, "帖子不存在或未公开")

    comments = fetch_all(
        """
        SELECT c.comment_id, c.post_id, c.user_id, c.content, c.comment_time, u.phone
        FROM `comment` c
        JOIN `user` u ON u.user_id = c.user_id
        WHERE c.post_id = %s
        ORDER BY c.comment_time ASC
        """,
        (post_id,),
    )

    liked = fetch_one("SELECT COUNT(*) AS total FROM `like` WHERE user_id = %s AND post_id = %s", (current_user_id, post_id))
    favorited = fetch_one("SELECT COUNT(*) AS total FROM `favorite_post` WHERE user_id = %s AND post_id = %s", (current_user_id, post_id))

    post = map_post_row(row)
    post["comments"] = [map_post_row(comment) for comment in comments]
    post["liked"] = bool(liked and liked["total"])
    post["favorited"] = bool(favorited and favorited["total"])
    return success(post)


@router.post("/forum/posts/{post_id}/comments")
def create_comment(post_id: int, payload: dict = Body(...), user=Depends(get_current_user)):
    content = str(payload.get("content", "")).strip()
    if len(content) < 1 or len(content) > 500:
        fail(400, "评论内容需要 1-500 个字符")

    post = fetch_one("SELECT post_id FROM `post` WHERE post_id = %s AND audit_status = 1", (post_id,))
    if not post:
        fail(404, "帖子不存在或未公开")

    def work(cursor):
        cursor.execute(
            "INSERT INTO `comment` (post_id, user_id, content) VALUES (%s, %s, %s)",
            (post_id, user["user_id"], content),
        )
        cursor.execute("UPDATE `post` SET comment_count = comment_count + 1 WHERE post_id = %s", (post_id,))

    run_in_transaction(work)
    return success(message="评论成功")


@router.post("/forum/posts/{post_id}/like")
def toggle_like(post_id: int, user=Depends(get_current_user)):
    post = fetch_one("SELECT post_id FROM `post` WHERE post_id = %s AND audit_status = 1", (post_id,))
    if not post:
        fail(404, "帖子不存在或未公开")

    def work(cursor):
        cursor.execute("SELECT COUNT(*) AS total FROM `like` WHERE user_id = %s AND post_id = %s", (user["user_id"], post_id))
        exists = cursor.fetchone()["total"] > 0
        if exists:
            cursor.execute("DELETE FROM `like` WHERE user_id = %s AND post_id = %s", (user["user_id"], post_id))
            cursor.execute("UPDATE `post` SET like_count = GREATEST(like_count - 1, 0) WHERE post_id = %s", (post_id,))
            liked = False
        else:
            cursor.execute("INSERT INTO `like` (user_id, post_id) VALUES (%s, %s)", (user["user_id"], post_id))
            cursor.execute("UPDATE `post` SET like_count = like_count + 1 WHERE post_id = %s", (post_id,))
            liked = True
        cursor.execute("SELECT like_count FROM `post` WHERE post_id = %s", (post_id,))
        count = cursor.fetchone()["like_count"]
        return {"liked": liked, "like_count": count}

    return success(run_in_transaction(work), "点赞状态已更新")


@router.post("/forum/posts/{post_id}/favorite")
def toggle_favorite(post_id: int, user=Depends(get_current_user)):
    post = fetch_one("SELECT post_id FROM `post` WHERE post_id = %s AND audit_status = 1", (post_id,))
    if not post:
        fail(404, "帖子不存在或未公开")

    def work(cursor):
        cursor.execute("SELECT COUNT(*) AS total FROM `favorite_post` WHERE user_id = %s AND post_id = %s", (user["user_id"], post_id))
        exists = cursor.fetchone()["total"] > 0
        if exists:
            cursor.execute("DELETE FROM `favorite_post` WHERE user_id = %s AND post_id = %s", (user["user_id"], post_id))
            cursor.execute("UPDATE `post` SET fav_count = GREATEST(fav_count - 1, 0) WHERE post_id = %s", (post_id,))
            favorited = False
        else:
            cursor.execute("INSERT INTO `favorite_post` (user_id, post_id) VALUES (%s, %s)", (user["user_id"], post_id))
            cursor.execute("UPDATE `post` SET fav_count = fav_count + 1 WHERE post_id = %s", (post_id,))
            favorited = True
        cursor.execute("SELECT fav_count FROM `post` WHERE post_id = %s", (post_id,))
        count = cursor.fetchone()["fav_count"]
        return {"favorited": favorited, "fav_count": count}

    return success(run_in_transaction(work), "收藏状态已更新")


@router.post("/forum/posts/{post_id}/report")
def report_post(post_id: int, payload: dict = Body(...), user=Depends(get_current_user)):
    reason = str(payload.get("reason", "")).strip() or "其他原因"
    if len(reason) > 500:
        fail(400, "举报原因不能超过 500 个字符")
    post = fetch_one("SELECT post_id FROM `post` WHERE post_id = %s AND audit_status = 1", (post_id,))
    if not post:
        fail(404, "帖子不存在或未公开")

    def work(cursor):
        cursor.execute(
            "INSERT INTO `report` (user_id, post_id, reason) VALUES (%s, %s, %s)",
            (user["user_id"], post_id, reason),
        )

    run_in_transaction(work)
    return success(message="举报已提交")


@router.get("/forum/me")
def my_forum(user=Depends(get_current_user)):
    my_posts = fetch_all(
        """
        SELECT
          p.post_id, p.title, p.content, p.like_count, p.fav_count, p.comment_count, p.post_time, u.phone,
          (SELECT GROUP_CONCAT(t.tag ORDER BY t.tag SEPARATOR ',') FROM `post_tag` t WHERE t.post_id = p.post_id) AS tags
        FROM `post` p
        JOIN `user` u ON u.user_id = p.user_id
        WHERE p.user_id = %s
        ORDER BY p.post_time DESC
        """,
        (user["user_id"],),
    )
    favorites = fetch_all(
        """
        SELECT
          p.post_id, p.title, p.content, p.like_count, p.fav_count, p.comment_count, p.post_time, u.phone,
          (SELECT GROUP_CONCAT(t.tag ORDER BY t.tag SEPARATOR ',') FROM `post_tag` t WHERE t.post_id = p.post_id) AS tags
        FROM `favorite_post` fp
        JOIN `post` p ON fp.post_id = p.post_id
        JOIN `user` u ON u.user_id = p.user_id
        WHERE fp.user_id = %s
        ORDER BY fp.created_at DESC
        """,
        (user["user_id"],),
    )
    return success({"my_posts": [map_post_row(row) for row in my_posts], "favorites": [map_post_row(row) for row in favorites]})
