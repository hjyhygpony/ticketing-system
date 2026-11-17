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
@TableName("order_info")
public class OrderInfo implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 订单ID
     */
    @TableId(value = "order_id", type = IdType.AUTO)
    private Integer orderId;

    /**
     * 买家用户ID
     */
    @TableField("user_id")
    private Integer userId;

    /**
     * 场次ID
     */
    @TableField("session_id")
    private Integer sessionId;

    /**
     * 分区ID
     */
    @TableField("zone_id")
    private Integer zoneId;

    /**
     * 购票张数（≥1）
     */
    @TableField("ticket_count")
    private Integer ticketCount;

    /**
     * 订单总金额（>0）
     */
    @TableField("total_amount")
    private BigDecimal totalAmount;

    /**
     * 状态：0待付 1已付 2已退款 3已取消 4已完成
     */
    @TableField("status")
    private Integer status;

    /**
     * 支付方式：wechat/alipay/bank
     */
    @TableField("pay_method")
    private String payMethod;

    /**
     * 支付时间
     */
    @TableField("paid_time")
    private LocalDateTime paidTime;

    /**
     * 待支付过期时间
     */
    @TableField("expire_time")
    private LocalDateTime expireTime;

    /**
     * 下单时间
     */
    @TableField("created_time")
    private LocalDateTime createdTime;
}
