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
@TableName("report")
public class Report implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 举报ID
     */
    @TableId(value = "report_id", type = IdType.AUTO)
    private Integer reportId;

    /**
     * 举报人ID
     */
    @TableField("user_id")
    private Integer userId;

    /**
     * 被举报帖子ID
     */
    @TableField("post_id")
    private Integer postId;

    /**
     * 举报原因（预设类型+补充说明≤200字）
     */
    @TableField("reason")
    private String reason;

    /**
     * 状态：0待处理 1已处理 2已驳回
     */
    @TableField("status")
    private Integer status;

    /**
     * 举报时间
     */
    @TableField("report_time")
    private LocalDateTime reportTime;
}
