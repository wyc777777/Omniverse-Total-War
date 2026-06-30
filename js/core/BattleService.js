// ==================== BattleService 战斗服务 ====================
/**
 * @file 战斗服务模块 - 提供战斗系统的统一访问接口
 * @description 封装战斗计算、回合管理、胜负判定等功能，
 *              并通过EventBus发布战斗相关事件。
 *              作为战斗流程的统一入口，全局函数仅作为薄包装。
 * @example
 * // 开始战斗
 * BattleService.startBattle(playerUnits, enemyUnits, options);
 *
 * // 监听战斗开始事件
 * EventBus.on('battle:started', function(data) {
 *   console.log('战斗开始！', data);
 * });
 *
 * // 检查胜负
 * var result = BattleService.checkVictory();
 */

(function(global) {
  'use strict';

  /** @type {BattleService|null} */
  var _instance = null;

  /**
   * 战斗服务类 - 单例模式
   * @class
   */
  function BattleService() {
    if (_instance) {
      return _instance;
    }
    _instance = this;

    this._battleState = {
      playerUnits: [],
      enemyUnits: [],
      options: {},
      isActive: false
    };
  }

  // ===== 私有辅助方法 =====

  /**
   * 触发事件总线事件
   * @param {string} eventName - 事件名称
   * @param {*} [data] - 事件数据
   * @private
   */
  BattleService.prototype._emit = function(eventName, data) {
    if (typeof EventBus !== 'undefined' && EventBus.emit) {
      EventBus.emit(eventName, data);
    }
  };

  /**
   * 获取棋子在棋盘上的 key
   * @param {Object} piece - 棋子对象
   * @returns {string} 棋子的 hex key
   * @private
   */
  BattleService.prototype._getPieceKey = function(piece) {
    if (!piece || !piece.hex) return '';
    return piece.hex.q + ',' + piece.hex.r + ',' + piece.hex.s;
  };

  // ===== 公共接口：战斗流程 =====

  /**
   * 开始战斗
   * @param {Array} [playerUnits] - 玩家单位列表
   * @param {Array} [enemyUnits] - 敌方单位列表
   * @param {Object} [options] - 战斗选项
   * @description 初始化战斗流程，掷骰决定先后手，进入部署阶段。
   *              触发 battle:started 事件。
   * @fires battle:started
   */
  BattleService.prototype.startBattle = function(playerUnits, enemyUnits, options) {
    this._battleState.playerUnits = playerUnits || [];
    this._battleState.enemyUnits = enemyUnits || [];
    this._battleState.options = options || {};
    this._battleState.isActive = true;

    if (typeof GameState !== 'undefined' && GameState.points !== undefined) {
      GameState.pointsBeforeBattle = GameState.points;
    }

    if (typeof rollDiceAndStart === 'function') {
      rollDiceAndStart();
    }

    this._emit('battle:started', {
      playerUnits: this._battleState.playerUnits,
      enemyUnits: this._battleState.enemyUnits,
      options: this._battleState.options
    });
  };

  /**
   * 检查胜负条件
   * @returns {Object|null} 战斗结果对象，若未分胜负则返回 null
   * @property {string} winner - 获胜方 ('player' | 'enemy')
   * @property {string} reason - 胜负原因
   * @property {number} playerAlive - 我方存活数量
   * @property {number} playerRouted - 我方溃逃数量
   * @property {number} enemyAlive - 敌方存活数量
   * @property {number} enemyRouted - 敌方溃逃数量
   * @description 检查当前战场的胜负条件，逻辑与 checkVictoryCondition 完全一致。
   */
  BattleService.prototype.checkVictory = function() {
    if (typeof placedPieces === 'undefined') return null;

    var playerAlive = 0, enemyAlive = 0;

    Object.keys(placedPieces).forEach(function(key) {
      var p = placedPieces[key];
      if (p._routed) return;
      if (p.team === 'player') playerAlive++;
      else enemyAlive++;
    });

    var playerTotal = 0;
    var enemyTotal = 0;
    if (typeof TurnState !== 'undefined') {
      playerTotal = TurnState.totalPlayer || 0;
      enemyTotal = TurnState.totalEnemy || 0;
    }

    if (playerTotal === 0 && enemyTotal === 0) return null;

    if (enemyAlive === 0 && enemyTotal > 0) {
      return {
        winner: 'player',
        reason: '全员被歼灭',
        playerAlive: playerAlive,
        playerRouted: playerTotal - playerAlive,
        enemyAlive: 0,
        enemyRouted: enemyTotal
      };
    }

    if (playerAlive === 0 && playerTotal > 0) {
      return {
        winner: 'enemy',
        reason: '全员被歼灭',
        playerAlive: 0,
        playerRouted: playerTotal,
        enemyAlive: enemyAlive,
        enemyRouted: enemyTotal - enemyAlive
      };
    }

    return null;
  };

  /**
   * 检查并触发胜负
   * @description 立即检查胜负条件，若已分胜负则延迟触发战斗结算。
   *              只在战斗阶段检查。
   */
  BattleService.prototype.checkAndTrigger = function() {
    if (typeof TurnState === 'undefined') return;
    if (TurnState.phase !== 'battle') return;

    var result = this.checkVictory();
    if (!result) return;

    if (this._endingPending) return;
    this._endingPending = true;
    var self = this;
    setTimeout(function() {
      self.endBattle(result);
      self._endingPending = false;
    }, 800);
  };

  /**
   * 结束战斗
   * @param {Object} result - 战斗结果对象
   * @param {string} result.winner - 获胜方 ('player' | 'enemy')
   * @param {string} result.reason - 胜负原因
   * @param {number} [result.playerAlive] - 我方存活数量
   * @param {number} [result.playerRouted] - 我方溃逃数量
   * @param {number} [result.enemyAlive] - 敌方存活数量
   * @param {number} [result.enemyRouted] - 敌方溃逃数量
   * @description 触发战斗结算，显示结算界面，更新积分。
   *              内部调用全局 triggerBattleEnd 函数。
   *              触发 battle:ended 事件。
   * @fires battle:ended
   */
  BattleService.prototype.endBattle = function(result) {
    this._battleState.isActive = false;

    if (typeof triggerBattleEnd === 'function') {
      triggerBattleEnd(result);
    }

    var reward = 0;
    if (result && result.winner === 'player') {
      if (typeof GameState !== 'undefined' && GameState.points !== undefined) {
        var pointsBefore = GameState.pointsBeforeBattle || 0;
        reward = GameState.points - pointsBefore;
      }
    }

    this._emit('battle:ended', {
      result: result,
      winner: result ? result.winner : null,
      reward: reward
    });
  };

  // ===== 公共接口：伤害计算 =====

  /**
   * 计算伤害值
   * @param {Object} attacker - 攻击方棋子对象
   * @param {Object} defender - 防御方棋子对象
   * @param {Object|boolean} [options] - 选项对象或 isRanged 布尔值（向后兼容）
   * @param {boolean} [options.isRanged=false] - 是否为远程攻击
   * @returns {number} 计算出的总伤害值
   * @description 基于现有战斗公式计算伤害值，
   *              复用 unitDefByType、computeStats 等全局函数。
   *              注意：此为基础伤害计算，不含冲锋、方位、士气等复杂战斗因素。
   */
  BattleService.prototype.calculateDamage = function(attacker, defender, options) {
    if (!attacker || !defender) return 0;

    var isRanged = false;
    if (typeof options === 'boolean') {
      isRanged = options;
    } else if (options && typeof options === 'object') {
      isRanged = options.isRanged || false;
    }

    var atkUD = typeof unitDefByType === 'function' ? unitDefByType(attacker.unitType) : null;
    var defUD = typeof unitDefByType === 'function' ? unitDefByType(defender.unitType) : null;
    if (!atkUD || !defUD) return 0;

    var atkSt = typeof computeStats === 'function' ? computeStats(atkUD) : null;
    var defSt = typeof computeStats === 'function' ? computeStats(defUD) : null;
    if (!atkSt || !defSt) return 0;

    if (attacker._currentHP !== undefined) atkSt.totalHP = attacker._currentHP;
    if (attacker._currentCount !== undefined) {
      atkSt.unitCount = attacker._currentCount;
      atkSt.totalScale = atkSt.unitScale * atkSt.unitCount;
    }
    if (attacker._currentMorale !== undefined) atkSt.morale = attacker._currentMorale;
    if (defender._currentHP !== undefined) defSt.totalHP = defender._currentHP;
    if (defender._currentCount !== undefined) {
      defSt.unitCount = defender._currentCount;
      defSt.totalScale = defSt.unitScale * defSt.unitCount;
    }
    if (defender._currentMorale !== undefined) defSt.morale = defender._currentMorale;

    var weapon = atkSt.mainWeapon;
    var atkBase = weapon ? weapon.baseDamage : atkSt.race.naturalWeapon;
    var atkAP = weapon ? weapon.armorPierce : 0;
    var atkRangeVal = atkSt.attackRange || 1;

    var atkLimit = atkSt.unitCount;
    var effectiveArmor = defSt.totalArmor;

    var rawDmg = atkBase - effectiveArmor;
    if (rawDmg < atkAP) rawDmg = atkAP;
    if (rawDmg < 1) rawDmg = 1;

    if (isRanged && defSt.rangedResist > 0) {
      rawDmg = Math.max(1, rawDmg - Math.round(rawDmg * defSt.rangedResist));
    }

    var crossbowBonus = 1.0;
    if (isRanged && atkSt.mainWeapon && atkSt.mainWeapon.type === 'crossbow' && defSt.totalArmor >= 30) {
      crossbowBonus = 1.2;
    }

    var finalDmg = Math.round(rawDmg * atkRangeVal * atkLimit * crossbowBonus);
    if (finalDmg < 1) finalDmg = 1;

    return finalDmg;
  };

  /**
   * 执行攻击
   * @param {Object} atkPiece - 攻击方棋子对象
   * @param {Object} defPiece - 防御方棋子对象
   * @description 执行完整的攻击流程，调用全局 executeCombat 函数。
   *              触发 battle:attack 事件。
   * @fires battle:attack
   */
  BattleService.prototype.doAttack = function(atkPiece, defPiece) {
    if (!atkPiece || !defPiece) return;

    var atkKey = this._getPieceKey(atkPiece);
    var defKey = this._getPieceKey(defPiece);
    if (!atkKey || !defKey) return;

    var isRanged = false;
    if (typeof hDist === 'function' && atkPiece.hex && defPiece.hex) {
      isRanged = hDist(atkPiece.hex, defPiece.hex) > 1;
    }

    var damage = 0;
    if (typeof executeCombat === 'function') {
      damage = executeCombat(atkKey, defKey) || 0;
    }

    this._emit('battle:attack', {
      attacker: atkPiece,
      defender: defPiece,
      damage: damage
    });
  };

  // ===== 公共接口：战斗状态 =====

  /**
   * 获取当前战斗状态
   * @returns {Object} 当前战斗状态对象
   * @property {Array} playerUnits - 玩家单位列表
   * @property {Array} enemyUnits - 敌方单位列表
   * @property {Object} options - 战斗选项
   * @property {boolean} isActive - 战斗是否进行中
   * @property {Object} turnState - 回合状态（TurnState 的引用）
   * @description 返回当前战斗的完整状态信息。
   */
  BattleService.prototype.getBattleState = function() {
    var turnState = null;
    if (typeof TurnState !== 'undefined') {
      turnState = TurnState;
    }

    return {
      playerUnits: this._battleState.playerUnits,
      enemyUnits: this._battleState.enemyUnits,
      options: this._battleState.options,
      isActive: this._battleState.isActive,
      turnState: turnState
    };
  };

  /**
   * 获取当前回合状态
   * @returns {Object} TurnState 回合状态对象
   * @property {number} currentRound - 当前回合数
   * @property {string} currentPlayer - 当前行动方 ('player' | 'enemy')
   * @property {string} phase - 当前阶段 ('dice' | 'deploy' | 'battle' | 'ended')
   * @property {string} firstPlayer - 先手方
   * @property {string} difficulty - 难度等级
   * @property {Object} deployCount - 部署计数
   * @property {number} totalPlayer - 我方总数
   * @property {number} totalEnemy - 敌方总数
   * @description 返回全局 TurnState 对象的引用。
   */
  BattleService.prototype.getTurnState = function() {
    if (typeof TurnState !== 'undefined') {
      return TurnState;
    }
    return null;
  };

  // ===== 公共接口：战报与棋子属性 =====

  /**
   * 添加战报行
   * @param {string} line - 战报内容（支持HTML）
   * @description 向战报中添加一行内容，调用全局 addWarReportLine 函数。
   */
  BattleService.prototype.addWarReportLine = function(line) {
    if (typeof addWarReportLine === 'function') {
      addWarReportLine(line);
    }
  };

  /**
   * 获取棋子完整属性
   * @param {Object} piece - 棋子对象
   * @returns {Object|null} 计算后的属性对象
   * @description 获取棋子的完整属性（含运行时状态），调用全局 getPieceStats 函数。
   */
  BattleService.prototype.getPieceStats = function(piece) {
    if (typeof getPieceStats === 'function') {
      return getPieceStats(piece);
    }
    return null;
  };

  // ===== 导出单例 =====

  /**
   * BattleService 单例实例
   * @global
   * @type {BattleService}
   */
  global.BattleService = new BattleService();

})(typeof window !== 'undefined' ? window : this);
