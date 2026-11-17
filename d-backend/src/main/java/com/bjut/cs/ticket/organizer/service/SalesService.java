package com.bjut.cs.ticket.organizer.service;

import com.bjut.cs.ticket.entity.*;
import com.bjut.cs.ticket.organizer.dto.SalesOverviewVO;
import com.bjut.cs.ticket.organizer.dto.ZoneSalesVO;
import com.bjut.cs.ticket.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SalesService {

    private final IShowService showService;
    private final ISessionService sessionService;
    private final IZoneService zoneService;
    private final IOrderInfoService orderInfoService;

    public SalesOverviewVO getOverview(Integer showId, Integer userId) {
        Show show = showService.getById(showId);
        if (show == null || !show.getUserId().equals(userId)) {
            throw new RuntimeException("演出不存在或无权查看");
        }

        List<Integer> sessionIds = sessionService.lambdaQuery()
                .eq(Session::getShowId, showId)
                .list()
                .stream().map(Session::getSessionId).toList();

        if (sessionIds.isEmpty()) {
            return new SalesOverviewVO();
        }

        List<Integer> paidStatuses = List.of(1, 4); // PAID, COMPLETED
        List<OrderInfo> orders = orderInfoService.lambdaQuery()
                .in(OrderInfo::getSessionId, sessionIds)
                .in(OrderInfo::getStatus, paidStatuses)
                .list();

        int totalTickets = orders.stream().mapToInt(OrderInfo::getTicketCount).sum();
        BigDecimal totalSales = orders.stream()
                .map(OrderInfo::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int totalSeats = zoneService.lambdaQuery()
                .in(Zone::getSessionId, sessionIds)
                .list()
                .stream().mapToInt(Zone::getTotalSeats).sum();

        int soldSeats = totalTickets;

        SalesOverviewVO vo = new SalesOverviewVO();
        vo.setTotalOrders(orders.size());
        vo.setTotalTickets(totalTickets);
        vo.setTotalSales(totalSales);
        vo.setTotalSeats(totalSeats);
        vo.setSoldSeats(soldSeats);
        vo.setSellThroughRate(totalSeats > 0 ? (double) soldSeats / totalSeats * 100 : 0);
        return vo;
    }

    public List<ZoneSalesVO> getZoneDetail(Integer showId, Integer userId) {
        Show show = showService.getById(showId);
        if (show == null || !show.getUserId().equals(userId)) {
            throw new RuntimeException("演出不存在或无权查看");
        }

        List<Session> sessions = sessionService.lambdaQuery()
                .eq(Session::getShowId, showId).list();

        if (sessions.isEmpty()) {
            return Collections.emptyList();
        }

        List<Integer> sessionIds = sessions.stream().map(Session::getSessionId).toList();
        List<Zone> allZones = zoneService.lambdaQuery()
                .in(Zone::getSessionId, sessionIds).list();
        Map<Integer, Zone> zoneMap = allZones.stream()
                .collect(Collectors.toMap(Zone::getZoneId, z -> z));

        List<Integer> paidStatuses = List.of(1, 4);
        List<OrderInfo> orders = orderInfoService.lambdaQuery()
                .in(OrderInfo::getSessionId, sessionIds)
                .in(OrderInfo::getStatus, paidStatuses)
                .list();

        Map<Integer, Integer> zoneTickets = new HashMap<>();
        Map<Integer, BigDecimal> zoneSales = new HashMap<>();
        for (OrderInfo o : orders) {
            zoneTickets.merge(o.getZoneId(), o.getTicketCount(), Integer::sum);
            zoneSales.merge(o.getZoneId(), o.getTotalAmount(), BigDecimal::add);
        }

        List<ZoneSalesVO> result = new ArrayList<>();
        for (Zone z : allZones) {
            ZoneSalesVO vo = new ZoneSalesVO();
            vo.setZoneId(z.getZoneId());
            vo.setZoneName(z.getName());
            vo.setPrice(z.getPrice());
            vo.setTotalSeats(z.getTotalSeats());
            vo.setSoldCount(zoneTickets.getOrDefault(z.getZoneId(), 0));
            vo.setSubtotal(zoneSales.getOrDefault(z.getZoneId(), BigDecimal.ZERO));
            result.add(vo);
        }
        return result;
    }
}
