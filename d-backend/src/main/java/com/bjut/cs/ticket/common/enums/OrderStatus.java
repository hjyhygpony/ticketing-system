package com.bjut.cs.ticket.common.enums;

import lombok.Getter;

/**
 * 订单状态: 0待付 1已付 2已退款 3已取消 4已完成
 */
@Getter
public enum OrderStatus {
    UNPAID(0, "待支付"),
    PAID(1, "已支付"),
    REFUNDED(2, "已退款"),
    CANCELLED(3, "已取消"),
    COMPLETED(4, "已完成");

    private final int code;
    private final String label;

    OrderStatus(int code, String label) {
        this.code = code;
        this.label = label;
    }
}
