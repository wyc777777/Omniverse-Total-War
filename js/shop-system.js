// AI路径引导：如需查找相关代码路径，请先查阅 AI_PATH_GUIDE.md
// 每新增/修改一个文件后必须同步更新 AI_PATH_GUIDE.md
// ==================== 商城系统 ====================
// 兵团购买与积分管理

// ==================== 商城事件监听初始化 ====================
(function() {
  var _shopRefreshTimer = null;
  var _pointsRefreshTimer = null;

  function debounceShopRefresh() {
    if (_shopRefreshTimer) clearTimeout(_shopRefreshTimer);
    _shopRefreshTimer = setTimeout(function() {
      if (typeof currentPage !== 'undefined' && currentPage === 'Shop' && typeof buildShop === 'function') {
        buildShop();
      }
    }, 100);
  }

  function debouncePointsRefresh() {
    if (_pointsRefreshTimer) clearTimeout(_pointsRefreshTimer);
    _pointsRefreshTimer = setTimeout(function() {
      if (typeof refreshPointsDisplay === 'function') {
        refreshPointsDisplay();
      }
    }, 50);
  }

  function initShopEventListeners() {
    if (typeof EventBus === 'undefined' || !EventBus.on) return;

    EventBus.on('weapon:added', function() {
      debounceShopRefresh();
    });

    EventBus.on('shield:added', function() {
      debounceShopRefresh();
    });

    EventBus.on('armor:added', function() {
      debounceShopRefresh();
    });

    EventBus.on('mount:added', function() {
      debounceShopRefresh();
    });

    EventBus.on('unit:added', function() {
      debounceShopRefresh();
    });

    EventBus.on('points:changed', function() {
      debouncePointsRefresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShopEventListeners);
  } else {
    initShopEventListeners();
  }
})();

// ===== 兵种品阶定价配置 =====
var UNIT_TIER_CONFIG = {
  peasant_infantry: {
    tier: 'iron',
    tierName: '黑铁',
    tierLabel: '⚫ 黑铁',
    price: 300,
    desc: '装备简陋的农民步兵，士气低落但人多势众',
    color: '#4a4a4a',
    bgColor: 'rgba(74,74,74,0.15)'
  },
  peasant_archer: {
    tier: 'iron',
    tierName: '黑铁',
    tierLabel: '⚫ 黑铁',
    price: 300,
    desc: '临时配发猎弓的农民弓兵，射程有限',
    color: '#4a4a4a',
    bgColor: 'rgba(74,74,74,0.15)'
  },
  infantry: {
    tier: 'bronze',
    tierName: '青铜',
    tierLabel: '🟤 青铜',
    price: 1000,
    desc: '重甲步兵方阵，长戈抵御骑兵，正面硬撼',
    color: '#cd7f32',
    bgColor: 'rgba(205,127,50,0.15)'
  },
  archer: {
    tier: 'bronze',
    tierName: '青铜',
    tierLabel: '🟤 青铜',
    price: 1000,
    desc: '精灵远程部队，精准射击，穿透力强',
    color: '#cd7f32',
    bgColor: 'rgba(205,127,50,0.15)'
  },
  cavalry: {
    tier: 'gold',
    tierName: '黄金',
    tierLabel: '🟡 黄金',
    price: 1600,
    desc: '重甲骑兵，机动性强，侧翼突击的主力',
    color: '#ffd700',
    bgColor: 'rgba(255,215,0,0.15)'
  },
  flying: {
    tier: 'gold',
    tierName: '黄金',
    tierLabel: '🟡 黄金',
    price: 1600,
    desc: '狮鹫空军，空中制霸，对步兵有震慑效果',
    color: '#ffd700',
    bgColor: 'rgba(255,215,0,0.15)'
  },
  beast_infantry: {
    tier: 'iron',
    tierName: '黑铁',
    tierLabel: '⚫ 黑铁',
    price: 300,
    desc: '凶猛的军犬兵团，极速冲击，侦察利器',
    color: '#4a4a4a',
    bgColor: 'rgba(74,74,74,0.15)'
  },
  elite_archer: {
    tier: 'bronze',
    tierName: '青铜',
    tierLabel: '🟤 青铜',
    price: 1000,
    desc: '精锐弩兵，钢弩破甲，近战亦有自保之力',
    color: '#cd7f32',
    bgColor: 'rgba(205,127,50,0.15)'
  }
};

// 初始8支部队补全（补上可能缺失的）
function syncUnitTierConfigs() {
  if (typeof UD === 'undefined' || !UD.units) return;
  // 清理 UNIT_TIER_CONFIG 中已不存在的单位 或 已被玩家清除的单位
  Object.keys(UNIT_TIER_CONFIG).forEach(function(type) {
    var stillExists = UD.units.some(function(ud) { return ud.type === type; });
    if (!stillExists) { delete UNIT_TIER_CONFIG[type]; return; }
    if (GameState._hiddenShopUnitTypes && GameState._hiddenShopUnitTypes.indexOf(type) >= 0) {
      delete UNIT_TIER_CONFIG[type];
    }
  });
  UD.units.forEach(function(ud) {
    if (!UNIT_TIER_CONFIG[ud.type] && !ud._levelBattleTemp) {
      // 跳过已被玩家隐藏的兵种类型
      if (GameState._hiddenShopUnitTypes && GameState._hiddenShopUnitTypes.indexOf(ud.type) >= 0) return;
      getUnitTierConfig(ud.type);
    }
  });
}

// 将十六进制颜色转为 rgba
function hexToRgba(hex, alpha) {
  if (!hex || hex.indexOf('rgba') === 0) return hex || 'rgba(74,74,74,0.15)';
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var r = parseInt(h.substring(0,2), 16);
  var g = parseInt(h.substring(2,4), 16);
  var b = parseInt(h.substring(4,6), 16);
  if (isNaN(r)) return 'rgba(74,74,74,0.15)';
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

// ===== 获取兵种定价信息 =====
function getUnitTierConfig(unitType) {
  if (UNIT_TIER_CONFIG[unitType]) {
    var cfg = UNIT_TIER_CONFIG[unitType];
    // 自动补全可能缺失的展示文本
    if (cfg.tierLabel && cfg.tierLabel.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() === '' && cfg.tierName) {
      cfg.tierLabel = cfg.tierLabel + ' ' + cfg.tierName.replace('召唤', '');
    }
    return cfg;
  }
  
  // 动态生成配置
  var ud = unitDefByType(unitType);
  var tierId = (ud && ud.tier) ? ud.tier : 'iron';

  // 如果单位没有直接tier字段但有_summonTier，从_summonTier映射正确的品阶
  if (tierId === 'iron' && ud && ud._summonTier) {
    var summonTierMap = { 1: 'iron', 2: 'bronze', 3: 'gold', 4: 'diamond' };
    tierId = summonTierMap[ud._summonTier] || tierId;
  }

  // 统一品阶属性映射
  var tierProps = {
    iron:    { name: '黑铁', icon: '⚫', price: 300,  color: '#4a4a4a' },
    bronze:  { name: '青铜', icon: '🟤', price: 1000, color: '#cd7f32' },
    gold:    { name: '黄金', icon: '🟡', price: 1600, color: '#ffd700' },
    diamond: { name: '钻石', icon: '💎', price: 3000, color: '#a78bfa' }
  };
  
  var p = tierProps[tierId] || tierProps.iron;
  var tierColor = (typeof getTierColor === 'function') ? getTierColor(tierId) : p.color;
  var tierName = (typeof getTierName === 'function') ? getTierName(tierId) : p.name;
  
  var fixed = {
    tier: tierId,
    tierName: tierName,
    tierLabel: p.icon + ' ' + tierName,
    price: p.price,
    desc: (ud && ud.background) ? ud.background.substring(0, 40) : '来自异世界的精锐力量',
    color: tierColor,
    bgColor: hexToRgba(tierColor, 0.15)
  };
  
  UNIT_TIER_CONFIG[unitType] = fixed;
  return fixed;
}

// ===== 获取当前积分 =====
function getPlayerPoints() {
  return GameState.points || 0;
}

// ===== 积分是否足够 =====
function canAfford(price) {
  return getPlayerPoints() >= price;
}

// ===== 购买兵团 =====
function buyUnit(unitType) {
  var tier = getUnitTierConfig(unitType);
  var price = tier.price;

  if (!canAfford(price)) {
    showToast('积分不足！需要 ' + price + ' 积分，当前只有 ' + getPlayerPoints() + ' 积分', 'error');
    return false;
  }

  // 先校验兵种是否存在
  var ud = unitDefByType(unitType);
  if (!ud) {
    showToast('购买失败：未找到该兵种', 'error');
    return false;
  }

  // 扣除积分
  GameState.points -= price;

  // ===== [核心修复] AI临时兵种脱敏与持久化 =====
  if (ud._aiBattleTemp) {
    // 1. 在内存中将其转为正式单位，防止被 clearAIOpponentUnits 清除
    delete ud._aiBattleTemp;
    ud._summoned = true;

    // 2. 将定义写入存档数据，确保刷新后不丢失
    if (!GameState._summonedData) {
      GameState._summonedData = { races: [], weapons: [], shields: [], armors: [], mounts: [], units: [] };
    }
    if (!GameState._summonedData.units) GameState._summonedData.units = [];
    
    // 检查是否已存在（避免重复写入）
    var alreadySaved = GameState._summonedData.units.some(function(u) { return u.id === ud.id; });
    if (!alreadySaved) {
      // 深拷贝一份定义存入存档
      var persistUnit = JSON.parse(JSON.stringify(ud));
      GameState._summonedData.units.push(persistUnit);

      // ===== [核心同步] 在商城直接购买时，也要持久化 AI 的动态装备 =====
      if (persistUnit.equipment) {
        var eq = persistUnit.equipment;
        if (eq.mainWeapon) {
          var wDef = ED.weapons.find(function(x){ return x.id === eq.mainWeapon; });
          if (wDef) {
            var pw = JSON.parse(JSON.stringify(wDef));
            delete pw._aiTemp; pw._summoned = true;
            if (!GameState._summonedData.weapons) GameState._summonedData.weapons = [];
            if (!GameState._summonedData.weapons.find(function(x){ return x.id === pw.id; })) {
              GameState._summonedData.weapons.push(pw);
            }
            // 即时剥离ED中的_aiTemp，防止被clearAIOpponentUnits清除
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
      
      // ===== [核心同步] 持久化AI临时种族定义 =====
      if (persistUnit.race && persistUnit.race.id) {
        var rDef = (typeof getRace === 'function') ? getRace(persistUnit.race.id) : null;
        if (rDef) {
          if (!GameState._summonedData.races) GameState._summonedData.races = [];
          if (!GameState._summonedData.races.find(function(x){ return x.id === rDef.id; })) {
            var pr = JSON.parse(JSON.stringify(rDef));
            delete pr._aiTemp; pr._summoned = true;
            GameState._summonedData.races.push(pr);
          }
          delete rDef._aiTemp;
          rDef._summoned = true;
        }
      }
      
      // 同时确保它的品阶在配置中是正确的
      if (typeof UNIT_TIER_CONFIG !== 'undefined' && !UNIT_TIER_CONFIG[unitType]) {
        getUnitTierConfig(unitType); // 触发一次动态生成配置
      }
    }
  }

  // 生成唯一ID
  var unitId = 'u_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  var newUnit = {
    id: unitId,
    type: unitType,
    name: ud.name
  };
  GameState.playerUnits.push(newUnit);

  // 发出事件
  if (typeof EventBus !== 'undefined' && EventBus.emit) {
    EventBus.emit('unit:added', newUnit);
    EventBus.emit('points:changed', { points: GameState.points, delta: -price });
  }

  // 保存并刷新
  saveToBrowser(GameState.saveName);
  showToast('购买成功！-' + price + '积分 ' + ud.name, 'success');

  // 刷新商城页面（如果当前在商城）
  if (currentPage === 'Shop') {
    buildShop();
  }

  return true;
}

// ===== 退货（出售兵团）=====
function sellUnit(unitId) {
  var idx = -1;
  var unit = null;
  for (var i = 0; i < GameState.playerUnits.length; i++) {
    if (GameState.playerUnits[i].id === unitId) {
      idx = i;
      unit = GameState.playerUnits[i];
      break;
    }
  }

  if (idx < 0 || !unit) {
    showToast('退货失败：未找到该部队', 'error');
    return false;
  }

  var tier = getUnitTierConfig(unit.type);
  // 退货返还50%积分
  var refund = Math.floor(tier.price * 0.5);

  GameState.playerUnits.splice(idx, 1);
  GameState.points += refund;

  // 发出事件
  if (typeof EventBus !== 'undefined' && EventBus.emit) {
    EventBus.emit('unit:removed', { unitId: unitId });
    EventBus.emit('points:changed', { points: GameState.points, delta: refund });
  }

  saveToBrowser(GameState.saveName);
  showToast(unit.name + ' 已出售，返还 ' + refund + ' 积分（50%折旧）', 'info');

  // 刷新商城页面
  if (currentPage === 'Shop') {
    buildShop();
  }

  return true;
}

// ===== 刷新积分显示 =====
function refreshPointsDisplay() {
  var newVal = getPlayerPoints();
  var el = document.getElementById('shopPoints');
  if (el) {
    el.textContent = newVal + ' 积分';
  }
  var el2 = document.getElementById('shopPointsBig');
  if (el2) {
    // 数字滚动动画：从旧值过渡到新值，0.5s power2.out
    var old2 = parseInt(el2.textContent, 10);
    if (isNaN(old2)) old2 = newVal;
    if (typeof animateNumber === 'function') {
      animateNumber(el2, old2, newVal, 0.5);
    } else {
      el2.textContent = newVal;
    }
  }
  // 同步准备页积分显示（由 refreshPrepPage 负责动画，此处直接写值避免冲突）
  var el3 = document.getElementById('prepPointsDisplay');
  if (el3) {
    el3.textContent = newVal;
  }
}

// ===== 商城当前标签页（units=兵种 / equipment=装备）=====
var SHOP_CURRENT_TAB = 'units';
var SHOP_CLEANUP_MODE = false;

// ===== 装备价格表（按品阶基础价 × 类型系数）=====
// 公式: 装备价格 = 品阶基础价 × 类型系数
// 商城装备售价（买价）
var EQUIP_PRICE_TABLE = {
  iron:    { weapon: 80,  shield: 50,  armor: 100,  mount: 70   },
  bronze:  { weapon: 400, shield: 120, armor: 200,  mount: 180  },
  gold:    { weapon: 1000, shield: 300, armor: 600,  mount: 600  },
  diamond: { weapon: 2000, shield: 600, armor: 1200, mount: 1400 }
};

// ===== 判定装备分类（weapon/shield/armor/mount），不可售卖返回 null =====
function getEquipCategoryForItem(item) {
  if (!item || item._natural) return null;
  if (item.handed) return 'weapon';
  if (item.category === '盾牌') return 'shield';
  // 部分盾牌没有 category 字段，通过 effects 中的远程免伤识别
  if (item.effects && String(item.effects).indexOf('远程免伤') >= 0) return 'shield';
  if (item.forScale) return 'armor';
  if (item.category === '轻甲' || item.category === '中甲' || item.category === '重甲' || item.category === '特殊') return 'armor';
  if (item.scale !== undefined && item.bonusHP !== undefined) return 'mount';
  return null;
}

// ===== 获取装备价格 =====
function getPriceForEquipment(item) {
  var cat = getEquipCategoryForItem(item);
  if (!cat) return Infinity;
  var tier = item.tier || (typeof DEFAULT_TIER !== 'undefined' ? DEFAULT_TIER : 'iron');
  var tierPrices = EQUIP_PRICE_TABLE[tier] || EQUIP_PRICE_TABLE.iron;
  return tierPrices[cat] || Infinity;
}

// ===== 构建装备关键属性 HTML =====
function buildEquipStatsHtml(item, cat) {
  var stats = [];
  if (cat === 'weapon') {
    stats.push('<span>⚔ 伤害 ' + (item.baseDamage !== undefined ? item.baseDamage : '?') + '</span>');
    stats.push('<span>🛡 破甲 ' + (item.armorPierce !== undefined ? item.armorPierce : 0) + '</span>');
    stats.push('<span>🎯 攻击距离 ' + (item.allowedRange || 1) + '</span>');
    if (item.handed) stats.push('<span>' + (item.handed === 'two-handed' ? '双手' : '单手') + '</span>');
  } else if (cat === 'shield') {
    stats.push('<span>🛡 防御 ' + (item.defense || 0) + '</span>');
    var rr = 0;
    if (item.effects) {
      item.effects.forEach(function(e) {
        var m = e.match(/远程免伤[+](\d+)%/);
        if (m) rr = Math.max(rr, parseInt(m[1]));
      });
    }
    stats.push('<span>🏹 远程免伤 ' + rr + '%</span>');
  } else if (cat === 'armor') {
    stats.push('<span>🛡 护甲 ' + (item.defense || 0) + '</span>');
    if (item.mobilityPenalty && item.mobilityPenalty < 0) stats.push('<span>🏃 机动 ' + item.mobilityPenalty + '</span>');
    if (item.category) stats.push('<span>📦 ' + item.category + '</span>');
  } else if (cat === 'mount') {
    stats.push('<span>🩸 HP +' + (item.bonusHP || 0) + '</span>');
    stats.push('<span>🛡 护甲 +' + (item.bonusArmor || 0) + '</span>');
    stats.push('<span>🏃 移动 +' + (item.bonusMove || 0) + '</span>');
    stats.push('<span>📏 规模 ' + (item.scale || 1) + '</span>');
    // 注：bonusAtkRange 已废弃，坐骑通过 scale 影响 unitScale（攻击范围=规模-1）
  }
  // 装备效果（如飞行能力、火焰抗性等）
  if (item.effects && item.effects.length) {
    stats.push('<span class="sec-effect">✨ ' + item.effects.join('、') + '</span>');
  }
  return stats.join('');
}

// ===== 构建装备标签页 =====
function getUnlockedEquipIds() {
  var ids = [];
  if (GameState && GameState.playerUnits) {
    GameState.playerUnits.forEach(function(pu) {
      var ud = typeof unitDefByType === 'function' ? unitDefByType(pu.type) : null;
      if (ud && ud.equipment) {
        if (ud.equipment.mainWeapon && ids.indexOf(ud.equipment.mainWeapon) < 0) ids.push(ud.equipment.mainWeapon);
        if (ud.equipment.shield && ids.indexOf(ud.equipment.shield) < 0) ids.push(ud.equipment.shield);
        if (ud.equipment.armor && ids.indexOf(ud.equipment.armor) < 0) ids.push(ud.equipment.armor);
        if (ud.equipment.mount && ids.indexOf(ud.equipment.mount) < 0) ids.push(ud.equipment.mount);
      }
    });
  }
  if (GameState && GameState.inventory) {
    var cats = ['weapons', 'shields', 'armors', 'mounts'];
    cats.forEach(function(cat) {
      (GameState.inventory[cat] || []).forEach(function(item) {
        if (item.id && ids.indexOf(item.id) < 0) ids.push(item.id);
      });
    });
  }
  return ids;
}
function buildShopEquipmentTab(container) {
  if (typeof ED === 'undefined' || !ED) {
    var empty = document.createElement('div');
    empty.className = 'sms-empty';
    empty.textContent = '装备数据加载中…';
    container.appendChild(empty);
    return;
  }

  var cats = [
    { name: '⚔ 武器', desc: '主战兵器，决定伤害与破甲', slot: 'weapons', list: ED.weapons || [] },
    { name: '🛡 盾牌', desc: '提供防御与远程免伤', slot: 'shields', list: ED.shields || [] },
    { name: '🎽 护甲', desc: '增加护甲值，部分影响机动', slot: 'armors', list: ED.armors || [] },
    { name: '🐴 坐骑', desc: '提供 HP/护甲/移动加成', slot: 'mounts', list: ED.mounts || [] }
  ];

  cats.forEach(function(c) {
    // 过滤自然装备 + 不可售卖 + 仅显示玩家已有兵种可用的装备
    var unlocked = getUnlockedEquipIds();
    var items = c.list.filter(function(it) {
      return it && !it._natural && !it._sponsorUnit && !it._unique && getEquipCategoryForItem(it) && getPriceForEquipment(it) !== Infinity
        && unlocked.indexOf(it.id) >= 0;
    });
    if (items.length === 0) return;

    var section = document.createElement('div');
    section.className = 'shop-tier-section';

    var header = document.createElement('div');
    header.className = 'shop-tier-header';
    header.innerHTML =
      '<div class="sth-title">' + c.name + '</div>' +
      '<div class="sth-desc">' + c.desc + '</div>';
    section.appendChild(header);

    var grid = document.createElement('div');
    grid.className = 'shop-tier-grid shop-equip-grid';

    items.forEach(function(item) {
      var cat = getEquipCategoryForItem(item);
      var price = getPriceForEquipment(item);
      var tierColor = (typeof getTierColor === 'function') ? getTierColor(item.tier) : '#4a4a4a';
      var tierName = (typeof getTierName === 'function') ? getTierName(item.tier) : '';
      var appText = (typeof getEquipmentApplicabilityText === 'function') ? getEquipmentApplicabilityText(item) : '';
      var canBuy = canAfford(price);

      var card = document.createElement('div');
      card.className = 'shop-equip-card';
      card.style.borderLeftColor = tierColor;

      card.innerHTML =
        '<div class="sec-header">' +
          '<div class="sec-name" style="color:' + tierColor + '">' + item.name + '</div>' +
          '<div class="sec-tier" style="color:' + tierColor + '">' + tierName + '</div>' +
        '</div>' +
        (appText ? '<div class="sec-app">' + appText + '</div>' : '') +
        '<div class="sec-stats">' + buildEquipStatsHtml(item, cat) + '</div>' +
        (item.desc ? '<div class="sec-desc">' + item.desc + '</div>' : '') +
        '<div class="sc-footer">' +
          '<div class="sc-price">💎 ' + price + '</div>' +
          '<button class="sc-btn ' + (canBuy ? '' : 'disabled') + '" ' + (canBuy ? '' : 'disabled') + ' onclick="buyEquipment(\'' + item.id + '\',\'' + c.slot + '\')">' +
            (canBuy ? '购买' : '积分不足') +
          '</button>' +
        '</div>';

      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

// ===== 购买装备 =====
function buyEquipment(itemId, slotType) {
  // slotType: weapons/shields/armors/mounts
  var item = null;
  if (typeof findWeapon === 'function' && slotType === 'weapons') item = findWeapon(itemId);
  else if (typeof findShield === 'function' && slotType === 'shields') item = findShield(itemId);
  else if (typeof findArmor === 'function' && slotType === 'armors') item = findArmor(itemId);
  else if (typeof findMount === 'function' && slotType === 'mounts') item = findMount(itemId);

  if (!item) {
    showToast('购买失败：未找到该装备', 'error');
    return false;
  }
  if (item._natural) {
    showToast('该装备不可购买', 'error');
    return false;
  }

  var price = getPriceForEquipment(item);
  if (price === Infinity) {
    showToast('该装备不可购买', 'error');
    return false;
  }
  if (!canAfford(price)) {
    showToast('积分不足！需要 ' + price + ' 积分，当前只有 ' + getPlayerPoints() + ' 积分', 'error');
    return false;
  }

  // 扣除积分
  GameState.points -= price;

  // 加入背包：直接使用 ED 装备引用（与 unequipToInventory 行为一致，
  // 保留原始 ED id，保证后续 equip/unequip 流程能通过 findWeapon/findShield 等解析）
  var added = (typeof addItemToInventory === 'function') ? addItemToInventory(item, slotType) : false;
  if (!added) {
    GameState.points += price; // 回滚积分
    showToast('购买失败：背包分类错误', 'error');
    return false;
  }

  // 发出积分变更事件
  if (typeof EventBus !== 'undefined' && EventBus.emit) {
    EventBus.emit('points:changed', { points: GameState.points, delta: -price });
  }

  // 保存并刷新
  saveToBrowser(GameState.saveName);
  showToast('购买成功！-' + price + '积分 ' + item.name, 'success');

  refreshPointsDisplay();
  // 更新准备页背包徽章
  var prepInvBadge = document.getElementById('prepInvBadge');
  if (prepInvBadge) {
    var invCount = typeof getInventoryCount === 'function' ? getInventoryCount() : 0;
    prepInvBadge.textContent = invCount;
    prepInvBadge.style.display = invCount > 0 ? 'inline-flex' : 'none';
  }

  // 刷新商城页面（保持当前装备标签页）
  if (currentPage === 'Shop') {
    buildShop();
  }
  return true;
}

// ===== 切换商城标签页 =====
function switchShopTab(tab) {
  SHOP_CURRENT_TAB = tab;
  SHOP_CLEANUP_MODE = false; // 切换标签时自动退出清理模式
  // 切换前预隐藏新标签内容（防止闪烁）
  if (window.PageTransitions && PageTransitions.prepareStagger) {
    var oldContent = document.getElementById('shopTabContent');
    if (oldContent) {
      PageTransitions.prepareStagger('.shop-card, .shop-equip-card', oldContent);
    }
  }
  buildShop();
  // 新标签内容入场交错动画（tab 切换更紧凑，delay=0）
  if (window.PageTransitions) {
    var newContent = document.getElementById('shopTabContent');
    if (newContent) {
      PageTransitions.staggerItems('.shop-card, .shop-equip-card', newContent, 0);
    }
  }
}

// ===== 切换商城清理模式 =====
function toggleShopCleanupMode() {
  SHOP_CLEANUP_MODE = !SHOP_CLEANUP_MODE;
  buildShop();
}

// ===== 从商城中永久移除兵种（仅当拥有数为0且处于清理模式下）=====
function removeUnitFromShop(unitType) {
  var owned = GameState.playerUnits.filter(function(u) { return u.type === unitType; }).length;
  if (owned > 0) {
    showToast('无法移除：仍有 ' + owned + ' 支该兵团在部队中', 'error');
    return;
  }

  // 先获取单位名称（移除前）
  var udName = unitType;
  if (typeof UD !== 'undefined' && UD.units) {
    var found = UD.units.find(function(u) { return u.type === unitType; });
    if (found) udName = found.name;
  }

  // 记录到隐藏列表，防止 syncUnitTierConfigs 重新加回来
  if (!GameState._hiddenShopUnitTypes) GameState._hiddenShopUnitTypes = [];
  if (GameState._hiddenShopUnitTypes.indexOf(unitType) < 0) {
    GameState._hiddenShopUnitTypes.push(unitType);
  }

  // 从定价配置中移除
  if (UNIT_TIER_CONFIG[unitType]) {
    delete UNIT_TIER_CONFIG[unitType];
  }

  // 从召唤数据中移除（如果是召唤/领取来的单位）
  if (GameState._summonedData && GameState._summonedData.units) {
    GameState._summonedData.units = GameState._summonedData.units.filter(function(u) {
      return u.type !== unitType;
    });
  }

  // 从全局兵种定义中移除（UD.units）
  if (typeof UD !== 'undefined' && UD.units) {
    UD.units = UD.units.filter(function(u) { return u.type !== unitType; });
  }

  saveToBrowser(GameState.saveName);
  showToast('已从商城移除：' + udName, 'info');
  buildShop();
}

// ===== 构建商城页面 =====
function buildShop() {
  var container = document.getElementById('shopContent');
  if (!container) return;

  container.innerHTML = '';

  // 同步并加载所有已知兵种到定价表（含初始8支和动态生成的召唤兵种）
  if (typeof syncUnitTierConfigs === 'function') {
    syncUnitTierConfigs();
  }

  // 刷新积分
  refreshPointsDisplay();

  // 积分展示区
  var pointsBar = document.createElement('div');
  pointsBar.className = 'shop-points-bar';
  pointsBar.innerHTML =
    '<div class="sp-icon">💎</div>' +
    '<div class="sp-info">' +
      '<div class="sp-label">我的积分</div>' +
      '<div class="sp-value" id="shopPointsBig">' + getPlayerPoints() + '</div>' +
    '</div>';
  container.appendChild(pointsBar);

  // 标签页按钮
  var tabBar = document.createElement('div');
  tabBar.className = 'shop-tabs';
  tabBar.innerHTML =
    '<button class="shop-tab ' + (SHOP_CURRENT_TAB === 'units' ? 'active' : '') + '" onclick="switchShopTab(\'units\')">兵 种</button>' +
    '<button class="shop-tab ' + (SHOP_CURRENT_TAB === 'equipment' ? 'active' : '') + '" onclick="switchShopTab(\'equipment\')">装 备</button>';

  // 只在兵种标签下显示清理按钮
  if (SHOP_CURRENT_TAB === 'units') {
    var cleanupBtn = document.createElement('button');
    cleanupBtn.className = SHOP_CLEANUP_MODE ? 'shop-cleanup-btn active' : 'shop-cleanup-btn';
    cleanupBtn.textContent = SHOP_CLEANUP_MODE ? '❌ 退出清理' : '🧹 清理';
    cleanupBtn.title = SHOP_CLEANUP_MODE ? '退出清理模式' : '进入清理模式：可移除拥有数为0的兵种';
    cleanupBtn.setAttribute('data-action', 'toggleCleanup');
    // 用内联样式确保它在右侧
    cleanupBtn.style.cssText = 'margin-left:auto;padding:6px 14px;border-radius:6px;border:1px solid ' +
      (SHOP_CLEANUP_MODE ? '#e74c3c' : '#8b0000') + ';background:' +
      (SHOP_CLEANUP_MODE ? '#e74c3c' : 'transparent') + ';color:' +
      (SHOP_CLEANUP_MODE ? '#fff' : '#8b0000') + ';cursor:pointer;font-size:13px;flex-shrink:0;';

    cleanupBtn.addEventListener('click', function() {
      if (typeof toggleShopCleanupMode === 'function') toggleShopCleanupMode();
    });
    tabBar.appendChild(cleanupBtn);
  }
  container.appendChild(tabBar);

  // 内容容器
  var content = document.createElement('div');
  content.id = 'shopTabContent';
  container.appendChild(content);

  // 渲染当前标签页
  if (SHOP_CURRENT_TAB === 'equipment') {
    buildShopEquipmentTab(content);
  } else {
    buildShopUnitsTab(content);
  }

  // 商城卡片入场交错动画（列表 stagger 0.05s）
  if (window.PageTransitions) {
    PageTransitions.staggerItems('.shop-card, .shop-equip-card', content, 0.05);
  }
}

// ===== 兵种标签页（原 buildShop 主体）=====
function buildShopUnitsTab(container) {
  var tierColor = typeof getTierColor === 'function' ? getTierColor : function(t) { return TIER_LEVELS[t] ? TIER_LEVELS[t].color : '#4a4a4a'; };
  var tiers = [
    { id: 'diamond', name: '💎 钻石兵种', desc: '传说级战力，战场主宰', color: tierColor('diamond') },
    { id: 'gold',    name: '🟡 黄金兵种', desc: '精锐王牌，攻防兼备', color: tierColor('gold') },
    { id: 'bronze',  name: '🟤 青铜兵种', desc: '正规部队，训练有素', color: tierColor('bronze') },
    { id: 'iron',    name: '⚫ 黑铁兵种', desc: '基础武装，价格实惠', color: tierColor('iron') }
  ];

  tiers.forEach(function(tier) {
    var tierUnits = Object.keys(UNIT_TIER_CONFIG).filter(function(type) {
      return UNIT_TIER_CONFIG[type].tier === tier.id;
    });

    if (tierUnits.length === 0) return;

    var section = document.createElement('div');
    section.className = 'shop-tier-section';

    var header = document.createElement('div');
    header.className = 'shop-tier-header';
    header.style.borderLeftColor = tier.color;
    header.innerHTML =
      '<div class="sth-title">' + tier.name + '</div>' +
      '<div class="sth-desc">' + tier.desc + '</div>';
    section.appendChild(header);

    var grid = document.createElement('div');
    grid.className = 'shop-tier-grid';

    tierUnits.forEach(function(unitType) {
      var ud = unitDefByType(unitType);
      if (ud && ud._sponsorUnit) return;
      var tierInfo = getUnitTierConfig(unitType);
      var st = computeStats(ud);
      if (!ud || !st) return;

      var owned = GameState.playerUnits.filter(function(u) { return u.type === unitType; }).length;
      var canBuy = canAfford(tierInfo.price);

      var card = document.createElement('div');
      card.className = 'shop-card';
      card.style.borderColor = tierInfo.color;
      card.style.background = tierInfo.bgColor;

      var footerHTML = '';
      if (SHOP_CLEANUP_MODE && owned === 0) {
        footerHTML =
          '<div class="sc-price" style="color:#e74c3c">🗑 可移除</div>' +
          '<button class="sc-btn" style="background:#e74c3c;color:#fff;border-color:#c0392b" onclick="removeUnitFromShop(\'' + unitType + '\')">' +
            '移除' +
          '</button>';
      } else {
        footerHTML =
          '<div class="sc-price">💎 ' + tierInfo.price + '</div>' +
          '<button class="sc-btn ' + (canBuy ? '' : 'disabled') + '" ' + (canBuy ? '' : 'disabled') + ' onclick="buyUnit(\'' + unitType + '\')">' +
            (canBuy ? '购买' : '积分不足') +
          '</button>';
      }

      card.innerHTML =
        '<div class="sc-badge" style="background:' + tierInfo.color + '">' + tierInfo.tierName + '</div>' +
        '<img class="sc-img" src="' + ud.image + '" alt="' + ud.name + '" onerror="this.style.display=\'none\'">' +
        '<div class="sc-body">' +
          '<div class="sc-name">' + ud.icon + ' ' + ud.name + '</div>' +
          '<div class="sc-desc">' + tierInfo.desc + '</div>' +
          '<div class="sc-stats">' +
            '<span>🩸 ' + st.totalHP + '</span>' +
            '<span>🛡 ' + st.totalArmor + '</span>' +
            '<span>⚔ ' + (st.mainWeapon ? st.mainWeapon.baseDamage : '?') + '</span>' +
            '<span>🏃 ' + st.movement + '</span>' +
            '<span>🎯 ' + st.attackRange + '/' + st.allowedRange + '</span>' +
          '</div>' +
          '<div class="sc-owned">已拥有：<b>' + owned + '</b> 支</div>' +
        '</div>' +
        '<div class="sc-footer">' +
          footerHTML +
        '</div>';

      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });

  // 我的兵团管理区
  var mySection = document.createElement('div');
  mySection.className = 'shop-my-section';
  mySection.innerHTML =
    '<div class="sms-header">📋 我的兵团（' + GameState.playerUnits.length + ' 支）</div>';

  if (GameState.playerUnits.length === 0) {
    mySection.innerHTML += '<div class="sms-empty">兵团空空如也，快去商城购买吧！</div>';
  } else {
    var myGrid = document.createElement('div');
    myGrid.className = 'sms-grid';

    GameState.playerUnits.forEach(function(unit) {
      var ud = unitDefByType(unit.type);
      var tierInfo = getUnitTierConfig(unit.type);
      if (!ud) return;

      var refund = Math.floor(tierInfo.price * 0.5);

      var item = document.createElement('div');
      item.className = 'sms-item';
      item.style.borderLeftColor = tierInfo.color;
      item.innerHTML =
        '<img src="' + ud.image + '" alt="" class="sms-img" onerror="this.style.display=\'none\'">' +
        '<div class="sms-info">' +
          '<div class="sms-name">' + ud.icon + ' ' + ud.name + '</div>' +
          '<div class="sms-tier" style="color:' + tierInfo.color + '">' + tierInfo.tierLabel + '</div>' +
        '</div>' +
        '<button class="sms-sell" onclick="sellUnit(\'' + unit.id + '\')">出售<br><span>+' + refund + '</span></button>';

      myGrid.appendChild(item);
    });

    mySection.appendChild(myGrid);
  }

  container.appendChild(mySection);
}

// ===== 暴露给全局 =====
window.UNIT_TIER_CONFIG = UNIT_TIER_CONFIG;
window.getUnitTierConfig = getUnitTierConfig;
window.getPlayerPoints = getPlayerPoints;
window.canAfford = canAfford;
window.buyUnit = buyUnit;
window.sellUnit = sellUnit;
window.refreshPointsDisplay = refreshPointsDisplay;
window.buildShop = buildShop;
window.buildShopUnitsTab = buildShopUnitsTab;
window.buildShopEquipmentTab = buildShopEquipmentTab;
window.getPriceForEquipment = getPriceForEquipment;
window.getEquipCategoryForItem = getEquipCategoryForItem;
window.buyEquipment = buyEquipment;
window.switchShopTab = switchShopTab;
window.toggleShopCleanupMode = toggleShopCleanupMode;
window.removeUnitFromShop = removeUnitFromShop;
