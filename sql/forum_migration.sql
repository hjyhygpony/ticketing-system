-- 在已有电子票务数据库中补充论坛标签表和演示标签数据
-- 如果你使用修改后的后端，后端启动时也会自动执行建表与演示数据补充；本文件可作为手动备用方案。

USE ruanjian;

CREATE TABLE IF NOT EXISTS `post_tag` (
  `tag_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '标签ID',
  `post_id` integer NOT NULL COMMENT '帖子ID',
  `tag` varchar(40) NOT NULL COMMENT '标签名',
  UNIQUE KEY `uk_post_tag` (`post_id`, `tag`),
  INDEX `idx_tag` (`tag`),
  CONSTRAINT `post_tag_to_post` FOREIGN KEY (`post_id`) REFERENCES `post` (`post_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `comment` MODIFY `content` varchar(500) NOT NULL COMMENT '评论内容（1-500字符）';
ALTER TABLE `report` MODIFY `reason` varchar(500) NOT NULL COMMENT '举报原因（≤500字）';

INSERT IGNORE INTO `post` (`user_id`, `show_id`, `title`, `content`, `audit_status`, `like_count`, `fav_count`, `comment_count`)
SELECT `user_id`, NULL, '开票前要不要先预约？', '我一般会先收藏演出，再关注开票时间。热门场次建议提前看好场次和票价区间，开票后少犹豫。', 1, 2, 1, 0
FROM `user` WHERE status = 1 ORDER BY user_id LIMIT 1;

INSERT IGNORE INTO `post_tag` (`post_id`, `tag`)
SELECT p.post_id, x.tag
FROM (SELECT '预约' AS tag UNION ALL SELECT '开票提醒' UNION ALL SELECT '抢票经验') x
JOIN `post` p ON p.title = '开票前要不要先预约？';
