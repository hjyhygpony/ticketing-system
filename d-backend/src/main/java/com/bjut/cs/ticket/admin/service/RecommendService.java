package com.bjut.cs.ticket.admin.service;

import com.bjut.cs.ticket.common.enums.AuditStatus;
import com.bjut.cs.ticket.entity.Show;
import com.bjut.cs.ticket.service.IShowService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RecommendService {

    private final IShowService showService;

    public List<Show> listRecommends() {
        return showService.lambdaQuery()
                .eq(Show::getIsRecommended, 1)
                .orderByAsc(Show::getRecommendOrder)
                .list();
    }

    @Transactional
    public void setRecommends(List<Integer> showIds) {
        if (showIds.size() > 5) throw new RuntimeException("推荐位上限为5个");

        showService.lambdaUpdate()
                .eq(Show::getIsRecommended, 1)
                .set(Show::getIsRecommended, 0)
                .set(Show::getRecommendOrder, null)
                .update();

        for (int i = 0; i < showIds.size(); i++) {
            Show show = showService.getById(showIds.get(i));
            if (show == null || show.getAuditStatus() != AuditStatus.APPROVED.getCode()) {
                throw new RuntimeException("演出「" + (show != null ? show.getTitle() : showIds.get(i)) + "」不存在或未上线");
            }
            show.setIsRecommended(1);
            show.setRecommendOrder(i + 1);
            showService.updateById(show);
        }
    }

    public void removeRecommend(Integer showId) {
        Show show = showService.getById(showId);
        if (show == null || show.getIsRecommended() != 1) throw new RuntimeException("该演出不在推荐位中");
        show.setIsRecommended(0);
        show.setRecommendOrder(null);
        showService.updateById(show);
    }
}
