package com.bjut.cs.ticket.organizer.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.bjut.cs.ticket.common.ApiResponse;
import com.bjut.cs.ticket.common.context.UserContext;
import com.bjut.cs.ticket.entity.Show;
import com.bjut.cs.ticket.organizer.dto.ShowCreateDTO;
import com.bjut.cs.ticket.organizer.service.ShowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/organizer/show")
@RequiredArgsConstructor
public class ShowController {

    private final ShowService showService;

    @PostMapping("/create")
    public ApiResponse<Show> create(@Valid @RequestBody ShowCreateDTO dto) {
        Show show = showService.create(UserContext.getUserId(), dto, false);
        return ApiResponse.ok(show);
    }

    @PostMapping("/create-and-submit")
    public ApiResponse<Show> createAndSubmit(@Valid @RequestBody ShowCreateDTO dto) {
        Show show = showService.create(UserContext.getUserId(), dto, true);
        return ApiResponse.ok(show);
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Integer id, @Valid @RequestBody ShowCreateDTO dto) {
        showService.update(id, UserContext.getUserId(), dto);
        return ApiResponse.ok(null);
    }

    @PutMapping("/{id}/submit")
    public ApiResponse<Void> submit(@PathVariable Integer id) {
        showService.submit(id, UserContext.getUserId());
        return ApiResponse.ok(null);
    }

    @GetMapping("/my")
    public ApiResponse<IPage<Show>> listMy(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Integer auditStatus) {
        IPage<Show> result = showService.listMy(UserContext.getUserId(), page, size, auditStatus);
        return ApiResponse.ok(result);
    }

    @GetMapping("/{id}/detail")
    public ApiResponse<Map<String, Object>> detail(@PathVariable Integer id) {
        return ApiResponse.ok(showService.detail(id));
    }
}
