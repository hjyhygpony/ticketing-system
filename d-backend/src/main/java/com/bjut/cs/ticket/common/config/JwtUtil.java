package com.bjut.cs.ticket.common.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtUtil {

    private final SecretKey key;

    public JwtUtil(@Value("${jwt.secret:change-this-secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** 生成与消费者端格式兼容的 JWT: {sub, phone, role, jti, exp, iat} */
    public String createToken(Integer userId, String phone, Integer role) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + 24 * 3600_000L); // 24h
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("phone", phone)
                .claim("role", role)
                .id(UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                .issuedAt(now)
                .expiration(exp)
                .signWith(key)
                .compact();
    }

    /** 校验并解析 token，无效时返回 null */
    public Claims parseToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception e) {
            return null;
        }
    }

    /** 从 token 中提取 userId */
    public Integer getUserId(Claims claims) {
        String sub = claims.getSubject();
        return sub != null ? Integer.parseInt(sub) : null;
    }
}

