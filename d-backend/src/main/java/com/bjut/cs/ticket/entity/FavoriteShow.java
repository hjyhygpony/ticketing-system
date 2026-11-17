package com.bjut.cs.ticket.entity;

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
@TableName("favorite_show")
public class FavoriteShow implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 用户ID
     */
    @TableId("user_id")
    private Integer userId;

    /**
     * 演出ID
     */
    @TableField("show_id")
    private Integer showId;

    /**
     * 收藏时间
     */
    @TableField("created_at")
    private LocalDateTime createdAt;
}
