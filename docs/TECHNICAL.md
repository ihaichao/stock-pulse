# Stock Pulse — 技术方案

## 1. 整体架构

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│   Backend API    │────▶│   Data Sources   │
│  (Next.js)   │◀────│   (Python/Fast   │◀────│   (yfinance,     │
│              │     │    API)          │     │    macro APIs)   │
└─────────────┘     └──────┬───────────┘     └─────────────────┘
                           │
                    ┌──────▼───────┐
                    │   Database    │
                    │  (PostgreSQL  │
                    │   or SQLite)  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   LLM Layer   │
                    │  (AI 解读生成) │
                    └──────────────┘
```

### 技术栈选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端 | **Next.js (React)** | SSR/SSG 支持好（SEO 友好）、生态成熟、部署方便 |
| 后端 API | **Python + FastAPI** | 与 yfinance/数据处理生态兼容、Jason 熟悉 Python |
| 数据库 | **SQLite（MVP）→ PostgreSQL（生产）** | MVP 阶段零运维，后续切换成本低 |
| LLM | **通过 HTTP 调用（OpenClaw 环境）** | 复用现有模型配置，不硬编码 API key |
| 部署 | **VPS 直接部署（MVP）** | 先跑通，后续可以迁移到 Vercel + Railway 等 |

---

## 2. 后端设计

### 2.1 目录结构

```
stock-pulse/
├── README.md
├── docs/
│   └── TECHNICAL.md          # 本文件
├── backend/
│   ├── __init__.py
│   ├── main.py               # FastAPI 入口
│   ├── config.py              # 配置管理（环境变量）
│   ├── models/
│   │   ├── __init__.py
│   │   ├── portfolio.py       # 持仓数据模型
│   │   ├── event.py           # 事件数据模型
│   │   └── macro.py           # 宏观事件数据模型
│   ├── services/
│   │   ├── __init__.py
│   │   ├── earnings.py        # 财报数据获取与处理
│   │   ├── macro_calendar.py  # 宏观经济日历数据
│   │   ├── event_aggregator.py # 事件聚合逻辑
│   │   └── ai_explain.py     # AI 解读生成
│   ├── api/
│   │   ├── __init__.py
│   │   ├── portfolio.py       # 持仓管理 API
│   │   ├── events.py          # 事件查询 API
│   │   ├── daily_summary.py   # 每日摘要 API
│   │   └── macro.py           # 宏观日历 API
│   └── db/
│       ├── __init__.py
│       ├── database.py        # 数据库连接管理
│       └── schemas.py         # 表结构定义
├── frontend/                  # Next.js 项目（后续创建）
├── requirements.txt
└── .env.example
```

### 2.2 数据模型

#### Portfolio（持仓）

```python
class PortfolioItem:
    user_id: str          # 用户标识（MVP 用简单 token）
    ticker: str           # 股票代码
    added_at: datetime    # 添加时间
    notes: str | None     # 用户备注（可选）
```

#### Event（事件）

```python
class StockEvent:
    id: str               # 唯一标识
    ticker: str           # 关联股票（宏观事件为 None）
    event_type: str       # "earnings" | "macro" | "insider" | "analyst"
    event_date: datetime  # 事件发生时间
    title: str            # 简短标题
    description: str      # 简短描述
    importance: str       # "high" | "medium" | "low"
    status: str           # "upcoming" | "completed"
    
    # 财报特有字段
    eps_estimate: float | None
    eps_actual: float | None
    revenue_estimate: float | None
    revenue_actual: float | None
    
    # 宏观特有字段
    macro_event_name: str | None    # "FOMC" | "CPI" | "NFP" | ...
    consensus: str | None
    actual: str | None
    previous: str | None
    
    # AI 解读
    ai_summary: str | None          # AI 生成的 1–3 句解读
    ai_detail: str | None           # AI 生成的详细解读（事件详情页用）
```

### 2.3 API 设计

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
GET    /api/events/stock/:ticker   # 某只股票的所有事件（个股事件页）
GET    /api/events/:id             # 单个事件详情（含 AI 解读）
```

#### 宏观日历

```
GET    /api/macro/calendar         # 当月宏观事件日历
       ?month=2026-03              # 可选：指定月份
```

#### 每日摘要

```
GET    /api/daily-summary          # 今日摘要（聚合持仓相关事件 + AI 解读）
```

### 2.4 用户身份（MVP 简化方案）

MVP 阶段不做完整的注册/登录系统：

- 用户首次访问时，前端生成一个随机 `user_token`，存在 localStorage
- 后续所有 API 请求通过 `Authorization: Bearer <user_token>` 传递
- 后端用这个 token 关联用户的持仓数据
- 优点：零注册摩擦，用户打开就能用
- 缺点：换设备/清缓存会丢失数据（MVP 可接受）

Phase 2 再加：邮箱注册 / OAuth 登录 / 数据迁移。

---

## 3. 数据源方案

### 3.1 财报数据（Earnings）

**MVP 数据源选择：**

| 数据源 | 优点 | 缺点 | 推荐 |
|--------|------|------|------|
| yfinance | 免费、Python 生态好 | 不稳定、有 rate limit | MVP 首选 |
| Alpha Vantage | 有免费 tier | 免费额度有限（25 次/天） | 备选 |
| Finnhub | 有免费 tier | 部分数据需付费 | 备选 |
| Earnings Whispers | 数据质量好 | 需付费 | Phase 2 |

**MVP 方案：先用 yfinance**

- `yfinance` 可以获取：
  - 下一次财报日期（`earningsDate`）
  - 历史财报 EPS（`earningsHistory`）
  - 预期 EPS（`earningsEstimate`）

- 数据刷新策略：
  - 每天定时（如 UTC 06:00 / 12:00）刷新一次所有用户持仓涉及的 ticker
  - 结果缓存到数据库，API 直接从数据库读

### 3.2 宏观经济日历

**MVP 数据源选择：**

| 数据源 | 优点 | 缺点 | 推荐 |
|--------|------|------|------|
| Finnhub Economic Calendar | 免费 tier 可用 | 数据覆盖面一般 | MVP 首选 |
| Trading Economics API | 数据质量高 | 需付费 | Phase 2 |
| Investing.com 爬取 | 数据全 | 不稳定、法律风险 | 不推荐 |
| 手动维护 | 可控 | 费人力 | 保底方案 |

**MVP 方案：Finnhub 免费 tier + 手动补充**

- 主要宏观事件是固定的（FOMC 日程、CPI 发布日等），可以预先录入
- 用 Finnhub 的 economic calendar API 自动拉取，手动补充遗漏
- 对于最重要的几个（FOMC、CPI、NFP），维护一份「固定日程表」作为兜底

### 3.3 数据刷新架构

```
┌─────────────────┐
│  Scheduled Job   │  ← 每天 UTC 06:00 / 12:00 / 20:00
│  (cron / APScheduler)
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│  Fetch earnings  │────▶│              │
│  for all tickers │     │   Database   │
│  in portfolios   │────▶│   (events    │
│                  │     │    table)    │
│  Fetch macro     │────▶│              │
│  calendar        │     └──────────────┘
└─────────────────┘
```

- 不实时调用外部 API（避免 rate limit + 响应慢）
- 用户请求 → 直接从数据库读 → 秒级响应

---

## 4. AI 解读方案

### 4.1 解读层级

| 层级 | 用途 | 长度 | 生成时机 |
|------|------|------|----------|
| **一句话摘要** | 事件列表里显示 | 1 句话 | 数据刷新时批量生成 |
| **简短解读** | 每日摘要页 | 1–3 句话 | 数据刷新时批量生成 |
| **详细解读** | 事件详情页 | 3–5 段 | 用户点击时按需生成（缓存） |

### 4.2 Prompt 设计思路

**财报事件（upcoming）：**

```
这只股票（{ticker}）将在 {date} 发布财报。
市场预期 EPS 为 {eps_estimate}，营收预期为 {revenue_estimate}。
过去 4 个季度的财报表现：{history_summary}。

请用 1–3 句简明中文告诉普通投资者：
1. 这次财报值得关注的点是什么
2. 如果大幅超预期或不及预期，可能意味着什么
不要给出买卖建议。
```

**财报事件（completed）：**

```
{ticker} 刚发布了 {quarter} 季度财报。
实际 EPS: {eps_actual}（预期 {eps_estimate}），{beat_or_miss}。
实际营收: {revenue_actual}（预期 {revenue_estimate}）。
盘后股价变动: {after_hours_change}%。

请用 1–3 句简明中文告诉普通投资者：
1. 这份财报的关键信息
2. 市场为什么这样反应
不要给出买卖建议。
```

**宏观事件：**

```
今天将公布 {event_name}（{date}）。
前值: {previous}，市场预期: {consensus}。

请用 1–2 句简明中文告诉普通投资者：
1. 这个数据为什么重要
2. 如果大幅高于或低于预期，通常对美股有什么影响
不要给出买卖建议。
```

### 4.3 调用方式

与 vibe-investing 项目一致：

- 通过环境变量 `STOCK_PULSE_LLM_ENDPOINT` 指向本地 LLM HTTP 服务
- 请求：`POST { "prompt": "..." }`
- 响应：`{ "text": "..." }`
- 复用 OpenClaw 环境的模型配置

---

## 5. 前端设计

### 5.1 技术选型

- **Next.js 14+**（App Router）
- **Tailwind CSS**（快速样式开发）
- **shadcn/ui**（组件库，风格干净）

### 5.2 页面路由

```
/                          # 首页（未登录：介绍页 / 已登录：仪表盘）
/today                     # 今日事件页（预览 + 复盘 tab）
/stock/[ticker]            # 个股事件页
/macro                     # 宏观日历页
/event/[id]                # 事件详情页
/settings                  # 持仓管理 / 设置
```

### 5.3 关键交互

- **持仓输入**：一个简单的搜索框 + 添加按钮，支持模糊搜索 ticker / 公司名
- **事件时间线**：水平滚动的 7 天时间线，今天居中高亮
- **事件卡片**：点击展开 AI 解读，或跳转到详情页
- **日历视图**：宏观日历用月度网格，每格标注当天的宏观事件

### 5.4 响应式设计

- 手机端优先（很多人在手机上查事件日历）
- 桌面端自适应扩展

---

## 6. 部署方案（MVP）

### 6.1 最简部署

在当前 VPS 上直接跑：

```
stock-pulse/
├── backend/   → uvicorn，监听 :9002
├── frontend/  → next start，监听 :3000
└── nginx      → 反向代理，统一入口
```

### 6.2 环境变量

```bash
# 数据库
DATABASE_URL=sqlite:///./stock_pulse.db

# LLM
STOCK_PULSE_LLM_ENDPOINT=http://127.0.0.1:9001/llm

# 外部数据源
FINNHUB_API_KEY=xxx          # 宏观日历（免费 tier）

# 应用
APP_ENV=production
APP_PORT=9002
```

### 6.3 定时任务

使用 APScheduler（集成在 FastAPI 内）或系统 cron：

| 任务 | 频率 | 说明 |
|------|------|------|
| 刷新财报日期 | 每天 2 次（UTC 06:00, 18:00） | 拉取所有持仓 ticker 的 earnings date |
| 刷新宏观日历 | 每天 1 次（UTC 06:00） | 拉取当月 + 下月宏观事件 |
| 生成 AI 摘要 | 每天 1 次（UTC 20:00，美东盘前） | 为今日事件批量生成 AI 解读 |
| 清理过期数据 | 每周 1 次 | 清理 30 天前的已完成事件缓存 |

---

## 7. MVP 开发计划（按周）

### Week 1：后端骨架 + 数据层

- [ ] 项目初始化（Python + FastAPI）
- [ ] 数据库 schema 设计 + SQLite 接入
- [ ] 持仓管理 API（CRUD）
- [ ] yfinance 财报数据获取服务
- [ ] 基础事件聚合逻辑

### Week 2：宏观数据 + AI 解读

- [ ] 宏观经济日历数据接入（Finnhub / 手动维护）
- [ ] AI 解读模块（复用 LLM HTTP 接口）
- [ ] 每日摘要 API
- [ ] 定时数据刷新任务

### Week 3：前端 MVP

- [ ] Next.js 项目初始化
- [ ] 持仓管理页面
- [ ] 仪表盘（7 天时间线 + 今日摘要）
- [ ] 每日事件页（今日预览 tab）

### Week 4：联调 + 部署

- [ ] 前后端联调
- [ ] 基础错误处理 + loading 状态
- [ ] VPS 部署（nginx + systemd）
- [ ] 手动测试 + 修 bug
- [ ] 找 2–3 个朋友试用，收集反馈
