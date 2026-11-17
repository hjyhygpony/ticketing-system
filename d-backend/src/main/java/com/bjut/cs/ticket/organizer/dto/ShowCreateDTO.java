package com.bjut.cs.ticket.organizer.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class ShowCreateDTO {

    @NotBlank(message = "演出名称不能为空")
    private String title;

    @NotBlank(message = "演出类型不能为空")
    private String category;

    @NotBlank(message = "场馆不能为空")
    private String venue;

    private String description;
    private String lineup;
    private String notice;
    private String posterUrl;

    @NotEmpty(message = "至少需要一个场次")
    @Valid
    private List<SessionDTO> sessions;

    @Data
    public static class SessionDTO {

        @NotNull(message = "开始时间不能为空")
        private LocalDateTime startTime;

        @NotNull(message = "结束时间不能为空")
        private LocalDateTime endTime;

        @NotNull(message = "开票时间不能为空")
        private LocalDateTime ticketOpenTime;

        private LocalDateTime refundDeadline;

        @Min(value = 1, message = "单次最大购票数至少为1")
        private Integer maxPerOrder = 5;

        private Integer allowRefund = 1;

        @DecimalMax(value = "100", message = "退票手续费率不能超过100%")
        private BigDecimal refundFeeRate = BigDecimal.ZERO;

        private Integer waitingEnabled = 0;

        private Integer seatSelectEnabled = 1;

        private Integer seatRows;

        private Integer seatCols;

        private Integer concurrentLimit = 0;

        @NotEmpty(message = "每个场次至少需要一个分区")
        @Valid
        private List<ZoneDTO> zones;
    }

    @Data
    public static class ZoneDTO {

        @NotBlank(message = "分区名称不能为空")
        private String name;

        @NotNull(message = "票价不能为空")
        @DecimalMin(value = "0.01", message = "票价必须大于0")
        private BigDecimal price;

        @Min(value = 1, message = "总座位数至少为1")
        private Integer totalSeats;
    }
}
