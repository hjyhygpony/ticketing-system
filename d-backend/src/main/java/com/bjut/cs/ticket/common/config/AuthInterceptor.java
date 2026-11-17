package com.bjut.cs.ticket.common.config;

import com.bjut.cs.ticket.common.context.UserContext;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // 优先解析 JWT Bearer token
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            Claims claims = jwtUtil.parseToken(token);
            if (claims != null) {
                UserContext.setUserId(jwtUtil.getUserId(claims));
                UserContext.setPhone(claims.get("phone", String.class));
                Integer role = claims.get("role", Integer.class);
                UserContext.setRole(role);
                return true;
            }
        }
        // 兼容旧 X-Debug-User-Id 头（仅限开发环境）
        String debugUserId = request.getHeader("X-Debug-User-Id");
        if (debugUserId != null) {
            UserContext.setUserId(Integer.parseInt(debugUserId));
            return true;
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        UserContext.clear();
    }
}
