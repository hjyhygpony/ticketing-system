package com.bjut.cs.ticket.common.enums;

import lombok.Getter;

/**
 * 演出审核状态: 0待审 1上线 2驳回 3下架 4草稿
 */
@Getter
public enum AuditStatus {
    PENDING(0, "待审核"),
    APPROVED(1, "已上线"),
    REJECTED(2, "已驳回"),
    OFFLINE(3, "已下架"),
    DRAFT(4, "草稿");

    private final int code;
    private final String label;

    AuditStatus(int code, String label) {
        this.code = code;
        this.label = label;
    }
}
