// AI路径引导：如需查找其他文件路径和功能说明，请先查看项目根目录的 AI_PATH_GUIDE.md；每新增/修改一个文件后，必须同步更新AI_PATH_GUIDE.md
// ==================== 交战引擎 ====================
// 阶段0-4完整战斗解析，基于《万界全面战争战场策划案》

// 存储战报（供面板显示）
var lastWarReport = '';

// 检查弓兵是否被相邻敌军封锁（惧怕近身特性）
// 持 bow 类武器且相邻格有敌军→返回 true；弩类（crossbow）与其他武器不受影响
function isBowBlockedByAdjacentEnemy(piece) {
  if (!piece) return false;
  var ud = unitDefByType(piece.unitType);
  if (!ud || !ud.equipment || !ud.equipment.mainWeapon) return false;
  var wpn = ED && ED.weapons ? ED.weapons.find(function(w) { return w.id === ud.equipment.mainWeapon; }) : null;
  if (!wpn || wpn.type !== 'bow') return false;
  // 检查相邻格是否有敌军
  var blocked = false;
  // 使用 BoardAPI 解耦 API 遍历棋子
  BoardAPI.forEach(function(p, k) {
    if (p.team !== piece.team && !p._routed && hDist(piece.hex, p.hex) <= 1) blocked = true;
  });
  return blocked;
}

// ★ 主入口：攻击方key → 防御方key
function executeCombat(atkKey, defKey) {
  // 使用 BoardAPI 解耦 API 读取棋子
  var atkPiece = BoardAPI.getPiece(atkKey);
  var defPiece = BoardAPI.getPiece(defKey);
  if (!atkPiece || !defPiece) {
    if (console && console.warn) console.warn('[战斗] 找不到棋子', atkKey, defKey);
    return;
  }
  if (atkPiece._routed || defPiece._routed) {
    if (console && console.warn) console.warn('[战斗] 棋子已溃散', atkKey, defKey);
    return;
  }

  var atkUD = unitDefByType(atkPiece.unitType);
  var defUD = unitDefByType(defPiece.unitType);
  if (!atkUD || !defUD) {
    if (console && console.warn) console.warn('[战斗] 找不到单位定义', atkPiece.unitType, defPiece.unitType);
    return;
  }

  // 脏数据消毒：如果运行时状态是NaN→用原始值覆盖（斩断NaN传染链）
  if (isNaN(atkPiece._currentCount)) atkPiece._currentCount = atkUD.unitCount;
  if (isNaN(atkPiece._currentHP)) atkPiece._currentHP = computeStats(atkUD).totalHP;
  if (isNaN(defPiece._currentCount)) defPiece._currentCount = defUD.unitCount;
  if (isNaN(defPiece._currentHP)) defPiece._currentHP = computeStats(defUD).totalHP;

  // ★ 弓兵近战封锁：持bow武器+相邻有敌军→无法攻击
  if (isBowBlockedByAdjacentEnemy(atkPiece)) {
    showToast(atkUD.name + ' 被贴近，无法攻击！', 'warning');
    return;
  }

  // 数据快照（阶段0-4）
  var atkSt = computeStats(atkUD);
  var defSt = computeStats(defUD);
  if (!atkSt || !defSt) return;

  // 导入运行时状态
  if (atkPiece._currentHP !== undefined) atkSt.totalHP = atkPiece._currentHP;
  if (atkPiece._currentCount !== undefined) { atkSt.unitCount = atkPiece._currentCount; atkSt.totalScale = atkSt.unitScale * atkSt.unitCount; }
  if (atkPiece._currentMorale !== undefined) atkSt.morale = atkPiece._currentMorale;
  if (defPiece._currentHP !== undefined) defSt.totalHP = defPiece._currentHP;
  if (defPiece._currentCount !== undefined) { defSt.unitCount = defPiece._currentCount; defSt.totalScale = defSt.unitScale * defSt.unitCount; }
  if (defPiece._currentMorale !== undefined) defSt.morale = defPiece._currentMorale;

  var dist = hDist(atkPiece.hex, defPiece.hex);
  var isRanged = dist > 1;

  // 检查近战接触禁射：弓类已被 isBowBlockedByAdjacentEnemy 提前拦截，弩类无视近战干扰
  if (isRanged && atkSt.mainWeapon) {
    var wpType = atkSt.mainWeapon.type;
    var wpEffects = atkSt.mainWeapon.effects || [];
    // 弩类或带"无视近战干扰"效果的武器：可远程攻击
    // bow 已在 isBowBlockedByAdjacentEnemy 中提前 return，此处无需再判
    if (wpType !== 'crossbow' && !hasEffect(wpEffects, 'E004')) {
      // 其他远程武器（非弓非弩）暂不处理近战封锁，保持原行为
    }
  }

  // ==== 阶段1：态势与士气预检定 ====
  var moraleEffects = [];

  // 1. 包围检定（状态型debuff由 turn-system 统一处理，此处不再重复惩罚）

  // 2. 连锁溃逃
  var routNearby = 0;
  // 使用 BoardAPI 解耦 API 遍历棋子
  BoardAPI.forEach(function(p, k) {
    if (p.team === defPiece.team && p._routed && hDist(defPiece.hex, p.hex) <= 2) routNearby++;
  });
  if (routNearby > 0) moraleEffects.push({target: 'def', amount: -3 * routNearby, reason: '连锁溃逃（2格内' + routNearby + '支友军溃逃）'});

  // 应用士气效果
  moraleEffects.forEach(function(eff) {
    if (eff.target === 'def') defSt.morale += eff.amount;
    else atkSt.morale += eff.amount;
    addWarReportLine('[士气] ' + (eff.target === 'def' ? defUD.name : atkUD.name) + ' ' + eff.reason + '，士气' + (eff.amount > 0 ? '+' : '') + eff.amount);
  });

  // ==== 阶段2：战术判定 ====

  // 冲锋动能（按移动距离分档：1.2 / 1.4 / 1.6）
  // 注：这里的格数指骑兵/空军移动后发起攻击的实际移动距离
  // 召唤单位 type 为 'cavalry_U123'，需用 baseType 判定
  var atkBaseType = atkUD.baseType || atkUD.type;
  var defBaseType = defUD.baseType || defUD.type;
  var momentum = 1.0;
  var antiCavExtra = 0; // 抵御冲锋：反骑额外伤害
  var isCharger = (atkBaseType === 'cavalry' || atkBaseType === 'flying') && !isRanged;
  if (isCharger) {
    var chargeDist0 = (typeof atkPiece._chargeDistance === 'number' && atkPiece._chargeDistance > 0) ? atkPiece._chargeDistance : 0;
    var moveDist = Math.min(chargeDist0, 4);
    if (moveDist >= 4) momentum = 1.6;
    else if (moveDist >= 3) momentum = 1.6;
    else if (moveDist >= 2) momentum = 1.4;
    else if (moveDist >= 1) momentum = 1.2;
    var chargeLabel = atkBaseType === 'flying' ? '空军俯冲' : '骑兵冲锋';
    if (momentum > 1.01) addWarReportLine('[动能] ' + atkUD.name + ' ' + chargeLabel + moveDist + '格，动能倍率 ×' + momentum.toFixed(1));
  }

  // 长柄武器抵御冲锋
  if (isCharger && defSt.mainWeapon && defSt.mainWeapon.type === 'long' && hasEffect(defSt.mainWeapon.effects, 'E001')) {
    var chargeDist = atkPiece._chargeDistance || 0;
    // 贴脸（未冲锋）：仅移除动能，无额外反骑效果
    if (dist <= 1 && chargeDist <= 1) {
      if (momentum > 1.0) {
        addWarReportLine('[克制] ' + defUD.name + ' 长柄未能拉开距离，仅抵消冲锋动能');
        momentum = 1.0;
      }
    } else {
      // 有冲锋距离：动能抵消 + 反骑额外伤害
      momentum = 1.0;
      var antiCavBonus = 1.5;
      antiCavExtra = 1; // 标记，在伤害公式中累加反骑伤害
      addWarReportLine('[克制] ' + defUD.name + ' 长柄武器抵御冲锋！动能抵消，反骑伤害×' + antiCavBonus.toFixed(1));
    }
  }

  // 空军空中震慑
  if (atkBaseType === 'flying' && atkSt.mount && hasEffect(atkSt.mount.effects, 'E007')) {
    if (defBaseType === 'infantry') {
      defSt.morale -= 5;
      addWarReportLine('[震慑] ' + atkUD.name + ' 空军对' + defUD.name + '施加空中震慑，士气-5');
    }
  }

  // ==== 方位判定（正面/侧面/背面）====
  var azimuth = 'front';
  if (defPiece._facing !== undefined && typeof getAttackAzimuth === 'function') {
    azimuth = getAttackAzimuth(atkPiece.hex, defPiece.hex, defPiece._facing);
  }

  var dirArmorReduction = 0;  // 护甲降低比例
  var dirMoralePenalty = 0;   // 士气打击
  var dirCavalryBonus = 1.0;  // 骑兵冲锋额外伤害倍率

  if (azimuth === 'flank') {
    dirArmorReduction = 0.10; // 10%护甲降低
    dirMoralePenalty = -5;    // -5士气
    if (isCharger) dirCavalryBonus = 1.2; // 侧面冲锋+20%伤害
    addWarReportLine('[侧袭] ' + atkUD.name + ' 从侧翼攻击' + defUD.name + '，护甲-10%，士气-5');
    if (typeof showDamageNumber === 'function') {
      showDamageNumber(defPiece.hex, '侧袭!', 'crit');
    }
  } else if (azimuth === 'rear') {
    dirArmorReduction = 0.20; // 20%护甲降低
    dirMoralePenalty = -10;   // -10士气
    if (isCharger) dirCavalryBonus = 1.4; // 背面冲锋+40%伤害
    addWarReportLine('[背袭] ' + atkUD.name + ' 从背后袭击' + defUD.name + '，护甲-20%，士气-10');
    if (typeof showDamageNumber === 'function') {
      showDamageNumber(defPiece.hex, '背袭!', 'crit');
    }
  }

  // 应用方位士气打击
  if (dirMoralePenalty !== 0) {
    defSt.morale += dirMoralePenalty;
  }

  // ==== 阶段3：核心伤害公式 ====

  // 选用武器
  var weapon = atkSt.mainWeapon;
  var atkBase = weapon ? weapon.baseDamage : atkSt.race.naturalWeapon;
  var atkAP = weapon ? weapon.armorPierce : 0;
  var atkRangeVal = atkSt.attackRange || 1;

  // 参与人数：兵团对兵团 = 攻击方总人数（10人限制仅对单体目标，暂未引入单体概念故取消）
  var atkLimit = atkSt.unitCount;

  // 方位护甲降低（侧袭/背袭）
  var effectiveArmor = defSt.totalArmor;
  if (dirArmorReduction > 0) {
    effectiveArmor = Math.max(0, defSt.totalArmor * (1 - dirArmorReduction));
  }

  // 强度对抗
  var rawDmg = atkBase - effectiveArmor;
  if (rawDmg < atkAP) rawDmg = atkAP;
  if (rawDmg < 1) rawDmg = 1; // 至少1点基础伤害

  // 远程免伤
  if (isRanged && defSt.rangedResist > 0) {
    rawDmg = Math.max(1, rawDmg - Math.round(rawDmg * defSt.rangedResist));
    addWarReportLine('[盾牌] ' + defUD.name + ' 远程免伤' + Math.round(defSt.rangedResist * 100) + '%');
  }

  // 弩手对重甲克制（护甲>30时伤害×1.2）
  var crossbowBonus = 1.0;
  if (isRanged && atkSt.mainWeapon && atkSt.mainWeapon.type === 'crossbow' && defSt.totalArmor >= 30) {
    crossbowBonus = 1.2;
    addWarReportLine('[克制] 弩手穿透重甲，伤害×1.2');
  }

  // 单轮伤害 = 基础伤害 × 攻击范围(打多少规模) × 参与人数 × 动能 × 骑兵方位加成 × 弩手重甲克制
  var finalDmg = Math.round(rawDmg * atkRangeVal * atkLimit * momentum * dirCavalryBonus * crossbowBonus);
  // 后手方第一回合减伤 30%
  if (typeof TurnState !== 'undefined' && TurnState.currentRound === 1 && TurnState.secondPlayer === defPiece.team) {
    var beforeReduction = finalDmg;
    finalDmg = Math.round(finalDmg * 0.7);
    if (finalDmg < 1) finalDmg = 1;
    addWarReportLine('[后手减伤] ' + defUD.name + ' 第一回合获得30%减伤，' + beforeReduction + ' → ' + finalDmg);
  }
  // 长柄抵御冲锋：额外追加反骑伤害（基础伤害 × 1.5，不参与方位/弩手二次放大）
  if (antiCavExtra) {
    var antiCavDmg = Math.round(rawDmg * atkRangeVal * atkLimit * 1.5);
    finalDmg += antiCavDmg;
    addWarReportLine('[反骑] 长柄反骑额外伤害 +' + antiCavDmg);
  }
  if (finalDmg < 1) finalDmg = 1;

  var dmgBreakdown = '[伤害] 基础' + atkBase + ' - 护甲' + Math.round(effectiveArmor) + ' = ' + Math.round(atkBase - effectiveArmor) + '（破甲保底' + atkAP + '）';
  if (dirArmorReduction > 0) dmgBreakdown += '（方位削甲' + Math.round(dirArmorReduction * 100) + '%）';
  dmgBreakdown += '× 范围' + atkRangeVal + ' × ' + atkLimit + '人 × 动能' + momentum.toFixed(2);
  if (dirCavalryBonus > 1.01) dmgBreakdown += ' × 冲锋方位' + dirCavalryBonus.toFixed(1);
  if (crossbowBonus > 1.01) dmgBreakdown += ' × 弩破甲' + crossbowBonus.toFixed(1);
  dmgBreakdown += ' = 总伤 <b>' + finalDmg + '</b>';
  addWarReportLine(dmgBreakdown);

  // ★ 攻击冲击动画（在伤害结算前触发，给视觉留出预备帧）
  if (typeof startAttackImpact === 'function') {
    startAttackImpact(atkKey, defPiece.hex);
  }

  // 血量剥离 + 溢出累计（满一个hpPerUnit才死一人）
  defSt.totalHP -= finalDmg;
  var hpPerUnitSafe = Math.max(1, defSt.hpPerUnit || 1);
  var carryOver = defPiece._accumulatedDamage || 0;
  if (isNaN(carryOver)) carryOver = 0;
  var totalDieDamage = carryOver + finalDmg;
  var lostMen = Math.floor(totalDieDamage / hpPerUnitSafe);
  defPiece._accumulatedDamage = totalDieDamage % hpPerUnitSafe;
  if (isNaN(defPiece._accumulatedDamage)) defPiece._accumulatedDamage = 0;
  defSt.unitCount = Math.max(0, defSt.unitCount - lostMen);
  defSt.totalHP = Math.max(0, defSt.unitCount * hpPerUnitSafe - defPiece._accumulatedDamage);
  if (isNaN(defSt.totalHP)) defSt.totalHP = 0;
  if (defSt.unitCount <= 0) { defSt.totalHP = 0; defPiece._accumulatedDamage = 0; }

  addWarReportLine('[战损] ' + defUD.name + ' 损失 <b>' + lostMen + '</b> 人，剩余' + defSt.unitCount + '人/' + defSt.totalHP + '血量');

  // 作战日志推送
  if (typeof addCombatLog === 'function') {
    addCombatLog(atkPiece.team, escapeHtml(atkUD.name) + ' 攻击 ' + escapeHtml(defUD.name) + ' 造成 <b>' + finalDmg + '</b> 伤害', 'attack');
  }

  // ==== 阶段4：战损与崩溃 ====
  var hpRatio = defPiece._initialHP ? defSt.totalHP / defPiece._initialHP : 1;
  var moralePenalty = 0;
  if (hpRatio <= 0.75) { moralePenalty -= 8; addWarReportLine('[战损] 血量降至75%以下，士气-8'); }
  if (hpRatio <= 0.5) { moralePenalty -= 10; addWarReportLine('[战损] 血量降至50%以下，士气-10'); }
  if (hpRatio <= 0.25) { moralePenalty -= 12; addWarReportLine('[战损] 血量降至25%以下，士气-12'); }
  defSt.morale += moralePenalty;

  // 崩溃判定
  var defRouted = false;
  var isNeverRout = defUD && defUD._neverRout;
  if (defSt.morale <= 0 && defSt.race.baseMorale !== 100 && !isNeverRout) {
    defRouted = true;
    addWarReportLine('[崩溃] ' + defUD.name + ' 士气归零，陷入崩溃！丢弃重甲溃逃！');
  } else if (isNeverRout) {
    defSt.morale = Math.max(1, defSt.morale);
  }

  // 写回运行时状态
  defPiece._currentHP = Math.max(0, defSt.totalHP);
  defPiece._currentCount = defSt.unitCount;
  defPiece._currentMorale = defSt.morale;
  atkPiece._currentMorale = atkSt.morale;
  defPiece._wasAttackedThisTurn = true; // 标记本回合被攻击过
  atkPiece._didActionThisTurn = true;  // 标记本回合行动过
  if (defRouted) defPiece._routed = true;
  if (defPiece._currentHP <= 0 || defPiece._currentCount <= 0) defPiece._routed = true;

  // ===== 记分板：记录伤害和击杀 =====
  if (typeof recordScoreboardDamage === 'function') {
    recordScoreboardDamage(atkKey, finalDmg);
  }
  if (defPiece._routed && typeof recordScoreboardKill === 'function') {
    recordScoreboardKill(atkKey);
  }

  // 击杀士气恢复：击杀者自身按血量百分比恢复士气（三选一互斥）+ 2格内友军+3
  if (defPiece._routed) {
    // 计算攻击方血量百分比
    var atkHPRatio = 1.0;
    if (atkPiece._initialHP && atkPiece._initialHP > 0) {
      atkHPRatio = (atkPiece._currentHP || 0) / atkPiece._initialHP;
    }
    // 击杀者自身士气恢复（三选一互斥）
    var selfMoraleGain = 5;
    var moraleLabel = '';
    if (atkHPRatio < 0.25) {
      selfMoraleGain = 15;
      moraleLabel = '绝地反击';
    } else if (atkHPRatio < 0.50) {
      selfMoraleGain = 10;
      moraleLabel = '破釜沉舟';
    }
    if (selfMoraleGain > 0 && atkPiece._currentMorale !== undefined) {
      atkPiece._currentMorale = Math.min(100, atkPiece._currentMorale + selfMoraleGain);
      if (moraleLabel) {
        addWarReportLine('[士气] ' + atkUD.name + ' 触发"' + moraleLabel + '"，自身士气+' + selfMoraleGain);
      }
    }
    // 友军鼓舞：击杀者2格内友军 +3士气
    // 使用 BoardAPI 解耦 API 遍历棋子
    BoardAPI.forEach(function(p, k) {
      if (p.team === atkPiece.team && !p._routed && p !== atkPiece) {
        if (hDist(p.hex, atkPiece.hex) <= 2) {
          p._currentMorale = Math.min(100, (p._currentMorale || 0) + 3);
        }
      }
    });
  }

  // ===== 视觉效果：伤害飘字 =====
  if (typeof showDamageNumber === 'function') {
    var dmgType = 'normal';
    var dmgText = '-' + finalDmg;
    if (lostMen === 0 && finalDmg > 0) { dmgType = 'normal'; }
    if (defPiece._routed) { dmgType = 'routed'; dmgText = '溃逃!'; }
    showDamageNumber(defPiece.hex, dmgText, dmgType);
    // 同时显示击杀人数
    if (lostMen > 0 && !defPiece._routed) {
      setTimeout(function(){ showDamageNumber(defPiece.hex, '-' + lostMen + '人', 'normal'); }, 200);
    }
  }

  // ★ 受击晃动动画（在伤害结算后触发，仅当防御方仍存在于棋盘时）
  if (typeof shakePiece === 'function' && BoardAPI.hasPiece(defKey)) { // 使用 BoardAPI 解耦 API 检查存在
    shakePiece(defKey);
  }

  // 生成战报
  var report = generateWarReport(atkUD, defUD, atkSt, defSt, lostMen, defRouted);
  lastWarReport = report;
  showWarReport(report);

  // 清理溃逃棋子
  if (defPiece._routed) {
    if (typeof archiveRoutedPiece === 'function') archiveRoutedPiece(defKey);
    BoardAPI.removePiece(defKey); // 使用 BoardAPI 解耦 API 移除棋子
    addWarReportLine('[消灭] ' + defUD.name + ' 已被击溃，从棋盘移除！');
    // 显示击杀漂浮提示
    if (typeof showKillNotify === 'function') showKillNotify(atkUD.name, defUD.name);
    // 作战日志：击溃
    if (typeof addCombatLog === 'function') {
      addCombatLog(atkPiece.team, escapeHtml(atkUD.name) + ' 击溃了 ' + escapeHtml(defUD.name), 'kill');
    }
  }

  requestRender();

  if (typeof updateUnitAttrPanel === 'function' && TurnState.isDuelBattle) {
    updateUnitAttrPanel('A');
    updateUnitAttrPanel('B');
  }

  return finalDmg;
}

// ===== 伤害预览（无副作用，用于悬停tooltip）=====
function computeCombatPreview(atkPiece, defPiece) {
  if (!atkPiece || !defPiece || atkPiece._routed || defPiece._routed) return null;
  var atkUD = unitDefByType(atkPiece.unitType);
  var defUD = unitDefByType(defPiece.unitType);
  if (!atkUD || !defUD) return null;

  var atkSt = computeStats(atkUD);
  var defSt = computeStats(defUD);
  if (!atkSt || !defSt) return null;

  if (atkPiece._currentHP !== undefined) atkSt.totalHP = atkPiece._currentHP;
  if (atkPiece._currentCount !== undefined) { atkSt.unitCount = atkPiece._currentCount; atkSt.totalScale = atkSt.unitScale * atkSt.unitCount; }
  if (atkPiece._currentMorale !== undefined) atkSt.morale = atkPiece._currentMorale;
  if (defPiece._currentHP !== undefined) defSt.totalHP = defPiece._currentHP;
  if (defPiece._currentCount !== undefined) { defSt.unitCount = defPiece._currentCount; defSt.totalScale = defSt.unitScale * defSt.unitCount; }
  if (defPiece._currentMorale !== undefined) defSt.morale = defPiece._currentMorale;

  var dist = hDist(atkPiece.hex, defPiece.hex);
  var isRanged = dist > 1;
  var atkBaseType = atkUD.baseType || atkUD.type;
  var defBaseType = defUD.baseType || defUD.type;

  // 弓兵近战封锁
  var atkWpnPrev = ED && ED.weapons && atkUD.equipment && atkUD.equipment.mainWeapon
    ? ED.weapons.find(function(w) { return w.id === atkUD.equipment.mainWeapon; }) : null;
  if (atkWpnPrev && atkWpnPrev.type === 'bow') {
    var meleeBan = false;
    // 使用 BoardAPI 解耦 API 遍历棋子
    BoardAPI.forEach(function(p, k) {
      if (p.team !== atkPiece.team && !p._routed && hDist(atkPiece.hex, p.hex) <= 1) meleeBan = true;
    });
    if (meleeBan) return { blocked: true };
  }

  var azimuth = 'front';
  if (defPiece._facing !== undefined && typeof getAttackAzimuth === 'function') {
    azimuth = getAttackAzimuth(atkPiece.hex, defPiece.hex, defPiece._facing);
  }

  var dirMoralePenalty = 0;
  var isCharger = (atkBaseType === 'cavalry' || atkBaseType === 'flying') && !isRanged;
  var momentum = 1.0;
  var antiCavExtra = 0;
  if (isCharger) {
    var chargeDist1 = (typeof atkPiece._chargeDistance === 'number' && atkPiece._chargeDistance > 0) ? atkPiece._chargeDistance : 0;
    var moveDist = Math.min(chargeDist1, 4);
    if (moveDist >= 4) momentum = 1.6;
    else if (moveDist >= 3) momentum = 1.6;
    else if (moveDist >= 2) momentum = 1.4;
    else if (moveDist >= 1) momentum = 1.2;
  }

  if (isCharger && defSt.mainWeapon && defSt.mainWeapon.type === 'long' && hasEffect(defSt.mainWeapon.effects, 'E001')) {
    var chargeDist = atkPiece._chargeDistance || 0;
    if (dist <= 1 && chargeDist <= 1) {
      if (momentum > 1.0) momentum = 1.0;
    } else {
      momentum = 1.0;
      antiCavExtra = 1;
    }
  }

  var dirArmorReduction = 0;
  var dirCavalryBonus = 1.0;
  if (azimuth === 'flank') {
    dirArmorReduction = 0.10;
    dirMoralePenalty = -5;
    if (isCharger) dirCavalryBonus = 1.2;
  } else if (azimuth === 'rear') {
    dirArmorReduction = 0.20;
    dirMoralePenalty = -10;
    if (isCharger) dirCavalryBonus = 1.4;
  }

  defSt.morale += dirMoralePenalty;

  var weapon = atkSt.mainWeapon;
  var atkBase = weapon ? weapon.baseDamage : atkSt.race.naturalWeapon;
  var atkAP = weapon ? weapon.armorPierce : 0;
  var atkRangeVal = atkSt.attackRange || 1;
  var atkLimit = atkSt.unitCount;
  var effectiveArmor = defSt.totalArmor;
  if (dirArmorReduction > 0) {
    effectiveArmor = Math.max(0, defSt.totalArmor * (1 - dirArmorReduction));
  }
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

  var finalDmg = Math.round(rawDmg * atkRangeVal * atkLimit * momentum * dirCavalryBonus * crossbowBonus);
  // 后手方第一回合减伤 30%
  if (typeof TurnState !== 'undefined' && TurnState.currentRound === 1 && TurnState.secondPlayer === defPiece.team) {
    finalDmg = Math.round(finalDmg * 0.7);
    if (finalDmg < 1) finalDmg = 1;
  }
  if (antiCavExtra) {
    finalDmg += Math.round(rawDmg * atkRangeVal * atkLimit * 1.5);
  }
  if (finalDmg < 1) finalDmg = 1;

  var hpPerUnitSafe = Math.max(1, defSt.hpPerUnit || 1);
  var carryOver = defPiece._accumulatedDamage || 0;
  if (isNaN(carryOver)) carryOver = 0;
  var totalDieDamage = carryOver + finalDmg;
  var lostMen = Math.floor(totalDieDamage / hpPerUnitSafe);
  var remainingHP = Math.max(0, (defSt.unitCount - lostMen) * hpPerUnitSafe - (totalDieDamage % hpPerUnitSafe));
  var hpRatio = defPiece._initialHP ? remainingHP / defPiece._initialHP : 1;
  var moraleAfter = defSt.morale;
  if (hpRatio <= 0.75) moraleAfter -= 8;
  if (hpRatio <= 0.5) moraleAfter -= 10;
  if (hpRatio <= 0.25) moraleAfter -= 12;

  var isNeverRout = defUD && defUD._neverRout;
  var willRout = (moraleAfter <= 0 && defSt.race.baseMorale !== 100 && !isNeverRout) || remainingHP <= 0;

  var moraleBefore = defPiece._currentMorale !== undefined ? defPiece._currentMorale : defSt.morale;
  var moraleDelta = moraleAfter - moraleBefore;

  return {
    damage: finalDmg,
    lostMen: lostMen,
    moraleBefore: moraleBefore,
    moraleAfter: moraleAfter,
    moraleDelta: moraleDelta,
    momentum: momentum,
    azimuth: azimuth,
    willRout: willRout,
    hpAfter: Math.max(0, defSt.totalHP - finalDmg),
    blocked: false
  };
}

// 战报行数组
var warReportLines = [];
function addWarReportLine(line) { warReportLines.push(line); }

function generateWarReport(atkUD, defUD, atkSt, defSt, lostMen, routed) {
  var result = routed ? '全面崩溃溃逃' : (defSt.morale <= 30 ? '阵型动摇' : '维持战线');
  var report =
    '<div class="wr-header">⚔ 交战报告</div>' +
    '<div class="wr-section"><div class="wr-label">态势锁定</div>' + atkUD.name + '(' + atkSt.unitCount + '人) VS ' + defUD.name + '(' + defSt.unitCount + '人)</div>' +
    '<div class="wr-section"><div class="wr-label">战术执行</div>' + atkUD.name + ' ⇢ ' + defUD.name + '</div>' +
    '<div class="wr-lines">';
  warReportLines.forEach(function(line) { report += '<div class="wr-line">' + line + '</div>'; });
  report += '</div>' +
    '<div class="wr-section"><div class="wr-label">状态结算</div>攻击方士气: ' + atkSt.morale + '/100 | 防御方士气: ' + defSt.morale + '/100 | 判定: <b>' + result + '</b></div>';
  warReportLines = [];
  return report;
}

function showWarReport(report) {
  // AI对战 / 斗蛐蛐模式下不显示战报，改为点击部队查看面板属性
  if (typeof TurnState !== 'undefined' && (TurnState.isAIBattle || TurnState.isDuelBattle)) {
    var panel = document.getElementById('warReport');
    if (panel) panel.style.display = 'none';
    return;
  }
  var el = document.getElementById('warReportContent');
  if (el) el.innerHTML = report;
  var panel = document.getElementById('warReport');
  if (panel) panel.style.display = 'block';
}

// ===== 追击/偷袭系统 =====
function tryOpportunityAttack(movingPieceKey) {
  if (!movingPieceKey) return;

  // 使用 BoardAPI 解耦 API 读取棋子
  var movingPiece = BoardAPI.getPiece(movingPieceKey);
  if (!movingPiece || movingPiece._routed) return;
  if (TurnState.phase !== 'battle') return;

  // 空军永远不会被偷袭
  var movingUd = unitDefByType(movingPiece.unitType);
  if (movingUd && (movingUd.baseType === 'flying')) return;

  var movingHex = movingPiece.hex;
  var movingTeam = movingPiece.team;

  // 查找该 hex 周围 1 格内的敌方近战单位
  var potentialAttackers = [];
  // 使用 BoardAPI 解耦 API 遍历棋子
  BoardAPI.forEach(function(p, k) {
    if (!p || p._routed) return;
    if (p.team === movingTeam) return;
    if (hDist(movingHex, p.hex) > 1) return;
    var pUd = unitDefByType(p.unitType);
    if (!pUd) return;
    var pBase = pUd.baseType || 'infantry';
    if (pBase !== 'infantry') return; // 仅近战步兵可偷袭
    if (!pUd.type) return;
    potentialAttackers.push({ key: k, piece: p, type: pUd.type });
  });

  if (potentialAttackers.length === 0) return;

  // 从所有追击者中随机选一个触发（一个单位只能被追击一次）
  var attacker = potentialAttackers[Math.floor(Math.random() * potentialAttackers.length)];

  // 根据追击者的品阶计算触发概率
  var tierRates = { iron: 0.20, bronze: 0.40, gold: 0.60, diamond: 0.80 };
  var tier = 'iron';
  if (typeof UNIT_TIER_CONFIG !== 'undefined' && UNIT_TIER_CONFIG[attacker.type]) {
    tier = UNIT_TIER_CONFIG[attacker.type].tier || 'iron';
  }
  var triggerRate = tierRates[tier] || 0.10;

  if (Math.random() >= triggerRate) return;

  // 触发偷袭
  executeOpportunityAttack(attacker.key, movingPieceKey);
}

function executeOpportunityAttack(atkKey, defKey) {
  // 偷袭逻辑：
  //   移动方 A 在 B 周围一格移动 → B 触发偷袭
  //   伤害 = B 一次攻击的伤害 × 0.6
  //   固定 -A 的 5 士气
  // atkPiece = B（偷袭者），defPiece = A（被偷袭的移动方）
  // 使用 BoardAPI 解耦 API 读取棋子
  var atkPiece = BoardAPI.getPiece(atkKey);
  var defPiece = BoardAPI.getPiece(defKey);
  if (!atkPiece || !defPiece) return;
  if (atkPiece._routed || defPiece._routed) return;

  var atkUD = unitDefByType(atkPiece.unitType);
  var defUD = unitDefByType(defPiece.unitType);
  if (!atkUD || !defUD) return;

  // 读取 B（偷袭者）和 A（被偷袭者）的属性
  var atkSt = computeStats(atkUD);
  var defSt = computeStats(defUD);
  if (!atkSt || !defSt) return;

  // ===== 计算 B 一次攻击的伤害（与主战斗公式一致，但不含冲锋/方位/弩手加成）=====
  // 基础伤害 = 武器伤害 - 目标护甲（破甲保底）
  var atkBase = atkSt.mainBase || (atkSt.mainWeapon ? atkSt.mainWeapon.baseDamage : 10);
  var atkAP = atkSt.mainAP || (atkSt.mainWeapon ? atkSt.mainWeapon.armorPierce : 0);
  var effArmor = defSt.totalArmor || 0;
  var rawDmg = atkBase - effArmor;
  if (isNaN(rawDmg)) rawDmg = atkAP || 1;
  if (rawDmg < atkAP) rawDmg = atkAP;
  if (rawDmg < 1) rawDmg = 1;

  // 攻击范围（武器能打多少规模）
  var atkRangeVal = atkSt.attackRange || 1;

  // 参与人数 = B 当前人数（computeStats 不返回 unitCount，必须从运行时状态读取，否则 NaN）
  var atkCount = atkPiece._currentCount;
  if (!atkCount || isNaN(atkCount)) atkCount = atkUD.unitCount || 1;

  // B 一次攻击的完整伤害 = 基础 × 范围 × 人数
  var fullDamage = rawDmg * atkRangeVal * atkCount;
  if (isNaN(fullDamage) || fullDamage < 1) fullDamage = 1;

  // 偷袭伤害 = 一次攻击（全额，无衰减）
  var finalDamage = Math.round(fullDamage * 1.0);
  if (isNaN(finalDamage) || finalDamage < 1) finalDamage = 1;

  // ===== 应用伤害到 A（被偷袭者）=====
  // ★ 攻击冲击动画（在伤害结算前触发）
  if (typeof startAttackImpact === 'function') {
    startAttackImpact(atkKey, defPiece.hex);
  }
  if (defPiece._currentHP !== undefined) {
    var newHP = defPiece._currentHP - finalDamage;
    defPiece._currentHP = isNaN(newHP) ? 0 : Math.max(0, newHP);
  }
  if (defPiece._currentCount !== undefined) {
    var hpPerUnit = defSt.hpPerUnit || 10;
    var carryOver = defPiece._accumulatedDamage || 0;
    if (isNaN(carryOver)) carryOver = 0;
    var totalDieDamage = carryOver + finalDamage;
    var lostMen = Math.floor(totalDieDamage / hpPerUnit);
    defPiece._accumulatedDamage = totalDieDamage % hpPerUnit;
    if (isNaN(defPiece._accumulatedDamage)) defPiece._accumulatedDamage = 0;
    var newCount = defPiece._currentCount - lostMen;
    defPiece._currentCount = isNaN(newCount) ? 1 : Math.max(1, newCount);
  }

  // 固定 -5 士气
  if (defPiece._currentMorale !== undefined) {
    defPiece._currentMorale = Math.max(0, defPiece._currentMorale - 5);
  }

  // 飘字和浮动数字
  var atkName = atkUD.name || atkUD.type || '单位';
  var tierLabel = '';
  if (typeof UNIT_TIER_CONFIG !== 'undefined' && UNIT_TIER_CONFIG[atkUD.type]) {
    tierLabel = UNIT_TIER_CONFIG[atkUD.type].tierLabel || '';
  }
  showToast('⚡ 偷袭！' + (tierLabel ? tierLabel + ' ' : '') + atkName + ' 对移动中的部队发动突袭！', 'warning');

  // 作战日志：偷袭
  if (typeof addCombatLog === 'function' && atkPiece) {
    addCombatLog(atkPiece.team, '⚡ ' + escapeHtml(atkUD.name) + ' 偷袭 ' + escapeHtml(defUD.name) + ' 造成 <b>' + finalDamage + '</b> 伤害', 'ambush');
  }

  if (typeof showDamageNumber === 'function') {
    showDamageNumber(defPiece.hex, '偷袭', 'crit');
    showDamageNumber(defPiece.hex, '-' + finalDamage, 'normal');
  }

  // ★ 受击晃动动画（仅当被偷袭方仍存在于棋盘时）
  if (typeof shakePiece === 'function' && BoardAPI.hasPiece(defKey)) { // 使用 BoardAPI 解耦 API 检查存在
    shakePiece(defKey);
  }

  // 检查溃逃
  if (defPiece._currentHP <= 0 || (defPiece._currentMorale !== undefined && defPiece._currentMorale <= 0)) {
    defPiece._routed = true;
    if (defPiece._statuses && defPiece._statuses.length) {
      defPiece._statuses = [];
    }
    if (typeof archiveRoutedPiece === 'function') archiveRoutedPiece(defKey);
    BoardAPI.removePiece(defKey); // 使用 BoardAPI 解耦 API 移除棋子
    if (typeof showDamageNumber === 'function') {
      showDamageNumber(defPiece.hex, '溃逃', 'routed');
    }
    // 偷袭击溃日志和漂浮提示
    if (typeof showKillNotify === 'function') showKillNotify(atkUD.name, defUD.name);
    if (typeof addCombatLog === 'function' && atkPiece) {
      addCombatLog(atkPiece.team, escapeHtml(atkUD.name) + ' 击溃了 ' + escapeHtml(defUD.name), 'kill');
    }
  }

  // ===== 记分板：记录伤害和击杀 =====
  if (typeof recordScoreboardDamage === 'function') {
    recordScoreboardDamage(atkKey, finalDamage);
  }
  if (defPiece._routed && typeof recordScoreboardKill === 'function') {
    recordScoreboardKill(atkKey);
  }

  requestRender();
  checkAndTriggerVictory();
}
