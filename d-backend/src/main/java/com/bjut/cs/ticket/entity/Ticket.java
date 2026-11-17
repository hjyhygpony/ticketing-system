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
@TableName("ticket")
public class Ticket implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 电子票ID
     */
    @TableId(value = "ticket_id", type = IdType.AUTO)
    private Integer ticketId;

    /**
     * 所属订单
     */
    @TableField("order_id")
    private Integer orderId;

    /**
     * 对应具体座位
     */
    @TableField("seat_id")
    private Integer seatId;

    /**
     * 二维码（含防伪签名）
     */
    @TableField("qr_code")
    private String qrCode;

    /**
     * 状态：1有效 2已退票
     */
    @TableField("status")
    private Integer status;

    /**
     * 生成时间
     */
    @TableField("created_at")
    private LocalDateTime createdAt;
}
