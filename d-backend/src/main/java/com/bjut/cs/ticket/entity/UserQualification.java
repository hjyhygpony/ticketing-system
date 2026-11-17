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
@TableName("user_qualification")
public class UserQualification implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 资质记录ID
     */
    @TableId(value = "qual_id", type = IdType.AUTO)
    private Integer qualId;

    /**
     * 关联用户
     */
    @TableField("user_id")
    private Integer userId;

    /**
     * 公司名称
     */
    @TableField("company_name")
    private String companyName;

    /**
     * 统一社会信用代码
     */
    @TableField("credit_code")
    private String creditCode;

    /**
     * 营业执照URL
     */
    @TableField("license_url")
    private String licenseUrl;

    /**
     * 联系人
     */
    @TableField("contact_name")
    private String contactName;

    /**
     * 联系电话
     */
    @TableField("contact_phone")
    private String contactPhone;

    /**
     * 审核状态：0待审核 1通过 2驳回
     */
    @TableField("audit_status")
    private Integer auditStatus;

    /**
     * 审核备注
     */
    @TableField("audit_remark")
    private String auditRemark;

    /**
     * 提交时间
     */
    @TableField("submitted_at")
    private LocalDateTime submittedAt;

    /**
     * 审核时间
     */
    @TableField("audited_at")
    private LocalDateTime auditedAt;
}
