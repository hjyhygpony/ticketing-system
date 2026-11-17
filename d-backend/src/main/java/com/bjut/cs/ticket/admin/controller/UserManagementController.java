package com.bjut.cs.ticket.admin.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.bjut.cs.ticket.admin.service.UserManagementService;
import com.bjut.cs.ticket.common.ApiResponse;
import com.bjut.cs.ticket.common.context.UserContext;
import com.bjut.cs.ticket.entity.User;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class UserManagementController {

    private final UserManagementService userManagementService;

    @GetMapping
    public ApiResponse<IPage<User>> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ApiResponse.ok(userManagementService.searchUsers(keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> detail(@PathVariable Integer id) {
        return ApiResponse.ok(userManagementService.getUserDetail(id));
    }

    @PutMapping("/{id}/warn")
    public ApiResponse<Void> warn(@PathVariable Integer id, @RequestBody ViolationDTO dto) {
        userManagementService.warnUser(id, UserContext.getUserId(), dto.getReason());
        return ApiResponse.ok(null);
    }

    @PutMapping("/{id}/mute")
    public ApiResponse<Void> mute(@PathVariable Integer id, @RequestBody MuteDTO dto) {
        userManagementService.muteUser(id, UserContext.getUserId(), dto.getDurationDays(), dto.getReason());
        return ApiResponse.ok(null);
    }

    @PutMapping("/{id}/ban")
    public ApiResponse<Void> ban(@PathVariable Integer id, @RequestBody ViolationDTO dto) {
        userManagementService.banUser(id, UserContext.getUserId(), dto.getReason());
        return ApiResponse.ok(null);
    }

    @Data
    public static class ViolationDTO { private String reason; }

    @Data
    public static class MuteDTO {
        private Integer durationDays;
        private String reason;
    }
}
