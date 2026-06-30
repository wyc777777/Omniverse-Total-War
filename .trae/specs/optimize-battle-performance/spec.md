# 万界全面战争 · 动画设计与帧率优化 Spec

## Visual Thesis
**余烬映照下的羊皮战图——黄铜与暖琥珀的厚重仪式，每一次选择带有重量，每一次冲击以动能落地。**

游戏已有的视觉资产定下了基调：宋体古典字、`#0f0a05` 战场夜色、`#d4a017` 黄铜金、`#8b2500` 暗血红、`#6b8e23` 橄榄绿、Aftermath Embers 粒子余烬、召唤仪式环。本 spec 的所有新增动画都延续这一材质语言——不引入新颜色、不引入新字体、不引入与现有视觉冲突的拟物风格。

## Motion Design Language（共享设计语言）
所有新增动画遵循统一参数，保证整页一致：

| 用途 | 缓动 | 时长 | 隐喻 |
|---|---|---|---|
| 苏醒/出现 | `back.out(1.4)` | 0.4-0.5s | 棋子被唤醒、有弹性 |
| 重量移动 | `power3.inOut` | 0.28-0.35s | 黄铜器物的沉稳位移 |
| 冲击散开 | `power2.out` | 0.15-0.2s | 余烬迸射、瞬间释放 |
| 持续呼吸 | `sine.inOut` | 1.5-3s loop | 活物、能量场 |
| 入场过渡 | `power2.out` | 0.28s | 羊皮展开、雾散 |

**材质隐喻库**（仅用现有色彩）：
- 黄铜光晕：`rgba(212,160,23,0.35)` 径向渐变 + `box-shadow` 暖金辉
- 余烬拖尾：上升的 `rgba(255,200,80,α)` 粒子（沿用 ParticleBG 风格）
- 墨水晕染：`rgba(61,26,0,0.15)` 向外扩散的圆
- 战雾：`rgba(15,10,5,0.6)` 半透明遮罩淡出

## Interaction Thesis（三大核心动作）
这三个动作是本 spec 的灵魂，其他动画都围绕它们延展：

### 动作一：入场序列——棋盘从战雾中浮现
**触发**：进入战斗页面时
**视觉**：
1. 画布先覆盖一层 `rgba(15,10,5,0.6)` 战雾
2. 战雾 0.5s `power2.out` 淡出
3. 同时六边形从中心向外**逐圈**显现（stagger 0.04s/圈），每格 `opacity 0→1 + scale 0.92→1`，`back.out(1.4)`
4. 棋子最后落入各自格位（每个棋子 `scale 0.4→1 + y 12→0`，0.4s，`back.out(1.4)`，stagger 0.03s）
5. 现有的 liftCurtain 帷幕升起保留不变，与之同步

**单一职责**：建立"战场即将开始"的仪式感。不加卡片、不加文案、不加额外装饰。

### 动作二：选择反馈——棋子苏醒
**触发**：玩家点击选中己方棋子
**视觉**：
1. 棋子 `scale 0.92→1.06→1`，0.4s，`back.out(1.4)`（被唤醒的弹性）
2. 棋子下方出现**地面光环**：金色径向渐变圆，`scale 0→1.2` + `opacity 0→0.6→0.35`，0.5s `power2.out`，随后保持 0.35 透明度持续脉冲（`sine.inOut` 1.8s loop，opacity 0.25↔0.45）
3. 现有的金色双描边发光**完全保留**，叠加在光环之上
4. 选中瞬间触发一次 `requestRender()` 持续渲染 0.5s（确保弹性动画期间帧率稳定）

**单一职责**：让"选中"这个动作有重量感。光环是唯一新增视觉，不堆叠其他效果。

### 动作三：冲击动作——攻击落地
**触发**：`executeCombat` 中攻击发生时
**视觉**：
1. 攻击方棋子向目标方向**前冲 8px**（沿 `getDirectionBetween` 计算的角度），0.1s `power2.out`，再 0.15s `power2.in` 回弹——总 0.25s
2. 命中瞬间在防守方位置生成**径向冲击波**：金色圆环 `scale 0.3→2.5` + `opacity 0.8→0`，0.4s `power2.out`
3. 现有的伤害飘字**完全保留**，叠加在冲击波之上
4. 整个画布**微震** 1 帧（`translate 2px` 随机方向），仅对暴击/溃逃触发，普通攻击不震屏（避免噪声）
5. 通过 `_shakeAtkHex` 临时状态在 `render()` 中绘制棋子偏移，0.25s 后自动清除

**单一职责**：让攻击有动能。不替换伤害飘字、不替换溃逃抖动。

## 配套动画（遵循共享设计语言）
以下动画补全缺失交互反馈，全部使用上述共享缓动/时长/色彩，保持整页一致：

### Modal 入场/退场对称化
- **入场**（已存在）：保留召唤 modal 的 3D 翻转 + stagger 风格
- **退场**（新增）：所有 modal 统一 `opacity 1→0 + y 0→-15 + scale 1→0.96`，0.2s `power2.in`，onComplete 后 `remove()`
- **结算 modal 入场**（新增）：与召唤 modal 同风格——overlay 0.3s 淡入 + 内容 `opacity 0, scale 0.85, rotationY -10 → 1` 0.5s `back.out(1.4)` + 掉落/奖励卡片 stagger 0.08s

### 数值计数
- 积分/数量变化：GSAP tween 从旧值到新值，0.5s `power2.out`
- `prepInvBadge` 数量变化：额外 `scale 1.3→1`，0.3s `back.out`（苏醒缓动）

### Tab 切换
- 新内容 `opacity 0, y 10 → 1`，0.3s `power2.out`，列表项 stagger 0.04s
- active 指示条 `transition: all 0.3s cubic-bezier(.34,1.56,.64,1)`（与现有 prep-card hover 一致）

### 列表 stagger 入场
- 统一参数：`opacity 0, y 10 → 1`，0.3s `power2.out`，stagger 0.04s
- 应用到：背包物品、召唤历史、商城卡片、结算掉落/奖励卡片

### 物品出售移除
- 卡片 `opacity 1→0 + scale 1→0.8`，0.3s `power2.in`，onComplete 后 splice 重建

### 棋子放置/回收
- **放置**：`scale 0.5→1` + 地面金色圆环 `scale 0→1.5, opacity 0.6→0`（一次性的小光环，区别于选中持续的脉冲），0.3s `back.out(1.4)`
- **回收**：`scale 1→0.5 + opacity 1→0`，0.25s `power2.in`

### Tab 切换/列表 stagger 等
（已在上面定义，遵循共享语言）

### 激活已有死代码
- **`showToastAnim`**：接入 `showToast`，`opacity 0, y -20, scale 0.9 → 1`，0.3s `back.out(1.4)`
- **`SummonAnimations.revealCard`**：叠加在召唤结果 modal 内容上，`rotationY 90→0, scale 0.5→1, opacity 0→1`，0.6s `back.out(1.4)`
- **`shakePiece`**：填充实现（见动作三），接入 `executeCombat`

### 锁定关卡点击
- 卡片 `translateX -5→5→-3→3→0`，0.4s（自定义 keyframe，无缓动），提示无法进入

### 敌方棋子移动动画（关键修复）
- 在 `aiExecuteMove()` 中调用 `startPieceMoveAnim(aiUnit.key, oldHex, newHex, 260, callback)`
- 与玩家方完全一致（260ms `easeOutCubic` + 拖影），消除瞬移不一致
- 时序：移动动画 260ms 完成后，原 350ms 间隔改为 `max(350, 280)` 确保动画完成

## 帧率优化（让上述动画流畅运行）
所有优化**不改变现有动画行为**，仅降低单帧耗时：

### 离屏 Canvas 缓存（以内存换性能）
- **背景层缓存**：六边形网格填充+描边+坐标轴预渲染到离屏 canvas，`render()` 中 `drawImage` 一次复制。仅高亮状态（sp/mv/atk/hv）的六边形实时叠加
- **单位图像缓存**：每个 `(unitType, team)` 预渲染（含圆形裁剪、边框、底色）到离屏 canvas。HP 条、士气条、状态图标、朝向三角形、名称标签、选中光环、冲击波等动态元素仍每帧实时绘制
- **ParticleBG 余烬 sprite**：将 `createRadialGradient` 光晕预渲染为几种尺寸的 sprite，`drawImage` 复用

### 脏标记渲染（保留持续 rAF 循环）
- 保留 `startAnimLoop` 持续循环不变
- 循环内部增加 `_needsRender` 判断：有变化或移动动画时 `render()`，否则跳过保持上一帧
- 新增 `requestRender()` 全局函数（设置脏标记），所有外部 `render()` 调用改为 `requestRender()`
- 有移动动画、选中弹性、冲击震动等主动画期间，自动持续渲染

### computeStats 缓存
- 按 unitType 缓存 `computeStats` 结果，装备/品阶变化时 `invalidateStatsCache(unitType)` 清缓存

### mousemove 节流
- mousemove handler 末尾冗余的 `render()` 改为 `requestRender()`
- 仅在 `hoveredHex` 真正变化时更新 tooltip

### 伤害飘字对象池
- 预创建 DOM 元素池复用，避免频繁 create/remove
- 现有动画效果（上升、缩放、淡出、暴击闪光）完全不变

### AI 回合与 combat 冗余渲染合并
- `runAITurn`、`processUnitWithAnim`、`processNext` 中 10 处 `render()` 改为 `requestRender()`
- `executeCombat`、`executeOpportunityAttack` 中 `render()` 改为 `requestRender()`

## 设计约束（不可违反）
1. **不删除任何现有动画逻辑**——GSAP timeline、CSS keyframes、hover/transition 全部保留
2. **不引入新颜色/字体**——所有新增动画使用现有 `#d4a017` / `#8b2500` / `#6b8e23` / `#0f0a05` / `#f5e6c8` / `#3d2b1a` 调色板
3. **缓动/时长统一**——所有新增动画使用本 spec 的 Motion Design Language 表格中的参数
4. **一个动作一个职责**——选中就是选中、攻击就是攻击，不堆叠无关效果
5. **modal 退出动画完成后再 `remove()`**——避免动画期间元素被销毁
6. **以内存换性能**——积极使用缓存和对象池，允许多用内存/CPU 降低单帧耗时
7. **离屏缓存仅用于静态元素**——HP/士气条/状态图标/朝向三角形/名称标签/选中光环/冲击波等动态元素每帧实时绘制
8. **持续 rAF 循环不停止**——仅在循环内部做脏标记优化，启停时机不变

## Impact
- Affected code:
  - `js/hex-board.js` — render()、startAnimLoop 脏标记、离屏缓存、requestRender()、shakePiece、选中光环与弹性、棋盘入场战雾、冲击波
  - `js/ai-engine.js` — aiExecuteMove() 增加动画调用、render() 改为 requestRender()
  - `js/interactions.js` — mousemove 节流、render() 改为 requestRender()、棋子放置/回收动画、选中触发
  - `js/animations.js` — showDamageNumber 对象池、ParticleBG sprite、showToastAnim 接入、冲击波绘制
  - `js/combat.js` — render() 改为 requestRender()、调用 shakePiece
  - `js/turn-system.js` — render() 改为 requestRender()
  - `js/ui-utils.js` — showToast 调用 showToastAnim、animateNumber 工具
  - `js/shop-system.js` — refreshPointsDisplay 计数、switchShopTab 过渡、buildShop stagger
  - `js/main.js` — refreshPrepPage 计数、prepInvBadge 弹跳、棋盘入场序列
  - `js/inventory-ui.js` — modal 退出动画、switchInvTab 过渡、buildInventory stagger、sellInventoryItem 移除动画
  - `js/summon-ui.js` — closeSummonModal 退出、buildSummonPage stagger、revealCard 接入
  - `js/levels-ui.js` — showLevelSettlementModal 入场、closeLevelBattleSettlement 退出、锁定关卡 shake
  - `js/ai-battle.js` — showAIBattleSettlement 入场、showAIUnitDetail 入场
  - `css/style.css` — modal-overlay opacity transition、.drag-over 规则、tab 指示条 transition

## ADDED Requirements

### Requirement: 棋盘入场序列（动作一）
系统 SHALL 在进入战斗页面时播放"战雾消散 + 六边形逐圈显现 + 棋子落入"的入场序列，与现有 liftCurtain 帷幕升起同步。

#### Scenario: 进入战斗页
- **WHEN** 玩家从准备界面进入战斗页面
- **THEN** 画布覆盖 `rgba(15,10,5,0.6)` 战雾，0.5s `power2.out` 淡出
- **AND** 六边形从中心向外逐圈显现（stagger 0.04s/圈，每格 opacity 0→1 + scale 0.92→1，`back.out(1.4)`）
- **AND** 棋子最后落入格位（scale 0.4→1 + y 12→0，0.4s，`back.out(1.4)`，stagger 0.03s）
- **AND** 现有 liftCurtain 帷幕升级行为完全不变

### Requirement: 棋子苏醒选择反馈（动作二）
系统 SHALL 在玩家选中己方棋子时播放 scale 弹性动画 + 地面光环脉冲。

#### Scenario: 选中棋子
- **WHEN** 玩家点击选中己方棋子
- **THEN** 棋子 scale 0.92→1.06→1，0.4s，`back.out(1.4)`
- **AND** 棋子下方出现金色径向光环，scale 0→1.2 + opacity 0→0.6→0.35，0.5s `power2.out`
- **AND** 光环随后保持 0.35 透明度脉冲（`sine.inOut` 1.8s loop，opacity 0.25↔0.45）
- **AND** 现有金色双描边发光完全保留，叠加在光环之上

### Requirement: 攻击冲击动作（动作三）
系统 SHALL 在 `executeCombat` 攻击发生时播放攻击方前冲 + 径向冲击波 + 微震（仅暴击/溃逃）。

#### Scenario: 攻击发生
- **WHEN** `executeCombat` 触发攻击
- **THEN** 攻击方棋子向目标方向前冲 8px，0.1s `power2.out`，再 0.15s `power2.in` 回弹
- **AND** 防守方位置生成金色径向冲击波，scale 0.3→2.5 + opacity 0.8→0，0.4s `power2.out`
- **AND** 暴击/溃逃类型触发画布微震 1 帧（translate 2px 随机方向），普通攻击不震屏
- **AND** 现有伤害飘字完全保留，叠加在冲击波之上

### Requirement: 敌方棋子移动动画
系统 SHALL 在敌方棋子移动时播放与玩家方相同的滑动动画（260ms + 拖影），而非瞬移。

#### Scenario: 敌方移动
- **WHEN** AI 回合中 `aiExecuteMove()` 被调用
- **THEN** 棋子从原位置滑动到目标位置，显示半透明拖影
- **AND** 动画完成后才执行后续攻击（原 350ms 间隔调整为 `max(350, 280)`）
- **AND** 玩家方原有移动动画行为完全不变

### Requirement: Modal 退出动画（统一对称）
系统 SHALL 为所有目前无退出动画的 modal 添加统一退出动画。

#### Scenario: 关闭 modal
- **WHEN** 用户关闭装备选择器、背包、关卡结算、召唤结果、AI 结算等 modal
- **THEN** modal 内容执行 `opacity 1→0, y 0→-15, scale 1→0.96`，0.2s `power2.in`
- **AND** 动画完成后再 `modal.remove()`
- **AND** 现有入场动画完全不变

### Requirement: 结算 modal 入场动画
系统 SHALL 为关卡结算和 AI 对战结算 modal 添加与召唤结果 modal 同风格的入场动画。

#### Scenario: 显示结算 modal
- **WHEN** 战斗结束触发 `showLevelSettlementModal` 或 `showAIBattleSettlement`
- **THEN** overlay opacity 0→1 0.3s
- **AND** 内容 `opacity 0, scale 0.85, rotationY -10 → 1`，0.5s `back.out(1.4)`
- **AND** 装备掉落卡片和奖励兵种卡片 stagger 入场（0.08s stagger, 0.4s duration, `back.out(1.4)`）

### Requirement: 数量计数动画
系统 SHALL 在积分、数量等数值变化时播放 GSAP 计数动画。

#### Scenario: 积分变化
- **WHEN** 商城购买、关卡完成等导致积分变化
- **THEN** 数值从旧值 tween 到新值，0.5s `power2.out`
- **WHEN** `prepInvBadge` 数量变化
- **THEN** 额外弹跳放大 scale 1.3→1，0.3s `back.out`

### Requirement: Tab 切换过渡动画
系统 SHALL 在 tab 切换时为新内容添加 fade-in + stagger 动画。

#### Scenario: 切换 tab
- **WHEN** 用户在商城或背包切换 tab
- **THEN** 新 tab 内容 `opacity 0, y 10 → 1`，0.3s `power2.out`，列表项 stagger 0.04s
- **AND** tab active 指示条 `transition: all 0.3s cubic-bezier(.34,1.56,.64,1)`

### Requirement: 列表项 stagger 入场
系统 SHALL 为背包物品、召唤历史、商城卡片、结算掉落卡片等列表添加 stagger 入场。

#### Scenario: 列表渲染
- **WHEN** `buildInventory`、`buildSummonPage`、`buildShop` 等渲染列表
- **THEN** 列表项 `opacity 0, y 10 → 1`，0.3s `power2.out`，stagger 0.04s

### Requirement: 物品移除动画
系统 SHALL 在物品被出售时播放 fade-out + scale 动画。

#### Scenario: 出售物品
- **WHEN** 用户在背包出售物品
- **THEN** 物品卡片 `opacity 1→0, scale 1→0.8`，0.3s `power2.in`
- **AND** 动画完成后再 splice 数据并重建列表

### Requirement: 棋子放置/回收反馈动画
系统 SHALL 在部署阶段为棋子放置和回收添加视觉反馈。

#### Scenario: 放置棋子
- **WHEN** 用户拖拽棋子到棋盘
- **THEN** 棋子 `scale 0.5→1`，0.3s `back.out(1.4)`
- **AND** 地面金色圆环 `scale 0→1.5, opacity 0.6→0`（一次性小光环，区别于选中持续脉冲）
- **WHEN** 用户双击棋子回收到 bench
- **THEN** 棋子 `scale 1→0.5, opacity 1→0`，0.25s `power2.in`

### Requirement: Toast 入场动画（激活 showToastAnim）
系统 SHALL 在 `showToast` 中调用 `showToastAnim`，使用 GSAP 入场。

#### Scenario: 显示 toast
- **WHEN** `showToast` 被调用
- **THEN** toast 元素 `opacity 0, y -20, scale 0.9 → 1`，0.3s `back.out(1.4)`
- **AND** 现有 toast 内容和淡出行为不变

### Requirement: 召唤结果 revealCard（激活死代码）
系统 SHALL 在召唤结果 modal 内容上调用 `SummonAnimations.revealCard`，叠加在现有入场动画上。

#### Scenario: 召唤结果显现
- **WHEN** 召唤 ritual 完成，结果 modal 显示
- **THEN** modal 内容 `rotationY 90→0, scale 0.5→1, opacity 0→1`，0.6s `back.out(1.4)`
- **AND** 现有 modal 入场 timeline 完全保留

### Requirement: 锁定关卡点击反馈
系统 SHALL 在用户点击锁定关卡卡片时播放 shake 动画。

#### Scenario: 点击锁定关卡
- **WHEN** 用户点击 `.level-locked` 卡片
- **THEN** 卡片 `translateX -5→5→-3→3→0`，0.4s

### Requirement: 离屏 Canvas 静态层缓存
系统 SHALL 将棋盘背景预渲染到离屏 canvas，主渲染循环通过 `drawImage` 复制。

#### Scenario: 进入战斗页面
- **WHEN** 战斗页面初始化或 canvas 尺寸变化
- **THEN** 系统构建离屏背景 canvas 并缓存
- **AND** 后续 render() 调用 `drawImage` 复制背景层
- **AND** 高亮状态（sp/mv/atk/hv）的六边形仍实时叠加绘制

### Requirement: 单位图像缓存
系统 SHALL 为每个 `(unitType, team)` 组合预渲染单位图像到离屏 canvas。

#### Scenario: 绘制单位
- **WHEN** render() 需要绘制某单位
- **THEN** 系统从缓存 `drawImage` 对应的离屏 canvas
- **AND** HP 条、士气条、状态图标、朝向三角形、名称标签、选中光环、冲击波仍每帧实时绘制
- **AND** 单位图片异步加载完成后失效该缓存并 `requestRender()` 触发重绘

### Requirement: 脏标记渲染优化（保留持续 rAF 循环）
系统 SHALL 保留持续 rAF 循环，但在循环内部增加脏标记判断。

#### Scenario: 无状态变化
- **WHEN** rAF 循环触发但无任何状态变化、无移动动画
- **THEN** 跳过 render() 调用，保持上一帧画面
- **WHEN** 任何代码调用 `requestRender()` 设置脏标记
- **THEN** 下一个 rAF 帧执行 render() 并清除脏标记
- **AND** 有移动动画、选中弹性、冲击震动等主动画期间持续渲染

### Requirement: requestRender() API
系统 SHALL 提供 `requestRender()` 全局函数替代直接调用 `render()`。

#### Scenario: 多次状态变化合并
- **WHEN** 同一帧内多次调用 `requestRender()`
- **THEN** 仅在下一个 rAF 帧执行一次 render()
- **AND** 有移动动画进行时，rAF 循环持续 render() 直到动画结束

### Requirement: computeStats 结果缓存
系统 SHALL 缓存 `computeStats(unitDef)` 结果，键为 unitType。

#### Scenario: 选中棋子时每帧渲染
- **WHEN** render() 需要计算选中棋子的移动/攻击范围
- **THEN** 系统从缓存读取 stats
- **WHEN** 装备或品阶变化时调用 `invalidateStatsCache(unitType)`
- **THEN** 下次 render() 重新计算并更新缓存

### Requirement: 伤害飘字对象池
系统 SHALL 预创建 DOM 元素池用于伤害飘字，循环复用。

#### Scenario: 连续多次攻击
- **WHEN** 战斗中触发多次 showDamageNumber
- **THEN** 系统从对象池获取空闲元素，重置位置、文本、className 和样式后使用
- **AND** 动画结束后归还到对象池（display:none）而非 remove
- **AND** 现有伤害飘字动画效果完全不变

### Requirement: ParticleBG 余烬 sprite 预渲染
系统 SHALL 将余烬的 radial gradient 光晕预渲染为离屏 canvas sprite。

#### Scenario: 主菜单粒子背景运行
- **WHEN** ParticleBG 运行中
- **THEN** 每个 ember 的光晕通过 `drawImage(sprite)` 绘制而非每帧 `createRadialGradient`
- **AND** 现有粒子动画视觉效果完全不变

### Requirement: mousemove 节流
系统 SHALL 使用 requestAnimationFrame 合并多个 mousemove 事件为单次脏标记设置。

#### Scenario: 快速移动鼠标
- **WHEN** 用户在棋盘上快速移动鼠标
- **THEN** 每帧最多设置一次脏标记
- **AND** 移除 interactions.js mousemove handler 末尾冗余的 `render()` 调用
- **AND** 现有悬停高亮行为完全不变
- **AND** 仅在 `hoveredHex` 真正变化时才更新 tooltip

## MODIFIED Requirements

### Requirement: AI 回合渲染调用
AI 回合中的 `runAITurn` / `processUnitWithAnim` / `processNext` 不再在每个动作后显式调用 `render()`，改为 `requestRender()`。视觉行为不变。

### Requirement: combat.js 渲染调用
`executeCombat` 和 `executeOpportunityAttack` 中的 `render()` 调用改为 `requestRender()`，并新增 `shakePiece` 调用。伤害飘字等视觉效果完全不变。

### Requirement: 战斗预览更新
`updateCombatPreview` 仅在悬停目标六边形变化时重新计算并更新 tooltip。tooltip 内容和样式不变。
