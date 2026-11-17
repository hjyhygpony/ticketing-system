package com.bjut.cs.ticket.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.bjut.cs.ticket.admin.dto.OrderSearchDTO;
import com.bjut.cs.ticket.common.enums.OrderStatus;
import com.bjut.cs.ticket.entity.*;
import com.bjut.cs.ticket.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class OrderManagementService {

    private final IOrderInfoService orderInfoService;
    private final IOrderSeatService orderSeatService;
    private final ITicketService ticketService;
    private final IRefundService refundService;
    private final IAuditLogService auditLogService;

    public IPage<Map<String, Object>> searchOrders(OrderSearchDTO dto, Integer page, Integer size) {
        LambdaQueryWrapper<OrderInfo> wrapper = new LambdaQueryWrapper<>();
        if (dto.getKeyword() != null && !dto.getKeyword().isBlank()) {
            wrapper.and(w -> w.eq(OrderInfo::getOrderId, tryParseInt(dto.getKeyword())));
        }
        if (dto.getStatus() != null) {
            wrapper.eq(OrderInfo::getStatus, dto.getStatus());
        }
        if (dto.getStartTime() != null) {
            wrapper.ge(OrderInfo::getCreatedTime, dto.getStartTime());
        }
        if (dto.getEndTime() != null) {
            wrapper.le(OrderInfo::getCreatedTime, dto.getEndTime());
        }
        wrapper.orderByDesc(OrderInfo::getCreatedTime);
        IPage<OrderInfo> orderPage = orderInfoService.page(new Page<>(page, size), wrapper);

        List<Map<String, Object>> enriched = new ArrayList<>();
        for (OrderInfo o : orderPage.getRecords()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("order", o);
            List<OrderSeat> seats = orderSeatService.lambdaQuery()
                    .eq(OrderSeat::getOrderId, o.getOrderId()).list();
            m.put("seats", seats);
            enriched.add(m);
        }

        IPage<Map<String, Object>> result = new Page<>(orderPage.getCurrent(), orderPage.getSize(), orderPage.getTotal());
        result.setRecords(enriched);
        return result;
    }

    @Transactional
    public void forceRefund(Integer orderId, Integer adminId, String reason) {
        OrderInfo order = orderInfoService.getById(orderId);
        if (order == null) throw new RuntimeException("订单不存在");
        if (order.getStatus() != OrderStatus.PAID.getCode() && order.getStatus() != OrderStatus.COMPLETED.getCode()) {
            throw new RuntimeException("仅已支付/已完成订单可退款");
        }

        order.setStatus(OrderStatus.REFUNDED.getCode());
        orderInfoService.updateById(order);

        Refund refund = new Refund();
        refund.setOrderId(orderId);
        refund.setRefundAmount(order.getTotalAmount().longValue());
        refund.setFeeAmount(0L);
        refund.setStatus(1);
        refund.setReason(reason);
        refund.setCreatedAt(LocalDateTime.now());
        refund.setCompletedAt(LocalDateTime.now());
        refundService.save(refund);

        ticketService.lambdaUpdate()
                .eq(Ticket::getOrderId, orderId)
                .set(Ticket::getStatus, 2)
                .update();

        AuditLog log = new AuditLog();
        log.setAdminId(adminId);
        log.setTargetType("refund");
        log.setTargetId(orderId);
        log.setAction("force-refund");
        log.setResult(1);
        log.setRemark(reason);
        log.setCreatedAt(LocalDateTime.now());
        auditLogService.save(log);
    }

    @Transactional
    public void reissueTicket(Integer orderId, Integer adminId) {
        OrderInfo order = orderInfoService.getById(orderId);
        if (order == null) throw new RuntimeException("订单不存在");

        List<OrderSeat> seats = orderSeatService.lambdaQuery()
                .eq(OrderSeat::getOrderId, orderId).list();
        for (OrderSeat os : seats) {
            Ticket ticket = new Ticket();
            ticket.setOrderId(orderId);
            ticket.setSeatId(os.getSeatId());
            ticket.setQrCode("REISSUED-" + UUID.randomUUID().toString().substring(0, 8));
            ticket.setStatus(1);
            ticket.setCreatedAt(LocalDateTime.now());
            ticketService.save(ticket);
        }

        AuditLog log = new AuditLog();
        log.setAdminId(adminId);
        log.setTargetType("refund");
        log.setTargetId(orderId);
        log.setAction("reissue");
        log.setResult(1);
        log.setCreatedAt(LocalDateTime.now());
        auditLogService.save(log);
    }

    private int tryParseInt(String s) {
        try { return Integer.parseInt(s); } catch (NumberFormatException e) { return -1; }
    }
}
