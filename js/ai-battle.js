// ==================== AI对战基础框架 ====================
// 流程：寻找对手（生成AI对手）→ 进入战斗 → 胜利后选择获得对方一个兵种
// 对手生成复用 summon-engine 的思路（简化版独立函数），战斗复用现有 combat 系统

// ===== AI对手词库（前缀+后缀随机组合）=====
var AI_NAME_PREFIXES = [
  '暗影', '血刃', '铁蹄', '烈焰', '寒冰', '雷霆', '钢鬃', '黑鸦',
  '残月', '狂风', '暮色', '霜狼', '龙牙', '鹰眼', '巨锤', '暴风',
  '邪月', '铁血', '烈日', '苍狼', '幽冥', '赤焰', '玄铁', '夜枭'
];
var AI_NAME_SUFFIXES = [
  '军团', '骑士团', '战团', '兵团', '联队', '军', '营', '战队', '师团', '雇佣兵团'
];

// ===== 品阶配置（黑铁/青铜/黄金三档基调）=====
// tier -> 难度映射（影响AI行为与积分奖励）
var AI_TIER_DIFFICULTY = {
  iron:   { reward: 200, label: '黑铁', color: '#4a4a4a' },
  bronze: { reward: 400, label: '青铜', color: '#cd7f32' },
  gold:   { reward: 600, label: '黄金', color: '#ffd700' },
  diamond:{ reward: 1000, label: '钻石', color: '#a78bfa' }
};

var AI_TIER_ICON_STYLE = {
  iron:   'iron',
  bronze: 'bronze',
  gold:   'gold',
  diamond:'diamond'
};

// 兵种类型配置（baseType -> 中文显示名/图标后缀/可选武器类型）
var AI_BASE_TYPE_CONFIG = {
  infantry:       { typeName: '步兵',   iconSuffix: 'melee',   weaponTypes: ['short', 'long'] },
  cavalry:        { typeName: '骑兵',   iconSuffix: 'cavalry', weaponTypes: ['short'] },
  archer:         { typeName: '远程兵', iconSuffix: 'ranged',  weaponTypes: ['bow', 'crossbow'] },
  flying:         { typeName: '空军',   iconSuffix: 'flying',  weaponTypes: ['short', 'crossbow'] },
  beast_infantry: { typeName: '野兽步兵', iconSuffix: 'beast',  weaponTypes: [] }
};

// AI对战运行时状态
var AI_BATTLE_STATE = {
  currentOpponent: null,   // 当前生成的对手 {name, tier, units:[unitDef,...]}
  pendingBattle: false,    // 是否处于"已选择对手待开战"状态
  statMultiplier: 1.00     // 属性倍率（默认1.00=不变）
};

// ===== 斗蛐蛐对战模式状态 =====
// sideA  = 甲方（player 阵营）  sideB = 乙方（enemy 阵营）
// 每侧结构：{ name, tier, units:[unitDef,...], controlledByAI:bool }
var DUEL_STATE = {
  sideA: null,
  sideB: null,
  bothGenerated: false
};


// AI单位类型唯一计数器
var AI_UNIT_TYPE_COUNTER = 0;

// ===== 生成唯一AI单位type =====
function genAIUnitType() {
  AI_UNIT_TYPE_COUNTER++;
  return 'ai_battle_' + Date.now() + '_' + AI_UNIT_TYPE_COUNTER;
}

// ===== 生成随机对手名 =====
function generateAIOpponentName() {
  var prefix = AI_NAME_PREFIXES[Math.floor(Math.random() * AI_NAME_PREFIXES.length)];
  var suffix = AI_NAME_SUFFIXES[Math.floor(Math.random() * AI_NAME_SUFFIXES.length)];
  return prefix + suffix;
}

// ===== 主入口：生成AI对手（预留LLM接口）=====
// useLLM=true 时未来可调用LLM生成更具个性的对手，当前仍走规则生成
function generateAIOpponent(useLLM) {
  useLLM = useLLM || false;

  if (useLLM) {
    // TODO: LLM接入 - 未来在此调用后端 LLM API 生成对手
    //       目前仍走规则生成，保持函数返回结构一致
  }

  // 随机选择对手品阶基调（黑铁/青铜/黄金）
  var tierKeys = ['iron', 'bronze', 'gold'];
  var tier = tierKeys[Math.floor(Math.random() * tierKeys.length)];

  // 随机生成3-5支敌方兵团
  var unitCount = 3 + Math.floor(Math.random() * 3); // 3,4,5
  var units = [];
  var usedBaseTypes = [];
  for (var i = 0; i < unitCount; i++) {
    var unitDef = generateAIUnitDef(tier, i, usedBaseTypes);
    if (unitDef) units.push(unitDef);
  }

  // 兜底：至少3支
  while (units.length < 3) {
    var fallback = generateAIUnitDef(tier, units.length, usedBaseTypes);
    if (fallback) units.push(fallback); else break;
  }

  return {
    name: generateAIOpponentName(),
    tier: tier,
    units: units
  };
}

// ===== 生成单支AI单位（参考summon-engine生成逻辑，简化版）=====
// tier: iron/bronze/gold
// index: 序号（用于命名兜底）
// usedBaseTypes: 已使用的baseType列表（避免重复，传入可变数组）
function generateAIUnitDef(tier, index, usedBaseTypes) {
  if (!RD || !ED || !UD) return null;

  // ===== 1. 选择兵种类型（保证多样性）=====
  var allBaseTypes = ['infantry', 'cavalry', 'archer', 'flying', 'beast_infantry'];
  var availableTypes = allBaseTypes.filter(function(t) { return usedBaseTypes.indexOf(t) < 0; });
  // 若已全用过则重置，允许重复
  if (availableTypes.length === 0) availableTypes = allBaseTypes;
  var baseType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  usedBaseTypes.push(baseType);

  var typeCfg = AI_BASE_TYPE_CONFIG[baseType] || AI_BASE_TYPE_CONFIG.infantry;

  // ===== 2. 选择种族 =====
  var raceId, raceData;
  if (baseType === 'beast_infantry') {
    var beastIds = ['war_dog', 'war_wolf'];
    raceId = beastIds[Math.floor(Math.random() * beastIds.length)];
    raceData = getRace(raceId);
  } else if (baseType === 'flying') {
    // 空军需有飞行坐骑支撑，使用人类/精灵
    var flyingRaceIds = ['human', 'elf'];
    raceId = flyingRaceIds[Math.floor(Math.random() * flyingRaceIds.length)];
    raceData = getRace(raceId);
  } else {
    // 优先人族/精灵/矮人等常规种族
    var normalRaceIds = ['human', 'elf'];
    raceId = normalRaceIds[Math.floor(Math.random() * normalRaceIds.length)];
    raceData = getRace(raceId);
  }
  if (!raceData) {
    // 兜底：取RD第一个种族
    if (RD.races && RD.races.length) { raceData = RD.races[0]; raceId = raceData.id; }
    else return null;
  }

  // ===== 3. 装备选择（按品阶从对应装备池随机配装）=====
  var equipment = pickEquipmentByTier(tier, baseType, raceId, typeCfg);

  // ===== 4. 兵团人数（参考标准规模）=====
  var unitCount;
  if (baseType === 'cavalry') unitCount = 40;
  else if (baseType === 'flying') unitCount = 32;
  else if (baseType === 'beast_infantry') unitCount = 80;
  else unitCount = 160;

  // ===== 5. 构造 unitDef =====
  var unitId = 'aiu_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substring(2, 6);
  var uniqueType = genAIUnitType();
  var imgPath = typeof getUnitImagePath === 'function'
    ? getUnitImagePath(tier, baseType)
    : 'assets/images/icon_' + tier + '_' + typeCfg.iconSuffix + '.png';

  var unitDef = {
    id: unitId,
    tier: tier,
    name: generateAIUnitName(baseType, raceData, tier, index),
    race: { id: raceData.id, name: raceData.name },
    background: generateAIBackground(baseType, raceData, tier),
    belief: '胜利即真理',
    type: uniqueType,
    baseType: baseType,
    typeName: typeCfg.typeName,
    image: imgPath,
    icon: getBaseTypeIcon(baseType),
    unitCount: unitCount,
    equipment: equipment,
    _summoned: true,
    _aiBattleTemp: true,
    _summonTier: tierToSummonTier(tier),
    powerIndex: 0
  };

  // 计算战力指数（若 summon-engine 可用）
  if (typeof computeStats === 'function') {
    var st = computeStats(unitDef);
    if (st && typeof calculatePowerIndex === 'function') {
      st.unitCount = unitCount;
      st.unitScale = st.unitScale || 1;
      unitDef.powerIndex = calculatePowerIndex(st);
    }
  }

  return unitDef;
}

// 品阶 -> 召唤档次（用于_summonTier字段，兼容现有UI展示）
function tierToSummonTier(tier) {
  if (tier === 'iron') return 1;
  if (tier === 'bronze') return 2;
  if (tier === 'gold') return 3;
  if (tier === 'diamond') return 4;
  return 1;
}

// ===== 按品阶配装：从对应品阶装备中随机选取 =====
function pickEquipmentByTier(tier, baseType, raceId, typeCfg) {
  var isBeast = (typeof isBeastRace === 'function') && isBeastRace(raceId);
  var equipment = { mainWeapon: null, shield: null, armor: null, mount: null };

  // 野兽：只配护甲
  if (isBeast) {
    equipment.armor = pickEquipFromED('armors', tier, function(a) {
      return a.forScale && getSizeCategory(raceId) && a.forScale.indexOf(getSizeCategory(raceId)) >= 0;
    });
    return equipment;
  }

  // ===== 主武器 =====
  if (typeCfg.weaponTypes.length > 0) {
    equipment.mainWeapon = pickWeaponByTierAndType(tier, typeCfg.weaponTypes, baseType);
  }

  // ===== 盾牌（单手武器才配盾）=====
  if (equipment.mainWeapon) {
    var mw = findWeapon(equipment.mainWeapon);
    if (mw && mw.handed === 'one-handed') {
      // 步兵/骑兵高概率配盾
      if (baseType === 'infantry' || baseType === 'cavalry') {
        if (Math.random() < 0.7) {
          equipment.shield = pickEquipFromED('shields', tier, null);
        }
      }
    }
  }

  // ===== 护甲 =====
  equipment.armor = pickArmorByTierAndType(tier, baseType, raceId);

  // ===== 坐骑（骑兵必须有坐骑，空军必须有飞行坐骑）=====
  if (baseType === 'cavalry') {
    equipment.mount = pickMountByTierAndType(tier, false);
  } else if (baseType === 'flying') {
    equipment.mount = pickMountByTierAndType(tier, true);
  }

  return equipment;
}

// 从ED指定分类中按品阶筛选随机选一个
function pickEquipFromED(category, tier, extraFilter) {
  if (!ED || !ED[category]) return null;
  var pool = ED[category].filter(function(e) {
    if (e._unique) return false;
    if (e.tier !== tier) return false;
    if (extraFilter) return extraFilter(e);
    return true;
  });
  // 同品阶为空时降级到黑铁（兜底）
  if (pool.length === 0 && tier !== 'iron') {
    pool = ED[category].filter(function(e) { return !e._unique && e.tier === 'iron'; });
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function pickWeaponByTierAndType(tier, weaponTypes, baseType) {
  if (!ED || !ED.weapons) return null;
  var pool = ED.weapons.filter(function(w) {
    if (w._unique) return false;
    if (w.tier !== tier) return false;
    if (weaponTypes.indexOf(w.type) < 0) return false;
    // 检查适用兵种
    if (!w.forUnits) return true;
    if (w.forUnits.indexOf('全兵种') >= 0) return true;
    var typeMap = { infantry:'步兵', cavalry:'骑兵', archer:'远程兵', flying:'空军' };
    var cn = typeMap[baseType];
    if (cn && w.forUnits.indexOf(cn) >= 0) return true;
    // 宽松匹配
    if (baseType === 'infantry' && (w.forUnits.indexOf('步兵') >= 0 || w.forUnits.indexOf('重步兵') >= 0 || w.forUnits.indexOf('轻步兵') >= 0)) return true;
    if (baseType === 'cavalry' && (w.forUnits.indexOf('骑兵') >= 0 || w.forUnits.indexOf('重骑兵') >= 0 || w.forUnits.indexOf('轻骑兵') >= 0)) return true;
    if (baseType === 'archer' && w.forUnits.indexOf('远程兵') >= 0) return true;
    if (baseType === 'flying' && w.forUnits.indexOf('空军') >= 0) return true;
    return false;
  });
  if (pool.length === 0 && tier !== 'iron') {
    pool = ED.weapons.filter(function(w) {
      if (w._unique) return false;
      if (w.tier !== 'iron') return false;
      if (weaponTypes.indexOf(w.type) < 0) return false;
      if (!w.forUnits) return true;
      if (w.forUnits.indexOf('全兵种') >= 0) return true;
      var cn2 = typeMap[baseType];
      if (cn2 && w.forUnits.indexOf(cn2) >= 0) return true;
      if (baseType === 'infantry' && (w.forUnits.indexOf('步兵') >= 0 || w.forUnits.indexOf('重步兵') >= 0 || w.forUnits.indexOf('轻步兵') >= 0)) return true;
      if (baseType === 'cavalry' && (w.forUnits.indexOf('骑兵') >= 0 || w.forUnits.indexOf('重骑兵') >= 0 || w.forUnits.indexOf('轻骑兵') >= 0)) return true;
      if (baseType === 'archer' && w.forUnits.indexOf('远程兵') >= 0) return true;
      if (baseType === 'flying' && w.forUnits.indexOf('空军') >= 0) return true;
      return false;
    });
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function pickArmorByTierAndType(tier, baseType, raceId) {
  if (!ED || !ED.armors) return null;
  var sizeCat = (typeof getSizeCategory === 'function') ? getSizeCategory(raceId) : null;
  var pool = ED.armors.filter(function(a) {
    if (a.tier !== tier) return false;
    // 体型匹配（若有forScale）
    if (sizeCat && a.forScale && a.forScale.indexOf(sizeCat) < 0) return false;
    // 兵种匹配（宽松）
    if (a.forUnits && a.forUnits.indexOf('全兵种') < 0) {
      var typeMap = { infantry:'步兵', cavalry:'骑兵', archer:'远程兵', flying:'空军' };
      var cn = typeMap[baseType];
      if (cn && a.forUnits.indexOf(cn) < 0) return false;
    }
    return true;
  });
  // 降级到黑铁
  if (pool.length === 0 && tier !== 'iron') {
    pool = ED.armors.filter(function(a) {
      if (a.tier !== 'iron') return false;
      if (sizeCat && a.forScale && a.forScale.indexOf(sizeCat) < 0) return false;
      return true;
    });
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function pickMountByTierAndType(tier, requireFlying) {
  if (!ED || !ED.mounts) return null;
  var pool = ED.mounts.filter(function(m) {
    if (m.tier !== tier) return false;
    if (requireFlying) {
      // 空军坐骑必须有飞行能力
      return m.effects && m.effects.indexOf('飞行能力') >= 0;
    }
    // 骑兵坐骑：非飞行
    return !m.effects || m.effects.indexOf('飞行能力') < 0;
  });
  // 降级到黑铁
  if (pool.length === 0 && tier !== 'iron') {
    pool = ED.mounts.filter(function(m) {
      if (m.tier !== 'iron') return false;
      if (requireFlying) return m.effects && m.effects.indexOf('飞行能力') >= 0;
      return !m.effects || m.effects.indexOf('飞行能力') < 0;
    });
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

// ===== 兵种名/背景生成 =====
function generateAIUnitName(baseType, raceData, tier, index) {
  var tierLabel = (AI_TIER_DIFFICULTY[tier] || {}).label || '';
  var typeNames = {
    infantry: '步卒', cavalry: '骑手', archer: '射手', flying: '飞兵', beast_infantry: '兽群'
  };
  var prefix = ['血', '铁', '影', '焰', '霜', '雷', '钢', '夜', '黑', '赤'][Math.floor(Math.random()*10)];
  return prefix + tierLabel + (raceData ? raceData.name : '') + (typeNames[baseType] || '兵团') + '·' + (index + 1);
}

function generateAIBackground(baseType, raceData, tier) {
  var tierDesc = { iron: '久经沙场', bronze: '精锐老练', gold: '威名远播', diamond: '传说之巅' };
  var typeDesc = {
    infantry: '擅长正面推进的步兵方阵',
    cavalry: '以侧翼突击见长的骑兵部队',
    archer: '远程压制精准的射手兵团',
    flying: '掌控制空权的空中力量',
    beast_infantry: '凶猛无畏的野兽集群'
  };
  return (tierDesc[tier] || '久经沙场') + '的' + (raceData ? raceData.name : '异族') + (typeDesc[baseType] || '兵团');
}

function getBaseTypeIcon(baseType) {
  var icons = { infantry:'🛡️', cavalry:'🐴', archer:'🏹', flying:'🦅', beast_infantry:'🐺' };
  return icons[baseType] || '🛡️';
}

// ===== 注入AI对手单位到数据中心（供 unitDefByType 查找）=====
function injectAIOpponentUnits(opponent) {
  if (!opponent || !opponent.units) return;
  if (!UD) return;
  if (!UD.units) UD.units = [];
  opponent.units.forEach(function(u) {
    var exists = UD.units.find(function(x) { return x.id === u.id; });
    if (!exists) {
      UD.units.push(u);
    }
  });
}

// ===== 清理AI对手临时单位（保留被领取的）=====
function clearAIOpponentUnits(keepUnitIds) {
  keepUnitIds = keepUnitIds || [];
  if (UD && UD.units) {
    UD.units = UD.units.filter(function(u) {
      if (!u._aiBattleTemp) return true;
      return keepUnitIds.indexOf(u.id) >= 0;
    });
  }

  // ===== [核心修复] 清理临时种族 =====
  if (typeof RD !== 'undefined' && RD.races) {
    RD.races = RD.races.filter(function(r) {
      return !r._aiTemp;
    });
  }

  // ===== [核心修复] 同时清理动态生成的AI临时装备，防止ED缓存膨胀 =====
  if (typeof ED !== 'undefined') {
    var categories = ['weapons', 'shields', 'armors', 'mounts'];
    categories.forEach(function(cat) {
      if (ED[cat]) {
        ED[cat] = ED[cat].filter(function(item) {
          // 只保留不是临时AI生成的，或者该装备所属的单位已被玩家领取(不属于被清空单位)
          if (!item._aiTemp) return true;
          return false; // 默认AI对战结束，一律清空临时装备（被领取的单位会在 claim 阶段将装备深拷贝持久化）
        });
      }
    });
  }
  AI_BATTLE_STATE.statMultiplier = 1.00;
}

// ===== 给AI对手应用属性倍率 =====
function applyAIBattleMultiplier(opponent, multiplier) {
  if (!opponent || !opponent.units) return;
  if (multiplier <= 1.00) return;

  AI_BATTLE_STATE.statMultiplier = multiplier;

  opponent.units.forEach(function(u) {
    var eq = u.equipment;
    if (!eq) return;

    // 武器：杀伤和破甲
    if (eq.mainWeapon) {
      var wDef = typeof findWeapon === 'function' ? findWeapon(eq.mainWeapon) : null;
      if (wDef && !wDef._aiMultiplier) {
        wDef.baseDamage = Math.round(wDef.baseDamage * multiplier);
        wDef.armorPierce = Math.round(wDef.armorPierce * multiplier);
        wDef._aiMultiplier = multiplier;
      }
    }

    // 护甲：防御值
    if (eq.armor) {
      var aDef = typeof findArmor === 'function' ? findArmor(eq.armor) : null;
      if (aDef && !aDef._aiMultiplier) {
        aDef.defense = Math.round(aDef.defense * multiplier);
        aDef._aiMultiplier = multiplier;
      }
    }

    // 盾牌：防御值
    if (eq.shield) {
      var sDef = typeof findShield === 'function' ? findShield(eq.shield) : null;
      if (sDef && !sDef._aiMultiplier) {
        sDef.defense = Math.round(sDef.defense * multiplier);
        sDef._aiMultiplier = multiplier;
      }
    }

    // 拉满（2.00）：额外士气+5、移动+1
    if (multiplier >= 1.99 && u.race && u.race.id) {
      var rDef = typeof getRace === 'function' ? getRace(u.race.id) : null;
      if (rDef && !rDef._aiMultiplier) {
        rDef.baseHP = Math.round((rDef.baseHP || 100) * 1.2);
        rDef.baseMorale = (rDef.baseMorale || 0) + 5;
        rDef.baseMovement = (rDef.baseMovement || 1) + 1;
        rDef._aiMultiplier = multiplier;
      }
    }
  });

  // 重新计算战力和数值
  if (typeof computeStats === 'function' && typeof calculatePowerIndex === 'function') {
    opponent.units.forEach(function(u) {
      var st = computeStats(u);
      if (st) {
        st.unitCount = u.unitCount;
        st.unitScale = st.unitScale || 1;
        u.powerIndex = calculatePowerIndex(st);
      }
    });
  }
}

// ===== 构建AI对战页面 =====
function buildAIBattlePage() {
  var wrap = document.getElementById('aiBattleContent');
  if (!wrap) return;
  wrap.innerHTML = '';

  // 标题区
  var header = document.createElement('div');
  header.className = 'ai-battle-header';
  header.innerHTML =
    '<h2 class="ai-battle-title">⚔ AI 对战竞技场</h2>' +
    '<div class="ai-battle-sub">描述你想挑战的对手，系统为你匹配跨越次元的敌人</div>';
  wrap.appendChild(header);

  // 设置区
  var settings = document.createElement('div');
  settings.className = 'ai-battle-settings';
  settings.innerHTML =
    // 敌人数量
    '<div class="ai-setting-row">' +
      '<label class="ai-setting-label">敌方数量</label>' +
      '<div class="ai-slider-wrap">' +
        '<input type="range" id="aiUnitCount" min="3" max="10" value="4" class="ai-slider">' +
        '<span class="ai-slider-val" id="aiUnitCountVal">4</span>' +
      '</div>' +
    '</div>' +
    // 敌人指挥官水平
    '<div class="ai-setting-row">' +
      '<label class="ai-setting-label">敌人指挥官水平</label>' +
      '<div class="ai-diff-btns" id="aiIntelBtns">' +
        '<button class="ai-diff-btn" data-intel="easy">简单</button>' +
        '<button class="ai-diff-btn active" data-intel="hard">困难</button>' +
        '<button class="ai-diff-btn" data-intel="legend">传说</button>' +
      '</div>' +
    '</div>' +
    // 敌人部队水平
    '<div class="ai-setting-row">' +
      '<label class="ai-setting-label">敌人部队水平</label>' +
      '<div class="ai-diff-btns" id="aiStrengthBtns">' +
        '<button class="ai-diff-btn" data-strength="easy">简单</button>' +
        '<button class="ai-diff-btn active" data-strength="hard">困难</button>' +
        '<button class="ai-diff-btn" data-strength="legend">传说</button>' +
      '</div>' +
    '</div>' +
    // 描述输入
    '<div class="ai-setting-row ai-desc-row">' +
      '<label class="ai-setting-label">对手描述</label>' +
      '<textarea id="aiDescInput" class="ai-desc-input" placeholder="描述你想和什么样的对手交战...&#10;例如：&#10;- 来自战锤世界的混沌战士&#10;- 中土世界的半兽人军团&#10;- DND地下城的卓尔精灵&#10;- 三国时期的精锐骑兵&#10;- 留空则随机生成" rows="4"></textarea>' +
    '</div>' +
    // 属性倍率调节
    '<div class="ai-setting-row">' +
      '<label class="ai-setting-label">不够难吗？属性倍率 <span id="aiMultiplierVal" style="color:#ff6b35;font-weight:bold;">1.00</span>x</label>' +
      '<div class="ai-slider-wrap">' +
        '<input type="range" id="aiStatMultiplier" min="1.00" max="2.00" step="0.05" value="1.00" class="ai-slider">' +
      '</div>' +
      '<div class="ai-setting-hint">调节敌军杀伤/破甲/护甲的倍率，拉满（2.00）时敌军额外获得士气+5、移动+1</div>' +
    '</div>';
  wrap.appendChild(settings);

  // 操作按钮
  var actions = document.createElement('div');
  actions.className = 'ai-battle-actions';
  actions.innerHTML =
    '<button class="ai-btn ai-btn-primary" id="aiFindBtn">🔍 跨次元搜寻</button>' +
    '<button class="ai-btn" id="duelModeBtn" style="background:#6b46c1;color:#fff;border-color:#553c9a;">🐛 斗蛐蛐模式</button>' +
    '<button class="ai-btn ai-btn-back" onclick="showPage(\'Prep\')">← 返回</button>';
  wrap.appendChild(actions);

  // 对手展示区
  var info = document.createElement('div');
  info.className = 'ai-battle-info';
  info.id = 'aiBattleInfo';
  info.innerHTML = '<div class="ai-empty-hint">描述你想打的对手，然后点击「跨次元搜寻」</div>';
  wrap.appendChild(info);

  // 绑定事件
  var slider = document.getElementById('aiUnitCount');
  var sliderVal = document.getElementById('aiUnitCountVal');
  if (slider && sliderVal) {
    slider.addEventListener('input', function() {
      sliderVal.textContent = slider.value;
    });
  }

  // 智慧按钮
  var intelBtns = document.querySelectorAll('#aiIntelBtns .ai-diff-btn');
  intelBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      intelBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // 强度按钮
  var strengthBtns = document.querySelectorAll('#aiStrengthBtns .ai-diff-btn');
  strengthBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      strengthBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // 倍率滑块
  var multSlider = document.getElementById('aiStatMultiplier');
  var multVal = document.getElementById('aiMultiplierVal');
  if (multSlider && multVal) {
    multSlider.addEventListener('input', function() {
      multVal.textContent = parseFloat(multSlider.value).toFixed(2);
    });
  }

  // 搜寻按钮
  var findBtn = document.getElementById('aiFindBtn');
  if (findBtn) findBtn.addEventListener('click', onFindAIOpponent);

  // 斗蛐蛐模式入口
  var duelBtn = document.getElementById('duelModeBtn');
  if (duelBtn) duelBtn.addEventListener('click', function() { showPage('DuelArena'); });

  if (AI_BATTLE_STATE.currentOpponent) {
    refreshAIOpponentDisplay();
  }
}

// ===== 跨次元搜寻（调用 AI 生成对手）=====
window._aiFindController = null;

function onFindAIOpponent() {
  var findBtn = document.getElementById('aiFindBtn');
  var descInput = document.getElementById('aiDescInput');
  var slider = document.getElementById('aiUnitCount');

  var description = descInput ? descInput.value.trim() : '';
  var unitCount = slider ? Number(slider.value) : 4;
  var activeIntel = document.querySelector('#aiIntelBtns .ai-diff-btn.active');
  var activeStrength = document.querySelector('#aiStrengthBtns .ai-diff-btn.active');
  var intelligence = activeIntel ? activeIntel.dataset.intel : 'hard';
  var strength = activeStrength ? activeStrength.dataset.strength : 'hard';
  // 读取属性倍率（默认1.00，即不变）
  var multSlider = document.getElementById('aiStatMultiplier');
  var statMultiplier = multSlider ? parseFloat(multSlider.value) || 1.00 : 1.00;

  // 清理上一次的临时单位
  if (AI_BATTLE_STATE.currentOpponent) {
    clearAIOpponentUnits([]);
  }

  // UI 状态：生成中
  if (findBtn) {
    findBtn.disabled = true;
    findBtn.textContent = '⏳ 正在跨次元搜寻...';
  }

  // 追加取消按钮到操作区
  var actions = document.querySelector('.ai-battle-actions');
  if (actions && !document.getElementById('aiCancelBtn')) {
    var cancelBtn = document.createElement('button');
    cancelBtn.id = 'aiCancelBtn';
    cancelBtn.textContent = '⏹ 终止匹配';
    cancelBtn.className = 'ai-btn';
    cancelBtn.style.cssText = 'background:#c0392b;color:#fff;border-color:#a93226;margin-left:8px;cursor:pointer;';
    cancelBtn.addEventListener('click', cancelAIFind);
    actions.appendChild(cancelBtn);
  }

  var info = document.getElementById('aiBattleInfo');
  if (info) {
    info.innerHTML = '<div class="ai-generating"><div class="ai-generating-spinner"></div><div class="ai-generating-text">系统正在匹配次元对手...</div><div class="ai-generating-hint">正在根据描述匹配世界观并生成敌军阵容</div></div>';
  }

  // 创建可中断的 fetch
  if (window._aiFindController) {
    window._aiFindController.abort();
  }
  window._aiFindController = new AbortController();

  var fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: description,
      unitCount: unitCount,
      intelligence: intelligence,
      strength: strength
    }),
    signal: window._aiFindController.signal
  };

  // 调用服务端 AI 生成接口
  fetch('/api/ai-battle-generate', fetchOptions)
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.ok) {
      throw new Error(data.error || '生成失败');
    }

    var opponent = convertAIGeneratedOpponent(data);

    // 应用属性倍率
    if (statMultiplier > 1.00) {
      applyAIBattleMultiplier(opponent, statMultiplier);
    }

    AI_BATTLE_STATE.currentOpponent = opponent;
    AI_BATTLE_STATE.pendingBattle = true;
    injectAIOpponentUnits(opponent);
    refreshAIOpponentDisplay();

    showMatchNotification(data);

    if (typeof showToast === 'function') {
      showToast('匹配成功：' + data.factionName, 'success');
    }
  })
  .catch(function(err) {
    // 用户主动取消
    if (err.name === 'AbortError') {
      if (info) {
        info.innerHTML = '<div class="ai-empty-hint">匹配已取消，可重新设置条件后再次搜寻</div>';
      }
      return;
    }
    if (info) {
      info.innerHTML = '<div class="ai-empty-hint" style="color:#c0392b">搜寻失败：' + escapeHtml(err.message) + '</div>';
    }
    if (typeof showToast === 'function') {
      showToast('生成失败：' + err.message, 'error');
    }
  })
  .finally(function() {
    if (findBtn) {
      findBtn.disabled = false;
      findBtn.textContent = '🔍 跨次元搜寻';
    }
    // 移除取消按钮
    var cancelBtn = document.getElementById('aiCancelBtn');
    if (cancelBtn) cancelBtn.remove();
    window._aiFindController = null;
  });
}

function cancelAIFind() {
  if (window._aiFindController) {
    window._aiFindController.abort();
  }
}

// ===== 将 AI 生成的 JSON 转成游戏内 unitDef 格式 =====
function convertAIGeneratedOpponent(data) {
  var intelMap = { easy: 'easy', hard: 'hard', legend: 'legend' };
  var intelligence = intelMap[data.intelligence] || 'hard';
  var strength = data.strength || 'hard';
  var units = [];
  var rawUnits = data.units || [];
  var count = rawUnits.length;

  // 按强度为每个单位分配独立品阶
  var tierList = [];
  if (count > 0) {
    if (strength === 'easy') {
      var ironCount = Math.max(2, Math.ceil(count * 0.7));
      var bronzeCountE = count - ironCount;
      for (var e = 0; e < count; e++) {
        tierList.push(e < ironCount ? 'iron' : 'bronze');
      }
    } else if (strength === 'hard') {
      var goldCount = Math.min(Math.ceil(count * 0.3), 4);
      var bronzeCountH = Math.max(1, Math.ceil(count * 0.3));
      var ironCountH = count - goldCount - bronzeCountH;
      if (ironCountH < 0) { bronzeCountH += ironCountH; ironCountH = 0; }
      for (var h = 0; h < count; h++) {
        if (h < goldCount) tierList.push('gold');
        else if (h < goldCount + bronzeCountH) tierList.push('bronze');
        else tierList.push('iron');
      }
    } else if (strength === 'legend') {
      var diamondCount = Math.min(Math.ceil(count * 0.3), 4);
      var goldCountL = Math.min(Math.ceil(count * 0.4), 5);
      var rest = count - diamondCount - goldCountL;
      if (rest < 0) { goldCountL += rest; rest = 0; }
      for (var l = 0; l < count; l++) {
        if (l < diamondCount) tierList.push('diamond');
        else if (l < diamondCount + goldCountL) tierList.push('gold');
        else tierList.push('bronze');
      }
    } else {
      for (var d = 0; d < count; d++) tierList.push('bronze');
    }
    // 打乱顺序，让品阶分布更自然
    for (var s = tierList.length - 1; s > 0; s--) {
      var r = Math.floor(Math.random() * (s + 1));
      var t = tierList[s];
      tierList[s] = tierList[r];
      tierList[r] = t;
    }
  }

  rawUnits.forEach(function(u, idx) {
    var unitTier = tierList[idx] || 'bronze';
    var tierLevel = 1;
    if (unitTier === 'bronze') tierLevel = 2;
    else if (unitTier === 'gold') tierLevel = 3;
    else if (unitTier === 'diamond') tierLevel = 4;

    var baseType = 'infantry';
    var aiType = (u['类型'] || '步兵').toLowerCase();
    if (aiType.indexOf('骑') >= 0) baseType = 'cavalry';
    else if (aiType.indexOf('空') >= 0 || aiType.indexOf('飞') >= 0) baseType = 'flying';
    else if (aiType.indexOf('远') >= 0 || aiType.indexOf('弓') >= 0 || aiType.indexOf('射') >= 0) baseType = 'archer';

    var armorType = u['护甲类型'] || '中甲';

    // ===== [核心重构] 为AI兵种创建独立且唯一的种族定义 =====
    var raceId = 'airace_' + Date.now() + '_' + idx;

    // 根据兵种类型设定基础士气
    var baseMorale = 60; // 步兵基准
    if (baseType === 'cavalry') baseMorale = 55;  // 骑兵稍低（冲得快死得快）
    else if (baseType === 'archer') baseMorale = 50; // 远程最低
    else if (baseType === 'flying') baseMorale = 58; // 空军中等

    // 品阶修正：钻石+18 黄金+12 青铜+6 黑铁±0
    if (unitTier === 'diamond') baseMorale += 18;
    else if (unitTier === 'gold') baseMorale += 12;
    else if (unitTier === 'bronze') baseMorale += 6;

    // ±5的随机波动，使士气不千篇一律
    baseMorale += Math.floor(Math.random() * 11) - 5; // -5 ~ +5

    var aiRaceDef = {
      id: raceId,
      name: u['种族'] || (data.factionName ? data.factionName + '族' : '异族'),
      scale: 1,
      baseHP: 100,
      naturalArmor: 3,
      naturalWeapon: 5,
      baseMorale: baseMorale,
      baseMovement: 1,
      attackRange: 1,
      _aiTemp: true
    };
    
    if (typeof RD !== 'undefined' && RD.races) {
      RD.races.push(aiRaceDef);
    }

    // ===== [核心重构] 根据 LLM 数值动态创建专属装备 =====
    var equipment = { mainWeapon: null, shield: null, armor: null, mount: null };
    var equipTierStr = unitTier;
    
    // 1. 动态武器生成（带品阶区间校验）
    var tierDamageRange = { 1: [11, 15], 2: [16, 21], 3: [22, 28], 4: [28, 36] };
    var tierAPRange = { 1: [1, 4], 2: [2, 7], 3: [4, 11], 4: [6, 15] };
    var tierArmorRange = { 1: [6, 13], 2: [9, 16], 3: [12, 20], 4: [15, 25] };

    var wpnName = u['主武器名字'] || (unitTier + '阶武器');
    var wpnType = u['主武器类型'] || (baseType === 'archer' ? 'bow' : 'short');
    var rawWpnDmg = parseInt(u['主武器伤害']);
    var dmgRange = tierDamageRange[tierLevel] || [10, 15];
    var wpnDmg;
    if (!isNaN(rawWpnDmg) && rawWpnDmg >= dmgRange[0] && rawWpnDmg <= dmgRange[1]) {
      wpnDmg = rawWpnDmg; // LLM给的数值在区间内，信任它
    } else {
      wpnDmg = Math.floor(dmgRange[0] + Math.random() * (dmgRange[1] - dmgRange[0] + 1)); // 越界了，随机生成
    }

    var rawWpnAP = parseInt(u['主武器破甲']);
    var apRange = tierAPRange[tierLevel] || [1, 4];
    var wpnAP;
    if (!isNaN(rawWpnAP) && rawWpnAP >= apRange[0] && rawWpnAP <= apRange[1]) {
      wpnAP = rawWpnAP;
    } else {
      wpnAP = Math.floor(apRange[0] + Math.random() * (apRange[1] - apRange[0] + 1));
    }
    var wpnId = 'AIW_' + Date.now() + '_' + idx;
    
    var wpnDescTemplates = {
      1: [wpnName + '，刃口霜纹密布', wpnName + '，锻打百次仍留锤痕', wpnName + '，裹着油布防锈的旧兵刃', wpnName + '，粗铁锻成的战场消耗品'],
      2: [wpnName + '，淬火时溅起蓝色火星', wpnName + '，铁匠铺第三代传人的手艺', wpnName + '，护手处刻着军团番号', wpnName + '，精钢打制，重心稳如秤砣'],
      3: [wpnName + '，第一任主人战死后方得此名', wpnName + '，鞘中鸣响时便是血战将至', wpnName + '，矮人炉火中重铸过三次', wpnName + '，饰纹中藏着一个远古符文'],
      4: [wpnName + '，据说能斩断流动的时光', wpnName + '，龙息淬刃，凡人不敢直视其锋', wpnName + '，历代持有者皆非寻常之辈', wpnName + '，挥舞时天地间响起远古战歌']
    };
    var descPool = wpnDescTemplates[tierLevel] || wpnDescTemplates[1];
    var wpnDesc = descPool[Math.floor(Math.random() * descPool.length)];

    var aiWpnForUnits;
    if (wpnType === 'bow' || wpnType === 'crossbow') {
      aiWpnForUnits = ['远程兵', '空军'];
    } else {
      aiWpnForUnits = baseType === 'flying' ? ['空军', '远程兵'] : ['步兵', '骑兵', '空军'];
    }
    var wpnEffects = [];
    if ((baseType === 'cavalry' || baseType === 'flying') && (wpnType === 'bow' || wpnType === 'crossbow')) {
      wpnEffects.push('骑射');
    }
    var mwDef = {
      id: wpnId, name: wpnName, tier: equipTierStr, category: 'AI兵器', type: wpnType,
      handed: (wpnType === 'long' || wpnType === 'bow') ? 'two-handed' : 'one-handed',
      baseDamage: wpnDmg, armorPierce: wpnAP, allowedRange: (wpnType === 'bow' || wpnType === 'crossbow' ? 3 : 1),
      forUnits: aiWpnForUnits,
      attackRange: 1,
      effects: wpnEffects.length > 0 ? wpnEffects : undefined,
      _aiTemp: true, desc: wpnDesc
    };
    if (typeof ED !== 'undefined') ED.weapons.push(mwDef);
    equipment.mainWeapon = wpnId;

    // 2. 动态护甲生成（带品阶区间校验）
    var armName = u['护甲名字'] || (unitTier + '阶护甲');
    var rawArmDef = parseInt(u['护甲防御']);
    var armCat = tierArmorRange[tierLevel] || [6, 13];
    var armDefVal;
    if (!isNaN(rawArmDef) && rawArmDef >= armCat[0] && rawArmDef <= armCat[1]) {
      armDefVal = rawArmDef;
    } else {
      armDefVal = Math.floor(armCat[0] + Math.random() * (armCat[1] - armCat[0] + 1));
    }
    var armCategory = u['护甲类型'] || '中甲';
    var armPenalty = (armCategory === '重甲') ? -1 : (armCategory === '中甲' && tierLevel >= 3 ? -1 : 0);
    var armId = 'AIA_' + Date.now() + '_' + idx;
    var armDescTemplates = {
      1: [armName + '，铆钉松动的老旧甲片', armName + '，硝烟熏成灰褐色的胸甲', armName + '，补丁叠补丁的战场旧物', armName + '，勉强能挡流矢的薄铁'],
      2: [armName + '，绸缎内衬吸饱了前主人的血', armName + '，接缝处用铜丝密密咬合', armName + '，新漆下隐约可见旧刀痕', armName + '，行军时发出沉稳的金属共振'],
      3: [armName + '，精灵纹路的藤蔓在甲面蔓生', armName + '，月光下泛起淡蓝色涟漪', armName + '，矮人的秘银嵌边微微发烫', armName + '，穿戴者听见过甲胄的低语'],
      4: [armName + '，巨龙鳞片制成的传说甲胄', armName + '，曾经的主人是一位半神', armName + '，被封印的灵魂在甲面游走', armName + '，古代神匠的最后一件遗作']
    };
    var armDescPool = armDescTemplates[tierLevel] || armDescTemplates[1];
    var armDesc = armDescPool[Math.floor(Math.random() * armDescPool.length)];

    var armDef = {
      id: armId, name: armName, tier: equipTierStr, category: armCategory,
      defense: armDefVal, mobilityPenalty: armPenalty, 
      _aiTemp: true, desc: armDesc
    };
    if (typeof ED !== 'undefined') ED.armors.push(armDef);
    equipment.armor = armId;

    // 3. 盾牌处理
    if (u['盾牌名字'] && u['盾牌名字'] !== '无') {
      var shId = 'AISH_' + Date.now() + '_' + idx;
      var shDescTemplates = [
        u['盾牌名字'] + '，纹章已被劈去半边',
        u['盾牌名字'] + '，敲响时嗡鸣如古钟',
        u['盾牌名字'] + '，盾面刻满了阵亡者的名字',
        u['盾牌名字'] + '，每当箭雨落下便微微发光'
      ];
      var shDesc = shDescTemplates[Math.floor(Math.random() * shDescTemplates.length)];
      var shDef = {
        id: shId, name: u['盾牌名字'], tier: equipTierStr, category: '盾牌',
        defense: Math.floor(tierLevel * 2), _aiTemp: true, effects: ['远程免伤+20%'],
        desc: shDesc
      };
      if (typeof ED !== 'undefined') ED.shields.push(shDef);
      equipment.shield = shId;
    }

    // 4. 坐骑处理
    var mountScale = 0;
    if (baseType === 'cavalry' || baseType === 'flying') {
      var mtName = u['坐骑名字'] && u['坐骑名字'] !== '无' ? u['坐骑名字'] : (baseType === 'flying' ? '飞翼' : '战马');
      var mtId = 'AIM_' + Date.now() + '_' + idx;
      mountScale = (baseType === 'flying' ? 3 : 2);
      var mtDescTemplates = [
        mtName + '，蹄声如雷，鬃毛似焰',
        mtName + '，夜行无声，眼瞳映着星辉',
        mtName + '，曾在古战场独自徘徊千年',
        mtName + '，周身环绕着淡紫色的灵光',
        mtName + '，踏过之处草木尽皆枯萎',
        mtName + '，只允许被它选中的人骑乘'
      ];
      var mtDesc = mtDescTemplates[Math.floor(Math.random() * mtDescTemplates.length)];
      var mtDef = {
        id: mtId, name: mtName, tier: equipTierStr, 
        scale: mountScale,
        bonusHP: (tierLevel * 100), bonusArmor: (tierLevel * 2), bonusMove: (baseType === 'flying' ? 4 : 3),
        _aiTemp: true,
        desc: mtDesc
      };
      if (typeof ED !== 'undefined') ED.mounts.push(mtDef);
      equipment.mount = mtId;
    }

    // ===== [核心修复] 根据总规模(160)动态计算人数 =====
    var totalScalePerUnit = 1 + mountScale; // 基础人型规模1 + 坐骑规模
    var unitCount = Math.max(1, Math.floor(160 / totalScalePerUnit));
    
    // 特殊微调：如果是远程，人数再削减 20% 以平衡火力
    if (baseType === 'archer') unitCount = Math.floor(unitCount * 0.8);

    var typeCfg = AI_BASE_TYPE_CONFIG[baseType] || AI_BASE_TYPE_CONFIG.infantry;
    var unitId = 'aiu_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6);
    var uniqueType = genAIUnitType();
    var imgPath = typeof getUnitImagePath === 'function'
      ? getUnitImagePath(unitTier, baseType)
      : 'assets/images/icon_' + unitTier + '_' + typeCfg.iconSuffix + '.png';

    units.push({
      id: unitId,
      tier: unitTier,
      name: u['名字'] || ('敌方兵团·' + (idx + 1)),
      race: { id: raceId, name: aiRaceDef.name },
      background: u['背景'] || '来自异次元的神秘军团',
      belief: u['信念'] || '为胜利而战',
      type: uniqueType,
      baseType: baseType,
      typeName: typeCfg.typeName,
      image: imgPath,
      icon: getBaseTypeIcon(baseType),
      unitCount: unitCount,
      equipment: equipment,
      _summoned: true,
      _aiBattleTemp: true,
      _summonTier: unitTier === 'diamond' ? 4 : tierToSummonTier(unitTier),
      _mountedArcher: (baseType === 'cavalry' && (wpnType === 'bow' || wpnType === 'crossbow')) || undefined,
      _rangedFlying: (baseType === 'flying' && (wpnType === 'bow' || wpnType === 'crossbow')) || undefined,
      powerIndex: 0
    });
  });

  units.forEach(function(u) {
    if (typeof computeStats === 'function') {
      var st = computeStats(u);
      if (st && typeof calculatePowerIndex === 'function') {
        st.unitCount = u.unitCount;
        st.unitScale = st.unitScale || 1;
        u.powerIndex = calculatePowerIndex(st);
      }
    }
  });

  // ===== 战力校准（与召唤引擎同步，确保AI单位战力和召唤兵种在同一水平）=====
  var POWER_TARGETS = { 1: [5, 20], 2: [20, 45], 3: [45, 80], 4: [80, 130] };
  units.forEach(function(u) {
    var tierNum = u._summonTier || 2;
    if (typeof POWER_TARGETS !== 'undefined' && !POWER_TARGETS[tierNum]) tierNum = tierToSummonTier(u.tier) || 2;
    var targets = POWER_TARGETS[tierNum] || [20, 45];
    var targetMin = targets[0], targetMax = targets[1];
    var power = u.powerIndex || 0;

    if (power < targetMin && power > 0) {
      var ratio = targetMin / power;
      var boost = Math.min(ratio, 3.0);
      // 提升武器伤害
      var eq = u.equipment || {};
      var wDef = eq.mainWeapon ? (typeof findWeapon === 'function' ? findWeapon(eq.mainWeapon) : null) : null;
      if (wDef) {
        wDef.baseDamage = Math.round(wDef.baseDamage * boost);
      } else {
        // 无武器（野兽），提升种族天然武器
        var rDef = u.race ? (typeof getRace === 'function' ? getRace(u.race.id) : null) : null;
        if (rDef) rDef.naturalWeapon = Math.round((rDef.naturalWeapon || 5) * boost);
      }
      // 提升种族血量
      var rDef2 = u.race ? (typeof getRace === 'function' ? getRace(u.race.id) : null) : null;
      if (rDef2) rDef2.baseHP = Math.round((rDef2.baseHP || 100) * boost);
      // 重新计算
      var st2 = computeStats(u);
      if (st2) { st2.unitCount = u.unitCount; st2.unitScale = st2.unitScale || 1; }
      power = calculatePowerIndex(st2);
      u.powerIndex = power;
    }
    if (power > targetMax && power > 0) {
      var cutRatio = targetMax / power;
      var eq2 = u.equipment || {};
      var wDef2 = eq2.mainWeapon ? (typeof findWeapon === 'function' ? findWeapon(eq2.mainWeapon) : null) : null;
      if (wDef2) {
        wDef2.baseDamage = Math.max(1, Math.round(wDef2.baseDamage * cutRatio));
      } else {
        var rDef3 = u.race ? (typeof getRace === 'function' ? getRace(u.race.id) : null) : null;
        if (rDef3) rDef3.naturalWeapon = Math.max(1, Math.round((rDef3.naturalWeapon || 5) * cutRatio));
      }
      var rDef4 = u.race ? (typeof getRace === 'function' ? getRace(u.race.id) : null) : null;
      if (rDef4) rDef4.baseHP = Math.max(1, Math.round((rDef4.baseHP || 100) * cutRatio));
      var st3 = computeStats(u);
      if (st3) { st3.unitCount = u.unitCount; st3.unitScale = st3.unitScale || 1; }
      power = calculatePowerIndex(st3);
      u.powerIndex = power;
    }
  });

  var tierOrder = { iron: 0, bronze: 1, gold: 2, diamond: 3 };
  var globalTier = 'iron';
  units.forEach(function(u) {
    if (tierOrder[u.tier] > tierOrder[globalTier]) {
      globalTier = u.tier;
    }
  });

  return {
    name: data.factionName || '未知军团',
    tier: globalTier,
    intelligence: intelligence,
    strength: strength,
    worldOrigin: data.worldOrigin || '',
    units: units
  };
}

// 根据 AI 指定的武器类型从游戏装备库中匹配
function pickWeaponByAIType(tier, aiType, baseType) {
  if (!ED || !ED.weapons) return pickWeaponByTierAndType(tier, ['short', 'long', 'bow', 'crossbow'], baseType);
  var typeMap = { infantry:'步兵', cavalry:'骑兵', archer:'远程兵', flying:'空军' };
  function _compatCheck(w) {
    if (w._unique) return false;
    if (!w.forUnits) return true;
    if (w.forUnits.indexOf('全兵种') >= 0) return true;
    var cn = typeMap[baseType];
    if (cn && w.forUnits.indexOf(cn) >= 0) return true;
    if (baseType === 'infantry' && (w.forUnits.indexOf('步兵') >= 0 || w.forUnits.indexOf('重步兵') >= 0 || w.forUnits.indexOf('轻步兵') >= 0)) return true;
    if (baseType === 'cavalry' && (w.forUnits.indexOf('骑兵') >= 0 || w.forUnits.indexOf('重骑兵') >= 0 || w.forUnits.indexOf('轻骑兵') >= 0)) return true;
    if (baseType === 'archer' && w.forUnits.indexOf('远程兵') >= 0) return true;
    if (baseType === 'flying' && (w.forUnits.indexOf('空军') >= 0 || w.forUnits.indexOf('远程兵') >= 0)) return true;
    return false;
  }
  var pool = ED.weapons.filter(function(w) {
    if (w.tier !== tier) return false;
    if (aiType === 'short' && w.type !== 'short') return false;
    if (aiType === 'long' && w.type !== 'long') return false;
    if (aiType === 'bow' && w.type !== 'bow') return false;
    if (aiType === 'crossbow' && w.type !== 'crossbow') return false;
    return _compatCheck(w);
  });
  if (pool.length === 0 && tier !== 'iron') {
    pool = ED.weapons.filter(function(w) {
      if (w.tier !== 'iron') return false;
      if (aiType === 'short' && w.type !== 'short') return false;
      if (aiType === 'long' && w.type !== 'long') return false;
      if (aiType === 'bow' && w.type !== 'bow') return false;
      if (aiType === 'crossbow' && w.type !== 'crossbow') return false;
      return _compatCheck(w);
    });
  }
  if (pool.length === 0) return pickWeaponByTierAndType(tier, ['short', 'long', 'bow', 'crossbow'], baseType);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function pickArmorByAIType(tier, aiType) {
  if (!ED || !ED.armors) return pickEquipFromED('armors', tier, null);
  var pool = ED.armors.filter(function(a) {
    if (a.tier !== tier) return false;
    var armorCat = a.category || a.type || '';
    if (aiType === '轻甲' && armorCat.indexOf('轻甲') < 0) return false;
    if (aiType === '中甲' && armorCat.indexOf('中甲') < 0) return false;
    if (aiType === '重甲' && armorCat.indexOf('重甲') < 0) return false;
    return true;
  });
  if (pool.length === 0 && tier !== 'iron') {
    pool = ED.armors.filter(function(a) { return a.tier === 'iron'; });
  }
  if (pool.length === 0) return pickEquipFromED('armors', tier, null);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

// ===== 匹配成功通知弹窗 =====
function showMatchNotification(data) {
  var factionName = data.factionName || '未知势力';

  var modal = document.createElement('div');
  modal.id = 'matchNotification';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;' +
    'display:flex;align-items:center;justify-content:center;background:rgba(20,15,10,0.7);backdrop-filter:blur(4px);';

  modal.innerHTML =
    '<div class="match-notif-card">' +
      '<div class="match-notif-glow"></div>' +
      '<div class="match-notif-badge">次元裂缝已开启</div>' +
      '<div class="match-notif-faction" style="font-size:28px;padding:12px 0;">「' + escapeHtml(factionName) + '」</div>' +
      '<div class="match-notif-hint">点击任意位置或等待片刻进入战场...</div>' +
    '</div>';

  document.body.appendChild(modal);

  // 点击任意位置提前关闭
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      if (window.gsap) {
        gsap.to(modal, { opacity: 0, duration: 0.2, onComplete: function() { modal.remove(); if (typeof autoStartBattle === 'function') autoStartBattle(); } });
      } else {
        modal.remove();
        if (typeof autoStartBattle === 'function') autoStartBattle();
      }
    }
  });

  // 动画
  if (window.gsap) {
    gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo('.match-notif-card', { opacity: 0, scale: 0.8, y: 30 }, {
      opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.5)', delay: 0.1
    });
    gsap.fromTo('.match-notif-badge', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3, delay: 0.3 });
    gsap.fromTo('.match-notif-faction', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4, delay: 0.45 });
  }

  // 4秒后自动关闭并直接进入战斗（给玩家足够时间看清信息）
  setTimeout(function() {
    if (window.gsap) {
      gsap.to(modal, { opacity: 0, duration: 0.3, onComplete: function() { modal.remove(); } });
    } else {
      modal.remove();
    }
    // 自动进入部队选择并开始战斗
    if (typeof autoStartBattle === 'function') autoStartBattle();
  }, 4000);
}

// ===== 自动进入战斗 =====
function autoStartBattle() {
  var opp = AI_BATTLE_STATE.currentOpponent;
  if (!opp || !opp.units || opp.units.length === 0) {
    if (typeof showToast === 'function') showToast('对手数据异常', 'error');
    return;
  }
  if (!GameState.playerUnits || GameState.playerUnits.length === 0) {
    if (typeof showToast === 'function') showToast('你没有可用部队，请先召唤或购买兵团', 'error');
    return;
  }

  window._aiBattleOpponent = opp;
  // 智慧映射（控制AI行为）
  var diffMap = { easy: 'easy', hard: 'hard', legend: 'legend' };
  window.selectedDifficulty = diffMap[opp.intelligence] || 'hard';

  // 直接进入部队选择页
  showPage('Select');
}

// ===== 刷新对手信息展示 =====
function refreshAIOpponentDisplay() {
  var info = document.getElementById('aiBattleInfo');
  var startBtn = document.getElementById('aiBattleStartBtn');
  if (!info) return;
  var opp = AI_BATTLE_STATE.currentOpponent;
  if (!opp) {
    info.innerHTML = '<div class="ai-empty-hint">尚未寻找对手，点击「寻找对手」生成一位AI对手</div>';
    if (startBtn) startBtn.disabled = true;
    return;
  }

  var tierInfo = AI_TIER_DIFFICULTY[opp.tier] || AI_TIER_DIFFICULTY.iron;
  var intelLabels = { easy: '简单', hard: '困难', legend: '传说' };
  var strLabels = { easy: '黑铁', hard: '青铜', legend: '黄金' };
  var html = '';
  html += '<div class="ai-opponent-card" style="border-color:' + tierInfo.color + '">';
  html +=   '<div class="ai-opponent-head">';
  html +=     '<div class="ai-opponent-name">👹 ' + escapeHtml(opp.name) + '</div>';
  html +=     '<div class="ai-opponent-tier" style="background:' + tierInfo.color + ';color:#fff">' + tierInfo.label + '品阶</div>';
  html +=     '<div class="ai-opponent-meta">指挥官：' + (intelLabels[opp.intelligence] || '困难') + ' · 部队：' + (strLabels[opp.strength] || '青铜') + ' · 兵团数：' + opp.units.length + ' · 胜利积分 +' + tierInfo.reward + '</div>';
  html +=   '</div>';
  html +=   '<div class="ai-opponent-units">';

  opp.units.forEach(function(u, idx) {
    var st = (typeof computeStats === 'function') ? computeStats(u) : null;
    var mw = st ? st.mainWeapon : null;
    var ar = st ? st.armor : null;
    var mt = st ? st.mount : null;
    var sh = st ? st.shield : null;
    html += '<div class="ai-unit-card">';
    html +=   '<div class="aiu-img-wrap"><img class="aiu-img" src="' + u.image + '" alt="" onerror="this.style.display=\'none\'"><span class="aiu-tier" style="background:' + tierInfo.color + '">' + tierInfo.label + '</span></div>';
    html +=   '<div class="aiu-body">';
    html +=     '<div class="aiu-name">' + u.icon + ' ' + escapeHtml(u.name) + '</div>';
    html +=     '<div class="aiu-type">' + u.typeName + ' · 🧬 ' + (u.race ? u.race.name : '?') + '</div>';
    if (st) {
      html +=   '<div class="aiu-stats">';
      html +=     '<span>❤ ' + st.totalHP + '</span>';
      html +=     '<span>🛡 ' + st.totalArmor + '</span>';
      html +=     '<span>⚔ ' + (mw ? mw.baseDamage : (st.race ? st.race.naturalWeapon : 0)) + '</span>';
      html +=     '<span>👟 ' + st.movement + '</span>';
      html +=     '<span>📏 ' + st.allowedRange + '格</span>';
      html +=   '</div>';
    }
    html +=     '<div class="aiu-eq">';
    html +=       '⚔' + (mw ? escapeHtml(mw.name) : '天然') + ' ';
    if (sh) html += '🛡' + escapeHtml(sh.name) + ' ';
    html +=       '🥋' + (ar ? escapeHtml(ar.name) : '天然护甲');
    if (mt) html += ' 🐴' + escapeHtml(mt.name);
    html +=     '</div>';
    html +=   '</div>';
    html += '</div>';
  });

  html +=   '</div>';
  html += '</div>';

  info.innerHTML = html;
  if (startBtn) startBtn.disabled = false;
}

// ===== 开始对战按钮处理 =====
function onStartAIBattle() {
  var opp = AI_BATTLE_STATE.currentOpponent;
  if (!opp || !opp.units || opp.units.length === 0) {
    if (typeof showToast === 'function') showToast('请先寻找对手', 'warning');
    return;
  }
  // 玩家至少需要有1支部队
  if (!GameState.playerUnits || GameState.playerUnits.length === 0) {
    if (typeof showToast === 'function') showToast('你没有可用部队，请先召唤或购买兵团', 'error');
    return;
  }
  // 设置AI对战待开战标记，confirmBattle 会读取此标记
  window._aiBattleOpponent = opp;
  // 设置智慧（控制AI行为）
  var diffMap = { easy: 'easy', hard: 'hard', legend: 'legend' };
  window.selectedDifficulty = diffMap[opp.intelligence] || 'hard';
  // 进入部队选择页
  showPage('Select');
}

// ===== AI对战胜利结算：显示兵种选择界面 =====
// 由 settlement-system.js 在 triggerBattleEnd 中调用
function showAIBattleSettlement(result, pointsDelta, report, droppedItems) {
  var opp = AI_BATTLE_STATE.currentOpponent;
  if (!opp) {
    // 无对手信息，回退普通结算
    return false;
  }
  droppedItems = droppedItems || [];

  // 移除已有弹窗
  var existing = document.getElementById('settlementModal');
  if (existing) existing.remove();

  var isPlayerWin = result.winner === 'player';
  var modal = document.createElement('div');
  modal.id = 'settlementModal';
  modal.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:rgba(20,15,10,0.88);display:flex;' +
    'align-items:center;justify-content:center;z-index:1000;' +
    'overflow-y:auto;padding:20px 0;';

  var tierInfo = AI_TIER_DIFFICULTY[opp.tier] || AI_TIER_DIFFICULTY.iron;
  var intelLabels = { easy: '简单', hard: '困难', legend: '传说' };
  var title = isPlayerWin ? '🏆 胜利' : '💀 失败';
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
  html += '<div style="font-size:12px;color:#8a6d4b;margin-bottom:8px">对手：' + escapeHtml(opp.name) + ' · ' + tierInfo.label + '品阶 · 指挥官：' + (intelLabels[opp.intelligence] || '困难') + ' · ' + result.reason + '</div>';

  // 积分奖励
  if (isPlayerWin && pointsDelta > 0) {
    html += '<div class="ai-settlement-reward" style="background:linear-gradient(135deg,rgba(212,131,10,0.15),rgba(212,131,10,0.08));border:2px solid #d4a017;border-radius:10px;padding:10px 14px;margin-bottom:14px">';
    html +=   '<div style="font-size:12px;color:#8a6d4b">🎁 战斗胜利奖励</div>';
    html +=   '<div style="font-size:22px;color:#d4a017;font-weight:bold">+ ' + pointsDelta + ' 积分</div>';
    html +=   '<div style="font-size:11px;color:#6b4c2a">当前总积分：<b>' + GameState.points + '</b></div>';
    html += '</div>';
  }

  // 战损统计
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;text-align:left">';
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
      var tierName = (typeof getTierName === 'function') ? getTierName(item.tier) : '';
      var tierColor = (typeof getTierColor === 'function') ? getTierColor(item.tier) : '#4a4a4a';
      var typeLabel = (typeof inferEquipmentTypeLabel === 'function') ? inferEquipmentTypeLabel(item) : '装备';

      html += '<div class="ai-settlement-drop" style="background:#fff;border:2px solid ' + tierColor + ';border-radius:8px;padding:8px;text-align:left;position:relative;">';
      html +=   '<div style="font-size:13px;color:' + tierColor + ';font-weight:bold;margin-bottom:2px">' + escapeHtml(item.name) + '</div>';
      html +=   '<div style="font-size:11px;color:#6b4c2a;margin-bottom:2px">' + typeLabel + ' · ' + tierName + '品阶</div>';
      html += '</div>';
    });

    html +=   '</div>';
    html += '</div>';
  } else if (isPlayerWin && droppedItems.length === 0) {
    html += '<div style="background:rgba(0,0,0,0.04);border:1px solid #c4b290;border-radius:10px;padding:14px;margin-bottom:14px">';
    html +=   '<div style="font-size:13px;color:#8a6d4b">本场敌方无装备掉落</div>';
    html += '</div>';
  }

  // 兵种选择（仅胜利时）
  if (isPlayerWin && opp.units.length > 0) {
    html += '<div style="background:rgba(0,0,0,0.04);border:1px solid #c4b290;border-radius:10px;padding:14px;margin-bottom:14px">';
    html +=   '<div style="font-size:14px;color:#3d1a00;font-weight:bold;margin-bottom:4px;letter-spacing:2px">⚔ 缴获兵种</div>';
    html +=   '<div style="font-size:11px;color:#8a6d4b;margin-bottom:10px">选择 1 支对方兵种加入你的部队，或跳过</div>';
    html +=   '<div class="ai-reward-grid" id="aiRewardGrid">';

    opp.units.forEach(function(u, idx) {
      var st = (typeof computeStats === 'function') ? computeStats(u) : null;
      var unitTierInfo = AI_TIER_DIFFICULTY[u.tier] || AI_TIER_DIFFICULTY.iron;
      html += '<div class="ai-reward-card" data-idx="' + idx + '" onclick="showAIUnitDetail(' + idx + ')" style="border-color:' + unitTierInfo.color + '">';
      html +=   '<div class="air-img-wrap"><img class="air-img" src="' + u.image + '" alt="" onerror="this.style.display=\'none\'"><span class="air-tier" style="background:' + unitTierInfo.color + '">' + unitTierInfo.label + '</span></div>';
      html +=   '<div class="air-name">' + u.icon + ' ' + escapeHtml(u.name) + '</div>';
      html +=   '<div class="air-type">' + u.typeName + ' · 🧬 ' + (u.race ? u.race.name : '?') + '</div>';
      if (st) {
        html += '<div class="air-stats">';
        html +=   '<span>❤' + st.totalHP + '</span>';
        html +=   '<span>🛡' + st.totalArmor + '</span>';
        html +=   '<span>⚔' + (st.mainWeapon ? st.mainWeapon.baseDamage : (st.race ? st.race.naturalWeapon : 0)) + '</span>';
        html += '</div>';
        // 显示装备名以便区分兵种
        var weaponName = st.mainWeapon ? st.mainWeapon.name : '天然武器';
        var armorName = st.armor ? st.armor.name : '天然护甲';
        html += '<div class="air-equip" style="font-size:10px;color:#8a6d4b;margin-top:2px;padding:0 6px;">';
        html +=   '<span>🗡 ' + escapeHtml(weaponName) + '</span>';
        html +=   '<span style="margin-left:6px">🛡 ' + escapeHtml(armorName) + '</span>';
        html += '</div>';
      }
      html +=   '<div class="air-claim-btn" onclick="event.stopPropagation();claimAIBattleUnit(' + idx + ')">选择此兵种</div>';
      html +=   '<div class="air-detail-link" onclick="event.stopPropagation();showAIUnitDetail(' + idx + ')">📋 查看详情</div>';
      html += '</div>';
    });

    html +=   '</div>';
    html += '</div>';

    // 跳过按钮
    html += '<div style="display:flex;gap:10px;justify-content:center;margin-top:8px">';
    html +=   '<button onclick="skipAIBattleReward()" style="padding:10px 24px;font-size:14px;border:2px solid #b8a080;border-radius:8px;background:transparent;color:#5a3e20;cursor:pointer;font-family:SimSun,serif;letter-spacing:2px">⏭ 跳过，不要兵种</button>';
    html += '</div>';
  } else {
    // 失败：仅返回按钮
    html += '<div style="display:flex;gap:10px;justify-content:center;margin-top:8px">';
    html +=   '<button onclick="skipAIBattleReward()" style="padding:10px 24px;font-size:14px;border:2px solid #b8a080;border-radius:8px;background:linear-gradient(135deg,#f5ecd7 0%,#e8dcc0 100%);color:#3d1a00;cursor:pointer;font-family:SimSun,serif;letter-spacing:2px">📜 返回主页</button>';
    html += '</div>';
  }

  html += '</div>';
  modal.innerHTML = html;
  document.body.appendChild(modal);

  // AI对战结算弹窗入场动画（参考 summon modal 风格）
  if (window.gsap) {
    var modalContent = modal.firstElementChild;
    gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    if (modalContent) {
      gsap.fromTo(modalContent,
        { opacity: 0, scale: 0.85, rotationY: -10 },
        { opacity: 1, scale: 1, rotationY: 0, duration: 0.5, ease: 'back.out(1.4)' }
      );
    }
    // 缴获兵种卡片/掉落卡片交错入场（stagger 0.08s）
    setTimeout(function() {
      var cards = modal.querySelectorAll('.ai-settlement-drop, .ai-reward-card');
      if (cards.length) {
        gsap.fromTo(cards,
          { opacity: 0, y: 20, scale: 0.8 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(1.4)' }
        );
      }
    }, 200);
  }
  return true;
}

// ===== 查看兵种详情 =====
function showAIUnitDetail(idx) {
  var opp = AI_BATTLE_STATE.currentOpponent;
  if (!opp || !opp.units[idx]) {
    if (typeof showToast === 'function') showToast('无效的兵种', 'error');
    return;
  }
  var u = opp.units[idx];
  var st = (typeof computeStats === 'function') ? computeStats(u) : null;
  var tierInfo = AI_TIER_DIFFICULTY[u.tier] || AI_TIER_DIFFICULTY.iron;

  var existing = document.getElementById('aiUnitDetailModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'aiUnitDetailModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:1100;overflow-y:auto;padding:20px;';

  var html = '';
  html += '<div style="background:linear-gradient(135deg,#f5ecd7 0%,#e8dcc0 100%);border:2px solid ' + tierInfo.color + ';border-radius:16px;padding:24px;max-width:520px;width:100%;text-align:left;box-shadow:0 0 40px rgba(0,0,0,0.5);position:relative;max-height:90vh;overflow-y:auto;">';

  // 关闭按钮
  html += '<div onclick="closeAIUnitDetail()" style="position:absolute;top:10px;right:14px;font-size:28px;color:#8a6d4b;cursor:pointer;line-height:1;font-family:serif;">&times;</div>';

  // 头部：图标、名称、品阶徽章
  html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding-right:30px;">';
  if (u.image) {
    html += '<img src="' + u.image + '" alt="" style="width:56px;height:56px;border-radius:8px;border:2px solid ' + tierInfo.color + ';object-fit:cover;background:#f0e8d8;" onerror="this.style.display=\'none\'">';
  }
  html += '<div style="flex:1">';
  html += '<div style="font-size:20px;font-weight:bold;color:#3d1a00;">' + u.icon + ' ' + escapeHtml(u.name) + '</div>';
  html += '<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">';
  html += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;color:#fff;background:' + tierInfo.color + ';">' + tierInfo.label + '</span>';
  html += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;background:#e8dcc0;color:#5a3e20;">' + u.typeName + '</span>';
  html += '</div></div></div>';

  // 全属性六宫格
  if (st) {
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:14px;background:rgba(0,0,0,0.03);border-radius:10px;padding:10px;border:1px solid #d4c4a8;">';
    html += '<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.5);border-radius:6px;"><div style="font-size:10px;color:#8a6d4b;">❤ HP</div><div style="font-size:14px;font-weight:bold;color:#8b2500;">' + st.totalHP + '</div></div>';
    html += '<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.5);border-radius:6px;"><div style="font-size:10px;color:#8a6d4b;">🛡 护甲</div><div style="font-size:14px;font-weight:bold;color:#4a6fa5;">' + st.totalArmor + '</div></div>';
    html += '<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.5);border-radius:6px;"><div style="font-size:10px;color:#8a6d4b;">⚔ 攻击</div><div style="font-size:14px;font-weight:bold;color:#8b4513;">' + st.mainBase + '</div></div>';
    html += '<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.5);border-radius:6px;"><div style="font-size:10px;color:#8a6d4b;">🎯 攻程/攻击范围</div><div style="font-size:14px;font-weight:bold;color:#2e5e2e;">' + st.allowedRange + '/' + st.attackRange + '</div></div>';
    html += '<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.5);border-radius:6px;"><div style="font-size:10px;color:#8a6d4b;">👣 移动</div><div style="font-size:14px;font-weight:bold;color:#4a6741;">' + st.movement + '</div></div>';
    html += '<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.5);border-radius:6px;"><div style="font-size:10px;color:#8a6d4b;">👥 人数</div><div style="font-size:14px;font-weight:bold;color:#3d1a00;">' + u.unitCount + '</div></div>';
    html += '<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.5);border-radius:6px;"><div style="font-size:10px;color:#8a6d4b;">⚡ 战力</div><div style="font-size:14px;font-weight:bold;color:#b8860b;">' + (u.powerIndex || '?') + '</div></div>';
    html += '<div style="text-align:center;padding:4px;background:rgba(255,255,255,0.5);border-radius:6px;"><div style="font-size:10px;color:#8a6d4b;">💪 士气</div><div style="font-size:14px;font-weight:bold;color:#6b3a8a;">' + st.morale + '</div></div>';
    html += '</div>';

    // 装备详情
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:bold;color:#3d1a00;margin-bottom:6px;border-bottom:1px solid #d4c4a8;padding-bottom:4px;">🛠 装备详情</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;color:#5a3e20;margin-bottom:4px;">';
    var mw = st.mainWeapon;
    html += '<div><span style="color:#8a6d4b;">武器：</span>' + (mw ? escapeHtml(mw.name) : '天然肉体') + '</div>';
    html += '<div>' + (mw ? '<span style="color:#8a6d4b;">伤害 ' + mw.baseDamage + ' · 破甲 ' + (mw.armorPierce || 0) + '</span>' : '') + '</div>';
    var ar = st.armor;
    html += '<div><span style="color:#8a6d4b;">护甲：</span>' + (ar ? escapeHtml(ar.name) : '天然护甲') + '</div>';
    html += '<div>' + (ar ? '<span style="color:#8a6d4b;">防御 ' + ar.defense + (ar.mobilityPenalty ? ' · 机动 ' + ar.mobilityPenalty : '') + '</span>' : '') + '</div>';
    var sh = st.shield;
    html += '<div><span style="color:#8a6d4b;">盾牌：</span>' + (sh ? escapeHtml(sh.name) : '无') + '</div>';
    html += '<div>' + (sh ? '<span style="color:#8a6d4b;">防御 ' + (sh.defense || 0) + (sh.effects ? ' · ' + sh.effects.join(', ') : '') + '</span>' : '') + '</div>';
    var mt = st.mount;
    html += '<div><span style="color:#8a6d4b;">坐骑：</span>' + (mt ? escapeHtml(mt.name) : '无') + '</div>';
    html += '<div>' + (mt ? '<span style="color:#8a6d4b;">HP+' + (mt.bonusHP || 0) + ' 护甲+' + (mt.bonusArmor || 0) + ' 移动+' + (mt.bonusMove || 0) + '</span>' : '') + '</div>';
    html += '</div></div>';
  }

  // 背景故事 & 信念
  html += '<div style="margin-bottom:14px;font-size:12px;color:#5a3e20;">';
  html += '<div style="margin-bottom:4px;"><span style="color:#8a6d4b;">📜 背景：</span>' + escapeHtml(u.background || '无') + '</div>';
  html += '<div><span style="color:#8a6d4b;">✨ 信念：</span>' + escapeHtml(u.belief || '无') + '</div>';
  html += '</div>';

  // 底部按钮
  html += '<div style="display:flex;gap:10px;justify-content:center;border-top:1px solid #d4c4a8;padding-top:12px;">';
  html += '<button onclick="claimAIBattleUnit(' + idx + ')" style="padding:10px 24px;font-size:14px;border:none;border-radius:8px;background:linear-gradient(135deg,#d4a017,#b8860b);color:#fff;cursor:pointer;font-weight:bold;letter-spacing:2px;font-family:SimSun,serif;">⚔ 选择此兵种</button>';
  html += '<button onclick="closeAIUnitDetail()" style="padding:10px 24px;font-size:14px;border:2px solid #b8a080;border-radius:8px;background:transparent;color:#5a3e20;cursor:pointer;font-family:SimSun,serif;">取消</button>';
  html += '</div>';

  html += '</div>';
  modal.innerHTML = html;
  document.body.appendChild(modal);

  // 兵种详情弹窗入场动画
  if (window.gsap) {
    var modalContent = modal.firstElementChild;
    gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    if (modalContent) {
      gsap.fromTo(modalContent,
        { opacity: 0, scale: 0.85, rotationY: -10 },
        { opacity: 1, scale: 1, rotationY: 0, duration: 0.5, ease: 'back.out(1.4)' }
      );
    }
  }
}

// ===== 领取兵种 =====
function claimAIBattleUnit(unitIdx) {
  // 关闭详情弹窗（带退场动画）
  closeAIUnitDetail();

  var opp = AI_BATTLE_STATE.currentOpponent;
  if (!opp || !opp.units[unitIdx]) {
    if (typeof showToast === 'function') showToast('无效的兵种选择', 'error');
    return;
  }
  var unitDef = opp.units[unitIdx];

  // 加入玩家部队列表（参考现有 playerUnits 数据结构）
  var newPlayerUnitId = 'aiwon_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  GameState.playerUnits.push({
    id: newPlayerUnitId,
    type: unitDef.type,
    name: unitDef.name
  });

  // 加入 _summonedData.units 以便持久化（加载时 injectSummonedData 会注入）
  if (!GameState._summonedData) GameState._summonedData = { races: [], weapons: [], shields: [], armors: [], mounts: [], units: [] };
  if (!GameState._summonedData.units) GameState._summonedData.units = [];
  // 移除临时标记，标记为已召唤（持久化）
  var persistUnit = JSON.parse(JSON.stringify(unitDef));
  delete persistUnit._aiBattleTemp;
  persistUnit._summoned = true;

  // ===== [核心修复] 持久化该单位的种族定义，并即时转换RD标记 =====
  if (persistUnit.race && persistUnit.race.id) {
    var rDef = typeof getRace === 'function' ? getRace(persistUnit.race.id) : null;
    if (rDef) {
      if (!GameState._summonedData.races) GameState._summonedData.races = [];
      if (!GameState._summonedData.races.find(function(x){ return x.id === rDef.id; })) {
        var pr = JSON.parse(JSON.stringify(rDef));
        delete pr._aiTemp; 
        pr._summoned = true;
        GameState._summonedData.races.push(pr);
      }
      // 关键：即时剥离RD中的_aiTemp标记，防止clearAIOpponentUnits误清
      delete rDef._aiTemp;
      rDef._summoned = true;
    }
  }

  // ===== [核心同步] 持久化该单位的动态生成装备，并即时转换ED标记 =====
  if (persistUnit.equipment) {
    var eq = persistUnit.equipment;
    if (eq.mainWeapon) {
      var wDef = ED.weapons.find(function(x){ return x.id === eq.mainWeapon; });
      if (wDef) {
        // 存一份到存档
        var pw = JSON.parse(JSON.stringify(wDef));
        delete pw._aiTemp; pw._summoned = true;
        if (!GameState._summonedData.weapons) GameState._summonedData.weapons = [];
        if (!GameState._summonedData.weapons.find(function(x){ return x.id === pw.id; })) {
          GameState._summonedData.weapons.push(pw);
        }
        // 关键：即时剥离ED中的_aiTemp标记，防止clearAIOpponentUnits误清
        delete wDef._aiTemp;
        wDef._summoned = true;
      }
    }
    if (eq.shield) {
      var sDef = ED.shields.find(function(x){ return x.id === eq.shield; });
      if (sDef) {
        var ps = JSON.parse(JSON.stringify(sDef));
        delete ps._aiTemp; ps._summoned = true;
        if (!GameState._summonedData.shields) GameState._summonedData.shields = [];
        if (!GameState._summonedData.shields.find(function(x){ return x.id === ps.id; })) {
          GameState._summonedData.shields.push(ps);
        }
        delete sDef._aiTemp;
        sDef._summoned = true;
      }
    }
    if (eq.armor) {
      var aDef = ED.armors.find(function(x){ return x.id === eq.armor; });
      if (aDef) {
        var pa = JSON.parse(JSON.stringify(aDef));
        delete pa._aiTemp; pa._summoned = true;
        if (!GameState._summonedData.armors) GameState._summonedData.armors = [];
        if (!GameState._summonedData.armors.find(function(x){ return x.id === pa.id; })) {
          GameState._summonedData.armors.push(pa);
        }
        delete aDef._aiTemp;
        aDef._summoned = true;
      }
    }
    if (eq.mount) {
      var mDef = ED.mounts.find(function(x){ return x.id === eq.mount; });
      if (mDef) {
        var pm = JSON.parse(JSON.stringify(mDef));
        delete pm._aiTemp; pm._summoned = true;
        if (!GameState._summonedData.mounts) GameState._summonedData.mounts = [];
        if (!GameState._summonedData.mounts.find(function(x){ return x.id === pm.id; })) {
          GameState._summonedData.mounts.push(pm);
        }
        delete mDef._aiTemp;
        mDef._summoned = true;
      }
    }
  }

  if (!GameState._summonedData.units.find(function(x) { return x.id === persistUnit.id; })) {
    GameState._summonedData.units.push(persistUnit);
  }

  // 同步 UNIT_TIER_CONFIG（用于兵营/商城显示）
  if (typeof UNIT_TIER_CONFIG !== 'undefined' && !UNIT_TIER_CONFIG[unitDef.type]) {
    var tColor = typeof getTierColor === 'function' ? getTierColor(unitDef.tier) : '#4a4a4a';
    var tName = typeof getTierName === 'function' ? getTierName(unitDef.tier) : '黑铁';
    var tierLabels = { iron: '⚫', bronze: '🟤', gold: '🟡', diamond: '💎' };
    var prices = { iron: 200, bronze: 400, gold: 800, diamond: 1500 };
    UNIT_TIER_CONFIG[unitDef.type] = {
      tier: unitDef.tier,
      tierName: tName,
      tierLabel: (tierLabels[unitDef.tier] || '⚫') + ' ' + tName,
      price: prices[unitDef.tier] || 200,
      desc: (unitDef.background || 'AI对战缴获').substring(0, 30),
      color: tColor,
      bgColor: typeof hexToRgba === 'function' ? hexToRgba(tColor, 0.15) : 'rgba(74,74,74,0.15)'
    };
  }

  // 保存
  if (typeof saveToBrowser === 'function' && GameState.saveName) {
    saveToBrowser(GameState.saveName);
  }

  if (typeof showToast === 'function') {
    showToast('🎉 已获得兵种：' + unitDef.name, 'success');
  }

  // 发出事件，让商城/兵营刷新
  if (typeof EventBus !== 'undefined' && EventBus.emit) {
    EventBus.emit('unit:added', { id: newPlayerUnitId, type: unitDef.type, name: unitDef.name });
  }

  // 关闭弹窗并返回（保留被领取的单位在UD中）
  closeAIBattleSettlement([unitDef.id]);
}

// ===== 跳过兵种奖励 =====
function skipAIBattleReward() {
  if (typeof showToast === 'function') {
    showToast('已跳过兵种选择', 'info');
  }
  closeAIBattleSettlement([]);
}

// ===== 关闭兵种详情弹窗（带退场动画）=====
function closeAIUnitDetail() {
  var modal = document.getElementById('aiUnitDetailModal');
  if (!modal) return;
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

// ===== 关闭AI对战结算弹窗并返回主页 =====
function closeAIBattleSettlement(keepUnitIds) {
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
  if (typeof initTurns === 'function') initTurns();
  if (typeof interactionInited !== 'undefined') interactionInited = false;

  // 隐藏幕布
  var curtain = document.getElementById('battleCurtain');
  if (curtain) { curtain.style.display = 'flex'; curtain.style.opacity = '1'; }

  // 清理AI对手临时单位（保留被领取的）
  clearAIOpponentUnits(keepUnitIds);

  // 重置AI对战状态
  AI_BATTLE_STATE.currentOpponent = null;
  AI_BATTLE_STATE.pendingBattle = false;
  window._aiBattleOpponent = null;
  if (typeof TurnState !== 'undefined') {
    TurnState.isAIBattle = false;
    TurnState.aiOpponent = null;
  }

  // 返回准备页
  showPage('Prep');
}

// ===== 暴露给全局 =====
window.AI_BATTLE_STATE = AI_BATTLE_STATE;
window.generateAIOpponent = generateAIOpponent;
window.generateAIOpponentName = generateAIOpponentName;
window.buildAIBattlePage = buildAIBattlePage;
window.onFindAIOpponent = onFindAIOpponent;
window.onStartAIBattle = onStartAIBattle;
window.refreshAIOpponentDisplay = refreshAIOpponentDisplay;
window.showAIBattleSettlement = showAIBattleSettlement;
window.claimAIBattleUnit = claimAIBattleUnit;
window.showAIUnitDetail = showAIUnitDetail;
window.closeAIUnitDetail = closeAIUnitDetail;
window.skipAIBattleReward = skipAIBattleReward;
window.closeAIBattleSettlement = closeAIBattleSettlement;
window.injectAIOpponentUnits = injectAIOpponentUnits;
window.clearAIOpponentUnits = clearAIOpponentUnits;

// ==================== 斗蛐蛐对战模式 ====================

// ===== 构建斗蛐蛐双方配置页 =====
function buildDuelArenaPage() {
  var wrap = document.getElementById('duelArenaContent');
  if (!wrap) return;
  wrap.innerHTML = '';

  // 标题区
  var header = document.createElement('div');
  header.className = 'duel-arena-header';
  header.innerHTML =
    '<h2 class="duel-arena-title">🐛 斗蛐蛐竞技场</h2>' +
    '<div class="duel-arena-sub">分别为双方生成阵容，让 AI 自动模拟对战</div>';
  wrap.appendChild(header);

  // 双方配置区（左右两栏 + 中间 VS）
  var sides = document.createElement('div');
  sides.className = 'duel-sides';

  sides.appendChild(buildDuelSidePanel('A', '🛡 甲方'));

  var vs = document.createElement('div');
  vs.className = 'duel-vs';
  vs.textContent = 'VS';
  sides.appendChild(vs);

  sides.appendChild(buildDuelSidePanel('B', '⚔ 乙方'));
  wrap.appendChild(sides);

  // 底部按钮区
  var actions = document.createElement('div');
  actions.className = 'duel-actions';
  actions.innerHTML =
    '<button class="duel-start-btn" id="duelStartBtn" disabled>⚔ 开战</button>' +
    '<button class="ai-btn ai-btn-back" onclick="showPage(\'Prep\')">← 返回</button>';
  wrap.appendChild(actions);

  // 绑定两侧事件
  bindDuelSideEvents('A');
  bindDuelSideEvents('B');

  // 开战按钮
  var startBtn = document.getElementById('duelStartBtn');
  if (startBtn) startBtn.addEventListener('click', startDuelBattle);

  // 回填已生成的阵容
  if (DUEL_STATE.sideA) renderDuelSideUnits('A');
  if (DUEL_STATE.sideB) renderDuelSideUnits('B');
  refreshDuelStartBtn();
}

// ===== 构建单方配置面板 =====
function buildDuelSidePanel(side, titleText) {
  var panel = document.createElement('div');
  panel.className = 'duel-side';
  panel.innerHTML =
    '<div class="duel-side-header">' +
      '<div class="duel-side-title">' + titleText + '</div>' +
      '<div class="duel-side-status" id="duelStatus' + side + '">未生成</div>' +
    '</div>' +
    '<div class="duel-side-settings">' +
      // 兵团数量
      '<div class="duel-setting-row">' +
        '<label class="duel-setting-label">兵团数量</label>' +
        '<div class="duel-slider-wrap">' +
          '<input type="range" id="duelUnitCount' + side + '" min="3" max="10" value="4" class="duel-slider">' +
          '<span class="duel-slider-val" id="duelUnitCountVal' + side + '">4</span>' +
        '</div>' +
      '</div>' +
      // 指挥官水平
      '<div class="duel-setting-row">' +
        '<label class="duel-setting-label">指挥官</label>' +
        '<div class="duel-diff-btns" id="duelIntelBtns' + side + '">' +
          '<button class="duel-diff-btn" data-intel="easy">简单</button>' +
          '<button class="duel-diff-btn active" data-intel="hard">困难</button>' +
          '<button class="duel-diff-btn" data-intel="legend">传说</button>' +
        '</div>' +
      '</div>' +
      // 部队水平
      '<div class="duel-setting-row">' +
        '<label class="duel-setting-label">部队</label>' +
        '<div class="duel-diff-btns" id="duelStrengthBtns' + side + '">' +
          '<button class="duel-diff-btn" data-strength="easy">简单</button>' +
          '<button class="duel-diff-btn active" data-strength="hard">困难</button>' +
          '<button class="duel-diff-btn" data-strength="legend">传说</button>' +
        '</div>' +
      '</div>' +
      // 背景描述
      '<div class="duel-setting-row duel-desc-row">' +
        '<label class="duel-setting-label">背景描述</label>' +
        '<textarea id="duelDesc' + side + '" class="duel-desc-input" rows="3" placeholder="可填背景设定，例如：&#10;- 来自北境的霜狼军团&#10;- 古代遗迹中苏醒的机械傀儡&#10;- 留空则随机生成"></textarea>' +
      '</div>' +
      // AI 控制开关（默认 ON，有 .on 表示 AI）
      '<div class="duel-setting-row">' +
        '<label class="duel-setting-label">AI 控制</label>' +
        '<div class="duel-toggle on" id="duelToggle' + side + '">' +
          '<span class="duel-toggle-label">AI</span>' +
        '</div>' +
      '</div>' +
      // 生成按钮
      '<div class="duel-setting-row">' +
        '<button class="duel-gen-btn" id="duelGenBtn' + side + '">🔍 生成阵容</button>' +
      '</div>' +
    '</div>' +
    // 单位列表区
    '<div class="duel-unit-list" id="duelUnitList' + side + '">' +
      '<div class="duel-empty-hint">点击「生成阵容」后展示</div>' +
    '</div>';
  return panel;
}

// ===== 绑定单方事件 =====
function bindDuelSideEvents(side) {
  // 兵团数量滑块
  var slider = document.getElementById('duelUnitCount' + side);
  var sliderVal = document.getElementById('duelUnitCountVal' + side);
  if (slider && sliderVal) {
    slider.addEventListener('input', function() {
      sliderVal.textContent = slider.value;
    });
  }

  // 指挥官水平按钮组
  var intelBtns = document.querySelectorAll('#duelIntelBtns' + side + ' .duel-diff-btn');
  intelBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      intelBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // 部队水平按钮组
  var strBtns = document.querySelectorAll('#duelStrengthBtns' + side + ' .duel-diff-btn');
  strBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      strBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // AI 控制开关（.on 表示 AI，否则表示人类）
  var toggle = document.getElementById('duelToggle' + side);
  if (toggle) {
    toggle.addEventListener('click', function() {
      toggle.classList.toggle('on');
      var label = toggle.querySelector('.duel-toggle-label');
      if (label) label.textContent = toggle.classList.contains('on') ? 'AI' : '人类';
    });
  }

  // 生成阵容按钮
  var genBtn = document.getElementById('duelGenBtn' + side);
  if (genBtn) genBtn.addEventListener('click', function() { onDuelGenerateSide(side); });
}

// ===== 生成单方阵容 =====
function onDuelGenerateSide(side) {
  var descInput = document.getElementById('duelDesc' + side);
  var slider = document.getElementById('duelUnitCount' + side);
  var toggle = document.getElementById('duelToggle' + side);
  var genBtn = document.getElementById('duelGenBtn' + side);
  var statusEl = document.getElementById('duelStatus' + side);

  var description = descInput ? descInput.value.trim() : '';
  var unitCount = slider ? Number(slider.value) : 4;
  var activeIntel = document.querySelector('#duelIntelBtns' + side + ' .duel-diff-btn.active');
  var activeStrength = document.querySelector('#duelStrengthBtns' + side + ' .duel-diff-btn.active');
  var intelligence = activeIntel ? activeIntel.dataset.intel : 'hard';
  var strength = activeStrength ? activeStrength.dataset.strength : 'hard';
  var controlledByAI = toggle ? toggle.classList.contains('on') : true;

  // 清理上一次该侧的临时单位
  clearAIOpponentUnitsForDuelSide(side);

  // 生成中状态
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.textContent = '⏳ 生成中...';
  }
  if (statusEl) statusEl.textContent = '生成中...';

  var fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: description,
      unitCount: unitCount,
      intelligence: intelligence,
      strength: strength
    })
  };

  fetch('/api/ai-battle-generate', fetchOptions)
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.ok) {
      throw new Error(data.error || '生成失败');
    }
    var opponent = convertAIGeneratedOpponent(data);
    opponent.controlledByAI = controlledByAI;

    if (side === 'A') DUEL_STATE.sideA = opponent;
    else DUEL_STATE.sideB = opponent;

    injectAIOpponentUnits(opponent);
    renderDuelSideUnits(side);

    if (statusEl) statusEl.textContent = '已生成 · ' + opponent.units.length + ' 兵团';

    if (DUEL_STATE.sideA && DUEL_STATE.sideB) {
      DUEL_STATE.bothGenerated = true;
    }
    refreshDuelStartBtn();

    if (typeof showToast === 'function') {
      showToast(side === 'A' ? '甲方阵容已生成' : '乙方阵容已生成', 'success');
    }
  })
  .catch(function(err) {
    if (typeof showToast === 'function') {
      showToast('生成失败：' + err.message, 'error');
    }
    if (statusEl) statusEl.textContent = '生成失败';
  })
  .finally(function() {
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.textContent = '🔍 生成阵容';
    }
  });
}

// ===== 渲染单方单位列表（缩略卡片：图标+名称+品阶+typeName）=====
function renderDuelSideUnits(side) {
  var listEl = document.getElementById('duelUnitList' + side);
  if (!listEl) return;
  var opp = (side === 'A') ? DUEL_STATE.sideA : DUEL_STATE.sideB;
  if (!opp || !opp.units || opp.units.length === 0) {
    listEl.innerHTML = '<div class="duel-empty-hint">点击「生成阵容」后展示</div>';
    return;
  }
  var html = '';
  opp.units.forEach(function(u) {
    var unitTierInfo = AI_TIER_DIFFICULTY[u.tier] || AI_TIER_DIFFICULTY.iron;
    html += '<div class="duel-unit-card" style="border-color:' + unitTierInfo.color + '">';
    html +=   '<div class="duel-unit-img-wrap"><img class="duel-unit-img" src="' + u.image + '" alt="" onerror="this.style.display=\'none\'"><span class="duel-unit-tier" style="background:' + unitTierInfo.color + '">' + unitTierInfo.label + '</span></div>';
    html +=   '<div class="duel-unit-body">';
    html +=     '<div class="duel-unit-name">' + u.icon + ' ' + escapeHtml(u.name) + '</div>';
    html +=     '<div class="duel-unit-type">' + u.typeName + '</div>';
    html +=   '</div>';
    html += '</div>';
  });
  listEl.innerHTML = html;
}

// ===== 清理斗蛐蛐某侧临时单位 =====
// 读取该侧 units 收集 unit.id，调用 clearAIOpponentUnits 清理 UD/ED/RD 中的临时数据，然后清空该侧状态
function clearAIOpponentUnitsForDuelSide(side) {
  // clearAIOpponentUnits(keepUnitIds) 的语义是"保留 keepUnitIds 中的临时单位"
  // 因此清理本侧时，要传入"另一侧"的 unit ids 才能保留对方
  var otherOpp = (side === 'A') ? DUEL_STATE.sideB : DUEL_STATE.sideA;
  var keepIds = [];
  if (otherOpp && otherOpp.units) {
    keepIds = otherOpp.units.map(function(u) { return u.id; });
  }
  clearAIOpponentUnits(keepIds);

  // 清空本侧状态
  if (side === 'A') DUEL_STATE.sideA = null;
  else DUEL_STATE.sideB = null;
  DUEL_STATE.bothGenerated = false;
  refreshDuelStartBtn();
}

// ===== 刷新开战按钮可用状态 =====
function refreshDuelStartBtn() {
  var startBtn = document.getElementById('duelStartBtn');
  if (!startBtn) return;
  if (DUEL_STATE.sideA && DUEL_STATE.sideB && DUEL_STATE.bothGenerated) {
    startBtn.disabled = false;
  } else {
    startBtn.disabled = true;
  }
}

// ===== 开战入口 =====
// 只设置数据并跳转，由 confirmBattle 接管（confirmBattle 中读取 _duelBattleData）
function startDuelBattle() {
  if (!DUEL_STATE.sideA || !DUEL_STATE.sideB) {
    if (typeof showToast === 'function') showToast('请先为双方生成阵容', 'warning');
    return;
  }
  // 直接设置 BT 数据并跳转 Battle，跳过 Select 选兵阶段
  // （斗蛐蛐模式下双方单位都来自 AI 生成，不需要从兵营选兵）
  window._duelBattleData = {
    sideA: DUEL_STATE.sideA,
    sideB: DUEL_STATE.sideB
  };
  if (typeof TurnState !== 'undefined') {
    TurnState.isDuelBattle = true;
    TurnState.sideAControlledByAI = !!DUEL_STATE.sideA.controlledByAI;
    TurnState.sideBControlledByAI = !!DUEL_STATE.sideB.controlledByAI;
  }
  // 重置对战速度倍率为默认 1.0（避免上局设置残留）
  if (typeof BATTLE_SPEED_MULT !== 'undefined') BATTLE_SPEED_MULT = 1.0;
  // 重置观战模式暂停标记（避免上局残留）
  if (typeof _spectatorPaused !== 'undefined') _spectatorPaused = false;
  var playerTypes = DUEL_STATE.sideA.units.map(function(u) { return u.type; });
  var enemyTypes = DUEL_STATE.sideB.units.map(function(u) { return u.type; });
  if (typeof BT !== 'undefined') {
    BT = { player: playerTypes, enemy: enemyTypes };
  } else {
    window.BT = { player: playerTypes, enemy: enemyTypes };
  }
  showPage('Battle');
}

// ===== 暴露斗蛐蛐模式给全局 =====
window.buildDuelArenaPage = buildDuelArenaPage;
window.onDuelGenerateSide = onDuelGenerateSide;
window.startDuelBattle = startDuelBattle;
window.DUEL_STATE = DUEL_STATE;
window.clearAIOpponentUnitsForDuelSide = clearAIOpponentUnitsForDuelSide;

// ===== 斗蛐蛐模式结算：弹出胜利者提示 =====
function showDuelBattleSettlement(result) {
  if (typeof DUEL_STATE === 'undefined' || (!DUEL_STATE.sideA && !DUEL_STATE.sideB)) {
    return false; // 无斗蛐蛐数据，回退普通结算
  }

  var sideAName = DUEL_STATE.sideA ? (DUEL_STATE.sideA.name || '甲方') : '甲方';
  var sideBName = DUEL_STATE.sideB ? (DUEL_STATE.sideB.name || '乙方') : '乙方';

  var winnerSide = result.winner; // 'player' = 甲方胜，'enemy' = 乙方胜
  var winnerName = winnerSide === 'player' ? sideAName : sideBName;
  var loserName = winnerSide === 'player' ? sideBName : sideAName;

  // 移除已有弹窗
  var existing = document.getElementById('duelSettlementModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'duelSettlementModal';
  modal.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:rgba(20,15,10,0.88);display:flex;' +
    'align-items:center;justify-content:center;z-index:1000;' +
    'overflow-y:auto;padding:20px 0;';

  var html = '';
  html += '<div style="background:linear-gradient(135deg,#f5ecd7 0%,#e8dcc0 100%);' +
          'border:3px solid #d4a017;border-radius:16px;padding:32px 40px;' +
          'max-width:560px;width:88%;text-align:center;box-shadow:0 0 60px rgba(212,160,23,0.3);' +
          'margin:auto;">';

  // 标题
  html += '<div style="font-size:56px;margin-bottom:8px">🏆</div>';
  html += '<h2 style="font-size:36px;color:#d4a017;margin:0 0 8px;letter-spacing:6px;font-family:SimSun,serif;">胜 利</h2>';
  html += '<div style="font-size:20px;color:#3d2b1a;margin-bottom:20px;font-weight:bold">胜利者：<span style="color:#d4a017;font-size:24px">' + escapeHtml(winnerName) + '</span></div>';

  // 战损统计
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;text-align:left">';
  html +=   '<div style="background:rgba(107,142,35,0.12);border:1px solid #6b8e23;border-radius:8px;padding:12px">';
  html +=     '<div style="font-size:13px;color:#6b8e23;font-weight:bold;margin-bottom:4px">🔷 ' + escapeHtml(sideAName) + '（甲方）</div>';
  html +=     '<div style="font-size:13px;color:#3d2b1a">存活 <b style="color:#6b8e23">' + result.playerAlive + '</b> · 溃逃 <b style="color:#8b2500">' + result.playerRouted + '</b></div>';
  html +=   '</div>';
  html +=   '<div style="background:rgba(139,37,0,0.1);border:1px solid #8b2500;border-radius:8px;padding:12px">';
  html +=     '<div style="font-size:13px;color:#8b2500;font-weight:bold;margin-bottom:4px">🔶 ' + escapeHtml(sideBName) + '（乙方）</div>';
  html +=     '<div style="font-size:13px;color:#3d2b1a">存活 <b style="color:#8b2500">' + result.enemyAlive + '</b> · 溃逃 <b style="color:#8b2500">' + result.enemyRouted + '</b></div>';
  html +=   '</div>';
  html += '</div>';

  // 结算说明
  html += '<div style="font-size:14px;color:#8a6d4b;margin-bottom:20px">' + escapeHtml(loserName) + ' 全军覆没，' + escapeHtml(winnerName) + ' 赢得本场对决！</div>';

  // 返回按钮
  html += '<div style="display:flex;gap:12px;justify-content:center;">';
  html +=   '<button onclick="closeDuelSettlementAndReturn()" style="padding:12px 28px;font-size:15px;border:2px solid #d4a017;border-radius:10px;background:linear-gradient(135deg,#f5ecd7 0%,#e8dcc0 100%);color:#3d1a00;cursor:pointer;font-family:SimSun,serif;letter-spacing:3px;font-weight:bold">📜 返回斗蛐蛐</button>';
  html += '</div>';

  html += '</div>';
  modal.innerHTML = html;
  document.body.appendChild(modal);

  // 入场动画
  if (window.gsap) {
    var modalContent = modal.firstElementChild;
    gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    if (modalContent) {
      gsap.fromTo(modalContent,
        { opacity: 0, scale: 0.8, y: 30 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.7)' }
      );
    }
  }

  return true;
}

function closeDuelSettlementAndReturn() {
  var modal = document.getElementById('duelSettlementModal');
  if (modal) modal.remove();
  // 清理战斗状态
  if (typeof exitBattle === 'function') {
    exitBattle();
  }
  // 返回斗蛐蛐配置页
  if (typeof showPage === 'function') {
    showPage('DuelArena');
  }
}

window.showDuelBattleSettlement = showDuelBattleSettlement;
window.closeDuelSettlementAndReturn = closeDuelSettlementAndReturn;
