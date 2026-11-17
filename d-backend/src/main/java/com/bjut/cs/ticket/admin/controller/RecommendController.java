package com.bjut.cs.ticket.admin.controller;

import com.bjut.cs.ticket.admin.service.RecommendService;
import com.bjut.cs.ticket.common.ApiResponse;
import com.bjut.cs.ticket.entity.Show;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/recommends")
@RequiredArgsConstructor
public class RecommendController {

    private final RecommendService recommendService;

    @GetMapping
    public ApiResponse<List<Show>> list() {
        return ApiResponse.ok(recommendService.listRecommends());
    }

    @PutMapping
    public ApiResponse<Void> set(@RequestBody List<Integer> showIds) {
        recommendService.setRecommends(showIds);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{showId}")
    public ApiResponse<Void> remove(@PathVariable Integer showId) {
        recommendService.removeRecommend(showId);
        return ApiResponse.ok(null);
    }
}
