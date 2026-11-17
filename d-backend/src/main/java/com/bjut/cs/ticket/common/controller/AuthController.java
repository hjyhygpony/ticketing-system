package com.bjut.cs.ticket.common.controller;

import com.bjut.cs.ticket.common.ApiResponse;
import com.bjut.cs.ticket.common.config.JwtUtil;
import com.bjut.cs.ticket.entity.User;
import com.bjut.cs.ticket.service.IUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final IUserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String password = body.get("password");
        if (phone == null || phone.isBlank()) {
            return ApiResponse.fail("手机号不能为空");
        }
        if (password == null || password.isBlank()) {
            return ApiResponse.fail("密码不能为空");
        }
        User user = userService.lambdaQuery().eq(User::getPhone, phone).one();
        if (user == null) {
            return ApiResponse.fail("用户不存在");
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            return ApiResponse.fail("密码错误");
        }
        String token = jwtUtil.createToken(user.getUserId(), user.getPhone(), user.getRole());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("token", token);
        result.put("userId", user.getUserId());
        result.put("phone", user.getPhone());
        result.put("nickname", user.getNickname());
        result.put("role", user.getRole());
        result.put("isVerified", user.getIsVerified());
        result.put("status", user.getStatus());
        return ApiResponse.ok(result);
    }

    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String password = body.get("password");
        String nickname = body.get("nickname");
        if (phone == null || phone.isBlank()) {
            return ApiResponse.fail("手机号不能为空");
        }
        if (password == null || password.isBlank()) {
            return ApiResponse.fail("密码不能为空");
        }
        if (userService.lambdaQuery().eq(User::getPhone, phone).exists()) {
            return ApiResponse.fail("该手机号已注册，请直接登录");
        }
        User user = new User();
        user.setPhone(phone);
        user.setNickname(nickname != null && !nickname.isBlank() ? nickname : "用户" + phone.substring(Math.max(0, phone.length() - 4)));
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(0);
        user.setStatus(1);
        user.setIsVerified(0);
        user.setBalance(BigDecimal.ZERO);
        user.setRegisterTime(LocalDateTime.now());
        userService.save(user);

        String token = jwtUtil.createToken(user.getUserId(), user.getPhone(), user.getRole());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("token", token);
        result.put("userId", user.getUserId());
        result.put("phone", user.getPhone());
        result.put("nickname", user.getNickname());
        result.put("role", user.getRole());
        result.put("isVerified", user.getIsVerified());
        result.put("status", user.getStatus());
        return ApiResponse.ok(result);
    }
}
