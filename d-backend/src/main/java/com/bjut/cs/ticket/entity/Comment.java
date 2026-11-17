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
@TableName("comment")
public class Comment implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 评论ID
     */
    @TableId(value = "comment_id", type = IdType.AUTO)
    private Integer commentId;

    /**
     * 所属帖子ID
     */
    @TableField("post_id")
    private Integer postId;

    /**
     * 评论用户ID
     */
    @TableField("user_id")
    private Integer userId;

    /**
     * 评论内容（1-500字符）
     */
    @TableField("content")
    private String content;

    /**
     * 评论时间
     */
    @TableField("comment_time")
    private LocalDateTime commentTime;
}
