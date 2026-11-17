package com.bjut.cs.ticket.common.context;

/**
 * 用户上下文 — 由 AuthInterceptor 从 JWT 解析后设置。
 */
public class UserContext {

    private static final ThreadLocal<Integer> USER_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> PHONE = new ThreadLocal<>();
    private static final ThreadLocal<Integer> ROLE = new ThreadLocal<>();

    public static void setUserId(Integer userId) { USER_ID.set(userId); }
    public static Integer getUserId() { return USER_ID.get(); }

    public static void setPhone(String phone) { PHONE.set(phone); }
    public static String getPhone() { return PHONE.get(); }

    public static void setRole(Integer role) { ROLE.set(role); }
    public static Integer getRole() { return ROLE.get(); }

    public static void clear() {
        USER_ID.remove();
        PHONE.remove();
        ROLE.remove();
    }
}
