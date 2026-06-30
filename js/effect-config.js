// ==================== 装备特殊效果配置表 ====================
// 所有装备效果的定义、触发条件、效果计算统一在此管理

var EFFECT_CONFIG = {
  E001: {
    id: 'E001',
    name: '抵御冲锋',
    type: 'defense',
    typeName: '防御类',
    trigger: 'cavalryCharge',
    triggerName: '正面防守骑兵冲锋时',
    desc: '清零对方冲锋动能倍率，自身武器强度临时+5',
    allowedWeapons: ['long'],
    allowedUnits: ['infantry', 'cavalry'],
    note: '长柄武器专属'
  },
  E002: {
    id: 'E002',
    name: '远程免伤',
    type: 'defense',
    typeName: '防御类',
    trigger: 'passive',
    triggerName: '装备盾牌时永久生效',
    desc: '远程伤害减免25%~40%',
    allowedWeapons: ['shield'],
    allowedUnits: ['all'],
    note: '盾牌专属'
  },
  E003: {
    id: 'E003',
    name: '重甲克制',
    type: 'attack',
    typeName: '攻击类',
    trigger: 'vsHeavyArmor',
    triggerName: '攻击护甲≥30的目标时',
    desc: '最终伤害×1.2',
    allowedWeapons: ['crossbow', 'blunt'],
    allowedUnits: ['archer'],
    note: '弩类、钝器类武器专属'
  },
  E004: {
    id: 'E004',
    name: '无视近战干扰',
    type: 'utility',
    typeName: '功能类',
    trigger: 'adjacentEnemy',
    triggerName: '相邻格有敌军时',
    desc: '仍可正常进行远程射击',
    allowedWeapons: ['crossbow'],
    allowedUnits: ['archer'],
    note: '弩类武器专属'
  },
  E005: {
    id: 'E005',
    name: '惧怕近身',
    type: 'negative',
    typeName: '负面类',
    trigger: 'adjacentEnemy',
    triggerName: '相邻格有敌军时',
    desc: '强制进入禁射状态，无法远程攻击',
    allowedWeapons: ['bow'],
    allowedUnits: ['archer'],
    note: '弓类武器专属'
  },
  E006: {
    id: 'E006',
    name: '飞行能力',
    type: 'utility',
    typeName: '功能类',
    trigger: 'passive',
    triggerName: '永久生效',
    desc: '可跨越地形障碍，无视地面阻挡，触发空中震慑机制',
    allowedWeapons: ['all'],
    allowedUnits: ['flying'],
    note: '空军坐骑专属'
  },
  E007: {
    id: 'E007',
    name: '空中震慑',
    type: 'utility',
    typeName: '功能类',
    trigger: 'vsInfantry',
    triggerName: '空军攻击步兵时',
    desc: '扣除目标步兵士气5点',
    allowedWeapons: ['all'],
    allowedUnits: ['flying'],
    note: '空军专属机制'
  },
  E008: {
    id: 'E008',
    name: '全伤害减免',
    type: 'defense',
    typeName: '防御类',
    trigger: 'passive',
    triggerName: '永久生效',
    desc: '所有类型伤害减免10%',
    allowedWeapons: ['all'],
    allowedUnits: ['all'],
    note: '传奇护甲专属'
  },
  E009: {
    id: 'E009',
    name: '机动惩罚',
    type: 'negative',
    typeName: '负面类',
    trigger: 'passive',
    triggerName: '永久生效',
    desc: '单回合移动格数-1（最低为1）',
    allowedWeapons: ['all'],
    allowedUnits: ['infantry', 'cavalry'],
    note: '重甲专属'
  },
  E010: {
    id: 'E010',
    name: '迅捷',
    type: 'buff',
    typeName: '增益类',
    trigger: 'passive',
    triggerName: '永久生效',
    desc: '血量-20%，移动力+1（无视上限）',
    allowedWeapons: ['short', 'long'],
    allowedUnits: ['infantry', 'cavalry'],
    note: '近战武器专属'
  },
  E011: {
    id: 'E011',
    name: '骑射',
    type: 'utility',
    typeName: '功能类',
    trigger: 'passive',
    triggerName: '永久生效',
    desc: '该武器可在马背/飞行中操作，允许骑兵和空军装备',
    allowedWeapons: ['bow', 'crossbow'],
    allowedUnits: ['cavalry', 'flying'],
    note: '弓/弩类武器专属，骑射手和远程空军的装备通行证'
  }
};

// 武器类型对应的默认效果
var WEAPON_DEFAULT_EFFECTS = {
  short: [],
  long: ['E001'],
  bow: ['E005'],
  crossbow: ['E003', 'E004'],
  shield: ['E002'],
  blunt: ['E003']
};

// 护甲类型对应的默认效果
var ARMOR_DEFAULT_EFFECTS = {
  light: [],
  medium: [],
  heavy: ['E009'],
  legendary: ['E008', 'E009']
};

// 坐骑类型对应的默认效果
var MOUNT_DEFAULT_EFFECTS = {
  flying: ['E006', 'E007']
};

// 根据武器类型获取默认效果名称列表
function getWeaponEffectsByType(wpType) {
  var effectIds = WEAPON_DEFAULT_EFFECTS[wpType] || [];
  return effectIds.map(function(id) {
    return EFFECT_CONFIG[id] ? EFFECT_CONFIG[id].name : id;
  });
}

// 检查武器类型是否允许某效果
function isEffectAllowedForWeapon(effectId, wpType) {
  var eff = EFFECT_CONFIG[effectId];
  if (!eff) return false;
  if (eff.allowedWeapons.indexOf('all') >= 0) return true;
  return eff.allowedWeapons.indexOf(wpType) >= 0;
}

// 按效果名查效果对象
function getEffectByName(name) {
  for (var k in EFFECT_CONFIG) {
    if (EFFECT_CONFIG[k].name === name) return EFFECT_CONFIG[k];
  }
  return null;
}

// 检查装备的 effects 数组中是否含有某效果（按 ID 查询，避免字符串散落）
function hasEffect(effectsArr, effectId) {
  if (!effectsArr || !effectsArr.length) return false;
  var eff = EFFECT_CONFIG[effectId];
  if (!eff) return false;
  return effectsArr.indexOf(eff.name) >= 0;
}

window.EFFECT_CONFIG = EFFECT_CONFIG;
window.WEAPON_DEFAULT_EFFECTS = WEAPON_DEFAULT_EFFECTS;
window.ARMOR_DEFAULT_EFFECTS = ARMOR_DEFAULT_EFFECTS;
window.MOUNT_DEFAULT_EFFECTS = MOUNT_DEFAULT_EFFECTS;
window.getWeaponEffectsByType = getWeaponEffectsByType;
window.isEffectAllowedForWeapon = isEffectAllowedForWeapon;
window.getEffectByName = getEffectByName;
window.hasEffect = hasEffect;
