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
@TableName("reservation")
public class Reservation implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 预约ID
     */
    @TableId(value = "reservation_id", type = IdType.AUTO)
    private Integer reservationId;

    /**
     * 用户ID
     */
    @TableField("user_id")
    private Integer userId;

    /**
     * 场次ID
     */
    @TableField("session_id")
    private Integer sessionId;

    /**
     * 意向分区
     */
    @TableField("zone_id")
    private Integer zoneId;

    /**
     * 状态：1有效 2已失效
     */
    @TableField("status")
    private Integer status;

    /**
     * 预约时间
     */
    @TableField("created_at")
    private LocalDateTime createdAt;
}
