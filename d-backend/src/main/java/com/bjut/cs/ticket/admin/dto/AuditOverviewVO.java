package com.bjut.cs.ticket.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuditOverviewVO {
    private long pendingShows;
    private long pendingPosts;
    private long pendingQualifications;
}
