package com.bjut.cs.ticket.admin.service;

import com.bjut.cs.ticket.common.enums.AuditStatus;
import com.bjut.cs.ticket.entity.OrderInfo;
import com.bjut.cs.ticket.entity.Show;
import com.bjut.cs.ticket.service.IOrderInfoService;
import com.bjut.cs.ticket.service.IShowService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final IOrderInfoService orderInfoService;
    private final IShowService showService;

    public Map<String, Object> getOverview() {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        List<Integer> paidStatuses = List.of(1, 4);

        List<OrderInfo> todayOrders = orderInfoService.lambdaQuery()
                .ge(OrderInfo::getCreatedTime, todayStart)
                .in(OrderInfo::getStatus, paidStatuses)
                .list();

        BigDecimal todaySales = todayOrders.stream()
                .map(OrderInfo::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long activeShows = showService.lambdaQuery()
                .eq(Show::getAuditStatus, AuditStatus.APPROVED.getCode()).count();

        List<OrderInfo> monthOrders = orderInfoService.lambdaQuery()
                .ge(OrderInfo::getCreatedTime, LocalDate.now().withDayOfMonth(1).atStartOfDay())
                .in(OrderInfo::getStatus, paidStatuses)
                .list();

        BigDecimal monthSales = monthOrders.stream()
                .map(OrderInfo::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("todayOrders", todayOrders.size());
        result.put("todaySales", todaySales);
        result.put("activeShows", activeShows);
        result.put("monthOrders", monthOrders.size());
        result.put("monthSales", monthSales);
        return result;
    }

    public List<Map<String, Object>> getTopShows(Integer limit) {
        List<Show> approvedShows = showService.lambdaQuery()
                .eq(Show::getAuditStatus, AuditStatus.APPROVED.getCode())
                .orderByDesc(Show::getFavCount)
                .last("LIMIT " + limit).list();

        return approvedShows.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("showId", s.getShowId());
            m.put("title", s.getTitle());
            m.put("category", s.getCategory());
            m.put("favCount", s.getFavCount());
            return m;
        }).collect(Collectors.toList());
    }
}
