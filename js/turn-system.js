// AI路径引导：如需查找相关代码路径，请先查阅 AI_PATH_GUIDE.md
// 每新增/修改一个文件后必须同步更新 AI_PATH_GUIDE.md
// ==================== 回合系统 v2 ====================
// 流程：骰子 → 交替放置 → 战斗回合(交替移动)

// 兵种emoji：直接取配置文件里的 icon 字段（unit_config.json 每个单位自带 icon）
function getUnitTypeEmoji(unitType) {
  var ud = (typeof unitDefByType === 'function') ? unitDefByType(unitType) : null;
  if (!ud) return '❓';
  return ud.icon || '❓';
}

var TurnState = {
  currentRound: 0,
  currentPlayer: '',
  phase: 'dice',
  firstPlayer: '',
  difficulty: 'easy',
  deployCount: {},
  totalPlayer: 0,
  totalEnemy: 0,
  // 斗蛐蛐模式标记
  isDuelBattle: false,
  sideAControlledByAI: false,  // 甲方（player 阵营）是否由 AI 控制
  sideBControlledByAI: false,  // 乙方（enemy 阵营）是否由 AI 控制
  _aiTurnActive: false, // AI 回合是否正在进行（用于暂停恢复时跳过状态重置）
  // AI 性格：offensive（进攻型）、defensive（防守型）、balanced（均衡型）
  _aiPersonality: {} //  key: team, value: 'offensive'|'defensive'|'balanced'
};

// ===== 对战速度倍率（斗蛐蛐模式用，默认 1.0，可选 0.5/1/2/5）=====
var BATTLE_SPEED_MULT = 1.0;

// 观战模式暂停标记（双 AI 对战时玩家可暂停自动推进）
var _spectatorPaused = false;
var _deployPauseInitial = false; // 部署结束后的初始暂停标记
var _countdownTimer = null; // 倒计时计时器

// ===== 地形系统 =====
// 不可部署、不可进入、不可移动的地形格子
var TerrainData = {
  blocked: {}  // {"q,r,s": "mountain" | "lake"}
};

// 生成地形：6个随机山脉（四环以内）+ 中心1个湖泊
function generateTerrain() {
  TerrainData.blocked = {};
  // 中心湖泊
  TerrainData.blocked['0,0,0'] = 'lake';
  // 随机6个山脉（四环以内，不在中心，不重复）
  var available = hexes.filter(function(h) {
    if (h.q === 0 && h.r === 0 && h.s === 0) return false;
    return hDist(h, {q:0, r:0, s:0}) <= 4;
  });
  for (var i = 0; i < 6 && available.length > 0; i++) {
    var idx = Math.floor(Math.random() * available.length);
    var h = available[idx];
    TerrainData.blocked[h.q + ',' + h.r + ',' + h.s] = 'mountain';
    available.splice(idx, 1);
  }
}

// 检查格子是否被地形阻挡
function isTerrainBlocked(hex) {
  var key = hex.q + ',' + hex.r + ',' + hex.s;
  return !!TerrainData.blocked[key];
}

// 获取地形类型
function getTerrainType(hex) {
  var key = hex.q + ',' + hex.r + ',' + hex.s;
  return TerrainData.blocked[key] || null;
}

// 重置地形
function resetTerrain() {
  TerrainData.blocked = {};
}

// ===== 记分板数据 =====
var Scoreboard = {
  damage: { player: 0, enemy: 0 },
  kills: { player: 0, enemy: 0 },
  routedArchive: [] // 溃散单位的计分数据（单位被删除后保留）
};

// 在单位溃散前归档其计分数据
function archiveRoutedPiece(pieceKey) {
  var p = placedPieces[pieceKey];
  if (!p) return;
  var dmg = p._damageDealt || 0;
  var kills = p._kills || 0;
  if (dmg === 0 && kills === 0) return;
  var ud = typeof unitDefByType === 'function' ? unitDefByType(p.unitType) : null;
  Scoreboard.routedArchive.push({
    name: ud ? ud.name : '???',
    team: p.team,
    dmg: dmg,
    kills: kills,
    unitType: p.unitType
  });
}

function resetScoreboard() {
  Scoreboard.damage = { player: 0, enemy: 0 };
  Scoreboard.kills = { player: 0, enemy: 0 };
  Scoreboard.routedArchive = [];
  // 重置每个棋子的追踪
  for (var k in placedPieces) {
    if (placedPieces[k]._damageDealt !== undefined) placedPieces[k]._damageDealt = 0;
    if (placedPieces[k]._kills !== undefined) placedPieces[k]._kills = 0;
  }
  if (typeof clearCombatLog === 'function') clearCombatLog();
  updateScoreboardUI();
}

function updateScoreboardUI() {
  var show = TurnState.isDuelBattle && TurnState.phase === 'battle';

  // 切换备战席/计分板显示
  var benchLeft = document.getElementById('benchLeft');
  var benchRight = document.getElementById('benchRight');
  var sbInlineA = document.getElementById('sbInlineA');
  var sbInlineB = document.getElementById('sbInlineB');
  var benchTitleLeft = document.getElementById('benchTitleLeft');
  var benchTitleRight = document.getElementById('benchTitleRight');
  var benchColLeft = document.getElementById('benchColLeft');
  var benchColRight = document.getElementById('benchColRight');

  if (show) {
    // 战斗阶段：隐藏备战席，显示计分板
    if (benchLeft) benchLeft.style.display = 'none';
    if (benchRight) benchRight.style.display = 'none';
    if (sbInlineA) sbInlineA.style.display = 'flex';
    if (sbInlineB) sbInlineB.style.display = 'flex';
    // 更新标题为势力名称
    var sideAName = (window._duelBattleData && window._duelBattleData.sideA && window._duelBattleData.sideA.name) || '甲方';
    var sideBName = (window._duelBattleData && window._duelBattleData.sideB && window._duelBattleData.sideB.name) || '乙方';
    if (benchTitleLeft) benchTitleLeft.textContent = '🔷 ' + sideAName;
    if (benchTitleRight) benchTitleRight.textContent = '🔶 ' + sideBName;
    if (benchColLeft) benchColLeft.classList.add('battle-mode');
    if (benchColRight) benchColRight.classList.add('battle-mode');
    // 更新计分板标题
    var sbHA = document.getElementById('sbHeaderA');
    var sbHB = document.getElementById('sbHeaderB');
    if (sbHA) sbHA.textContent = sideAName;
    if (sbHB) sbHB.textContent = sideBName;
  } else {
    // 非战斗阶段：显示备战席，隐藏计分板
    if (benchLeft) benchLeft.style.display = '';
    if (benchRight) benchRight.style.display = '';
    if (sbInlineA) sbInlineA.style.display = 'none';
    if (sbInlineB) sbInlineB.style.display = 'none';
    if (benchTitleLeft) benchTitleLeft.textContent = '🔷 我方';
    if (benchTitleRight) benchTitleRight.textContent = '🔶 敌方';
    if (benchColLeft) benchColLeft.classList.remove('battle-mode');
    if (benchColRight) benchColRight.classList.remove('battle-mode');
  }

  if (!show) return;

  // 收集双方棋子数据（存活棋子 + 已溃散归档数据）
  var sideA = [], sideB = [];
  for (var k in placedPieces) {
    var p = placedPieces[k];
    if (p._routed) continue;
    var ud = typeof unitDefByType === 'function' ? unitDefByType(p.unitType) : null;
    var name = ud ? ud.name : '???';
    var dmg = p._damageDealt || 0;
    var kills = p._kills || 0;
    if (dmg === 0 && kills === 0) continue;
    var entry = { name: name, dmg: dmg, kills: kills, unitType: p.unitType };
    if (p.team === 'player') sideA.push(entry);
    else sideB.push(entry);
  }
  // 合并已溃散单位的归档数据
  Scoreboard.routedArchive.forEach(function(e) {
    var entry = { name: e.name + '\u2020', dmg: e.dmg, kills: e.kills, unitType: e.unitType };
    if (e.team === 'player') sideA.push(entry);
    else sideB.push(entry);
  });

  // 按伤害排序
  sideA.sort(function(a,b){ return b.dmg - a.dmg; });
  sideB.sort(function(a,b){ return b.dmg - a.dmg; });

  var listA = document.getElementById('sbListA');
  var listB = document.getElementById('sbListB');
  var dmgA = document.getElementById('sbDmgA');
  var dmgB = document.getElementById('sbDmgB');
  var killA = document.getElementById('sbKillA');
  var killB = document.getElementById('sbKillB');

  if (listA) listA.innerHTML = sideA.length === 0 ? '<div class="sb-empty">暂无数据</div>' : sideA.map(function(e) {
    return '<div class="sb-row"><span class="sb-name">' + getUnitTypeEmoji(e.unitType) + ' ' + escapeHtml(e.name) + '</span><span class="sb-num">' + e.dmg + '</span><span class="sb-num">' + e.kills + '</span></div>';
  }).join('');
  if (listB) listB.innerHTML = sideB.length === 0 ? '<div class="sb-empty">暂无数据</div>' : sideB.map(function(e) {
    return '<div class="sb-row"><span class="sb-name">' + getUnitTypeEmoji(e.unitType) + ' ' + escapeHtml(e.name) + '</span><span class="sb-num">' + e.dmg + '</span><span class="sb-num">' + e.kills + '</span></div>';
  }).join('');

  // 总计
  var totalDmgA = 0, totalKillA = 0, totalDmgB = 0, totalKillB = 0;
  sideA.forEach(function(e){ totalDmgA += e.dmg; totalKillA += e.kills; });
  sideB.forEach(function(e){ totalDmgB += e.dmg; totalKillB += e.kills; });
  if (dmgA) dmgA.textContent = totalDmgA;
  if (dmgB) dmgB.textContent = totalDmgB;
  if (killA) killA.textContent = totalKillA;
  if (killB) killB.textContent = totalKillB;

  // 切换作战日志可见性
  var logA = document.getElementById('combatLogA');
  var logB = document.getElementById('combatLogB');
  if (logA) logA.style.display = show ? 'flex' : 'none';
  if (logB) logB.style.display = show ? 'flex' : 'none';
}

// ===== 作战日志：往对应侧推送一条信息 =====
function addCombatLog(team, text, type) {
  var logId = (team === 'player') ? 'combatLogA' : 'combatLogB';
  var log = document.getElementById(logId);
  if (!log) return;
  var entry = document.createElement('div');
  entry.className = 'cl-entry cl-' + (type || 'attack');
  entry.innerHTML = text;
  // 最新消息插入到顶部（column-reverse 下 prepend = 视觉顶部）
  log.insertBefore(entry, log.firstChild);
  // 最多保留30条
  while (log.children.length > 30) {
    log.removeChild(log.lastChild);
  }
}

function clearCombatLog() {
  var logA = document.getElementById('combatLogA');
  var logB = document.getElementById('combatLogB');
  if (logA) logA.innerHTML = '';
  if (logB) logB.innerHTML = '';
}

function recordScoreboardDamage(pieceKey, dmg) {
  var p = placedPieces[pieceKey];
  if (!p) return;
  if (p._damageDealt === undefined) p._damageDealt = 0;
  p._damageDealt += dmg;
  updateScoreboardUI();
}

function recordScoreboardKill(pieceKey) {
  var p = placedPieces[pieceKey];
  if (!p) return;
  if (p._kills === undefined) p._kills = 0;
  p._kills++;
  updateScoreboardUI();
}

// AI 相关延时按倍率缩短（人类回合不受影响）
function battleDelay(ms) {
  return ms / BATTLE_SPEED_MULT;
}

// ===== 全新部署算法（基于有效距离和AI性格）=====

// 计算部署后有效距离（攻击距离 + 移动距离）
function getEffectiveRange(ud) {
  if (!ud || typeof computeStats !== 'function') return 1;
  var st = computeStats(ud);
  if (!st) return 1;
  return (st.allowedRange || 1) + (st.movement || 1);
}

// 获取某阵营备战席中，所有可用单位的信息
function getAvailableUnits(team) {
  var benchSelector = (team === 'enemy') ? '#benchRight .bench-slot' : '#benchLeft .bench-slot';
  var benchSlots = document.querySelectorAll(benchSelector);
  var available = [];
  for (var i = 0; i < benchSlots.length; i++) {
    if (!benchSlots[i].classList.contains('empty')) {
      var ut = benchSlots[i].dataset.unitType;
      var ud = (typeof unitDefByType === 'function') ? unitDefByType(ut) : null;
      if (!ud) continue;
      var isRanged = false;
      if (ud.equipment && ud.equipment.mainWeapon && typeof ED !== 'undefined' && ED && ED.weapons) {
        var _depWpn = ED.weapons.find(function(w) { return w.id === ud.equipment.mainWeapon; });
        if (_depWpn && (_depWpn.type === 'bow' || _depWpn.type === 'crossbow')) isRanged = true;
      }
      available.push({
        slotIdx: parseInt(benchSlots[i].dataset.slotIdx),
        unitType: ut,
        isRanged: isRanged,
        ud: ud,
        effectiveRange: getEffectiveRange(ud),
        baseType: ud.type || 'infantry'
      });
    }
  }
  return available;
}

// 按有效距离排序（远程优先）
function sortByEffectiveRange(units) {
  return units.slice().sort(function(a, b) {
    // 远程优先
    if (a.isRanged && !b.isRanged) return -1;
    if (!a.isRanged && b.isRanged) return 1;
    // 同是远程或同是近战，按有效距离排序
    return b.effectiveRange - a.effectiveRange;
  });
}

// 找到两个六角格之间的位置（在连线上，尽量靠近中间）
function findPositionBetween(hexA, hexB, cands) {
  // 简化实现：找到距A和B距离之和最小的位置
  var best = null;
  var bestSum = Infinity;
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i].hex;
    var distA = hDist(c, hexA);
    var distB = hDist(c, hexB);
    var sum = distA + distB;
    // 优先选择距A和B都较近的位置（在连线上）
    if (sum < bestSum && distA <= 2 && distB <= 2) {
      bestSum = sum;
      best = cands[i];
    }
  }
  return best;
}

// 找到靠近某位置的位置（在候选格中）
function findPositionNear(targetHex, cands, maxDist) {
  var best = null;
  var bestDist = maxDist + 1;
  for (var i = 0; i < cands.length; i++) {
    var d = hDist(cands[i].hex, targetHex);
    if (d < bestDist) {
      bestDist = d;
      best = cands[i];
    }
  }
  return best;
}

// 判断某位置是否在敌方攻击范围内
function isInEnemyRange(hex, oppHexes, oppUnits) {
  for (var i = 0; i < oppHexes.length; i++) {
    var oppUD = oppUnits && oppUnits[i] ? oppUnits[i].ud : null;
    var oppRange = oppUD ? getEffectiveRange(oppUD) : 2;
    if (hDist(hex, oppHexes[i]) <= oppRange) return true;
  }
  return false;
}

// ===== 全新部署算法（基于有效距离和AI性格）=====
// 核心思路：远程优先，根据AI性格调整策略

function aiDeployPiece() {
  var team = TurnState.currentPlayer;
  if (TurnState.phase !== 'deploy') return;
  if (!isControlledByAI(team)) return;

  var isFirstPlayer = (team === TurnState.firstPlayer);
  var deployCount = TurnState.deployCount[team] || 0;
  var totalCount = (team === 'enemy') ? TurnState.totalEnemy : TurnState.totalPlayer;
  var personality = TurnState._aiPersonality[team] || 'balanced';
  if (TurnState.deployCount[team] >= totalCount) { tryEndDeploy(); return; }

  // 获取可用单位
  var available = getAvailableUnits(team);
  if (available.length === 0) { tryEndDeploy(); return; }

  // 根据先手/后手和AI性格选择单位
  var pick = null;
  if (isFirstPlayer) {
    // 先手方：远程优先
    pick = selectUnitForFirstPlayer(team, available, deployCount, personality);
  } else {
    // 后手方：根据AI性格
    pick = selectUnitForSecondPlayer(team, available, deployCount, personality);
  }

  if (!pick) {
    pick = available[Math.floor(Math.random() * available.length)];
  }

  var slotIdx = pick.slotIdx;
  var unitType = pick.unitType;
  var isRanged = pick.isRanged;

  // 收集候选格子
  var cands = collectCandidateHexes(team);
  if (cands.length === 0) return;

  // 选择最佳位置
  var selected = selectBestPosition(team, pick, cands, isFirstPlayer, deployCount, personality);
  if (!selected) {
    selected = cands[Math.floor(Math.random() * cands.length)];
  }

  // 放置单位
  var h = selected.hex;
  var key = selected.key;
  placedPieces[key] = { unitType: unitType, team: team, slotIdx: slotIdx, hex: { q: h.q, r: h.r, s: h.s } };
  placedPieces[key]._facing = getFacingToCenter(h);
  initPieceRuntimeState(placedPieces[key]);
  benchState[slotIdx] = false;
  var benchSelector = (team === 'enemy') ? '#benchRight .bench-slot' : '#benchLeft .bench-slot';
  var benchSlots = document.querySelectorAll(benchSelector);
  benchSlots[getSlotIndexInContainer(benchSlots, slotIdx)].classList.add('empty');
  TurnState.deployCount[team]++;
  requestRender();
  nextDeployPlayer();
}

// 为先手方选择单位（远程优先）
function selectUnitForFirstPlayer(team, available, deployCount, personality) {
  // 第一只部队：选择远程部队中有效距离最高的
  if (deployCount === 0) {
    var rangedUnits0 = available.filter(function(u) { return u.isRanged; });
    if (rangedUnits0.length > 0) {
      rangedUnits0.sort(function(a, b) { return b.effectiveRange - a.effectiveRange; });
      return rangedUnits0[0];
    }
    // 没有远程部队，选择近战
    return available[0];
  }

  // 后续部队：继续放远程，直到远程放完
  var rangedUnits = available.filter(function(u) { return u.isRanged; });
  if (rangedUnits.length > 0) {
    rangedUnits.sort(function(a, b) { return b.effectiveRange - a.effectiveRange; });
    return rangedUnits[0];
  }

  // 远程放完，按兵种优先级：近战 > 野兽 > 骑兵 > 飞兵
  return selectByPriority(available);
}

// 为后手方选择单位（根据AI性格）
// 核心修复：所有性格都远程优先，性格差异体现在位置选择上
// 否则后手方进攻型/防守型不放远程，被先手方远程白嫖致死
function selectUnitForSecondPlayer(team, available, deployCount, personality) {
  // 所有性格第一只部队都优先放远程（B1也需要远程对射能力）
  if (deployCount === 0) {
    var ranged0 = available.filter(function(u) { return u.isRanged; });
    if (ranged0.length > 0) {
      ranged0.sort(function(a, b) { return b.effectiveRange - a.effectiveRange; });
      return ranged0[0];
    }
    return available[0];
  }

  // 后续部队：所有性格都远程优先，远程放完后按性格选近战
  var rangedUnits = available.filter(function(u) { return u.isRanged; });
  if (rangedUnits.length > 0) {
    rangedUnits.sort(function(a, b) { return b.effectiveRange - a.effectiveRange; });
    return rangedUnits[0];
  }

  // 远程放完，按性格选近战
  if (personality === 'offensive') {
    // 进攻型：优先骑兵/飞兵（高机动切入）
    var mobileUnits = available.filter(function(u) {
      return u.baseType === 'cavalry' || u.baseType === 'flying';
    });
    if (mobileUnits.length > 0) return mobileUnits[0];
  } else if (personality === 'defensive') {
    // 防守型：优先步兵/野兽（构筑防线）
    var meleeUnits = available.filter(function(u) {
      return u.baseType === 'infantry' || u.baseType === 'beast';
    });
    if (meleeUnits.length > 0) return meleeUnits[0];
  }
  // 均衡型或兜底：按优先级选
  return selectByPriority(available);
}

// 按兵种优先级选择（近战 > 骑兵 > 飞兵 > 野兽）
function selectByPriority(available) {
  var priority = ['infantry', 'beast', 'cavalry', 'flying'];
  for (var i = 0; i < priority.length; i++) {
    var units = available.filter(function(u) { return u.baseType === priority[i]; });
    if (units.length > 0) return units[0];
  }
  return available[0];
}

// 收集候选格子
function collectCandidateHexes(team) {
  var oppHexes = [];
  var myHexes = [];
  for (var k in placedPieces) {
    var p = placedPieces[k];
    if (p.team === team) {
      myHexes.push(p.hex);
    } else {
      oppHexes.push(p.hex);
    }
  }

  var cands = [];
  hexes.forEach(function(h) {
    var key = h.q + ',' + h.r + ',' + h.s;
    if (placedPieces[key]) return;
    // 中心一环以内禁止放置
    if (hDist(h, {q:0,r:0,s:0}) <= 1) return;
    // 地形阻挡（山脉/湖泊）禁止放置
    if (typeof isTerrainBlocked === 'function' && isTerrainBlocked(h)) return;

    // 检查是否在敌方 2 格内
    var inEnemyRange = false;
    for (var oi = 0; oi < oppHexes.length; oi++) {
      if (hDist(h, oppHexes[oi]) <= 2) {
        inEnemyRange = true;
        break;
      }
    }

    // 如果在敌方 2 格内，检查是否在己方 2 格内（例外规则）
    if (inEnemyRange) {
      var inAllyRange = false;
      for (var aj = 0; aj < myHexes.length; aj++) {
        if (hDist(h, myHexes[aj]) <= 2) {
          inAllyRange = true;
          break;
        }
      }
      if (!inAllyRange) return; // 在敌方 2 格内且不在己方 2 格内，排除
    }

    cands.push({ key: key, hex: h });
  });

  return cands;
}

// 选择最佳位置（全新部署算法核心）
function selectBestPosition(team, pick, cands, isFirstPlayer, deployCount, personality) {
  if (cands.length === 0) return null;
  personality = personality || 'balanced';

  // 收集己方和敌方单位坐标
  var myHexes = [];
  var oppHexes = [];
  for (var k in placedPieces) {
    if (placedPieces[k].team === team) {
      myHexes.push(placedPieces[k].hex);
    } else {
      oppHexes.push(placedPieces[k].hex);
    }
  }

  // ===== A1放置：先手方第一只部队放在二环或三环 =====
  if (isFirstPlayer && deployCount === 0) {
    var ring2or3 = cands.filter(function(c) {
      var d = hDist(c.hex, {q:0,r:0,s:0});
      return d >= 2 && d <= 3;
    });
    if (ring2or3.length > 0) {
      return ring2or3[Math.floor(Math.random() * ring2or3.length)];
    }
  }

  // ===== B1放置：后手方第一只部队放在A1的对称方向 =====
  if (!isFirstPlayer && deployCount === 0 && oppHexes.length > 0) {
    var a1 = oppHexes[0];
    var a1Piece = null;
    for (var ak in placedPieces) {
      if (placedPieces[ak].team !== team) { a1Piece = placedPieces[ak]; break; }
    }
    var a1UD = a1Piece ? (typeof unitDefByType === 'function' ? unitDefByType(a1Piece.unitType) : null) : null;
    var a1EffRange = a1UD ? getEffectiveRange(a1UD) : 3;
    var symHex = { q: -a1.q, r: -a1.r, s: -a1.s };

    // 第一优先：离对称位置最近，且不在A1有效距离内
    var bestSym = null;
    var bestSymDist = Infinity;
    for (var si = 0; si < cands.length; si++) {
      var dToSym = hDist(cands[si].hex, symHex);
      var dToA1 = hDist(cands[si].hex, a1);
      if (dToA1 > a1EffRange && dToSym < bestSymDist) {
        bestSymDist = dToSym;
        bestSym = cands[si];
      }
    }
    if (bestSym) return bestSym;

    // 第二优先（兜底）：所有候选都在A1有效距离内时，选离A1最远的
    var farthest = null;
    var farthestDist = -1;
    for (var fi2 = 0; fi2 < cands.length; fi2++) {
      var fd = hDist(cands[fi2].hex, a1);
      if (fd > farthestDist) { farthestDist = fd; farthest = cands[fi2]; }
    }
    if (farthest) return farthest;

    // 第三优先（终极兜底）：随机选一个
    return cands[Math.floor(Math.random() * cands.length)];
  }

  // ===== 防御机制：检测敌方与己方间隔2格(hDist==3)时触发 =====
  var defensePos = checkDefenseTrigger(pick, cands, myHexes, oppHexes);
  if (defensePos) return defensePos;

  // ===== 进攻型第二只远程前置 =====
  if (isFirstPlayer && deployCount === 2 && personality === 'offensive' && pick.isRanged && myHexes.length > 0) {
    var a1Pos = myHexes[0];
    var bestForward = null;
    var bestFwdScore = -Infinity;
    for (var fwi = 0; fwi < cands.length; fwi++) {
      var fc = cands[fwi];
      var dToA1 = hDist(fc.hex, a1Pos);
      if (dToA1 > 4) continue; // 不远离第一只部队
      // 靠近敌方
      var minDistE = Infinity;
      for (var fwj = 0; fwj < oppHexes.length; fwj++) {
        var fde = hDist(fc.hex, oppHexes[fwj]);
        if (fde < minDistE) minDistE = fde;
      }
      // 抱团加分
      var fwdAlly = 0;
      for (var fwa = 0; fwa < myHexes.length; fwa++) {
        if (hDist(fc.hex, myHexes[fwa]) <= 2) fwdAlly++;
      }
      var fwdScore = fwdAlly * 5 - minDistE * 2;
      if (fwdScore > bestFwdScore) { bestFwdScore = fwdScore; bestForward = fc; }
    }
    if (bestForward) return bestForward;
  }

  // ===== 通用策略：抱团为主，根据AI性格调整 =====
  var best = null;
  var bestScore = -Infinity;
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i];
    var score = 0;

    // ===== 小团制部署：三个三个抱团，团间间隔1格，避免互相卡位 =====
    var allyIn1 = 0;  // 1格内友军数（团内）
    var allyIn2 = 0;  // 2格内友军数（含邻团）
    for (var j = 0; j < myHexes.length; j++) {
      var d = hDist(c.hex, myHexes[j]);
      if (d <= 1) allyIn1++;
      if (d <= 2) allyIn2++;
    }
    if (allyIn1 >= 3) {
      // 当前位置1格内已有3个友军 → 团已满，不要再挤进去
      score -= 30;
    } else if (allyIn1 >= 1) {
      // 1格内有1-2个友军 → 继续在团内放置
      score += allyIn1 * 15;
    } else if (allyIn2 >= 1) {
      // 1格内没有友军，但2格内有 → 开新团，间隔1格
      score += 12;
    } else {
      // 2格内都没有友军 → 太远，降分
      score -= 20;
    }

    // 远程部队：尽量放在能打到敌方的位置
    if (pick.isRanged && oppHexes.length > 0) {
      var reachable = 0;
      for (var oj = 0; oj < oppHexes.length; oj++) {
        if (hDist(c.hex, oppHexes[oj]) <= pick.effectiveRange) reachable++;
      }
      score += reachable * 5;
    }

    // 后手方根据AI性格调整位置偏好
    if (!isFirstPlayer && oppHexes.length > 0) {
      var a1Pos2 = oppHexes[0]; // 对方先手第一个单位
      var dToA1 = hDist(c.hex, a1Pos2);

      if (personality === 'offensive') {
        // 进攻型：靠近A1，试图切入
        score += Math.max(0, 10 - dToA1) * 2;
      } else if (personality === 'defensive') {
        // 防守型：远离敌方，抱团构筑防线
        var minDistE = Infinity;
        for (var dj = 0; dj < oppHexes.length; dj++) {
          var de = hDist(c.hex, oppHexes[dj]);
          if (de < minDistE) minDistE = de;
        }
        if (minDistE >= 3) score += 5;
        if (pick.isRanged && minDistE >= 4) score += 5; // 远程更靠后
      } else {
        // 均衡型：抱团为主，远程尝试打到敌方
        if (pick.isRanged) {
          var reach2 = 0;
          for (var ej = 0; ej < oppHexes.length; ej++) {
            if (hDist(c.hex, oppHexes[ej]) <= pick.effectiveRange) reach2++;
          }
          score += reach2 * 3;
        }
      }
    }

    // ===== 兵种位置偏好（防止高机动部队突进太快被集火）=====
    if (pick.baseType === 'cavalry' || pick.baseType === 'flying') {
      // 高机动部队（骑兵/飞兵）：不要放在最前排，应该保护侧翼
      // 计算离敌方最近距离
      var minDistE2 = Infinity;
      for (var ce = 0; ce < oppHexes.length; ce++) {
        var de2 = hDist(c.hex, oppHexes[ce]);
        if (de2 < minDistE2) minDistE2 = de2;
      }
      // 如果离敌方太近（<=2），扣分（不要突进太快）
      if (minDistE2 <= 2) score -= 25;
      // 如果离友军太远（>3），扣分（不要脱离大部队）
      var minDistA = Infinity;
      for (var ca = 0; ca < myHexes.length; ca++) {
        var da2 = hDist(c.hex, myHexes[ca]);
        if (da2 < minDistA) minDistA = da2;
      }
      if (myHexes.length > 0 && minDistA > 3) score -= 20;
      // 如果离敌方适中（3-4格），加分（保护侧翼，不突进）
      if (minDistE2 >= 3 && minDistE2 <= 4) score += 10;
    } else if (pick.baseType === 'infantry' || pick.baseType === 'beast') {
      // 低机动部队（步兵/野兽）：可以放在前排构筑防线
      // 如果是防守型，放在前面（离敌方2-3格）
      if (personality === 'defensive' && oppHexes.length > 0) {
        var minDistE3 = Infinity;
        for (var de = 0; de < oppHexes.length; de++) {
          var de3 = hDist(c.hex, oppHexes[de]);
          if (de3 < minDistE3) minDistE3 = de3;
        }
        // 离敌方适中（2-3格），既不太近也不太远
        if (minDistE3 >= 2 && minDistE3 <= 3) score += 15;
      }
    }
    // 远程部队：已经在前面处理了（尽量放在能打到敌方的位置）

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
}

// ===== 防御机制检测：敌方与己方间隔2格(hDist==3)时触发 =====
// 调整：只在敌方是高机动部队（骑兵/飞兵）或有效距离≥3时才触发，避免过度敏感
function checkDefenseTrigger(pick, cands, myHexes, oppHexes) {
  if (myHexes.length === 0 || oppHexes.length === 0) return null;

  for (var i = 0; i < myHexes.length; i++) {
    for (var j = 0; j < oppHexes.length; j++) {
      if (hDist(myHexes[i], oppHexes[j]) === 3) {
        // 获取敌方单位信息，判断是否构成实际威胁
        var oppPiece = null;
        for (var pk in placedPieces) {
          if (placedPieces[pk].hex.q === oppHexes[j].q &&
              placedPieces[pk].hex.r === oppHexes[j].r &&
              placedPieces[pk].hex.s === oppHexes[j].s) {
            oppPiece = placedPieces[pk];
            break;
          }
        }
        var oppUD = oppPiece ? (typeof unitDefByType === 'function' ? unitDefByType(oppPiece.unitType) : null) : null;
        var oppEffRange = oppUD ? getEffectiveRange(oppUD) : 2;

        // 只在敌方有效距离≥3（能一回合打到己方）时才触发防御
        if (oppEffRange < 3) continue;

        var myUnit = myHexes[i];
        var oppUnit = oppHexes[j];
        var isCavalry = (pick.baseType === 'cavalry' || pick.baseType === 'flying');
        var isInfantry = (pick.baseType === 'infantry' || pick.baseType === 'beast');

        if (isCavalry) {
          var pos = findPositionOnLine(myUnit, oppUnit, cands, true);
          if (pos) return pos;
        } else if (isInfantry) {
          var pos2 = findPositionOnLine(myUnit, oppUnit, cands, false);
          if (pos2) return pos2;
        }
      }
    }
  }
  return null;
}

// 在两个六角格之间的连线上找位置
// hexA是己方单位，hexB是敌方单位
// nearA=true时靠近hexA（保护己方），nearA=false时靠近hexB（阻挡敌方）
function findPositionOnLine(hexA, hexB, cands, nearA) {
  var best = null;
  var bestScore = -Infinity;
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i];
    var dA = hDist(c.hex, hexA);
    var dB = hDist(c.hex, hexB);
    // 必须在两者之间（距离都不超过3）
    if (dA > 3 || dB > 3) continue;
    var score;
    if (nearA) {
      score = (4 - dA) * 3 + (4 - dB); // 偏向靠近A
    } else {
      score = (4 - dB) * 3 + (4 - dA); // 偏向靠近B
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function updateBattleSpeedControlsVisibility() {
  var ctrl = document.getElementById('battleSpeedControls');
  if (!ctrl) return;
  ctrl.style.display = TurnState.isDuelBattle ? 'flex' : 'none';
  // 更新按钮高亮
  var btns = ctrl.querySelectorAll('.speed-btn');
  btns.forEach(function(b) {
    var sp = parseFloat(b.dataset.speed);
    b.classList.toggle('active', Math.abs(sp - BATTLE_SPEED_MULT) < 0.01);
  });
}

function initBattleSpeedControls() {
  var ctrl = document.getElementById('battleSpeedControls');
  if (!ctrl || ctrl.dataset.bound === '1') return;
  ctrl.dataset.bound = '1';
  ctrl.addEventListener('click', function(e) {
    var btn = e.target.closest('.speed-btn');
    if (!btn) return;
    BATTLE_SPEED_MULT = parseFloat(btn.dataset.speed) || 1.0;
    updateBattleSpeedControlsVisibility();
  });
}

// ===== 观战模式暂停按钮（斗蛐蛐对战时始终显示）=====
function updateSpectatorPauseBtnVisibility() {
  var btn = document.getElementById('spectatorPauseBtn');
  if (!btn) return;
  btn.style.display = TurnState.isDuelBattle ? 'inline-block' : 'none';
  if (_deployPauseInitial && _spectatorPaused) {
    btn.textContent = '▶ 开始战斗';
  } else {
    btn.textContent = _spectatorPaused ? '▶ 继续' : '⏸ 暂停观战';
  }
}

function showCountdownOverlay(seconds, onComplete) {
  var overlay = document.getElementById('countdownOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'countdownOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;' +
      'display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.4);pointer-events:none;';
    overlay.innerHTML = '<div id="countdownNumber" style="' +
      'font-size:120px;font-weight:bold;color:#fff;' +
      'text-shadow:0 0 30px rgba(255,200,100,0.8),0 0 60px rgba(255,150,50,0.5);' +
      'font-family:"Cinzel","Times New Roman",serif;' +
      'letter-spacing:8px;">3</div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  var numEl = document.getElementById('countdownNumber');
  var current = seconds;
  numEl.textContent = current;
  numEl.style.transform = 'scale(1.2)';
  numEl.style.opacity = '0';
  
  if (window.gsap) {
    gsap.fromTo(numEl, { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
  } else {
    numEl.style.transform = 'scale(1)';
    numEl.style.opacity = '1';
  }
  
  if (_countdownTimer) clearInterval(_countdownTimer);
  _countdownTimer = setInterval(function() {
    current--;
    if (current <= 0) {
      clearInterval(_countdownTimer);
      _countdownTimer = null;
      if (window.gsap) {
        gsap.to(numEl, { scale: 0.8, opacity: 0, duration: 0.3, onComplete: function() {
          overlay.style.display = 'none';
          if (onComplete) onComplete();
        }});
      } else {
        overlay.style.display = 'none';
        if (onComplete) onComplete();
      }
      return;
    }
    numEl.textContent = current;
    if (window.gsap) {
      gsap.fromTo(numEl, { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
    }
  }, 1000);
}

function cancelCountdown() {
  if (_countdownTimer) {
    clearInterval(_countdownTimer);
    _countdownTimer = null;
  }
  var overlay = document.getElementById('countdownOverlay');
  if (overlay) overlay.style.display = 'none';
}

function initSpectatorPauseBtn() {
  var btn = document.getElementById('spectatorPauseBtn');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', function() {
    toggleSpectatorPause();
  });
}

// 暂停/继续（供按钮点击和键盘T键调用）
function toggleSpectatorPause() {
  if (_spectatorPaused) {
    // 从暂停恢复：先取消可能存在的倒计时
    cancelCountdown();
    // 3秒倒计时
    showCountdownOverlay(3, function() {
      _spectatorPaused = false;
      _deployPauseInitial = false;
      updateSpectatorPauseBtnVisibility();
      // 如果当前是 AI 回合，重新触发 runAITurn
      if (TurnState.phase === 'battle' && isControlledByAI(TurnState.currentPlayer)) {
        setTimeout(function() { runAITurn(TurnState.currentPlayer); }, battleDelay(100));
      }
    });
  } else {
    // 暂停：取消倒计时并立即暂停
    cancelCountdown();
    _spectatorPaused = true;
    updateSpectatorPauseBtnVisibility();
  }
}

function initTurns() {
  TurnState.currentRound = 0;
  TurnState.currentPlayer = '';
  TurnState.phase = 'dice';
  TurnState.firstPlayer = '';
  TurnState.difficulty = window.selectedDifficulty || 'easy';
  TurnState.deployCount = { player: 0, enemy: 0 };
  TurnState.totalPlayer = 0;
  TurnState.totalEnemy = 0;
  TurnState._aiTurnActive = false;
  // 重置地形，防止上一场战斗的地形残留
  if (typeof resetTerrain === 'function') resetTerrain();
  document.getElementById('turnStatus').style.display = 'none';
  document.getElementById('warReport').style.display = 'none';
}

// ===== 判断某阵营是否由 AI 控制 =====
function isControlledByAI(team) {
  // 斗蛐蛐模式：按双方 controlFlag 判断
  if (TurnState.isDuelBattle) {
    if (team === 'player') return !!TurnState.sideAControlledByAI;
    if (team === 'enemy') return !!TurnState.sideBControlledByAI;
  }
  // 默认：enemy 是 AI，player 是人类
  return team === 'enemy';
}

function rollDiceAndStart() {
  var playerRoll = Math.floor(Math.random() * 6) + 1;
  var enemyRoll = Math.floor(Math.random() * 6) + 1;

  TurnState.firstPlayer = playerRoll > enemyRoll ? 'player' : (playerRoll < enemyRoll ? 'enemy' : (Math.random() > 0.5 ? 'player' : 'enemy'));
  TurnState.currentPlayer = TurnState.firstPlayer;
  TurnState.phase = 'deploy';
  TurnState.currentRound = 1;
  TurnState.deployCount = { player: 0, enemy: 0 };
  TurnState.difficulty = window.selectedDifficulty || 'easy';

  // ===== 初始化地形系统 =====
  if (typeof resetTerrain === 'function') resetTerrain();
  // 生成地形（5个山脉 + 中心湖泊）
  generateTerrain();
  // 地形生成后刷新背景缓存，让地形正确渲染
  if (typeof invalidateBackgroundCache === 'function') invalidateBackgroundCache();

  // ===== 选择 AI 性格 =====
  // 斗蛐蛐模式：使用界面预设的性格（"随机"则加权随机）
  // 非斗蛐蛐模式：加权随机选择
  TurnState._aiPersonality = {};
  var types = ['offensive', 'defensive', 'balanced'];
  var weights = [0.4, 0.35, 0.25];

  // 从斗蛐蛐界面读取预设性格
  var presetPersA = null, presetPersB = null;
  if (TurnState.isDuelBattle && window._duelBattleData) {
    presetPersA = (window._duelBattleData.sideA && window._duelBattleData.sideA.personality) || 'random';
    presetPersB = (window._duelBattleData.sideB && window._duelBattleData.sideB.personality) || 'random';
  }

  if (isControlledByAI('player')) {
    TurnState._aiPersonality['player'] = (presetPersA && presetPersA !== 'random') ? presetPersA : weightedRandom(types, weights);
  }
  if (isControlledByAI('enemy')) {
    TurnState._aiPersonality['enemy'] = (presetPersB && presetPersB !== 'random') ? presetPersB : weightedRandom(types, weights);
  }
  if (console && console.log) {
    console.log('[AI性格] player=' + (TurnState._aiPersonality['player'] || '人类') + ' enemy=' + (TurnState._aiPersonality['enemy'] || '人类'));
  }

  var benchSlotsLeft = document.querySelectorAll('#benchLeft .bench-slot');
  var benchSlotsRight = document.querySelectorAll('#benchRight .bench-slot');
  TurnState.totalPlayer = 0;
  TurnState.totalEnemy = 0;
  benchSlotsLeft.forEach(function(s) { if (!s.classList.contains('empty')) TurnState.totalPlayer++; });
  benchSlotsRight.forEach(function(s) { if (!s.classList.contains('empty')) TurnState.totalEnemy++; });

  showDiceResult(playerRoll, enemyRoll);
  updateDeployUI();
}

// 加权随机选择
function weightedRandom(items, weights) {
  var total = weights.reduce(function(a, b) { return a + b; }, 0);
  var r = Math.random() * total;
  var sum = 0;
  for (var i = 0; i < items.length; i++) {
    sum += weights[i];
    if (r <= sum) return items[i];
  }
  return items[items.length - 1];
}

function showDiceResult(playerRoll, enemyRoll) {
  var s1 = ['','⚀','⚁','⚂','⚃','⚄','⚅'];
  var sideAName, sideBName, sideALabel, sideBLabel;
  if (TurnState.isDuelBattle && window._duelBattleData) {
    sideAName = (window._duelBattleData.sideA && window._duelBattleData.sideA.name) || '甲方';
    sideBName = (window._duelBattleData.sideB && window._duelBattleData.sideB.name) || '乙方';
    sideALabel = '甲方';
    sideBLabel = '乙方';
  } else {
    sideAName = (typeof GameState !== 'undefined' && GameState.saveName) ? GameState.saveName : '我方';
    sideBName = 'AI统帅';
    sideALabel = '我方';
    sideBLabel = '敌方';
  }
  var isPlayerFirst = TurnState.firstPlayer === 'player';
  var msg = '🎲 掷骰结果\n\n' + sideALabel + ' 「' + sideAName + '」 ' + s1[playerRoll] + ' ' + playerRoll + '点\n' + sideBLabel + ' 「' + sideBName + '」 ' + s1[enemyRoll] + ' ' + enemyRoll + '点\n\n' + (isPlayerFirst ? ('🏆 ' + sideALabel + '先手！') : ('🏆 ' + sideBLabel + '先手！'));
  alert(msg);
}

// ===== 放置阶段 =====
function updateDeployUI() {
  var panel = document.getElementById('turnStatus');
  if (TurnState.phase !== 'deploy') { panel.style.display = 'none'; return; }
  var sideLabel;
  if (TurnState.isDuelBattle) {
    sideLabel = TurnState.currentPlayer === 'player' ? '甲方' : '乙方';
  } else {
    sideLabel = TurnState.currentPlayer === 'player' ? '我方' : '敌方';
  }
  var who = (TurnState.currentPlayer === 'player' ? '🔷 ' : '🔶 ') + sideLabel + '放置';
  var d = TurnState.deployCount;
  var dl = { easy: '简单', hard: '困难', legend: '传说' }[TurnState.difficulty] || '简单';
  var deployInfo;
  if (TurnState.isDuelBattle) {
    deployInfo = '<span style="font-size:11px;color:#6b4c2a">甲方 ' + d.player + '/' + TurnState.totalPlayer + ' | 乙方 ' + d.enemy + '/' + TurnState.totalEnemy + '</span> ';
  } else {
    deployInfo = '<span style="font-size:11px;color:#6b4c2a">我方 ' + d.player + '/' + TurnState.totalPlayer + ' | 敌方 ' + d.enemy + '/' + TurnState.totalEnemy + '</span> ';
  }
  panel.innerHTML = '<span style="font-weight:bold">📦 部署阶段 — ' + who + '（难度：' + dl + '）</span> ' +
    deployInfo +
    '<span style="font-size:10px;color:#8b2500">中心一环及敌方2格内禁止放置</span>';
  panel.style.display = 'flex';
  if (isControlledByAI(TurnState.currentPlayer)) { setTimeout(aiDeployPiece, battleDelay(500)); }
}

function getSlotIndexInContainer(container, slotIdx) {
  for (var i = 0; i < container.length; i++) { if (parseInt(container[i].dataset.slotIdx) === slotIdx) return i; }
  return 0;
}

function onPlayerPlacePiece() {
  if (TurnState.phase !== 'deploy') return;
  if (isControlledByAI(TurnState.currentPlayer)) return; // AI 方不接受人类放置
  TurnState.deployCount[TurnState.currentPlayer]++;
  requestRender();
  nextDeployPlayer();
}

function nextDeployPlayer() {
  if (TurnState.deployCount.player >= TurnState.totalPlayer && TurnState.deployCount.enemy >= TurnState.totalEnemy) { startBattlePhase(); return; }
  if (TurnState.currentPlayer === 'player') TurnState.currentPlayer = 'enemy'; else TurnState.currentPlayer = 'player';
  if (TurnState.currentPlayer === 'player' && TurnState.deployCount.player >= TurnState.totalPlayer) { nextDeployPlayer(); return; }
  if (TurnState.currentPlayer === 'enemy' && TurnState.deployCount.enemy >= TurnState.totalEnemy) { nextDeployPlayer(); return; }
  updateDeployUI();
}

function tryEndDeploy() {
  if (TurnState.deployCount.player >= TurnState.totalPlayer && TurnState.deployCount.enemy >= TurnState.totalEnemy) startBattlePhase();
  else nextDeployPlayer();
}

// ===== 战斗阶段 =====
function startBattlePhase() {
  TurnState.phase = 'battle';
  TurnState.currentPlayer = TurnState.firstPlayer;
  TurnState.currentRound = 1;
  // 记录后手方（非先手方），第一回合获得 30% 减伤
  TurnState.secondPlayer = TurnState.firstPlayer === 'player' ? 'enemy' : 'player';
  Object.keys(placedPieces).forEach(function(k) {
    placedPieces[k]._actionUsedThisTurn = false;
    placedPieces[k]._attackedThisTick = false;
    placedPieces[k]._wasAttackedThisTurn = false;
    placedPieces[k]._didActionThisTurn = false;
    placedPieces[k]._chargeDistance = 0;
  });
  // 第一回合开始：检测包围状态
  processTurnStart(TurnState.firstPlayer);
  // 重置记分板
  if (typeof resetScoreboard === 'function') resetScoreboard();
  
  // 斗蛐蛐模式：部署结束后自动暂停，等待玩家点击开始
  if (TurnState.isDuelBattle) {
    _spectatorPaused = true;
    _deployPauseInitial = true;
  }
  
  updateBattleUI();
  // 斗蛐蛐模式：第一回合显示回合提示
  if (TurnState.isDuelBattle) {
    showTurnNotify(TurnState.firstPlayer);
  }
  if (isControlledByAI(TurnState.currentPlayer)) {
    // 双 AI 观战模式给玩家更长观看时间（1.5s），否则 600ms；暂停时不触发
    if (!_spectatorPaused) {
      var startDelay = (TurnState.isDuelBattle && isControlledByAI('player') && isControlledByAI('enemy')) ? 1500 : 600;
      setTimeout(function() { runAITurn(TurnState.currentPlayer); }, battleDelay(startDelay));
    }
  }
}

// 回合开始处理（包围检测、主动重整）
function processTurnStart(team) {
  Object.keys(placedPieces).forEach(function(k) {
    var p = placedPieces[k];
    if (p.team !== team || p._routed) return;

    // 检测包围状态（状态型debuff：只触发一次，脱离后恢复，可再次触发）
    var enemyCount = 0;
    for (var i = 0; i < HEX_DIRS.length; i++) {
      var d = HEX_DIRS[i];
      var nk = (p.hex.q + d.q) + ',' + (p.hex.r + d.r) + ',' + (-p.hex.q - d.q - p.hex.r - d.r);
      if (placedPieces[nk] && placedPieces[nk].team !== team && !placedPieces[nk]._routed) {
        enemyCount++;
      }
    }
    var isSurrounded = enemyCount >= 3;
    var wasSurrounded = p._wasSurrounded || false;
    var udName = (unitDefByType(p.unitType) || {name: '未知'}).name;
    if (isSurrounded && !wasSurrounded) {
      // 新被包围：加debuff，士气-5（只触发一次）
      p._currentMorale = Math.max(0, (p._currentMorale || 0) - 5);
      var ud = typeof unitDefByType === 'function' ? unitDefByType(p.unitType) : null;
      if (p._neverRout || (ud && ud._neverRout)) {
        p._currentMorale = Math.max(1, p._currentMorale);
      }
      if (typeof addPieceStatus === 'function') {
        addPieceStatus(p, 'surrounded', Infinity, '⚑', '#ff6600');
      }
      addWarReportLine('[包围] ' + udName + ' 被三面以上敌军包围，士气-5！');
    } else if (!isSurrounded && wasSurrounded) {
      // 脱离包围：移除debuff，士气+5（恢复）
      p._currentMorale = Math.min(100, (p._currentMorale || 0) + 5);
      removePieceStatus(p, 'surrounded');
      addWarReportLine('[包围] ' + udName + ' 脱离包围，士气+5（恢复）');
    }
    p._wasSurrounded = isSurrounded;
  });
}

// 回合结束处理（士气恢复、状态递减）
function processTurnEnd(team) {
  Object.keys(placedPieces).forEach(function(k) {
    var p = placedPieces[k];
    if (p.team !== team || p._routed) return;

    // 方案A：回合结束自动恢复士气（未被攻击+未行动的单位+3）
    if (!p._wasAttackedThisTurn && !p._didActionThisTurn) {
      p._currentMorale = Math.min(100, (p._currentMorale || 0) + 3);
    }

    // 重置回合标记
    p._wasAttackedThisTurn = false;
    p._didActionThisTurn = false;

    // 状态回合数递减
    if (typeof tickStatuses === 'function') {
      tickStatuses(p);
    }

    var ud = typeof unitDefByType === 'function' ? unitDefByType(p.unitType) : null;
    if ((p._neverRout) || (ud && ud._neverRout)) {
      p._currentMorale = Math.max(1, p._currentMorale || 0);
    }
  });
}

function endTurn() {
  if (TurnState.phase !== 'battle') return;

  // 清除 AI 回合活跃标记（允许下个 runAITurn 重置棋子状态）
  TurnState._aiTurnActive = false;

  // 先处理当前玩家回合结束
  var currentTeam = TurnState.currentPlayer;
  processTurnEnd(currentTeam === 'player' ? 'player' : 'enemy');

  if (TurnState.currentPlayer === 'player') {
    // 切到 enemy 回合
    TurnState.currentPlayer = 'enemy';
    Object.keys(placedPieces).forEach(function(k) {
      if (placedPieces[k].team === 'enemy') {
        placedPieces[k]._actionUsedThisTurn = false;
        placedPieces[k]._attackedThisTick = false;
        placedPieces[k]._chargeDistance = 0;
      }
    });
    processTurnStart('enemy');
    updateBattleUI();
    // 显示回合提示（斗蛐蛐模式下始终显示）
    if (TurnState.isDuelBattle) {
      showTurnNotify('enemy');
    }
    // 按 controlFlag 决定是否调 AI（斗蛐蛐模式下乙方可能由人类操作）
    if (isControlledByAI('enemy')) {
      // 双 AI 观战模式给玩家更长观看时间（1.5s），否则 600ms；暂停时不触发
      if (!_spectatorPaused) {
        var switchDelay = (TurnState.isDuelBattle && isControlledByAI('player') && isControlledByAI('enemy')) ? 1500 : 600;
        setTimeout(function() { runAITurn('enemy'); }, battleDelay(switchDelay));
      }
    } else if (!TurnState.isDuelBattle) {
      // 非斗蛐蛐模式下，人类操作的敌方回合，显示提示
      showTurnNotify('enemy');
    }
  } else {
    // 切到 player 回合
    TurnState.currentPlayer = 'player';
    TurnState.currentRound++;
    Object.keys(placedPieces).forEach(function(k) {
      if (placedPieces[k].team === 'player') {
        placedPieces[k]._actionUsedThisTurn = false;
        placedPieces[k]._attackedThisTick = false;
        placedPieces[k]._chargeDistance = 0;
      }
    });
    processTurnStart('player');
    updateBattleUI();
    // 显示回合提示（斗蛐蛐模式下始终显示）
    if (TurnState.isDuelBattle) {
      showTurnNotify('player');
    }
    // 按 controlFlag 决定是否调 AI（斗蛐蛐模式下甲方可能由 AI 操作）
    if (isControlledByAI('player')) {
      // 双 AI 观战模式给玩家更长观看时间（1.5s），否则 600ms；暂停时不触发
      if (!_spectatorPaused) {
        var switchDelay2 = (TurnState.isDuelBattle && isControlledByAI('player') && isControlledByAI('enemy')) ? 1500 : 600;
        setTimeout(function() { runAITurn('player'); }, battleDelay(switchDelay2));
      }
    } else {
      showTurnNotify('player');
    }
  }
  requestRender();
}

function updateBattleUI() {
  var panel = document.getElementById('turnStatus');
  if (TurnState.phase !== 'battle') return;
  initBattleSpeedControls();
  updateBattleSpeedControlsVisibility();
  initSpectatorPauseBtn();
  updateSpectatorPauseBtnVisibility();
  if (typeof updateScoreboardUI === 'function') updateScoreboardUI();
  var dl = { easy: '简单', hard: '困难', legend: '传说' }[TurnState.difficulty] || '简单';
  var isPlayerTurn = TurnState.currentPlayer === 'player';
  var sideLabel;
  var sideName;
  if (TurnState.isDuelBattle && window._duelBattleData) {
    sideName = isPlayerTurn
      ? ((window._duelBattleData.sideA && window._duelBattleData.sideA.name) || '甲方')
      : ((window._duelBattleData.sideB && window._duelBattleData.sideB.name) || '乙方');
    sideLabel = sideName;
  } else if (TurnState.isDuelBattle) {
    sideLabel = isPlayerTurn ? '甲方' : '乙方';
  } else {
    sideLabel = isPlayerTurn ? '我方' : '敌方';
  }
  var roundInfo = '第' + TurnState.currentRound + '回合';
  // AI对战/斗蛐蛐模式不显示难度标签
  if (!TurnState.isAIBattle && !TurnState.isDuelBattle) {
    roundInfo += ' · ' + dl + '难度';
  }
  var who = isPlayerTurn ? ('🔷 ' + sideLabel + '回合（' + roundInfo + '）') : ('🔶 ' + sideLabel + '回合（' + roundInfo + '）');

  // 提示文字：斗蛐蛐模式下根据是否 AI 控制决定提示
  var isAITurn = isControlledByAI(TurnState.currentPlayer);
  var tipText;
  if (isAITurn) {
    tipText = '<span style="font-size:12px;color:#8b2500;margin-left:8px;font-weight:bold">⏳ AI 思考中...</span>';
  } else {
    tipText = '<span style="font-size:12px;color:#6b4c2a;margin-left:8px">选' + sideLabel + '棋子 → 移动（绿）或攻击（红）</span>';
  }
  var btnState = isAITurn ? 'disabled' : '';
  var btnText = isAITurn ? (sideLabel + '行动中...') : '结束回合 →';

  var wasHidden = panel.style.display !== 'flex';
  panel.innerHTML = '<div class="turn-info"><span style="font-weight:bold;font-size:17px">' + who + '</span>' + tipText + '</div>' +
    '<button class="turn-btn" ' + btnState + ' onclick="endTurn()">' + btnText + '</button>';
  panel.style.display = 'flex';

  // 回合切换动画
  if (window.gsap && !wasHidden) {
    gsap.fromTo(panel,
      { opacity: 0.7, y: -5 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
    );
    var turnInfo = panel.querySelector('.turn-info');
    if (turnInfo) {
      gsap.fromTo(turnInfo,
        { x: -10, opacity: 0.5 },
        { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }
      );
    }
    var turnBtn = panel.querySelector('.turn-btn');
    if (turnBtn && isPlayerTurn) {
      gsap.fromTo(turnBtn,
        { scale: 0.9, opacity: 0.8 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.5)' }
      );
    }
  }
}

// ===== AI 战斗行动（已迁移到 ai-engine.js）=====

function showTurnNotify(team) {
  var el = document.getElementById('turnNotify');
  if (!el) return;
  var isPlayer = team === 'player';
  if (TurnState.isDuelBattle && window._duelBattleData) {
    var sideName = isPlayer
      ? ((window._duelBattleData.sideA && window._duelBattleData.sideA.name) || '甲方')
      : ((window._duelBattleData.sideB && window._duelBattleData.sideB.name) || '乙方');
    el.textContent = isPlayer ? ('🔷 「' + sideName + '」的回合') : ('🔶 「' + sideName + '」的回合');
  } else {
    var saveName = (typeof GameState !== 'undefined' && GameState.saveName) ? GameState.saveName : '我方';
    if (isPlayer) {
      el.textContent = '🔷 「' + saveName + '」的回合';
    } else {
      el.textContent = '🔶 敌方行动中...';
    }
  }
  el.className = 'turn-notify';
  el.style.display = 'block';
  // 强制重排触发重新进入动画
  void el.offsetWidth;
  el.classList.add('show');
  // 显示时间：斗蛐蛐模式下更短（约1秒），其他模式1.8秒
  var showDuration = TurnState.isDuelBattle ? 1000 : 1800;
  setTimeout(function() {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(function() {
      el.style.display = 'none';
      el.className = 'turn-notify';
    }, 300);
  }, showDuration);
}

// ===== 击杀漂浮提示 =====
function showKillNotify(atkName, defName) {
  var el = document.getElementById('killNotify');
  if (!el) {
    el = document.createElement('div');
    el.id = 'killNotify';
    el.style.cssText = 'position:fixed;top:18%;left:50%;transform:translateX(-50%);' +
      'z-index:9997;pointer-events:none;display:none;';
    document.body.appendChild(el);
  }
  el.innerHTML = '<div style="' +
    'background:linear-gradient(135deg,rgba(80,15,15,0.92),rgba(120,30,20,0.92));' +
    'border:2px solid #c44a2a;border-radius:10px;padding:12px 24px;' +
    'box-shadow:0 0 30px rgba(200,60,30,0.5),0 4px 16px rgba(0,0,0,0.5);' +
    'text-align:center;">' +
    '<div style="font-size:17px;font-weight:bold;color:#ff6b35;text-shadow:0 0 10px rgba(255,100,50,0.8);">' +
    escapeHtml(atkName) + ' <span style="color:#ccc;font-size:13px;">击溃了</span> ' + escapeHtml(defName) +
    '</div></div>';
  el.style.display = 'block';
  el.style.opacity = '0';
  void el.offsetWidth;

  if (window.gsap) {
    gsap.fromTo(el,
      { opacity: 0, y: 20, scale: 0.85 },
      { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.5)' }
    );
    // 出现后缓慢向上飘移，避免遮挡
    gsap.to(el, { y: -25, duration: 0.9, ease: 'none', delay: 0.3 });
    setTimeout(function() {
      gsap.to(el, { opacity: 0, y: -40, scale: 0.9, duration: 0.35, ease: 'power2.in', onComplete: function() {
        el.style.display = 'none';
      }});
    }, 900);
  } else {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%)';
    setTimeout(function() {
      el.style.opacity = '0';
      setTimeout(function() { el.style.display = 'none'; }, 350);
    }, 900);
  }
}

function getPieceStats(piece) {
  var ud = unitDefByType(piece.unitType);
  if (!ud) return null;
  var st = computeStats(ud);
  if (!st) return null;
  st.baseType = ud.baseType || ud.type;
  if (piece._currentHP !== undefined) st.totalHP = piece._currentHP;
  if (piece._currentCount !== undefined) st.unitCount = piece._currentCount;
  if (piece._currentMorale !== undefined) st.morale = piece._currentMorale;
  st.hpPerUnit = (piece._currentHP && piece._currentCount)
    ? Math.ceil(piece._currentHP / piece._currentCount) : st.hpPerUnit;
  return st;
}

function initPieceRuntimeState(piece) {
  var ud = unitDefByType(piece.unitType);
  if (!ud) return;
  var st = computeStats(ud);
  if (!st) return;
  piece._currentHP = st.totalHP;
  piece._currentCount = ud.unitCount;
  piece._currentMorale = st.morale;
  piece._initialHP = st.totalHP;
  piece._initialCount = ud.unitCount;
  piece._initialMorale = st.morale;
  piece._routed = false;
  piece._actionUsedThisTurn = false;
  piece._attackedThisTick = false;
  piece._wasAttackedThisTurn = false;
  // 朝向：默认朝右，放置时会根据位置重新计算
  piece._facing = piece._facing !== undefined ? piece._facing : 0;
  // 状态系统
  piece._statuses = piece._statuses || {};
  // 记分板：每个棋子独立追踪伤害和击杀
  piece._damageDealt = 0;
  piece._kills = 0;
}

// ===== 战斗键盘快捷键（仅在战斗进行时生效）=====
// 0→0.5x  1→1x  2→2x  3→3x  T→暂停/继续
(function initBattleKeyboardControls() {
  document.addEventListener('keydown', function(e) {
    // 仅在战斗页面且战斗阶段才响应
    var battlePage = document.getElementById('pageBattle');
    if (!battlePage || battlePage.style.display === 'none') return;
    if (typeof TurnState !== 'undefined' && TurnState.phase !== 'battle') return;

    // 忽略输入框等焦点状态
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    var key = e.key;

    // 速度快捷键：0/1/2/3
    if (key === '0') {
      e.preventDefault();
      BATTLE_SPEED_MULT = 0.5;
      updateBattleSpeedControlsVisibility();
      showSpeedHint(0.5);
      return;
    }
    if (key === '1') {
      e.preventDefault();
      BATTLE_SPEED_MULT = 1.0;
      updateBattleSpeedControlsVisibility();
      showSpeedHint(1);
      return;
    }
    if (key === '2') {
      e.preventDefault();
      BATTLE_SPEED_MULT = 2.0;
      updateBattleSpeedControlsVisibility();
      showSpeedHint(2);
      return;
    }
    if (key === '3') {
      e.preventDefault();
      BATTLE_SPEED_MULT = 3.0;
      updateBattleSpeedControlsVisibility();
      showSpeedHint(3);
      return;
    }

    // 暂停快捷键：T
    if (key === 't' || key === 'T') {
      e.preventDefault();
      toggleSpectatorPause();
      return;
    }
  });

  // 速度切换提示（短暂显示）
  function showSpeedHint(speed) {
    var ctrl = document.getElementById('battleSpeedControls');
    if (!ctrl) return;
    // 短暂高亮当前速度
    var hint = document.createElement('span');
    hint.className = 'speed-hint';
    hint.textContent = speed + 'x';
    hint.style.cssText = 'color:#ffd700;font-weight:bold;margin-left:4px;animation:fadeOut 1s forwards;';
    ctrl.appendChild(hint);
    setTimeout(function() {
      if (hint.parentNode) hint.parentNode.removeChild(hint);
    }, 1000);
  }
})();

