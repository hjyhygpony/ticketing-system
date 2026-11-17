package com.bjut.cs.ticket.organizer.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.bjut.cs.ticket.common.enums.AuditStatus;
import com.bjut.cs.ticket.entity.UserQualification;
import com.bjut.cs.ticket.organizer.dto.QualificationApplyDTO;
import com.bjut.cs.ticket.service.IUserQualificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class QualificationService {

    private final IUserQualificationService userQualificationService;

    public void apply(Integer userId, QualificationApplyDTO dto) {
        UserQualification latest = userQualificationService.lambdaQuery()
                .eq(UserQualification::getUserId, userId)
                .orderByDesc(UserQualification::getSubmittedAt)
                .last("LIMIT 1")
                .one();

        if (latest != null && latest.getAuditStatus() == AuditStatus.PENDING.getCode()) {
            throw new RuntimeException("您已有待审核的申请，请勿重复提交");
        }

        UserQualification qual = new UserQualification();
        qual.setUserId(userId);
        qual.setCompanyName(dto.getCompanyName());
        qual.setCreditCode(dto.getCreditCode());
        qual.setLicenseUrl(dto.getLicenseUrl());
        qual.setContactName(dto.getContactName());
        qual.setContactPhone(dto.getContactPhone());
        qual.setAuditStatus(AuditStatus.PENDING.getCode());
        qual.setSubmittedAt(LocalDateTime.now());

        userQualificationService.save(qual);
    }

    public UserQualification getStatus(Integer userId) {
        return userQualificationService.lambdaQuery()
                .eq(UserQualification::getUserId, userId)
                .orderByDesc(UserQualification::getSubmittedAt)
                .last("LIMIT 1")
                .one();
    }
}
