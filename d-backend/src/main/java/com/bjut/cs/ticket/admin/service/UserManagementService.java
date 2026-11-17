package com.bjut.cs.ticket.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.bjut.cs.ticket.entity.*;
import com.bjut.cs.ticket.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class UserManagementService {

    private final IUserService userService;
    private final IOrderInfoService orderInfoService;
    private final IPostService postService;
    private final IReportService reportService;
    private final IUserQualificationService qualificationService;
    private final IAuditLogService auditLogService;
    private final IMessageService messageService;

    private static final int BAN_STATUS = 0;
    private static final int NORMAL_STATUS = 1;
    private static final int MUTED_STATUS = 2;

    public IPage<User> searchUsers(String keyword, Integer page, Integer size) {
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w
                    .like(User::getPhone, keyword)
                    .or().like(User::getRealName, keyword)
                    .or().eq(User::getUserId, tryParseInt(keyword)));
        }
        wrapper.orderByDesc(User::getRegisterTime);
        return userService.page(new Page<>(page, size), wrapper);
    }

    public Map<String, Object> getUserDetail(Integer userId) {
        User user = userService.getById(userId);
        if (user == null) throw new RuntimeException("用户不存在");

        List<OrderInfo> orders = orderInfoService.lambdaQuery()
                .eq(OrderInfo::getUserId, userId)
                .orderByDesc(OrderInfo::getCreatedTime)
                .last("LIMIT 20").list();

        List<Post> posts = postService.lambdaQuery()
                .eq(Post::getUserId, userId)
                .orderByDesc(Post::getPostTime)
                .last("LIMIT 20").list();

        List<Report> filedReports = reportService.lambdaQuery()
                .eq(Report::getUserId, userId)
                .orderByDesc(Report::getReportTime)
                .last("LIMIT 20").list();

        List<Report> receivedReports;
        if (posts.isEmpty()) {
            receivedReports = List.of();
        } else {
            receivedReports = reportService.lambdaQuery()
                    .in(Report::getPostId, posts.stream().map(Post::getPostId).toList())
                    .orderByDesc(Report::getReportTime)
                    .last("LIMIT 30").list();
        }

        UserQualification qual = qualificationService.lambdaQuery()
                .eq(UserQualification::getUserId, userId)
                .orderByDesc(UserQualification::getSubmittedAt)
                .last("LIMIT 1").one();

        List<AuditLog> violationLogs = auditLogService.lambdaQuery()
                .eq(AuditLog::getTargetType, "user")
                .eq(AuditLog::getTargetId, userId)
                .orderByDesc(AuditLog::getCreatedAt).list();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("user", user);
        result.put("orders", orders);
        result.put("posts", posts);
        result.put("filedReports", filedReports);
        result.put("receivedReports", receivedReports);
        result.put("qualification", qual);
        result.put("violationLogs", violationLogs);
        return result;
    }

    @Transactional
    public void warnUser(Integer userId, Integer adminId, String reason) {
        User user = userService.getById(userId);
        if (user == null) throw new RuntimeException("用户不存在");

        // 从 audit_log 统计历史警告次数
        long recentWarnings = auditLogService.lambdaQuery()
                .eq(AuditLog::getTargetType, "user")
                .eq(AuditLog::getTargetId, userId)
                .eq(AuditLog::getAction, "warn")
                .count();

        if (recentWarnings >= 2) {
            user.setStatus(MUTED_STATUS);
            userService.updateById(user);
            writeLogAndNotify(userId, adminId, "auto-mute",
                    "累计3次警告，自动禁言7天。原因：" + reason);
        } else {
            writeLogAndNotify(userId, adminId, "warn",
                    "第" + (recentWarnings + 1) + "次警告。原因：" + reason);
        }
    }

    @Transactional
    public void muteUser(Integer userId, Integer adminId, Integer durationDays, String reason) {
        User user = userService.getById(userId);
        if (user == null) throw new RuntimeException("用户不存在");
        user.setStatus(MUTED_STATUS);
        userService.updateById(user);

        writeLogAndNotify(userId, adminId, "mute",
                "禁言" + durationDays + "天。原因：" + reason);
    }

    @Transactional
    public void banUser(Integer userId, Integer adminId, String reason) {
        User user = userService.getById(userId);
        if (user == null) throw new RuntimeException("用户不存在");
        user.setStatus(BAN_STATUS);
        userService.updateById(user);

        writeLogAndNotify(userId, adminId, "ban", "账号已被封禁。原因：" + reason);
    }

    private void writeLogAndNotify(Integer targetUserId, Integer adminId, String action, String detail) {
        AuditLog log = new AuditLog();
        log.setAdminId(adminId);
        log.setTargetType("user");
        log.setTargetId(targetUserId);
        log.setAction(action);
        log.setResult(action.equals("ban") ? 1 : (action.equals("warn") ? 3 : 2));
        log.setRemark(detail);
        log.setCreatedAt(LocalDateTime.now());
        auditLogService.save(log);

        Message msg = new Message();
        msg.setUserId(targetUserId);
        msg.setTitle("账号处理通知");
        msg.setContent("您的账号受到处理：" + detail);
        msg.setIsRead(0);
        msg.setCreatedAt(LocalDateTime.now());
        messageService.save(msg);
    }

    private int tryParseInt(String s) {
        try { return Integer.parseInt(s); } catch (NumberFormatException e) { return -1; }
    }
}
