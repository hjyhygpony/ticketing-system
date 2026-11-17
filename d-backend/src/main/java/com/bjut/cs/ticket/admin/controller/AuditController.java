package com.bjut.cs.ticket.admin.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.bjut.cs.ticket.admin.dto.AuditOperateDTO;
import com.bjut.cs.ticket.admin.dto.AuditOverviewVO;
import com.bjut.cs.ticket.admin.dto.PostAuditItem;
import com.bjut.cs.ticket.admin.service.AuditService;
import com.bjut.cs.ticket.common.ApiResponse;
import com.bjut.cs.ticket.common.context.UserContext;
import com.bjut.cs.ticket.entity.Show;
import com.bjut.cs.ticket.entity.UserQualification;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @GetMapping("/overview")
    public ApiResponse<AuditOverviewVO> overview() {
        return ApiResponse.ok(auditService.getOverview());
    }

    // ---- 演出审核 UC-19/20 ----

    @GetMapping("/shows")
    public ApiResponse<IPage<Show>> listShows(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Integer auditStatus) {
        return ApiResponse.ok(auditService.listShows(page, size, auditStatus));
    }

    @GetMapping("/shows/{id}")
    public ApiResponse<Map<String, Object>> showDetail(@PathVariable Integer id) {
        return ApiResponse.ok(auditService.getShowDetail(id));
    }

    @PutMapping("/shows/{id}/approve")
    public ApiResponse<Void> approveShow(@PathVariable Integer id, @RequestBody(required = false) AuditOperateDTO dto) {
        auditService.approveShow(id, UserContext.getUserId(), dto != null ? dto.getRemark() : null);
        return ApiResponse.ok(null);
    }

    @PutMapping("/shows/{id}/reject")
    public ApiResponse<Void> rejectShow(@PathVariable Integer id, @RequestBody AuditOperateDTO dto) {
        auditService.rejectShow(id, UserContext.getUserId(), dto != null ? dto.getRemark() : null);
        return ApiResponse.ok(null);
    }

    @PutMapping("/shows/{id}/offline")
    public ApiResponse<Void> offlineShow(@PathVariable Integer id, @RequestBody(required = false) AuditOperateDTO dto) {
        auditService.offlineShow(id, UserContext.getUserId(), dto != null ? dto.getRemark() : null);
        return ApiResponse.ok(null);
    }

    // ---- 帖子审核 UC-21 ----

    @GetMapping("/posts")
    public ApiResponse<IPage<PostAuditItem>> listPosts(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Integer auditStatus) {
        return ApiResponse.ok(auditService.listPosts(page, size, auditStatus));
    }

    @PutMapping("/posts/{id}/approve")
    public ApiResponse<Void> approvePost(@PathVariable Integer id) {
        auditService.approvePost(id, UserContext.getUserId());
        return ApiResponse.ok(null);
    }

    @PutMapping("/posts/{id}/block")
    public ApiResponse<Void> blockPost(@PathVariable Integer id) {
        auditService.blockPost(id, UserContext.getUserId());
        return ApiResponse.ok(null);
    }

    @PutMapping("/posts/{id}/unblock")
    public ApiResponse<Void> unblockPost(@PathVariable Integer id) {
        auditService.unblockPost(id, UserContext.getUserId());
        return ApiResponse.ok(null);
    }

    // ---- 入驻审核 UC-24 ----

    @GetMapping("/qualifications")
    public ApiResponse<IPage<UserQualification>> listQualifications(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Integer auditStatus) {
        return ApiResponse.ok(auditService.listQualifications(page, size, auditStatus));
    }

    @PutMapping("/qualifications/{id}/approve")
    public ApiResponse<Void> approveQualification(@PathVariable Integer id) {
        auditService.approveQualification(id, UserContext.getUserId());
        return ApiResponse.ok(null);
    }

    @PutMapping("/qualifications/{id}/reject")
    public ApiResponse<Void> rejectQualification(@PathVariable Integer id, @RequestBody AuditOperateDTO dto) {
        auditService.rejectQualification(id, UserContext.getUserId(), dto != null ? dto.getRemark() : null);
        return ApiResponse.ok(null);
    }
}
