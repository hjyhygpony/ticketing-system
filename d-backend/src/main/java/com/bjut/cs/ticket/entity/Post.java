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
@TableName("post")
public class Post implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 帖子ID
     */
    @TableId(value = "post_id", type = IdType.AUTO)
    private Integer postId;

    /**
     * 发帖用户ID
     */
    @TableField("user_id")
    private Integer userId;

    /**
     * 关联演出ID（可选）
     */
    @TableField("show_id")
    private Integer showId;

    /**
     * 帖子标题（2-100字符）
     */
    @TableField("title")
    private String title;

    /**
     * 帖子正文（1-10000字符）
     */
    @TableField("content")
    private String content;

    /**
     * 审核状态：0待审 1通过 2屏蔽
     */
    @TableField("audit_status")
    private Integer auditStatus;

    /**
     * 点赞数（冗余）
     */
    @TableField("like_count")
    private Integer likeCount;

    /**
     * 收藏数（冗余）
     */
    @TableField("fav_count")
    private Integer favCount;

    /**
     * 回复数（冗余）
     */
    @TableField("comment_count")
    private Integer commentCount;

    /**
     * 发帖时间
     */
    @TableField("post_time")
    private LocalDateTime postTime;
}
