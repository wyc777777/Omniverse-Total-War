// AI路径引导：如需查找其他文件路径和功能说明，请先查看项目根目录的 AI_PATH_GUIDE.md
// 每新增/修改一个文件后必须同步更新 AI_PATH_GUIDE.md
// ==================== 部署系统 ====================
// 包含：部署算法、AI部署策略、部署流程控制、备战席系统、拖拽放置、双击回收
// 依赖：TurnState（turn-system.js）、hDist/isTerrainBlocked（hex-board.js）、computeStats/unitDefByType（data-engine.js）

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
  var team = TurnStateAPI.getCurrentPlayer(); // 使用 TurnStateAPI 解耦
  if (TurnStateAPI.getPhase() !== 'deploy') return; // 使用 TurnStateAPI 解耦
  if (!isControlledByAI(team)) return;

  // AI斗蛐蛐模式：固定五环对称部署，不使用难度策略
  if (TurnStateAPI.isDuelBattle() && TurnStateAPI.isControlledByAI('player') && TurnStateAPI.isControlledByAI('enemy')) { // 使用 TurnStateAPI 解耦
    aiDeployPieceDuel(team);
    return;
  }

  var isFirstPlayer = (team === TurnStateAPI.getFirstPlayer()); // 使用 TurnStateAPI 解耦
  var deployCount = TurnStateAPI.getDeployCount()[team] || 0; // 使用 TurnStateAPI 解耦
  var _totals = TurnStateAPI.getTotals(); // 使用 TurnStateAPI 解耦
  var totalCount = (team === 'enemy') ? _totals.totalEnemy : _totals.totalPlayer;
  var personality = TurnStateAPI.getAIPersonality(team) || 'balanced'; // 使用 TurnStateAPI 解耦
  if (TurnStateAPI.getDeployCount()[team] >= totalCount) { tryEndDeploy(); return; } // 使用 TurnStateAPI 解耦

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
  // 使用 BoardAPI 解耦 API 添加棋子
  var piece = { unitType: unitType, team: team, slotIdx: slotIdx, hex: { q: h.q, r: h.r, s: h.s } };
  piece._facing = getFacingToCenter(h);
  BoardAPI.addPiece(key, piece);
  initPieceRuntimeState(piece);
  benchState[slotIdx] = false;
  var benchSelector = (team === 'enemy') ? '#benchRight .bench-slot' : '#benchLeft .bench-slot';
  var benchSlots = document.querySelectorAll(benchSelector);
  benchSlots[getSlotIndexInContainer(benchSlots, slotIdx)].classList.add('empty');
  TurnStateAPI.getDeployCount()[team]++; // 使用 TurnStateAPI 解耦
  requestRender();
  nextDeployPlayer();
}

// ===== AI斗蛐蛐模式专用部署：中心对称边部署 =====
// 六边形有6条边，3对中心对称边。随机选一对，甲方一边、乙方一边。
// 从5环开始放，超过6个扩展到4环。
// 边定义: 0:r=-R(上) 1:q=+R(右上) 2:s=-R(右下) 3:r=+R(下) 4:q=-R(左下) 5:s=+R(左上)
// 对称对: (0,3) (1,4) (2,5)
var _duelEdgeAssignment = null;
var DUEL_EDGE_PAIRS = [[0, 3], [1, 4], [2, 5]];

function aiDeployPieceDuel(team) {
  var isFirstPlayer = (team === TurnStateAPI.getFirstPlayer()); // 使用 TurnStateAPI 解耦
  var deployCount = TurnStateAPI.getDeployCount()[team] || 0; // 使用 TurnStateAPI 解耦
  var _totals = TurnStateAPI.getTotals(); // 使用 TurnStateAPI 解耦
  var totalCount = (team === 'enemy') ? _totals.totalEnemy : _totals.totalPlayer;
  if (deployCount >= totalCount) { tryEndDeploy(); return; }

  var available = getAvailableUnits(team);
  if (available.length === 0) { tryEndDeploy(); return; }

  // 首次部署时随机选择对称边对
  if (!_duelEdgeAssignment) {
    var pairIdx = Math.floor(Math.random() * DUEL_EDGE_PAIRS.length);
    _duelEdgeAssignment = {
      firstEdge: DUEL_EDGE_PAIRS[pairIdx][0],
      secondEdge: DUEL_EDGE_PAIRS[pairIdx][1]
    };
  }

  // 随机选单位
  var pick = available[Math.floor(Math.random() * available.length)];
  var slotIdx = pick.slotIdx;
  var unitType = pick.unitType;

  // 收集候选格子（己方边的5环优先，4环兜底）
  var cands = collectDuelCandidateHexes(team, isFirstPlayer, deployCount);
  if (cands.length === 0) {
    cands = collectCandidateHexes(team);
  }
  if (cands.length === 0) return;

  var selected = selectDuelPosition(team, pick, cands, isFirstPlayer, deployCount);
  if (!selected) selected = cands[Math.floor(Math.random() * cands.length)];

  // 放置单位
  var h = selected.hex;
  var key = selected.key;
  // 使用 BoardAPI 解耦 API 添加棋子
  var piece = { unitType: unitType, team: team, slotIdx: slotIdx, hex: { q: h.q, r: h.r, s: h.s } };
  piece._facing = getFacingToCenter(h);
  BoardAPI.addPiece(key, piece);
  initPieceRuntimeState(piece);
  benchState[slotIdx] = false;
  var benchSelector = (team === 'enemy') ? '#benchRight .bench-slot' : '#benchLeft .bench-slot';
  var benchSlots = document.querySelectorAll(benchSelector);
  benchSlots[getSlotIndexInContainer(benchSlots, slotIdx)].classList.add('empty');
  TurnStateAPI.getDeployCount()[team]++; // 使用 TurnStateAPI 解耦
  requestRender();
  nextDeployPlayer();
}

// 获取某条边指定环数的可用格子
function getEdgeHexes(edgeIdx, ring) {
  var result = [];
  hexes.forEach(function(h) {
    if (hDist(h, {q:0,r:0,s:0}) !== ring) return;
    var key = h.q + ',' + h.r + ',' + h.s;
    if (BoardAPI.hasPiece(key)) return; // 使用 BoardAPI 解耦 API
    if (typeof isTerrainBlocked === 'function' && isTerrainBlocked(h)) return;
    var belongs = false;
    switch(edgeIdx) {
      case 0: belongs = (h.r === -ring); break;
      case 1: belongs = (h.q === ring); break;
      case 2: belongs = (h.s === -ring); break;
      case 3: belongs = (h.r === ring); break;
      case 4: belongs = (h.q === -ring); break;
      case 5: belongs = (h.s === ring); break;
    }
    if (belongs) result.push({ key: key, hex: h });
  });
  return result;
}

// 斗蛐蛐候选格子：己方边的5环优先，不够时扩展到4环
function collectDuelCandidateHexes(team, isFirstPlayer, deployCount) {
  var edgeIdx = isFirstPlayer ? _duelEdgeAssignment.firstEdge : _duelEdgeAssignment.secondEdge;

  var ring5 = getEdgeHexes(edgeIdx, 5);
  var ring4 = getEdgeHexes(edgeIdx, 4);

  var _totals2 = TurnStateAPI.getTotals(); // 使用 TurnStateAPI 解耦
  var remaining = (team === 'enemy' ? _totals2.totalEnemy : _totals2.totalPlayer) - deployCount;
  // 5环够用就只用5环，不够才混合4环
  if (ring5.length >= remaining) return ring5;
  return ring5.concat(ring4);
}

// 斗蛐蛐位置选择：第一个棋子边上随机，后续抱团
function selectDuelPosition(team, pick, cands, isFirstPlayer, deployCount) {
  if (cands.length === 0) return null;

  var myHexes = [];
  // 使用 BoardAPI 解耦 API 按队伍过滤
  BoardAPI.getPiecesByTeam(team).forEach(function(p) {
    myHexes.push(p.hex);
  });

  // 第一个棋子：在己方边上随机放置
  if (myHexes.length === 0) {
    return cands[Math.floor(Math.random() * cands.length)];
  }

  // 后续棋子：抱团部署
  var best = null;
  var bestScore = -Infinity;
  for (var j = 0; j < cands.length; j++) {
    var c = cands[j];
    var score = 0;

    var minDistAlly = Infinity;
    var allyIn1 = 0;
    for (var m = 0; m < myHexes.length; m++) {
      var dAlly = hDist(c.hex, myHexes[m]);
      if (dAlly < minDistAlly) minDistAlly = dAlly;
      if (dAlly <= 1) allyIn1++;
    }
    score += allyIn1 * 10;
    score -= minDistAlly * 3;
    if (allyIn1 >= 3) score -= 30;

    // 优先5环
    var distCenter = hDist(c.hex, {q:0,r:0,s:0});
    if (distCenter === 5) score += 5;
    else if (distCenter === 4) score += 2;

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
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
  // 使用 BoardAPI 解耦 API 遍历棋子
  BoardAPI.forEach(function(p) {
    if (p.team === team) {
      myHexes.push(p.hex);
    } else {
      oppHexes.push(p.hex);
    }
  });

  var cands = [];
  hexes.forEach(function(h) {
    var key = h.q + ',' + h.r + ',' + h.s;
    if (BoardAPI.hasPiece(key)) return; // 使用 BoardAPI 解耦 API
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
  // 使用 BoardAPI 解耦 API 遍历棋子
  BoardAPI.forEach(function(p) {
    if (p.team === team) {
      myHexes.push(p.hex);
    } else {
      oppHexes.push(p.hex);
    }
  });

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
    // 使用 BoardAPI 解耦 API 遍历查找敌方棋子
    var _allPieces = BoardAPI.getAllPieces();
    for (var ai2 = 0; ai2 < _allPieces.length; ai2++) {
      if (_allPieces[ai2].team !== team) { a1Piece = _allPieces[ai2]; break; }
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
        // 使用 BoardAPI 解耦 API 按 hex 查找棋子
        var oppPiece = BoardAPI.findPieceByHex(oppHexes[j]);
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

// ===== 放置阶段 =====
function updateDeployUI() {
  var panel = document.getElementById('turnStatus');
  if (TurnStateAPI.getPhase() !== 'deploy') { panel.style.display = 'none'; return; } // 使用 TurnStateAPI 解耦
  var sideLabel;
  if (TurnStateAPI.isDuelBattle()) { // 使用 TurnStateAPI 解耦
    sideLabel = TurnStateAPI.getCurrentPlayer() === 'player' ? '甲方' : '乙方'; // 使用 TurnStateAPI 解耦
  } else {
    sideLabel = TurnStateAPI.getCurrentPlayer() === 'player' ? '我方' : '敌方'; // 使用 TurnStateAPI 解耦
  }
  var who = (TurnStateAPI.getCurrentPlayer() === 'player' ? '🔷 ' : '🔶 ') + sideLabel + '放置'; // 使用 TurnStateAPI 解耦
  var d = TurnStateAPI.getDeployCount(); // 使用 TurnStateAPI 解耦
  var dl = { easy: '简单', hard: '困难', legend: '传说' }[TurnStateAPI.getDifficulty()] || '简单'; // 使用 TurnStateAPI 解耦
  var deployInfo;
  var _t = TurnStateAPI.getTotals(); // 使用 TurnStateAPI 解耦
  if (TurnStateAPI.isDuelBattle()) { // 使用 TurnStateAPI 解耦
    deployInfo = '<span style="font-size:11px;color:#6b4c2a">甲方 ' + d.player + '/' + _t.totalPlayer + ' | 乙方 ' + d.enemy + '/' + _t.totalEnemy + '</span> ';
  } else {
    deployInfo = '<span style="font-size:11px;color:#6b4c2a">我方 ' + d.player + '/' + _t.totalPlayer + ' | 敌方 ' + d.enemy + '/' + _t.totalEnemy + '</span> ';
  }
  panel.innerHTML = '<span style="font-weight:bold">📦 部署阶段 — ' + who + '（难度：' + dl + '）</span> ' +
    deployInfo +
    '<span style="font-size:10px;color:#8b2500">中心一环及敌方2格内禁止放置</span>';
  panel.style.display = 'flex';
  if (isControlledByAI(TurnStateAPI.getCurrentPlayer())) { setTimeout(aiDeployPiece, battleDelay(500)); } // 使用 TurnStateAPI 解耦
}

function getSlotIndexInContainer(container, slotIdx) {
  for (var i = 0; i < container.length; i++) { if (parseInt(container[i].dataset.slotIdx) === slotIdx) return i; }
  return 0;
}

function onPlayerPlacePiece() {
  if (TurnStateAPI.getPhase() !== 'deploy') return; // 使用 TurnStateAPI 解耦
  if (isControlledByAI(TurnStateAPI.getCurrentPlayer())) return; // AI 方不接受人类放置
  TurnStateAPI.getDeployCount()[TurnStateAPI.getCurrentPlayer()]++; // 使用 TurnStateAPI 解耦
  requestRender();
  nextDeployPlayer();
}

function nextDeployPlayer() {
  var _t2 = TurnStateAPI.getTotals(); // 使用 TurnStateAPI 解耦
  if (TurnStateAPI.getDeployCount().player >= _t2.totalPlayer && TurnStateAPI.getDeployCount().enemy >= _t2.totalEnemy) { startBattlePhase(); return; } // 使用 TurnStateAPI 解耦
  if (TurnStateAPI.getCurrentPlayer() === 'player') TurnStateAPI.setCurrentPlayer('enemy'); else TurnStateAPI.setCurrentPlayer('player'); // 使用 TurnStateAPI 解耦
  if (TurnStateAPI.getCurrentPlayer() === 'player' && TurnStateAPI.getDeployCount().player >= _t2.totalPlayer) { nextDeployPlayer(); return; } // 使用 TurnStateAPI 解耦
  if (TurnStateAPI.getCurrentPlayer() === 'enemy' && TurnStateAPI.getDeployCount().enemy >= _t2.totalEnemy) { nextDeployPlayer(); return; } // 使用 TurnStateAPI 解耦
  updateDeployUI();
}

function tryEndDeploy() {
  var _t3 = TurnStateAPI.getTotals(); // 使用 TurnStateAPI 解耦
  if (TurnStateAPI.getDeployCount().player >= _t3.totalPlayer && TurnStateAPI.getDeployCount().enemy >= _t3.totalEnemy) startBattlePhase(); // 使用 TurnStateAPI 解耦
  else nextDeployPlayer();
}

// ==================== 备战席系统 ====================
var BPS = 10; var benchState = [];
function initBench() {
  var Lc = document.getElementById('benchLeft'), Rc = document.getElementById('benchRight');
  if (!Lc || !Rc) return;
  Lc.innerHTML = ''; Rc.innerHTML = '';
  benchState = [];

  var playerTypes = (BT && BT.player) ? BT.player : [];
  var enemyTypes = (BT && BT.enemy) ? BT.enemy : ['infantry','infantry','infantry','cavalry','cavalry','cavalry','archer','archer','flying','flying'];

  // 敌方总是10个
  var enemyCount = Math.min(enemyTypes.length, BPS);
  // 玩家只显示选中的
  var playerCount = Math.min(playerTypes.length, BPS);

  for (var i = 0; i < playerCount; i++) {
    createSlot(Lc, i, 'player', playerTypes[i], i+1, 'P');
  }
  for (var i = 0; i < enemyCount; i++) {
    createSlot(Rc, BPS + i, 'enemy', enemyTypes[i], i+1, 'E');
  }
  // 补齐空格
  for (var i = playerCount; i < BPS; i++) {
    createEmptySlot(Lc, i, 'P'+(i+1));
  }

  function createSlot(ct, slotIdx, team, unitType, labelNum, prefix) {
    var u = getUnit(unitType);
    var sl = document.createElement('div'); sl.className = 'bench-slot'; sl.draggable = true;
    sl.dataset.slotIdx = slotIdx; sl.dataset.team = team;
    sl.dataset.unitType = unitType; sl.dataset.placed = 'false';
    var il = document.createElement('span'); il.className = 'slot-idx'; il.textContent = prefix + labelNum; sl.appendChild(il);
    if (u) {
      var ig = document.createElement('img'); ig.className = 'unit-thumb'; ig.src = u.image; ig.alt = u.name; ig.draggable = false; sl.appendChild(ig);
      var lb = document.createElement('span'); lb.className = 'slot-label'; lb.textContent = u.name; sl.appendChild(lb);
    }
    sl.addEventListener('dragstart', function(e) { if (this.dataset.placed === 'true') { e.preventDefault(); return; } this.classList.add('dragging'); e.dataTransfer.setData('text/plain', JSON.stringify({slotIdx: parseInt(this.dataset.slotIdx), team: this.dataset.team, unitType: this.dataset.unitType})); e.dataTransfer.effectAllowed = 'move'; });
    sl.addEventListener('dragend', function() { this.classList.remove('dragging'); });
    ct.appendChild(sl); benchState[slotIdx] = true;
  }

  function createEmptySlot(ct, slotIdx, label) {
    var sl = document.createElement('div'); sl.className = 'bench-slot empty'; sl.draggable = false;
    var il = document.createElement('span'); il.className = 'slot-idx'; il.textContent = label; sl.appendChild(il);
    ct.appendChild(sl);
    // 空槽位不写入 benchState，避免覆盖敌方槽位状态（benchState 仅用于标记可拖拽槽位）
    if (benchState[slotIdx] === undefined) benchState[slotIdx] = false;
  }
}

function getSlot(i) {
  var Lc = document.getElementById('benchLeft'), Rc = document.getElementById('benchRight');
  // 找对应slotIdx的元素
  var all = document.querySelectorAll('.bench-slot');
  for (var j = 0; j < all.length; j++) {
    if (parseInt(all[j].dataset.slotIdx) === i) return all[j];
  }
  return null;
}
function returnToBench(i) {
  if (benchState[i]) return;
  benchState[i] = true;
  var s = getSlot(i);
  if (s) { s.dataset.placed = 'false'; s.classList.remove('empty'); s.draggable = true; }
}

// ===== 部署系统接口 =====
var Deployment = {
  isDeployPhase: function() {
    return typeof TurnState !== 'undefined' && TurnStateAPI.getPhase() === 'deploy'; // 使用 TurnStateAPI 解耦
  }
};

// 部署阶段拖拽放置处理（从 interactions.js 抽出）
function handleDeployDrop(d, h, key) {
  // 仅当前部署方（且非 AI 控制）的棋子可放置
  if (d.team !== TurnStateAPI.getCurrentPlayer()) return false; // 使用 TurnStateAPI 解耦
  if (isControlledByAI(TurnStateAPI.getCurrentPlayer())) return false; // 使用 TurnStateAPI 解耦
  // 中心一环以内禁止放置
  if (hDist(h, {q:0,r:0,s:0}) <= 1) return false;
  // 不允许在敌人 2 格范围内放置
  // 使用 BoardAPI 解耦 API 检查敌方距离
  var _enemyPieces = BoardAPI.getPiecesByTeam(d.team === 'player' ? 'enemy' : 'player');
  for (var pi2 = 0; pi2 < _enemyPieces.length; pi2++) {
    if (hDist(_enemyPieces[pi2].hex, h) <= 2) {
      if (typeof showToast === 'function') showToast('不能在敌人 2 格范围内放置！', 'warning');
      return false;
    }
  }
  // 执行放置
  // 使用 BoardAPI 解耦 API 添加棋子
  var piece = { unitType: d.unitType, team: d.team, slotIdx: d.slotIdx, hex: { q: h.q, r: h.r, s: h.s } };
  piece._facing = getFacingToCenter(h);
  BoardAPI.addPiece(key, piece);
  initPieceRuntimeState(piece);
  if (typeof startPlaceAnim === 'function') startPlaceAnim(key);
  benchState[d.slotIdx] = false;
  var sl = document.querySelectorAll('.bench-slot[data-slot-idx="' + d.slotIdx + '"]')[0];
  if (sl) { sl.dataset.placed = 'true'; sl.classList.add('empty'); sl.draggable = false; }
  onPlayerPlacePiece();
  selectedPieceKey = null; updateMoveHint(); updateUnitCard(null); requestRender();
  return true;
}

// 部署阶段双击回收处理（从 interactions.js 抽出）
function handleDeployRecycle(key) {
  if (!BoardAPI.hasPiece(key)) return false; // 使用 BoardAPI 解耦 API
  if (BoardAPI.getPiece(key).team !== 'player') return false; // 使用 BoardAPI 解耦 API
  if (typeof startRecycleAnim === 'function') startRecycleAnim(key);
  var pc = BoardAPI.getPiece(key); BoardAPI.removePiece(key); returnToBench(pc.slotIdx); // 使用 BoardAPI 解耦 API
  TurnStateAPI.getDeployCount().player--; // 使用 TurnStateAPI 解耦
  updateDeployUI();
  deselectAll(); requestRender();
  return true;
}

// 部署阶段提示文字（从 panels.js 抽出）
function updateDeployHint() {
  var h = document.getElementById('moveHint');
  if (!h) return;
  h.style.display = 'inline';
  h.textContent = '📦 拖拽棋子到棋盘（棕红色格子禁止放置）';
}
