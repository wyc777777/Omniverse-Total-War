# AI 路径引导文件

> **AI Agent 必读**：当用户提出需求时，请先在此文件中查找相关文件路径和功能说明，找不到再去其他地方搜索。
> 本文件按模块分类列出所有 JS 和 asset 文件的主要功能及包含的函数名。

---

## 目录

- [JS 文件 - 核心模块](#js-文件---核心模块)
- [JS 文件 - AI 引擎系统](#js-文件---ai-引擎系统)
- [JS 文件 - 动画系统](#js-文件---动画系统)
- [JS 文件 - 备战席系统](#js-文件---备战席系统)
- [JS 文件 - 战斗系统](#js-文件---战斗系统)
- [JS 文件 - 数据引擎系统](#js-文件---数据引擎系统)
- [JS 文件 - 装备效果配置](#js-文件---装备效果配置)
- [JS 文件 - 兜底数据](#js-文件---兜底数据)
- [JS 文件 - 棋盘引擎](#js-文件---棋盘引擎)
- [JS 文件 - 交互系统](#js-文件---交互系统)
- [JS 文件 - 背包与装备UI](#js-文件---背包与装备ui)
- [JS 文件 - 关卡选择UI](#js-文件---关卡选择ui)
- [JS 文件 - 主入口与页面控制](#js-文件---主入口与页面控制)
- [JS 文件 - 核心服务模块](#js-文件---核心服务模块)
- [JS 文件 - UI 系统](#js-文件---ui-系统)
- [JS 文件 - 数据系统](#js-文件---数据系统)
- [JS 文件 - UI 系统（续）](#js-文件---ui-系统续)
- [JS 文件 - 召唤系统](#js-文件---召唤系统)
- [JS 文件 - 回合系统](#js-文件---回合系统)
- [JS 文件 - UI 工具](#js-文件---ui-工具)
- [Asset 文件 - 数据配置](#asset-文件---数据配置)
- [Asset 文件 - 图片资源](#asset-文件---图片资源)

---

## JS 文件 - 核心模块

### js/ai-battle.js

**主要功能**：AI对战基础框架，包括AI对手生成、AI对战页面构建、斗蛐蛐（双AI/双人）对战模式。负责生成AI对手兵团、匹配对手、对战结算、缴获兵种等完整的AI对战流程。

**包含的全局变量**：
- `AI_NAME_PREFIXES` / `AI_NAME_SUFFIXES` — AI对手名称词库
- `AI_TIER_DIFFICULTY` — 品阶难度配置（黑铁/青铜/黄金/钻石）
- `AI_TIER_ICON_STYLE` — 品阶图标样式映射
- `AI_BASE_TYPE_CONFIG` — 兵种类型配置（步兵/骑兵/远程兵/空军/野兽步兵）
- `AI_BATTLE_STATE` — AI对战运行时状态
- `DUEL_STATE` — 斗蛐蛐对战模式状态（sideA/sideB）
- `AI_UNIT_TYPE_COUNTER` — AI单位类型唯一计数器

**包含的函数**：
- `genAIUnitType()` — 生成唯一AI单位type
- `generateAIOpponentName()` — 生成随机对手名
- `generateAIOpponent(useLLM)` — 主入口：生成AI对手（规则生成，预留LLM接口）
- `generateAIUnitDef(tier, index, usedBaseTypes)` — 生成单支AI单位（参考summon-engine简化版）
- `tierToSummonTier(tier)` — 品阶转召唤档次
- `pickEquipmentByTier(tier, baseType, raceId, typeCfg)` — 按品阶配装
- `pickEquipFromED(category, tier, extraFilter)` — 从ED指定分类中按品阶筛选随机选一个
- `pickWeaponByTierAndType(tier, weaponTypes, baseType)` — 按品阶和类型选武器
- `pickArmorByTierAndType(tier, baseType, raceId)` — 按品阶和类型选护甲
- `pickMountByTierAndType(tier, requireFlying)` — 按品阶选坐骑
- `generateAIUnitName(baseType, raceData, tier, index)` — 生成AI兵种名称
- `generateAIBackground(baseType, raceData, tier)` — 生成AI兵种背景描述
- `getBaseTypeIcon(baseType)` — 获取兵种类型图标emoji
- `injectAIOpponentUnits(opponent)` — 注入AI对手单位到数据中心
- `clearAIOpponentUnits(keepUnitIds)` — 清理AI对手临时单位（保留被领取的）
- `applyAIBattleMultiplier(opponent, multiplier)` — 给AI对手应用属性倍率
- `buildAIBattlePage()` — 构建AI对战页面
- `onFindAIOpponent()` — 跨次元搜寻（调用AI生成对手）
- `cancelAIFind()` — 取消AI搜寻
- `convertAIGeneratedOpponent(data)` — 将AI生成的JSON转成游戏内unitDef格式
- `pickWeaponByAIType(tier, aiType, baseType)` — 根据AI指定的武器类型从装备库匹配
- `pickArmorByAIType(tier, aiType)` — 根据AI指定的护甲类型从装备库匹配
- `showMatchNotification(data)` — 匹配成功通知弹窗
- `autoStartBattle()` — 自动进入战斗
- `refreshAIOpponentDisplay()` — 刷新对手信息展示
- `onStartAIBattle()` — 开始对战按钮处理
- `showAIBattleSettlement(result, pointsDelta, report, droppedItems)` — AI对战胜利结算（显示兵种选择界面）
- `showAIUnitDetail(idx)` — 查看兵种详情
- `claimAIBattleUnit(unitIdx)` — 领取兵种（加入玩家部队）
- `skipAIBattleReward()` — 跳过兵种奖励
- `closeAIUnitDetail()` — 关闭兵种详情弹窗
- `closeAIBattleSettlement(keepUnitIds)` — 关闭AI对战结算弹窗并返回主页
- `buildDuelArenaPage()` — 构建斗蛐蛐双方配置页
- `buildDuelSidePanel(side, titleText)` — 构建单方配置面板
- `bindDuelSideEvents(side)` — 绑定单方事件
- `onDuelGenerateSide(side)` — 生成单方阵容
- `renderDuelSideUnits(side)` — 渲染单方单位列表
- `clearAIOpponentUnitsForDuelSide(side)` — 清理斗蛐蛐某侧临时单位
- `refreshDuelStartBtn()` — 刷新开战按钮可用状态
- `startDuelBattle()` — 斗蛐蛐开战入口
- `showDuelBattleSettlement(result)` — 斗蛐蛐模式结算弹窗
- `closeDuelSettlementAndReturn()` — 关闭斗蛐蛐结算并返回

> **更新记录**：每新增/修改一个文件后，必须同步更新此 AI_PATH_GUIDE.md 文件

---

## JS 文件 - AI 引擎系统

### js/ai-engine.js

**主要功能**：AI引擎系统，提供三档难度（简单/困难/传说）的AI行为决策。包括目标选择策略、移动策略、攻击决策、指挥官统筹层、兵种分类逻辑、AI主回合循环等完整的AI对战行为系统。

**包含的全局变量/常量**：
- `AI_HEX_DIRS` — 六边形方向向量（6个方向）
- `AI_DIFFICULTY_CONFIG` — AI难度配置（easy/hard/legend三档）
- `DIFF_MAP` — 兼容旧代码的难度映射
- `AIState` — AI状态追踪（difficulty/config/assignedTargets/actedThisTurn/formationCenter/focusedTargetKey）

**包含的函数**：
- `isRangedWeapon(st)` — 远程武器识别辅助函数
- `getAIConfig(difficulty)` — 获取当前难度配置（优先从difficulty_config.json读取）
- `initAIState(difficulty)` — 初始化AI状态
- `aiTargetNearest(aiUnit, enemies)` — 最近目标选择（简单难度）
- `aiTargetSmart(aiUnit, enemies)` — 智能目标选择（困难难度：血量低优先+远程优先+距离）
- `aiTargetTactical(aiUnit, enemies)` — 战术目标选择（传说难度：按优先级打分）
- `aiTargetRandom(enemies)` — 随机选择目标
- `aiSelectTarget(aiUnit, enemies)` — 主目标选择函数（按策略分发）
- `aiGetMoveCandidates(aiUnit, maxSteps)` — 获取所有可用移动位置（BFS）
- `aiMoveToward(aiUnit, target)` — 朝向目标移动（简单难度）
- `aiMoveCoordinated(aiUnit, target, allies, enemies)` — 困难难度移动策略（背袭>侧袭>正击+保守模式）
- `aiMoveLegend(aiUnit, target, allies, enemies)` — 传说难度移动策略（分兵种走位+集火+骑兵切后排）
- `aiFindRetreat(aiUnit, enemies, allies)` — 士气崩溃撤退：远离敌人靠近友方
- `aiFindKillableTarget(aiUnit, enemies, st)` — 查找当前可击杀目标（预估伤害≥目标当前HP，用于低血量优先击杀）
- `aiFindKillableInRange(aiUnit, enemies, st)` — 查找移动+攻击范围内可击杀目标（用于偷袭应对）
- `aiIsAdjacentToInfantry(hex, enemies)` — 检查某格是否在敌方近战步兵1格内（偷袭应对辅助）
- `aiRangerFindCover(aiUnit, enemies)` — 弓兵保护逻辑（困难+传说共用）
- `aiCommanderPlan(enemyPieces, playerPieces)` — 指挥官统筹层：回合开始评估全局，输出战术方针和行动顺序
- `aiSortActionOrder(enemyPieces, playerPieces, plan)` — 行动顺序排序（必逃→必杀→必攻→配合移动→推进→站桩）
- `aiClassify(aiUnit, st)` — 兵种分类（bow/crossbow/cavalry/infantry/flying/beast）
- `aiDecideMoveOptimize(aiUnit, enemies, allies, st)` — 当前能打到人时，寻找更好的位置
- `aiDecideMove(aiUnit, target, allies, enemies)` — 主移动决策函数（当前打不到任何人时调用）
- `aiCanAttack(aiUnit, target, st)` — 检测是否可以攻击（含弓兵近身禁射逻辑）
- `aiCalculateAggression(aiUnit, target, st)` — 计算攻击欲望（士气低时撤退）
- `aiGetFlankingBonus(attacker, defender)` — 侧翼包围加成计算
- `aiExecuteMove(aiUnit, moveTarget)` — 执行移动（含追击检查+朝向更新+移动动画）
- `aiExecuteAttack(aiUnit, target)` — 执行攻击（调用executeCombat+朝向更新）
- `runAITurn(team)` — AI主回合循环（按行动队列逐单位处理）
- `getAIDebugInfo()` — 获取AI调试信息

---

## JS 文件 - 动画系统

### js/animations.js

**主要功能**：动画系统，包含粒子背景、页面过渡动画、召唤动画、伤害飘字、冲击波效果等。基于 GSAP 和 Canvas 实现，提供多种视觉动效工具。

**包含的模块/全局变量**：
- `ParticleBG` — 主菜单粒子背景（战后余烬效果，Canvas流场粒子系统）
- `PageTransitions` — 页面过渡动画（淡入淡出、滑动、stagger交错动画）
- `SummonAnimations` — 召唤动画（召唤法阵、卡牌揭示）
- `_dmgPool` / `_DMG_POOL_MAX` — 伤害飘字对象池（最大20个）

**包含的函数（各模块内部）**：

ParticleBG 模块：
- `flowField(x, y, t)` — 多层正弦叠加流场（模拟热气湍流）
- `spawnEmber(randomY)` — 生成单个火星粒子
- `createEmbers()` — 创建火星粒子群
- `createAsh()` — 创建灰烬粒子群
- `buildEmberSprites()` — 预渲染火星sprite（优化性能）
- `getEmberSprite(size)` — 获取最接近尺寸的sprite
- `init(canvasId)` — 初始化粒子背景
- `resize()` — 调整画布尺寸
- `updateEmbers()` — 更新火星粒子位置
- `updateAsh()` — 更新灰烬粒子位置
- `drawEmbers()` — 绘制火星粒子
- `drawAsh()` — 绘制灰烬粒子
- `animate()` — 动画主循环
- `start()` — 开始动画
- `stop()` — 停止动画
- `destroy()` — 销毁并清理资源
- **暴露接口**: `init / start / stop / destroy`

PageTransitions 模块：
- `prepareStagger(selector, parent)` — 预隐藏元素（防止闪烁）
- `slideIn(element, direction)` — 滑入动画（up/down/left/right）
- `fadeIn(element, duration)` — 淡入动画
- `setSkipStagger(val)` — 设置是否跳过stagger动画
- `getSkipStagger()` — 获取是否跳过stagger动画
- `staggerItems(selector, parent, delay)` — 交错入场动画
- `pageTransition(oldPage, newPage, options)` — 页面切换过渡动画
- **暴露接口**: `slideIn / fadeIn / staggerItems / prepareStagger / pageTransition / setSkipStagger / getSkipStagger`

SummonAnimations 模块：
- `createSummonEffect(container, callback)` — 创建召唤法阵效果
- `revealCard(cardElement)` — 卡牌揭示动画
- **暴露接口**: `createSummonEffect / revealCard`

全局函数：
- `showToastAnim(toastEl)` — Toast提示动画
- `getDmgElement()` — 从对象池获取伤害飘字元素
- `releaseDmgElement(el)` — 释放伤害飘字元素回对象池
- `showImpactWave(x, y, parentEl)` — 冲击波效果
- `showDamageNumber(hex, text, type)` — 战斗伤害飘字动画

---

## JS 文件 - 备战席系统

### js/bench.js

**主要功能**：备战席系统，负责战斗前的单位放置准备。包含左右两个备战区（玩家/敌方），支持拖拽放置、槽位管理、单位放回等功能。

**包含的全局变量**：
- `BPS` — 备战席槽位数（默认10）
- `benchState` — 备战席状态数组（标记每个槽位是否可用）

**包含的函数**：
- `initBench()` — 初始化备战席（创建玩家和敌方槽位）
  - 内部函数 `createSlot(ct, slotIdx, team, unitType, labelNum, prefix)` — 创建带单位的槽位
  - 内部函数 `createEmptySlot(ct, slotIdx, label)` — 创建空槽位
- `getSlot(i)` — 根据索引获取槽位DOM元素
- `returnToBench(i)` — 将单位放回备战席（恢复槽位可拖拽状态）

---

## JS 文件 - 战斗系统

### js/combat.js

**主要功能**：交战引擎，实现完整的阶段0-4战斗解析。包括弓兵近战封锁、冲锋动能、长柄反骑、方位判定（正/侧/背）、核心伤害公式、战损与崩溃、追击/偷袭系统、战报生成等。

**包含的全局变量**：
- `lastWarReport` — 最近一次战报（供面板显示）
- `warReportLines` — 战报行数组

**包含的函数**：
- `isBowBlockedByAdjacentEnemy(piece)` — 检查弓兵是否被相邻敌军封锁（弓类被近身禁射，弩类无视）
- `executeCombat(atkKey, defKey)` — ★主入口：攻击方→防御方的完整战斗结算（阶段0-4）
- `computeCombatPreview(atkPiece, defPiece)` — 伤害预览（无副作用，用于悬停tooltip）
- `addWarReportLine(line)` — 添加战报行
- `generateWarReport(atkUD, defUD, atkSt, defSt, lostMen, routed)` — 生成战报HTML
- `showWarReport(report)` — 显示战报面板（AI对战/斗蛐蛐模式下隐藏）
- `tryOpportunityAttack(movingPieceKey)` — 尝试触发偷袭（仅近战步兵，在敌方移动时按品阶概率触发）
- `executeOpportunityAttack(atkKey, defKey)` — 执行偷袭攻击（全额伤害，固定-5士气）

### js/settlement-system.js

**主要功能**：战斗结算系统，负责胜利/失败判定触发、战斗结算流程分发、积分奖励计算、装备掉落收集等。作为各对战类型（关卡/AI对战/斗蛐蛐）的统一结算入口，胜负判定逻辑已迁移至 BattleService，此处为薄包装+结算流程调度。

**包含的函数**：
- `checkVictoryCondition()` — 检查胜负条件（委托 BattleService.checkVictory）
- `checkAndTriggerVictory()` — 检查并触发胜负（委托 BattleService.checkAndTrigger）
- `triggerBattleEnd(result)` — ★触发战斗结束（分发给关卡/AI对战/斗蛐蛐各自结算逻辑）
- `generateSettlementReport(result, pointsDelta)` — 生成结算报告文本
- `collectAIBattleEquipmentDrops()` — 收集AI对战装备掉落（随机2件非天然装备）

> **更新记录**：每新增/修改一个文件后，必须同步更新此 AI_PATH_GUIDE.md 文件

---

## JS 文件 - 数据引擎系统

### js/data-engine.js

**主要功能**：数据引擎，核心数据管理模块。负责品阶系统、兵种/种族/装备数据查询、属性计算（computeStats）、装备操作接口、图标路径生成、野兽种族判断、赞助单位创建等。

**包含的全局变量**：
- `RD / ED / UD / BT / UI` — 核心数据引用（种族/装备/兵种/战场/图片缓存）
- `BEAST_RACES` — 野兽种族ID列表
- `TIER_LEVELS` — 品阶定义（黑铁/青铜/黄金/钻石）
- `DEFAULT_TIER` — 默认品阶（黑铁）
- `CHINESE_WORLD_KEYS` — 中国风世界观key列表

**包含的函数**：
- `getTierInfo(tierId)` — 获取品阶信息对象
- `getTierMultiplier(tierId)` — 获取品阶加成系数
- `getTierName(tierId)` — 获取品阶中文名
- `getTierColor(tierId)` — 获取品阶颜色
- `compareTier(tierA, tierB)` — 比较两个品阶高低
- `getUnitTier(unitDef)` — 安全获取兵种品阶
- `getIconSuffix(baseType)` — 获取图标后缀名
- `getIconStyle(tier)` — 获取图标样式
- `getUnitImagePath(tier, baseType, worldKey)` — 获取兵种图片路径
- `getRace(id)` — 根据ID获取种族
- `findWeapon(id)` — 根据ID查找武器
- `findShield(id)` — 根据ID查找盾牌
- `findArmor(id)` — 根据ID查找护甲
- `findMount(id)` — 根据ID查找坐骑
- `getUnit(t)` — 根据type获取单位
- `unitDefByType(t)` — 根据type获取单位定义
- `isBeastRace(raceId)` — 判断是否为野兽种族
- `getRaceScale(raceId)` — 获取种族规模
- `getSizeCategory(raceId)` — 获取体型分类（小型/中型/大型）
- `getBareFistWeapon(race)` — 获取肉体默认武器（天然武器）
- `getNaturalArmor(race)` — 获取天然护甲
- `computeStats(unitDef)` — ★核心：计算兵种完整属性（优先委托UnitService）
- `computeStatsWithRace(unitDef, r)` — 基于种族的属性计算实现
- `unequipItem(unitDef, slot)` — 拆卸装备
- `equipItem(unitDef, slot, itemId)` — 装备物品
- `isEquipmentCompatible(unitDef, item)` — 检查装备是否适配
- `canEquipSlot(unitDef, slot)` — 检查槽位是否可装备
- `canUseShield(unitDef)` — 检查盾牌是否可用
- `getEquipmentApplicabilityText(item)` — 获取装备适用性文本（UI展示用）
- `preloadImages(cb)` — 预加载图片
- `createSponsorUnits()` — 创建赞助单位（太阴骑/太阳骑）

---

## JS 文件 - 装备效果配置

### js/effect-config.js

**主要功能**：装备特殊效果配置表，所有装备效果的定义、触发条件、效果计算统一在此管理。包含11种效果（E001-E011）及武器/护甲/坐骑类型的默认效果映射。

**包含的全局变量**：
- `EFFECT_CONFIG` — 效果配置表（E001-E011，共11种效果）
  - E001: 抵御冲锋（长柄武器）
  - E002: 远程免伤（盾牌）
  - E003: 重甲克制（弩/钝器）
  - E004: 无视近战干扰（弩）
  - E005: 惧怕近身（弓）
  - E006: 飞行能力（空军坐骑）
  - E007: 空中震慑（空军）
  - E008: 全伤害减免（传奇护甲）
  - E009: 机动惩罚（重甲）
  - E010: 迅捷（近战武器）
  - E011: 骑射（弓/弩）
- `WEAPON_DEFAULT_EFFECTS` — 武器类型默认效果映射
- `ARMOR_DEFAULT_EFFECTS` — 护甲类型默认效果映射
- `MOUNT_DEFAULT_EFFECTS` — 坐骑类型默认效果映射

**包含的函数**：
- `getWeaponEffectsByType(wpType)` — 根据武器类型获取默认效果名称列表
- `isEffectAllowedForWeapon(effectId, wpType)` — 检查武器类型是否允许某效果
- `getEffectByName(name)` — 按效果名查效果对象
- `hasEffect(effectsArr, effectId)` — 检查装备effects数组中是否含有某效果

---

## JS 文件 - 兜底数据

### js/fallback-data.js

**主要功能**：Fallback 配置数据，当 assets/data/*.json 加载失败时使用此处的硬编码数据。包含种族、装备（武器/盾牌/护甲/坐骑）、兵种（玩家/敌方）、难度配置、关卡配置等完整兜底数据。

**包含的全局变量**：
- `FALLBACK_DATA` — 兜底数据总对象
  - `RD.races` — 种族数据（人类、精灵、战犬、暗裔等）
  - `ED.weapons` — 武器数据（W001-W028，共28种武器）
  - `ED.shields` — 盾牌数据（S001-S007，共7种盾牌）
  - `ED.armors` — 护甲数据（A001-A020，共20种护甲）
  - `ED.mounts` — 坐骑数据（M001-M016，共16种坐骑）
  - `UD.units` — 玩家兵种（8种初始兵种）
  - `UD.enemyUnits` — 敌方兵种（EA/EB/EC/ED/EE 共5组）
  - `DC.levels` — 难度配置（easy/medium/hard/extreme 四档）
  - `LC.levels` — 关卡配置（easy/medium/hard/legend 各6关，共24关）

**关联的 JSON 配置文件**：
- `RD.races` ↔ `assets/data/race_config.json`
- `ED.weapons/shields/armors/mounts` ↔ `assets/data/equipment_config.json`
- `UD.units/enemyUnits` ↔ `assets/data/unit_config.json`
- `DC.levels` ↔ `assets/data/difficulty_config.json`
- `LC.levels` ↔ `assets/data/level_config.json`

---

## JS 文件 - 棋盘引擎

### js/hex-board.js

**主要功能**：六边形棋盘引擎，基于 Canvas 渲染。包含六边形坐标系统、棋子渲染、移动动画、攻击冲击效果、朝向系统、状态图标、脏标记渲染优化、离屏缓存等完整棋盘功能。

**包含的全局常量**：
- `RADIUS` — 棋盘半径（默认5）
- `HS` — 六边形尺寸（默认46）
- `SQRT3` — √3 常量
- `PAD` — 画布边距（默认70）
- `hexes` — 所有六边形坐标数组（轴向坐标 q,r,s）
- `HEX_DIRS` — 六边形6个方向向量（0-5，顺时针从右开始）

**包含的全局变量**：
- `canvas / ctx / LO / initDone` — Canvas 上下文和布局信息
- `_needsRender` — 脏标记（帧率优化）
- `_bgCanvas / _bgCtx` — 背景离屏缓存
- `_unitImgCache` — 单位图像缓存
- `_statsCache` — 属性计算缓存
- `_boardEntryAnim` — 棋盘入场动画状态
- `_selectAnim` — 选中动画状态
- `_shakeAtkHex / _impactWaves` — 攻击冲击效果状态
- `_placeAnim` — 放置/回收动画状态
- `_moveAnimations` — 移动动画数组
- `showAxes / hoveredHex / selectedPieceKey` — 交互状态
- `placedPieces` — 已放置棋子表（key = "q,r,s"）
- `_animFrame` — 动画帧ID

**包含的函数**：

渲染优化类：
- `requestRender()` — 请求重绘（设置脏标记）
- `buildBackgroundCache()` — 构建背景离屏缓存
- `invalidateBackgroundCache()` — 失效背景缓存
- `getCachedUnitImage(unitType, team)` — 获取缓存的单位图像
- `invalidateUnitImageCache(unitType)` — 失效单位图像缓存
- `getCachedStats(unitDef)` — 获取缓存的属性计算结果
- `invalidateStatsCache(unitType)` — 失效属性缓存

动画效果类：
- `startBoardEntryAnim()` — 棋盘入场动画（战雾+逐圈显现）
- `startSelectAnim(pieceKey)` — 选中弹性动画
- `stopSelectAnim()` — 停止选中动画
- `startAttackImpact(atkPieceKey, defHex)` — 攻击冲击效果
- `startPlaceAnim(pieceKey)` — 放置反馈动画
- `startRecycleAnim(pieceKey)` — 回收反馈动画
- `startPieceMoveAnim(pieceKey, fromHex, toHex, duration, onComplete)` — 棋子移动动画
- `updateMoveAnimations(now)` — 更新移动动画状态
- `easeOutCubic(t)` — 缓动函数
- `getAnimHexPos(piece)` — 获取动画中的棋子位置
- `getAnimHexKey(piece)` — 获取动画中的棋子key
- `isAnyPieceAnimating()` — 是否有棋子正在动画
- `drawAnimatingPiecesOnCanvas()` — 绘制移动中的棋子（含拖影）
- `shakePiece(pieceKey)` — 棋子受击晃动效果
- `startAnimLoop()` — 启动动画主循环（rAF）
- `stopAnimLoop()` — 停止动画主循环

朝向工具类：
- `getDirectionBetween(fromHex, toHex)` — 计算从A到B的方向（0-5）
- `getFacingToCenter(hex)` — 计算朝向棋盘中心的方向
- `getAttackAzimuth(atkHex, defHex, defFacing)` — 判断攻击方位（front/flank/rear）

状态系统类：
- `addPieceStatus(piece, statusName, turns, icon, color)` — 添加棋子状态
- `removePieceStatus(piece, statusName)` — 移除棋子状态
- `hasPieceStatus(piece, statusName)` — 检查是否有某状态
- `tickStatuses(piece)` — 状态回合数递减

坐标与绘制类：
- `hPx(q, r, size)` — 轴向坐标转像素坐标
- `hDist(a, b)` — 六边形距离计算
- `hCrn(cx, cy)` — 计算六边形六个角点
- `drawUnitOnCanvas(cx, cy, unitType, team, s)` — 在Canvas上绘制单位
- `drawFacingTriangle(cx, cy, facing, team)` — 绘制朝向三角形
- `drawStatusIcons(cx, cy, piece)` — 绘制状态图标（含弓兵禁射标记）
- `drawHex(h, hl)` — 绘制单个六边形格子
- `drawAxes()` — 绘制坐标轴（q/r/s）
- `ensureCtx()` — 确保Canvas上下文初始化
- `getPieceAtHexForRender(h)` — 获取某格的棋子（非动画状态）
- `render()` — 主渲染函数
- `pix2hex(px, py)` — 像素坐标转六边形坐标

---

## JS 文件 - 交互系统

### js/interactions.js

**主要功能**：交互系统 v2，处理棋盘上的所有用户交互。包括拖放部署、点击选择/攻击/移动、双击回收、悬停伤害预览、战斗tooltip等完整交互逻辑。

**包含的全局变量**：
- `interactionInited` — 交互系统是否已初始化
- `_listenersAttached` — 监听器是否已绑定
- `_clickHandler / _dropHandler / _dragoverHandler / _dragleaveHandler / _mousemoveHandler / _mouseleaveHandler` — 各事件处理函数引用（用于移除监听器）
- `_spectatorPaused` — 斗蛐蛐观战模式是否暂停

**包含的函数**：
- `initInteractions()` — 初始化交互系统（绑定所有事件监听器，支持重复调用时先移除旧监听器）
  - 拖放逻辑（部署阶段）：`_dragoverHandler / _dragleaveHandler / _dropHandler`
  - 点击逻辑：`_clickHandler`（含选中/攻击/移动/双击回收/斗蛐蛐观战模式）
  - 悬停逻辑：`_mousemoveHandler / _mouseleaveHandler`
- `deselectAll()` — 取消所有选中状态
- `resetInteractions()` — 重置交互系统初始化状态
- `updateCombatPreview(mx, my)` — 更新悬停伤害预览 tooltip
- `showCombatTooltip(mx, my, content)` — 显示战斗预览 tooltip（跟随鼠标，防屏幕溢出）
- `hideCombatPreview()` — 隐藏战斗预览 tooltip

---

## JS 文件 - 背包与装备UI

### js/inventory-ui.js

**主要功能**：背包与装备UI系统，负责装备槽交互渲染、装备选择弹窗、背包弹窗、装备拆卸/穿戴/售卖等UI交互。

**包含的全局变量**：
- `_currentEquipUnitType` — 当前查看装备的兵种类型
- `_currentEquipSlot` — 当前操作的装备槽位

**包含的函数**：

装备槽渲染：
- `buildEqSlotInteractive(icon, label, eq, slot, unitDef)` — 构建交互式装备槽（常规/展开双状态，含拆卸/更换按钮，按钮单独一行）

装备操作：
- `doUnequip(slot)` — 拆卸装备
- `_refreshAll()` — 刷新所有相关UI（轻量更新，完整重建由EventBus debounce触发）

装备选择弹窗：
- `openEquipPicker(slot)` — 打开装备选择弹窗
- `closeEquipPicker()` — 关闭装备选择弹窗
- `renderEquipPickerItems(slot, unitDef)` — 渲染装备选择列表
- `buildEqItemDetail(item)` — 构建装备详情文本
- `doEquip(itemId)` — 执行装备穿戴

背包弹窗：
- `openInventory()` — 打开背包弹窗
- `closeInventory()` — 关闭背包弹窗（含GSAP退场动画）
- `switchInvTab(btn)` — 切换背包分类标签
- `buildInventory(cat)` — 构建背包内容（all/weapons/shields/armors/mounts）

售卖系统：
- `sellInventoryItem(itemId, event)` — 售卖背包装备（30%折旧，含退场动画）

---

## JS 文件 - 关卡选择UI

### js/levels-ui.js

**主要功能**：关卡选择界面，负责关卡列表渲染、关卡难度解锁、关卡战斗入口、敌方单位注入、关卡结算（积分奖励+装备掉落）等完整关卡系统UI。

**包含的全局变量**：
- `LEVEL_TIER_INFO` — 品阶信息（iron/bronze/gold -> name/color/bgColor）
- `LEVEL_DIFFICULTY_INFO` — 难度分区信息（easy/medium/hard/legend -> label/color/icon/desc）
- `LEVEL_DIFFICULTY_ORDER` — 难度顺序
- `LEVEL_UNLOCK_REQUIRE` — 解锁规则（每个难度需要的前置通关关卡id）
- `LEVEL_BATTLE_STATE` — 关卡战斗运行时状态（currentLevelOpponent）
- `LEVEL_UNIT_TYPE_COUNTER` — 关卡敌方单位唯一type计数器
- `LEVEL_TIER_ICON_STYLE` — 关卡品阶→图标风格映射
- `LEVEL_TIER_SUMMON_TIER` — 关卡品阶→召唤档次映射
- `LEVEL_DIFFICULTY_MAP` — 关卡difficulty→AI行为难度映射
- `LEVEL_BASETYPE_ICON_SUFFIX` — 关卡兵种类型→图标后缀映射
- `LEVEL_BASETYPE_ICON_EMOJI` — 关卡兵种类型→图标emoji映射

**包含的函数**：

关卡配置读取：
- `getLevelConfig()` — 获取关卡配置（兼容直接读 window.LC）
- `findLevelById(levelId)` — 根据关卡id查找配置
- `isDifficultyUnlocked(difficulty)` — 判断某难度是否已解锁

关卡页面渲染：
- `buildLevelsPage()` — 渲染关卡选择页面（进度概览+按难度分组）
- `getEquipmentDisplayName(eqId)` — 根据装备id显示名称（替代代号显示）
- `buildLevelCard(level, difficultyUnlocked, indexInDiff)` — 构建单个关卡卡片

关卡战斗流程：
- `startLevelBattle(levelId)` — 进入关卡战斗（查找配置→注入敌方单位→进入部队选择页）
- `injectLevelOpponentUnits(rawEnemyUnits, tier)` — 注入关卡对手单位到UD.units（生成唯一type）
- `clearLevelOpponentUnits()` — 清理关卡对手临时单位

关卡结算：
- `showLevelBattleSettlement(result)` — 关卡战斗结算入口（由settlement-system调用）
- `collectLevelEquipmentDrops(level, rawEnemyUnits, isFirstClear)` — 装备掉落算法（首通必掉+随机2件）
- `findEquipmentEntryById(eqId)` — 根据装备id查找装备对象和对应槽位
- `inferEquipmentTypeLabel(item)` — 推断装备类型中文标签
- `showLevelSettlementModal(isPlayerWin, result, level, pointsDelta, isFirstClear, droppedItems, report)` — 显示关卡结算弹窗
- `closeLevelBattleSettlement()` — 关闭关卡结算弹窗并返回关卡选择

---

## JS 文件 - 主入口与页面控制

### js/main.js

**主要功能**：页面流程控制器，游戏主入口。负责页面切换（showPage）、页面注册（PanelManager）、主菜单、新游戏、确认战斗、退出战斗、数据加载（JSON/fallback）、初始化流程、作弊码系统等。

**包含的全局变量**：
- `currentPage` — 当前页面名称
- `_showPageTimer` — 页面切换防抖定时器
- `_lastPendingPage / _lastPendingData` — 防抖期间的最后一次页面请求
- `_enteredPages` — 记录已首次进入的页面（避免重复播放入场动画）
- `_menuSavesRefreshed` — 菜单存档是否已刷新

**包含的函数**：

页面控制：
- `initPagePanels()` — 初始化页面配置（注册11个页面到PanelManager）
- `applyPageWallpaper(name)` — 应用页面壁纸（过渡前调用）
- `updatePageState(name)` — 更新页面状态（动画结束后）
- `showPage(name, data)` — 切换页面（防抖+过渡动画+入场stagger）
- `_doShowPage(name, data)` — 实际执行页面切换
- `startShowPageCooldown(currentName)` — 页面切换冷却（200ms防抖）
- `syncPanelManagerState(name, data)` — 同步PanelManager状态
- `goBack()` — 返回上一页（战斗页走exitBattle，斗蛐蛐清理临时单位）

准备页面：
- `refreshPrepPage()` — 刷新准备页面数据（部队数量+积分）

主菜单：
- `showMenuScreen()` — 显示主菜单（读取本地+服务器存档）
- `renderMenuScreen(wrap, saves)` — 渲染主菜单内容
- `showNewGame()` — 显示新游戏界面
- `startNewGame()` — 开始新游戏

战斗控制：
- `confirmBattle()` — 确认出战（选择部队后进入战斗）
- `exitBattle()` — 退出战斗（清理棋盘+保存+重置状态+返回准备页）

初始化：
- `init()` — ★主初始化函数（加载JSON数据→显示菜单+检查服务器+自动保存监听）
- `startBattlePage()` — 进入战斗时初始化棋盘
- `initParticleBG()` — 初始化粒子背景

作弊码系统：
- `showCheatInput()` — 显示作弊码输入框
- `closeCheatModal()` — 关闭作弊码弹窗
- `submitCheat()` — 提交作弊码（两个作弊码：积分+阴阳骑）

其他全局函数：
- `manualSave()` — 手动保存
- `liftCurtain()` — 揭幕战斗幕布（含GSAP动画）
- `toggleAxes()` — 切换坐标轴显示
- `resetView()` — 重置视图
- `clearBoard()` — 清空棋盘
- `showSettingsPanel()` — 打开设置面板

---

## JS 文件 - 核心服务模块

### js/BattleService.js

**主要功能**：战斗服务模块，单例模式。提供战斗系统的统一访问接口，封装战斗计算、回合管理、胜负判定等功能，通过EventBus发布战斗相关事件。作为战斗流程的统一入口，全局函数仅作为薄包装。

**包含的全局变量/单例**：
- `BattleService` — 战斗服务单例实例（全局导出）

**包含的私有方法**：
- `_emit(eventName, data)` — 触发事件总线事件
- `_getPieceKey(piece)` — 获取棋子在棋盘上的 key

**包含的公共方法（战斗流程）**：
- `startBattle(playerUnits, enemyUnits, options)` — 开始战斗（初始化战斗流程，触发 battle:started 事件）
- `checkVictory()` — 检查胜负条件（返回战斗结果对象或 null）
- `checkAndTrigger()` — 检查并触发胜负（战斗阶段检查，延迟触发结算）
- `endBattle(result)` — 结束战斗（触发战斗结算，触发 battle:ended 事件）

**包含的公共方法（伤害计算）**：
- `calculateDamage(attacker, defender, options)` — 计算伤害值（基础伤害，不含冲锋/方位/士气等复杂因素）
- `doAttack(atkPiece, defPiece)` — 执行攻击（调用 executeCombat，触发 battle:attack 事件）

**包含的公共方法（战斗状态）**：
- `getBattleState()` — 获取当前战斗状态（玩家单位/敌方单位/选项/是否进行中/回合状态）
- `getTurnState()` — 获取当前回合状态（TurnState 对象引用）

**包含的公共方法（战报与棋子属性）**：
- `addWarReportLine(line)` — 添加战报行
- `getPieceStats(piece)` — 获取棋子完整属性

**触发的事件**：
- `battle:started` — 战斗开始
- `battle:ended` — 战斗结束
- `battle:attack` — 执行攻击

---

### js/EquipmentService.js

**主要功能**：装备服务模块，单例模式。提供装备与背包操作的统一接口，封装装备穿戴/拆卸、背包管理、装备适配检查等核心逻辑，通过 EventBus 发布变更事件，保持向后兼容。

**包含的全局变量/单例**：
- `EquipmentService` — 装备服务单例实例（全局导出）
- `SLOT` — 装备槽位常量（MAIN_WEAPON/SHIELD/ARMOR/MOUNT）

**包含的私有方法**：
- `_emit(eventName, data)` — 触发事件总线事件
- `_getUnitType(unitDef)` — 获取单位类型标识
- `_findItemBySlot(slot, itemId)` — 根据槽位查找装备物品
- `_getInventory()` — 获取背包数据引用
- `_getInventoryCategory(slotType)` — 根据槽位类型获取背包分类名称

**包含的公共方法（装备操作）**：
- `equipItem(unitDef, slot, itemId)` — 装备物品到单位（槽位已有装备先卸下，返回 EquipResult）
- `unequipItem(unitDef, slot)` — 卸下单位指定槽位的装备（返回被卸下的装备对象）
- `equipFromInventory(unitDef, slot, itemId)` — 从背包装备物品到单位（原装备回收到背包）
- `unequipToInventory(unitDef, slot)` — 卸下单位装备到背包

**包含的公共方法（装备检查）**：
- `canUseShield(unitDef)` — 判断单位能否使用盾牌（双手武器不能装备盾牌）
- `isCompatible(unitDef, item)` — 判断装备是否适配该单位（含野兽种族限制、骑射判定、forUnits检查）
- `canEquipSlot(unitDef, slot)` — 检查某个槽位是否可以装备（野兽只能装备护甲）

**包含的公共方法（背包操作）**：
- `addToInventory(item, slotType)` — 添加物品到背包
- `removeFromInventory(itemId)` — 从背包移除物品
- `findInInventory(itemId)` — 在背包中查找物品
- `getInventoryCount()` — 获取背包物品总数

**触发的事件**：
- `equipment:changed` — 装备变更
- `inventory:changed` — 背包变更

---

### js/EventBus.js

**主要功能**：事件总线模块，单例模式。提供统一的事件订阅与发布机制，支持事件的注册、注销、触发和一次性监听。作为各模块间解耦通信的核心基础设施。

**包含的全局变量/单例**：
- `EventBus` — 事件总线单例实例（全局导出，Object.freeze 冻结）

**包含的私有属性**：
- `_listeners` — 普通事件监听器存储（Map<string, Set<Function>>）
- `_onceListeners` — 一次性事件监听器存储（Map<string, Set<Function>>）

**包含的公共方法**：
- `on(eventName, handler)` — 注册事件监听，返回取消监听函数
- `off(eventName, handler)` — 取消事件监听（同时移除普通和once注册的）
- `emit(eventName, data)` — 触发事件，调用该事件的所有监听器（含一次性监听）
- `once(eventName, handler)` — 注册一次性事件监听（触发后自动移除）
- `clear()` — 清除所有监听器（内存泄漏防护，用于场景切换）
- `getStats()` — 获取当前监听器数量统计（调试用）

---

### js/PanelManager.js

**主要功能**：面板管理器模块，单例模式。统一管理游戏中各面板的生命周期，提供面板注册、显示、隐藏、刷新、历史返回等统一接口，通过 EventBus 触发面板相关事件。

**包含的全局变量/单例**：
- `PanelManager` — 面板管理器单例实例（全局导出）

**包含的私有属性**：
- `_panels` — 已注册的面板集合（Map<string, PanelState>）
- `_activePanelId` — 当前活动的面板ID
- `_history` — 面板历史栈（用于返回上一面板）

**包含的公共方法（面板管理）**：
- `register(panelId, config)` — 注册面板（配置含 buildFn/onShow/onHide/autoBuild）
- `unregister(panelId)` — 注销面板（正在显示则先隐藏）

**包含的公共方法（显示/隐藏）**：
- `show(panelId, data)` — 显示面板（首次自动构建，自动隐藏当前面板，触发 panel:show）
- `hide(panelId)` — 隐藏面板（触发 panel:hide）
- `refresh(panelId, data)` — 刷新面板内容（触发 panel:refresh）

**包含的公共方法（查询）**：
- `getActive()` — 获取当前活动面板ID
- `has(panelId)` — 检查面板是否已注册
- `isVisible(panelId)` — 检查面板是否可见
- `getConfig(panelId)` — 获取面板配置

**包含的公共方法（历史导航）**：
- `back()` — 返回上一个面板（从历史栈弹出）

**包含的低级辅助方法（供外部自定义流程）**：
- `_addToHistory(panelId)` — 添加到历史栈
- `_popHistory()` — 弹出历史栈顶
- `_setActive(panelId)` — 设置活动面板
- `_setVisible(panelId, visible)` — 设置可见性
- `_setLastData(panelId, data)` — 设置最后数据
- `_setBuilt(panelId, built)` — 设置已构建状态
- `_emitShow(panelId, data)` — 手动触发显示事件
- `_emitHide(panelId)` — 手动触发隐藏事件
- `_emitRefresh(panelId, data)` — 手动触发刷新事件

**触发的事件**：
- `panel:show` — 面板显示
- `panel:hide` — 面板隐藏
- `panel:refresh` — 面板刷新

---

## JS 文件 - UI 系统

### js/panels.js

**主要功能**：兵营与战场UI面板系统，包含兵营列表展示、兵源地信息、部队选择页面、战场单位信息面板、移动提示等核心UI功能。通过 EventBus 监听数据变更自动刷新UI。

**包含的全局变量**：
- `selectedDifficulty` — 当前选中的难度（默认easy）
- `selectedUnitTypes` — 选中的出战部队类型列表

**包含的IIFE内部变量与函数**：
- `_barracksRefreshTimer` / `_inventoryRefreshTimer` — 防抖定时器
- `debounceBarracksRefresh()` — 兵营刷新防抖
- `debounceInventoryRefresh()` — 背包刷新防抖（含背包徽章更新）
- `initBarracksEventListeners()` — 初始化兵营事件监听器（监听 unit:added / equipment:changed / inventory:changed 等事件）

**包含的全局函数**：
- `buildBarracks()` — 构建兵营列表页面（展示所有玩家部队，支持展开查看装备/属性详情）
- `buildRaceSlot(r)` — 构建种族信息槽（可展开查看种族基础属性）
- `statRow(k, v)` — 构建属性行HTML（工具函数）
- `buildUnitSelect()` — 构建部队选择页面（最多选6支部队出战）
- `getSelectedForBattle()` — 获取选中的出战部队列表
- `updateUnitCard(piece)` — 更新战场单位信息面板（选中棋子时显示）
- `updateMoveHint()` — 更新移动提示（根据阶段和选中单位显示操作提示）

> **更新记录**：每新增/修改一个文件后，必须同步更新此 AI_PATH_GUIDE.md 文件

---

## JS 文件 - 数据系统

### js/save-manager.js

**主要功能**：游戏存档管理系统，支持本地存储（localStorage）和服务器存储两种方式。管理玩家单位、积分、背包、召唤数据、关卡进度等所有游戏状态的保存与加载。

**包含的全局变量**：
- `SAVE_VERSION` — 存档版本号（当前v4）
- `GameState` — 游戏全局状态对象
  - `saveName` / `version` / `playerUnits` / `points` / `timestamp`
  - `inventory` — 背包系统（weapons/shields/armors/mounts）
  - `_summonedData` — 召唤数据缓存（races/weapons/shields/armors/mounts/units）
  - `_summonHistory` / `summonModel`
  - `completedLevels` — 关卡进度记录

**包含的函数（背包操作，薄包装）**：
- `addItemToInventory(item, slotType)` — 添加物品到背包（优先使用EquipmentService）
- `removeItemFromInventory(itemId)` — 从背包移除物品
- `findItemInInventory(itemId)` — 在背包中查找物品
- `getInventoryCount()` — 获取背包物品总数
- `unequipToInventory(unitDef, slot)` — 卸下装备到背包
- `equipFromInventory(unitDef, slot, itemId)` — 从背包装备物品

**包含的函数（服务器检查）**：
- `checkServerAvailable(callback)` — 检查服务器是否可用

**包含的函数（保存相关）**：
- `saveToBrowser(name)` — 异步保存到浏览器本地+服务器
- `saveToBrowserSync(name)` — 同步保存到浏览器本地
- `buildMainSaveData(name)` — 构建主存档数据对象
- `_saveMainToFile(data, name)` — 保存主存档到服务器文件
- `_saveSummonedToFile(name)` — 保存召唤数据到服务器文件
- `_saveToLocal(name, data)` — 保存到 localStorage

**包含的函数（加载相关）**：
- `loadFromBrowser(name, callback)` — 从本地+服务器加载存档
- `_loadFromLocal(name)` — 从 localStorage 加载
- `_loadSummonedFromFile(name, callback)` — 从服务器加载召唤数据
- `applyMainSaveData(d)` — 应用主存档数据到 GameState
- `applySummonedData(d)` — 应用召唤数据
- `applySaveData(d)` — 应用完整存档数据（主+召唤）

**包含的函数（关卡进度）**：
- `isLevelCompleted(levelId)` — 检查关卡是否已通关
- `markLevelCompleted(levelId)` — 标记关卡为已通关
- `getCompletedLevels()` — 获取所有已通关关卡

**包含的函数（存档管理）**：
- `getAllSaves()` — 异步获取所有存档列表（服务器+本地）
- `getAllSavesSync()` — 同步获取所有存档（仅本地）
- `getAllLocalSaves()` — 获取所有本地存档
- `deleteSave(name)` — 删除指定存档
- `initNewGame(saveName)` — 初始化新游戏

> **更新记录**：每新增/修改一个文件后，必须同步更新此 AI_PATH_GUIDE.md 文件

---

## JS 文件 - UI 系统（续）

### js/settings.js

**主要功能**：游戏设置系统，统一管理壁纸选择、壁纸放映模式、API配置等设置项。分为 GameSettings 数据模块和 SettingsUI 界面模块两部分。

**包含的模块**：

#### GameSettings 模块（数据层）

**私有变量**：
- `defaults` — 默认设置（wallpaper / wallpaperMode）
- `settings` — 当前设置对象
- `loaded` — 是否已加载标记
- `_onApplied` — 壁纸应用回调

**公共方法**：
- `init(callback)` — 初始化设置（从本地+服务器加载）
- `get(key)` — 获取单个设置项
- `set(key, value)` — 设置单个项并保存
- `getAll()` — 获取所有设置
- `applyWallpaper()` — 应用当前壁纸（固定模式）
- `removeWallpaper()` — 移除壁纸
- `applyRandomWallpaper()` — 应用随机壁纸
- `applyWallpaperAuto()` — 根据模式自动应用壁纸
- `onApplied(fn)` — 注册壁纸应用回调
- `loadLocal()` — 从 localStorage 加载
- `saveLocal()` — 保存到 localStorage
- `syncToServer()` — 同步设置到服务器
- `syncFromServer(callback)` — 从服务器同步设置

#### SettingsUI 模块（UI层）

**私有变量**：
- `_apiProfiles` — API配置档案列表
- `_activeProfileName` — 当前激活的档案名
- `handleEscKey` — ESC键关闭处理函数

**公共方法**：
- `open()` — 打开设置面板
- `close()` — 关闭设置面板
- `buildHTML()` — 构建设置面板HTML结构
- `fillValues()` — 填充当前设置值
- `setWpMode(mode)` — 设置壁纸模式（fixed/random）
- `loadApiConfig()` — 加载API配置
- `fillApiFields(config)` — 填充API配置字段
- `switchProfile()` — 切换API配置档案
- `addProfile()` — 新增API配置档案
- `deleteProfile()` — 删除API配置档案
- `saveApi()` — 保存API配置
- `clearAllKeys()` — 清除所有API密钥显示
- `updateCurrentWp()` — 更新当前壁纸显示
- `loadWallpaperList()` — 加载壁纸列表（网格展示）
- `selectWallpaper(name)` — 选择壁纸
- `clearWallpaper()` — 清除壁纸选择
- `deleteWallpaper(name)` — 删除壁纸文件
- `importWallpaper()` — 导入壁纸文件
- `handleFileSelect(e)` — 处理壁纸文件选择（上传）
- `bindEvents()` — 绑定设置面板事件

> **更新记录**：每新增/修改一个文件后，必须同步更新此 AI_PATH_GUIDE.md 文件

### js/shop-system.js

**主要功能**：商城系统，负责兵团购买/出售、装备购买、积分管理、品阶系统等。包含品阶配置、价格计算、商城页面构建、购买逻辑等完整商城功能。

**包含的IIFE内部变量与函数（事件监听初始化）**：
- `_shopRefreshTimer` / `_pointsRefreshTimer` — 防抖定时器
- `debounceShopRefresh()` — 商城刷新防抖
- `debouncePointsRefresh()` — 积分显示刷新防抖
- `initShopEventListeners()` — 初始化商城事件监听器

**包含的全局变量**：
- `UNIT_TIER_CONFIGS` — 兵种品阶配置表（黑铁/青铜/黄金/钻石）

**包含的函数（品阶系统）**：
- `syncUnitTierConfigs()` — 同步品阶配置到UD
- `hexToRgba(hex, alpha)` — 十六进制颜色转RGBA（工具函数）
- `getUnitTierConfig(unitType)` — 获取兵种品阶配置

**包含的函数（积分与购买）**：
- `getPlayerPoints()` — 获取玩家积分
- `canAfford(price)` — 检查积分是否足够
- `buyUnit(unitType)` — 购买兵团
- `sellUnit(unitId)` — 出售兵团（50%折旧）
- `refreshPointsDisplay()` — 刷新积分显示

**包含的函数（装备商城）**：
- `getEquipCategoryForItem(item)` — 获取装备分类（weapon/shield/armor/mount）
- `getPriceForEquipment(item)` — 计算装备价格
- `buildEquipStatsHtml(item, cat)` — 构建装备属性HTML
- `getUnlockedEquipIds()` — 获取已解锁装备ID列表
- `buildShopEquipmentTab(container)` — 构建装备商城标签页
- `buyEquipment(itemId, slotType)` — 购买装备

**包含的函数（商城页面）**：
- `switchShopTab(tab)` — 切换商城标签（units/equipment）
- `toggleShopCleanupMode()` — 切换清理模式
- `removeUnitFromShop(unitType)` — 从商城移除兵种
- `buildShop()` — ★构建商城主页面
- `buildShopUnitsTab(container)` — 构建兵团商城标签页

> **更新记录**：每新增/修改一个文件后，必须同步更新此 AI_PATH_GUIDE.md 文件

---

## JS 文件 - 召唤系统

### js/summon-engine.js

**主要功能**：召唤兵团生成引擎，通过 AI API 生成完整兵团（名字/装备/背景/属性）。遵循《单位生成与推演引擎机制》规则，支持多世界观、多品阶、野兽/人形兵种生成。

**包含的全局变量/常量**：
- `SUMMON_TIERS` — 召唤档次配置（1-4档：黑铁/青铜/黄金/钻石，含价格/战力范围）
- `WORLD_SETTINGS` — 世界观配置（战锤/中土/D&D/奇迹时代/魔兽/上古卷轴/欧洲中世纪/中国古代，含人型种族和野兽列表）

**包含的函数**：
- `pickRandomWorld(customDesc)` — 随机选择世界观（支持自定义描述关键词匹配）
- `genSummonId(prefix)` — 生成召唤物唯一ID
- `calculatePowerIndex(stats)` — 计算战力指数
- `generateRandomRace(tier, customDesc)` — 生成随机种族（人型/野兽，支持自定义描述）
- `summonUnit(tier, customDesc, callback)` — ★召唤入口（规则生成+LLM增强双模式）
- `executeSummon(tier, customDesc, callback)` — 执行LLM召唤（API调用+数据解析+注入）
- `injectSummonedData()` — 将召唤数据注入到游戏数据池（RD/ED/UD）
- `clearSummonedData()` — 清除召唤数据
- `injectInventoryToED()` — 将背包装备注入ED供UI使用
- `clearInventoryFromED()` — 清除背包注入的ED数据

### js/summon-ui.js

**主要功能**：召唤页面UI，提供召唤界面、召唤仪式动画、召唤结果展示等功能。包括召唤档次选择、自定义描述输入、召唤动画、结果弹窗等完整召唤UI流程。

**包含的函数**：
- `buildSummonPage()` — 构建召唤页面（积分展示+自定义描述+四档召唤按钮）
- `doSummon(tier)` — 执行召唤（检查积分→扣积分→召唤仪式动画→调用summonUnit→显示结果）
- `createSummonRitual()` — 创建召唤仪式动画效果
- `showSummonModal(result, tier)` — 显示召唤结果弹窗（兵种详情+领取按钮）
- `closeSummonModal()` — 关闭召唤结果弹窗

> **更新记录**：每新增/修改一个文件后，必须同步更新此 AI_PATH_GUIDE.md 文件

---

## JS 文件 - 回合系统

### js/turn-system.js

**主要功能**：回合系统 v2，处理游戏的完整回合流程：骰子阶段 → 部署阶段 → 战斗回合。包含AI部署逻辑、战斗速度控制、记分板、观战暂停等功能。

**包含的全局变量/状态**：
- `TurnState` — 回合状态对象（currentRound/currentPlayer/phase/firstPlayer/difficulty/deployCount等）
  - `isDuelBattle` / `sideAControlledByAI` / `sideBControlledByAI` — 斗蛐蛐模式标记
- `BATTLE_SPEED_MULT` — 对战速度倍率（0.5/1/2/5）
- `_spectatorPaused` — 观战模式暂停标记
- `Scoreboard` — 记分板数据（damage/kills，分player/enemy）

**包含的函数（记分板系统）**：
- `resetScoreboard()` — 重置记分板
- `updateScoreboardUI()` — 更新记分板UI显示
- `recordScoreboardDamage(pieceKey, dmg)` — 记录伤害
- `recordScoreboardKill(pieceKey)` — 记录击杀

**包含的函数（战斗速度）**：
- `battleDelay(ms)` — 战斗延迟（受速度倍率影响）
- `updateBattleSpeedControlsVisibility()` — 更新速度控制按钮可见性
- `initBattleSpeedControls()` — 初始化战斗速度控制
- `updateSpectatorPauseBtnVisibility()` — 更新观战暂停按钮可见性
- `initSpectatorPauseBtn()` — 初始化观战暂停按钮

**包含的函数（回合初始化与骰子）**：
- `initTurns()` — 初始化回合系统
- `isControlledByAI(team)` — 判断某阵营是否由AI控制
- `rollDiceAndStart()` — 掷骰子并开始
- `showDiceResult(playerRoll, enemyRoll)` — 显示骰子结果

**包含的函数（部署阶段）**：
- `updateDeployUI()` — 更新部署阶段UI
- `aiDeployPiece()` — ★AI部署一个单位（分难度策略）
- `aiPickRanged(cands, playerHexes, enemyHexes)` — AI远程单位部署位置选择（困难+传说）
- `aiPickFrontline(cands, playerHexes, enemyHexes)` — AI近战单位部署位置选择（困难+传说）
- `aiLegendPick(...)` — 传说难度AI部署主调度器
- `aiLegendPickReach(...)` — 传说难度先手方第2-4个单位部署（能打到敌方）
- `aiLegendPickCluster(cands, myHexes)` — 传说难度先手方第5+个单位部署（集群）
- `aiLegendPickSecondMelee(cands, myHexes)` — 传说难度后手方近战部署（3-4环）
- `aiLegendPickSecondRanged(cands, myHexes)` — 传说难度后手方远程部署（4-5环）
- `getSlotIndexInContainer(container, slotIdx)` — 获取容器中第N个槽位
- `onPlayerPlacePiece()` — 玩家放置单位回调
- `nextDeployPlayer()` — 下一个部署玩家
- `tryEndDeploy()` — 尝试结束部署阶段
- `startBattlePhase()` — 开始战斗阶段

**包含的函数（战斗回合）**：
- `processTurnStart(team)` — 回合开始处理（恢复行动点+状态tick）
- `processTurnEnd(team)` — 回合结束处理
- `endTurn()` — 结束当前回合（切换到对方）
- `updateBattleUI()` — 更新战斗UI（回合数/当前玩家/难度标签）
- `showTurnNotify(isPlayer)` — 显示回合切换提示

**包含的函数（棋子状态）**：
- `getPieceStats(piece)` — 获取棋子完整属性
- `initPieceRuntimeState(piece)` — 初始化棋子运行时状态

> **更新记录**：每新增/修改一个文件后，必须同步更新此 AI_PATH_GUIDE.md 文件

---

## JS 文件 - UI 工具

### js/ui-utils.js

**主要功能**：UI工具函数集合，提供 Toast 通知、HTML转义、数字滚动动画等通用UI工具函数。必须在所有业务脚本之前加载，作为基础工具库被全项目引用。

**包含的全局变量**：
- `toastTimer` — Toast定时器（用于清除前一个toast）

**包含的函数**：
- `showToast(msg, type)` — 显示Toast通知提示（info/success/error 三种类型）
- `escapeHtml(s)` — HTML转义（防止XSS，转义<>&"'）
- `escapeAttr(s)` — 属性值转义（更严格的属性值安全转义）
- `animateNumber(element, fromVal, toVal, duration, formatter)` — 数字滚动动画（从from到to的平滑过渡，支持自定义格式化）

> **更新记录**：每新增/修改一个文件后，必须同步更新此 AI_PATH_GUIDE.md 文件

---

## Asset 文件 - 数据配置

### assets/data/race_config.json

**主要功能**：种族配置数据，定义所有可玩种族的基础属性。与 `js/fallback-data.js` 的 `RD.races` 关联，修改时需保持一致。

**包含字段**：
- `id` — 种族唯一标识
- `name` — 种族名称
- `scale` — 种族规模（影响单位体型）
- `typeLabel` — 体型分类标签（常规体型/小型/大型等）
- `baseHP` — 基础血量
- `naturalArmor` — 天然护甲
- `naturalWeapon` — 天然武器伤害
- `baseMorale` — 基础士气
- `baseMovement` — 基础移动力
- `attackRange` — 基础攻击范围
- `description` — 种族描述
- `poolCount` — 池数量

> **AI提示**：本文件与 js/fallback-data.js 的 RD.races 关联，修改时必须同步修改 fallback 文件

---

### assets/data/equipment_config.json

**主要功能**：装备配置数据，包含所有武器、盾牌、护甲、坐骑的完整定义。与 `js/fallback-data.js` 关联。

**包含分类**：
- `weapons` — 武器列表（W001-W028，含近战/长柄/弓/弩等）
- `shields` — 盾牌列表（S001-S007）
- `armors` — 护甲列表（A001-A020）
- `mounts` — 坐骑列表（M001-M016）

**装备通用字段**：
- `id` / `tier` / `name` / `category` / `type`
- 伤害/护甲/移动等属性字段
- `forUnits` — 适用兵种类型
- `effects` — 特殊效果列表

> **AI提示**：本文件与 js/fallback-data.js 关联，修改时必须同步修改 fallback 文件

---

### assets/data/unit_config.json

**主要功能**：兵种配置数据，定义玩家初始兵种和敌方兵种。与 `js/fallback-data.js` 的 `UD.units` 关联。

**包含字段**：
- `units` — 玩家初始兵种列表
- `enemyUnits` — 敌方兵种（按难度分组：EA/EB/EC/ED/EE）
- 每个兵种包含：id/tier/name/race/background/belief/type/typeName/image/icon/unitCount/equipment

> **AI提示**：本文件与 js/fallback-data.js 的 UD.units 关联，修改时必须同步修改 fallback 文件

---

### assets/data/level_config.json

**主要功能**：关卡配置数据，定义所有关卡的敌人编组、奖励、难度等。与 `js/fallback-data.js` 的 `LC.levels` 关联。

**包含字段**：
- `levels` — 关卡列表（按难度分组：easy/medium/hard/legend）
- 每个关卡包含：id/name/difficulty/tier/enemySetId/enemyUnitIds/rewardPoints/guaranteedDrop/desc

> **AI提示**：本文件与 js/fallback-data.js 的 LC.levels 关联，修改时必须同步修改 fallback 文件

---

### assets/data/difficulty_config.json

**主要功能**：难度配置数据，定义各难度的敌方编组和AI行为参数。与 `js/fallback-data.js` 的 `DC.levels` 关联。

**包含字段**：
- `levels` — 难度配置（easy/medium/hard/extreme）
- 每个难度包含：label/desc/enemy/ai（targeting/moveStyle/maxMoveSteps/aggression）

> **AI提示**：本文件与 js/fallback-data.js 的 DC.levels 关联，修改时必须同步修改 fallback 文件

---

### assets/data/flow_log.json

**主要功能**：流程日志记录文件（运行时生成，记录游戏流程数据）

---

### assets/data/tuning_backup.json

**主要功能**：数值调优备份文件（历史版本备份，供参考回退）

---

## Asset 文件 - 图片资源

### assets/images/

**主要功能**：兵种图标资源，按品阶和兵种类型分类命名。所有图标为 1024×1024 PNG 格式。

**命名规则**：`icon_{tier}_{type}.png`

**品阶（tier）**：
- `iron` — 黑铁
- `bronze` — 青铜
- `gold` — 黄金
- `diamond` — 钻石
- `ink` — 水墨风格
- `kewukewu` — 特殊风格

**兵种类型（type）**：
- `melee` — 近战步兵
- `ranged` — 远程兵
- `cavalry` — 骑兵
- `flying` — 空军
- `beast` — 野兽

**特殊图标**：
- `sun_rider.png` — 太阳骑士（赞助单位）
- `taiyin_rider.png` — 太阴骑士（赞助单位）

---

### assets/icons/

**主要功能**：通用图标资源。

**包含文件**：
- `kewukewu.png` — 特殊风格图标

---

### assets/menu_concepts/

**主要功能**：菜单概念图资源。

**包含文件**：
- `concept_battlefield.jpg` — 战场概念图

---

### assets/wallpapers/

**主要功能**：游戏壁纸资源，玩家可在设置中选择或随机使用。

**文件数量**：16张壁纸（jpg格式）

> **更新记录**：每新增/修改一个文件后，必须同步更新此 AI_PATH_GUIDE.md 文件

