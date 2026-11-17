package com.bjut.cs.ticket.organizer.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class ZoneSalesVO {
    private Integer zoneId;
    private String zoneName;
    private BigDecimal price;
    private Integer totalSeats;
    private Integer soldCount;
    private BigDecimal subtotal;
}
