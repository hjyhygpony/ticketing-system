package com.bjut.cs.ticket.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.io.Serializable;
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
@TableName("order_seat")
public class OrderSeat implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId("order_id")
    private Integer orderId;

    @TableField("seat_id")
    private Integer seatId;
}
