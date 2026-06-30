# 页面切换卡顿优化 - 实现计划（任务分解与优先级排序）

## [x] Task 1: 壁纸图层独立化
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 index.html 的 body 开头添加 `<div id="wallpaper-layer"></div>` 固定定位层
  - 在 [style.css](file:///d:/httpgame/hex-game/css/style.css) 中添加 `#wallpaper-layer` 样式：position: fixed; inset: 0; z-index: -2; background-size: 100% 100%; background-position: center; background-repeat: no-repeat; will-change: transform;
  - 修改 [settings.js](file:///d:/httpgame/hex-game/js/settings.js) 的 `applyWallpaper()` 和 `applyRandomWallpaper()`：将背景图从 `document.body.style.backgroundImage` 改为 `document.getElementById('wallpaper-layer').style.backgroundImage`
  - 移除 `body.body-wallpaper` 上的 `background-attachment: fixed` 和相关 background 属性
  - `body.body-wallpaper` 改为仅作为状态标记，不承载背景样式
  - 修改 `removeWallpaper()` 和 `main.js` 中的壁纸清理逻辑，改为清理 `#wallpaper-layer`
  - 确保 `body.body-wallpaper::before` 暗角遮罩仍然正常工作
- **Acceptance Criteria Addressed**: AC-1, AC-5, AC-7
- **Test Requirements**:
  - `human-judgement` TR-1.1: 开启壁纸后视觉效果与优化前一致，壁纸铺满整个窗口，滚动时壁纸不动
  - `human-judgement` TR-1.2: 关闭壁纸后界面正常，无残留
  - `programmatic` TR-1.3: `document.getElementById('wallpaper-layer')` 存在且在 body 第一个子元素位置
  - `programmatic` TR-1.4: 开启壁纸时，背景图设置在 `#wallpaper-layer` 而非 body 上
- **Notes**: 这是性能收益最大的优化项，`background-attachment: fixed` 是头号性能杀手

## [x] Task 2: 过渡期间毛玻璃智能降级（页面级）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 [style.css](file:///d:/httpgame/hex-game/css/style.css) 中添加 `body.transition-active .page.active` 规则：`backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(255, 250, 240, 0.92);`（提升不透明度补偿无模糊的视觉差异）
  - 修改 [animations.js](file:///d:/httpgame/hex-game/js/animations.js) 的 `pageTransition()` 函数：
    - 动画开始前给 body 添加 `transition-active` class
    - 动画完成后（safeComplete 中）移除 `transition-active` class
  - 确保 fallback 路径（无 GSAP）也正确处理 class
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-5
- **Test Requirements**:
  - `programmatic` TR-2.1: 过渡动画开始时 body 有 `transition-active` class
  - `programmatic` TR-2.2: 过渡动画结束后 `transition-active` class 被移除
  - `human-judgement` TR-2.3: 过渡期间视觉流畅，毛玻璃的短暂消失几乎不可感知
  - `human-judgement` TR-2.4: 静态时毛玻璃效果完全恢复，与优化前无差异
- **Notes**: 这是第二大性能收益项，backdrop-filter 动画期间的 GPU 开销极大

## [ ] Task 3: 过渡期间卡片毛玻璃降级
- **Priority**: medium
- **Depends On**: Task 2
- **Description**:
  - 在 [style.css](file:///d:/httpgame/hex-game/css/style.css) 中添加 `body.transition-active` 下各类卡片的 backdrop-filter 降级规则：
    - `.prep-card` → `backdrop-filter: none; background: rgba(250,243,224,0.85);`
    - `.barracks-item` → 同逻辑
    - `.shop-card` / `.shop-unit-card` / `.shop-equip-card` → 同逻辑
    - `.select-card` → 同逻辑
    - `.level-card` → 同逻辑
    - `.summon-tier-card` → 同逻辑
    - `.ai-opponent-card` → 同逻辑
  - 针对 `body.body-wallpaper` 下的卡片也做对应降级
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: 过渡期间卡片的 backdrop-filter 为 none
  - `human-judgement` TR-3.2: 静态时卡片毛玻璃效果完全恢复
  - `human-judgement` TR-3.3: 过渡期间卡片视觉仍然协调，不会因无模糊而显得突兀
- **Notes**: 卡片数量多时收益明显，卡片少时收益有限但成本低

## [ ] Task 4: 过渡期间 GPU 层提升与清理
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - 修改 [animations.js](file:///d:/httpgame/hex-game/js/animations.js) 的 `pageTransition()` 函数：
    - 动画开始前，给 oldEl 和 newEl 设置 `will-change: opacity, transform` 和 `transform: translateZ(0)`
    - 动画完成后（safeComplete 中），清理这两个元素的 will-change 和 transform（恢复原状）
  - 在 gsap.set 初始状态时就加上 will-change
  - 清理时使用 gsap.set 或直接操作 style，确保完全移除
- **Acceptance Criteria Addressed**: AC-3, AC-6
- **Test Requirements**:
  - `programmatic` TR-4.1: 过渡进行中，两个页面元素都有 will-change: opacity, transform
  - `programmatic` TR-4.2: 过渡结束 1 秒后，页面元素不再有 will-change 属性
  - `human-judgement` TR-4.3: 过渡动画比优化前更丝滑，无闪烁或跳帧
- **Notes**: will-change 不能常驻，否则会占用过多显存导致反而更卡

## [ ] Task 5: showPage 内容预构建与回流优化
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 修改 [main.js](file:///d:/httpgame/hex-game/js/main.js) 的 `_doShowPage()` 函数：
    - 保持现有 buildContent 在过渡前调用的顺序（已经是先构建再动画）
    - 在 buildContent 后、启动页面前，强制触发一次回流（读取一次 offsetHeight 或使用 requestAnimationFrame），确保 DOM 稳定后再开始 GSAP 动画
    - 调整 stagger 入场动画的触发时机：从 onVisible（页面刚显示）移到 onComplete（页面淡入完成后），避免与页面过渡叠加
  - 确认 buildContent 不会在动画中再次触发重排
- **Acceptance Criteria Addressed**: AC-3, AC-8
- **Test Requirements**:
  - `human-judgement` TR-5.1: 页面切换的开头不再有"卡一下再动"的感觉
  - `human-judgement` TR-5.2: stagger 入场动画在页面淡入完成后才开始，视觉层次分明
  - `human-judgement` TR-5.3: 所有页面切换均流畅，无内容突然弹出的情况
- **Notes**: 这是解决"动画开头卡顿"的关键——DOM 构建和布局计算应在动画开始前完成

## [ ] Task 6: 壁纸应用时机提前
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - 检查 [main.js](file:///d:/httpgame/hex-game/js/main.js) 中 `updatePageState` 和壁纸应用的调用时机
  - 将壁纸应用/移除逻辑从页面状态更新中提前到过渡动画开始之前
  - 确保壁纸切换在过渡开始前就已完成，不会与过渡动画争抢 GPU
  - 如果是随机壁纸模式（异步 fetch），确保在 fetch 完成前不启动过渡，或先显示上一张壁纸再切换
- **Acceptance Criteria Addressed**: AC-3, AC-7
- **Test Requirements**:
  - `human-judgement` TR-6.1: 从无壁纸页面切到有壁纸页面时，过渡流畅无闪烁
  - `human-judgement` TR-6.2: 壁纸切换与页面过渡不会同时进行导致双重卡顿
  - `programmatic` TR-6.3: 壁纸应用在 pageTransition 调用前完成
- **Notes**: 壁纸的加载和绘制如果与动画同时进行，会造成严重掉帧

## [ ] Task 7: 全面回归测试与调优
- **Priority**: high
- **Depends On**: Task 1, 2, 3, 4, 5, 6
- **Description**:
  - 在开启壁纸和关闭壁纸两种情况下，测试所有页面间的切换路径
  - 重点测试多卡片页面（Shop、Barracks、Levels）的进入流畅度
  - 测试快速连续切换页面的防抖逻辑是否正常
  - 检查所有原有动画（按钮悬停、卡片效果、stagger、模态框等）是否完好
  - 检查设置页面的壁纸切换功能是否正常
  - 静态视觉对比：确保优化前后无差异
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-5, AC-7, AC-8
- **Test Requirements**:
  - `human-judgement` TR-7.1: 所有 8 个页面之间任意切换均流畅
  - `human-judgement` TR-7.2: 所有原有动画效果完整保留，无遗漏
  - `human-judgement` TR-7.3: 静态视觉与优化前一致
  - `human-judgement` TR-7.4: 快速连点不会导致页面状态错乱
  - `human-judgement` TR-7.5: 壁纸设置功能正常（切换、删除、随机模式）
- **Notes**: 优化不能以牺牲功能完整性为代价
