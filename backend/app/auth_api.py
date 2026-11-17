from datetime import timedelta

from fastapi import APIRouter, Body, Depends

from .common import (
    LOGIN_GUARDS,
    SMS_STORE,
    clear_tokens,
    fail,
    get_current_user,
    make_code,
    remove_token,
    save_token,
    success,
)
from .database import fetch_one, run_in_transaction
from .security import create_token, hash_password, mask_phone, now_local, valid_password, valid_phone, verify_password


router = APIRouter()


def validate_sms_code(phone, code):
    sms = SMS_STORE.get(phone)
    if not sms or sms.get("code") != code or sms.get("expires_at") < now_local():
        fail(400, "验证码错误或已失效")


@router.post("/auth/code")
def send_code(payload: dict = Body(...)):
    phone = str(payload.get("phone", "")).strip()
    if not valid_phone(phone):
        fail(400, "请输入正确的11位手机号")

    today = now_local().date()
    record = SMS_STORE.get(phone, {"count": 0, "day": today})
    if record["day"] != today:
        record = {"count": 0, "day": today}
    if record["count"] >= 10:
        fail(429, "今日验证码次数已达上限")

    code = make_code()
    record["count"] = record["count"] + 1
    record["day"] = today
    record["code"] = code
    record["expires_at"] = now_local() + timedelta(minutes=5)
    SMS_STORE[phone] = record

    return success(
        {"phone": phone, "mock_code": code, "expires_in_seconds": 300},
        "验证码已生成（课程演示模式）",
    )


@router.post("/auth/register")
def register(payload: dict = Body(...)):
    phone = str(payload.get("phone", "")).strip()
    code = str(payload.get("code", "")).strip()
    password = str(payload.get("password", "")).strip()

    if not valid_phone(phone):
        fail(400, "请输入正确的11位手机号")
    if not valid_password(password):
        fail(400, "密码需8-20位且同时包含字母和数字")

    validate_sms_code(phone, code)
    if fetch_one("SELECT user_id FROM `user` WHERE phone = %s", (phone,)):
        fail(409, "该手机号已注册，请直接登录")

    def work(cursor):
        cursor.execute(
            "INSERT INTO `user` (phone, password_hash, balance, status, role) VALUES (%s, %s, %s, %s, %s)",
            (phone, hash_password(password), 0, 1, 0),
        )
        return cursor.lastrowid

    user_id = run_in_transaction(work)
    token = create_token(user_id, phone)
    save_token(user_id, token)
    SMS_STORE.pop(phone, None)

    return success(
        {
            "token": token,
            "user": {
                "user_id": user_id,
                "phone": phone,
                "phone_masked": mask_phone(phone),
                "is_verified": 0,
                "status": 1,
            },
        },
        "注册成功",
    )


@router.post("/auth/login")
def login(payload: dict = Body(...)):
    phone = str(payload.get("phone", "")).strip()
    password = str(payload.get("password", "")).strip()

    if not valid_phone(phone):
        fail(400, "请输入正确的11位手机号")

    guard = LOGIN_GUARDS.setdefault(phone, {"failures": 0, "lock_until": None})
    if guard["lock_until"] and guard["lock_until"] > now_local():
        fail(423, "登录失败过多，账号已锁定10分钟")

    user = fetch_one("SELECT user_id, phone, password_hash, status, is_verified FROM `user` WHERE phone = %s", (phone,))
    if not user:
        fail(404, "该手机号未注册")

    if not verify_password(password, user["password_hash"]):
        guard["failures"] = guard["failures"] + 1
        if guard["failures"] >= 5:
            guard["lock_until"] = now_local() + timedelta(minutes=10)
            guard["failures"] = 0
        fail(400, "手机号或密码错误")

    if user["status"] == 0:
        fail(403, "账号已被禁用")

    guard["failures"] = 0
    guard["lock_until"] = None
    token = create_token(user["user_id"], user["phone"])
    save_token(user["user_id"], token)

    return success(
        {
            "token": token,
            "user": {
                "user_id": user["user_id"],
                "phone": user["phone"],
                "phone_masked": mask_phone(user["phone"]),
                "is_verified": user["is_verified"],
                "status": user["status"],
            },
        },
        "登录成功",
    )


@router.post("/auth/reset-password")
def reset_password(payload: dict = Body(...)):
    phone = str(payload.get("phone", "")).strip()
    code = str(payload.get("code", "")).strip()
    new_password = str(payload.get("new_password", "")).strip()

    if not valid_phone(phone):
        fail(400, "请输入正确的11位手机号")
    if not valid_password(new_password):
        fail(400, "新密码需8-20位且同时包含字母和数字")

    user = fetch_one("SELECT user_id FROM `user` WHERE phone = %s", (phone,))
    if not user:
        fail(404, "该手机号未注册")

    validate_sms_code(phone, code)

    def work(cursor):
        cursor.execute(
            "UPDATE `user` SET password_hash = %s WHERE user_id = %s",
            (hash_password(new_password), user["user_id"]),
        )

    run_in_transaction(work)
    clear_tokens(user["user_id"])
    LOGIN_GUARDS[phone] = {"failures": 0, "lock_until": None}
    SMS_STORE.pop(phone, None)
    return success(message="密码重置成功，请重新登录")


@router.post("/auth/logout")
def logout(user=Depends(get_current_user)):
    remove_token(user["user_id"], user["token"])
    return success(message="已退出登录")
