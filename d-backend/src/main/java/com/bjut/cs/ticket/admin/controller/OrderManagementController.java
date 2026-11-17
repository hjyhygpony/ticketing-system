package com.bjut.cs.ticket.admin.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.bjut.cs.ticket.admin.dto.OrderSearchDTO;
import com.bjut.cs.ticket.admin.service.OrderManagementService;
import com.bjut.cs.ticket.common.ApiResponse;
import com.bjut.cs.ticket.common.context.UserContext;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
public class OrderManagementController {

    private final OrderManagementService orderManagementService;

    @GetMapping
    public ApiResponse<IPage<Map<String, Object>>> search(
            @ModelAttribute OrderSearchDTO dto,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ApiResponse.ok(orderManagementService.searchOrders(dto, page, size));
    }

    @PutMapping("/{id}/refund")
    public ApiResponse<Void> forceRefund(@PathVariable Integer id, @RequestBody RefundDTO dto) {
        orderManagementService.forceRefund(id, UserContext.getUserId(), dto.getReason());
        return ApiResponse.ok(null);
    }

    @PutMapping("/{id}/reissue")
    public ApiResponse<Void> reissue(@PathVariable Integer id) {
        orderManagementService.reissueTicket(id, UserContext.getUserId());
        return ApiResponse.ok(null);
    }

    @Data
    public static class RefundDTO { private String reason; }
}
