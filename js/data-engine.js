// ==================== 数据引擎 ====================
let RD=null, ED=null, UD=null, BT=null, UI={};

const BEAST_RACES = ['war_dog', 'war_wolf', 'falcon'];

// ==================== 品阶系统 ====================
// 品阶定义
var TIER_LEVELS = {
  iron:    { id: 'iron',    name: '黑铁', multiplier: 1.0, color: '#4a4a4a', sort: 0 },
  bronze:  { id: 'bronze',  name: '青铜', multiplier: 1.2, color: '#cd7f32', sort: 1 },
  gold:    { id: 'gold',    name: '黄金', multiplier: 1.5, color: '#ffd700', sort: 2 },
  diamond: { id: 'diamond', name: '钻石', multiplier: 2.0, color: '#a78bfa', sort: 3 }
};

// 默认品阶
var DEFAULT_TIER = 'iron';

// 获取品阶信息对象（无效id回退到默认品阶）
function getTierInfo(tierId){
  var t = TIER_LEVELS[tierId];
  return t || TIER_LEVELS[DEFAULT_TIER];
}

// 获取品阶加成系数
function getTierMultiplier(tierId){
  var t = getTierInfo(tierId);
  return t ? t.multiplier : 1.0;
}

// 获取品阶中文名
function getTierName(tierId){
  var t = getTierInfo(tierId);
  return t ? t.name : TIER_LEVELS[DEFAULT_TIER].name;
}

// 获取品阶颜色
function getTierColor(tierId){
  var t = getTierInfo(tierId);
  return t ? t.color : TIER_LEVELS[DEFAULT_TIER].color;
}

// 比较两个品阶高低，返回 -1/0/1（A低/B高/A=B）
function compareTier(tierA, tierB){
  var a = getTierInfo(tierA);
  var b = getTierInfo(tierB);
  var sa = a ? a.sort : 0;
  var sb = b ? b.sort : 0;
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

// 安全获取兵种品阶（无tier字段默认黑铁，向后兼容）
function getUnitTier(unitDef){
  if (unitDef && unitDef.tier) return unitDef.tier;
  return DEFAULT_TIER;
}

function getIconSuffix(baseType) {
  var map = {
    infantry: 'melee', cavalry: 'cavalry', archer: 'ranged',
    flying: 'flying', beast_infantry: 'beast', beast_flying: 'beast',
    peasant_infantry: 'melee', peasant_archer: 'ranged', elite_archer: 'ranged'
  };
  return map[baseType] || 'melee';
}

var CHINESE_WORLD_KEYS = ['ancient_china'];

function getIconStyle(tier) {
  return tier || 'iron';
}

function getUnitImagePath(tier, baseType, worldKey) {
  var style = getIconStyle(tier);
  if (worldKey && CHINESE_WORLD_KEYS.indexOf(worldKey) >= 0) {
    style = 'ink';
  }
  var suffix = getIconSuffix(baseType);
  return 'assets/images/icon_' + style + '_' + suffix + '.png';
}

function getRace(id){return RD?RD.races.find(r=>r.id===id):null}
function findWeapon(id){return ED?ED.weapons.find(w=>w.id===id):null}
function findShield(id){return ED?ED.shields.find(s=>s.id===id):null}
function findArmor(id){return ED?ED.armors.find(a=>a.id===id):null}
function findMount(id){return ED?ED.mounts.find(m=>m.id===id):null}
function getUnit(t){return UD?UD.units.find(u=>u.type===t)||null:null}
function unitDefByType(t){return UD?UD.units.find(u=>u.type===t):null}

function isBeastRace(raceId) {
  if (BEAST_RACES.indexOf(raceId) >= 0) return true;
  if (RD && RD.races) {
    var r = RD.races.find(function(x) { return x.id === raceId; });
    if (r && r._isBeast) return true;
  }
  return false;
}

function getRaceScale(raceId) {
  const r = getRace(raceId);
  return r ? r.scale : 1;
}

function getSizeCategory(raceId) {
  var scale = getRaceScale(raceId);
  if (scale === 1 && RD && RD.races) {
    var r = RD.races.find(function(x) { return x.id === raceId; });
    if (r && r._isBeast && r.scale) scale = r.scale;
  }
  var isBeast = isBeastRace(raceId);
  if (isBeast) {
    if (scale <= 1) return '小型';
    if (scale <= 3) return '中型';
    return '大型';
  } else {
    if (scale <= 3) return '中型';
    return '大型';
  }
}

// ===== 肉体默认装备（裸装时使用种族天赋）=====
// 规则：
//   - 主武器槽为空 → 使用种族天然武器 (naturalWeapon)，伤害=种族天然武器值，破甲0
//   - 护甲槽为空 → 使用种族天然护甲 (naturalArmor)
//   - 盾牌/坐骑槽为空 → 无
//   - 双手武器装备时自动禁用盾牌（盾牌槽清空）
// 肉体装备不占背包，是每个种族与生俱来的能力
function getBareFistWeapon(race) {
  if (!race) return null;
  // 野兽的天然武器有破甲（利齿、利爪、尖角等穿透力）
  var beastAP = race._isBeast ? Math.max(1, Math.floor((race.naturalWeapon || 3) * 0.4)) : 0;
  return {
    id: '_fist_' + race.id,
    name: race._isBeast ? '爪牙攻击' : '肉体攻击',
    category: '天然武器',
    type: 'natural',
    handed: 'one-handed',
    slot: 'main',
    baseDamage: race.naturalWeapon || 3,
    armorPierce: beastAP,
    attackRange: race.attackRange || 1,
    allowedRange: 1,
    forUnits: ['全兵种'],
    effects: [],
    desc: race._isBeast ? '利齿利爪等天然杀伤，具备破甲能力' : '徒手/爪牙/犄角等肉体攻击',
    _natural: true
  };
}

function getNaturalArmor(race) {
  if (!race) return null;
  return {
    id: '_naturalArmor_' + race.id,
    name: '天然护甲',
    category: '种族天赋',
    defense: race.naturalArmor || 0,
    mobilityPenalty: 0,
    forUnits: ['全兵种'],
    effects: [],
    desc: '皮肤/鳞片/外骨骼等天然防护',
    _natural: true
  };
}

// ===== 属性叠加规则 =====
// 相加型：HP、护甲、移动、规模、攻击范围加成
// 取最高/替换型：武器伤害（有武器用武器，无则用肉体）
// 武器破甲：有则用，无则0
// 士气：种族基底 + 装备效果加成
// 盾牌规则：双手武器（handed=two-handed）时不能装备盾牌，盾牌自动失效
function computeStats(unitDef){
  if (typeof UnitService !== 'undefined' && UnitService.getStats) {
    return UnitService.getStats(unitDef);
  }
  if (!unitDef || !unitDef.race) return null;
  const r = getRace(unitDef.race.id);
  // 找不到种族时使用默认人形种族兜底，确保渲染不崩溃
  if (!r) {
    var defaultRace = { id: unitDef.race.id || 'human', name: unitDef.race.name || '未知种族', scale: 1, typeLabel: '常规体型', baseHP: 80, naturalArmor: 2, naturalWeapon: 5, baseMorale: 50, baseMovement: 1, attackRange: 1 };
    return computeStatsWithRace(unitDef, defaultRace);
  }
  return computeStatsWithRace(unitDef, r);
}

function computeStatsWithRace(unitDef, r) {
  const eq = unitDef.equipment || {};

  const mw = eq.mainWeapon ? findWeapon(eq.mainWeapon) : getBareFistWeapon(r);
  var sh = null;
  if (eq.shield) {
    var foundShield = findShield(eq.shield);
    if (foundShield && mw && mw.handed !== 'two-handed') {
      sh = foundShield;
    }
  }
  const ar = eq.armor ? findArmor(eq.armor) : null;
  const mt = eq.mount ? findMount(eq.mount) : null;

  var unitScale=r.scale+(mt?mt.scale:0);
  var unitCount = Math.max(1, unitDef.unitCount || 1);
  var totalScale=unitScale*unitCount;

  var hpPerUnit = Math.max(1, (r.baseHP || 80) + (mt ? (mt.bonusHP || 0) : 0));
  var totalHP = hpPerUnit * unitCount;

  if (totalScale > 160) {
    var adjustedCount = Math.max(1, Math.floor(160 / unitScale));
    if (adjustedCount < unitCount) {
      unitCount = adjustedCount;
      totalScale = unitScale * unitCount;
      totalHP = hpPerUnit * unitCount;
    }
  }

  let totalArmor = r.naturalArmor;
  if (ar) totalArmor += ar.defense;
  if (mt && mt.bonusArmor) totalArmor += mt.bonusArmor;
  if (sh) {
    totalArmor += sh.defense || 0;
    if (sh.effects) {
      sh.effects.forEach(function(e){
        var m=e.match(/护甲[+](\d+)/);
        if(m) totalArmor += parseInt(m[1]);
      });
    }
  }

  let morale=r.baseMorale;

  let rangedResist=0;
  if(sh && sh.effects){
    sh.effects.forEach(function(e){
      var m=e.match(/远程免伤[+](\d+)%/);
      if(m) rangedResist = Math.max(rangedResist, parseInt(m[1])/100);
    });
  }

  let mainBase = mw ? mw.baseDamage : r.naturalWeapon;
  let mainAP = mw ? mw.armorPierce : 0;

  // 基础机动 = max(种族基准, 坐骑加成) + 护甲惩罚
  let armPenalty = (ar && ar.mobilityPenalty) ? ar.mobilityPenalty : 0;
  let rawMove = Math.max(r.baseMovement, mt ? (mt.bonusMove || 0) : 0) + armPenalty;

  // 根据品阶设定移动上限（1-4级）
  let tierVal = 1;
  if (unitDef._summonTier && !isNaN(unitDef._summonTier)) {
    tierVal = Math.max(1, Math.min(4, Number(unitDef._summonTier)));
  } else {
    // 兼容逻辑：如果没有 _summonTier，尝试从 unitDef.tier 转换
    var tierMap = { iron: 1, bronze: 2, gold: 3, diamond: 4 };
    tierVal = tierMap[unitDef.tier] || 1;
  }

  const isCavalry = unitDef.baseType === 'cavalry' || unitDef.type === 'cavalry';
  const isFlying = unitDef.baseType === 'flying' || unitDef.type === 'flying';
  let moveCap = 1;

  if (isFlying) {
    moveCap = tierVal >= 3 ? 4 : Math.max(3, tierVal + 1);
  } else if (isCavalry) {
    moveCap = tierVal >= 3 ? 4 : Math.max(2, tierVal + 1);
  } else {
    moveCap = Math.max(1, r.baseMovement || 1);
  }

  if (ar && ar.mobilityPenalty < 0 && moveCap > 1) {
    moveCap = Math.max(1, moveCap + ar.mobilityPenalty);
  }
  
  let finalMove = Math.max(1, Math.min(rawMove, moveCap));
  if (isNaN(finalMove)) finalMove = 1; // 最终兜底
  const baseMoveCap = 1;
  // 骑兵/空军即使穿重甲也不应低于基础机动 2 格
  if ((isCavalry || isFlying) && finalMove < baseMoveCap + 1) {
    finalMove = Math.min(moveCap, baseMoveCap + 1);
  }

  const extraMove = finalMove - baseMoveCap;
  if (extraMove > 0) {
    const penalty = extraMove * 0.03;
    hpPerUnit = Math.round(hpPerUnit * (1 - penalty));
    totalHP = hpPerUnit * unitCount;
    totalArmor = Math.round(totalArmor * (1 - penalty));
    mainBase = Math.round(mainBase * (1 - penalty * 0.5));
    morale = Math.round(morale * (1 - penalty * 0.5));
  }

  // 迅捷：武器效果，血量-20%，移动力+1（无视上限）
  if (mw && mw.effects && mw.effects.indexOf('迅捷') >= 0) {
    hpPerUnit = Math.round(hpPerUnit * 0.8);
    totalHP = hpPerUnit * unitCount;
    finalMove += 1;
  }

  let baseAttackRange = unitScale === 2 ? 2 : Math.max(1, unitScale - 1);
  let finalAttackRange = Math.max(baseAttackRange, (mw && mw.attackRange) || 1);

  const finalAllowedRange = mw ? (mw.allowedRange || 1) : 1;

  return{
    unitScale: unitScale || 1, totalScale: totalScale || 1,
    hpPerUnit: hpPerUnit || 1, totalHP: totalHP || 1,
    totalArmor: totalArmor || 0,
    mainBase: mainBase || 1, mainAP: mainAP || 0,
    movement: finalMove, morale: morale || 0, rangedResist,
    mainWeapon:mw,shield:sh,armor:ar,mount:mt,race:r,
    attackRange:finalAttackRange,allowedRange:finalAllowedRange,
    bareFist: !eq.mainWeapon,
    naturalArmorOnly: !eq.armor
  };
}

// ===== 装备操作 =====
// 拆卸装备：从unitDef的equipment中卸下指定槽位的装备，放入背包
// 返回被卸下的装备对象，没有则返回null
function unequipItem(unitDef, slot) {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.unequipItem) {
    return EquipmentService.unequipItem(unitDef, slot);
  }
  return null;
}

// 装备物品：将背包中的装备穿到unitDef的指定槽位
// 槽位如果已有装备，先卸下返回
// 双手武器装备时会自动卸下盾牌
// 返回 {success, unequipped, message}
function equipItem(unitDef, slot, itemId) {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.equipItem) {
    return EquipmentService.equipItem(unitDef, slot, itemId);
  }
  return {success:false, unequipped:null, message:'EquipmentService未初始化'};
}

// 检查装备是否适配该兵种
function isEquipmentCompatible(unitDef, item) {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.isCompatible) {
    return EquipmentService.isCompatible(unitDef, item);
  }
  return true;
}

// 检查某个槽位是否可以装备
function canEquipSlot(unitDef, slot) {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.canEquipSlot) {
    return EquipmentService.canEquipSlot(unitDef, slot);
  }
  return true;
}

// 检查盾牌是否可用（主武器是否为单手）
function canUseShield(unitDef) {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.canUseShield) {
    return EquipmentService.canUseShield(unitDef);
  }
  return false;
}

// ===== 装备适用性文本（UI展示用）=====
// 返回装备的适用兵种/装备条件文本，显示在装备名称下方
// 格式：
//   武器：单手 | 适用：步兵、骑兵   /   双手 | 适用：远程兵
//   护甲：体型：小型/中型/大型 | 适用：全兵种
//   盾牌：适用：全兵种
//   坐骑：适用：轻骑兵
// 自然装备（_natural 标记，如肉体攻击/天然护甲）或字段缺失时返回空字符串
function getEquipmentApplicabilityText(item) {
  if (!item || item._natural) return '';

  // 适用兵种文本
  var forUnitsText = '';
  if (item.forUnits && item.forUnits.length) {
    if (item.forUnits.indexOf('全兵种') >= 0) {
      forUnitsText = '全兵种';
    } else {
      forUnitsText = item.forUnits.join('、');
    }
  }

  // 检测装备类型
  var isWeapon = !!item.handed;
  var isShield = item.category === '盾牌';
  var isArmor = !isShield && !!item.forScale;
  // 坐骑：有 scale 和 bonusHP，且非武器/盾牌/护甲
  var isMount = !isWeapon && !isShield && !isArmor &&
    item.scale !== undefined && item.bonusHP !== undefined;

  var parts = [];

  if (isWeapon) {
    // 武器：显示单手/双手
    var handedMap = { 'one-handed': '单手', 'two-handed': '双手' };
    var handedText = handedMap[item.handed];
    if (handedText) parts.push(handedText);
  } else if (isArmor) {
    // 护甲：显示体型要求（用 / 分隔）
    if (item.forScale && item.forScale.length) {
      parts.push('体型：' + item.forScale.join('/'));
    }
  }
  // 盾牌和坐骑只显示适用兵种

  if (forUnitsText) parts.push('适用：' + forUnitsText);

  return parts.join(' | ');
}

function preloadImages(cb){
  if(!UD){cb();return}
  const imgs=new Set(UD.units.map(u=>u.image));let l=0;
  imgs.forEach(s=>{const i=new Image();i.onload=i.onerror=()=>{l++;if(l>=imgs.size)cb()};i.src=s;UI[s]=i});
  if(imgs.size===0)cb();
}

function createSponsorUnits() {
  if (!RD || !ED || !UD) return;

  // 先移除旧的赞助单位定义（处理格式迁移）
  if (UD.units) UD.units = UD.units.filter(function(u) { return !u._sponsorUnit; });
  if (RD.races) RD.races = RD.races.filter(function(r) { return !r._sponsorUnit; });
  if (ED.weapons) ED.weapons = ED.weapons.filter(function(w) { return !w._sponsorUnit; });
  if (ED.armors) ED.armors = ED.armors.filter(function(a) { return !a._sponsorUnit; });
  if (ED.mounts) ED.mounts = ED.mounts.filter(function(m) { return !m._sponsorUnit; });

  var taiyinRace = {
    id: 'sponsor_taiyin_race', name: '太阴族', scale: 1, baseHP: 459,
    naturalArmor: 6, naturalWeapon: 6, baseMorale: 100, baseMovement: 4,
    attackRange: 1, typeLabel: '月影骑士', _sponsorUnit: true, _summoned: true
  };
  RD.races.push(taiyinRace);

  var taiyinWpn = {
    id: 'sponsor_taiyin_wpn', name: '太阴大刀', tier: 'diamond', category: '长兵',
    type: 'long', handed: 'two-handed', baseDamage: 100, armorPierce: 50,
    allowedRange: 1, attackRange: 1,
    desc: '月华凝刃，万物俱灭。', _sponsorUnit: true, _summoned: true
  };
  ED.weapons.push(taiyinWpn);

  var taiyinArmor = {
    id: 'sponsor_taiyin_armor', name: '太阴霜甲', tier: 'diamond', category: '重甲',
    defense: 80, mobilityPenalty: -1,
    desc: '寒霜月华凝结的铠甲。', _sponsorUnit: true, _summoned: true
  };
  ED.armors.push(taiyinArmor);

  var taiyinMount = {
    id: 'sponsor_taiyin_mount', name: '太阴影驹', tier: 'diamond',
    scale: 3, bonusHP: 200, bonusArmor: 5, bonusMove: 5,
    desc: '踏月而来的暗影神驹。', _sponsorUnit: true, _summoned: true
  };
  ED.mounts.push(taiyinMount);

  var sunRace = {
    id: 'sponsor_sun_race', name: '太阳族', scale: 1, baseHP: 459,
    naturalArmor: 6, naturalWeapon: 6, baseMorale: 100, baseMovement: 4,
    attackRange: 1, typeLabel: '烈阳骑士', _sponsorUnit: true, _summoned: true
  };
  RD.races.push(sunRace);

  var sunWpn = {
    id: 'sponsor_sun_wpn', name: '太阳长枪', tier: 'diamond', category: '长兵',
    type: 'long', handed: 'two-handed', baseDamage: 100, armorPierce: 50,
    allowedRange: 1, attackRange: 1,
    desc: '日轮灼枪，焚尽八荒。', _sponsorUnit: true, _summoned: true
  };
  ED.weapons.push(sunWpn);

  var sunArmor = {
    id: 'sponsor_sun_armor', name: '太阳金甲', tier: 'diamond', category: '重甲',
    defense: 80, mobilityPenalty: -1,
    desc: '烈日熔铸的黄金铠甲。', _sponsorUnit: true, _summoned: true
  };
  ED.armors.push(sunArmor);

  var sunMount = {
    id: 'sponsor_sun_mount', name: '太阳焰驹', tier: 'diamond',
    scale: 3, bonusHP: 200, bonusArmor: 5, bonusMove: 5,
    desc: '踏焰而行的烈阳神驹。', _sponsorUnit: true, _summoned: true
  };
  ED.mounts.push(sunMount);

  var taiyinUnit = {
    id: 'u_taiyin_rider', type: 'taiyin_rider', name: '太阴骑', icon: '🌑',
    tier: 'diamond', baseType: 'cavalry', typeName: '骑兵',
    race: { id: 'sponsor_taiyin_race', name: '太阴族' },
    image: 'assets/images/taiyin_rider.png', unitCount: 40,
    equipment: {
      mainWeapon: 'sponsor_taiyin_wpn', armor: 'sponsor_taiyin_armor',
      mount: 'sponsor_taiyin_mount'
    },
    background: '神明左手，太阴族乃神之暗面化身。乘太阴影驹穿梭月影，大刀所过万物寂灭。',
    belief: '神之左手横扫万物，暗影笼罩一切。',
    _sponsorUnit: true, _neverRout: true, _summoned: true
  };
  UD.units.push(taiyinUnit);

  var sunUnit = {
    id: 'u_sun_rider', type: 'sun_rider', name: '太阳骑', icon: '☀️',
    tier: 'diamond', baseType: 'cavalry', typeName: '骑兵',
    race: { id: 'sponsor_sun_race', name: '太阳族' },
    image: 'assets/images/sun_rider.png', unitCount: 40,
    equipment: {
      mainWeapon: 'sponsor_sun_wpn', armor: 'sponsor_sun_armor',
      mount: 'sponsor_sun_mount'
    },
    background: '神明右手，太阳族乃神之光明化身。骑太阳焰驹驰骋战场，长枪燃起净世之火。',
    belief: '神之右手净化万物，光明驱散一切。',
    _sponsorUnit: true, _neverRout: true, _summoned: true
  };
  UD.units.push(sunUnit);

  if (!GameState._summonedData) {
    GameState._summonedData = { races: [], weapons: [], shields: [], armors: [], mounts: [], units: [] };
  }
  var sd = GameState._summonedData;
  // 先清除旧格式赞助条目
  var cats = ['races','weapons','shields','armors','mounts','units'];
  cats.forEach(function(cat) {
    if (sd[cat]) sd[cat] = sd[cat].filter(function(it) { return !it._sponsorUnit; });
  });
  // 写入新格式深拷贝
  if (!sd.races) sd.races = [];
  sd.races.push(JSON.parse(JSON.stringify(taiyinRace)), JSON.parse(JSON.stringify(sunRace)));
  if (!sd.weapons) sd.weapons = [];
  sd.weapons.push(JSON.parse(JSON.stringify(taiyinWpn)), JSON.parse(JSON.stringify(sunWpn)));
  if (!sd.armors) sd.armors = [];
  sd.armors.push(JSON.parse(JSON.stringify(taiyinArmor)), JSON.parse(JSON.stringify(sunArmor)));
  if (!sd.mounts) sd.mounts = [];
  sd.mounts.push(JSON.parse(JSON.stringify(taiyinMount)), JSON.parse(JSON.stringify(sunMount)));
  if (!sd.units) sd.units = [];
  sd.units.push(JSON.parse(JSON.stringify(taiyinUnit)), JSON.parse(JSON.stringify(sunUnit)));
}

window.createSponsorUnits = createSponsorUnits;
