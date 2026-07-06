// AI路径引导：如需查找其他文件路径和功能说明，请先查看项目根目录的 AI_PATH_GUIDE.md；每新增/修改一个文件后，必须同步更新AI_PATH_GUIDE.md
// ==================== 关卡选择界面 ====================
// 配合 assets/data/level_config.json（window.LC）与 save-manager 的 isLevelCompleted/markLevelCompleted

// 品阶信息：tier -> { name, color, bgColor }
var LEVEL_TIER_INFO = {
  iron:   { name: '黑铁', color: '#7a7a7a', bgColor: 'linear-gradient(135deg,#f0ede8 0%,#e0ddd6 100%)' },
  bronze: { name: '青铜', color: '#cd7f32', bgColor: 'linear-gradient(135deg,#f5ecd7 0%,#e8dcc0 100%)' },
  gold:   { name: '黄金', color: '#d4a017', bgColor: 'linear-gradient(135deg,#fff7e0 0%,#f5e6a8 100%)' }
};

// 难度分区信息：difficulty -> { label, color, icon, desc }
var LEVEL_DIFFICULTY_INFO = {
  easy:   { label: '简单', color: '#4a9c2d', icon: '🟢', desc: '蛮族黑铁部队 · 入门练兵' },
  medium: { label: '中等', color: '#3b7dd8', icon: '🔵', desc: '精灵青铜部队 · 进阶试炼' },
  hard:   { label: '困难', color: '#c0392b', icon: '🔴', desc: '王国与暗裔精锐 · 实战挑战' },
  legend: { label: '传说', color: '#7a1fad', icon: '🟣', desc: '皇家与暗裔王牌 · 终极试炼' }
};

// 难度顺序
var LEVEL_DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'legend'];

// 解锁规则：每个难度需要的前置通关关卡 id
var LEVEL_UNLOCK_REQUIRE = {
  easy:   null,           // 简单全开放
  medium: 'easy_6',       // 通关简单第6关解锁
  hard:   'medium_6',     // 通关中等第6关解锁
  legend: 'hard_6'        // 通关困难第6关解锁
};

// ===== 获取关卡配置（兼容直接读 window.LC） =====
function getLevelConfig() {
  if (window.LC && window.LC.levels) return window.LC;
  return { levels: [] };
}

// ===== 根据关卡 id 查找配置 =====
function findLevelById(levelId) {
  var conf = getLevelConfig();
  for (var i = 0; i < conf.levels.length; i++) {
    if (conf.levels[i].id === levelId) return conf.levels[i];
  }
  return null;
}

// ===== 判断某难度是否已解锁 =====
function isDifficultyUnlocked(difficulty) {
  var req = LEVEL_UNLOCK_REQUIRE[difficulty];
  if (!req) return true; // 无前置要求
  return typeof isLevelCompleted === 'function' ? isLevelCompleted(req) : false;
}

// ===== 渲染关卡选择页面 =====
function buildLevelsPage() {
  var container = document.getElementById('levelsContent');
  if (!container) return;

  container.innerHTML = '';

  var conf = getLevelConfig();
  if (!conf.levels || conf.levels.length === 0) {
    container.innerHTML = '<div class="levels-empty">⚠ 关卡配置加载失败，请刷新重试</div>';
    return;
  }

  // 顶部积分/进度概览
  var completedCount = 0;
  var totalCount = conf.levels.length;
  if (typeof getCompletedLevels === 'function') {
    var completed = getCompletedLevels();
    Object.keys(completed).forEach(function(k) {
      if (completed[k] && completed[k].completed) completedCount++;
    });
  }

  var overview = document.createElement('div');
  overview.className = 'levels-overview';
  overview.innerHTML =
    '<div class="lo-icon">📜</div>' +
    '<div class="lo-info">' +
      '<div class="lo-label">关卡进度</div>' +
      '<div class="lo-value">' + completedCount + ' / ' + totalCount + ' 已通关</div>' +
    '</div>' +
    '<div class="lo-bar-wrap">' +
      '<div class="lo-bar" style="width:' + (totalCount ? (completedCount * 100 / totalCount) : 0) + '%"></div>' +
    '</div>' +
    '<div class="lo-tip">点击关卡卡片开始挑战 · 首通可获装备掉落</div>';
  container.appendChild(overview);

  // 按难度分组渲染
  LEVEL_DIFFICULTY_ORDER.forEach(function(diffKey) {
    var diffInfo = LEVEL_DIFFICULTY_INFO[diffKey];
    var diffLevels = conf.levels.filter(function(lv) { return lv.difficulty === diffKey; });
    if (diffLevels.length === 0) return;

    var unlocked = isDifficultyUnlocked(diffKey);

    var section = document.createElement('div');
    section.className = 'levels-difficulty-section' + (unlocked ? '' : ' level-locked');

    var header = document.createElement('div');
    header.className = 'lds-header';
    header.style.borderLeftColor = diffInfo.color;
    header.innerHTML =
      '<div class="lds-title">' + diffInfo.icon + ' ' + diffInfo.label + '难度</div>' +
      '<div class="lds-desc">' + diffInfo.desc +
        (unlocked ? '' : ' <span class="lds-locked-hint">🔒 需通关前置关卡解锁</span>') +
      '</div>';
    section.appendChild(header);

    var grid = document.createElement('div');
    grid.className = 'lds-grid';

    diffLevels.forEach(function(lv, idx) {
      var card = buildLevelCard(lv, unlocked, idx + 1);
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

// ===== 根据装备id显示名称（替代代号显示）=====
function getEquipmentDisplayName(eqId) {
  if (!eqId) return '';
  var found = findEquipmentEntryById(eqId);
  return found ? found.item.name : eqId;
}

// ===== 构建单个关卡卡片 =====
function buildLevelCard(level, difficultyUnlocked, indexInDiff) {
  var tierInfo = LEVEL_TIER_INFO[level.tier] || LEVEL_TIER_INFO.iron;
  var completed = typeof isLevelCompleted === 'function' ? isLevelCompleted(level.id) : false;
  var canChallenge = difficultyUnlocked;

  var card = document.createElement('div');
  card.className = 'level-card' +
    (completed ? ' level-completed' : '') +
    (canChallenge ? '' : ' level-locked') +
    (level.guaranteedDrop ? ' level-has-drop' : '');
  card.style.borderColor = tierInfo.color;
  card.style.background = tierInfo.bgColor;

  // 通关状态徽章
  var statusBadge = '';
  if (completed) {
    statusBadge = '<div class="lc-status lc-status-done">✓ 通关</div>';
  } else if (canChallenge) {
    statusBadge = '<div class="lc-status lc-status-open">⚔ 可挑战</div>';
  } else {
    statusBadge = '<div class="lc-status lc-status-locked">🔒 锁定</div>';
  }

  // 首通掉落徽章
  var dropBadge = '';
  if (level.guaranteedDrop) {
    var dropName = getEquipmentDisplayName(level.guaranteedDrop);
    dropBadge = '<div class="lc-drop">🎁 首通掉落：' + dropName + '</div>';
  }

  card.innerHTML =
    '<div class="lc-top">' +
      '<div class="lc-index">' + indexInDiff + '</div>' +
      '<div class="lc-tier-badge" style="background:' + tierInfo.color + '">' + tierInfo.name + '</div>' +
      statusBadge +
    '</div>' +
    '<div class="lc-body">' +
      '<div class="lc-name">' + level.name + '</div>' +
      '<div class="lc-enemy">' +
        '<span class="lc-enemy-label">敌方：</span>' +
        '<span class="lc-enemy-count">' + level.enemyUnitIds.length + ' 支军团</span>' +
      '</div>' +
      '<div class="lc-desc">' + level.desc + '</div>' +
    '</div>' +
    '<div class="lc-footer">' +
      '<div class="lc-reward">💎 ' + level.rewardPoints + ' 积分</div>' +
      dropBadge +
    '</div>';

  if (canChallenge) {
    card.addEventListener('click', function() {
      startLevelBattle(level.id);
    });
    card.style.cursor = 'pointer';
  } else {
    card.style.cursor = 'not-allowed';
    // 锁定关卡点击抖动反馈
    card.addEventListener('click', function() {
      if (!window.gsap) return;
      gsap.to(card, {
        keyframes: { x: [-5, 5, -3, 3, 0] },
        duration: 0.5,
        ease: 'elastic.out(1, 0.3)',
        overwrite: true
      });
    });
  }

  return card;
}

// ===== 关卡战斗运行时状态 =====
// 当前对手信息：{ level, enemyUnits(注入后含唯一type), rawEnemyUnits(原始配置引用) }
var LEVEL_BATTLE_STATE = {
  currentLevelOpponent: null
};

// 关卡敌方单位唯一type计数器（避免与玩家单位type冲突）
var LEVEL_UNIT_TYPE_COUNTER = 0;
function genLevelUnitType() {
  LEVEL_UNIT_TYPE_COUNTER++;
  return 'level_battle_' + Date.now() + '_' + LEVEL_UNIT_TYPE_COUNTER;
}

// 关卡品阶→图标风格（直接映射品阶）
var LEVEL_TIER_ICON_STYLE = {
  iron:   'iron',
  bronze: 'bronze',
  gold:   'gold',
  diamond:'diamond'
};

// 关卡品阶→召唤档次（_summonTier字段，兼容UI展示）
var LEVEL_TIER_SUMMON_TIER = {
  iron: 1,
  bronze: 2,
  gold: 3,
  diamond: 4
};

// 关卡difficulty→AI行为难度（legend映射到extreme使AI精锐）
var LEVEL_DIFFICULTY_MAP = {
  easy:   'easy',
  medium: 'medium',
  hard:   'hard',
  legend: 'extreme'
};

// 关卡兵种类型→图标后缀（用于image路径）
var LEVEL_BASETYPE_ICON_SUFFIX = {
  infantry:       'melee',
  cavalry:        'cavalry',
  archer:         'ranged',
  flying:         'flying',
  beast_infantry: 'beast'
};

// 关卡兵种类型→图标emoji
var LEVEL_BASETYPE_ICON_EMOJI = {
  infantry:       '🛡️',
  cavalry:        '🐴',
  archer:         '🏹',
  flying:         '🦅',
  beast_infantry: '🐺'
};

// ===== 进入关卡战斗 =====
// 流程：查找关卡配置 → 取敌方单位定义 → 注入到UD.units（生成唯一type）
//      → 设置关卡战斗标记 → 进入部队选择页 → confirmBattle读取标记拼敌方阵容
function startLevelBattle(levelId) {
  var level = findLevelById(levelId);
  if (!level) {
    if (typeof showToast === 'function') showToast('关卡配置未找到：' + levelId, 'error');
    return;
  }
  if (!GameState.playerUnits || GameState.playerUnits.length === 0) {
    if (typeof showToast === 'function') showToast('你没有可用部队，请先召唤或购买兵团', 'error');
    return;
  }
  if (!UD || !UD.enemyUnits || !UD.enemyUnits.length) {
    if (typeof showToast === 'function') showToast('敌方单位配置缺失', 'error');
    return;
  }

  // 清理上一次关卡战斗残留的临时单位（若有）
  if (LEVEL_BATTLE_STATE.currentLevelOpponent) {
    clearLevelOpponentUnits();
  }
  // 同时清理AI对战残留标记，避免互相干扰
  window._aiBattleOpponent = null;
  if (typeof TurnState !== 'undefined') {
    TurnState.isAIBattle = false;
    TurnState.aiOpponent = null;
  }

  // 取敌方单位定义（按关卡配置的enemyUnitIds顺序）
  var rawEnemyUnits = [];
  level.enemyUnitIds.forEach(function(eid) {
    var eu = UD.enemyUnits.find(function(x) { return x.id === eid; });
    if (eu) rawEnemyUnits.push(eu);
  });
  if (rawEnemyUnits.length === 0) {
    if (typeof showToast === 'function') showToast('敌方单位配置缺失：' + levelId, 'error');
    return;
  }

  // 注入到UD.units（生成唯一type），保存注入后的副本
  var injectedUnits = injectLevelOpponentUnits(rawEnemyUnits, level.tier);

  // 设置关卡战斗运行时状态（confirmBattle 与 结算时读取）
  LEVEL_BATTLE_STATE.currentLevelOpponent = {
    level: level,
    enemyUnits: injectedUnits.slice(),    // 注入后的单位（含唯一type）
    rawEnemyUnits: rawEnemyUnits.slice()  // 原始单位定义引用（用于装备掉落抽取）
  };
  window._currentLevelId = levelId;
  window._currentLevelOpponent = LEVEL_BATTLE_STATE.currentLevelOpponent;
  if (typeof TurnState !== 'undefined') {
    TurnState.isLevelBattle = true;
  }

  // 设置难度（基于关卡difficulty映射到AI行为难度）
  window.selectedDifficulty = LEVEL_DIFFICULTY_MAP[level.difficulty] || 'easy';

  if (typeof showToast === 'function') {
    showToast('⚔ 进入关卡：' + level.name + '，请选择出战部队', 'info');
  }

  // 进入部队选择页 → confirmBattle 会读取 _currentLevelOpponent 拼接敌方type
  showPage('Select');
}

// ===== 注入关卡对手单位到 UD.units（供 unitDefByType 查找）=====
// 生成唯一type避免与玩家单位type冲突，确保敌方专用装备生效
// 注意：必须为每个单位生成唯一type，否则unitDefByType会返回UD.units中第一条匹配
function injectLevelOpponentUnits(rawEnemyUnits, tier) {
  if (!UD) return [];
  if (!UD.units) UD.units = [];
  var style = LEVEL_TIER_ICON_STYLE[tier] || 'iron';
  var injected = [];
  rawEnemyUnits.forEach(function(eu) {
    var uniqueType = genLevelUnitType();
    var iconSuffix = LEVEL_BASETYPE_ICON_SUFFIX[eu.type] || 'melee';
    var imgPath = typeof getUnitImagePath === 'function'
      ? getUnitImagePath(tier, eu.type)
      : 'assets/images/icon_' + style + '_' + iconSuffix + '.png';
    // 浅拷贝原始定义，覆盖关键字段
    var unitDef = Object.assign({}, eu);
    // 重新拷贝equipment避免污染原始配置（equipment内是id字符串）
    unitDef.equipment = {
      mainWeapon: eu.equipment ? eu.equipment.mainWeapon : null,
      shield:     eu.equipment ? eu.equipment.shield : null,
      armor:      eu.equipment ? eu.equipment.armor : null,
      mount:      eu.equipment ? eu.equipment.mount : null
    };
    unitDef.type = uniqueType;
    unitDef.image = imgPath;
    unitDef.icon = eu.icon || LEVEL_BASETYPE_ICON_EMOJI[eu.type] || '🛡️';
    unitDef._levelBattleTemp = true;
    unitDef._summoned = true;
    unitDef._summonTier = LEVEL_TIER_SUMMON_TIER[tier] || 1;
    UD.units.push(unitDef);
    injected.push(unitDef);
  });
  return injected;
}

// ===== 清理关卡对手临时单位（从 UD.units 中过滤掉 _levelBattleTemp）=====
function clearLevelOpponentUnits() {
  // 清理全局 UD
  if (UD && UD.units) {
    UD.units = UD.units.filter(function(u) {
      return !u._levelBattleTemp;
    });
  }
  // 清理 UNIT_TIER_CONFIG 中残留的关卡敌方单位（防止商城显示）
  if (typeof UNIT_TIER_CONFIG !== 'undefined') {
    Object.keys(UNIT_TIER_CONFIG).forEach(function(type) {
      var ud = typeof unitDefByType === 'function' ? unitDefByType(type) : null;
      if (ud && ud._levelBattleTemp) {
        delete UNIT_TIER_CONFIG[type];
      }
    });
  }
}

// ===== 关卡战斗结算入口 =====
// 由 settlement-system.js 在 triggerBattleEnd 中调用
// 返回 true 表示已处理（不再走普通结算/AI结算）
function showLevelBattleSettlement(result) {
  var levelOpp = LEVEL_BATTLE_STATE.currentLevelOpponent;
  if (!levelOpp || !levelOpp.level) return false;

  var level = levelOpp.level;
  var isPlayerWin = result.winner === 'player';

  // 判断首通（首通全额积分，重复减半）
  var isFirstClear = typeof isLevelCompleted === 'function' && !isLevelCompleted(level.id);
  var baseReward = level.rewardPoints || 0;
  var pointsDelta = isPlayerWin
    ? (isFirstClear ? baseReward : Math.floor(baseReward / 2))
    : 0;

  // 装备掉落（仅胜利时）
  var droppedItems = []; // [{item, slot, isGuaranteed}]
  if (isPlayerWin) {
    droppedItems = collectLevelEquipmentDrops(level, levelOpp.rawEnemyUnits, isFirstClear);
    // 装备加入玩家背包
    droppedItems.forEach(function(d) {
      if (d.item && typeof addItemToInventory === 'function') {
        addItemToInventory(d.item, d.slot);
      }
    });
  }

  // 增加积分
  if (pointsDelta > 0) {
    GameState.points += pointsDelta;
  }

  // 标记通关（仅胜利时；首通记录时间，重复不覆盖）
  if (isPlayerWin && typeof markLevelCompleted === 'function') {
    markLevelCompleted(level.id);
  }

  // 保存
  if (typeof saveToBrowser === 'function' && GameState.saveName) {
    saveToBrowser(GameState.saveName);
  }

  // 刷新积分显示
  if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();

  // 生成结算报告（带正确的pointsDelta）
  var report = '';
  if (typeof generateSettlementReport === 'function') {
    report = generateSettlementReport(result, pointsDelta);
  }

  // 显示结算界面
  showLevelSettlementModal(isPlayerWin, result, level, pointsDelta, isFirstClear, droppedItems, report);

  return true;
}

// ===== 装备掉落算法 =====
// 规则：
//   1. 收集本场战斗敌方所有兵团的装备id（mainWeapon/shield/armor/mount四槽）
//   2. 排除空槽位（null/undefined）和天然装备（_natural/_fist_ 前缀id）
//   3. 首通+有guaranteedDrop：第1件=guaranteedDrop（必掉），第2件=敌方装备池随机1件
//   4. 其他情况（重复通关或无guaranteedDrop）：从敌方装备池纯随机2件
//   5. 若池子不足，按实际数量掉落
function collectLevelEquipmentDrops(level, rawEnemyUnits, isFirstClear) {
  var droppedItems = [];

  // 收集敌方所有装备id（含其槽位信息），排除独特装备
  var enemyEquipIds = [];
  rawEnemyUnits.forEach(function(eu) {
    if (!eu.equipment) return;
    var slots = ['mainWeapon', 'shield', 'armor', 'mount'];
    slots.forEach(function(slot) {
      var eqId = eu.equipment[slot];
      if (!eqId) return;
      if (typeof eqId !== 'string') return;
      if (eqId.indexOf('_natural') === 0) return;
      if (eqId.indexOf('_fist_') === 0) return;
      var found = findEquipmentEntryById(eqId);
      if (found && found.item._unique) return;              // 排除独特装备
      enemyEquipIds.push({ id: eqId, slot: slot });
    });
  });

  // 特定掉落（guaranteedDrop）仅首通生效
  var guaranteedEntry = null;
  if (isFirstClear && level.guaranteedDrop) {
    var gFound = findEquipmentEntryById(level.guaranteedDrop);
    if (gFound) {
      guaranteedEntry = gFound;
      droppedItems.push({
        item: gFound.item,
        slot: gFound.slot,
        isGuaranteed: true
      });
    }
  }

  // 随机抽取敌方装备
  var randomCount = guaranteedEntry ? 1 : 2;
  // 排除已作为特定掉落的装备id（避免重复）
  var pool = enemyEquipIds.filter(function(e) {
    if (!guaranteedEntry) return true;
    return e.id !== guaranteedEntry.item.id;
  });

  // Fisher-Yates 洗牌
  for (var i = pool.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }

  for (var k = 0; k < Math.min(randomCount, pool.length); k++) {
    var eqEntry = pool[k];
    var found = findEquipmentEntryById(eqEntry.id);
    if (found) {
      droppedItems.push({
        item: found.item,
        slot: found.slot,
        isGuaranteed: false
      });
    }
  }

  return droppedItems;
}

// ===== 根据装备id查找装备对象和对应槽位 =====
// 依次在 weapons/shields/armors/mounts 中查找
function findEquipmentEntryById(eqId) {
  var w = typeof findWeapon === 'function' ? findWeapon(eqId) : null;
  if (w) return { item: w, slot: 'mainWeapon' };
  var s = typeof findShield === 'function' ? findShield(eqId) : null;
  if (s) return { item: s, slot: 'shield' };
  var a = typeof findArmor === 'function' ? findArmor(eqId) : null;
  if (a) return { item: a, slot: 'armor' };
  var m = typeof findMount === 'function' ? findMount(eqId) : null;
  if (m) return { item: m, slot: 'mount' };
  return null;
}

// ===== 推断装备类型中文标签（用于结算UI展示）=====
function inferEquipmentTypeLabel(item) {
  if (!item) return '装备';
  if (item.handed) return '武器';
  if (item.category === '盾牌') return '盾牌';
  if (item.forScale) return '护甲';
  if (item.scale !== undefined && item.bonusHP !== undefined) return '坐骑';
  return '装备';
}

// ===== 显示关卡结算弹窗 =====
function showLevelSettlementModal(isPlayerWin, result, level, pointsDelta, isFirstClear, droppedItems, report) {
  // 移除已有弹窗
  var existing = document.getElementById('settlementModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'settlementModal';
  modal.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:rgba(20,15,10,0.88);display:flex;' +
    'align-items:center;justify-content:center;z-index:1000;' +
    'overflow-y:auto;padding:20px 0;';

  var tierInfo = LEVEL_TIER_INFO[level.tier] || LEVEL_TIER_INFO.iron;
  var titleColor = isPlayerWin ? '#d4a017' : '#8b2500';
  var borderColor = isPlayerWin ? '#d4a017' : '#5a3010';

  var html = '';
  html += '<div style="background:linear-gradient(135deg,#f5ecd7 0%,#e8dcc0 100%);' +
          'border:3px solid ' + borderColor + ';border-radius:16px;padding:28px 32px;' +
          'max-width:680px;width:92%;text-align:center;box-shadow:0 0 60px rgba(0,0,0,0.4);' +
          'margin:auto;">';

  // 标题
  html += '<div style="font-size:48px;margin-bottom:6px">' + (isPlayerWin ? '🏆' : '💀') + '</div>';
  html += '<h2 style="font-size:28px;color:' + titleColor + ';margin:0 0 4px;letter-spacing:4px;font-family:SimSun,serif;">' + (isPlayerWin ? '胜 利' : '失 败') + '</h2>';
  html += '<div style="font-size:12px;color:#8a6d4b;margin-bottom:8px">关卡：' + escapeHtml(level.name) + ' · ' + tierInfo.name + '品阶 · ' + escapeHtml(result.reason) + '</div>';

  // 积分奖励
  if (isPlayerWin && pointsDelta > 0) {
    var firstClearTag = isFirstClear
      ? '<span style="display:inline-block;margin-left:6px;padding:2px 8px;font-size:11px;background:#d4a017;color:#fff;border-radius:4px;letter-spacing:1px">首通奖励</span>'
      : '<span style="display:inline-block;margin-left:6px;padding:2px 8px;font-size:11px;background:#8a6d4b;color:#fff;border-radius:4px;letter-spacing:1px">重复通关</span>';
    html += '<div class="lc-settlement-reward" style="background:linear-gradient(135deg,rgba(212,131,10,0.15),rgba(212,131,10,0.08));border:2px solid #d4a017;border-radius:10px;padding:10px 14px;margin-bottom:14px">';
    html +=   '<div style="font-size:12px;color:#8a6d4b">🎁 关卡奖励积分' + firstClearTag + '</div>';
    html +=   '<div style="font-size:22px;color:#d4a017;font-weight:bold">+ ' + pointsDelta + ' 积分</div>';
    if (!isFirstClear) {
      html += '<div style="font-size:11px;color:#6b4c2a">原 ' + (level.rewardPoints || 0) + ' 积分 · 重复通关减半</div>';
    }
    html +=   '<div style="font-size:11px;color:#6b4c2a">当前总积分：<b>' + GameState.points + '</b></div>';
    html += '</div>';
  } else if (!isPlayerWin) {
    html += '<div class="lc-settlement-reward" style="background:rgba(139,37,0,0.08);border:1px solid #8b2500;border-radius:8px;padding:12px;margin-bottom:14px">';
    html +=   '<div style="font-size:12px;color:#8b2500">💀 战斗失败，无奖励</div>';
    html +=   '<div style="font-size:11px;color:#6b4c2a;margin-top:4px">当前总积分：<b>' + GameState.points + '</b></div>';
    html += '</div>';
  }

  // 战损统计
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;text-align:left">';
  html +=   '<div style="background:rgba(107,142,35,0.12);border:1px solid #6b8e23;border-radius:8px;padding:10px">';
  html +=     '<div style="font-size:11px;color:#6b8e23;font-weight:bold;margin-bottom:4px">🔷 我方</div>';
  html +=     '<div style="font-size:12px;color:#3d2b1a">存活 <b style="color:#6b8e23">' + result.playerAlive + '</b> · 溃逃 <b style="color:#8b2500">' + result.playerRouted + '</b></div>';
  html +=   '</div>';
  html +=   '<div style="background:rgba(139,37,0,0.1);border:1px solid #8b2500;border-radius:8px;padding:10px">';
  html +=     '<div style="font-size:11px;color:#8b2500;font-weight:bold;margin-bottom:4px">🔶 敌方</div>';
  html +=     '<div style="font-size:12px;color:#3d2b1a">存活 <b style="color:#8b2500">' + result.enemyAlive + '</b> · 溃逃 <b style="color:#8b2500">' + result.enemyRouted + '</b></div>';
  html +=   '</div>';
  html += '</div>';

  // 装备掉落列表（仅胜利时）
  if (isPlayerWin && droppedItems.length > 0) {
    html += '<div style="background:rgba(0,0,0,0.04);border:1px solid #c4b290;border-radius:10px;padding:14px;margin-bottom:14px">';
    html +=   '<div style="font-size:14px;color:#3d1a00;font-weight:bold;margin-bottom:4px;letter-spacing:2px">🎁 装备掉落</div>';
    html +=   '<div style="font-size:11px;color:#8a6d4b;margin-bottom:10px">缴获敌方装备 ' + droppedItems.length + ' 件，已加入背包</div>';
    html +=   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';

    droppedItems.forEach(function(d) {
      var item = d.item;
      var tierName = typeof getTierName === 'function' ? getTierName(item.tier) : '';
      var tierColor = typeof getTierColor === 'function' ? getTierColor(item.tier) : '#4a4a4a';
      var appText  = typeof getEquipmentApplicabilityText === 'function' ? getEquipmentApplicabilityText(item) : '';
      var typeLabel = inferEquipmentTypeLabel(item);
      var guaranteedTag = d.isGuaranteed
        ? '<span style="display:inline-block;margin-left:4px;padding:1px 6px;font-size:10px;background:#c0392b;color:#fff;border-radius:3px;letter-spacing:1px;vertical-align:middle">首通</span>'
        : '';

      html += '<div class="lc-settlement-drop" style="background:#fff;border:2px solid ' + tierColor + ';border-radius:8px;padding:8px;text-align:left;position:relative;">';
      html +=   '<div style="font-size:13px;color:' + tierColor + ';font-weight:bold;margin-bottom:2px">' + escapeHtml(item.name) + guaranteedTag + '</div>';
      html +=   '<div style="font-size:11px;color:#6b4c2a;margin-bottom:2px">' + typeLabel + ' · ' + tierName + '品阶</div>';
      if (appText) {
        html += '<div style="font-size:10px;color:#8a6d4b">' + escapeHtml(appText) + '</div>';
      }
      html += '</div>';
    });

    html +=   '</div>';
    html += '</div>';
  } else if (isPlayerWin && droppedItems.length === 0) {
    html += '<div style="background:rgba(0,0,0,0.04);border:1px solid #c4b290;border-radius:10px;padding:14px;margin-bottom:14px">';
    html +=   '<div style="font-size:13px;color:#8a6d4b">本场敌方无装备掉落</div>';
    html += '</div>';
  }

  // 战报
  if (report) {
    html += '<div style="text-align:left;background:rgba(0,0,0,0.04);border:1px solid #c4b290;border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px;color:#5a3e20;line-height:1.8;max-height:100px;overflow-y:auto">';
    html +=   report.replace(/\n/g, '<br>');
    html += '</div>';
  }

  // 按钮
  html += '<div style="display:flex;gap:10px;justify-content:center;margin-top:8px">';
  html +=   '<button onclick="closeLevelBattleSettlement()" style="padding:10px 24px;font-size:14px;border:2px solid #b8a080;border-radius:8px;background:linear-gradient(135deg,#f5ecd7 0%,#e8dcc0 100%);color:#3d1a00;cursor:pointer;font-family:SimSun,serif;letter-spacing:2px">📜 返回关卡选择</button>';
  html += '</div>';

  html += '</div>';
  modal.innerHTML = html;
  document.body.appendChild(modal);

  // 结算弹窗入场动画（参考 summon modal 风格）
  if (window.gsap) {
    var modalContent = modal.firstElementChild;
    gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    if (modalContent) {
      gsap.fromTo(modalContent,
        { opacity: 0, scale: 0.85, rotationY: -10 },
        { opacity: 1, scale: 1, rotationY: 0, duration: 0.5, ease: 'back.out(1.4)' }
      );
    }
    // 掉落/奖励卡片交错入场（stagger 0.08s）
    setTimeout(function() {
      var cards = modal.querySelectorAll('.lc-settlement-reward, .lc-settlement-drop');
      if (cards.length) {
        gsap.fromTo(cards,
          { opacity: 0, y: 20, scale: 0.8 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(1.4)' }
        );
      }
    }, 200);
  }
}

// ===== 关闭关卡结算弹窗并返回关卡选择 =====
function closeLevelBattleSettlement() {
  var modal = document.getElementById('settlementModal');
  if (modal) {
    if (window.gsap) {
      var content = modal.firstElementChild;
      modal.classList.add('modal-closing');
      if (content) {
        gsap.to(content, { opacity: 0, scale: 0.9, duration: 0.2, ease: 'power2.in' });
      }
      gsap.to(modal, { opacity: 0, duration: 0.22, ease: 'power2.in' });
      setTimeout(function() { modal.remove(); }, 220);
    } else {
      modal.remove();
    }
  }

  // 清理棋盘
  if (typeof placedPieces !== 'undefined') {
    Object.keys(placedPieces).forEach(function(k) {
      if (typeof returnToBench === 'function') returnToBench(placedPieces[k].slotIdx);
      delete placedPieces[k];
    });
  }
  if (typeof selectedPieceKey !== 'undefined') selectedPieceKey = null;
  if (typeof stopAnimLoop === 'function') stopAnimLoop();
  if (typeof initTurns === 'function') initTurns();
  if (typeof interactionInited !== 'undefined') interactionInited = false;

  // 隐藏幕布
  var curtain = document.getElementById('battleCurtain');
  if (curtain) { curtain.style.display = 'flex'; curtain.style.opacity = '1'; }

  // 清理临时注入的关卡敌方单位
  clearLevelOpponentUnits();

  // 重置关卡战斗运行时状态
  LEVEL_BATTLE_STATE.currentLevelOpponent = null;
  window._currentLevelId = null;
  window._currentLevelOpponent = null;
  if (typeof TurnState !== 'undefined') {
    TurnState.isLevelBattle = false;
  }

  // 返回关卡选择页（showPage('Levels') 会自动调用 buildLevelsPage 刷新通关状态）
  showPage('Levels');
}

// ===== 暴露给全局 =====
window.buildLevelsPage = buildLevelsPage;
window.startLevelBattle = startLevelBattle;
window.isDifficultyUnlocked = isDifficultyUnlocked;
window.findLevelById = findLevelById;
window.LEVEL_BATTLE_STATE = LEVEL_BATTLE_STATE;
window.injectLevelOpponentUnits = injectLevelOpponentUnits;
window.clearLevelOpponentUnits = clearLevelOpponentUnits;
window.showLevelBattleSettlement = showLevelBattleSettlement;
window.collectLevelEquipmentDrops = collectLevelEquipmentDrops;
window.findEquipmentEntryById = findEquipmentEntryById;
window.showLevelSettlementModal = showLevelSettlementModal;
window.closeLevelBattleSettlement = closeLevelBattleSettlement;
window.getEquipmentDisplayName = getEquipmentDisplayName;
