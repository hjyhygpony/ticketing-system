package com.bjut.cs.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/**
 * <p>
 * 
 * </p>
 *
 * @author D
 * @since 2026-07-10
 */
@Getter
@Setter
@TableName("session")
public class Session implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 场次ID
     */
    @TableId(value = "session_id", type = IdType.AUTO)
    private Integer sessionId;

    /**
     * 所属演出
     */
    @TableField("show_id")
    private Integer showId;

    /**
     * 演出开始时间
     */
    @TableField("start_time")
    private LocalDateTime startTime;

    /**
     * 演出结束时间
     */
    @TableField("end_time")
    private LocalDateTime endTime;

    /**
     * 开票时间，≤start_time
     */
    @TableField("ticket_open_time")
    private LocalDateTime ticketOpenTime;

    /**
     * 是否触发排队：0否 1是
     */
    @TableField("is_hot")
    private Integer isHot;

    /**
     * 虚拟排队同时放行人数：0表示不限制
     */
    @TableField("concurrent_limit")
    private Integer concurrentLimit;

    /**
     * 单次最大购票数（≥1）
     */
    @TableField("max_per_order")
    private Integer maxPerOrder;

    /**
     * 是否允许退票：0否 1是
     */
    @TableField("allow_refund")
    private Integer allowRefund;

    /**
     * 退票手续费比例（%），0~100
     */
    @TableField("refund_fee_rate")
    private BigDecimal refundFeeRate;

    /**
     * 是否需要选座：0按分区数量购票 1手动选座购票
     */
    @TableField("seat_select_enabled")
    private Integer seatSelectEnabled;

    /**
     * 座位行数（仅seat_select_enabled=1时有效）
     */
    @TableField("seat_rows")
    private Integer seatRows;

    /**
     * 座位列数（仅seat_select_enabled=1时有效）
     */
    @TableField("seat_cols")
    private Integer seatCols;

    /**
     * 退票截止时间（默认start_time前24h）
     */
    @TableField("refund_deadline")
    private LocalDateTime refundDeadline;

    /**
     * 是否开启候补：0否 1是
     */
    @TableField("waiting_enabled")
    private Integer waitingEnabled;

    /**
     * 预约人数
     */
    @TableField("reservation_count")
    private Integer reservationCount;
}
