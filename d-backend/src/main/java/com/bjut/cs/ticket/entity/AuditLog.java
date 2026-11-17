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
@TableName("audit_log")
public class AuditLog implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 日志ID
     */
    @TableId(value = "log_id", type = IdType.AUTO)
    private Integer logId;

    /**
     * 操作管理员ID
     */
    @TableField("admin_id")
    private Integer adminId;

    /**
     * 目标类型（user/show/post/refund/qualification）
     */
    @TableField("target_type")
    private String targetType;

    /**
     * 目标记录ID
     */
    @TableField("target_id")
    private Integer targetId;

    /**
     * 操作类型（approve/reject/block/suspend等）
     */
    @TableField("action")
    private String action;

    /**
     * 处理结果代码
     */
    @TableField("result")
    private Integer result;

    /**
     * 操作备注/原因
     */
    @TableField("remark")
    private String remark;

    /**
     * 操作时间
     */
    @TableField("created_at")
    private LocalDateTime createdAt;
}
