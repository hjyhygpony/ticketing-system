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
@TableName("seat")
public class Seat implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 座位ID
     */
    @TableId(value = "seat_id", type = IdType.AUTO)
    private Integer seatId;

    /**
     * 所属场次
     */
    @TableField("session_id")
    private Integer sessionId;

    /**
     * 所属分区/票档
     */
    @TableField("zone_id")
    private Integer zoneId;

    /**
     * 排号
     */
    @TableField("row_no")
    private Integer rowNo;

    /**
     * 座号
     */
    @TableField("col_no")
    private Integer colNo;

    /**
     * 座位显示名称
     */
    @TableField("seat_label")
    private String seatLabel;

    /**
     * 0可售 1锁定中 2已售
     */
    @TableField("status")
    private Integer status;

    @TableField("lock_time")
    private LocalDateTime lockTime;

    @TableField("lock_expire_time")
    private LocalDateTime lockExpireTime;

    /**
     * 当前锁座用户
     */
    @TableField("lock_user_id")
    private Integer lockUserId;

    /**
     * 锁座凭证
     */
    @TableField("lock_token")
    private String lockToken;
}
