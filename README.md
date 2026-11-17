# Ticketing System

一个前后端分离的电子票务系统课程项目，包含用户端、演出方后台和运营管理后台。

## 功能

- 用户注册、登录、实名认证
- 演出列表、搜索、详情和排期
- 场次、区域、座位和锁座
- 下单、支付、退票和候补
- 订单、优惠和交易流水
- 演出方发布与管理
- 运营审核、用户和订单管理
- 论坛、评论、点赞、收藏和消息
- 演出海报和用户上传文件
- JWT 鉴权、密码哈希和接口权限控制

## 架构

```text
ticketing-system/
├─ backend/       # Python FastAPI - 用户/演出/交易主服务
├─ d-backend/     # Java Spring Boot - D 端运营管理后台
├─ frontend/      # 原生 HTML/CSS/JavaScript 前端
├─ sql/           # MySQL schema、论坛迁移和 DBML
└─ README.md
```

### Python 主服务

- FastAPI
- MySQL Connector
- PBKDF2 密码哈希
- JWT
- REST API

### Java D 端后台

- Java 21
- Spring Boot 3
- MyBatis-Plus
- MySQL
- JWT
- BCrypt

### 前端

- 原生 HTML/CSS/JavaScript
- ES Modules
- 无前端构建步骤，可以直接用静态服务器预览

## 数据库

创建 MySQL 数据库并导入：

```powershell
mysql -u root -p -e "CREATE DATABASE ticket DEFAULT CHARACTER SET utf8mb4;"
mysql -u root -p --default-character-set=utf8mb4 ticket < sql/mysql.sql
```

`sql/mysql.sql` 中包含课程演示用的合成数据。不要直接用于生产环境。

## 配置

### Python 后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

编辑 `backend/.env`：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_NAME=ticket
JWT_SECRET=请替换为随机字符串
JOB_SECRET=请替换为随机字符串
FERNET_KEY=
TOKEN_EXPIRE_HOURS=24
UPLOAD_DIR=uploads
```

启动：

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 --reload
```

### Java D 端后台

`d-backend/src/main/resources/application.yml` 使用环境变量：

```text
DB_URL
DB_USERNAME
DB_PASSWORD
JWT_SECRET
SERVER_PORT
```

启动：

```powershell
cd d-backend
.\mvnw.cmd spring-boot:run
```

默认端口为 `8081`。

### 前端

```powershell
python -m http.server 5500 -d frontend
```

打开 <http://127.0.0.1:5500>。

默认 API 地址为 `http://127.0.0.1:8001/api`，前端也支持通过：

```javascript
localStorage.setItem("ticket_api_base", "http://127.0.0.1:8001/api");
```

进行覆盖。

## 安全说明

- 真实数据库密码、JWT Secret、`.env` 和上传文件都不在仓库中。
- 仓库只保留环境变量模板。
- 前端图片是自动生成的占位海报，不包含演唱会或影视宣传物料的版权素材。
- 课程演示数据中的姓名、电话和身份证号均为合成数据。
- 上线前需要补充 HTTPS、限流、CSRF/CORS 策略、对象存储和更严格的权限审计。
