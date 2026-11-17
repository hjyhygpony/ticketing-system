package com.bjut.cs.ticket.admin.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class OrderSearchDTO {
    private String keyword;
    private Integer status;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
}
