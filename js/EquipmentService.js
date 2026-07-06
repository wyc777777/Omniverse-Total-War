// AI路径引导：如需查找其他文件路径和功能说明，请先查看项目根目录的 AI_PATH_GUIDE.md；每新增/修改一个文件后，必须同步更新AI_PATH_GUIDE.md
// ==================== EquipmentService 装备服务 ====================

/**
 * @file 装备服务模块 - 提供装备与背包操作的统一接口
 * @description 封装装备与背包操作的核心逻辑，通过 EventBus 发布变更事件，
 *              保持向后兼容，全局函数委托到此服务。
 * @module js/EquipmentService
 */

/**
 * @typedef {Object} WeaponDef
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} [type]
 * @property {string} [handed]
 * @property {string} [slot]
 * @property {number} [baseDamage]
 * @property {number} [armorPierce]
 * @property {number} [attackRange]
 * @property {number} [allowedRange]
 * @property {string[]} [forUnits]
 * @property {string[]} [effects]
 * @property {string} [desc]
 */

/**
 * @typedef {Object} ShieldDef
 * @property {string} id
 * @property {string} name
 * @property {string} [category]
 * @property {number} [defense]
 * @property {number} [mobilityPenalty]
 * @property {string[]} [forUnits]
 * @property {string[]} [effects]
 * @property {string} [desc]
 */

/**
 * @typedef {Object} ArmorDef
 * @property {string} id
 * @property {string} name
 * @property {string} [category]
 * @property {number} [defense]
 * @property {number} [mobilityPenalty]
 * @property {string[]} [forUnits]
 * @property {string[]} [effects]
 * @property {string} [desc]
 */

/**
 * @typedef {Object} MountDef
 * @property {string} id
 * @property {string} name
 * @property {string} [category]
 * @property {number} [scale]
 * @property {number} [bonusHP]
 * @property {number} [bonusArmor]
 * @property {number} [bonusMove]
 * @property {number} [bonusAtkRange]
 * @property {string[]} [forUnits]
 * @property {string[]} [effects]
 * @property {string} [desc]
 */

/**
 * @typedef {Object} UnitDef
 * @property {string} type
 * @property {string} [typeName]
 * @property {string} [baseType]
 * @property {Object} race
 * @property {string} race.id
 * @property {Object} equipment
 * @property {string} [equipment.mainWeapon]
 * @property {string} [equipment.shield]
 * @property {string} [equipment.armor]
 * @property {string} [equipment.mount]
 * @property {number} [unitCount]
 */

/**
 * @typedef {Object} EquipResult
 * @property {boolean} success 是否成功
 * @property {*} [unequipped] 被卸下的装备
 * @property {string} [reason] 失败原因
 * @property {string} [message] 失败消息
 */

/**
 * @typedef {Object} EquipmentChangedEvent
 * @property {string} unitType 单位类型
 * @property {string} slot 装备槽位
 * @property {*} item 装备物品
 */

(function(global) {
  'use strict';

  /** @type {EquipmentService|null} */
  var _instance = null;

  /**
   * 装备槽位常量
   * @readonly
   * @enum {string}
   */
  var SLOT = {
    MAIN_WEAPON: 'mainWeapon',
    SHIELD: 'shield',
    ARMOR: 'armor',
    MOUNT: 'mount'
  };

  /**
   * 装备服务类 - 单例模式
   * @class
   */
  function EquipmentService() {
    if (_instance) {
      return _instance;
    }
    _instance = this;

    /**
     * 装备槽位枚举
     * @type {Object}
     */
    this.Slot = SLOT;
  }

  // ===== 私有辅助方法 =====

  /**
   * 触发事件总线事件
   * @param {string} eventName 事件名称
   * @param {*} [data] 事件数据
   * @private
   */
  EquipmentService.prototype._emit = function(eventName, data) {
    if (typeof EventBus !== 'undefined' && EventBus.emit) {
      EventBus.emit(eventName, data);
    }
  };

  /**
   * 获取单位类型标识
   * @param {UnitDef} unitDef 单位定义
   * @returns {string} 单位类型
   * @private
   */
  EquipmentService.prototype._getUnitType = function(unitDef) {
    if (!unitDef) return '';
    return unitDef.type || unitDef.baseType || '';
  };

  /**
   * 根据槽位查找装备物品
   * @param {string} slot 装备槽位
   * @param {string} itemId 物品ID
   * @returns {*} 装备物品
   * @private
   */
  EquipmentService.prototype._findItemBySlot = function(slot, itemId) {
    if (!itemId) return null;
    if (slot === SLOT.MAIN_WEAPON && typeof findWeapon === 'function') {
      return findWeapon(itemId);
    }
    if (slot === SLOT.SHIELD && typeof findShield === 'function') {
      return findShield(itemId);
    }
    if (slot === SLOT.ARMOR && typeof findArmor === 'function') {
      return findArmor(itemId);
    }
    if (slot === SLOT.MOUNT && typeof findMount === 'function') {
      return findMount(itemId);
    }
    return null;
  };

  /**
   * 获取背包数据引用
   * @returns {Object}
   * @private
   */
  EquipmentService.prototype._getInventory = function() {
    if (typeof GameState !== 'undefined' && GameState && GameState.inventory) {
      return GameState.inventory;
    }
    return null;
  };

  /**
   * 根据槽位类型获取背包分类名称
   * @param {string} slotType 槽位类型
   * @returns {string|null}
   * @private
   */
  EquipmentService.prototype._getInventoryCategory = function(slotType) {
    if (slotType === 'mainWeapon' || slotType === 'weapons') return 'weapons';
    if (slotType === 'shield' || slotType === 'shields') return 'shields';
    if (slotType === 'armor' || slotType === 'armors') return 'armors';
    if (slotType === 'mount' || slotType === 'mounts') return 'mounts';
    return null;
  };

  // ===== 装备操作公共接口 =====

  /**
   * 装备物品到单位
   * @description 将指定物品装备到单位的指定槽位，槽位已有装备则先卸下
   * @param {UnitDef} unitDef 单位定义
   * @param {string} slot 装备槽位 (mainWeapon/shield/armor/mount)
   * @param {string} itemId 物品ID
   * @returns {EquipResult} 装备结果
   * @fires equipment:changed
   * @example
   * var result = EquipmentService.equipItem(unitDef, 'mainWeapon', 'W001');
   * if (result.success) {
   *   console.log('装备成功', result.unequipped);
   * }
   */
  EquipmentService.prototype.equipItem = function(unitDef, slot, itemId) {
    if (!unitDef || !unitDef.equipment) {
      return { success: false, unequipped: null, message: '无效的兵团数据' };
    }

    var raceId = unitDef.race && unitDef.race.id;
    var isBeast = isBeastRace(raceId);

    if (isBeast && slot !== 'armor') {
      return { success: false, unequipped: null, message: '野兽种族只能装备护甲，无法装备武器、盾牌或坐骑' };
    }

    var item = this._findItemBySlot(slot, itemId);
    if (!item) {
      return { success: false, unequipped: null, message: '装备不存在' };
    }

    if (isBeast && slot === 'armor' && item.forScale) {
      var sizeCat = getSizeCategory(raceId);
      if (item.forScale.indexOf(sizeCat) < 0) {
        return { success: false, unequipped: null, message: '该护甲不适用于' + sizeCat + '体型单位' };
      }
    }

    var unequipped = this.unequipItem(unitDef, slot);

    unitDef.equipment[slot] = itemId;

    if (slot === SLOT.MAIN_WEAPON && item.handed === 'two-handed' && unitDef.equipment.shield) {
      var shieldItem = this.unequipItem(unitDef, 'shield');
      if (shieldItem) {
        unequipped = unequipped ? [unequipped, shieldItem] : shieldItem;
      }
    }

    var unitType = this._getUnitType(unitDef);
    this._emit('equipment:changed', {
      unitType: unitType,
      slot: slot,
      item: item
    });

    return { success: true, unequipped: unequipped, message: '' };
  };

  /**
   * 卸下单位指定槽位的装备
   * @param {UnitDef} unitDef 单位定义
   * @param {string} slot 装备槽位
   * @returns {*} 被卸下的装备对象，失败返回null
   * @fires equipment:changed
   * @example
   * var item = EquipmentService.unequipItem(unitDef, 'shield');
   * if (item) {
   *   console.log('卸下了', item.name);
   * }
   */
  EquipmentService.prototype.unequipItem = function(unitDef, slot) {
    if (!unitDef || !unitDef.equipment) return null;
    var eqId = unitDef.equipment[slot];
    if (!eqId) return null;

    var item = this._findItemBySlot(slot, eqId);
    if (!item) return null;

    if (item._natural) return null;

    unitDef.equipment[slot] = null;

    var unitType = this._getUnitType(unitDef);
    this._emit('equipment:changed', {
      unitType: unitType,
      slot: slot,
      item: null
    });

    return item;
  };

  /**
   * 从背包装备物品到单位
   * @description 从背包中取出物品装备到单位，原装备回收到背包
   * @param {UnitDef} unitDef 单位定义
   * @param {string} slot 装备槽位
   * @param {string} itemId 物品ID
   * @returns {EquipResult} 装备结果
   * @fires equipment:changed
   * @fires inventory:changed
   * @example
   * var result = EquipmentService.equipFromInventory(unitDef, 'armor', 'A001');
   * if (result.success) {
   *   console.log('装备成功');
   * } else {
   *   console.log('装备失败:', result.reason);
   * }
   */
  EquipmentService.prototype.equipFromInventory = function(unitDef, slot, itemId) {
    var item = this.findInInventory(itemId);
    if (!item) return { success: false };

    if (!this.isCompatible(unitDef, item)) {
      return { success: false, reason: '该装备不适用此兵种' };
    }

    if (slot === 'shield' && !this.canUseShield(unitDef)) {
      return { success: false, reason: '当前主武器为双手武器，无法装备盾牌' };
    }

    var currentItem = this.unequipToInventory(unitDef, slot);
    this.removeFromInventory(itemId);
    unitDef.equipment[slot] = itemId;

    if (slot === SLOT.MAIN_WEAPON && item.handed === 'two-handed' && unitDef.equipment.shield) {
      this.unequipToInventory(unitDef, 'shield');
    }

    return { success: true, unequipped: currentItem };
  };

  /**
   * 卸下单位装备到背包
   * @param {UnitDef} unitDef 单位定义
   * @param {string} slot 装备槽位
   * @returns {*} 被卸下的装备对象，失败返回null
   * @fires equipment:changed
   * @fires inventory:changed
   * @example
   * var item = EquipmentService.unequipToInventory(unitDef, 'mainWeapon');
   * if (item) {
   *   console.log('已放入背包:', item.name);
   * }
   */
  EquipmentService.prototype.unequipToInventory = function(unitDef, slot) {
    var item = this.unequipItem(unitDef, slot);
    if (item) {
      this.addToInventory(item, slot);
      if (slot === SLOT.MAIN_WEAPON && item.handed === 'two-handed' && unitDef.equipment.shield) {
        var shieldItem = this.unequipItem(unitDef, 'shield');
        if (shieldItem) this.addToInventory(shieldItem, 'shield');
      }
    }
    return item;
  };

  // ===== 装备检查接口 =====

  /**
   * 判断单位能否使用盾牌
   * @description 检查当前主武器是否为双手武器，双手武器不能装备盾牌
   * @param {UnitDef} unitDef 单位定义
   * @returns {boolean} 是否可以使用盾牌
   * @example
   * if (EquipmentService.canUseShield(unitDef)) {
   *   console.log('可以装备盾牌');
   * }
   */
  EquipmentService.prototype.canUseShield = function(unitDef) {
    if (!unitDef || !unitDef.equipment) return false;
    if (!unitDef.equipment.mainWeapon) return true;
    var mw = this._findItemBySlot(SLOT.MAIN_WEAPON, unitDef.equipment.mainWeapon);
    if (!mw) return true;
    return mw.handed !== 'two-handed';
  };

  /**
   * 判断装备是否适配该单位
   * @param {UnitDef} unitDef 单位定义
   * @param {*} item 装备物品
   * @returns {boolean} 是否适配
   * @example
   * if (EquipmentService.isCompatible(unitDef, weapon)) {
   *   console.log('该兵种可以使用此装备');
   * }
   */
  EquipmentService.prototype.isCompatible = function(unitDef, item) {
    if (!item) return true;
    var baseType = unitDef.baseType || unitDef.type || '';
    var raceId = unitDef.race && unitDef.race.id;
    var isBeast = isBeastRace(raceId);

    if (isBeast) {
      if (item.slot && item.slot !== 'armor' && item.category !== '护甲' && item.category !== '轻甲' && item.category !== '中甲' && item.category !== '重甲' && item.category !== '特殊') {
        if (item.category === '近战武器' || item.category === '远程武器' || item.category === '盾牌' || item.category === '坐骑') {
          return false;
        }
      }
      if (item.forScale) {
        var sizeCat = getSizeCategory(raceId);
        if (item.forScale.indexOf(sizeCat) < 0) return false;
      }
      return true;
    }

    if (!item.forUnits) {
      // 坐骑兜底检查：AI生成的装备可能没有forUnits，但坐骑只能骑兵/空军装
      var isMount = item.scale !== undefined && item.bonusHP !== undefined && !item.handed && item.category !== '盾牌' && !item.forScale;
      if (isMount) {
        if (baseType !== 'cavalry' && baseType !== 'flying') return false;
      }
      return true;
    }
    if (item.forUnits.indexOf('全兵种') >= 0) return true;

    // ==== 骑射判定：弓/弩武器需要"骑射"效果才能给骑兵/空军装备 ====
    var isRangedWpn = item.type === 'bow' || item.type === 'crossbow' || item.category === '远程武器';
    if (isRangedWpn) {
      var bt = unitDef.baseType || unitDef.type || '';
      if (bt === 'cavalry') {
        if (!unitDef._mountedArcher) return false;
        if (!item.effects || item.effects.indexOf('骑射') < 0) return false;
        return true;
      }
      if (bt === 'flying') {
        if (!unitDef._rangedFlying) return false;
        if (!item.effects || item.effects.indexOf('骑射') < 0) return false;
        return true;
      }
    }

    var typeName = unitDef.typeName || '';
    var typeMap = {
      'infantry': '步兵', 'cavalry': '骑兵', 'archer': '远程兵', 'flying': '空军',
      'peasant_infantry': '步兵', 'peasant_archer': '远程兵', 'elite_archer': '远程兵'
    };
    var cnType = typeMap[baseType] || typeName;
    for (var i = 0; i < item.forUnits.length; i++) {
      var fu = item.forUnits[i];
      if (fu === cnType) return true;
      if (fu === '轻步兵' && baseType === 'infantry') return true;
      if (fu === '重步兵' && baseType === 'infantry') return true;
      if (fu === '枪兵' && baseType === 'infantry') return true;
      if (fu === '轻骑兵' && baseType === 'cavalry') return true;
      if (fu === '重骑兵' && baseType === 'cavalry') return true;
      if (fu === '刺客' && baseType === 'infantry') return true;
    }
    return false;
  };

  /**
   * 检查某个槽位是否可以装备
   * @param {UnitDef} unitDef 单位定义
   * @param {string} slot 装备槽位
   * @returns {boolean}
   */
  EquipmentService.prototype.canEquipSlot = function(unitDef, slot) {
    if (!unitDef || !unitDef.race) return true;
    var raceId = unitDef.race.id;
    if (isBeastRace(raceId)) {
      return slot === 'armor';
    }
    return true;
  };

  // ===== 背包操作公共接口 =====

  /**
   * 添加物品到背包
   * @param {*} item 装备物品
   * @param {string} slotType 槽位类型 (mainWeapon/shield/armor/mount 或 weapons/shields/armors/mounts)
   * @returns {boolean} 是否成功
   * @fires inventory:changed
   * @example
   * EquipmentService.addToInventory(weapon, 'mainWeapon');
   */
  EquipmentService.prototype.addToInventory = function(item, slotType) {
    if (!item) return false;
    var inv = this._getInventory();
    if (!inv) return false;

    var category = this._getInventoryCategory(slotType);
    if (!category) return false;

    if (!inv[category]) inv[category] = [];
    inv[category].push(item);

    this._emit('inventory:changed', { action: 'add', item: item });
    return true;
  };

  /**
   * 从背包移除物品
   * @param {string} itemId 物品ID
   * @returns {*} 被移除的物品，失败返回null
   * @fires inventory:changed
   * @example
   * var item = EquipmentService.removeFromInventory('W001');
   * if (item) {
   *   console.log('已移除:', item.name);
   * }
   */
  EquipmentService.prototype.removeFromInventory = function(itemId) {
    var inv = this._getInventory();
    if (!inv) return null;

    var categories = ['weapons', 'shields', 'armors', 'mounts'];
    for (var c = 0; c < categories.length; c++) {
      var arr = inv[categories[c]];
      if (!arr) continue;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === itemId) {
          var removed = arr.splice(i, 1)[0];
          this._emit('inventory:changed', { action: 'remove', item: removed });
          return removed;
        }
      }
    }
    return null;
  };

  /**
   * 在背包中查找物品
   * @param {string} itemId 物品ID
   * @returns {*} 找到的物品，未找到返回null
   * @example
   * var item = EquipmentService.findInInventory('W001');
   * if (item) {
   *   console.log('背包中有:', item.name);
   * }
   */
  EquipmentService.prototype.findInInventory = function(itemId) {
    var inv = this._getInventory();
    if (!inv) return null;
    var all = (inv.weapons || []).concat((inv.shields || []), (inv.armors || []), (inv.mounts || []));
    return all.find(function(it) { return it.id === itemId; }) || null;
  };

  /**
   * 获取背包物品总数
   * @returns {number} 背包物品数量
   * @example
   * var count = EquipmentService.getInventoryCount();
   * console.log('背包物品数:', count);
   */
  EquipmentService.prototype.getInventoryCount = function() {
    var inv = this._getInventory();
    if (!inv) return 0;
    return inv.weapons.length + ((inv.shields && inv.shields.length) || 0) + inv.armors.length + inv.mounts.length;
  };

  // ===== 导出单例 =====

  /**
   * EquipmentService 单例实例
   * @global
   * @type {EquipmentService}
   */
  global.EquipmentService = new EquipmentService();

})(typeof window !== 'undefined' ? window : this);
