# Stock Pulse — 技术方案

## 1. 整体架构

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Frontend   │────▶│   Backend API    │────▶│   Data Sources     │
│  (Next.js    │◀────│   (Python/Fast   │◀────│   (SEC EDGAR,      │
│   SSR/SSG)   │     │    API)          │     │    Earnings Cal,   │
└─────────────┘     └──────┬───────────┘     │    Finnhub, etc)   │
                           │                 └───────────────────┘
                    ┌──────▼───────┐
                    │  PostgreSQL   │
                    │  + Redis      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │                         │
       ┌──────▼───────┐         ┌──────▼───────┐
       │   LLM Layer   │         │     FCM       │
       │  (AI 解读生成) │         │  (Web Push)   │
       └──────────────┘         └──────────────┘
```

### 技术栈选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端 | **Next.js 14+ (App Router)** | SSR/SSG 对 SEO 友好、React 生态成熟、API Routes 可选 |
| 后端 API | **Python + FastAPI** | 数据处理生态好、与 SEC EDGAR / yfinance 等兼容 |
| 数据库 | **PostgreSQL** | 生产级可靠性、JSON 字段支持、全文搜索能力 |
| 缓存 | **Redis** | 热数据缓存（事件列表、每日摘要）、定时任务锁、rate limit |
| Web Push | **Firebase Cloud Messaging (FCM)** | 免费、稳定、跨平台（浏览器 + 移动端） |
| LLM | **通过 HTTP 调用（OpenClaw 环境）** | 复用现有模型配置，不硬编码 API key |
| 定时任务 | **APScheduler / Celery Beat** | 定时抓取数据源、生成 AI 摘要、清理过期数据 |
| 部署 | **VPS + Docker Compose** | PostgreSQL + Redis + 后端 + 前端统一编排 |

---

## 2. 数据源

### 2.1 SEC EDGAR

美国证券交易委员会的公开数据系统，包含：

- **Form 4（内部人交易）**：高管 / 董事的买卖记录
- **Form 8-K（重大事件）**：公司重大变更、并购、管理层变动等
- **10-Q / 10-K（财报原文）**：季报 / 年报全文

**获取方式：**

- EDGAR FULL-TEXT SEARCH API：`https://efts.sec.gov/LATEST/search-index?q=...`
- EDGAR Company Filings API：`https://data.sec.gov/submissions/CIK{cik}.json`
- RSS Feeds：按公司 CIK 订阅最新 filing
- 注意：SEC 要求 User-Agent 包含联系邮箱，rate limit 约 10 req/s

**数据处理流程：**

```
SEC EDGAR API → 解析 filing 类型/日期/内容 → 标准化为 StockEvent → 存入 PostgreSQL
```

### 2.2 Earnings Calendar

**数据来源（按优先级）：**

1. **yfinance**：免费，可获取下次财报日期、历史 EPS
2. **Finnhub Earnings Calendar API**：免费 tier 可用，数据结构更规范
3. **Alpha Vantage**：备选

**获取内容：**

- 未来财报日期（盘前/盘后）
- 预期 EPS / 营收（consensus）
- 实际 EPS / 营收（财报公布后）
- 历史财报表现（过去 4–8 个季度的 beat/miss 记录）

### 2.3 宏观经济日历

**数据来源：**

- **Finnhub Economic Calendar**（免费 tier）
- **手动维护的固定日程表**（FOMC 日程、CPI/NFP 发布日已知）

**覆盖的宏观事件：**

| 事件 | 频率 | 重要性 |
|------|------|--------|
| FOMC 利率决议 | 8 次/年 | 🔴 高 |
| CPI（消费者价格指数）| 月度 | 🔴 高 |
| 非农就业 (NFP) | 月度 | 🔴 高 |
| GDP | 季度 | 🔴 高 |
| PPI（生产者价格指数）| 月度 | 🟡 中 |
| 初请失业金 | 周度 | 🟡 中 |
| PMI | 月度 | 🟡 中 |
| 消费者信心指数 | 月度 | 🟢 低 |

---

## 3. 后端设计

### 3.1 目录结构

```
stock-pulse/
├── README.md
├── docs/
│   └── TECHNICAL.md
├── backend/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口
│   ├── config.py               # 配置管理（环境变量 / pydantic-settings）
│   ├── models/
│   │   ├── __init__.py
│   │   ├── portfolio.py        # 持仓数据模型
│   │   ├── event.py            # 事件数据模型
│   │   └── user.py             # 用户模型（MVP 简化版）
│   ├── services/
│   │   ├── __init__.py
│   │   ├── edgar.py            # SEC EDGAR 数据抓取与解析
│   │   ├── earnings.py         # 财报数据获取与处理
│   │   ├── macro_calendar.py   # 宏观经济日历
│   │   ├── event_aggregator.py # 事件聚合（合并多数据源 → 统一事件流）
│   │   └── ai_explain.py       # AI 解读生成
│   ├── api/
│   │   ├── __init__.py
│   │   ├── portfolio.py        # 持仓管理 API
│   │   ├── events.py           # 事件查询 API
│   │   ├── daily_summary.py    # 每日摘要 API
│   │   ├── macro.py            # 宏观日历 API
│   │   └── push.py             # FCM 推送注册/管理 API
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── scheduler.py        # 定时任务调度器
│   │   ├── fetch_earnings.py   # 定时抓取财报数据
│   │   ├── fetch_edgar.py      # 定时抓取 SEC EDGAR
│   │   ├── fetch_macro.py      # 定时抓取宏观日历
│   │   └── generate_summaries.py # 定时生成 AI 摘要
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py         # PostgreSQL 连接（SQLAlchemy async）
│   │   ├── redis.py            # Redis 连接
│   │   └── migrations/         # Alembic 数据库迁移
│   └── push/
│       ├── __init__.py
│       └── fcm.py              # Firebase Cloud Messaging 推送
├── frontend/                   # Next.js 项目
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

### 3.2 数据模型（PostgreSQL）

#### users

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token         VARCHAR(64) UNIQUE NOT NULL,   -- MVP: 前端生成的随机 token
    fcm_token     TEXT,                          -- FCM 推送 token
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);
```

#### portfolios

```sql
CREATE TABLE portfolios (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    ticker     VARCHAR(16) NOT NULL,
    notes      TEXT,
    added_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, ticker)
);
CREATE INDEX idx_portfolios_user ON portfolios(user_id);
CREATE INDEX idx_portfolios_ticker ON portfolios(ticker);
```

#### events

```sql
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker          VARCHAR(16),                -- NULL for macro events
    event_type      VARCHAR(32) NOT NULL,       -- 'earnings', 'macro', 'insider', 'analyst', 'filing'
    event_date      TIMESTAMPTZ NOT NULL,
    title           VARCHAR(512) NOT NULL,
    description     TEXT,
    importance      VARCHAR(16) DEFAULT 'medium', -- 'high', 'medium', 'low'
    status          VARCHAR(16) DEFAULT 'upcoming', -- 'upcoming', 'completed'

    -- Earnings fields
    eps_estimate    DECIMAL(10,4),
    eps_actual      DECIMAL(10,4),
    revenue_estimate BIGINT,
    revenue_actual   BIGINT,
    report_time     VARCHAR(16),               -- 'BMO' (before market open) / 'AMC' (after market close)

    -- Macro fields
    macro_event_name VARCHAR(64),
    consensus       VARCHAR(64),
    actual_value    VARCHAR(64),
    previous_value  VARCHAR(64),

    -- SEC EDGAR fields
    filing_type     VARCHAR(16),               -- '4', '8-K', '10-Q', '10-K'
    filing_url      TEXT,

    -- AI
    ai_summary      TEXT,                      -- 1-3 句简短解读
    ai_detail       TEXT,                      -- 详细解读（事件详情页）

    -- Meta
    source          VARCHAR(64),               -- 'yfinance', 'finnhub', 'edgar', 'manual'
    raw_data        JSONB,                     -- 原始数据存档
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_events_ticker ON events(ticker);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_status ON events(status);
```

### 3.3 Redis 缓存策略

| Key 模式 | 内容 | TTL |
|----------|------|-----|
| `events:upcoming:{user_id}` | 用户持仓相关的未来 7 天事件 JSON | 30 min |
| `events:today` | 今日全部事件 | 15 min |
| `daily_summary:{user_id}` | 每日摘要（含 AI 解读）| 1 hour |
| `macro:calendar:{month}` | 月度宏观日历 | 6 hours |
| `stock:events:{ticker}` | 个股事件时间线 | 1 hour |
| `task:lock:{task_name}` | 定时任务分布式锁 | 任务超时时间 |

### 3.4 API 设计

#### 持仓管理

```
GET    /api/portfolio              # 获取用户持仓列表
POST   /api/portfolio              # 添加持仓 { "ticker": "AAPL" }
DELETE /api/portfolio/:ticker      # 删除持仓
```

#### 事件查询

```
GET    /api/events/upcoming        # 未来 7 天与持仓相关的事件
GET    /api/events/today           # 今日事件（预览）
GET    /api/events/yesterday       # 昨日事件（复盘）
GET    /api/events/stock/:ticker   # 某只股票的所有事件
GET    /api/events/:id             # 单个事件详情（含 AI 解读）
```

#### 宏观日历

```
GET    /api/macro/calendar?month=2026-03
```

#### 每日摘要

```
GET    /api/daily-summary          # 今日摘要
```

#### Push 推送

```
POST   /api/push/register          # 注册 FCM token { "fcm_token": "..." }
DELETE /api/push/unregister        # 取消推送
```

### 3.5 用户身份（MVP 简化方案）

与之前方案一致：

- 前端首次访问生成随机 `user_token`，存 localStorage
- 后端自动创建对应 user 记录
- 所有 API 通过 `Authorization: Bearer <user_token>` 识别用户
- Phase 2 再加邮箱注册 / OAuth

---

## 4. AI 解读方案

与之前方案一致，三个层级：

| 层级 | 用途 | 长度 | 生成时机 |
|------|------|------|----------|
| 一句话摘要 | 事件列表 | 1 句 | 数据刷新时批量生成 |
| 简短解读 | 每日摘要 | 1–3 句 | 数据刷新时批量生成 |
| 详细解读 | 事件详情页 | 3–5 段 | 用户点击时按需生成（缓存到 DB） |

LLM 调用方式：

- 环境变量 `STOCK_PULSE_LLM_ENDPOINT` 指向本地 HTTP 服务
- 请求：`POST { "prompt": "..." }`
- 响应：`{ "text": "..." }`
- 复用 OpenClaw 环境的模型

---

## 5. Web Push 方案（FCM）

### 5.1 架构

```
[用户浏览器] ── 注册 Service Worker ── 获取 FCM Token ──▶ [后端存储 token]
                                                              │
[定时任务：每日摘要生成完毕] ──▶ [后端调用 FCM API] ──▶ [推送到浏览器]
```

### 5.2 推送场景

| 场景 | 时机 | 内容 |
|------|------|------|
| 每日盘前摘要 | 美东 8:30 AM（UTC 13:30） | 「今天你的持仓有 X 个事件需要关注」 |
| 高重要性事件提醒 | 事件前 1 小时 | 「AAPL 今晚盘后发布财报」 |
| 盘后复盘 | 美东 8:00 PM（UTC 01:00） | 「昨夜 X 个持仓事件已出结果」 |

### 5.3 实现要点

- 前端：注册 Service Worker + 请求通知权限 + 获取 FCM token
- 后端：用 `firebase-admin` SDK 发送推送
- Firebase 项目需要：创建 Firebase 项目 → 下载 service account key → 配置到后端环境

---

## 6. 前端设计

### 6.1 技术选型

- **Next.js 14+**（App Router）
- **Tailwind CSS** + **shadcn/ui**
- **React Query (TanStack Query)**：API 数据获取 + 缓存
- **next-pwa**：Service Worker + FCM 集成

### 6.2 页面路由

```
/                          # 首页（未登录：介绍 / 已登录：仪表盘）
/today                     # 今日事件页（预览 + 复盘 tab）
/stock/[ticker]            # 个股事件页（SSG，SEO 友好）
/macro                     # 宏观日历页（SSG）
/event/[id]                # 事件详情页
/settings                  # 持仓管理
```

### 6.3 SEO 策略

- `/stock/[ticker]` 和 `/macro` 使用 **SSG (Static Site Generation)** + **ISR (Incremental Static Regeneration)**
- 自动生成 sitemap.xml
- 结构化数据（JSON-LD）标注财报日期等信息
- 页面 title/description 模板化：
  - `NVDA Earnings Date & Events | Stock Pulse`
  - `US Macro Economic Calendar - FOMC, CPI, NFP | Stock Pulse`

---

## 7. 部署方案

### Docker Compose

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: stock_pulse
      POSTGRES_USER: sp
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql+asyncpg://sp:${DB_PASSWORD}@postgres:5432/stock_pulse
      REDIS_URL: redis://redis:6379/0
      STOCK_PULSE_LLM_ENDPOINT: ${LLM_ENDPOINT}
      FINNHUB_API_KEY: ${FINNHUB_API_KEY}
    ports:
      - "9002:9002"

  frontend:
    build: ./frontend
    depends_on: [backend]
    environment:
      NEXT_PUBLIC_API_URL: http://backend:9002
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

Nginx 做反向代理：

- `stockpulse.com` → frontend:3000
- `stockpulse.com/api/*` → backend:9002

---

## 8. MVP 开发计划（按周）

### Week 1：后端骨架 + 数据层

- [ ] 项目初始化（FastAPI + SQLAlchemy + Alembic）
- [ ] Docker Compose（PostgreSQL + Redis）
- [ ] 数据库 schema + 初始迁移
- [ ] 持仓管理 API（CRUD）
- [ ] 基础配置管理（pydantic-settings）

### Week 2：数据采集 + 事件聚合

- [ ] yfinance 财报数据获取服务
- [ ] SEC EDGAR 基础数据抓取（先做 earnings date + Form 4）
- [ ] 宏观经济日历数据接入（Finnhub + 手动维护）
- [ ] 事件聚合服务（多源 → 统一 events 表）
- [ ] 定时任务框架搭建

### Week 3：AI 解读 + API 完善

- [ ] AI 解读模块（复用 LLM HTTP 接口）
- [ ] 每日摘要 API
- [ ] 事件查询 API（upcoming / today / yesterday / stock）
- [ ] Redis 缓存集成
- [ ] API 错误处理 + 日志

### Week 4：前端 MVP

- [ ] Next.js 项目初始化（App Router + Tailwind + shadcn/ui）
- [ ] 持仓管理页面
- [ ] 仪表盘（7 天时间线 + 今日摘要卡片）
- [ ] 今日事件页（预览 + 复盘 tab）
- [ ] 宏观日历页（基础月度视图）

### Week 5：联调 + 推送 + 部署

- [ ] 前后端联调
- [ ] FCM Web Push 集成（注册 + 每日摘要推送）
- [ ] Docker Compose 部署到 VPS
- [ ] Nginx 配置
- [ ] 手动测试 + 修 bug
- [ ] 找 2–3 个朋友试用

---

## 9. 环境变量总览

```bash
# Database
DATABASE_URL=postgresql+asyncpg://sp:password@localhost:5432/stock_pulse

# Redis
REDIS_URL=redis://localhost:6379/0

# LLM
STOCK_PULSE_LLM_ENDPOINT=http://127.0.0.1:9001/llm

# Data sources
FINNHUB_API_KEY=xxx

# Firebase (Web Push)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-service-account.json

# App
APP_ENV=production
APP_PORT=9002
```
