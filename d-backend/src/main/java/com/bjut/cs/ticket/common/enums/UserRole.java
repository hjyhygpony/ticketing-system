package com.bjut.cs.ticket.common.enums;

import lombok.Getter;

/**
 * 用户角色: 0消费者 1演出方 2管理员
 */
@Getter
public enum UserRole {
    CONSUMER(0, "普通消费者"),
    ORGANIZER(1, "演出方"),
    ADMIN(2, "平台运营者");

    private final int code;
    private final String label;

    UserRole(int code, String label) {
        this.code = code;
        this.label = label;
    }
}
