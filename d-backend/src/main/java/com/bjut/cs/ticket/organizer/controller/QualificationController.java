package com.bjut.cs.ticket.organizer.controller;

import com.bjut.cs.ticket.common.ApiResponse;
import com.bjut.cs.ticket.common.context.UserContext;
import com.bjut.cs.ticket.entity.UserQualification;
import com.bjut.cs.ticket.organizer.dto.QualificationApplyDTO;
import com.bjut.cs.ticket.organizer.service.QualificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizer/qualification")
@RequiredArgsConstructor
public class QualificationController {

    private final QualificationService qualificationService;

    @PostMapping("/apply")
    public ApiResponse<Void> apply(@Valid @RequestBody QualificationApplyDTO dto) {
        Integer userId = UserContext.getUserId();
        qualificationService.apply(userId, dto);
        return ApiResponse.ok(null);
    }

    @GetMapping("/status")
    public ApiResponse<UserQualification> status() {
        Integer userId = UserContext.getUserId();
        UserQualification qual = qualificationService.getStatus(userId);
        return ApiResponse.ok(qual);
    }
}
