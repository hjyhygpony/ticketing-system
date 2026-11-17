package com.bjut.cs.ticket.organizer.controller;

import com.bjut.cs.ticket.common.ApiResponse;
import com.bjut.cs.ticket.common.context.UserContext;
import com.bjut.cs.ticket.organizer.dto.SalesOverviewVO;
import com.bjut.cs.ticket.organizer.dto.ZoneSalesVO;
import com.bjut.cs.ticket.organizer.service.SalesService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizer/sales")
@RequiredArgsConstructor
public class SalesController {

    private final SalesService salesService;

    @GetMapping("/{showId}/overview")
    public ApiResponse<SalesOverviewVO> overview(@PathVariable Integer showId) {
        return ApiResponse.ok(salesService.getOverview(showId, UserContext.getUserId()));
    }

    @GetMapping("/{showId}/zone-detail")
    public ApiResponse<List<ZoneSalesVO>> zoneDetail(@PathVariable Integer showId) {
        return ApiResponse.ok(salesService.getZoneDetail(showId, UserContext.getUserId()));
    }
}
