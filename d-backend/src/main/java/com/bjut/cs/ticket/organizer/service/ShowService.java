package com.bjut.cs.ticket.organizer.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.bjut.cs.ticket.common.enums.AuditStatus;
import com.bjut.cs.ticket.entity.*;
import com.bjut.cs.ticket.organizer.dto.ShowCreateDTO;
import com.bjut.cs.ticket.organizer.dto.ShowCreateDTO.SessionDTO;
import com.bjut.cs.ticket.organizer.dto.ShowCreateDTO.ZoneDTO;
import com.bjut.cs.ticket.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ShowService {

    private final IShowService showService;
    private final ISessionService sessionService;
    private final IZoneService zoneService;
    private final ISeatService seatService;

    @Transactional(rollbackFor = Exception.class)
    public Show create(Integer userId, ShowCreateDTO dto, boolean submit) {
        Show show = new Show();
        show.setUserId(userId);
        show.setTitle(dto.getTitle());
        show.setCategory(dto.getCategory());
        show.setVenue(dto.getVenue());
        show.setDescription(dto.getDescription());
        show.setLineup(dto.getLineup());
        show.setNotice(dto.getNotice());
        show.setPosterUrl(dto.getPosterUrl());
        show.setAuditStatus(submit ? AuditStatus.PENDING.getCode() : AuditStatus.DRAFT.getCode());
        show.setCreatedTime(LocalDateTime.now());
        showService.save(show);

        int idx = 0;
        for (SessionDTO sDto : dto.getSessions()) {
            validateSessionTimes(sDto, ++idx);
            Session session = new Session();
            session.setShowId(show.getShowId());
            session.setStartTime(sDto.getStartTime());
            session.setEndTime(sDto.getEndTime());
            session.setTicketOpenTime(sDto.getTicketOpenTime());
            session.setRefundDeadline(sDto.getRefundDeadline());
            session.setMaxPerOrder(sDto.getMaxPerOrder());
            session.setAllowRefund(sDto.getAllowRefund());
            session.setRefundFeeRate(sDto.getRefundFeeRate());
            session.setWaitingEnabled(sDto.getWaitingEnabled());
            session.setSeatSelectEnabled(sDto.getSeatSelectEnabled());
            session.setSeatRows(sDto.getSeatRows());
            session.setSeatCols(sDto.getSeatCols());
            session.setConcurrentLimit(sDto.getConcurrentLimit());
            sessionService.save(session);

            for (ZoneDTO zDto : sDto.getZones()) {
                Zone zone = new Zone();
                zone.setSessionId(session.getSessionId());
                zone.setName(zDto.getName());
                zone.setPrice(zDto.getPrice());
                zone.setTotalSeats(zDto.getTotalSeats());
                zone.setRemainingCount(zDto.getTotalSeats());
                zoneService.save(zone);
            }

            // 选座场次自动生成座位明细
            if (sDto.getSeatSelectEnabled() != null && sDto.getSeatSelectEnabled() == 1) {
                List<Zone> zones = zoneService.lambdaQuery()
                    .eq(Zone::getSessionId, session.getSessionId())
                    .orderByAsc(Zone::getZoneId)
                    .list();
                generateSeats(session, zones);
            }
        }
        return show;
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(Integer showId, Integer userId, ShowCreateDTO dto) {
        Show show = showService.getById(showId);
        if (show == null || !show.getUserId().equals(userId)) {
            throw new RuntimeException("演出不存在或无权编辑");
        }
        if (show.getAuditStatus() != AuditStatus.DRAFT.getCode()
                && show.getAuditStatus() != AuditStatus.REJECTED.getCode()) {
            throw new RuntimeException("仅草稿或已驳回状态可编辑");
        }

        show.setTitle(dto.getTitle());
        show.setCategory(dto.getCategory());
        show.setVenue(dto.getVenue());
        show.setDescription(dto.getDescription());
        show.setLineup(dto.getLineup());
        show.setNotice(dto.getNotice());
        show.setPosterUrl(dto.getPosterUrl());
        showService.updateById(show);

        // 删除旧场次和分区
        List<Session> oldSessions = sessionService.lambdaQuery()
                .eq(Session::getShowId, showId).list();
        for (Session s : oldSessions) {
            seatService.remove(new LambdaQueryWrapper<Seat>().eq(Seat::getSessionId, s.getSessionId()));
            zoneService.remove(new LambdaQueryWrapper<Zone>().eq(Zone::getSessionId, s.getSessionId()));
        }
        sessionService.remove(new LambdaQueryWrapper<Session>().eq(Session::getShowId, showId));

        // 创建新场次和分区
        int idx = 0;
        for (SessionDTO sDto : dto.getSessions()) {
            validateSessionTimes(sDto, ++idx);
            Session session = new Session();
            session.setShowId(showId);
            session.setStartTime(sDto.getStartTime());
            session.setEndTime(sDto.getEndTime());
            session.setTicketOpenTime(sDto.getTicketOpenTime());
            session.setRefundDeadline(sDto.getRefundDeadline());
            session.setMaxPerOrder(sDto.getMaxPerOrder());
            session.setAllowRefund(sDto.getAllowRefund());
            session.setRefundFeeRate(sDto.getRefundFeeRate());
            session.setWaitingEnabled(sDto.getWaitingEnabled());
            session.setSeatSelectEnabled(sDto.getSeatSelectEnabled());
            session.setSeatRows(sDto.getSeatRows());
            session.setSeatCols(sDto.getSeatCols());
            session.setConcurrentLimit(sDto.getConcurrentLimit());
            sessionService.save(session);

            for (ZoneDTO zDto : sDto.getZones()) {
                Zone zone = new Zone();
                zone.setSessionId(session.getSessionId());
                zone.setName(zDto.getName());
                zone.setPrice(zDto.getPrice());
                zone.setTotalSeats(zDto.getTotalSeats());
                zone.setRemainingCount(zDto.getTotalSeats());
                zoneService.save(zone);
            }

            // 选座场次自动生成座位明细（先删旧的再生成）
            seatService.remove(new LambdaQueryWrapper<Seat>().eq(Seat::getSessionId, session.getSessionId()));
            if (sDto.getSeatSelectEnabled() != null && sDto.getSeatSelectEnabled() == 1) {
                List<Zone> zones = zoneService.lambdaQuery()
                    .eq(Zone::getSessionId, session.getSessionId())
                    .orderByAsc(Zone::getZoneId)
                    .list();
                generateSeats(session, zones);
            }
        }
    }

    public void submit(Integer showId, Integer userId) {
        Show show = showService.getById(showId);
        if (show == null || !show.getUserId().equals(userId)) {
            throw new RuntimeException("演出不存在或无权操作");
        }
        if (show.getAuditStatus() != AuditStatus.DRAFT.getCode()
                && show.getAuditStatus() != AuditStatus.REJECTED.getCode()) {
            throw new RuntimeException("仅草稿或已驳回状态可提交审核");
        }
        show.setAuditStatus(AuditStatus.PENDING.getCode());
        showService.updateById(show);
    }

    public IPage<Show> listMy(Integer userId, Integer page, Integer size, Integer auditStatus) {
        LambdaQueryWrapper<Show> wrapper = new LambdaQueryWrapper<Show>()
                .eq(Show::getUserId, userId)
                .eq(auditStatus != null, Show::getAuditStatus, auditStatus)
                .orderByDesc(Show::getCreatedTime);
        return showService.page(new Page<>(page, size), wrapper);
    }



    private void validateSessionTimes(SessionDTO sDto, int idx) {
        String prefix = "场次" + idx + "：";
        if (!sDto.getStartTime().isBefore(sDto.getEndTime())) {
            throw new RuntimeException(prefix + "开场时间必须早于结束时间");
        }
        if (!sDto.getTicketOpenTime().isBefore(sDto.getStartTime())) {
            throw new RuntimeException(prefix + "开票时间必须早于开场时间");
        }
        if (sDto.getRefundDeadline() != null) {
            if (sDto.getRefundDeadline().isBefore(sDto.getTicketOpenTime())) {
                throw new RuntimeException(prefix + "退票截止时间不能早于开票时间");
            }
            if (sDto.getRefundDeadline().isAfter(sDto.getStartTime())) {
                throw new RuntimeException(prefix + "退票截止时间不能晚于开场时间");
            }
        }
    }




    private void generateSeats(Session session, List<Zone> zones) {
        int rows = session.getSeatRows() != null ? session.getSeatRows() : 0;
        int cols = session.getSeatCols() != null ? session.getSeatCols() : 0;
        int totalSlots = rows * cols;

        int totalNeeded = zones.stream().mapToInt(Zone::getTotalSeats).sum();
        if (totalNeeded > totalSlots) {
            throw new RuntimeException(
                String.format("座位格子不够：分区总座位数 %d > 场次座位 %d行 × %d列 = %d",
                    totalNeeded, rows, cols, totalSlots));
        }

        List<Seat> seats = new ArrayList<>();
        int zoneIdx = 0;
        int zoneRemaining = zones.get(0).getTotalSeats();
        Zone currentZone = zones.get(0);

        for (int r = 1; r <= rows; r++) {
            for (int c = 1; c <= cols; c++) {
                if (zoneIdx >= zones.size()) break;
                while (zoneRemaining == 0 && zoneIdx < zones.size() - 1) {
                    zoneIdx++;
                    currentZone = zones.get(zoneIdx);
                    zoneRemaining = currentZone.getTotalSeats();
                }
                if (zoneRemaining == 0) break;

                Seat seat = new Seat();
                seat.setSessionId(session.getSessionId());
                seat.setZoneId(currentZone.getZoneId());
                seat.setRowNo(r);
                seat.setColNo(c);
                seat.setSeatLabel(currentZone.getName() + r + "排" + c + "座");
                seat.setStatus(0);
                seats.add(seat);
                zoneRemaining--;
            }
        }
        seatService.saveBatch(seats);
    }

    public Map<String, Object> detail(Integer showId) {
        Show show = showService.getById(showId);
        if (show == null) {
            throw new RuntimeException("演出不存在");
        }
        List<Session> sessions = sessionService.lambdaQuery()
                .eq(Session::getShowId, showId)
                .orderByAsc(Session::getStartTime)
                .list();

        List<Map<String, Object>> sessionList = new ArrayList<>();
        for (Session s : sessions) {
            List<Zone> zones = zoneService.lambdaQuery()
                    .eq(Zone::getSessionId, s.getSessionId())
                    .list();
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
}
