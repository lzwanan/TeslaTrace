<div align="center">

# TeslaTrace

**你的车，你的数据，一眼看清。**

自托管、移动优先的 TeslaMate 数据看板。

[![Status](https://img.shields.io/badge/status-设计预览-orange)](#路线图)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<img src="docs/screenshots/desktop.png" width="860" alt="桌面端">

<img src="docs/screenshots/mobile.png" width="250" alt="手机端">

</div>

> ### 当前状态：设计预览
> 上面的截图来自一个**可直接运行的交互原型** —— 用浏览器打开 [`demo/index.html`](demo/index.html) 即可，无需构建、无依赖。
> FastAPI 后端与 React 前端正在开发中，**暂不可用于生产**。

---

## 为什么还要一个看板

TeslaMate 已经把该记的都记了：每一个 GPS 采样点、每一趟行程、每一次充电，索引也建好了。它缺的是**一眼能看完的视图**。Grafana 是很好的分析工具，但它不是你走向车时会在手机上打开的东西。

TeslaTrace 补的是另一半：

- **一屏三个答案** —— 车在哪、还剩多少电、在不在充电。
- **数值优先于图表** —— 大号数字 + 单位 + 一句上下文；图表放下一屏，用来解释数字。
- **状态必须可解释** —— 车休眠时 TeslaMate 本就不采集。每个值都标注它多久没更新了，免得"数字冻住"被当成 bug。

## 会做什么

| 模块 | 内容 |
|---|---|
| 实时 | 状态胶囊（充电中 / 行驶中 / 在线 / **已休眠 42 分钟**）、电量环、续航、充电功率、预计充满、实时位置 |
| 行程 | 行程列表 + 轨迹地图、单趟能耗与电费、轨迹回放（规划中） |
| 充电 | 充电记录、SOC 曲线、分时电价计费、家充与超充占比 |
| 统计 | 日/月能耗、电池健康趋势、停放掉电（吸血鬼耗电）、对比燃油车省下的钱 |
| 平台 | 390px–1440px 全响应式、可安装 PWA、明暗双主题 |

**刻意不做**：原始电流/电压曲线、逐点 GPS 列表、车辆配置项。这些属于 Grafana 的职责。

## 架构

```
TeslaMate ──► PostgreSQL 17 ─┐
    │                        ├──► FastAPI（只读） ──► Nginx ──► 手机 / 平板 / 电脑
    └──► Mosquitto ──────────┘        │
                                      └── SSE ──► 实时状态
```

- **只读访问数据库**：独立 `teslamate_ro` 角色，只有 `SELECT`。TeslaTrace 永不改写你的 TeslaMate 数据。
- **防腐视图**：所有查询都走自建的 `app` schema（视图 + 物化视图），不直接绑定 TeslaMate 的表。它升级改字段时，改一行 SQL 就能适配，而不是重写代码。
- **实时走 MQTT，历史走 PostgreSQL**：不轮询车辆，不唤醒它。
- **服务端降采样**：1300 万行的 `positions` 不会传给浏览器，轨迹在序列化前压到约 1500 个点。
- **用 SSE 而不是 WebSocket**：数据只单向流动，少一个要调协议的东西。

## 环境要求

- TeslaMate **v4.x** 及其 PostgreSQL、Mosquitto
- PostgreSQL **16 或 17**
- 任意 Docker 主机 —— 在群晖 DS920+（x86_64 / 4GB 内存）上开发与验证
- TeslaTrace 容器约 **150 MB** 内存

## 快速开始

暂不可用 —— 后端还在写。目标形态：

```bash
git clone https://github.com/lzwanan/teslatrace
cd teslatrace
cp deploy/.env.example deploy/.env      # 数据库密码、MQTT 地址、访问令牌
docker compose -f deploy/docker-compose.example.yml up -d
```

然后必须套 HTTPS 反代并加一层认证。**不要在无认证的情况下暴露到公网** —— 它会显示车辆的实时位置。

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 设计系统、卡片注册表、断点布局 | ✅ 原型完成 |
| P1 | FastAPI 骨架：只读库、MQTT→SSE、`/api/v1/summary` | 🚧 进行中 |
| P2 | React 应用：概览 + 行程 + 充电 | ⬜ |
| P3 | 统计：物化视图、电池健康、停放掉电 | ⬜ |
| P4 | 认证、PWA、Docker 镜像、群晖部署文档 | ⬜ |
| P5 | 轨迹回放、多车 | ⬜ |

## 设计决策

[`demo/`](demo/) 里的原型是设计基线，展开说明见 [`demo/README.md`](demo/README.md)。两个关键选择：

- **用容器查询，不用媒体查询**：一张卡只知道"自己被放进了多宽的容器"，所以同一张卡能塞进侧栏、小组件、全屏，都不用改代码。
- **用卡片注册表，不写死页面**：每张卡声明各断点的 `span`、`priority` 和 `visibleWhen` 谓词。同一套卡片能长出三种首屏 —— 充电时、行驶时、停放时。

## 声明

TeslaTrace 是独立的社区项目，**与 Tesla, Inc. 无任何关联，未获其认可或赞助**。「Tesla」「TeslaMate」仅用于说明兼容性，本项目不使用任何特斯拉商标或品牌素材。

## 许可证

[MIT](LICENSE)
