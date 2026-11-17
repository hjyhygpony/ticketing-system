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
@TableName("queue")
public class Queue implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 排队记录ID
     */
    @TableId(value = "queue_id", type = IdType.AUTO)
    private Integer queueId;

    /**
     * 排队用户ID
     */
    @TableField("user_id")
    private Integer userId;

    /**
     * 目标场次ID
     */
    @TableField("session_id")
    private Integer sessionId;

    /**
     * 排队序号（严格递增）
     */
    @TableField("queue_no")
    private Integer queueNo;

    /**
     * 状态：0排队中 1已放行 2已过期 3已取消
     */
    @TableField("status")
    private Integer status;

    /**
     * 进入排队时间
     */
    @TableField("join_time")
    private LocalDateTime joinTime;

    /**
     * 放行后过期时间
     */
    @TableField("expire_time")
    private LocalDateTime expireTime;
}
