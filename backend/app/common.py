import random

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

from . import config
from .database import fetch_one
from .security import decode_token


bearer = HTTPBearer(auto_error=False)

SMS_STORE = {}
LOGIN_GUARDS = {}
ACTIVE_TOKENS = {}


def success(data=None, message="ok"):
    return {"code": 0, "message": message, "data": data}


def fail(status_code, message):
    raise HTTPException(status_code=status_code, detail=message)


def make_code():
    return f"{random.randint(0, 999999):06d}"


def save_token(user_id, token):
    sessions = ACTIVE_TOKENS.setdefault(user_id, [])
    sessions.append(token)
    if len(sessions) > 2:
        sessions.pop(0)


def remove_token(user_id, token):
    sessions = ACTIVE_TOKENS.get(user_id, [])
    ACTIVE_TOKENS[user_id] = [item for item in sessions if item != token]


def clear_tokens(user_id):
    ACTIVE_TOKENS[user_id] = []


def get_current_user(credentials=Depends(bearer)):
    if not credentials:
        fail(401, "请先登录")

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except Exception:
        fail(401, "登录已过期，请重新登录")

    user_id = int(payload["sub"])
    if token not in ACTIVE_TOKENS.get(user_id, []):
        fail(401, "登录已失效，请重新登录")

    user = fetch_one(
        "SELECT user_id, phone, is_verified, role, status, register_time, real_name FROM `user` WHERE user_id = %s",
        (user_id,),
    )
    if not user:
        fail(401, "用户不存在")
    if user["status"] == 0:
        fail(403, "账号已被封禁")

    user["token"] = token
    return user


def get_optional_user(credentials=Depends(bearer)):
    if not credentials:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None


def check_job_secret(secret):
    if secret != config.JOB_SECRET:
        fail(403, "任务密钥错误")
