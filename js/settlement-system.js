// ===== 战斗结算系统 =====
// 胜利/失败判定与积分奖励
// 说明：积分奖励由各自对战类型（关卡/AI对战）独立计算，不在此处统一处理
// 注意：胜负判定逻辑已迁移至 BattleService，此处仅作为薄包装保持向后兼容

// ===== 检查是否需要判定胜负 =====
function checkVictoryCondition() {
  if (typeof BattleService !== 'undefined' && BattleService.checkVictory) {
    return BattleService.checkVictory();
  }
  return null;
}

// ===== 立即检查胜负（在每次战斗/回合变化时）=====
function checkAndTriggerVictory() {
  if (typeof BattleService !== 'undefined' && BattleService.checkAndTrigger) {
    BattleService.checkAndTrigger();
  }
}

// ===== 触发战斗结束 =====
function triggerBattleEnd(result) {
  TurnState.phase = 'ended';

  var isPlayerWin = result.winner === 'player';

  // 关卡战斗结算
  var isLevelBattle = false;
  if (typeof TurnState !== 'undefined' && TurnState.isLevelBattle) isLevelBattle = true;
  else if (typeof LEVEL_BATTLE_STATE !== 'undefined' && LEVEL_BATTLE_STATE.currentLevelOpponent) isLevelBattle = true;

  if (isLevelBattle && typeof showLevelBattleSettlement === 'function') {
    var levelHandled = showLevelBattleSettlement(result);
    if (levelHandled) {
      var levelWarReport = document.getElementById('warReport');
      if (levelWarReport) levelWarReport.style.display = 'none';
      return;
    }
  }

  // AI对战结算
  var isAIBattle = false;
  if (typeof TurnState !== 'undefined' && TurnState.isAIBattle) isAIBattle = true;
  else if (typeof AI_BATTLE_STATE !== 'undefined' && AI_BATTLE_STATE.currentOpponent) isAIBattle = true;

  if (isAIBattle && typeof showAIBattleSettlement === 'function') {
    var pointsDelta = 0;
    if (isPlayerWin && typeof AI_BATTLE_STATE !== 'undefined' && AI_BATTLE_STATE.currentOpponent) {
      var opp = AI_BATTLE_STATE.currentOpponent;
      if (typeof AI_TIER_DIFFICULTY !== 'undefined' && AI_TIER_DIFFICULTY[opp.tier]) {
        pointsDelta = AI_TIER_DIFFICULTY[opp.tier].reward;
      }
    }
    if (isPlayerWin && pointsDelta > 0) {
      GameState.points += pointsDelta;
      saveToBrowser(GameState.saveName);
    }
    // 装备掉落（仅胜利时）：从敌方单位随机抽取 2 件非天然装备
    var aiDroppedItems = [];
    if (isPlayerWin) {
      aiDroppedItems = collectAIBattleEquipmentDrops();
      aiDroppedItems.forEach(function(d) {
        if (d.item && typeof addItemToInventory === 'function') {
          addItemToInventory(d.item, d.slot);
        }
      });
      if (aiDroppedItems.length > 0) {
        saveToBrowser(GameState.saveName);
      }
    }
    var report = generateSettlementReport(result, pointsDelta);
    var handled = showAIBattleSettlement(result, pointsDelta, report, aiDroppedItems);
    if (handled) {
      var aiWarReport = document.getElementById('warReport');
      if (aiWarReport) aiWarReport.style.display = 'none';
      return;
    }
  }

  // 斗蛐蛐结算（双 AI 观战或双人手操）
  var isDuelBattle = false;
  if (typeof TurnState !== 'undefined' && TurnState.isDuelBattle) isDuelBattle = true;
  else if (typeof DUEL_STATE !== 'undefined' && (DUEL_STATE.sideA || DUEL_STATE.sideB)) isDuelBattle = true;

  if (isDuelBattle && typeof showDuelBattleSettlement === 'function') {
    var handled = showDuelBattleSettlement(result);
    if (handled) {
      var duelWarReport = document.getElementById('warReport');
      if (duelWarReport) duelWarReport.style.display = 'none';
      return;
    }
  }

  var warReport = document.getElementById('warReport');
  if (warReport) warReport.style.display = 'none';
}

// ===== 生成结算报告 =====
function generateSettlementReport(result, pointsDelta) {
  var lines = [];

  lines.push('【战场总览】');
  lines.push('我方：存活 ' + result.playerAlive + ' 支 | 溃逃 ' + result.playerRouted + ' 支');
  lines.push('敌方：存活 ' + result.enemyAlive + ' 支 | 溃逃 ' + result.enemyRouted + ' 支');
  lines.push('');
  lines.push('【失败原因】');
  lines.push(result.reason);

  if (result.winner === 'player') {
    lines.push('');
    lines.push('【积分变化】');
    lines.push('+ ' + pointsDelta + ' 积分（战斗胜利奖励）');
    lines.push('当前总积分：' + GameState.points);
  }

  return lines.join('\n');
}

// ===== 收集 AI 对战装备掉落 =====
// 规则：从敌方所有兵团的装备中随机抽取 2 件非天然装备
// 排除：空槽位、天然装备（_natural/_fist_ 前缀）、独特装备（_unique 标记）
// 池子不足时按实际数量掉落
function collectAIBattleEquipmentDrops() {
  var droppedItems = [];
  if (typeof AI_BATTLE_STATE === 'undefined' || !AI_BATTLE_STATE.currentOpponent) return droppedItems;
  var opp = AI_BATTLE_STATE.currentOpponent;
  var units = opp.units || [];

  // 收集敌方所有装备id（含其槽位信息）
  var enemyEquipIds = [];
  units.forEach(function(u) {
    if (!u.equipment) return;
    var slots = ['mainWeapon', 'shield', 'armor', 'mount'];
    slots.forEach(function(slot) {
      var eqId = u.equipment[slot];
      if (!eqId) return;
      if (typeof eqId !== 'string') return;
      if (eqId.indexOf('_natural') === 0) return;   // 天然武器
      if (eqId.indexOf('_fist_') === 0) return;     // 拳头类天然武器
      var found = (typeof findEquipmentEntryById === 'function') ? findEquipmentEntryById(eqId) : null;
      if (!found) return;
      if (found.item && found.item._unique) return; // 排除独特装备
      enemyEquipIds.push({ id: eqId, slot: slot });
    });
  });

  // Fisher-Yates 洗牌
  for (var i = enemyEquipIds.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = enemyEquipIds[i]; enemyEquipIds[i] = enemyEquipIds[j]; enemyEquipIds[j] = tmp;
  }

  // 随机抽取 2 件（不足则按实际数量）
  var count = Math.min(2, enemyEquipIds.length);
  for (var k = 0; k < count; k++) {
    var eqEntry = enemyEquipIds[k];
    var found = (typeof findEquipmentEntryById === 'function') ? findEquipmentEntryById(eqEntry.id) : null;
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

// ===== 暴露给全局 =====
window.checkVictoryCondition = checkVictoryCondition;
window.checkAndTriggerVictory = checkAndTriggerVictory;
window.triggerBattleEnd = triggerBattleEnd;
window.collectAIBattleEquipmentDrops = collectAIBattleEquipmentDrops;
