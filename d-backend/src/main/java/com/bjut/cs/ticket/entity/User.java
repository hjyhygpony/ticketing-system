package com.bjut.cs.ticket.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.io.Serializable;
import java.math.BigDecimal;
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
@TableName("user")
public class User implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 用户ID
     */
    @TableId(value = "user_id", type = IdType.AUTO)
    private Integer userId;

    /**
     * 手机号
     */
    @TableField("phone")
    private String phone;

    /**
     * 密码哈希
     */
    @TableField("password_hash")
    private String passwordHash;

    /**
     * 实名姓名（加密存储）
     */
    @TableField("real_name")
    private String realName;

    /**
     * 身份证号（加密），一证一号
     */
    @TableField("idcard")
    private String idcard;

    /**
     * 是否已实名认证：0否 1是
     */
    @TableField("is_verified")
    private Integer isVerified;

    /**
     * 角色：0消费者 1演出方 2管理员
     */
    @TableField("role")
    private Integer role;

    /**
     * 用户昵称
     */
    @TableField("nickname")
    private String nickname;

    /**
     * 账户余额（虚拟）
     */
    @TableField("balance")
    private BigDecimal balance;

    /**
     * 账号状态：0封禁 1正常 2禁言
     */
    @TableField("status")
    private Integer status;

    /**
     * 注册时间
     */
    @TableField("register_time")
    private LocalDateTime registerTime;
}
