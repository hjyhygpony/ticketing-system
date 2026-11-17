package com.bjut.cs.ticket.organizer.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class SalesOverviewVO {
    private Integer totalOrders;
    private Integer totalTickets;
    private BigDecimal totalSales;
    private Integer totalSeats;
    private Integer soldSeats;
    private Double sellThroughRate;
}
