# 页面切换卡顿优化 - 产品需求文档

## 概述
- **摘要**: 优化游戏各界面（主菜单、准备界面、兵营、商店、召唤、关卡、AI对战等）之间切换时的卡顿现象，重点解决壁纸+毛玻璃效果导致的 GPU 渲染瓶颈，同时优化内容构建时机与动画调度，让页面过渡更加丝滑流畅。
- **目的**: 解决用户在界面切换时感受到的明显卡顿/掉帧，尤其是开启壁纸背景时过渡动画不流畅的问题，提升整体交互体验的精致感和响应速度。
- **目标用户**: 所有玩家，尤其是开启壁纸背景的玩家。

## 视觉主题
- **基调**: 战场羊皮纸 —— 黄铜金(#d4a017)、暗血红(#8b2500)、橄榄绿(#6b8e23)、战场夜色(#0f0a05)、羊皮色(#e8dcc0)
- **材质感**: 磨砂羊皮纸、黄铜镶边、暗角柔光
- **动效语言**: 苏醒出现(back.out 1.4, 0.4-0.5s)、重量移动(power3.inOut, 0.28-0.35s)、冲击散开(power2.out, 0.15-0.2s)、持续呼吸(sine.inOut, 1.5-3s loop)

## 交互论点
1. **过渡前预渲染**: 新页面内容在过渡开始前就构建完毕并"冷冻"在 GPU 层，过渡时只做合成层位移/透明度，不触发重绘
2. **毛玻璃智能降级**: 过渡动画期间临时关闭 backdrop-filter，动画结束后再淡入恢复，用 2 帧的视觉代价换取全程 60fps
3. **壁纸图层独立**: 将壁纸从 body 背景提升为独立固定图层，配合 will-change 提升为合成层，避免每次重排都重绘壁纸

## 目标
- 页面切换动画稳定在 60fps（在中等配置设备上）
- 开启壁纸背景时切换流畅度接近无壁纸水平
- 不删除任何现有动画效果，仅优化性能和流畅度
- 所有页面（Menu、Prep、Barracks、Select、Shop、Summon、AIBattle、Levels）切换均受益
- 内容构建不阻塞动画主线程

## 非目标（范围外）
- 不修改战斗界面（hex-board canvas）的渲染逻辑（已在之前优化中处理）
- 不改变页面视觉设计风格和配色
- 不减少/简化页面内容或卡片数量
- 不删除毛玻璃效果（仅在动画期间临时关闭）
- 不修改召唤动画和粒子背景逻辑

## 背景与上下文
当前页面切换系统使用 GSAP 做 opacity + y 位移的淡入淡出过渡。存在以下性能瓶颈：

1. **`background-attachment: fixed`** — body 上的壁纸使用 fixed 定位，这是已知的性能杀手，每次元素变换都会触发整页重绘
2. **`backdrop-filter: blur(15px)`** — `.page.active` 上的强力毛玻璃在过渡期间持续计算，GPU 负担极重
3. **多层毛玻璃叠加** — 卡片也有 backdrop-filter，与页面毛玻璃叠加后 GPU 开销倍增
4. **内容构建与动画串行** — `buildContent()` 在过渡前同步执行，重 DOM 页面（商店、兵营）会阻塞动画启动
5. **无合成层提升** — 页面元素未提升为独立 GPU 层，过渡时每次都要重绘背景
6. **stagger 入场与页面过渡叠加** — 大量卡片的 stagger 动画与页面淡入同时进行，GSAP tweens 数量过多

之前的战斗优化已经引入了脏标记渲染、背景缓存等技术，本次将用类似思路优化 DOM 页面切换。

## 功能需求

### FR-1: 壁纸图层独立化
将壁纸从 body 的 background-image 改为独立的固定定位 `div#wallpaper-layer` 元素，放在 body 最底部 z-index: -2，配合 `will-change: transform` 提升为 GPU 合成层。移除 `background-attachment: fixed`。

### FR-2: 过渡期间毛玻璃智能降级
页面过渡动画进行中，给 body 添加 `transition-active` class，临时将 `.page.active` 的 `backdrop-filter` 设为 `none`、背景透明度略提升补偿视觉。过渡完成后移除 class，毛玻璃淡入恢复。

### FR-3: 卡片毛玻璃过渡期间降级
同理，过渡期间所有卡片（prep-card、shop-card、barracks-item 等）的 backdrop-filter 也临时降为 none，用更高的背景不透明度补偿。

### FR-4: 新页面内容预构建 + 分层渲染
修改 `showPage` 流程：先构建新页面内容（buildContent）→ 强制一帧回流 → 再启动过渡动画。确保 GSAP 动画开始时 DOM 已稳定，不会因布局抖动导致掉帧。

### FR-5: 过渡期间 GPU 层提升
给参与过渡的新旧页面元素在动画期间添加 `will-change: opacity, transform` 并设置 `transform: translateZ(0)`，提升为独立合成层。动画结束后清理，避免占用过多显存。

### FR-6: stagger 入场动画时机优化
将卡片的 stagger 入场动画从"与页面淡入同时开始"调整为"页面淡入完成后才开始"，减少 GPU 并发负担。如果用户偏好同时开始，保留视觉效果但减少同时动画的元素数量（分批 stagger）。

### FR-7: 页面状态切换与壁纸解耦
将壁纸应用/移除的时机从 `updatePageState` 移到过渡开始前，确保壁纸切换不与过渡动画争抢 GPU 资源。

### FR-8: 离屏预渲染（可选优化）
对于频繁访问的页面（Prep、Shop、Barracks），内容构建后可以缓存 DOM 状态，下次进入时直接复用，跳过 buildContent。

## 非功能需求

### NFR-1: 性能
- 开启壁纸时，页面过渡帧率从 ~20-30fps 提升到稳定 55-60fps（中等配置设备）
- 无壁纸场景下也有可感知的流畅度提升
- 过渡动画期间 GSAP tick 不被 JS 阻塞超过 16ms

### NFR-2: 视觉保真
- 优化后视觉效果与优化前无肉眼可辨差异（静态时完全一致）
- 毛玻璃仅在过渡的 ~0.5s 内临时隐藏，用户几乎感知不到
- 所有原有动画效果完整保留，不删减任何动画

### NFR-3: 内存
- 可以接受适度的内存增长（GPU 合成层增加）来换取流畅度
- 动画结束后必须清理 will-change 和临时层，避免内存泄漏

### NFR-4: 兼容性
- 所有修改在现代浏览器（Chrome/Edge 100+）正常工作
- backdrop-filter 降级方案不破坏无 backdrop-filter 的浏览器

## 约束
- **技术**: 原生 JS + GSAP 3.12.5 + Canvas，无框架，直接操作 DOM
- **设计**: 必须保留原有视觉风格，毛玻璃效果静态时必须存在
- **兼容性**: 不能使用实验性 CSS 属性
- **依赖**: 仅使用现有依赖（GSAP），不引入新库

## 假设
- 用户设备支持 CSS `will-change` 和 `backdrop-filter`
- 主要瓶颈是 GPU 渲染（毛玻璃 + fixed 背景），而非 JS 执行
- 适度增加显存占用是可接受的权衡

## 验收标准

### AC-1: 壁纸图层独立化
- **Given**: 玩家开启了壁纸背景
- **When**: 查看准备界面及其他有壁纸的页面
- **Then**: 壁纸通过独立的 `#wallpaper-layer` 元素渲染，而非 body background-image；视觉效果与之前一致
- **Verification**: `human-judgment`

### AC-2: 过渡期间毛玻璃降级
- **Given**: 玩家在任意两个页面之间切换
- **When**: 过渡动画正在进行中
- **Then**: body 有 `transition-active` class，页面和卡片的 backdrop-filter 临时为 none；过渡结束后 class 被移除，毛玻璃恢复
- **Verification**: `programmatic` — 可通过 DevTools 观察 class 切换和样式变化

### AC-3: 页面切换流畅度提升
- **Given**: 开启壁纸背景，从准备界面切换到商店/兵营/关卡等多卡片页面
- **When**: 触发页面切换
- **Then**: 过渡动画平滑无掉帧，无明显卡顿感；对比优化前流畅度显著提升
- **Verification**: `human-judgment`

### AC-4: 所有原有动画保留
- **Given**: 优化完成后
- **When**: 浏览各个页面并触发所有交互（按钮悬停、卡片入场、stagger 动画等）
- **Then**: 所有原有动画效果完整保留，没有任何动画被删除或简化
- **Verification**: `human-judgment`

### AC-5: 静态视觉无差异
- **Given**: 优化完成后，页面已完全加载且无动画进行
- **When**: 对比优化前后的静态截图
- **Then**: 视觉效果完全一致（毛玻璃、壁纸、卡片样式均无变化）
- **Verification**: `human-judgment`

### AC-6: GPU 层正确清理
- **Given**: 页面切换动画已完成 1 秒以上
- **When**: 检查页面元素的 will-change 属性
- **Then**: 参与过渡的页面元素不再有 will-change: opacity, transform（已被清理）
- **Verification**: `programmatic`

### AC-7: 无壁纸场景不受影响
- **Given**: 玩家未开启壁纸背景
- **When**: 进行页面切换
- **Then**: 切换流畅度至少不逊于优化前，所有功能正常
- **Verification**: `human-judgment`

### AC-8: 所有页面均受益
- **Given**: 游戏的所有 8 个页面（Menu、Prep、Barracks、Select、Shop、Summon、Levels、AIBattle）
- **When**: 在它们之间任意切换
- **Then**: 所有切换路径都流畅，无明显卡顿
- **Verification**: `human-judgment`

## 开放问题
- [ ] stagger 入场动画是与页面淡入同时开始（视觉更连贯）还是页面淡入后开始（性能更好）？—— 默认采用"页面淡入完成后开始"，因为性能收益更大且视觉上仍然精致
- [ ] 是否需要实现页面 DOM 缓存（FR-8）？—— 优先完成核心优化，DOM 缓存作为可选增强，如核心优化后仍不满意再实施
