package com.bjut.cs.ticket.admin.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.bjut.cs.ticket.admin.dto.AuditOverviewVO;
import com.bjut.cs.ticket.admin.dto.PostAuditItem;
import com.bjut.cs.ticket.common.enums.AuditStatus;
import com.bjut.cs.ticket.common.enums.UserRole;
import com.bjut.cs.ticket.entity.*;
import com.bjut.cs.ticket.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final IShowService showService;
    private final IPostService postService;
    private final IReportService reportService;
    private final IUserQualificationService qualificationService;
    private final IUserService userService;
    private final IAuditLogService auditLogService;
    private final IMessageService messageService;
    private final ISessionService sessionService;
    private final IZoneService zoneService;

    public AuditOverviewVO getOverview() {
        long pendingShows = showService.lambdaQuery()
                .eq(Show::getAuditStatus, AuditStatus.PENDING.getCode()).count();
        long pendingPosts = postService.lambdaQuery()
                .eq(Post::getAuditStatus, AuditStatus.PENDING.getCode()).count();
        long pendingQualifications = qualificationService.lambdaQuery()
                .eq(UserQualification::getAuditStatus, AuditStatus.PENDING.getCode()).count();
        return new AuditOverviewVO(pendingShows, pendingPosts, pendingQualifications);
    }

    // ========== 演出审核 UC-19/20 ==========

    public IPage<Show> listShows(Integer page, Integer size, Integer auditStatus) {
        return showService.lambdaQuery()
                .eq(auditStatus != null, Show::getAuditStatus, auditStatus)
                .ne(auditStatus == null, Show::getAuditStatus, AuditStatus.DRAFT.getCode())
                .orderByAsc(Show::getAuditStatus)
                .orderByDesc(Show::getCreatedTime)
                .page(new Page<>(page, size));
    }

    public Map<String, Object> getShowDetail(Integer showId) {
        Show show = showService.getById(showId);
        if (show == null) throw new RuntimeException("演出不存在");

        List<Session> sessions = sessionService.lambdaQuery()
                .eq(Session::getShowId, showId).orderByAsc(Session::getStartTime).list();
        List<Map<String, Object>> sessionList = new ArrayList<>();
        for (Session s : sessions) {
            List<Zone> zones = zoneService.lambdaQuery()
                    .eq(Zone::getSessionId, s.getSessionId()).list();
            Map<String, Object> sm = new LinkedHashMap<>();
            sm.put("session", s);
            sm.put("zones", zones);
            sessionList.add(sm);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("show", show);
        result.put("sessions", sessionList);
        return result;
    }

    @Transactional
    public void approveShow(Integer showId, Integer adminId, String remark) {
        Show show = showService.getById(showId);
        if (show == null || show.getAuditStatus() != AuditStatus.PENDING.getCode()) {
            throw new RuntimeException("演出不存在或状态不是待审核");
        }
        show.setAuditStatus(AuditStatus.APPROVED.getCode());
        showService.updateById(show);

        writeAuditLog(adminId, "show", showId, "approve", 1, remark);
        sendMessage(show.getUserId(), "演出审核通过", "您的演出「" + show.getTitle() + "」已通过审核，已上线展示。");
    }

    @Transactional
    public void rejectShow(Integer showId, Integer adminId, String remark) {
        Show show = showService.getById(showId);
        if (show == null || show.getAuditStatus() != AuditStatus.PENDING.getCode()) {
            throw new RuntimeException("演出不存在或状态不是待审核");
        }
        show.setAuditStatus(AuditStatus.REJECTED.getCode());
        showService.updateById(show);

        writeAuditLog(adminId, "show", showId, "reject", 2, remark);
        sendMessage(show.getUserId(), "演出审核驳回", "您的演出「" + show.getTitle() + "」已被驳回。原因：" + remark);
    }

    @Transactional
    public void offlineShow(Integer showId, Integer adminId, String remark) {
        Show show = showService.getById(showId);
        if (show == null || show.getAuditStatus() != AuditStatus.APPROVED.getCode()) {
            throw new RuntimeException("演出不存在或状态不是已上线");
        }
        show.setAuditStatus(AuditStatus.OFFLINE.getCode());
        show.setIsRecommended(0);
        show.setRecommendOrder(null);
        showService.updateById(show);

        writeAuditLog(adminId, "show", showId, "offline", 3, remark);
        sendMessage(show.getUserId(), "演出已下架", "您的演出「" + show.getTitle() + "」已被下架。原因：" + remark);
    }

    // ========== 帖子审核 UC-21 ==========

    public IPage<PostAuditItem> listPosts(Integer page, Integer size, Integer auditStatus) {
        Page<Post> postPage = postService.lambdaQuery()
                .eq(auditStatus != null, Post::getAuditStatus, auditStatus)
                .orderByAsc(Post::getAuditStatus)
                .orderByDesc(Post::getPostTime)
                .page(new Page<>(page, size));

        List<PostAuditItem> items = new ArrayList<>();
        for (Post p : postPage.getRecords()) {
            long reportCount = reportService.lambdaQuery()
                    .eq(Report::getPostId, p.getPostId())
                    .eq(Report::getStatus, 0).count();
            items.add(new PostAuditItem(p.getPostId(), p.getTitle(), p.getUserId(),
                    p.getAuditStatus(), (int) reportCount, p.getPostTime()));
        }

        IPage<PostAuditItem> result = new Page<>(postPage.getCurrent(), postPage.getSize(), postPage.getTotal());
        result.setRecords(items);
        return result;
    }

    @Transactional
    public void approvePost(Integer postId, Integer adminId) {
        Post post = postService.getById(postId);
        if (post == null || post.getAuditStatus() != AuditStatus.PENDING.getCode()) {
            throw new RuntimeException("帖子不存在或状态不是待审核");
        }
        post.setAuditStatus(AuditStatus.APPROVED.getCode());
        postService.updateById(post);

        // 驳回所有待处理举报
        reportService.lambdaUpdate()
                .eq(Report::getPostId, postId)
                .eq(Report::getStatus, 0)
                .set(Report::getStatus, 2)
                .update();

        writeAuditLog(adminId, "post", postId, "approve", 1, null);
    }

    @Transactional
    public void blockPost(Integer postId, Integer adminId) {
        Post post = postService.getById(postId);
        if (post == null) throw new RuntimeException("帖子不存在");
        post.setAuditStatus(AuditStatus.REJECTED.getCode());
        postService.updateById(post);

        reportService.lambdaUpdate()
                .eq(Report::getPostId, postId).eq(Report::getStatus, 0)
                .set(Report::getStatus, 1).update();

        writeAuditLog(adminId, "post", postId, "block", 2, null);
        sendMessage(post.getUserId(), "帖子被屏蔽", "您的帖子「" + post.getTitle() + "」因被多次举报已被屏蔽。");
    }

    @Transactional
    public void unblockPost(Integer postId, Integer adminId) {
        Post post = postService.getById(postId);
        if (post == null) throw new RuntimeException("帖子不存在");

        AuditLog latest = auditLogService.lambdaQuery()
                .eq(AuditLog::getTargetType, "post")
                .eq(AuditLog::getTargetId, postId)
                .eq(AuditLog::getAction, "block")
                .orderByDesc(AuditLog::getCreatedAt)
                .last("LIMIT 1").one();

        if (latest == null) throw new RuntimeException("未找到屏蔽记录");
        if (ChronoUnit.HOURS.between(latest.getCreatedAt(), LocalDateTime.now()) > 24) {
            throw new RuntimeException("超过24小时，无法撤销屏蔽");
        }

        post.setAuditStatus(AuditStatus.APPROVED.getCode());
        postService.updateById(post);
        writeAuditLog(adminId, "post", postId, "unblock", 1, null);
    }

    // ========== 入驻审核 UC-24 ==========

    public IPage<UserQualification> listQualifications(Integer page, Integer size, Integer auditStatus) {
        return qualificationService.lambdaQuery()
                .eq(auditStatus != null, UserQualification::getAuditStatus, auditStatus)
                .orderByAsc(UserQualification::getAuditStatus)
                .orderByDesc(UserQualification::getSubmittedAt)
                .page(new Page<>(page, size));
    }

    @Transactional
    public void approveQualification(Integer qualId, Integer adminId) {
        UserQualification qual = qualificationService.getById(qualId);
        if (qual == null || qual.getAuditStatus() != AuditStatus.PENDING.getCode()) {
            throw new RuntimeException("资质申请不存在或状态不是待审核");
        }
        qual.setAuditStatus(AuditStatus.APPROVED.getCode());
        qual.setAuditedAt(LocalDateTime.now());
        qualificationService.updateById(qual);

        User user = userService.getById(qual.getUserId());
        if (user != null) {
            user.setRole(UserRole.ORGANIZER.getCode());
            userService.updateById(user);
        }

        writeAuditLog(adminId, "qualification", qualId, "approve", 1, null);
        sendMessage(qual.getUserId(), "入驻申请通过", "恭喜，您的演出方入驻申请已通过审核！您现在可以发布演出了。");
    }

    @Transactional
    public void rejectQualification(Integer qualId, Integer adminId, String remark) {
        UserQualification qual = qualificationService.getById(qualId);
        if (qual == null || qual.getAuditStatus() != AuditStatus.PENDING.getCode()) {
            throw new RuntimeException("资质申请不存在或状态不是待审核");
        }
        qual.setAuditStatus(AuditStatus.REJECTED.getCode());
        qual.setAuditRemark(remark);
        qual.setAuditedAt(LocalDateTime.now());
        qualificationService.updateById(qual);

        writeAuditLog(adminId, "qualification", qualId, "reject", 2, remark);
        sendMessage(qual.getUserId(), "入驻申请未通过", "您的演出方入驻申请未通过审核。原因：" + remark);
    }

    // ========== 内部方法 ==========

    private void writeAuditLog(Integer adminId, String targetType, Integer targetId,
                               String action, Integer result, String remark) {
        AuditLog log = new AuditLog();
        log.setAdminId(adminId);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setAction(action);
        log.setResult(result);
        log.setRemark(remark);
        log.setCreatedAt(LocalDateTime.now());
        auditLogService.save(log);
    }

    private void sendMessage(Integer userId, String title, String content) {
        Message msg = new Message();
        msg.setUserId(userId);
        msg.setTitle(title);
        msg.setContent(content);
        msg.setIsRead(0);
        msg.setCreatedAt(LocalDateTime.now());
        messageService.save(msg);
    }
}
