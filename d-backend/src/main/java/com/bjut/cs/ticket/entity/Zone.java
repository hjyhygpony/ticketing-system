package com.bjut.cs.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.io.Serializable;
import java.math.BigDecimal;
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
@TableName("zone")
public class Zone implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 分区ID
     */
    @TableId(value = "zone_id", type = IdType.AUTO)
    private Integer zoneId;

    /**
     * 所属场次
     */
    @TableField("session_id")
    private Integer sessionId;

    /**
     * 分区名称（如A区、VIP区）
     */
    @TableField("name")
    private String name;

    /**
     * 票价（>0）
     */
    @TableField("price")
    private BigDecimal price;

    /**
     * 总座位数（≥1）
     */
    @TableField("total_seats")
    private Integer totalSeats;

    /**
     * 剩余可售数量（≥0）
     */
    @TableField("remaining_count")
    private Integer remainingCount;
}
