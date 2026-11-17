import hashlib
import secrets
from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Body, Depends, Query

from . import config
from .common import fail, get_current_user, success
from .database import fetch_all, fetch_one, get_connection, run_in_transaction
from .security import now_local


router = APIRouter()


LOCK_MINUTES = 2
WAITING_NOTICE_MINUTES = 15
DEFAULT_PURCHASE_CONCURRENT_LIMIT = 1


def ensure_transaction_schema():
    """补充B模块需要的场次配置字段：是否需要用户手动选座。"""
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("SHOW COLUMNS FROM `session` LIKE 'seat_select_enabled'")
        if not cursor.fetchone():
            cursor.execute(
                """
                ALTER TABLE `session`
                ADD COLUMN `seat_select_enabled` integer NOT NULL DEFAULT 1
                COMMENT '是否需要选座：0按分区数量购票 1手动选座购票'
                """
            )
        cursor.execute("SHOW COLUMNS FROM `session` LIKE 'seat_rows'")
        if not cursor.fetchone():
            cursor.execute(
                """
                ALTER TABLE `session`
                ADD COLUMN `seat_rows` integer NULL
                COMMENT '座位行数（仅seat_select_enabled=1时有效）'
                AFTER `seat_select_enabled`
                """
            )
        cursor.execute("SHOW COLUMNS FROM `session` LIKE 'seat_cols'")
        if not cursor.fetchone():
            cursor.execute(
                """
                ALTER TABLE `session`
                ADD COLUMN `seat_cols` integer NULL
                COMMENT '座位列数（仅seat_select_enabled=1时有效）'
                AFTER `seat_rows`
                """
            )
        cursor.execute("SHOW COLUMNS FROM `session` LIKE 'concurrent_limit'")
        if not cursor.fetchone():
            cursor.execute(
                """
                ALTER TABLE `session`
                ADD COLUMN `concurrent_limit` integer NOT NULL DEFAULT 0
                COMMENT '虚拟排队同时放行人数：0表示不限制'
                AFTER `is_hot`
                """
            )
        cursor.execute("SHOW COLUMNS FROM `order_info` LIKE 'pay_method'")
        if not cursor.fetchone():
            cursor.execute(
                """
                ALTER TABLE `order_info`
                ADD COLUMN `pay_method` varchar(20) NULL
                COMMENT '支付方式：wechat/alipay/bank'
                AFTER `paid_time`
                """
            )
        cursor.execute("SHOW COLUMNS FROM `order_info` LIKE 'expire_time'")
        if not cursor.fetchone():
            cursor.execute(
                """
                ALTER TABLE `order_info`
                ADD COLUMN `expire_time` timestamp NULL
                COMMENT '待支付过期时间'
                AFTER `pay_method`
                """
            )
        cursor.execute("SHOW COLUMNS FROM `queue` LIKE 'release_time'")
        if not cursor.fetchone():
            cursor.execute(
                """
                ALTER TABLE `queue`
                ADD COLUMN `release_time` timestamp NULL
                COMMENT '放行时间'
                AFTER `join_time`
                """
            )
        cursor.execute("SHOW COLUMNS FROM `queue` LIKE 'expire_time'")
        if not cursor.fetchone():
            cursor.execute(
                """
                ALTER TABLE `queue`
                ADD COLUMN `expire_time` timestamp NULL
                COMMENT '放行后过期时间'
                AFTER `release_time`
                """
            )
        cursor.execute("SHOW COLUMNS FROM `ticket` LIKE 'seat_id'")
        ticket_seat_col = cursor.fetchone()
        if ticket_seat_col and ticket_seat_col.get("Null") == "NO":
            cursor.execute(
                """
                ALTER TABLE `ticket`
                MODIFY COLUMN `seat_id` integer NULL
                COMMENT '对应具体座位；按分区数量购票时为空'
                """
            )
        connection.commit()
    finally:
        cursor.close()
        connection.close()


def insert_message(cursor, user_id, title, content):
    cursor.execute(
        "INSERT INTO message (user_id, title, content) VALUES (%s, %s, %s)",
        (user_id, title, content),
    )


def order_status_label(status):
    return {
        0: "待支付",
        1: "已支付",
        2: "已退款",
        3: "已取消",
        4: "已完成",
    }.get(status, "未知")


def cleanup_expired_locks(cursor):
    current_time = now_local()
    cursor.execute(
        """
        SELECT
            o.order_id, o.user_id, o.ticket_count, o.total_amount,
            sh.title, se.start_time, z.name AS zone_name
        FROM order_info o
        JOIN `session` se ON se.session_id = o.session_id
        JOIN `show` sh ON sh.show_id = se.show_id
        JOIN zone z ON z.zone_id = o.zone_id
        WHERE status = 0 AND expire_time IS NOT NULL AND expire_time <= %s
        """,
        (current_time,),
    )
    expired_order_rows = cursor.fetchall()
    expired_orders = [item["order_id"] for item in expired_order_rows]

    if expired_orders:
        marks = ", ".join(["%s"] * len(expired_orders))
        cursor.execute(
            """
            SELECT o.zone_id, SUM(o.ticket_count) AS ticket_count
            FROM order_info o
            WHERE o.order_id IN (""" + marks + """)
              AND NOT EXISTS (
                SELECT 1 FROM order_seat os WHERE os.order_id = o.order_id
              )
            GROUP BY o.zone_id
            """,
            tuple(expired_orders),
        )
        for item in cursor.fetchall():
            cursor.execute(
                "UPDATE zone SET remaining_count = remaining_count + %s WHERE zone_id = %s",
                (item["ticket_count"], item["zone_id"]),
            )
        cursor.execute(
            """
            UPDATE seat s
            JOIN order_seat os ON os.seat_id = s.seat_id
            SET s.status = 0,
                s.lock_time = NULL,
                s.lock_expire_time = NULL,
                s.lock_user_id = NULL,
                s.lock_token = NULL
            WHERE os.order_id IN (""" + marks + """) AND s.status = 1
            """,
            tuple(expired_orders),
        )
        cursor.execute(
            "UPDATE order_info SET status = 3 WHERE order_id IN (" + marks + ") AND status = 0",
            tuple(expired_orders),
        )
        for item in expired_order_rows:
            insert_message(
                cursor,
                item["user_id"],
                "订单已取消",
                "你购买《" + str(item["title"]) + "》" + str(item["zone_name"])
                + " 的待支付订单已超时取消，锁定座位/票数已自动释放。",
            )

    cursor.execute(
        """
        UPDATE seat
        SET status = 0,
            lock_time = NULL,
            lock_expire_time = NULL,
            lock_user_id = NULL,
            lock_token = NULL
        WHERE status = 1
          AND lock_expire_time IS NOT NULL
          AND lock_expire_time <= %s
          AND seat_id NOT IN (SELECT seat_id FROM order_seat)
        """,
        (current_time,),
    )
    return len(expired_orders)


def make_ticket_code(order_id, seat_id, user_id):
    raw = f"{order_id}:{seat_id}:{user_id}:{config.JWT_SECRET}"
    signature = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return f"TICKET-{order_id}-{seat_id}-{signature}"


def fetch_order_for_user(order_id, user_id):
    return fetch_one(
        """
        SELECT
            o.order_id, o.user_id, o.session_id, o.zone_id, o.ticket_count,
            o.total_amount, o.status, o.paid_time, o.pay_method, o.expire_time, o.created_time,
            sh.show_id, sh.title, sh.venue, sh.poster_url,
            se.start_time, se.ticket_open_time, se.allow_refund, se.refund_fee_rate,
            se.refund_deadline, z.name AS zone_name, z.price
        FROM order_info o
        JOIN `session` se ON se.session_id = o.session_id
        JOIN `show` sh ON sh.show_id = se.show_id
        JOIN zone z ON z.zone_id = o.zone_id
        WHERE o.order_id = %s AND o.user_id = %s
        """,
        (order_id, user_id),
    )


def append_refund_policy(order):
    deadline = order["refund_deadline"] or (order["start_time"] - timedelta(hours=24))
    fee_rate = Decimal(str(order["refund_fee_rate"] or 0))
    total_amount = Decimal(str(order["total_amount"] or 0))
    if order["allow_refund"] != 1:
        fee_amount = Decimal("0.00")
        refund_amount = Decimal("0.00")
    else:
        fee_amount = (total_amount * fee_rate / Decimal("100")).quantize(Decimal("0.01"))
        refund_amount = total_amount - fee_amount
    order["refund_deadline_final"] = deadline
    order["refund_fee_amount"] = fee_amount
    order["refund_amount_estimate"] = refund_amount
    order["can_refund"] = (
        order["status"] == 1
        and order["allow_refund"] == 1
        and now_local() <= deadline
    )
    return order


def waiting_status_label(status):
    return {
        0: "等待中",
        1: "已通知",
        2: "已购票",
        3: "已跳过",
    }.get(status, "未知")


def notify_waiting_users(cursor, session_id, zone_id, released_count):
    if released_count <= 0:
        return 0

    current_time = now_local()
    expire_time = current_time + timedelta(minutes=WAITING_NOTICE_MINUTES)
    cursor.execute(
        """
        UPDATE waiting_list
        SET status = 3
        WHERE status = 1 AND expire_time IS NOT NULL AND expire_time <= %s
        """,
        (current_time,),
    )
    cursor.execute(
        """
        SELECT
            w.waiting_id, w.user_id, w.queue_order,
            sh.title, se.start_time, z.name AS zone_name, z.price
        FROM waiting_list w
        JOIN `session` se ON se.session_id = w.session_id
        JOIN `show` sh ON sh.show_id = se.show_id
        JOIN zone z ON z.zone_id = w.zone_id
        WHERE w.session_id = %s AND w.zone_id = %s AND w.status = 0
        ORDER BY w.queue_order, w.created_at
        LIMIT %s
        FOR UPDATE
        """,
        (session_id, zone_id, released_count),
    )
    rows = cursor.fetchall()
    if not rows:
        return 0

    waiting_ids = [item["waiting_id"] for item in rows]
    marks = ", ".join(["%s"] * len(waiting_ids))
    cursor.execute(
        """
        UPDATE waiting_list
        SET status = 1, notify_time = %s, expire_time = %s
        WHERE waiting_id IN (""" + marks + """)
        """,
        tuple([current_time, expire_time] + waiting_ids),
    )
    for item in rows:
        insert_message(
            cursor,
            item["user_id"],
            "候补有票通知",
            "你候补的《" + str(item["title"]) + "》" + str(item["zone_name"])
            + " 已释放余票，请在 " + str(expire_time)
            + " 前点击去支付完成购票。[[WAITLIST_PAY:" + str(item["waiting_id"]) + "]]",
        )
    return len(rows)


def assert_session_purchase_limit(cursor, user_id, session_id, add_count, max_count):
    cursor.execute(
        """
        SELECT COALESCE(SUM(ticket_count), 0) AS bought_count
        FROM order_info
        WHERE user_id = %s
          AND session_id = %s
          AND status IN (0, 1)
          AND (status <> 0 OR expire_time IS NULL OR expire_time > %s)
        """,
        (user_id, session_id, now_local()),
    )
    bought_count = int((cursor.fetchone() or {"bought_count": 0})["bought_count"] or 0)
    if bought_count + int(add_count or 0) > int(max_count or 0):
        fail(400, "已达本场次每人限购数量，下单失败")


def purchase_queue_limit(session):
    value = int((session or {}).get("concurrent_limit") or 0)
    return value if value > 0 else DEFAULT_PURCHASE_CONCURRENT_LIMIT


def cleanup_expired_purchase_queue(cursor):
    cursor.execute(
        """
        UPDATE `queue`
        SET status = 2
        WHERE status = 1 AND expire_time IS NOT NULL AND expire_time <= %s
        """,
        (now_local(),),
    )
    return cursor.rowcount


def advance_purchase_queue(cursor, session_id=None):
    current_time = now_local()
    release_expire_time = current_time + timedelta(minutes=LOCK_MINUTES)
    cleanup_expired_purchase_queue(cursor)

    params = []
    where = """
        EXISTS (
            SELECT 1
            FROM `queue` pending_q
            WHERE pending_q.session_id = se.session_id
              AND pending_q.status = 0
        )
    """
    if session_id:
        where += " AND se.session_id = %s"
        params.append(session_id)

    cursor.execute(
        """
        SELECT se.session_id, COALESCE(se.concurrent_limit, 0) AS concurrent_limit
        FROM `session` se
        WHERE """ + where + """
        """,
        tuple(params),
    )
    sessions = cursor.fetchall()
    released_total = 0
    for session in sessions:
        limit = purchase_queue_limit(session)
        if limit <= 0:
            continue

        cursor.execute(
            """
            SELECT COUNT(*) AS active_count
            FROM `queue`
            WHERE session_id = %s
              AND status = 1
              AND (expire_time IS NULL OR expire_time > %s)
            """,
            (session["session_id"], current_time),
        )
        active_count = int((cursor.fetchone() or {"active_count": 0})["active_count"] or 0)
        slots = max(0, limit - active_count)
        if slots <= 0:
            continue

        cursor.execute(
            """
            SELECT queue_id
            FROM `queue`
            WHERE session_id = %s AND status = 0
            ORDER BY queue_no, join_time, queue_id
            LIMIT %s
            FOR UPDATE
            """,
            (session["session_id"], slots),
        )
        rows = cursor.fetchall()
        if not rows:
            continue

        queue_ids = [item["queue_id"] for item in rows]
        marks = ", ".join(["%s"] * len(queue_ids))
        cursor.execute(
            """
            UPDATE `queue`
            SET status = 1, release_time = %s, expire_time = %s
            WHERE queue_id IN (""" + marks + """)
            """,
            tuple([current_time, release_expire_time] + queue_ids),
        )
        released_total += len(queue_ids)

    return released_total


def queue_position(cursor, queue_id, session_id, queue_no):
    cursor.execute(
        """
        SELECT COUNT(*) AS ahead_count
        FROM `queue`
        WHERE session_id = %s
          AND status = 0
          AND (
            queue_no < %s
            OR (queue_no = %s AND queue_id < %s)
          )
        """,
        (session_id, queue_no, queue_no, queue_id),
    )
    ahead_count = int((cursor.fetchone() or {"ahead_count": 0})["ahead_count"] or 0)
    return {
        "ahead_count": ahead_count,
        "position": ahead_count + 1,
    }


def queue_payload(cursor, item):
    data = dict(item)
    if data["status"] == 0:
        data.update(queue_position(cursor, data["queue_id"], data["session_id"], data["queue_no"]))
    else:
        data["ahead_count"] = 0
        data["position"] = 0
    data["limit"] = purchase_queue_limit(data)
    data["released"] = data["status"] == 1 and (not data.get("expire_time") or data["expire_time"] > now_local())
    return data


def assert_purchase_entry_active(cursor, user_id, session_id):
    cursor.execute(
        """
        SELECT queue_id
        FROM `queue`
        WHERE user_id = %s
          AND session_id = %s
          AND status = 1
          AND (expire_time IS NULL OR expire_time > %s)
        ORDER BY release_time DESC, queue_id DESC
        LIMIT 1
        """,
        (user_id, session_id, now_local()),
    )
    if not cursor.fetchone():
        fail(429, "购票入口已过期或尚未放行，请重新排队")


def run_transaction_maintenance():
    """Release expired locks/orders and advance waitlist notifications."""
    def work(cursor):
        canceled_orders = cleanup_expired_locks(cursor)
        current_time = now_local()
        expired_purchase_queue = cleanup_expired_purchase_queue(cursor)
        released_purchase_queue = advance_purchase_queue(cursor)

        cursor.execute(
            """
            UPDATE waiting_list
            SET status = 3
            WHERE status = 1 AND expire_time IS NOT NULL AND expire_time <= %s
            """,
            (current_time,),
        )
        expired_waiting = cursor.rowcount

        cursor.execute(
            """
            SELECT
                z.session_id,
                z.zone_id,
                GREATEST(z.remaining_count - COUNT(active_w.waiting_id), 0) AS notify_count
            FROM zone z
            JOIN `session` se ON se.session_id = z.session_id
            LEFT JOIN waiting_list active_w
              ON active_w.session_id = z.session_id
             AND active_w.zone_id = z.zone_id
             AND active_w.status = 1
             AND (active_w.expire_time IS NULL OR active_w.expire_time > %s)
            WHERE se.waiting_enabled = 1
              AND z.remaining_count > 0
              AND EXISTS (
                SELECT 1
                FROM waiting_list pending_w
                WHERE pending_w.session_id = z.session_id
                  AND pending_w.zone_id = z.zone_id
                  AND pending_w.status = 0
              )
            GROUP BY z.session_id, z.zone_id, z.remaining_count
            HAVING notify_count > 0
            """,
            (current_time,),
        )
        rows = cursor.fetchall()
        notified_waiting = 0
        for row in rows:
            notified_waiting += notify_waiting_users(
                cursor,
                row["session_id"],
                row["zone_id"],
                int(row["notify_count"] or 0),
            )

        return {
            "canceled_orders": canceled_orders,
            "expired_purchase_queue": expired_purchase_queue,
            "released_purchase_queue": released_purchase_queue,
            "expired_waiting": expired_waiting,
            "notified_waiting": notified_waiting,
        }

    return run_in_transaction(work)


@router.post("/purchase-queue/enter")
def enter_purchase_queue(payload: dict = Body(...), user=Depends(get_current_user)):
    if not user["is_verified"]:
        fail(403, "购票前需要先完成实名认证")

    session_id = int(payload.get("session_id") or 0)
    if not session_id:
        fail(400, "请选择购票场次")

    current_time = now_local()
    release_expire_time = current_time + timedelta(minutes=LOCK_MINUTES)

    def work(cursor):
        cleanup_expired_locks(cursor)
        cleanup_expired_purchase_queue(cursor)
        cursor.execute(
            """
            SELECT se.session_id, se.ticket_open_time, COALESCE(se.concurrent_limit, 0) AS concurrent_limit,
                   sh.audit_status, sh.title
            FROM `session` se
            JOIN `show` sh ON sh.show_id = se.show_id
            WHERE se.session_id = %s
            FOR UPDATE
            """,
            (session_id,),
        )
        session = cursor.fetchone()
        if not session or session["audit_status"] != 1:
            fail(404, "场次不存在或不可购票")
        if session["ticket_open_time"] > current_time:
            fail(400, "该场次尚未开票")

        advance_purchase_queue(cursor, session_id)

        cursor.execute(
            """
            SELECT queue_id, user_id, session_id, queue_no, status, join_time, release_time, expire_time,
                   %s AS concurrent_limit
            FROM `queue`
            WHERE user_id = %s AND session_id = %s AND status IN (0, 1)
            ORDER BY queue_id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (session["concurrent_limit"], user["user_id"], session_id),
        )
        exists = cursor.fetchone()
        if exists and exists["status"] == 1 and (not exists["expire_time"] or exists["expire_time"] > current_time):
            return queue_payload(cursor, exists)
        if exists and exists["status"] == 0:
            return queue_payload(cursor, exists)
        if exists and exists["status"] == 1 and exists["expire_time"] and exists["expire_time"] <= current_time:
            cursor.execute("UPDATE `queue` SET status = 2 WHERE queue_id = %s", (exists["queue_id"],))

        limit = purchase_queue_limit(session)
        cursor.execute(
            """
            SELECT COUNT(*) AS active_count
            FROM `queue`
            WHERE session_id = %s
              AND status = 1
              AND (expire_time IS NULL OR expire_time > %s)
            """,
            (session_id, current_time),
        )
        active_count = int((cursor.fetchone() or {"active_count": 0})["active_count"] or 0)
        cursor.execute(
            """
            SELECT COALESCE(MAX(queue_no), 0) + 1 AS next_no
            FROM `queue`
            WHERE session_id = %s
            """,
            (session_id,),
        )
        queue_no = int((cursor.fetchone() or {"next_no": 1})["next_no"] or 1)
        released = active_count < limit
        cursor.execute(
            """
            INSERT INTO `queue` (user_id, session_id, queue_no, status, join_time, release_time, expire_time)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user["user_id"],
                session_id,
                queue_no,
                1 if released else 0,
                current_time,
                current_time if released else None,
                release_expire_time if released else None,
            ),
        )
        queue_id = cursor.lastrowid
        item = {
            "queue_id": queue_id,
            "user_id": user["user_id"],
            "session_id": session_id,
            "queue_no": queue_no,
            "status": 1 if released else 0,
            "join_time": current_time,
            "release_time": current_time if released else None,
            "expire_time": release_expire_time if released else None,
            "concurrent_limit": session["concurrent_limit"],
        }
        return queue_payload(cursor, item)

    return success(run_in_transaction(work))


@router.get("/purchase-queue/{queue_id}")
def purchase_queue_status(queue_id: int, user=Depends(get_current_user)):
    def work(cursor):
        cleanup_expired_locks(cursor)
        cleanup_expired_purchase_queue(cursor)
        cursor.execute(
            """
            SELECT q.queue_id, q.user_id, q.session_id, q.queue_no, q.status,
                   q.join_time, q.release_time, q.expire_time,
                   COALESCE(se.concurrent_limit, 0) AS concurrent_limit
            FROM `queue` q
            JOIN `session` se ON se.session_id = q.session_id
            WHERE q.queue_id = %s AND q.user_id = %s
            FOR UPDATE
            """,
            (queue_id, user["user_id"]),
        )
        item = cursor.fetchone()
        if not item:
            fail(404, "排队记录不存在")
        advance_purchase_queue(cursor, item["session_id"])
        cursor.execute(
            """
            SELECT q.queue_id, q.user_id, q.session_id, q.queue_no, q.status,
                   q.join_time, q.release_time, q.expire_time,
                   COALESCE(se.concurrent_limit, 0) AS concurrent_limit
            FROM `queue` q
            JOIN `session` se ON se.session_id = q.session_id
            WHERE q.queue_id = %s AND q.user_id = %s
            """,
            (queue_id, user["user_id"]),
        )
        item = cursor.fetchone()
        return queue_payload(cursor, item)

    return success(run_in_transaction(work))


@router.post("/purchase-queue/{queue_id}/cancel")
def cancel_purchase_queue(queue_id: int, user=Depends(get_current_user)):
    def work(cursor):
        cursor.execute(
            """
            UPDATE `queue`
            SET status = 3
            WHERE queue_id = %s
              AND user_id = %s
              AND status IN (0, 1)
            """,
            (queue_id, user["user_id"]),
        )
        return {"canceled": cursor.rowcount}

    return success(run_in_transaction(work))


@router.get("/sessions/{session_id}/seats")
def session_seats(session_id: int, user=Depends(get_current_user)):
    def work(cursor):
        cleanup_expired_locks(cursor)
        cursor.execute(
            """
            SELECT
                se.session_id, se.show_id, se.start_time, se.end_time, se.ticket_open_time,
                se.max_per_order, se.allow_refund, se.refund_fee_rate, se.refund_deadline,
                se.waiting_enabled,
                COALESCE(se.seat_select_enabled, 1) AS seat_select_enabled,
                sh.title, sh.venue, sh.audit_status
            FROM `session` se
            JOIN `show` sh ON sh.show_id = se.show_id
            WHERE se.session_id = %s
            """,
            (session_id,),
        )
        session = cursor.fetchone()
        if not session or session["audit_status"] != 1:
            fail(404, "场次不存在或不可购票")
        if session["ticket_open_time"] > now_local():
            fail(400, "该场次尚未开票，请先预约或等待开票")

        assert_purchase_entry_active(cursor, user["user_id"], session_id)

        cursor.execute(
            """
            SELECT zone_id, name, price, total_seats, remaining_count
            FROM zone
            WHERE session_id = %s
            ORDER BY price DESC, zone_id
            """,
            (session_id,),
        )
        zones = cursor.fetchall()

        cursor.execute(
            """
            SELECT seat_id, zone_id, row_no, col_no, seat_label, status, lock_user_id, lock_expire_time
            FROM seat
            WHERE session_id = %s
            ORDER BY zone_id, row_no, col_no
            """,
            (session_id,),
        )
        seats = cursor.fetchall()

        seats_by_zone = {}
        for seat in seats:
            item = dict(seat)
            item["locked_by_me"] = item["status"] == 1 and item["lock_user_id"] == user["user_id"]
            item.pop("lock_user_id", None)
            seats_by_zone.setdefault(item["zone_id"], []).append(item)

        for zone in zones:
            zone["seats"] = seats_by_zone.get(zone["zone_id"], [])

        session["zones"] = zones
        return session

    return success(run_in_transaction(work))


@router.post("/seats/lock")
def lock_seats(payload: dict = Body(...), user=Depends(get_current_user)):
    if not user["is_verified"]:
        fail(403, "购票前需要先完成实名认证")

    session_id = int(payload.get("session_id") or 0)
    zone_id = int(payload.get("zone_id") or 0)
    seat_ids = payload.get("seat_ids") or []
    seat_ids = [int(item) for item in seat_ids if str(item).isdigit()]
    if not session_id or not zone_id or not seat_ids:
        fail(400, "请选择要锁定的座位")
    if len(set(seat_ids)) != len(seat_ids):
        fail(400, "座位选择重复")

    lock_token = secrets.token_urlsafe(24)
    current_time = now_local()
    expire_time = current_time + timedelta(minutes=LOCK_MINUTES)

    def work(cursor):
        cleanup_expired_locks(cursor)
        cursor.execute(
            """
            SELECT se.session_id, se.ticket_open_time, se.max_per_order,
                   COALESCE(se.seat_select_enabled, 1) AS seat_select_enabled,
                   sh.audit_status
            FROM `session` se
            JOIN `show` sh ON sh.show_id = se.show_id
            WHERE se.session_id = %s
            """,
            (session_id,),
        )
        session = cursor.fetchone()
        if not session or session["audit_status"] != 1:
            fail(404, "场次不存在或不可购票")
        if session["ticket_open_time"] > current_time:
            fail(400, "该场次尚未开票")
        assert_purchase_entry_active(cursor, user["user_id"], session_id)
        if session["seat_select_enabled"] != 1:
            fail(400, "该场次为按分区数量购票，无需手动选座")
        if len(seat_ids) > session["max_per_order"]:
            fail(400, "超过该场次单次限购数量")
        assert_session_purchase_limit(
            cursor,
            user["user_id"],
            session_id,
            len(seat_ids),
            session["max_per_order"],
        )

        marks = ", ".join(["%s"] * len(seat_ids))
        cursor.execute(
            """
            SELECT seat_id, zone_id, seat_label, status
            FROM seat
            WHERE session_id = %s AND zone_id = %s AND seat_id IN (""" + marks + """)
            FOR UPDATE
            """,
            tuple([session_id, zone_id] + seat_ids),
        )
        seats = cursor.fetchall()
        if len(seats) != len(seat_ids):
            fail(400, "所选座位不属于当前场次或分区")
        if any(item["status"] != 0 for item in seats):
            fail(409, "部分座位已被锁定或售出，请重新选择")

        cursor.execute(
            """
            UPDATE seat
            SET status = 1,
                lock_time = %s,
                lock_expire_time = %s,
                lock_user_id = %s,
                lock_token = %s
            WHERE seat_id IN (""" + marks + """)
            """,
            tuple([current_time, expire_time, user["user_id"], lock_token] + seat_ids),
        )
        return {
            "lock_token": lock_token,
            "expire_time": expire_time,
            "locked_count": len(seats),
            "seats": seats,
        }

    return success(run_in_transaction(work), "座位已锁定，请在10分钟内完成支付")


@router.post("/seats/release")
def release_seats(payload: dict = Body(...), user=Depends(get_current_user)):
    lock_token = str(payload.get("lock_token") or "").strip()
    if not lock_token:
        fail(400, "缺少锁座凭证")

    def work(cursor):
        cursor.execute(
            """
            UPDATE seat
            SET status = 0,
                lock_time = NULL,
                lock_expire_time = NULL,
                lock_user_id = NULL,
                lock_token = NULL
            WHERE lock_token = %s AND lock_user_id = %s AND status = 1
            """,
            (lock_token, user["user_id"]),
        )
        return {"released": cursor.rowcount}

    return success(run_in_transaction(work), "已释放座位")


@router.post("/orders/quick")
def create_quick_order(payload: dict = Body(...), user=Depends(get_current_user)):
    """无需手动选座：按分区和数量自动分配可售座位，并创建待支付订单。"""
    if not user["is_verified"]:
        fail(403, "购票前需要先完成实名认证")

    session_id = int(payload.get("session_id") or 0)
    zone_id = int(payload.get("zone_id") or 0)
    quantity = int(payload.get("quantity") or 0)
    if not session_id or not zone_id:
        fail(400, "请选择场次和分区")
    if quantity < 1:
        fail(400, "购票数量至少为1张")

    current_time = now_local()
    expire_time = current_time + timedelta(minutes=LOCK_MINUTES)
    lock_token = secrets.token_urlsafe(24)

    def quick_work(cursor):
        cleanup_expired_locks(cursor)
        cursor.execute(
            """
            SELECT se.session_id, se.ticket_open_time, se.max_per_order,
                   COALESCE(se.seat_select_enabled, 1) AS seat_select_enabled,
                   sh.audit_status
            FROM `session` se
            JOIN `show` sh ON sh.show_id = se.show_id
            WHERE se.session_id = %s
            """,
            (session_id,),
        )
        session = cursor.fetchone()
        if not session or session["audit_status"] != 1:
            fail(404, "场次不存在或不可购票")
        if session["ticket_open_time"] > current_time:
            fail(400, "该场次尚未开票")
        assert_purchase_entry_active(cursor, user["user_id"], session_id)
        if session["seat_select_enabled"] == 1:
            fail(400, "该场次需要选座购票")
        if quantity > session["max_per_order"]:
            fail(400, "超过该场次单次限购数量")
        assert_session_purchase_limit(
            cursor,
            user["user_id"],
            session_id,
            quantity,
            session["max_per_order"],
        )

        cursor.execute(
            """
            SELECT zone_id, name, price, remaining_count
            FROM zone
            WHERE zone_id = %s AND session_id = %s
            FOR UPDATE
            """,
            (zone_id, session_id),
        )
        zone = cursor.fetchone()
        if not zone:
            fail(400, "所选分区不存在")
        if zone["remaining_count"] < quantity:
            fail(409, "该分区余票不足")

        total_amount = Decimal(str(zone["price"])) * quantity
        cursor.execute(
            """
            INSERT INTO order_info
              (user_id, session_id, zone_id, ticket_count, total_amount, status, expire_time)
            VALUES (%s, %s, %s, %s, %s, 0, %s)
            """,
            (user["user_id"], session_id, zone_id, quantity, total_amount, expire_time),
        )
        order_id = cursor.lastrowid
        cursor.execute(
            """
            UPDATE `queue`
            SET status = 4
            WHERE user_id = %s AND session_id = %s AND status = 1
            """,
            (user["user_id"], session_id),
        )
        cursor.execute(
            "UPDATE zone SET remaining_count = remaining_count - %s WHERE zone_id = %s",
            (quantity, zone_id),
        )
        seats = [
            {
                "seat_id": None,
                "session_id": session_id,
                "zone_id": zone_id,
                "seat_label": str(zone["name"]) + " 分区票" + str(index + 1),
                "price": zone["price"],
            }
            for index in range(quantity)
        ]
        return {
            "order_id": order_id,
            "ticket_count": quantity,
            "total_amount": total_amount,
            "expire_time": expire_time,
            "lock_token": lock_token,
            "seats": seats,
        }

    return success(run_in_transaction(quick_work), "订单已创建，请在10分钟内完成支付")

    def work(cursor):
        cleanup_expired_locks(cursor)
        cursor.execute(
            """
            SELECT se.session_id, se.ticket_open_time, se.max_per_order,
                   COALESCE(se.seat_select_enabled, 1) AS seat_select_enabled,
                   sh.audit_status
            FROM `session` se
            JOIN `show` sh ON sh.show_id = se.show_id
            WHERE se.session_id = %s
            """,
            (session_id,),
        )
        session = cursor.fetchone()
        if not session or session["audit_status"] != 1:
            fail(404, "场次不存在或不可购票")
        if session["ticket_open_time"] > current_time:
            fail(400, "该场次尚未开票")
        if session["seat_select_enabled"] == 1:
            fail(400, "该场次需要选座购票")
        if quantity > session["max_per_order"]:
            fail(400, "超过该场次单次限购数量")
        assert_session_purchase_limit(
            cursor,
            user["user_id"],
            session_id,
            quantity,
            session["max_per_order"],
        )

        cursor.execute(
            """
            SELECT zone_id, price, remaining_count
            FROM zone
            WHERE zone_id = %s AND session_id = %s
            FOR UPDATE
            """,
            (zone_id, session_id),
        )
        zone = cursor.fetchone()
        if not zone:
            fail(400, "所选分区不存在")
        if zone["remaining_count"] < quantity:
            fail(409, "该分区余票不足")

        cursor.execute(
            """
            SELECT seat_id, session_id, zone_id, seat_label, %s AS price
            FROM seat
            WHERE session_id = %s AND zone_id = %s AND status = 0
            ORDER BY row_no, col_no, seat_id
            LIMIT %s
            FOR UPDATE
            """,
            (zone["price"], session_id, zone_id, quantity),
        )
        seats = cursor.fetchall()
        if len(seats) < quantity:
            fail(409, "可售座位不足，请减少数量或选择其他分区")

        seat_ids = [item["seat_id"] for item in seats]
        marks = ", ".join(["%s"] * len(seat_ids))
        cursor.execute(
            """
            UPDATE seat
            SET status = 1,
                lock_time = %s,
                lock_expire_time = %s,
                lock_user_id = %s,
                lock_token = %s
            WHERE seat_id IN (""" + marks + """)
            """,
            tuple([current_time, expire_time, user["user_id"], lock_token] + seat_ids),
        )

        total_amount = Decimal(str(zone["price"])) * quantity
        cursor.execute(
            """
            INSERT INTO order_info
              (user_id, session_id, zone_id, ticket_count, total_amount, status, expire_time)
            VALUES (%s, %s, %s, %s, %s, 0, %s)
            """,
            (user["user_id"], session_id, zone_id, quantity, total_amount, expire_time),
        )
        order_id = cursor.lastrowid
        for seat in seats:
            cursor.execute(
                "INSERT INTO order_seat (order_id, seat_id) VALUES (%s, %s)",
                (order_id, seat["seat_id"]),
            )

        return {
            "order_id": order_id,
            "ticket_count": quantity,
            "total_amount": total_amount,
            "expire_time": expire_time,
            "lock_token": lock_token,
            "seats": seats,
        }

    return success(run_in_transaction(work), "订单已创建，请在10分钟内完成支付")


@router.post("/orders")
def create_order(payload: dict = Body(...), user=Depends(get_current_user)):
    lock_token = str(payload.get("lock_token") or "").strip()
    if not lock_token:
        fail(400, "请先锁定座位")

    def work(cursor):
        cleanup_expired_locks(cursor)
        cursor.execute(
            """
            SELECT s.seat_id, s.session_id, s.zone_id, s.seat_label, s.lock_expire_time, z.price
            FROM seat s
            JOIN zone z ON z.zone_id = s.zone_id
            WHERE s.lock_token = %s AND s.lock_user_id = %s AND s.status = 1
            FOR UPDATE
            """,
            (lock_token, user["user_id"]),
        )
        seats = cursor.fetchall()
        if not seats:
            fail(400, "锁座已失效，请重新选择座位")

        session_ids = {item["session_id"] for item in seats}
        zone_ids = {item["zone_id"] for item in seats}
        if len(session_ids) != 1 or len(zone_ids) != 1:
            fail(400, "同一订单只能购买同一场次同一分区的座位")

        session_id = seats[0]["session_id"]
        zone_id = seats[0]["zone_id"]
        ticket_count = len(seats)
        total_amount = sum(Decimal(str(item["price"])) for item in seats)
        expire_time = min(item["lock_expire_time"] for item in seats)

        cursor.execute(
            """
            SELECT order_id
            FROM order_info
            WHERE user_id = %s AND status = 0 AND expire_time > %s
              AND order_id IN (
                SELECT os.order_id
                FROM order_seat os
                JOIN seat s ON s.seat_id = os.seat_id
                WHERE s.lock_token = %s
              )
            LIMIT 1
            """,
            (user["user_id"], now_local(), lock_token),
        )
        exists = cursor.fetchone()
        if exists:
            return {"order_id": exists["order_id"], "reused": True}

        cursor.execute(
            "SELECT max_per_order FROM `session` WHERE session_id = %s",
            (session_id,),
        )
        session = cursor.fetchone()
        assert_purchase_entry_active(cursor, user["user_id"], session_id)
        assert_session_purchase_limit(
            cursor,
            user["user_id"],
            session_id,
            ticket_count,
            session["max_per_order"],
        )

        cursor.execute(
            """
            INSERT INTO order_info
              (user_id, session_id, zone_id, ticket_count, total_amount, status, expire_time)
            VALUES (%s, %s, %s, %s, %s, 0, %s)
            """,
            (user["user_id"], session_id, zone_id, ticket_count, total_amount, expire_time),
        )
        order_id = cursor.lastrowid
        for seat in seats:
            cursor.execute(
                "INSERT INTO order_seat (order_id, seat_id) VALUES (%s, %s)",
                (order_id, seat["seat_id"]),
            )
        cursor.execute(
            """
            UPDATE `queue`
            SET status = 4
            WHERE user_id = %s AND session_id = %s AND status = 1
            """,
            (user["user_id"], session_id),
        )
        return {
            "order_id": order_id,
            "ticket_count": ticket_count,
            "total_amount": total_amount,
            "expire_time": expire_time,
            "seats": seats,
        }

    return success(run_in_transaction(work), "订单已创建")


@router.post("/orders/{order_id}/pay")
def pay_order(order_id: int, payload: dict = Body(...), user=Depends(get_current_user)):
    pay_password = str(payload.get("pay_password") or "").strip()
    pay_method = str(payload.get("payment_method") or payload.get("pay_method") or "wechat").strip()
    if not pay_password.isdigit() or len(pay_password) != 6:
        fail(400, "请输入6位数字支付密码")
    if pay_method not in {"wechat", "alipay", "bank"}:
        fail(400, "请选择有效的支付方式")

    def work(cursor):
        cleanup_expired_locks(cursor)
        cursor.execute(
            """
            SELECT order_id, user_id, session_id, zone_id, ticket_count, total_amount, status, expire_time
            FROM order_info
            WHERE order_id = %s AND user_id = %s
            FOR UPDATE
            """,
            (order_id, user["user_id"]),
        )
        order = cursor.fetchone()
        if not order:
            fail(404, "订单不存在")
        if order["status"] != 0:
            fail(400, "当前订单状态不可支付")
        if order["expire_time"] and order["expire_time"] <= now_local():
            cursor.execute("UPDATE order_info SET status = 3 WHERE order_id = %s", (order_id,))
            fail(400, "订单已超时，请重新下单")

        cursor.execute(
            """
            SELECT s.seat_id, s.status, s.lock_user_id
                 , s.seat_label
            FROM order_seat os
            JOIN seat s ON s.seat_id = os.seat_id
            WHERE os.order_id = %s
            FOR UPDATE
            """,
            (order_id,),
        )
        seats = cursor.fetchall()
        if not seats:
            paid_time = now_local()
            cursor.execute(
                "UPDATE order_info SET status = 1, paid_time = %s, pay_method = %s WHERE order_id = %s",
                (paid_time, pay_method, order_id),
            )
            cursor.execute(
                """
                SELECT sh.title, se.start_time, z.name AS zone_name
                FROM `session` se
                JOIN `show` sh ON sh.show_id = se.show_id
                JOIN zone z ON z.zone_id = %s
                WHERE se.session_id = %s
                """,
                (order["zone_id"], order["session_id"]),
            )
            show_info = cursor.fetchone() or {"title": "演出", "start_time": "", "zone_name": "分区票"}
            seat_text = str(show_info["zone_name"]) + " × " + str(order["ticket_count"]) + "张"
            for index in range(order["ticket_count"]):
                ticket_code = make_ticket_code(
                    order_id,
                    "ZONE-" + str(order["zone_id"]) + "-" + str(index + 1),
                    user["user_id"],
                )
                cursor.execute(
                    "INSERT INTO ticket (order_id, seat_id, qr_code, status) VALUES (%s, NULL, %s, 1)",
                    (order_id, ticket_code),
                )
            insert_message(
                cursor,
                user["user_id"],
                "购票成功",
                "你已购买《" + str(show_info["title"]) + "》，场次时间：" + str(show_info["start_time"]) + "，票种：" + seat_text + "。电子票已生成。",
            )
            cursor.execute(
                """
                UPDATE waiting_list
                SET status = 2
                WHERE user_id = %s AND session_id = %s AND zone_id = %s AND status IN (0, 1)
                """,
                (user["user_id"], order["session_id"], order["zone_id"]),
            )
            cursor.execute(
                """
                UPDATE `queue`
                SET status = 4
                WHERE user_id = %s AND session_id = %s AND status = 1
                """,
                (user["user_id"], order["session_id"]),
            )
            return {"order_id": order_id, "paid_time": paid_time}
        if len(seats) != order["ticket_count"]:
            fail(400, "订单座位信息不完整")
        if any(item["status"] != 1 or item["lock_user_id"] != user["user_id"] for item in seats):
            fail(409, "座位锁定已失效，请重新下单")

        paid_time = now_local()
        cursor.execute(
            "UPDATE order_info SET status = 1, paid_time = %s, pay_method = %s WHERE order_id = %s",
            (paid_time, pay_method, order_id),
        )
        cursor.execute(
            """
            UPDATE seat s
            JOIN order_seat os ON os.seat_id = s.seat_id
            SET s.status = 2,
                s.lock_time = NULL,
                s.lock_expire_time = NULL,
                s.lock_user_id = NULL,
                s.lock_token = NULL
            WHERE os.order_id = %s
            """,
            (order_id,),
        )
        cursor.execute(
            "UPDATE zone SET remaining_count = GREATEST(remaining_count - %s, 0) WHERE zone_id = %s",
            (order["ticket_count"], order["zone_id"]),
        )
        cursor.execute(
            """
            SELECT sh.title, se.start_time
            FROM `session` se
            JOIN `show` sh ON sh.show_id = se.show_id
            WHERE se.session_id = %s
            """,
            (order["session_id"],),
        )
        show_info = cursor.fetchone() or {"title": "演出", "start_time": ""}
        seat_text = "、".join([item["seat_label"] for item in seats])
        for seat in seats:
            cursor.execute(
                "INSERT INTO ticket (order_id, seat_id, qr_code, status) VALUES (%s, %s, %s, 1)",
                (order_id, seat["seat_id"], make_ticket_code(order_id, seat["seat_id"], user["user_id"])),
            )
        insert_message(
            cursor,
            user["user_id"],
            "购票成功",
            "你已购买《" + str(show_info["title"]) + "》，场次时间：" + str(show_info["start_time"]) + "，座位：" + seat_text + "。电子票已生成。",
        )
        cursor.execute(
            """
            UPDATE waiting_list
            SET status = 2
            WHERE user_id = %s AND session_id = %s AND zone_id = %s AND status IN (0, 1)
            """,
            (user["user_id"], order["session_id"], order["zone_id"]),
        )
        cursor.execute(
            """
            UPDATE `queue`
            SET status = 4
            WHERE user_id = %s AND session_id = %s AND status = 1
            """,
            (user["user_id"], order["session_id"]),
        )
        return {"order_id": order_id, "paid_time": paid_time}

    return success(run_in_transaction(work), "支付成功")


@router.post("/waitlist")
def join_waitlist(payload: dict = Body(...), user=Depends(get_current_user)):
    session_id = int(payload.get("session_id") or 0)
    zone_id = int(payload.get("zone_id") or 0)
    if not session_id or not zone_id:
        fail(400, "请选择候补场次和分区")

    def work(cursor):
        cursor.execute(
            """
            SELECT
                se.session_id, se.waiting_enabled, sh.audit_status,
                sh.title, se.start_time, z.name AS zone_name, z.price, z.remaining_count
            FROM `session` se
            JOIN `show` sh ON sh.show_id = se.show_id
            JOIN zone z ON z.session_id = se.session_id
            WHERE se.session_id = %s AND z.zone_id = %s
            FOR UPDATE
            """,
            (session_id, zone_id),
        )
        item = cursor.fetchone()
        if not item or item["audit_status"] != 1:
            fail(404, "候补票种不存在")
        if item["waiting_enabled"] != 1:
            fail(400, "该票种未开启候补")
        if item["remaining_count"] > 0:
            fail(400, "当前票种仍有余票，可直接购票")

        cursor.execute(
            """
            SELECT waiting_id, queue_order, status
            FROM waiting_list
            WHERE user_id = %s AND session_id = %s AND zone_id = %s AND status IN (0, 1)
            LIMIT 1
            """,
            (user["user_id"], session_id, zone_id),
        )
        exists = cursor.fetchone()
        if exists:
            return {
                "waiting_id": exists["waiting_id"],
                "queue_order": exists["queue_order"],
                "already_joined": True,
            }

        cursor.execute(
            """
            SELECT COALESCE(MAX(queue_order), 0) + 1 AS next_order
            FROM waiting_list
            WHERE session_id = %s AND zone_id = %s
            """,
            (session_id, zone_id),
        )
        queue_order = int((cursor.fetchone() or {"next_order": 1})["next_order"])
        cursor.execute(
            """
            INSERT INTO waiting_list (user_id, session_id, zone_id, queue_order, status)
            VALUES (%s, %s, %s, %s, 0)
            """,
            (user["user_id"], session_id, zone_id, queue_order),
        )
        insert_message(
            cursor,
            user["user_id"],
            "候补登记成功",
            "你已加入《" + str(item["title"]) + "》" + str(item["zone_name"])
            + " 候补队列，当前排队第 " + str(queue_order) + " 位。",
        )
        return {
            "waiting_id": cursor.lastrowid,
            "queue_order": queue_order,
            "already_joined": False,
        }

    data = run_in_transaction(work)
    message = "您已在候补队列中" if data.get("already_joined") else "候补成功"
    return success(data, message)


@router.get("/waitlist")
def my_waitlist(user=Depends(get_current_user)):
    rows = fetch_all(
        """
        SELECT
            w.waiting_id, w.session_id, w.zone_id, w.queue_order, w.status,
            w.notify_time, w.expire_time, w.created_at,
            sh.show_id, sh.title, sh.venue, sh.poster_url,
            se.start_time, z.name AS zone_name, z.price
        FROM waiting_list w
        JOIN `session` se ON se.session_id = w.session_id
        JOIN `show` sh ON sh.show_id = se.show_id
        JOIN zone z ON z.zone_id = w.zone_id
        WHERE w.user_id = %s
        ORDER BY w.created_at DESC
        """,
        (user["user_id"],),
    )
    for row in rows:
        row["status_label"] = waiting_status_label(row["status"])
    return success(rows)


@router.post("/waitlist/{waiting_id}/checkout")
def checkout_waitlist(waiting_id: int, user=Depends(get_current_user)):
    if not user["is_verified"]:
        fail(403, "购票前需要先完成实名认证")

    current_time = now_local()
    expire_time = current_time + timedelta(minutes=LOCK_MINUTES)
    lock_token = secrets.token_urlsafe(24)

    def work(cursor):
        cleanup_expired_locks(cursor)
        cursor.execute(
            """
            SELECT
                w.waiting_id, w.user_id, w.session_id, w.zone_id, w.status, w.expire_time,
                se.max_per_order, se.ticket_open_time, sh.audit_status,
                z.price, z.remaining_count
            FROM waiting_list w
            JOIN `session` se ON se.session_id = w.session_id
            JOIN `show` sh ON sh.show_id = se.show_id
            JOIN zone z ON z.zone_id = w.zone_id
            WHERE w.waiting_id = %s AND w.user_id = %s
            FOR UPDATE
            """,
            (waiting_id, user["user_id"]),
        )
        waiting = cursor.fetchone()
        if not waiting or waiting["audit_status"] != 1:
            fail(404, "候补记录不存在")
        if waiting["status"] == 2:
            fail(400, "该候补记录已完成购票")
        if waiting["status"] != 1:
            fail(400, "该候补记录尚未获得购票资格")
        if waiting["expire_time"] and waiting["expire_time"] <= current_time:
            cursor.execute("UPDATE waiting_list SET status = 3 WHERE waiting_id = %s", (waiting_id,))
            fail(400, "候补购票链接已过期")
        if waiting["ticket_open_time"] > current_time:
            fail(400, "该场次尚未开票")

        cursor.execute(
            """
            SELECT order_id, ticket_count, total_amount, expire_time
            FROM order_info
            WHERE user_id = %s AND session_id = %s AND zone_id = %s
              AND status = 0 AND expire_time > %s
            ORDER BY created_time DESC
            LIMIT 1
            """,
            (user["user_id"], waiting["session_id"], waiting["zone_id"], current_time),
        )
        existing_order = cursor.fetchone()
        if existing_order:
            cursor.execute(
                """
                SELECT s.seat_id, s.session_id, s.zone_id, s.seat_label, z.price
                FROM order_seat os
                JOIN seat s ON s.seat_id = os.seat_id
                JOIN zone z ON z.zone_id = s.zone_id
                WHERE os.order_id = %s
                ORDER BY s.row_no, s.col_no
                """,
                (existing_order["order_id"],),
            )
            existing_order["seats"] = cursor.fetchall()
            if not existing_order["seats"]:
                existing_order["seats"] = [{"seat_id": None, "seat_label": "候补分区票 × " + str(existing_order["ticket_count"]) + "张"}]
            return existing_order

        assert_session_purchase_limit(
            cursor,
            user["user_id"],
            waiting["session_id"],
            1,
            waiting["max_per_order"],
        )

        cursor.execute(
            """
            SELECT seat_id, session_id, zone_id, seat_label, %s AS price
            FROM seat
            WHERE session_id = %s AND zone_id = %s AND status = 0
            ORDER BY row_no, col_no, seat_id
            LIMIT 1
            FOR UPDATE
            """,
            (waiting["price"], waiting["session_id"], waiting["zone_id"]),
        )
        seat = cursor.fetchone()
        if not seat and waiting["remaining_count"] >= 1:
            cursor.execute(
                """
                INSERT INTO order_info
                  (user_id, session_id, zone_id, ticket_count, total_amount, status, expire_time)
                VALUES (%s, %s, %s, 1, %s, 0, %s)
                """,
                (
                    user["user_id"],
                    waiting["session_id"],
                    waiting["zone_id"],
                    waiting["price"],
                    expire_time,
                ),
            )
            order_id = cursor.lastrowid
            cursor.execute(
                "UPDATE zone SET remaining_count = remaining_count - 1 WHERE zone_id = %s",
                (waiting["zone_id"],),
            )
            return {
                "order_id": order_id,
                "ticket_count": 1,
                "total_amount": waiting["price"],
                "expire_time": expire_time,
                "lock_token": lock_token,
                "seats": [{"seat_id": None, "seat_label": "候补分区票1"}],
            }
        if not seat:
            fail(409, "候补余票已被占用，请等待下一次通知")

        cursor.execute(
            """
            UPDATE seat
            SET status = 1,
                lock_time = %s,
                lock_expire_time = %s,
                lock_user_id = %s,
                lock_token = %s
            WHERE seat_id = %s
            """,
            (current_time, expire_time, user["user_id"], lock_token, seat["seat_id"]),
        )
        cursor.execute(
            """
            INSERT INTO order_info
              (user_id, session_id, zone_id, ticket_count, total_amount, status, expire_time)
            VALUES (%s, %s, %s, 1, %s, 0, %s)
            """,
            (
                user["user_id"],
                waiting["session_id"],
                waiting["zone_id"],
                waiting["price"],
                expire_time,
            ),
        )
        order_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO order_seat (order_id, seat_id) VALUES (%s, %s)",
            (order_id, seat["seat_id"]),
        )
        return {
            "order_id": order_id,
            "ticket_count": 1,
            "total_amount": waiting["price"],
            "expire_time": expire_time,
            "lock_token": lock_token,
            "seats": [seat],
        }

    return success(run_in_transaction(work), "候补订单已创建，请在10分钟内支付")


@router.get("/orders")
def list_orders(
    status: int = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    user=Depends(get_current_user),
):
    params = [user["user_id"]]
    where = "o.user_id = %s"
    if status is not None:
        where += " AND o.status = %s"
        params.append(status)

    total = fetch_one("SELECT COUNT(*) AS total FROM order_info o WHERE " + where, tuple(params)) or {"total": 0}
    rows = fetch_all(
        """
        SELECT
            o.order_id, o.ticket_count, o.total_amount, o.status, o.paid_time, o.pay_method, o.expire_time, o.created_time,
            sh.show_id, sh.title, sh.venue, sh.poster_url, se.start_time, z.name AS zone_name,
            (
                SELECT GROUP_CONCAT(s.seat_label ORDER BY s.row_no, s.col_no SEPARATOR '、')
                FROM order_seat os
                JOIN seat s ON s.seat_id = os.seat_id
                WHERE os.order_id = o.order_id
            ) AS seat_labels
        FROM order_info o
        JOIN `session` se ON se.session_id = o.session_id
        JOIN `show` sh ON sh.show_id = se.show_id
        JOIN zone z ON z.zone_id = o.zone_id
        WHERE """ + where + """
        ORDER BY o.created_time DESC
        LIMIT %s OFFSET %s
        """,
        tuple(params + [page_size, (page - 1) * page_size]),
    )
    for row in rows:
        row["status_label"] = order_status_label(row["status"])
        if not row.get("seat_labels"):
            row["seat_labels"] = str(row.get("zone_name") or "分区票") + " × " + str(row.get("ticket_count") or 0) + "张"
    return success({"items": rows, "page": page, "page_size": page_size, "total": total["total"]})


@router.get("/orders/{order_id}")
def order_detail(order_id: int, user=Depends(get_current_user)):
    order = fetch_order_for_user(order_id, user["user_id"])
    if not order:
        fail(404, "订单不存在")
    order["status_label"] = order_status_label(order["status"])
    append_refund_policy(order)

    seats = fetch_all(
        """
        SELECT s.seat_id, s.seat_label, s.row_no, s.col_no
        FROM order_seat os
        JOIN seat s ON s.seat_id = os.seat_id
        WHERE os.order_id = %s
        ORDER BY s.row_no, s.col_no
        """,
        (order_id,),
    )
    if not seats:
        seats = [
            {
                "seat_id": None,
                "seat_label": str(order.get("zone_name") or "分区票") + " × " + str(order.get("ticket_count") or 0) + "张",
                "row_no": None,
                "col_no": None,
            }
        ]
    tickets = fetch_all(
        """
        SELECT t.ticket_id, t.seat_id, t.qr_code, t.status, t.created_at
        FROM ticket t
        WHERE t.order_id = %s
        ORDER BY t.ticket_id
        """,
        (order_id,),
    )
    refunds = fetch_all(
        """
        SELECT refund_id, refund_amount, fee_amount, status, reason, created_at, completed_at
        FROM refund
        WHERE order_id = %s
        ORDER BY created_at DESC
        """,
        (order_id,),
    )
    order["seats"] = seats
    order["tickets"] = tickets
    order["refunds"] = refunds
    return success(order)


@router.post("/orders/{order_id}/refund")
def refund_order(order_id: int, payload: dict = Body(None), user=Depends(get_current_user)):
    data = payload or {}
    reason = str(data.get("reason") or "用户申请退票").strip()[:255]

    def work(cursor):
        cursor.execute(
            """
            SELECT
                o.order_id, o.user_id, o.session_id, o.zone_id, o.ticket_count, o.total_amount, o.status,
                se.start_time, se.allow_refund, se.refund_fee_rate, se.refund_deadline
            FROM order_info o
            JOIN `session` se ON se.session_id = o.session_id
            WHERE o.order_id = %s AND o.user_id = %s
            FOR UPDATE
            """,
            (order_id, user["user_id"]),
        )
        order = cursor.fetchone()
        if not order:
            fail(404, "订单不存在")
        if order["status"] != 1:
            if order["status"] == 2:
                fail(400, "该订单已退票")
            fail(400, "只有已支付订单可以申请退票")
        if order["allow_refund"] != 1:
            fail(400, "该场次不支持退票")

        deadline = order["refund_deadline"] or (order["start_time"] - timedelta(hours=24))
        if now_local() > deadline:
            fail(400, "已超过退票截止时间")

        fee_rate = Decimal(str(order["refund_fee_rate"] or 0))
        total_amount = Decimal(str(order["total_amount"]))
        fee_amount = (total_amount * fee_rate / Decimal("100")).quantize(Decimal("0.01"))
        refund_amount = total_amount - fee_amount

        cursor.execute(
            """
            INSERT INTO refund (order_id, refund_amount, fee_amount, status, reason, completed_at)
            VALUES (%s, %s, %s, 1, %s, %s)
            """,
            (order_id, refund_amount, fee_amount, reason, now_local()),
        )
        refund_id = cursor.lastrowid
        cursor.execute("UPDATE order_info SET status = 2 WHERE order_id = %s", (order_id,))
        cursor.execute("UPDATE ticket SET status = 2 WHERE order_id = %s", (order_id,))
        cursor.execute(
            """
            UPDATE seat s
            JOIN order_seat os ON os.seat_id = s.seat_id
            SET s.status = 0
            WHERE os.order_id = %s
            """,
            (order_id,),
        )
        cursor.execute(
            "UPDATE zone SET remaining_count = remaining_count + %s WHERE zone_id = %s",
            (order["ticket_count"], order["zone_id"]),
        )
        notified_count = notify_waiting_users(
            cursor,
            order["session_id"],
            order["zone_id"],
            order["ticket_count"],
        )
        insert_message(
            cursor,
            user["user_id"],
            "退票成功",
            "订单 " + str(order_id) + " 已退票，退款金额 " + str(refund_amount)
            + " 元，到账时间：" + str(now_local()) + "。",
        )
        return {
            "refund_id": refund_id,
            "refund_amount": refund_amount,
            "fee_amount": fee_amount,
            "notified_waiting_count": notified_count,
        }

    return success(run_in_transaction(work), "退票成功")


@router.post("/jobs/transaction-maintenance")
def transaction_maintenance_job(user=Depends(get_current_user)):
    if user["role"] != 2:
        fail(403, "Only admins can run transaction maintenance")
    return success(run_transaction_maintenance(), "transaction maintenance completed")


@router.post("/jobs/release-expired-locks")
def release_expired_locks(user=Depends(get_current_user)):
    if user["role"] != 2:
        fail(403, "仅管理员可执行清理任务")

    def work(cursor):
        canceled_orders = cleanup_expired_locks(cursor)
        return {"canceled_orders": canceled_orders}

    return success(run_in_transaction(work), "超时锁座清理完成")
