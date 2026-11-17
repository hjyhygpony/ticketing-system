package com.bjut.cs.ticket.admin.controller;

import com.bjut.cs.ticket.admin.service.DashboardService;
import com.bjut.cs.ticket.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.ok(dashboardService.getOverview());
    }

    @GetMapping("/top-shows")
    public ApiResponse<List<Map<String, Object>>> topShows(
            @RequestParam(defaultValue = "20") Integer limit) {
        return ApiResponse.ok(dashboardService.getTopShows(limit));
    }
}
