from datetime import timedelta

from fastapi import APIRouter, Body, Depends, Header, Query

from . import config
from .common import check_job_secret, get_current_user, get_optional_user, success, fail
from .database import fetch_all, fetch_one, run_in_transaction
from .security import now_local


router = APIRouter()


def parse_time_window(start_date, end_date):
    start = None
    end = None
    if start_date:
        start = start_date + " 00:00:00"
    if end_date:
        end = end_date + " 23:59:59"
    return start, end


def insert_message(cursor, user_id, title, content):
    cursor.execute(
        "INSERT INTO message (user_id, title, content) VALUES (%s, %s, %s)",
        (user_id, title, content),
    )


def attach_sale_status(items):
    if not items:
        return items

    show_ids = [item["show_id"] for item in items]
    marks = ", ".join(["%s"] * len(show_ids))
    rows = fetch_all(
        """
        SELECT
            se.show_id,
            se.session_id,
            se.ticket_open_time,
            se.end_time,
            COALESCE(SUM(z.remaining_count), 0) AS remaining_total
        FROM `session` se
        LEFT JOIN zone z ON z.session_id = se.session_id
        WHERE se.show_id IN (""" + marks + """)
        GROUP BY se.show_id, se.session_id, se.ticket_open_time, se.end_time, se.start_time
        ORDER BY se.start_time
        """,
        tuple(show_ids),
    )

    current_time = now_local()
    grouped = {}
    for row in rows:
        grouped.setdefault(row["show_id"], []).append(row)

    for item in items:
        sessions = grouped.get(item["show_id"], [])
        status_key = "pending"
        status_label = "未开票"

        if sessions:
            active_sessions = [session for session in sessions if session["end_time"] >= current_time]

            if not active_sessions:
                status_key = "ended"
                status_label = "已结束"
            else:
                has_open_available = any(session["ticket_open_time"] <= current_time and session["remaining_total"] > 0 for session in active_sessions)
                has_future_session = any(session["ticket_open_time"] > current_time for session in active_sessions)
                has_remaining_ticket = any(session["remaining_total"] > 0 for session in active_sessions)

                if has_open_available:
                    status_key = "on_sale"
                    status_label = "已开票"
                elif not has_remaining_ticket and not has_future_session:
                    status_key = "sold_out"
                    status_label = "已售罄"
                elif has_future_session:
                    status_key = "pending"
                    status_label = "未开票"
                else:
                    status_key = "on_sale"
                    status_label = "已开票"

        item["sale_status"] = status_key
        item["sale_status_label"] = status_label

    return items


@router.get("/shows/featured")
def featured_shows():
    rows = fetch_all(
        """
        SELECT
            s.show_id, s.title, s.category, s.venue, s.poster_url, s.fav_count,
            MIN(se.start_time) AS first_session,
            MIN(z.price) AS min_price
        FROM `show` s
        LEFT JOIN `session` se ON se.show_id = s.show_id
        LEFT JOIN zone z ON z.session_id = se.session_id
        WHERE s.audit_status = 1
          AND s.is_recommended = 1
          AND EXISTS (
              SELECT 1
              FROM `session` active_session
              WHERE active_session.show_id = s.show_id
                AND active_session.end_time >= %s
          )
        GROUP BY s.show_id
        ORDER BY COALESCE(s.recommend_order, 999), s.created_time DESC
        LIMIT 5
        """,
        (now_local(),),
    )
    attach_sale_status(rows)
    return success(rows)


@router.get("/shows")
def list_shows(
    keyword: str = "",
    category: str = "",
    start_date: str = None,
    end_date: str = None,
    min_price: float = None,
    max_price: float = None,
    sort: str = "nearest",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20),
    upcoming_only: bool = False,
):
    if sort not in ["nearest", "popular", "latest", "price_asc", "price_desc"]:
        sort = "nearest"

    start, end = parse_time_window(start_date, end_date)
    where = ["s.audit_status = 1"]
    params = []

    if keyword:
        like = "%" + keyword + "%"
        where.append("(s.title LIKE %s OR s.venue LIKE %s OR COALESCE(s.lineup, '') LIKE %s)")
        params.extend([like, like, like])
    if category:
        where.append("s.category = %s")
        params.append(category)
    if start:
        where.append("EXISTS (SELECT 1 FROM `session` sx WHERE sx.show_id = s.show_id AND sx.start_time >= %s)")
        params.append(start)
    if end:
        where.append("EXISTS (SELECT 1 FROM `session` sy WHERE sy.show_id = s.show_id AND sy.start_time <= %s)")
        params.append(end)
    if min_price not in [None, ""]:
        where.append("EXISTS (SELECT 1 FROM `session` sz JOIN zone zz ON zz.session_id = sz.session_id WHERE sz.show_id = s.show_id AND zz.price >= %s)")
        params.append(float(min_price))
    if max_price not in [None, ""]:
        where.append("EXISTS (SELECT 1 FROM `session` sz2 JOIN zone zz2 ON zz2.session_id = sz2.session_id WHERE sz2.show_id = s.show_id AND zz2.price <= %s)")
        params.append(float(max_price))
    if upcoming_only:
        where.append("EXISTS (SELECT 1 FROM `session` su WHERE su.show_id = s.show_id AND su.end_time >= %s)")
        params.append(now_local())

    order_by = {
        "nearest": "first_session ASC",
        "popular": "s.fav_count DESC, first_session ASC",
        "latest": "s.created_time DESC",
        "price_asc": "min_price ASC, first_session ASC",
        "price_desc": "min_price DESC, first_session ASC",
    }[sort]

    where_sql = " AND ".join(where)
    total_row = fetch_one("SELECT COUNT(*) AS total FROM `show` s WHERE " + where_sql, tuple(params)) or {"total": 0}

    sql = """
        SELECT
            s.show_id, s.title, s.category, s.venue, s.poster_url, s.description, s.fav_count,
            MIN(se.start_time) AS first_session,
            MIN(z.price) AS min_price,
            MAX(z.price) AS max_price
        FROM `show` s
        LEFT JOIN `session` se ON se.show_id = s.show_id
        LEFT JOIN zone z ON z.session_id = se.session_id
        WHERE """ + where_sql + """
        GROUP BY s.show_id
        ORDER BY """ + order_by + """
        LIMIT %s OFFSET %s
    """

    items = fetch_all(sql, tuple(params + [page_size, (page - 1) * page_size]))
    attach_sale_status(items)
    return success({"items": items, "page": page, "page_size": page_size, "total": total_row["total"]})


@router.get("/shows/{show_id}")
def show_detail(show_id: int, user=Depends(get_optional_user)):
    show = fetch_one(
        """
        SELECT show_id, title, category, venue, description, lineup, notice, poster_url, fav_count, audit_status, created_time
        FROM `show` WHERE show_id = %s
        """,
        (show_id,),
    )
    if not show or show["audit_status"] != 1:
        fail(404, "演出不存在或已下架")

    sessions = fetch_all(
        """
        SELECT session_id, show_id, start_time, end_time, ticket_open_time, is_hot, max_per_order, allow_refund,
               refund_fee_rate, refund_deadline, waiting_enabled, reservation_count
        FROM `session`
        WHERE show_id = %s
        ORDER BY start_time
        """,
        (show_id,),
    )

    session_ids = [item["session_id"] for item in sessions]
    zones_by_session = {}
    if session_ids:
        marks = ", ".join(["%s"] * len(session_ids))
        zone_rows = fetch_all(
            """
            SELECT zone_id, session_id, name, price, total_seats, remaining_count
            FROM zone
            WHERE session_id IN (""" + marks + """)
            ORDER BY price DESC
            """,
            tuple(session_ids),
        )
        for row in zone_rows:
            zones_by_session.setdefault(row["session_id"], []).append(row)

    favorite = False
    if user:
        row = fetch_one("SELECT 1 FROM favorite_show WHERE user_id = %s AND show_id = %s", (user["user_id"], show_id))
        favorite = bool(row)

    current_time = now_local()
    for item in sessions:
        item["zones"] = zones_by_session.get(item["session_id"], [])
        remaining_total = sum(zone["remaining_count"] for zone in item["zones"])
        item["is_ended"] = item["end_time"] < current_time
        item["can_reserve"] = not item["is_ended"] and item["ticket_open_time"] > current_time
        item["can_buy"] = not item["is_ended"] and item["ticket_open_time"] <= current_time and remaining_total > 0
        item["is_sold_out"] = not item["is_ended"] and remaining_total <= 0

    show["is_favorite"] = favorite
    show["sessions"] = sessions
    return success(show)


@router.post("/shows/{show_id}/favorite")
def toggle_favorite(show_id: int, user=Depends(get_current_user)):
    show = fetch_one("SELECT show_id, audit_status FROM `show` WHERE show_id = %s", (show_id,))
    if not show or show["audit_status"] != 1:
        fail(404, "演出不存在或已下架")

    def work(cursor):
        cursor.execute("SELECT 1 FROM favorite_show WHERE user_id = %s AND show_id = %s", (user["user_id"], show_id))
        exists = cursor.fetchone()
        if exists:
            cursor.execute("DELETE FROM favorite_show WHERE user_id = %s AND show_id = %s", (user["user_id"], show_id))
            cursor.execute("UPDATE `show` SET fav_count = GREATEST(fav_count - 1, 0) WHERE show_id = %s", (show_id,))
            return {"favorited": False}
        cursor.execute("INSERT INTO favorite_show (user_id, show_id) VALUES (%s, %s)", (user["user_id"], show_id))
        cursor.execute("UPDATE `show` SET fav_count = fav_count + 1 WHERE show_id = %s", (show_id,))
        return {"favorited": True}

    return success(run_in_transaction(work), "收藏状态已更新")


@router.post("/reservations")
def create_reservation(payload: dict = Body(...), user=Depends(get_current_user)):
    session_id = payload.get("session_id")
    zone_id = payload.get("zone_id")

    if not user["is_verified"]:
        fail(403, "预约前需要先完成实名认证")

    session_row = fetch_one(
        """
        SELECT se.session_id, se.ticket_open_time, se.reservation_count, sh.show_id, sh.title, sh.audit_status
        FROM `session` se
        JOIN `show` sh ON sh.show_id = se.show_id
        WHERE se.session_id = %s
        """,
        (session_id,),
    )
    if not session_row or session_row["audit_status"] != 1:
        fail(404, "场次不存在或不可预约")
    if session_row["ticket_open_time"] <= now_local():
        fail(400, "该场次已开票，无法预约")
    existing_reservation = fetch_one(
        """
        SELECT reservation_id, status
        FROM reservation
        WHERE user_id = %s AND session_id = %s
        ORDER BY reservation_id DESC
        LIMIT 1
        """,
        (user["user_id"], session_id),
    )
    if existing_reservation and existing_reservation["status"] == 1:
        fail(409, "你已经预约过该场次")

    if zone_id:
        zone = fetch_one("SELECT zone_id FROM zone WHERE zone_id = %s AND session_id = %s", (zone_id, session_id))
        if not zone:
            fail(400, "意向分区不存在")

    def work(cursor):
        if existing_reservation:
            cursor.execute(
                """
                UPDATE reservation
                SET zone_id = %s, status = 1, created_at = CURRENT_TIMESTAMP
                WHERE reservation_id = %s
                """,
                (zone_id, existing_reservation["reservation_id"]),
            )
            reservation_id = existing_reservation["reservation_id"]
        else:
            cursor.execute(
                "INSERT INTO reservation (user_id, session_id, zone_id, status) VALUES (%s, %s, %s, 1)",
                (user["user_id"], session_id, zone_id),
            )
            reservation_id = cursor.lastrowid
        cursor.execute("UPDATE `session` SET reservation_count = reservation_count + 1 WHERE session_id = %s", (session_id,))
        insert_message(
            cursor,
            user["user_id"],
            "预约成功",
            "你已预约《" + session_row["title"] + "》，系统会在开票前15分钟提醒你。",
        )
        return reservation_id

    reservation_id = run_in_transaction(work)
    return success({"reservation_id": reservation_id}, "预约成功")


@router.delete("/reservations/{reservation_id}")
def cancel_reservation(reservation_id: int, user=Depends(get_current_user)):
    reservation = fetch_one(
        "SELECT reservation_id, session_id, status FROM reservation WHERE reservation_id = %s AND user_id = %s",
        (reservation_id, user["user_id"]),
    )
    if not reservation:
        fail(404, "预约记录不存在")
    if reservation["status"] != 1:
        fail(400, "该预约已失效")

    def work(cursor):
        cursor.execute("UPDATE reservation SET status = 2 WHERE reservation_id = %s", (reservation_id,))
        cursor.execute("UPDATE `session` SET reservation_count = GREATEST(reservation_count - 1, 0) WHERE session_id = %s", (reservation["session_id"],))

    run_in_transaction(work)
    return success(message="预约已取消")


@router.post("/jobs/reservation-reminders")
def run_reservation_reminders(payload: dict = Body(None), x_job_secret: str = Header(default="")):
    check_job_secret(x_job_secret)

    data = payload or {}
    lookahead_minutes = int(data.get("lookahead_minutes", 15))
    if lookahead_minutes < 1:
        lookahead_minutes = 1
    if lookahead_minutes > 60:
        lookahead_minutes = 60

    now = now_local()
    deadline = now + timedelta(minutes=lookahead_minutes)
    targets = fetch_all(
        """
        SELECT
            r.reservation_id, r.user_id, sh.title, se.session_id, se.ticket_open_time
        FROM reservation r
        JOIN `session` se ON se.session_id = r.session_id
        JOIN `show` sh ON sh.show_id = se.show_id
        WHERE r.status = 1 AND se.ticket_open_time BETWEEN %s AND %s
        """,
        (now, deadline),
    )

    def work(cursor):
        sent = 0
        for item in targets:
            content = "《" + item["title"] + "》将在15分钟内开票，请准备选座购票。场次ID：" + str(item["session_id"])
            cursor.execute(
                "SELECT 1 FROM message WHERE user_id = %s AND title = %s AND content = %s LIMIT 1",
                (item["user_id"], "开票提醒", content),
            )
            if cursor.fetchone():
                continue
            insert_message(cursor, item["user_id"], "开票提醒", content)
            sent += 1
        return sent

    sent = run_in_transaction(work)
    return success({"sent": sent, "matched": len(targets)}, "提醒任务执行完成")
