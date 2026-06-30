# Tasks

## Part A: 三大核心动作（设计驱动）

- [ ] Task 1: 动作一——棋盘入场序列（战雾+逐圈显现+棋子落入）
  - [ ] SubTask 1.1: 在 `js/hex-board.js` 新增 `_boardEntryAnim` 状态（start, duration, phase），在 `startBattlePage` 时触发
  - [ ] SubTask 1.2: 在 `render()` 中根据 `_boardEntryAnim` 进度绘制 `rgba(15,10,5,0.6)` 战雾遮罩，0.5s `power2.out` 淡出
  - [ ] SubTask 1.3: 六边形按距中心 `hDist` 排序，每圈 stagger 0.04s，每格 `opacity 0→1 + scale 0.92→1`，`back.out(1.4)`
  - [ ] SubTask 1.4: 棋子在六边形显现后落入格位（`scale 0.4→1 + y 12→0`，0.4s，`back.out(1.4)`，stagger 0.03s）
  - [ ] SubTask 1.5: 与现有 `liftCurtain` 帷幕升起同步，不替换
  - [ ] SubTask 1.6: 入场动画期间持续渲染（_needsRender=true），完成后改为脏标记驱动

- [ ] Task 2: 动作二——棋子苏醒选择反馈
  - [ ] SubTask 2.1: 在 `js/hex-board.js` 新增 `_selectAnim` 状态（pieceKey, start, duration=400）
  - [ ] SubTask 2.2: 在 `js/interactions.js` 选中棋子时触发 `_selectAnim`，并 `requestRender()` 持续 0.5s
  - [ ] SubTask 2.3: 在 `render()` 的 drawHex 中，对选中棋子应用 `scale 0.92→1.06→1` 弹性（基于 `_selectAnim` 时间，`back.out(1.4)`）
  - [ ] SubTask 2.4: 在棋子下方绘制金色径向光环：`scale 0→1.2 + opacity 0→0.6→0.35`，0.5s `power2.out`
  - [ ] SubTask 2.5: 光环进入稳态后保持 `sine.inOut` 1.8s loop 脉冲（opacity 0.25↔0.45）
  - [ ] SubTask 2.6: 现有金色双描边发光完全保留，叠加在光环之上

- [ ] Task 3: 动作三——攻击冲击动作
  - [ ] SubTask 3.1: 在 `js/hex-board.js` 填充 `shakePiece(atkHex, dir)` 实现：通过 `_shakeAtkHex` + `_shakeStart` 临时状态在 render 中绘制棋子偏移，0.25s 后清除
  - [ ] SubTask 3.2: 偏移量沿 `getDirectionBetween` 计算的角度，前冲 8px，0.1s `power2.out`，再 0.15s `power2.in` 回弹
  - [ ] SubTask 3.3: 在 `js/animations.js` 新增 `showImpactWave(hex)` 函数，绘制金色径向冲击波 `scale 0.3→2.5 + opacity 0.8→0`，0.4s `power2.out`（canvas 绘制或 DOM 元素）
  - [ ] SubTask 3.4: 在 `js/combat.js` 的 `executeCombat` 中调用 `shakePiece(atkHex, dir)` 和 `showImpactWave(defHex)`
  - [ ] SubTask 3.5: 暴击/溃逃类型触发画布微震 1 帧（translate 2px 随机方向），普通攻击不震屏
  - [ ] SubTask 3.6: 现有伤害飘字完全保留，叠加在冲击波之上

## Part B: 配套动画（遵循共享设计语言）

- [ ] Task 4: 敌方棋子移动动画（关键修复）
  - [ ] SubTask 4.1: 在 `js/ai-engine.js` 的 `aiExecuteMove()` 中，于 `delete placedPieces[oldKey]` 之前调用 `startPieceMoveAnim(aiUnit.key, oldHex, newHex, 260, callback)`
  - [ ] SubTask 4.2: 调整 `processUnitWithAnim` 中的 setTimeout 时序，原 350 间隔改为 `max(350, 280)` 确保动画完成
  - [ ] SubTask 4.3: 验证玩家方移动动画行为完全不变

- [ ] Task 5: Modal 退出动画（统一对称）
  - [ ] SubTask 5.1: 在 `js/inventory-ui.js` 的 `closeEquipPicker` 添加 GSAP 退出（`opacity 1→0, y 0→-15, scale 1→0.96`，0.2s `power2.in`），onComplete 后 `remove()`
  - [ ] SubTask 5.2: 在 `js/inventory-ui.js` 的 `closeInventory` 添加同样退出动画
  - [ ] SubTask 5.3: 在 `js/levels-ui.js` 的 `closeLevelBattleSettlement` 添加退出动画
  - [ ] SubTask 5.4: 在 `js/summon-ui.js` 的 `closeSummonModal` 添加退出动画
  - [ ] SubTask 5.5: 在 `css/style.css` 为 `.modal-overlay` 添加 opacity transition

- [ ] Task 6: 结算 modal 入场动画
  - [ ] SubTask 6.1: 在 `js/levels-ui.js` 的 `showLevelSettlementModal` 添加 GSAP 入场（overlay 0.3s 淡入 + 内容 `opacity 0, scale 0.85, rotationY -10 → 1` 0.5s `back.out(1.4)` + 装备掉落卡片 stagger 0.08s）
  - [ ] SubTask 6.2: 在 `js/ai-battle.js` 的 `showAIBattleSettlement` 添加同样入场 + 奖励兵种卡片 stagger
  - [ ] SubTask 6.3: 在 `js/ai-battle.js` 的 `showAIUnitDetail` 添加入场动画

- [ ] Task 7: 数量计数动画
  - [ ] SubTask 7.1: 在 `js/ui-utils.js` 新增 `animateNumber(el, from, to, duration=500)` 工具函数（GSAP tween，`power2.out`）
  - [ ] SubTask 7.2: 在 `js/shop-system.js` 的 `refreshPointsDisplay` 调用 `animateNumber`
  - [ ] SubTask 7.3: 在 `js/main.js` 的 `refreshPrepPage` 调用 `animateNumber`
  - [ ] SubTask 7.4: 在 `js/main.js` 的 `prepInvBadge` 数量更新处添加 `scale 1.3→1`，0.3s `back.out`
  - [ ] SubTask 7.5: 在结算 modal 的 `+pointsDelta` 显示中调用 `animateNumber`

- [ ] Task 8: Tab 切换动画
  - [ ] SubTask 8.1: 在 `js/shop-system.js` 的 `switchShopTab` 中，tab 内容渲染后调用 `PageTransitions.staggerItems`（`opacity 0, y 10 → 1`，0.3s `power2.out`，stagger 0.04s）
  - [ ] SubTask 8.2: 在 `js/inventory-ui.js` 的 `switchInvTab` 中同样调用
  - [ ] SubTask 8.3: 在 `css/style.css` 为 tab active 指示条添加 `transition: all 0.3s cubic-bezier(.34,1.56,.64,1)`

- [ ] Task 9: 列表项 stagger 入场
  - [ ] SubTask 9.1: 在 `js/inventory-ui.js` 的 `buildInventory` 末尾对 `.inv-item` 调用 stagger
  - [ ] SubTask 9.2: 在 `js/summon-ui.js` 的 `buildSummonPage` 末尾对 `.sh-item` 调用 stagger
  - [ ] SubTask 9.3: 在 `js/shop-system.js` 的 `buildShop` 末尾调用 stagger（仅初次渲染或 tab 切换时）

- [ ] Task 10: 物品移除动画
  - [ ] SubTask 10.1: 在 `js/inventory-ui.js` 的 `sellInventoryItem` 中，先对物品卡片执行 `opacity 1→0 + scale 1→0.8`（0.3s `power2.in`），onComplete 后 splice 重建

- [ ] Task 11: 棋子放置/回收反馈
  - [ ] SubTask 11.1: 在 `js/hex-board.js` 新增 `_placeAnim` 状态（hex, start, duration=300），在 render 中绘制一次性金色圆环 `scale 0→1.5, opacity 0.6→0`
  - [ ] SubTask 11.2: 在 `js/interactions.js` 的 drop handler 中（部署阶段），放置成功后触发 `_placeAnim`，棋子 `scale 0.5→1` `back.out(1.4)`
  - [ ] SubTask 11.3: 在 `js/interactions.js` 的双击 recycle 处理中，先执行棋子 `scale 1→0.5, opacity 1→0`（0.25s `power2.in`），onComplete 后实际移除
  - [ ] SubTask 11.4: 在 `css/style.css` 添加 `.drag-over` 规则（高亮边框 + 微微放大）

- [ ] Task 12: 激活死代码
  - [ ] SubTask 12.1: 在 `js/ui-utils.js` 的 `showToast` 中调用 `showToastAnim`（`opacity 0, y -20, scale 0.9 → 1`，0.3s `back.out(1.4)`）
  - [ ] SubTask 12.2: 在 `js/summon-ui.js` 的召唤结果 modal 内容上调用 `SummonAnimations.revealCard`（`rotationY 90→0, scale 0.5→1, opacity 0→1`，0.6s `back.out(1.4)`），叠加在现有入场之上

- [ ] Task 13: 锁定关卡点击反馈
  - [ ] SubTask 13.1: 在 `js/levels-ui.js` 的 `buildLevelCard` 中，对 locked 卡片添加点击 shake（`translateX -5→5→-3→3→0`，0.4s）

## Part C: 帧率优化（让上述动画流畅运行）

- [ ] Task 14: 实现离屏 Canvas 静态层缓存
  - [ ] SubTask 14.1: 在 `js/hex-board.js` 新增 `_bgCanvas`、`_bgCtx` 和 `buildBackgroundCache()`，将六边形填充+描边+坐标轴绘制到离屏 canvas
  - [ ] SubTask 14.2: 修改 `render()`，背景部分替换为 `ctx.drawImage(_bgCanvas, 0, 0)`，仅高亮状态（sp/mv/atk/hv）实时叠加
  - [ ] SubTask 14.3: 在 `ensureCtx()` 完成后调用 `buildBackgroundCache()`，canvas 尺寸变化时重建

- [ ] Task 15: 实现单位图像缓存
  - [ ] SubTask 15.1: 在 `js/hex-board.js` 新增 `_unitImgCache = {}` 和 `getCachedUnitImage(unitType, team)`，返回预渲染好的离屏 canvas（含圆形裁剪、边框、底色）
  - [ ] SubTask 15.2: 修改 `drawUnitOnCanvas()`，优先使用缓存图像 drawImage，无缓存时回退到原有路径
  - [ ] SubTask 15.3: 图片异步加载完成后失效该 unitType 缓存并 `requestRender()` 触发重绘
  - [ ] SubTask 15.4: 确保动画中棋子（drawAnimatingPiecesOnCanvas）也使用缓存图像

- [ ] Task 16: 实现 computeStats 缓存
  - [ ] SubTask 16.1: 在 `js/hex-board.js` 顶部添加 `_statsCache = {}`，键为 unitType
  - [ ] SubTask 16.2: 提供 `invalidateStatsCache(unitType)` 函数，在装备/品阶变化时调用
  - [ ] SubTask 16.3: 修改 `render()` 中 `computeStats(ud)` 调用改为读取缓存

- [ ] Task 17: 实现脏标记渲染优化（保留持续 rAF 循环）
  - [ ] SubTask 17.1: 在 `js/hex-board.js` 新增 `_needsRender = false` 和 `requestRender()` 全局函数（导出到 window）
  - [ ] SubTask 17.2: 修改 `startAnimLoop()` 的 loop() 内部：仅当 `_needsRender=true` 或 `isAnyPieceAnimating()=true` 或有主动画（入场/选中/冲击）进行时执行 render()，否则跳过；render() 后清除脏标记
  - [ ] SubTask 17.3: **不修改** startAnimLoop/stopAnimLoop 的调用时机
  - [ ] SubTask 17.4: 验证进入战斗页面后 rAF 循环持续运行，退出时停止（行为不变）

- [ ] Task 18: 将外部 render() 调用改为 requestRender()
  - [ ] SubTask 18.1: 在 `js/interactions.js` 的 mousemove handler 移除末尾 `render()`，改为 `requestRender()`
  - [ ] SubTask 18.2: 在 `js/interactions.js` 的 mouseleave/click 等其他 render() 调用点改为 `requestRender()`（保持 startPieceMoveAnim 的 onComplete 中 render 不变）
  - [ ] SubTask 18.3: 优化 `updateCombatPreview`，仅在 `hoveredHex` 真正变化时才重新计算和更新 tooltip
  - [ ] SubTask 18.4: 审查 `js/ai-engine.js` 的 `runAITurn` / `processUnitWithAnim` / `processNext` 中 10 处 `render()`，全部改为 `requestRender()`
  - [ ] SubTask 18.5: 在 `js/combat.js` 的 `executeCombat` 和 `executeOpportunityAttack` 中将 `render()` 改为 `requestRender()`
  - [ ] SubTask 18.6: 在 `js/turn-system.js` 中将 render() 调用改为 `requestRender()`（如有）

- [ ] Task 19: 实现伤害飘字对象池
  - [ ] SubTask 19.1: 在 `js/animations.js` 新增 `_dmgPool = []` 和 `getDmgElement()` / `releaseDmgElement(el)` 函数
  - [ ] SubTask 19.2: 修改 `showDamageNumber()`，从对象池获取元素，动画结束后归还（display:none）而非 remove
  - [ ] SubTask 19.3: 同样对 `combat-flash` 元素实现对象池
  - [ ] SubTask 19.4: 确保动画效果与原来完全一致

- [ ] Task 20: ParticleBG 余烬 sprite 预渲染
  - [ ] SubTask 20.1: 在 `js/animations.js` 的 ParticleBG 模块新增 `buildEmberSprites()`，预渲染几种 size 的余烬光晕到离屏 canvas
  - [ ] SubTask 20.2: 修改 `drawEmbers()`，使用 `drawImage(sprite)` 替代 `createRadialGradient`
  - [ ] SubTask 20.3: 验证粒子背景视觉效果与原来一致

## Part D: 验证与回归测试

- [ ] Task 21: 验证与回归测试
  - [ ] SubTask 21.1: 验证棋盘入场序列（战雾+逐圈+棋子落入）正常，liftCurtain 同步
  - [ ] SubTask 21.2: 验证棋子选中弹性 + 地面光环脉冲正常，现有金色描边保留
  - [ ] SubTask 21.3: 验证攻击冲击（前冲+冲击波+微震）正常，伤害飘字保留
  - [ ] SubTask 21.4: 验证玩家方移动动画仍正常（260ms 滑动 + 拖影）
  - [ ] SubTask 21.5: 验证敌方移动动画现在正常播放（与玩家方一致）
  - [ ] SubTask 21.6: 验证伤害飘字对象池无内存泄漏
  - [ ] SubTask 21.7: 验证选中棋子时高亮、移动范围、攻击范围正确显示
  - [ ] SubTask 21.8: 验证 HP/士气条、状态图标、朝向三角形实时更新
  - [ ] SubTask 21.9: 验证战斗预览 tooltip 在悬停切换目标时正确更新
  - [ ] SubTask 21.10: 验证所有 modal 入场和退出动画对称且无闪烁
  - [ ] SubTask 21.11: 验证积分计数、tab 切换、列表 stagger 动画正常
  - [ ] SubTask 21.12: 验证棋子放置/回收反馈、锁定关卡 shake、Toast 入场、revealCard 动画
  - [ ] SubTask 21.13: 验证召唤动画、页面过渡、Toast 动画等其他动画完全不变
  - [ ] SubTask 21.14: 验证进入/退出战斗页面时动画循环正确启停（行为不变）
  - [ ] SubTask 21.15: 验证 ParticleBG 视觉效果不变，但 CPU 占用降低
  - [ ] SubTask 21.16: 性能对比：使用 Performance 面板观察 render() 调用频率和单次耗时，确认帧率提升

# Task Dependencies

## Part A（三大核心动作）
- Task 1（入场序列）、Task 2（选择反馈）、Task 3（冲击动作）相互独立，可并行
- Task 3 依赖 `requestRender()`（Task 17）和冲击波绘制（SubTask 3.3 自包含）

## Part B（配套动画）
- Task 4（敌方动画）独立，可最先实施
- Task 5（modal 退出）、Task 6（结算入场）、Task 7（计数）、Task 8（tab）、Task 9（stagger）、Task 10（物品移除）、Task 11（棋子放置）、Task 12（死代码）、Task 13（锁定关卡）相互独立，可并行
- Task 7.1（animateNumber 工具函数）是 Task 7 其他子任务的前置

## Part C（帧率优化）
- Task 17（脏标记渲染）是核心，Task 18 依赖 Task 17 提供的 `requestRender()`
- Task 14、15、16 可与 Task 17 并行（独立的缓存优化）
- Task 19（对象池）、Task 20（ParticleBG sprite）独立，可并行

## Part D（验证）
- Task 21 依赖所有其他任务完成
