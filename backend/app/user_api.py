from fastapi import APIRouter, Body, Depends

from .common import get_current_user, success, fail
from .database import fetch_all, fetch_one, run_in_transaction
from .security import decrypt_text, encrypt_text, hash_idcard, mask_name, mask_phone, valid_idcard, valid_name


router = APIRouter()


def count_summary(user_id):
    favorite_row = fetch_one("SELECT COUNT(*) AS total FROM favorite_show WHERE user_id = %s", (user_id,)) or {"total": 0}
    reservation_row = fetch_one("SELECT COUNT(*) AS total FROM reservation WHERE user_id = %s AND status = 1", (user_id,)) or {"total": 0}
    unread_row = fetch_one("SELECT COUNT(*) AS total FROM message WHERE user_id = %s AND is_read = 0", (user_id,)) or {"total": 0}
    return {
        "favorite_count": favorite_row["total"],
        "reservation_count": reservation_row["total"],
        "unread_message_count": unread_row["total"],
    }


@router.get("/users/me")
def me(user=Depends(get_current_user)):
    name = ""
    if user.get("real_name"):
        try:
            name = mask_name(decrypt_text(user["real_name"]))
        except Exception:
            name = ""

    data = {
        "user_id": user["user_id"],
        "phone": user["phone"],
        "phone_masked": mask_phone(user["phone"]),
        "is_verified": user["is_verified"],
        "status": user["status"],
        "register_time": user["register_time"],
        "real_name_masked": name,
    }
    data.update(count_summary(user["user_id"]))
    return success(data)


@router.get("/users/verify-status")
def verify_status(user=Depends(get_current_user)):
    row = fetch_one("SELECT is_verified, real_name, register_time FROM `user` WHERE user_id = %s", (user["user_id"],))
    masked_name = ""
    if row and row["real_name"]:
        try:
            masked_name = mask_name(decrypt_text(row["real_name"]))
        except Exception:
            masked_name = ""
    return success({"is_verified": row["is_verified"], "real_name_masked": masked_name, "updated_at": row["register_time"]})


@router.post("/users/verify")
def verify_user(payload: dict = Body(...), user=Depends(get_current_user)):
    real_name = str(payload.get("real_name", "")).strip()
    idcard = str(payload.get("idcard", "")).strip()
    promise = bool(payload.get("promise"))

    if user["is_verified"]:
        fail(400, "当前账号已完成实名认证")
    if not promise:
        fail(400, "请勾选信息真实性承诺")
    if not valid_name(real_name):
        fail(400, "请填写2-20位中文姓名")
    if not valid_idcard(idcard):
        fail(400, "身份证号格式有误")

    idcard_hash = hash_idcard(idcard)
    exists = fetch_one("SELECT user_id FROM `user` WHERE idcard = %s AND user_id <> %s", (idcard_hash, user["user_id"]))
    if exists:
        fail(409, "该身份证号已绑定其他账号")

    def work(cursor):
        cursor.execute(
            "UPDATE `user` SET real_name = %s, idcard = %s, is_verified = 1 WHERE user_id = %s",
            (encrypt_text(real_name), idcard_hash, user["user_id"]),
        )

    run_in_transaction(work)
    return success({"is_verified": 1}, "实名认证成功")


@router.get("/users/favorites")
def my_favorites(user=Depends(get_current_user)):
    rows = fetch_all(
        """
        SELECT
            f.created_at,
            s.show_id, s.title, s.category, s.venue, s.poster_url, s.fav_count,
            MIN(se.start_time) AS first_session,
            MIN(z.price) AS min_price
        FROM favorite_show f
        JOIN `show` s ON s.show_id = f.show_id
        LEFT JOIN `session` se ON se.show_id = s.show_id
        LEFT JOIN zone z ON z.session_id = se.session_id
        WHERE f.user_id = %s
        GROUP BY f.user_id, s.show_id, f.created_at
        ORDER BY f.created_at DESC
        """,
        (user["user_id"],),
    )
    return success(rows)


@router.get("/users/reservations")
def my_reservations(user=Depends(get_current_user)):
    rows = fetch_all(
        """
        SELECT
            r.reservation_id, r.status, r.created_at,
            sh.show_id, sh.title, sh.poster_url,
            se.session_id, se.start_time, se.ticket_open_time,
            z.zone_id, z.name AS zone_name, z.price
        FROM reservation r
        JOIN `session` se ON se.session_id = r.session_id
        JOIN `show` sh ON sh.show_id = se.show_id
        LEFT JOIN zone z ON z.zone_id = r.zone_id
        WHERE r.user_id = %s AND r.status = 1
        ORDER BY r.created_at DESC
        """,
        (user["user_id"],),
    )
    return success(rows)


@router.get("/users/messages")
def my_messages(user=Depends(get_current_user)):
    rows = fetch_all(
        """
        SELECT message_id, title, content, is_read, created_at
        FROM message
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 50
        """,
        (user["user_id"],),
    )
    return success(rows)


@router.post("/users/messages/{message_id}/read")
def read_message(message_id: int, user=Depends(get_current_user)):
    message = fetch_one(
        "SELECT message_id, is_read FROM message WHERE message_id = %s AND user_id = %s",
        (message_id, user["user_id"]),
    )
    if not message:
        fail(404, "消息不存在")
    if message["is_read"] == 1:
        return success({"message_id": message_id, "is_read": 1}, "消息已读")

    def work(cursor):
        cursor.execute(
            "UPDATE message SET is_read = 1 WHERE message_id = %s AND user_id = %s",
            (message_id, user["user_id"]),
        )

    run_in_transaction(work)
    return success({"message_id": message_id, "is_read": 1}, "已标记为已读")
