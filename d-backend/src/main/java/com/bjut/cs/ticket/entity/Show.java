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
@TableName("`show`")
public class Show implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 演出ID
     */
    @TableId(value = "show_id", type = IdType.AUTO)
    private Integer showId;

    /**
     * 演出方用户ID
     */
    @TableField("user_id")
    private Integer userId;

    /**
     * 演出名称
     */
    @TableField("title")
    private String title;

    /**
     * 类型：演唱会/话剧/音乐节/音乐会/舞蹈/体育赛事/展览/其他
     */
    @TableField("category")
    private String category;

    /**
     * 场馆名称与地址
     */
    @TableField("venue")
    private String venue;

    /**
     * 演出简介
     */
    @TableField("description")
    private String description;

    /**
     * 演出阵容
     */
    @TableField("lineup")
    private String lineup;

    /**
     * 购票须知
     */
    @TableField("notice")
    private String notice;

    /**
     * 海报图片URL
     */
    @TableField("poster_url")
    private String posterUrl;

    /**
     * 审核状态：0待审 1上线 2驳回 3下架 4草稿
     */
    @TableField("audit_status")
    private Integer auditStatus;

    /**
     * 是否首页推荐
     */
    @TableField("is_recommended")
    private Integer isRecommended;

    /**
     * 推荐位排序
     */
    @TableField("recommend_order")
    private Integer recommendOrder;

    /**
     * 收藏数（冗余）
     */
    @TableField("fav_count")
    private Integer favCount;

    /**
     * 创建时间
     */
    @TableField("created_time")
    private LocalDateTime createdTime;
}
