package com.bjut.cs.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.io.Serializable;
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
@TableName("refund")
public class Refund implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 退款ID
     */
    @TableId(value = "refund_id", type = IdType.AUTO)
    private Integer refundId;

    /**
     * 原订单ID
     */
    @TableField("order_id")
    private Integer orderId;

    /**
     * 退款金额（>0）
     */
    @TableField("refund_amount")
    private Long refundAmount;

    /**
     * 退款手续费
     */
    @TableField("fee_amount")
    private Long feeAmount;

    /**
     * 状态：0处理中 1已完成 2失败
     */
    @TableField("status")
    private Integer status;

    /**
     * 退款原因
     */
    @TableField("reason")
    private String reason;

    /**
     * 申请时间
     */
    @TableField("created_at")
    private LocalDateTime createdAt;

    /**
     * 完成时间
     */
    @TableField("completed_at")
    private LocalDateTime completedAt;
}
