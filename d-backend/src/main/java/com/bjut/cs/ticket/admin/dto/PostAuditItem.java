package com.bjut.cs.ticket.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PostAuditItem {
    private Integer postId;
    private String title;
    private Integer userId;
    private Integer auditStatus;
    private Integer reportCount;
    private java.time.LocalDateTime postTime;
}
