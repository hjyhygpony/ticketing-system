package com.bjut.cs.ticket.organizer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class QualificationApplyDTO {

    @NotBlank(message = "公司名称不能为空")
    private String companyName;

    @NotBlank(message = "统一社会信用代码不能为空")
    @Pattern(regexp = "^[0-9A-Z]{18}$", message = "信用代码须为18位数字或大写字母")
    private String creditCode;

    @NotBlank(message = "营业执照URL不能为空")
    private String licenseUrl;

    @NotBlank(message = "联系人不能为空")
    private String contactName;

    @NotBlank(message = "联系电话不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String contactPhone;
}
