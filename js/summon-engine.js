// AI路径引导：如需查找相关代码路径，请先查阅 AI_PATH_GUIDE.md
// 每新增/修改一个文件后必须同步更新 AI_PATH_GUIDE.md
// ==================== 召唤兵团生成引擎 ====================
// AI API 生成完整兵团（名字/装备/背景/属性）
// 遵循《单位生成与推演引擎机制》规则

var SUMMON_TIERS = {
  1: { name: '黑铁召唤', cost: 200,  label: '⚫', tier: 1, powerRange: [5, 20] },
  2: { name: '青铜召唤', cost: 600,  label: '🟤', tier: 2, powerRange: [20, 45] },
  3: { name: '黄金召唤', cost: 1200, label: '🟡', tier: 3, powerRange: [45, 80] },
  4: { name: '钻石召唤', cost: 2500, label: '💎', tier: 4, powerRange: [80, 130] }
};

// ===== 世界观系统 =====
// 召唤前随机选定世界观，影响种族池和装备主题
var WORLD_SETTINGS = {
  warhammer: {
    name: '战锤',
    desc: '混沌荒原与人类帝国永恒征战的黑暗奇幻世界',
    humanoids: ['帝国人','矮人','高等精灵','暗黑精灵','木精灵','兽人','半兽人','巴托尼亚人','基斯里夫人','混沌战士','诺斯卡人','鼠人','吸血鬼','被遗忘者','震旦人','古墓守卫'],
    beasts: [
      {name:'座狼',scale:2,baseHP:90,naturalArmor:4,naturalWeapon:12,baseMorale:55,baseMovement:2,isFlying:false},
      {name:'战熊',scale:3,baseHP:150,naturalArmor:6,naturalWeapon:15,baseMorale:60,baseMovement:2,isFlying:false},
      {name:'狮鹫兽',scale:4,baseHP:120,naturalArmor:5,naturalWeapon:14,baseMorale:65,baseMovement:3,isFlying:true},
      {name:'双足飞龙',scale:5,baseHP:180,naturalArmor:7,naturalWeapon:18,baseMorale:55,baseMovement:3,isFlying:true},
      {name:'猛犸象',scale:6,baseHP:300,naturalArmor:8,naturalWeapon:20,baseMorale:50,baseMovement:2,isFlying:false},
      {name:'地狱犬',scale:2,baseHP:80,naturalArmor:3,naturalWeapon:14,baseMorale:50,baseMovement:3,isFlying:false},
      {name:'巨型蜘蛛',scale:2,baseHP:70,naturalArmor:2,naturalWeapon:10,baseMorale:45,baseMovement:3,isFlying:false}
    ]
  },
  middle_earth: {
    name: '中土',
    desc: '魔戒圣战时代的托尔金奇幻世界',
    humanoids: ['刚铎人','洛汗人','矮人','精灵','半身人','兽人','乌鲁克海','登丹人','登索德人','罗翰骑士'],
    beasts: [
      {name:'巨鹰',scale:3,baseHP:100,naturalArmor:4,naturalWeapon:14,baseMorale:70,baseMovement:4,isFlying:true},
      {name:'影爪马',scale:2,baseHP:120,naturalArmor:3,naturalWeapon:8,baseMorale:60,baseMovement:3,isFlying:false},
      {name:'战狼',scale:2,baseHP:80,naturalArmor:3,naturalWeapon:12,baseMorale:45,baseMovement:3,isFlying:false},
      {name:'恩特树须',scale:5,baseHP:250,naturalArmor:10,naturalWeapon:18,baseMorale:65,baseMovement:1,isFlying:false},
      {name:'蛛后裔',scale:3,baseHP:130,naturalArmor:5,naturalWeapon:16,baseMorale:55,baseMovement:2,isFlying:false}
    ]
  },
  dnd: {
    name: '龙与地下城',
    desc: '多元宇宙中的冒险者世界',
    humanoids: ['人类','矮人','高等精灵','木精灵','暗黑精灵','龙裔','提夫林','半身人','地精','兽人','半兽人','蜥蜴人','卓尔精灵','古墓守卫'],
    beasts: [
      {name:'狮鹫',scale:4,baseHP:120,naturalArmor:5,naturalWeapon:14,baseMorale:65,baseMovement:3,isFlying:true},
      {name:'双足飞龙',scale:5,baseHP:170,naturalArmor:6,naturalWeapon:17,baseMorale:50,baseMovement:3,isFlying:true},
      {name:'独角兽',scale:3,baseHP:110,naturalArmor:4,naturalWeapon:10,baseMorale:75,baseMovement:3,isFlying:false},
      {name:'地狱犬',scale:2,baseHP:80,naturalArmor:3,naturalWeapon:14,baseMorale:50,baseMovement:3,isFlying:false},
      {name:'巨魔',scale:4,baseHP:200,naturalArmor:5,naturalWeapon:18,baseMorale:55,baseMovement:2,isFlying:false},
      {name:'食人魔',scale:4,baseHP:180,naturalArmor:4,naturalWeapon:16,baseMorale:50,baseMovement:2,isFlying:false},
      {name:'牛头怪',scale:4,baseHP:160,naturalArmor:5,naturalWeapon:15,baseMorale:60,baseMovement:2,isFlying:false}
    ]
  },
  age_of_wonders: {
    name: '奇迹时代',
    desc: '众神陨落后的种族争霸世界',
    humanoids: ['人类','精灵','矮人','半身人','兽人','蜥蜴人','鼠人','暗黑精灵','高等精灵','龙裔','提夫林'],
    beasts: [
      {name:'巨龙',scale:6,baseHP:280,naturalArmor:10,naturalWeapon:22,baseMorale:70,baseMovement:4,isFlying:true},
      {name:'独角兽',scale:3,baseHP:110,naturalArmor:4,naturalWeapon:10,baseMorale:75,baseMovement:3,isFlying:false},
      {name:'梦魇兽',scale:3,baseHP:130,naturalArmor:5,naturalWeapon:14,baseMorale:55,baseMovement:3,isFlying:false},
      {name:'飞马',scale:2,baseHP:90,naturalArmor:3,naturalWeapon:8,baseMorale:65,baseMovement:4,isFlying:true},
      {name:'战熊',scale:3,baseHP:140,naturalArmor:6,naturalWeapon:15,baseMorale:60,baseMovement:2,isFlying:false}
    ]
  },
  warcraft: {
    name: '魔兽世界',
    desc: '艾泽拉斯联盟与部落的永恒战争',
    humanoids: ['人类','矮人','暗夜精灵','高等精灵','兽人','牛头人','巨魔','亡灵','血精灵','德莱尼','熊猫人','狼人','地精','半兽人'],
    beasts: [
      {name:'战狼',scale:2,baseHP:80,naturalArmor:3,naturalWeapon:12,baseMorale:50,baseMovement:3,isFlying:false},
      {name:'迅猛龙',scale:2,baseHP:70,naturalArmor:2,naturalWeapon:14,baseMorale:45,baseMovement:3,isFlying:false},
      {name:'飞龙',scale:4,baseHP:160,naturalArmor:6,naturalWeapon:16,baseMorale:55,baseMovement:3,isFlying:true},
      {name:'狮鹫',scale:3,baseHP:120,naturalArmor:5,naturalWeapon:14,baseMorale:65,baseMovement:3,isFlying:true},
      {name:'双足飞龙',scale:4,baseHP:150,naturalArmor:5,naturalWeapon:15,baseMorale:50,baseMovement:3,isFlying:true},
      {name:'虚空鳐',scale:2,baseHP:60,naturalArmor:2,naturalWeapon:10,baseMorale:45,baseMovement:4,isFlying:true}
    ]
  },
  elder_scrolls: {
    name: '上古卷轴',
    desc: '泰姆瑞尔大陆的帝国兴衰与龙裔传说',
    humanoids: ['帝国人','诺德人','红卫人','木精灵','高等精灵','暗黑精灵','兽人','亚龙人','卡吉特','帝国精灵','被遗忘者'],
    beasts: [
      {name:'战熊',scale:3,baseHP:150,naturalArmor:6,naturalWeapon:15,baseMorale:60,baseMovement:2,isFlying:false},
      {name:'猛犸',scale:6,baseHP:300,naturalArmor:8,naturalWeapon:20,baseMorale:50,baseMovement:2,isFlying:false},
      {name:'巨魔',scale:4,baseHP:200,naturalArmor:5,naturalWeapon:18,baseMorale:55,baseMovement:2,isFlying:false},
      {name:'荒野狼',scale:2,baseHP:80,naturalArmor:3,naturalWeapon:12,baseMorale:45,baseMovement:3,isFlying:false},
      {name:'剑齿虎',scale:3,baseHP:120,naturalArmor:4,naturalWeapon:16,baseMorale:55,baseMovement:3,isFlying:false},
      {name:'巨人',scale:5,baseHP:250,naturalArmor:6,naturalWeapon:20,baseMorale:60,baseMovement:2,isFlying:false}
    ]
  },
  european_medieval: {
    name: '欧洲中世纪',
    desc: '铁甲骑士与十字弓手争锋的中世纪战场',
    humanoids: ['法兰克骑士','英格兰长弓手','神圣罗马步兵','诺曼征服者','拜占庭甲胄骑兵','威尔士盾兵','哥萨克骑兵','瑞士长枪兵','威尼斯弩手','条顿骑士'],
    beasts: [
      {name:'战马',scale:2,baseHP:100,naturalArmor:3,naturalWeapon:6,baseMorale:60,baseMovement:3,isFlying:false},
      {name:'猎犬',scale:1,baseHP:60,naturalArmor:2,naturalWeapon:8,baseMorale:50,baseMovement:3,isFlying:false},
      {name:'猎鹰',scale:1,baseHP:45,naturalArmor:1,naturalWeapon:10,baseMorale:50,baseMovement:4,isFlying:true}
    ]
  },
  ancient_china: {
    name: '中国古代',
    desc: '华夏千年征战与兵法韬略的世界',
    humanoids: ['汉军步卒','唐朝府兵','明朝边军','秦锐士','宋禁军','蒙古骑兵','八旗甲喇','戚家军','锦衣卫','玄甲军','白杆兵'],
    beasts: [
      {name:'战象',scale:5,baseHP:250,naturalArmor:7,naturalWeapon:18,baseMorale:55,baseMovement:2,isFlying:false},
      {name:'战马',scale:2,baseHP:100,naturalArmor:3,naturalWeapon:6,baseMorale:60,baseMovement:3,isFlying:false},
      {name:'猎犬',scale:1,baseHP:60,naturalArmor:2,naturalWeapon:8,baseMorale:50,baseMovement:3,isFlying:false},
      {name:'猛虎',scale:3,baseHP:150,naturalArmor:5,naturalWeapon:16,baseMorale:55,baseMovement:3,isFlying:false}
    ]
  }
};

var WORLD_KEYS = Object.keys(WORLD_SETTINGS);

// 随机选定世界观（优先匹配自定义描述中的关键字）
function pickRandomWorld(customDesc) {
  if (customDesc && customDesc.trim()) {
    var desc = customDesc.toLowerCase();
    // 关键字到世界观的映射
    var keywordMap = [
      { keys: ['三国', '虎豹骑', '白马', '东汉', '曹操', '刘备', '孙权', '吕布', '关羽', '赤壁', '官渡', '诸葛', '中原', '华夏'], world: 'ancient_china' },
      { keys: ['秦', '汉武', '长城', '匈奴', '大秦'], world: 'ancient_china' },
      { keys: ['唐朝', '唐', '玄甲', '府兵', '安西'], world: 'ancient_china' },
      { keys: ['战锤', '混沌', '帝国', '巴托', '纳垢', '恐虐', '奸奇', '色孽', '西格玛', '中古'], world: 'warhammer' },
      { keys: ['中土', '魔戒', '指环王', '刚铎', '摩多', '精灵', '矮人', '霍比特', '索伦', '甘道夫'], world: 'middle_earth' },
      { keys: ['dnd', '龙与地下城', '费伦', '被遗忘的国度', '剑湾', '深水城', '柏德', '无冬'], world: 'dnd' },
      { keys: ['奇迹时代', 'age of wonder', '精灵', '矮人', '龙人', '神裔'], world: 'age_of_wonders' },
      { keys: ['魔兽', 'wow', '艾泽拉斯', '部落', '联盟', '兽人', '亡灵', '牛头', '巨魔', '暗夜', '血精灵', '德莱尼', '熊猫'], world: 'warcraft' },
      { keys: ['上古卷轴', '天际', '晨风', '湮灭', '诺德', '帝国人', '龙裔'], world: 'elder_scrolls' },
      { keys: ['欧洲', '骑士', '城堡', '领主', '十字军', '法兰西', '英格', '神圣罗马', '拜占庭', '威尼斯', '条顿'], world: 'european_medieval' },
      { keys: ['蒙古', '草原', '铁骑', '成吉思', '元'], world: 'european_medieval' }
    ];
    for (var i = 0; i < keywordMap.length; i++) {
      for (var j = 0; j < keywordMap[i].keys.length; j++) {
        if (desc.indexOf(keywordMap[i].keys[j]) >= 0) {
          var matchedKey = keywordMap[i].world;
          return { key: matchedKey, world: WORLD_SETTINGS[matchedKey] };
        }
      }
    }
  }
  var key = WORLD_KEYS[Math.floor(Math.random() * WORLD_KEYS.length)];
  var world = WORLD_SETTINGS[key];
  return { key: key, world: world };
}

var BEAST_BG_KEYWORDS = ['野性', '凶猛', '忠诚', '迅捷', '嗜血', '群居', '孤傲', '狡猾', '残暴', '坚韧'];

var SUMMON_ID_COUNTER = 100;

function genSummonId(prefix) {
  return prefix + (SUMMON_ID_COUNTER++) + '_' + Math.random().toString(36).substring(2, 6);
}

// ===== 战力计算（遵循规则文档步骤五的标杆对抗公式）=====
// 标杆：甲10，武器基础15/破甲5，人数160
function calculatePowerIndex(stats) {
  if (!stats || !stats.race) return 0;
  var mw = stats.mainWeapon;
  var unitCount = stats.unitCount || 1;
  var totalHP = stats.totalHP || 0;
  var totalArmor = stats.totalArmor || 0;
  var attackRange = stats.attackRange || 1;
  var allowedRange = stats.allowedRange || 1;
  var rangedResist = stats.rangedResist || 0;
  var unitScale = stats.unitScale || 1;

  // === 进攻效能分 ===
  var baseDmg = mw ? mw.baseDamage : (stats.race.naturalWeapon || 5);
  var armorPierce = mw ? mw.armorPierce : 0;
  // 实际伤害 = max(主武器基础杀伤 - 10, 破甲值)
  var actualDmg = Math.max(baseDmg - 10, armorPierce);
  // 距离系数：近战1，远程每格射程+0.5
  var distCoeff = (allowedRange > 1) ? (1 + (allowedRange - 1) * 0.5) : 1;
  var offenseScore = actualDmg * attackRange * distCoeff * unitCount;

  // === 生存效能分 ===
  // 标杆实际伤害 = max(15 - 当前护甲, 5)
  var stdDmg = Math.max(15 - totalArmor, 5);
  // 围攻人数：规模≥6 失去围攻保护(160)，否则 min(160, 人数*10)
  var surroundCount = (unitScale >= 6) ? 160 : Math.min(160, unitCount * 10);
  var roundDmg = stdDmg * surroundCount;
  var survivalScore = (roundDmg > 0) ? (totalHP / roundDmg) * 160 * (1 + rangedResist) : 0;

  // === 最终战力指数 ===
  return Math.floor((offenseScore + survivalScore) / 100);
}

// ===== 随机种族基底生成器 =====
// 最大规模限制：种族+坐骑 ≤ 16，不生成 titan 巨兽

function generateRandomRace(tier, customDesc) {
  var worldInfo = pickRandomWorld(customDesc);
  var world = worldInfo.world;
  // 有自定义描述时：强制人型种族（用户指定的是具体军队而非野兽）
  var poolRoll = Math.random();
  var isBeast = poolRoll >= 0.7;
  var raceData = null;
  var _baseId = null;

  if (isBeast) {
    // 从世界观野兽池随机选
    var beast = world.beasts[Math.floor(Math.random() * world.beasts.length)];
    _baseId = 'beast_' + worldInfo.key + '_' + beast.name;
    raceData = {
      name: beast.name,
      scale: beast.scale,
      typeLabel: beast.isFlying ? '飞行野兽' : (beast.scale <= 1 ? '小型野兽' : (beast.scale <= 3 ? '中型野兽' : '大型野兽')),
      baseHP: beast.baseHP,
      naturalArmor: beast.naturalArmor,
      naturalWeapon: beast.naturalWeapon,
      baseMorale: beast.baseMorale,
      baseMovement: beast.baseMovement,
      attackRange: 1,
      _isFlying: beast.isFlying
    };
  } else {
    // 从世界观人型池随机选
    var humanoidName = world.humanoids[Math.floor(Math.random() * world.humanoids.length)];
    _baseId = 'humanoid_' + worldInfo.key + '_' + humanoidName;
    // 人型种族用默认属性（类似human）
    raceData = {
      name: humanoidName,
      scale: 1,
      typeLabel: '常规体型',
      baseHP: 100,
      naturalArmor: 3,
      naturalWeapon: 3,
      baseMorale: 60,
      baseMovement: 1,
      attackRange: 1
    };
  }

  var tierMult = [0.5, 1, 1.6, 2.4][tier - 1] || 1;
  // HP单独设定更平缓的倍率，保证各品阶在100~200区间
  var hpMult = [1.0, 1.2, 1.4, 1.7][tier - 1] || 1;
  function randAround(base, variance) {
    variance = variance || 0.25;
    return Math.max(1, Math.round(base * (1 - variance + Math.random() * variance * 2)));
  }

  // 士气随品阶分层：黑铁低士气 → 钻石高士气
  var moraleRanges = {
    1: { min: 38, max: 58 },
    2: { min: 45, max: 65 },
    3: { min: 55, max: 78 },
    4: { min: 65, max: 88 }
  };
  var mr = moraleRanges[tier] || moraleRanges[1];

  var race = {
    id: 'race_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
    _baseId: _baseId,
    _isBeast: isBeast, // 关键：标记是否野兽
    _isFlying: raceData._isFlying, // 飞行野兽标记（人型为undefined）
    _worldKey: worldInfo.key,
    _worldName: world.name,
    name: raceData.name,
    scale: raceData.scale,
    baseHP: randAround(raceData.baseHP * hpMult, 0.18),
    naturalArmor: randAround(raceData.naturalArmor * tierMult),
    naturalWeapon: randAround(raceData.naturalWeapon * tierMult),
    baseMorale: Math.min(95, Math.max(25, Math.round(mr.min + Math.random() * (mr.max - mr.min)))),
    baseMovement: raceData.baseMovement,
    attackRange: raceData.attackRange || 1,
    typeLabel: raceData.typeLabel,
    _summoned: true
  };
  return race;
}

// ===== 主入口：调用 AI API 生成完整兵团 =====
function summonUnit(tier, customDesc, callback) {
  var t = SUMMON_TIERS[tier] || SUMMON_TIERS[1];
  if (!ED || !UD) { callback({ error: '数据引擎未就绪' }); return; }

  var race, isCustom = customDesc && customDesc.trim();

  if (isCustom) {
    // 有自定义描述时：创建通用人型种族，让 AI 自行从描述中推理种族和世界观
    race = {
      id: 'race_custom_' + Date.now(),
      _isBeast: false,
      _worldKey: '',
      _worldName: '',
      name: '人类',
      scale: 1,
      baseHP: 100,
      naturalArmor: 3,
      naturalWeapon: 3,
      baseMorale: 60,
      baseMovement: 1,
      attackRange: 1,
      typeLabel: '常规体型',
      _summoned: true
    };
  } else {
    race = generateRandomRace(tier, customDesc);
  }

  var model = GameState.summonModel || 'deepseek-v4-flash';

  fetch('/api/summon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tier: tier,
      tierName: t.name,
      race: race.name,
      worldName: race._worldName || '',
      worldDesc: (WORLD_SETTINGS[race._worldKey] || {}).desc || '',
      model: model,
      customDesc: customDesc || ''
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(ai) {
    if (ai.error) { callback({ error: ai.error }); return; }

    // 把随机生成的种族加入数据中心
    var existingRace = getRace(race.id);
    if (!existingRace) {
      if (!RD) RD = { races: [] };
      RD.races.push(race);
    }

    // 解析AI返回的兵种类型
    var unitTypeMap = { '步兵': 'infantry', '骑兵': 'cavalry', '远程兵': 'archer', '空军': 'flying' };
    var rawType = ai.type || '步兵';
    if (rawType.indexOf('弓') >= 0 || rawType.indexOf('远') >= 0) rawType = '远程兵';
    else if (rawType.indexOf('骑') >= 0) rawType = '骑兵';
    else if (rawType.indexOf('飞') >= 0 || rawType.indexOf('空') >= 0) rawType = '空军';
    else rawType = '步兵';
    var baseType = unitTypeMap[rawType] || 'infantry';
    var typeNames = { infantry:'步兵', cavalry:'骑兵', archer:'远程兵', flying:'空军', beast_infantry:'野兽步兵', beast_flying:'野兽空军' };
    var typeIcons = { infantry:'🛡️', cavalry:'🐴', archer:'🏹', flying:'🦅', beast_infantry:'🐺', beast_flying:'🦅' };

    // ===== 装备属性计算 =====
    var isBeast = race._isBeast === true;
    var sizeCategory;
    if (isBeast) {
      if (race.scale <= 1) sizeCategory = '小型';
      else if (race.scale <= 3) sizeCategory = '中型';
      else sizeCategory = '大型';
    } else {
      if (race.scale <= 3) sizeCategory = '中型';
      else sizeCategory = '大型';
    }

    // 野兽名字和背景生成
    if (isBeast) {
      var groupName = race.name + '群';
      if (!ai.name || ai.name.length < 2 || ai.name.indexOf('兵团') >= 0 || ai.name.indexOf('士兵') >= 0) {
        ai.name = groupName;
      }
      if (!ai.background || ai.background.length < 2 || ai.background.indexOf('兵团') >= 0 || ai.background.indexOf('士兵') >= 0 || ai.background.indexOf('军队') >= 0) {
        var bgKw1 = BEAST_BG_KEYWORDS[Math.floor(Math.random() * BEAST_BG_KEYWORDS.length)];
        var bgKw2 = BEAST_BG_KEYWORDS[Math.floor(Math.random() * BEAST_BG_KEYWORDS.length)];
        while (bgKw2 === bgKw1) {
          bgKw2 = BEAST_BG_KEYWORDS[Math.floor(Math.random() * BEAST_BG_KEYWORDS.length)];
        }
        ai.background = '一群' + bgKw1 + '而' + bgKw2 + '的' + race.name + '，来自' + race._worldName + '世界观，在战场上令人闻风丧胆';
      }
    } else {
      // 人型单位名字兜底（防止AI输出空名字导致"无名兵团"）
      if (!ai.name || ai.name.length < 2) {
        ai.name = race.name + '精锐兵团';
      }
    }

    var wpType, wpHanded, wpDmg, wpAP, wpEffects, wpAllowedRange, wpAttackRange, wpCategory;
    var mwId = null, mainWeaponDef = null;

    if (isBeast) {
      // 野兽不生成武器，使用天然武器
      wpType = null;
      wpHanded = null;
      wpDmg = 0;
      wpAP = 0;
      wpEffects = [];
      wpAllowedRange = 1;
      wpAttackRange = 1;
      wpCategory = null;
    } else {
      wpType = ai.weaponType || 'short';
      var isRanged = wpType === 'bow' || wpType === 'crossbow';

      // 使用 AI 返回的数值，如果 AI 没返回则用简单兜底公式
      var aiDmg = parseInt(ai.weaponDamage) || 0;
      var aiAP = parseInt(ai.armorPierce) || 0;
      // 兜底：如果 AI 没输出数值，用简单公式保障不崩
      if (aiDmg <= 0) aiDmg = 8 + tier * 5;
      if (aiAP <= 0) {
        var apFallback = { 'long': 1.5, 'bow': 1.0, 'crossbow': 2.0 };
        aiAP = Math.floor(tier * (apFallback[wpType] || 2.0) + 1);
      }

      // AI指定武器效果（如"迅捷"），按逗号分隔
      var customEffects = [];
      if (ai.weaponEffects && typeof ai.weaponEffects === 'string' && ai.weaponEffects.trim()) {
        customEffects = ai.weaponEffects.split(/[,，]/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
      }
      var defaultTypeEffects = getWeaponEffectsByType(wpType);
      var wpEffects = [];
      defaultTypeEffects.forEach(function(e) { if (wpEffects.indexOf(e) < 0) wpEffects.push(e); });
      customEffects.forEach(function(e) { if (wpEffects.indexOf(e) < 0) wpEffects.push(e); });

      if (wpType === 'long') {
        wpHanded = 'two-handed';
        wpDmg = aiDmg;
        wpAP = aiAP;
        wpAllowedRange = 1; wpAttackRange = 1; wpCategory = '近战武器';
      } else if (wpType === 'bow' || wpType === 'crossbow') {
        wpHanded = wpType === 'bow' ? 'two-handed' : (tier <= 2 ? 'one-handed' : 'two-handed');
        var aiRange = parseInt(ai.weaponRange) || 0;
        var rangeOpts = tier === 1 ? [2] : (tier >= 4 ? [2,3,4] : [2,3]);
        if (rangeOpts.indexOf(aiRange) >= 0) wpAllowedRange = aiRange;
        else wpAllowedRange = rangeOpts[0];
        
        // AI 返回的远程伤害如果是设了射距衰减后的值，直接使用
        wpDmg = aiDmg;
        wpAP = aiAP;
        wpAttackRange = 1; wpCategory = '远程武器';
      } else {
        wpHanded = customEffects.indexOf('迅捷') >= 0 ? 'one-handed' : (Math.random() < 0.5 ? 'one-handed' : 'two-handed');
        wpDmg = aiDmg;
        wpAP = aiAP;
        wpAllowedRange = 1; wpAttackRange = 1; wpCategory = '近战武器';
      }
      // AI没返回武器名时用简单兜底
      if (!ai.weaponName || ai.weaponName.length < 2) {
        var weaponBaseNames = {
          long: ['长矛','长戈','战戟','骑枪'],
          short: ['长剑','战斧','战锤','弯刀'],
          bow: ['长弓','战弓','猎弓'],
          crossbow: ['劲弩','重弩','轻弩']
        };
        var baseList = weaponBaseNames[wpType] || weaponBaseNames.short;
        ai.weaponName = baseList[Math.floor(Math.random() * baseList.length)];
      }
    }

    var arDefense, arMobility, arCategory, arForScale;
    var aiArmorType = (ai.armorType || '').trim();
    if (aiArmorType !== '轻甲' && aiArmorType !== '中甲' && aiArmorType !== '重甲') {
      aiArmorType = ['轻甲','中甲','重甲'][Math.floor(Math.random() * 3)];
    }

    // 使用 AI 返回的护甲防御值，如果 AI 没返回则用简单兜底公式
    var aiArmDef = parseInt(ai.armorDefense) || 0;
    if (aiArmDef <= 0) {
      var armFallback = { '重甲': 7, '中甲': 4, '轻甲': 3 };
      aiArmDef = (armFallback[aiArmorType] || 4) + tier * 3;
    }

    if (isBeast) {
      arCategory = aiArmorType;
      arDefense = aiArmDef;
      arMobility = 0;
      arForScale = [sizeCategory];
      if (!ai.armorName || ai.armorName.length < 2) {
        var armorTypeNames = { '轻甲': '皮甲', '中甲': '锁甲', '重甲': '板甲' };
        var armorBaseName = armorTypeNames[aiArmorType] || '皮甲';
        ai.armorName = (sizeCategory || '中型') + armorBaseName;
      }
    } else {
      arCategory = aiArmorType;
      arDefense = aiArmDef;
      arMobility = (arCategory === '重甲') ? -1 : (arCategory === '中甲' && tier >= 3 ? -1 : 0);
      arForScale = null;
      if (!ai.armorName || ai.armorName.length < 2) ai.armorName = arCategory;
    }

    // 坐骑判定（野兽无坐骑）
    var hasMount = !isBeast && ai.mountName && ai.mountName !== '无' && ai.mountName !== '无坐骑';
    var isFlying = baseType === 'flying' || (hasMount && (ai.mountName.indexOf('狮鹫') >= 0 || ai.mountName.indexOf('鹰') >= 0 || ai.mountName.indexOf('翼') >= 0 || ai.mountName.indexOf('飞') >= 0));
    
    // 野兽兵种类型判断
    if (isBeast) {
      if (race._isFlying) {
        baseType = 'beast_flying';
      } else {
        baseType = 'beast_infantry';
      }
    } else {
      if (isFlying) baseType = 'flying';
      if (baseType === 'cavalry' && !hasMount) baseType = 'infantry';
      if (baseType === 'flying' && !hasMount) baseType = 'infantry';
    }
    
    var typeName = typeNames[baseType], typeIcon = typeIcons[baseType];

    if (!GameState._summonedData) GameState._summonedData = { races: [], weapons: [], shields: [], armors: [], mounts: [], units: [] };
    if (!GameState._summonedData.races) GameState._summonedData.races = [];
    if (!GameState._summonedData.shields) GameState._summonedData.shields = [];
    if (!GameState._summonedData.weapons) GameState._summonedData.weapons = [];
    if (!GameState._summonedData.armors) GameState._summonedData.armors = [];
    if (!GameState._summonedData.mounts) GameState._summonedData.mounts = [];
    if (!GameState._summonedData.units) GameState._summonedData.units = [];
    GameState._summonedData.races.push(race);

    // 主武器（野兽不生成武器）
    var equipTierMap = { 1: 'iron', 2: 'bronze', 3: 'gold', 4: 'diamond' };
    var equipTierStr = equipTierMap[tier] || 'iron';
    if (!isBeast) {
      mwId = genSummonId('SW');
      // 骑射手/远程空军武器追加"骑射"效果
      if ((baseType === 'cavalry' || baseType === 'flying') && (wpType === 'bow' || wpType === 'crossbow')) {
        if (wpEffects.indexOf('骑射') < 0) wpEffects.push('骑射');
      }

      // 武器适用范围：弓/弩→远程兵+空军，近战→步兵+骑兵+空军（远程兵和野兽除外）
      var wpForUnits;
      if (wpType === 'bow' || wpType === 'crossbow') {
        wpForUnits = ['远程兵', '空军'];
      } else {
        wpForUnits = ['步兵', '骑兵', '空军'];
      }
      mainWeaponDef = {
        id: mwId, name: ai.weaponName || '未名武器',
        tier: equipTierStr,
        category: wpCategory, type: wpType,
        handed: wpHanded,
        slot: 'main', baseDamage: wpDmg, armorPierce: wpAP,
        attackRange: wpAttackRange, allowedRange: wpAllowedRange,
        forUnits: wpForUnits, effects: wpEffects,
        desc: ai.weaponDesc || (ai.weaponName + '（' + SUMMON_TIERS[tier].name + '品阶召唤）'), _summoned: true
      };
      ED.weapons.push(mainWeaponDef);
      GameState._summonedData.weapons.push(mainWeaponDef);
    }

    // 盾牌：AI根据背景决定是否有盾牌及名字（双手武器不配盾）
    var shId = null, shieldDef = null;
    var aiShieldName = (ai.shieldName || '无').trim();
    var hasShield = !isBeast && wpHanded === 'one-handed' &&
      aiShieldName && aiShieldName !== '无' && aiShieldName !== '无盾牌' && aiShieldName.length >= 2;
    if (hasShield) {
      shId = genSummonId('SH');
      shieldDef = {
        id: shId, name: aiShieldName, category: '盾牌',
        tier: equipTierStr,
        defense: Math.floor(tier * 1.5),
        forUnits: ['全兵种'],
        effects: ['远程免伤+' + (10 + tier * 10) + '%'],
        desc: ai.shieldDesc || (aiShieldName + '（' + SUMMON_TIERS[tier].name + '品阶召唤）'), _summoned: true
      };
      if (!ED.shields) ED.shields = [];
      ED.shields.push(shieldDef);
      if (!GameState._summonedData.shields) GameState._summonedData.shields = [];
      GameState._summonedData.shields.push(shieldDef);
    }

    // 护甲
    var arId = genSummonId('SA');
    var armorDef = {
      id: arId, name: ai.armorName || '未名护甲',
      tier: equipTierStr,
      category: arCategory, defense: arDefense,
      mobilityPenalty: arMobility,
      forUnits: ['全兵种'], effects: [],
      desc: ai.armorDesc || ((ai.armorName || '未名护甲') + '（' + SUMMON_TIERS[tier].name + '品阶召唤）'), _summoned: true
    };
    if (arForScale) {
      armorDef.forScale = arForScale;
    }
    ED.armors.push(armorDef);
    GameState._summonedData.armors.push(armorDef);

    // 坐骑：规模受限于 16 - race.scale（野兽无坐骑）
    var mountId = null, mountScale = 0;
    if (hasMount) {
      mountId = genSummonId('SM');
      var maxMountScale = 16 - race.scale; // 种族+坐骑 ≤ 16
      if (isFlying) {
        mountScale = Math.min(7, maxMountScale);
      } else if (tier >= 3) {
        mountScale = Math.min(4 + Math.floor(Math.random() * 2), maxMountScale); // 4~5
      } else {
        mountScale = Math.min(Math.random() < 0.3 ? 3 : 1, maxMountScale);
      }
      mountScale = Math.max(1, mountScale); // 至少1
      var mountDef = {
        id: mountId, name: ai.mountName,
        tier: equipTierStr,
        type: mountScale >= 7 ? '大型' : (mountScale >= 3 ? '中型' : '小型'),
        scale: mountScale,
        bonusHP: mountScale * 100,
        bonusArmor: tier * 2,
        bonusMove: isFlying ? 4 : (mountScale >= 3 ? 3 : 2),
        forUnits: baseType === 'flying' ? ['空军'] : ['骑兵'],
        effects: isFlying ? ['飞行能力', '空中震慑'] : [],
        desc: ai.mountDesc || (ai.mountName + '（' + SUMMON_TIERS[tier].name + '品阶召唤）'), _summoned: true
      };
      ED.mounts.push(mountDef);
      GameState._summonedData.mounts.push(mountDef);
    }

    // 规模：骑兵单体规模 = 坐骑规模 + 种族规模，总容量红线 160
    var finalUnitScale = race.scale + mountScale;
    var unitCount = Math.max(1, Math.floor(160 / finalUnitScale));

    // 构建 unitDef
    var unitId = genSummonId('U');
    var uniqueType = baseType + '_' + unitId;
    var unitDef = {
      id: unitId, name: ai.name || '无名兵团',
      race: { id: race.id, name: race.name },
      background: ai.background || '异世界的神秘来客',
      belief: ai.belief || '荣誉与胜利',
      type: uniqueType, baseType: baseType, typeName: typeName,
      image: (function() {
        var tierMap = { 1: 'iron', 2: 'bronze', 3: 'gold', 4: 'diamond' };
        var tierStr = tierMap[tier] || 'iron';
        if (typeof getUnitImagePath === 'function') {
          return getUnitImagePath(tierStr, baseType, race._worldKey);
        }
        var iconName;
        if (baseType === 'beast_infantry' || baseType === 'beast_flying') {
          iconName = 'beast';
        } else if (baseType === 'infantry') iconName = 'melee';
        else if (baseType === 'archer') iconName = 'ranged';
        else iconName = baseType;
        return 'assets/images/icon_' + tierStr + '_' + iconName + '.png';
      })(), icon: typeIcon,
      unitCount: unitCount,
      equipment: { mainWeapon: mwId, shield: shId, armor: arId, mount: mountId },
      _summoned: true, _summonTier: tier, powerIndex: 0
    };

    // 骑射手标记
    if (baseType === 'cavalry' && (wpType === 'bow' || wpType === 'crossbow')) {
      unitDef._mountedArcher = true;
    }
    // 远程空军标记
    if (baseType === 'flying' && (wpType === 'bow' || wpType === 'crossbow')) {
      unitDef._rangedFlying = true;
    }

    // ===== 战力分段校准（步骤五）=====
    var st = computeStats(unitDef);
    if (st) {
      st.unitCount = unitCount;
      st.unitScale = finalUnitScale;
      var power = calculatePowerIndex(st);
      var targetMin = t.powerRange[0];
      var targetMax = t.powerRange[1];

      // 战力过低：提升武器伤害和血量（野兽提升天然武器和血量）
      if (power < targetMin) {
        var ratio = targetMin / Math.max(power, 1);
        var boost = Math.min(ratio, 3.0); // 最多提升3倍
        if (mainWeaponDef) {
          mainWeaponDef.baseDamage = Math.round(mainWeaponDef.baseDamage * boost);
        } else {
          race.naturalWeapon = Math.round(race.naturalWeapon * boost);
        }
        race.baseHP = Math.round(race.baseHP * boost);
        st = computeStats(unitDef);
        if (st) { st.unitCount = unitCount; st.unitScale = finalUnitScale; }
        power = calculatePowerIndex(st);
      }
      // 战力过高：削减武器伤害和血量（野兽削减天然武器和血量）
      if (power > targetMax) {
        var cutRatio = targetMax / power;
        if (mainWeaponDef) {
          mainWeaponDef.baseDamage = Math.max(1, Math.round(mainWeaponDef.baseDamage * cutRatio));
        } else {
          race.naturalWeapon = Math.max(1, Math.round(race.naturalWeapon * cutRatio));
        }
        race.baseHP = Math.max(1, Math.round(race.baseHP * cutRatio));
        st = computeStats(unitDef);
        if (st) { st.unitCount = unitCount; st.unitScale = finalUnitScale; }
        power = calculatePowerIndex(st);
      }
      unitDef.powerIndex = power;
    }

    UD.units.push(unitDef);
    GameState._summonedData.units.push(unitDef);

    var summary = {
      name: ai.name, type: baseType, typeName: typeName, icon: typeIcon,
      race: race.name, unitCount: unitCount, unitScale: finalUnitScale,
      tier: tier, tierLabel: t.label, tierName: t.name, cost: t.cost,
      weaponName: isBeast ? '无（天然武器）' : ai.weaponName,
      armorName: ai.armorName,
      mountName: hasMount ? ai.mountName : '无',
      background: ai.background || '异世界的神秘来客', belief: ai.belief || '荣誉与胜利',
      shieldName: isBeast ? '无' : (shieldDef ? shieldDef.name : '无'),
      weaponHanded: isBeast ? null : wpHanded
    };
    if (st) {
      summary.hp = st.totalHP; summary.hpPerUnit = st.hpPerUnit;
      summary.armor = st.totalArmor;
      summary.atk = st.mainWeapon ? st.mainWeapon.baseDamage : race.naturalWeapon;
      summary.ap = st.mainWeapon ? st.mainWeapon.armorPierce : 0;
      summary.atkRange = st.attackRange; summary.allowedRange = st.allowedRange;
      summary.move = st.movement; summary.morale = st.morale;
      summary.power = unitDef.powerIndex;
      summary.rangedResist = Math.round(st.rangedResist * 100);
    }

    callback({ result: { unitDef: unitDef, summary: summary } });
  })
  .catch(function(e) {
    callback({ error: '连接召唤服务器失败，请先运行 node server.js' });
  });
}

// ===== 执行召唤（扣分+调用AI+入库+存档）=====
function executeSummon(tier, customDesc, callback) {
  var t = SUMMON_TIERS[tier];
  if (!t) { callback({ error: '无效召唤档次' }); return; }
  if (getPlayerPoints() < t.cost) { callback({ error: '积分不足，需要 ' + t.cost + ' 积分' }); return; }

  GameState.points -= t.cost;

  // 发出积分变更事件
  if (typeof EventBus !== 'undefined' && EventBus.emit) {
    EventBus.emit('points:changed', { points: GameState.points, delta: -t.cost });
  }

  summonUnit(tier, customDesc, function(res) {
    if (res.error) {
      GameState.points += t.cost;
      // 发出积分变更事件（回退）
      if (typeof EventBus !== 'undefined' && EventBus.emit) {
        EventBus.emit('points:changed', { points: GameState.points, delta: t.cost });
      }
      callback(res);
      return;
    }

    var result = res.result;
    var unitId = 's_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    var newPlayerUnit = {
      id: unitId, type: result.unitDef.type, name: result.summary.name
    };
    GameState.playerUnits.push(newPlayerUnit);

    // 发出玩家部队变更事件
    if (typeof EventBus !== 'undefined' && EventBus.emit) {
      EventBus.emit('unit:added', newPlayerUnit);
    }

    if (!UNIT_TIER_CONFIG[result.unitDef.type]) {
      var tierMap = { 1: 'iron', 2: 'bronze', 3: 'gold', 4: 'diamond' };
      var tierId = tierMap[tier] || 'iron';
      var tColor = typeof getTierColor === 'function' ? getTierColor(tierId) : '#4a4a4a';
      var tName = typeof getTierName === 'function' ? getTierName(tierId) : '黑铁';
      var tierLabels = { iron: '⚫', bronze: '🟤', gold: '🟡', diamond: '💎' };
      UNIT_TIER_CONFIG[result.unitDef.type] = {
        tier: tierId,
        tierName: tName,
        tierLabel: (tierLabels[tierId] || '⚫') + ' ' + tName,
        price: t.cost,
        desc: (result.summary.background || '异世界的神秘来客').substring(0, 30) + '...',
        color: tColor,
        bgColor: typeof hexToRgba === 'function' ? hexToRgba(tColor, 0.15) : 'rgba(74,74,74,0.15)'
      };
    }

    saveToBrowser(GameState.saveName);
    callback({ result: result });
  });
}

// ===== 注入/清除 =====
function injectSummonedData() {
  if (!GameState._summonedData) return;
  var d = GameState._summonedData;
  if (!RD) RD = { races: [] };
  if (!ED) ED = { weapons: [], shields: [], armors: [], mounts: [] };
  if (!UD) UD = { units: [] };
  if (d.races) d.races.forEach(function(r) {
    r._summoned = true;
    if (!RD.races.find(function(x) { return x.id === r.id; })) RD.races.push(r);
  });
  if (d.weapons) d.weapons.forEach(function(w) {
    w._summoned = true;
    ED.weapons.push(w);
  });
  if (d.shields) d.shields.forEach(function(s) {
    s._summoned = true;
    ED.shields.push(s);
  });
  if (d.armors) d.armors.forEach(function(a) {
    a._summoned = true;
    ED.armors.push(a);
  });
  if (d.mounts) d.mounts.forEach(function(m) {
    m._summoned = true;
    ED.mounts.push(m);
  });
  if (d.units) d.units.forEach(function(u) {
    if (u._levelBattleTemp || u._aiBattleTemp) return;
    // 跳过已被玩家清理的部队类型
    if (GameState._hiddenShopUnitTypes && GameState._hiddenShopUnitTypes.indexOf(u.type) >= 0) return;
    u._summoned = true;
    UD.units.push(u);
  });
}
function clearSummonedData() {
  if (RD && RD.races) RD.races = RD.races.filter(function(r) { return !r._summoned; });
  if (ED && ED.weapons) ED.weapons = ED.weapons.filter(function(w) { return !w._summoned; });
  if (ED && ED.shields) ED.shields = ED.shields.filter(function(s) { return !s._summoned; });
  if (ED && ED.armors) ED.armors = ED.armors.filter(function(a) { return !a._summoned; });
  if (ED && ED.mounts) ED.mounts = ED.mounts.filter(function(m) { return !m._summoned; });
  if (UD && UD.units) UD.units = UD.units.filter(function(u) { return !u._summoned; });
}

// ===== 背包装备注入/清除 =====
function injectInventoryToED() {
  if (!GameState.inventory) return;
  var inv = GameState.inventory;
  if (!ED) ED = { weapons: [], shields: [], armors: [], mounts: [] };
  if (!ED.shields) ED.shields = [];
  var marker = '_fromInventory';
  if (inv.weapons) inv.weapons.forEach(function(w) {
    var exists = ED.weapons.find(function(x) { return x.id === w.id; });
    if (!exists) {
      w[marker] = true;
      ED.weapons.push(w);
    }
  });
  if (inv.shields) inv.shields.forEach(function(s) {
    var exists = ED.shields.find(function(x) { return x.id === s.id; });
    if (!exists) {
      s[marker] = true;
      ED.shields.push(s);
    }
  });
  if (inv.armors) inv.armors.forEach(function(a) {
    var exists = ED.armors.find(function(x) { return x.id === a.id; });
    if (!exists) {
      a[marker] = true;
      ED.armors.push(a);
    }
  });
  if (inv.mounts) inv.mounts.forEach(function(m) {
    var exists = ED.mounts.find(function(x) { return x.id === m.id; });
    if (!exists) {
      m[marker] = true;
      ED.mounts.push(m);
    }
  });
}
function clearInventoryFromED() {
  if (ED && ED.weapons) ED.weapons = ED.weapons.filter(function(w) { return !w._fromInventory; });
  if (ED && ED.shields) ED.shields = ED.shields.filter(function(s) { return !s._fromInventory; });
  if (ED && ED.armors) ED.armors = ED.armors.filter(function(a) { return !a._fromInventory; });
  if (ED && ED.mounts) ED.mounts = ED.mounts.filter(function(m) { return !m._fromInventory; });
}

window.SUMMON_TIERS = SUMMON_TIERS;
window.calculatePowerIndex = calculatePowerIndex;
window.executeSummon = executeSummon;
window.injectSummonedData = injectSummonedData;
window.clearSummonedData = clearSummonedData;
window.injectInventoryToED = injectInventoryToED;
window.clearInventoryFromED = clearInventoryFromED;
