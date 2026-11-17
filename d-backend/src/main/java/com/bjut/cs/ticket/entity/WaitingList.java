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
@TableName("waiting_list")
public class WaitingList implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 候补记录ID
     */
    @TableId(value = "waiting_id", type = IdType.AUTO)
    private Integer waitingId;

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
     * 分区ID
     */
    @TableField("zone_id")
    private Integer zoneId;

    /**
     * 候补排队序号（≥1）
     */
    @TableField("queue_order")
    private Integer queueOrder;

    /**
     * 状态：0等待中 1已通知 2已购票 3已跳过
     */
    @TableField("status")
    private Integer status;

    /**
     * 通知时间
     */
    @TableField("notify_time")
    private LocalDateTime notifyTime;

    /**
     * 通知过期时间（notify_time+15分钟）
     */
    @TableField("expire_time")
    private LocalDateTime expireTime;

    /**
     * 加入时间
     */
    @TableField("created_at")
    private LocalDateTime createdAt;
}
