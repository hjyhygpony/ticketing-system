CREATE TABLE `user` (
  `user_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
  `phone` varchar(255) UNIQUE NOT NULL COMMENT '手机号',
  `password_hash` varchar(255) NOT NULL COMMENT '密码哈希',
  `nickname` varchar(255) COMMENT '用户昵称',
  `real_name` varchar(255) COMMENT '实名姓名（加密存储）',
  `idcard` varchar(255) UNIQUE COMMENT '身份证号（加密），一证一号',
  `is_verified` integer NOT NULL DEFAULT 0 COMMENT '是否已实名认证：0否 1是',
  `role` integer NOT NULL DEFAULT 0 COMMENT '角色：0消费者 1演出方 2管理员',
  `balance` decimal NOT NULL DEFAULT 0 COMMENT '账户余额（虚拟）',
  `status` integer NOT NULL DEFAULT 1 COMMENT '账号状态：0封禁 1正常 2禁言',
  `register_time` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '注册时间'
);

CREATE TABLE `user_qualification` (
  `qual_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '资质记录ID',
  `user_id` integer NOT NULL COMMENT '关联用户',
  `company_name` varchar(255) NOT NULL COMMENT '公司名称',
  `credit_code` varchar(255) UNIQUE NOT NULL COMMENT '统一社会信用代码',
  `license_url` varchar(255) NOT NULL COMMENT '营业执照URL',
  `contact_name` varchar(255) NOT NULL COMMENT '联系人',
  `contact_phone` varchar(255) NOT NULL COMMENT '联系电话',
  `audit_status` integer NOT NULL DEFAULT 0 COMMENT '审核状态：0待审核 1通过 2驳回',
  `audit_remark` varchar(255) COMMENT '审核备注',
  `submitted_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '提交时间',
  `audited_at` timestamp COMMENT '审核时间'
);

CREATE TABLE `show` (
  `show_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '演出ID',
  `user_id` integer NOT NULL COMMENT '演出方用户ID',
  `title` varchar(255) NOT NULL COMMENT '演出名称',
  `category` varchar(255) NOT NULL COMMENT '类型：演唱会/话剧/音乐节/音乐会/舞蹈/体育赛事/展览/其他',
  `venue` varchar(255) NOT NULL COMMENT '场馆名称与地址',
  `description` text COMMENT '演出简介',
  `lineup` text COMMENT '演出阵容',
  `notice` text COMMENT '购票须知',
  `poster_url` varchar(255) COMMENT '海报图片URL',
  `audit_status` integer NOT NULL DEFAULT 0 COMMENT '审核状态：0待审 1上线 2驳回 3下架 4草稿',
  `is_recommended` integer NOT NULL DEFAULT 0 COMMENT '是否首页推荐',
  `recommend_order` integer COMMENT '推荐位排序',
  `fav_count` integer NOT NULL DEFAULT 0 COMMENT '收藏数（冗余）',
  `created_time` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '创建时间'
);

CREATE TABLE `session` (
  `session_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '场次ID',
  `show_id` integer NOT NULL COMMENT '所属演出',
  `start_time` timestamp NOT NULL COMMENT '演出开始时间',
  `end_time` timestamp NOT NULL COMMENT '演出结束时间',
  `ticket_open_time` timestamp NOT NULL COMMENT '开票时间，≤start_time',
  `is_hot` integer NOT NULL DEFAULT 0 COMMENT '是否触发排队：0否 1是',
  `concurrent_limit` integer NOT NULL DEFAULT 0 COMMENT '虚拟排队同时放行人数：0表示不限制',
  `max_per_order` integer NOT NULL DEFAULT 4 COMMENT '单次最大购票数（≥1）',
  `allow_refund` integer NOT NULL DEFAULT 1 COMMENT '是否允许退票：0否 1是',
  `refund_fee_rate` decimal NOT NULL DEFAULT 0 COMMENT '退票手续费比例（%），0~100',
  `refund_deadline` timestamp COMMENT '退票截止时间（默认start_time前24h）',
  `seat_select_enabled` integer NOT NULL DEFAULT 1 COMMENT '是否需要选座：0按分区数量购票 1手动选座购票',
  `seat_rows` integer COMMENT '座位行数（仅seat_select_enabled=1时有效）',
  `seat_cols` integer COMMENT '座位列数（仅seat_select_enabled=1时有效）',
  `waiting_enabled` integer NOT NULL DEFAULT 0 COMMENT '是否开启候补：0否 1是',
  `reservation_count` integer NOT NULL DEFAULT 0 COMMENT '预约人数'
);

CREATE TABLE `zone` (
  `zone_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '分区ID',
  `session_id` integer NOT NULL COMMENT '所属场次',
  `name` varchar(255) NOT NULL COMMENT '分区名称（如A区、VIP区）',
  `price` decimal(10,2) NOT NULL COMMENT '票价（>0）',
  `total_seats` integer NOT NULL COMMENT '总座位数（≥1）',
  `remaining_count` integer NOT NULL COMMENT '剩余可售数量（≥0）'
);

CREATE TABLE `seat` (
  `seat_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '座位ID',
  `session_id` integer NOT NULL COMMENT '所属场次',
  `zone_id` integer NOT NULL COMMENT '所属分区/票档',
  `row_no` integer NOT NULL COMMENT '排号',
  `col_no` integer NOT NULL COMMENT '座号',
  `seat_label` varchar(255) NOT NULL COMMENT '座位显示名称',
  `status` integer NOT NULL DEFAULT 0 COMMENT '0可售 1锁定中 2已售',
  `lock_time` timestamp NULL,
  `lock_expire_time` timestamp NULL,
  `lock_user_id` integer NULL COMMENT '当前锁座用户',
  `lock_token` varchar(64) NULL COMMENT '锁座凭证'
);

CREATE TABLE `order_info` (
  `order_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '订单ID',
  `user_id` integer NOT NULL COMMENT '买家用户ID',
  `session_id` integer NOT NULL COMMENT '场次ID',
  `zone_id` integer NOT NULL COMMENT '分区ID',
  `ticket_count` integer NOT NULL COMMENT '购票张数（≥1）',
  `total_amount` decimal(10,2) NOT NULL COMMENT '订单总金额（>0）',
  `status` integer NOT NULL DEFAULT 0 COMMENT '状态：0待付 1已付 2已退款 3已取消 4已完成',
  `paid_time` timestamp COMMENT '支付时间',
  `pay_method` varchar(20) NULL COMMENT '支付方式：wechat/alipay/bank',
  `expire_time` timestamp NULL COMMENT '待支付过期时间',
  `created_time` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '下单时间'
);

CREATE TABLE `order_seat` (
  `order_id` integer NOT NULL,
  `seat_id` integer NOT NULL,
  PRIMARY KEY (`order_id`, `seat_id`)
);

CREATE TABLE `ticket` (
  `ticket_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '电子票ID',
  `order_id` integer NOT NULL COMMENT '所属订单',
  `seat_id` integer NULL COMMENT '对应具体座位；按分区数量购票时为空',
  `qr_code` varchar(255) NOT NULL COMMENT '二维码（含防伪签名）',
  `status` integer NOT NULL DEFAULT 1 COMMENT '状态：1有效 2已退票',
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '生成时间'
);

CREATE TABLE `refund` (
  `refund_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '退款ID',
  `order_id` integer NOT NULL COMMENT '原订单ID',
  `refund_amount` decimal NOT NULL COMMENT '退款金额（>0）',
  `fee_amount` decimal NOT NULL DEFAULT 0 COMMENT '退款手续费',
  `status` integer NOT NULL DEFAULT 0 COMMENT '状态：0处理中 1已完成 2失败',
  `reason` varchar(255) COMMENT '退款原因',
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '申请时间',
  `completed_at` timestamp COMMENT '完成时间'
);

CREATE TABLE `reservation` (
  `reservation_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '预约ID',
  `user_id` integer NOT NULL COMMENT '用户ID',
  `session_id` integer NOT NULL COMMENT '场次ID',
  `zone_id` integer COMMENT '意向分区',
  `status` integer NOT NULL DEFAULT 1 COMMENT '状态：1有效 2已失效',
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '预约时间'
);

CREATE TABLE `waiting_list` (
  `waiting_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '候补记录ID',
  `user_id` integer NOT NULL COMMENT '用户ID',
  `session_id` integer NOT NULL COMMENT '场次ID',
  `zone_id` integer NOT NULL COMMENT '分区ID',
  `queue_order` integer NOT NULL COMMENT '候补排队序号（≥1）',
  `status` integer NOT NULL DEFAULT 0 COMMENT '状态：0等待中 1已通知 2已购票 3已跳过',
  `notify_time` timestamp COMMENT '通知时间',
  `expire_time` timestamp COMMENT '通知过期时间（notify_time+15分钟）',
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '加入时间'
);

CREATE TABLE `queue` (
  `queue_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '排队记录ID',
  `user_id` integer NOT NULL COMMENT '排队用户ID',
  `session_id` integer NOT NULL COMMENT '目标场次ID',
  `queue_no` integer NOT NULL COMMENT '排队序号（严格递增）',
  `status` integer NOT NULL DEFAULT 0 COMMENT '状态：0排队中 1已放行 2已过期 3已取消 4已完成',
  `join_time` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '进入排队时间',
  `release_time` timestamp COMMENT '放行时间',
  `expire_time` timestamp COMMENT '放行后过期时间'
);

CREATE TABLE `favorite_show` (
  `user_id` integer COMMENT '用户ID',
  `show_id` integer COMMENT '演出ID',
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '收藏时间',
  PRIMARY KEY (`user_id`, `show_id`)
);

CREATE TABLE `post` (
  `post_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '帖子ID',
  `user_id` integer NOT NULL COMMENT '发帖用户ID',
  `show_id` integer COMMENT '关联演出ID（可选）',
  `title` varchar(255) NOT NULL COMMENT '帖子标题（2-100字符）',
  `content` text NOT NULL COMMENT '帖子正文（1-10000字符）',
  `audit_status` integer NOT NULL DEFAULT 0 COMMENT '审核状态：0待审 1通过 2屏蔽',
  `like_count` integer NOT NULL DEFAULT 0 COMMENT '点赞数（冗余）',
  `fav_count` integer NOT NULL DEFAULT 0 COMMENT '收藏数（冗余）',
  `comment_count` integer NOT NULL DEFAULT 0 COMMENT '回复数（冗余）',
  `post_time` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '发帖时间'
);

CREATE TABLE `post_tag` (
  `tag_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '标签ID',
  `post_id` integer NOT NULL COMMENT '帖子ID',
  `tag` varchar(40) NOT NULL COMMENT '标签名',
  UNIQUE KEY `uk_post_tag` (`post_id`, `tag`),
  INDEX `idx_tag` (`tag`)
);

CREATE TABLE `comment` (
  `comment_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '评论ID',
  `post_id` integer NOT NULL COMMENT '所属帖子ID',
  `user_id` integer NOT NULL COMMENT '评论用户ID',
  `content` varchar(255) NOT NULL COMMENT '评论内容（1-500字符）',
  `comment_time` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '评论时间'
);

CREATE TABLE `like` (
  `user_id` integer COMMENT '用户ID',
  `post_id` integer COMMENT '帖子ID',
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '点赞时间',
  PRIMARY KEY (`user_id`, `post_id`)
);

CREATE TABLE `favorite_post` (
  `user_id` integer COMMENT '用户ID',
  `post_id` integer COMMENT '帖子ID',
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '收藏时间',
  PRIMARY KEY (`user_id`, `post_id`)
);

CREATE TABLE `report` (
  `report_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '举报ID',
  `user_id` integer NOT NULL COMMENT '举报人ID',
  `post_id` integer NOT NULL COMMENT '被举报帖子ID',
  `reason` varchar(255) NOT NULL COMMENT '举报原因（预设类型+补充说明≤200字）',
  `status` integer NOT NULL DEFAULT 0 COMMENT '状态：0待处理 1已处理 2已驳回',
  `report_time` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '举报时间'
);

CREATE TABLE `message` (
  `message_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '消息ID',
  `user_id` integer NOT NULL COMMENT '接收用户ID',
  `title` varchar(255) NOT NULL COMMENT '消息标题',
  `content` text NOT NULL COMMENT '消息内容',
  `is_read` integer NOT NULL DEFAULT 0 COMMENT '是否已读：0未读 1已读',
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '发送时间'
);

CREATE TABLE `audit_log` (
  `log_id` integer PRIMARY KEY AUTO_INCREMENT COMMENT '日志ID',
  `admin_id` integer NOT NULL COMMENT '操作管理员ID',
  `target_type` varchar(255) NOT NULL COMMENT '目标类型（user/show/post/refund/qualification）',
  `target_id` integer NOT NULL COMMENT '目标记录ID',
  `action` varchar(255) NOT NULL COMMENT '操作类型（approve/reject/block/suspend等）',
  `result` integer NOT NULL COMMENT '处理结果代码',
  `remark` varchar(255) COMMENT '操作备注/原因',
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP) COMMENT '操作时间'
);

CREATE UNIQUE INDEX `reservation_index_0` ON `reservation` (`user_id`, `session_id`);

CREATE UNIQUE INDEX `seat_unique_index_0` ON `seat` (`session_id`, `zone_id`, `row_no`, `col_no`);
CREATE INDEX `seat_index_0` ON `seat` (`session_id`, `zone_id`, `status`);
CREATE INDEX `seat_lock_index_0` ON `seat` (`lock_token`);

ALTER TABLE `user_qualification` ADD CONSTRAINT `qual_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `show` ADD CONSTRAINT `show_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `session` ADD CONSTRAINT `session_to_show` FOREIGN KEY (`show_id`) REFERENCES `show` (`show_id`);

ALTER TABLE `zone` ADD CONSTRAINT `zone_to_session` FOREIGN KEY (`session_id`) REFERENCES `session` (`session_id`);

ALTER TABLE `seat` ADD CONSTRAINT `seat_to_session` FOREIGN KEY (`session_id`) REFERENCES `session` (`session_id`);
ALTER TABLE `seat` ADD CONSTRAINT `seat_to_zone` FOREIGN KEY (`zone_id`) REFERENCES `zone` (`zone_id`);
ALTER TABLE `seat` ADD CONSTRAINT `seat_lock_to_user` FOREIGN KEY (`lock_user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `order_info` ADD CONSTRAINT `order_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `order_info` ADD CONSTRAINT `order_to_session` FOREIGN KEY (`session_id`) REFERENCES `session` (`session_id`);

ALTER TABLE `order_info` ADD CONSTRAINT `order_to_zone` FOREIGN KEY (`zone_id`) REFERENCES `zone` (`zone_id`);

ALTER TABLE `order_seat` ADD CONSTRAINT `order_seat_to_order` FOREIGN KEY (`order_id`) REFERENCES `order_info` (`order_id`);
ALTER TABLE `order_seat` ADD CONSTRAINT `order_seat_to_seat` FOREIGN KEY (`seat_id`) REFERENCES `seat` (`seat_id`);

ALTER TABLE `ticket` ADD CONSTRAINT `ticket_to_order` FOREIGN KEY (`order_id`) REFERENCES `order_info` (`order_id`);

ALTER TABLE `ticket` ADD CONSTRAINT `ticket_to_seat` FOREIGN KEY (`seat_id`) REFERENCES `seat` (`seat_id`);

ALTER TABLE `refund` ADD CONSTRAINT `refund_to_order` FOREIGN KEY (`order_id`) REFERENCES `order_info` (`order_id`);

ALTER TABLE `reservation` ADD CONSTRAINT `reservation_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `reservation` ADD CONSTRAINT `reservation_to_session` FOREIGN KEY (`session_id`) REFERENCES `session` (`session_id`);

ALTER TABLE `reservation` ADD CONSTRAINT `reservation_to_zone` FOREIGN KEY (`zone_id`) REFERENCES `zone` (`zone_id`);

ALTER TABLE `waiting_list` ADD CONSTRAINT `waiting_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `waiting_list` ADD CONSTRAINT `waiting_to_session` FOREIGN KEY (`session_id`) REFERENCES `session` (`session_id`);

ALTER TABLE `waiting_list` ADD CONSTRAINT `waiting_to_zone` FOREIGN KEY (`zone_id`) REFERENCES `zone` (`zone_id`);

ALTER TABLE `queue` ADD CONSTRAINT `queue_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `queue` ADD CONSTRAINT `queue_to_session` FOREIGN KEY (`session_id`) REFERENCES `session` (`session_id`);

ALTER TABLE `favorite_show` ADD CONSTRAINT `fav_show_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `favorite_show` ADD CONSTRAINT `fav_show_to_show` FOREIGN KEY (`show_id`) REFERENCES `show` (`show_id`);

ALTER TABLE `post` ADD CONSTRAINT `post_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `post` ADD CONSTRAINT `post_to_show` FOREIGN KEY (`show_id`) REFERENCES `show` (`show_id`);

ALTER TABLE `post_tag` ADD CONSTRAINT `post_tag_to_post` FOREIGN KEY (`post_id`) REFERENCES `post` (`post_id`) ON DELETE CASCADE;

ALTER TABLE `comment` ADD CONSTRAINT `comment_to_post` FOREIGN KEY (`post_id`) REFERENCES `post` (`post_id`);

ALTER TABLE `comment` ADD CONSTRAINT `comment_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `like` ADD CONSTRAINT `like_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `like` ADD CONSTRAINT `like_to_post` FOREIGN KEY (`post_id`) REFERENCES `post` (`post_id`);

ALTER TABLE `favorite_post` ADD CONSTRAINT `fav_post_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `favorite_post` ADD CONSTRAINT `fav_post_to_post` FOREIGN KEY (`post_id`) REFERENCES `post` (`post_id`);

ALTER TABLE `report` ADD CONSTRAINT `report_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `report` ADD CONSTRAINT `report_to_post` FOREIGN KEY (`post_id`) REFERENCES `post` (`post_id`);

ALTER TABLE `message` ADD CONSTRAINT `message_to_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);

ALTER TABLE `audit_log` ADD CONSTRAINT `audit_to_admin` FOREIGN KEY (`admin_id`) REFERENCES `user` (`user_id`);

-- Disable foreign key checks for INSERT
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO `user` (`user_id`, `phone`, `password_hash`, `real_name`, `idcard`, `is_verified`, `role`, `balance`, `status`, `register_time`)
VALUES
  (1, '13800000001', 'demo-salt-2026$d146afb686d0d975d6c060ead03431040a33c6021460322d3a65240a4e9750cb', '张三', '110101199001011234', 1, 0, 5000, 1, '2026-06-01T10:00:00'),
  (2, '13800000002', '<hash>', '李四', '110101199002022345', 1, 1, 0, 1, '2026-06-02T11:00:00'),
  (3, '13800000003', '<hash>', NULL, NULL, 0, 2, 0, 1, '2026-06-03T09:00:00');
INSERT INTO `user_qualification` (`qual_id`, `user_id`, `company_name`, `credit_code`, `license_url`, `contact_name`, `contact_phone`, `audit_status`, `submitted_at`)
VALUES
  (1, 2, '星光演艺文化有限公司', '91110101MA01ABCD12', '/uploads/license_001.pdf', '李四', '13800000002', 1, '2026-06-02T12:00:00');
INSERT INTO `show` (`show_id`, `user_id`, `title`, `category`, `venue`, `description`, `lineup`, `notice`, `poster_url`, `audit_status`, `is_recommended`, `fav_count`, `created_time`)
VALUES
  (1, 2, '周杰伦2026巡回演唱会-北京站', '演唱会', '国家体育场（鸟巢）', '华语乐坛天王周杰伦2026年巡演北京站', '周杰伦、伴奏乐队', '请提前60分钟入场', '/posters/show_001.jpg', 1, 1, 1280, '2026-06-05T14:00:00');
INSERT INTO `session` (`session_id`, `show_id`, `start_time`, `end_time`, `ticket_open_time`, `is_hot`, `concurrent_limit`, `max_per_order`, `allow_refund`, `refund_fee_rate`, `waiting_enabled`, `reservation_count`)
VALUES
  (1, 1, '2026-08-15T19:30:00', '2026-08-15T22:00:00', '2026-07-01T12:00:00', 1, 0, 4, 1, 10, 1, 5600);
INSERT INTO `zone` (`zone_id`, `session_id`, `name`, `price`, `total_seats`, `remaining_count`)
VALUES
  (1, 1, 'VIP内场', 1680, 6, 6),
  (2, 1, 'A区看台', 880, 8, 6),
  (3, 1, 'B区看台', 480, 8, 8);
INSERT INTO `seat` (`seat_id`, `session_id`, `zone_id`, `row_no`, `col_no`, `seat_label`, `status`) VALUES
  (1,1,1,1,1,'VIP内场1排1座',0),(2,1,1,1,2,'VIP内场1排2座',0),
  (3,1,1,1,3,'VIP内场1排3座',0),(4,1,1,2,1,'VIP内场2排1座',0),
  (5,1,1,2,2,'VIP内场2排2座',0),(6,1,1,2,3,'VIP内场2排3座',0),
  (7,1,2,3,1,'A区3排1座',0),(8,1,2,3,2,'A区3排2座',0),
  (9,1,2,3,3,'A区3排3座',0),(10,1,2,3,4,'A区3排4座',0),
  (11,1,2,3,5,'A区3排5座',2),(12,1,2,3,6,'A区3排6座',2),
  (13,1,2,3,7,'A区3排7座',0),(14,1,2,3,8,'A区3排8座',0),
  (15,1,3,5,1,'B区5排1座',0),(16,1,3,5,2,'B区5排2座',0),
  (17,1,3,5,3,'B区5排3座',0),(18,1,3,5,4,'B区5排4座',0),
  (19,1,3,5,5,'B区5排5座',0),(20,1,3,5,6,'B区5排6座',0),
  (21,1,3,5,7,'B区5排7座',0),(22,1,3,5,8,'B区5排8座',0);
INSERT INTO `order_info` (`order_id`, `user_id`, `session_id`, `zone_id`, `ticket_count`, `total_amount`, `status`, `paid_time`, `pay_method`, `created_time`)
VALUES
  (1, 1, 1, 2, 2, 1760, 1, '2026-07-15T12:05:00', 'wechat', '2026-07-15T12:04:30');
INSERT INTO `order_seat` (`order_id`, `seat_id`) VALUES (1,11),(1,12);
INSERT INTO `ticket` (`ticket_id`, `order_id`, `seat_id`, `qr_code`, `status`, `created_at`)
VALUES
  (1, 1, 11, '<qr_signature_a3f5>', 1, '2026-07-15T12:05:05'),
  (2, 1, 12, '<qr_signature_a3f6>', 1, '2026-07-15T12:05:05');
INSERT INTO `reservation` (`reservation_id`, `user_id`, `session_id`, `zone_id`, `status`, `created_at`)
VALUES
  (1, 3, 1, 1, 1, '2026-07-10T09:30:00');
INSERT INTO `waiting_list` (`waiting_id`, `user_id`, `session_id`, `zone_id`, `queue_order`, `status`, `created_at`)
VALUES
  (1, 3, 1, 2, 1, 2, '2026-07-15T12:10:00');
INSERT INTO `post` (`post_id`, `user_id`, `show_id`, `title`, `content`, `audit_status`, `like_count`, `fav_count`, `comment_count`, `post_time`)
VALUES
  (1, 1, 1, '鸟巢演唱会观演攻略', '给大家分享一些去鸟巢看演唱会的经验……', 1, 42, 15, 8, '2026-06-10T16:30:00'),
  (2, 3, NULL, '新来的，大家多多关照', '第一次用这个平台，感觉很不错！', 1, 5, 2, 3, '2026-06-12T10:00:00');
INSERT INTO `post_tag` (`post_id`, `tag`)
VALUES
  (1, '观演攻略'),
  (1, '演唱会'),
  (1, '鸟巢'),
  (2, '新人报道'),
  (2, '论坛建议');
INSERT INTO `comment` (`comment_id`, `post_id`, `user_id`, `content`, `comment_time`)
VALUES
  (1, 1, 2, '很详细的攻略，感谢分享！', '2026-06-10T17:00:00'),
  (2, 1, 3, '请问停车方便吗？', '2026-06-10T18:30:00');
INSERT INTO `like` (`user_id`, `post_id`, `created_at`)
VALUES
  (1, 2, '2026-06-12T11:00:00'),
  (2, 1, '2026-06-10T19:00:00');
INSERT INTO `favorite_post` (`user_id`, `post_id`, `created_at`)
VALUES
  (1, 1, '2026-06-10T20:00:00');
INSERT INTO `report` (`report_id`, `user_id`, `post_id`, `reason`, `status`, `report_time`)
VALUES
  (1, 1, 2, '疑似广告信息', 0, '2026-06-12T12:00:00');
INSERT INTO `message` (`message_id`, `user_id`, `title`, `content`, `is_read`, `created_at`)
VALUES
  (1, 1, '购票成功通知', '您已成功购买"周杰伦2026巡回演唱会-北京站"A区看台门票2张，请查看电子票。', 1, '2026-07-15T12:05:10'),
  (2, 3, '开票提醒', '您预约的"周杰伦2026巡回演唱会-北京站"将于2026-07-15 12:00开票，请准时抢购。', 0, '2026-07-15T11:45:00');
INSERT INTO `audit_log` (`log_id`, `admin_id`, `target_type`, `target_id`, `action`, `result`, `remark`, `created_at`)
VALUES
  (1, 3, 'show', 1, 'approve', 1, '内容合规，审核通过', '2026-06-05T15:00:00'),
  (2, 3, 'qualification', 1, 'approve', 1, '资质材料齐全', '2026-06-02T14:00:00');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
