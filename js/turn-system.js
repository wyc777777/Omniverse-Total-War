// ==================== 回合系统 v2 ====================
// 流程：骰子 → 交替放置 → 战斗回合(交替移动)
var TurnState = {
  currentRound: 0,
  currentPlayer: '',
  phase: 'dice',
  firstPlayer: '',
  difficulty: 'easy',
  deployCount: {},
  totalPlayer: 0,
  totalEnemy: 0
};

function initTurns() {
  TurnState.currentRound = 0;
  TurnState.currentPlayer = '';
  TurnState.phase = 'dice';
  TurnState.firstPlayer = '';
  TurnState.difficulty = window.selectedDifficulty || 'easy';
  TurnState.deployCount = { player: 0, enemy: 0 };
  TurnState.totalPlayer = 0;
  TurnState.totalEnemy = 0;
  document.getElementById('turnStatus').style.display = 'none';
  document.getElementById('warReport').style.display = 'none';
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
  // 进入部署阶段时，让背景缓存失效，以便重新绘制红轴线
  if (typeof invalidateBackgroundCache === 'function') invalidateBackgroundCache();

  var benchSlotsLeft = document.querySelectorAll('#benchLeft .bench-slot');
  var benchSlotsRight = document.querySelectorAll('#benchRight .bench-slot');
  TurnState.totalPlayer = 0;
  TurnState.totalEnemy = 0;
  benchSlotsLeft.forEach(function(s) { if (!s.classList.contains('empty')) TurnState.totalPlayer++; });
  benchSlotsRight.forEach(function(s) { if (!s.classList.contains('empty')) TurnState.totalEnemy++; });

  showDiceResult(playerRoll, enemyRoll);
  updateDeployUI();
}

function showDiceResult(playerRoll, enemyRoll) {
  var s1 = ['','⚀','⚁','⚂','⚃','⚄','⚅'];
  var msg = '🎲 掷骰结果\n\n我方 「' + GameState.saveName + '」 ' + s1[playerRoll] + ' ' + playerRoll + '点\n敌方 「AI统帅」 ' + s1[enemyRoll] + ' ' + enemyRoll + '点\n\n' + (TurnState.firstPlayer === 'player' ? '🏆 我方先手！' : '🏆 敌方先手！');
  alert(msg);
}

// ===== 放置阶段 =====
function updateDeployUI() {
  var panel = document.getElementById('turnStatus');
  if (TurnState.phase !== 'deploy') { panel.style.display = 'none'; return; }
  var who = TurnState.currentPlayer === 'player' ? '🔷 我方放置' : '🔶 敌方放置';
  var d = TurnState.deployCount;
  var dl = { easy: '简单', hard: '困难', legend: '传说' }[TurnState.difficulty] || '简单';
  panel.innerHTML = '<span style="font-weight:bold">📦 部署阶段 — ' + who + '（难度：' + dl + '）</span> ' +
    '<span style="font-size:11px;color:#6b4c2a">我方 ' + d.player + '/' + TurnState.totalPlayer + ' | 敌方 ' + d.enemy + '/' + TurnState.totalEnemy + '</span> ' +
    '<span style="font-size:10px;color:#8b2500">三轴线(q/r/s=0)禁止放置</span>';
  panel.style.display = 'flex';
  if (TurnState.currentPlayer === 'enemy') { setTimeout(aiDeployPiece, 500); }
}

function aiDeployPiece() {
  if (TurnState.phase !== 'deploy' || TurnState.currentPlayer !== 'enemy') return;
  if (TurnState.deployCount.enemy >= TurnState.totalEnemy) { tryEndDeploy(); return; }

  var diff = TurnState.difficulty;

  // ===== 智能部署：近战先放、远程最后放 =====
  var benchSlots = document.querySelectorAll('#benchRight .bench-slot');
  var available = [];
  for (var i = 0; i < benchSlots.length; i++) {
    if (!benchSlots[i].classList.contains('empty')) {
      var ut = benchSlots[i].dataset.unitType;
      var ud = (typeof unitDefByType === 'function') ? unitDefByType(ut) : null;
      var isRanged = false;
      if (ud && ud.equipment && ud.equipment.mainWeapon && typeof ED !== 'undefined' && ED && ED.weapons) {
        var _depWpn = ED.weapons.find(function(w) { return w.id === ud.equipment.mainWeapon; });
        if (_depWpn && (_depWpn.type === 'bow' || _depWpn.type === 'crossbow')) isRanged = true;
      }
      available.push({ slotIdx: parseInt(benchSlots[i].dataset.slotIdx), unitType: ut, isRanged: isRanged, ud: ud });
    }
  }
  if (available.length === 0) { tryEndDeploy(); return; }

  // 困难/传说：优先非远程，远程留到最后
  var pick = null;
  if (diff === 'hard' || diff === 'legend') {
    var nonRanged = available.filter(function(a) { return !a.isRanged; });
    var ranged = available.filter(function(a) { return a.isRanged; });
    // 如果还有非远程可放，优先放；都放完了再放远程
    pick = nonRanged.length > 0 ? nonRanged[0] : (ranged.length > 0 ? ranged[0] : null);
  }
  if (!pick) {
    pick = available[Math.floor(Math.random() * available.length)];
  }

  var slotIdx = pick.slotIdx;
  var unitType = pick.unitType;
  var isRanged = pick.isRanged;
  var ud = pick.ud;
  var baseType = ud ? (ud.baseType || 'infantry') : 'infantry';

  // ===== 获取当前已放置的双方单位坐标 =====
  var playerHexes = [];
  var enemyHexes = [];
  for (var k in placedPieces) {
    var p = placedPieces[k];
    if (p.team === 'player') playerHexes.push(p.hex);
    else if (p.team === 'enemy') {
      enemyHexes.push(p.hex);
    }
  }

  // ===== 收集候选格子（排除三轴和已占）=====
  var cands = [];
  var enemySideHexes = []; // 敌方半场的格子
  hexes.forEach(function(h) {
    var key = h.q + ',' + h.r + ',' + h.s;
    if (placedPieces[key]) return;
    if (h.q === 0 || h.r === 0 || h.s === 0) return;
    cands.push({ key: key, hex: h });
    if (h.q > 0) enemySideHexes.push({ key: key, hex: h }); // 敌方半场（q>0）
  });
  if (cands.length === 0) return;

  var selected = null;

  if (diff === 'easy') {
    selected = cands[Math.floor(Math.random() * cands.length)];
  } else if (diff === 'hard' || diff === 'legend') {
    if (isRanged) {
      selected = aiPickRanged(cands, playerHexes, enemyHexes);
    } else {
      selected = aiPickFrontline(cands, playerHexes, enemyHexes);
    }
  }

  if (!selected) {
    selected = cands[Math.floor(Math.random() * cands.length)];
  }

  var h = selected.hex;
  var key = selected.key;
  placedPieces[key] = { unitType: unitType, team: 'enemy', slotIdx: slotIdx, hex: { q: h.q, r: h.r, s: h.s } };
  placedPieces[key]._facing = getFacingToCenter(h);
  initPieceRuntimeState(placedPieces[key]);
  benchState[slotIdx] = false;
  benchSlots[getSlotIndexInContainer(benchSlots, slotIdx)].classList.add('empty');
  TurnState.deployCount.enemy++;
  requestRender();
  nextDeployPlayer();
}

// ===== AI部署策略：远程兵（困难/传说）——贴近自家部队优先，远离敌方次之 =====
function aiPickRanged(cands, playerHexes, enemyHexes) {
  if (cands.length === 0) return null;
  if (playerHexes.length === 0) return cands[Math.floor(Math.random() * cands.length)];

  var best = null;
  var bestScore = -Infinity;
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i];
    var score = 0;

    // 1. 贴近自家部队（最高优先）
    var minDistToAlly = Infinity;
    for (var j = 0; j < enemyHexes.length; j++) {
      var da = hDist(c.hex, enemyHexes[j]);
      if (da < minDistToAlly) minDistToAlly = da;
    }
    if (minDistToAlly <= 1) score += 50;
    else if (minDistToAlly <= 2) score += 30;
    else if (minDistToAlly <= 3) score += 15;
    else score -= (minDistToAlly - 3) * 10;

    // 2. 远离敌方（次要）
    var minDistToPlayer = Infinity;
    for (var j = 0; j < playerHexes.length; j++) {
      var dp = hDist(c.hex, playerHexes[j]);
      if (dp < minDistToPlayer) minDistToPlayer = dp;
    }
    if (minDistToPlayer >= 4) score += 10;
    else if (minDistToPlayer <= 2) score -= 15;

    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// ===== AI部署策略：近战（困难/传说）——前线位置 =====
function aiPickFrontline(cands, playerHexes, enemyHexes) {
  if (cands.length === 0) return null;
  if (playerHexes.length === 0) return cands[Math.floor(Math.random() * cands.length)];

  var best = null;
  var bestScore = -Infinity;
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i];
    var score = 0;

    var distToPlayer = Infinity;
    for (var j = 0; j < playerHexes.length; j++) {
      var dp = hDist(c.hex, playerHexes[j]);
      if (dp < distToPlayer) distToPlayer = dp;
    }
    // 理想距离3-5格
    if (distToPlayer >= 3 && distToPlayer <= 5) score += 20;
    else if (distToPlayer < 3) score -= 10;
    else score -= (distToPlayer - 5) * 4;

    // 贴近友军
    var minDistAlly = Infinity;
    for (var j = 0; j < enemyHexes.length; j++) {
      var da = hDist(c.hex, enemyHexes[j]);
      if (da < minDistAlly) minDistAlly = da;
    }
    if (minDistAlly <= 2) score += 15;
    else if (minDistAlly <= 3) score += 8;

    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function getSlotIndexInContainer(container, slotIdx) {
  for (var i = 0; i < container.length; i++) { if (parseInt(container[i].dataset.slotIdx) === slotIdx) return i; }
  return 0;
}

function onPlayerPlacePiece() {
  if (TurnState.phase !== 'deploy' || TurnState.currentPlayer !== 'player') return;
  TurnState.deployCount.player++;
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
  Object.keys(placedPieces).forEach(function(k) {
    placedPieces[k]._actionUsedThisTurn = false;
    placedPieces[k]._attackedThisTick = false;
    placedPieces[k]._wasAttackedThisTurn = false;
    placedPieces[k]._didActionThisTurn = false;
    placedPieces[k]._chargeDistance = 0;
  });
  // 第一回合开始：检测包围状态
  processTurnStart(TurnState.firstPlayer);
  updateBattleUI();
  if (TurnState.currentPlayer === 'enemy') { setTimeout(runAITurn, 600); }
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

  // 先处理当前玩家回合结束
  var currentTeam = TurnState.currentPlayer;
  processTurnEnd(currentTeam === 'player' ? 'player' : 'enemy');

  if (TurnState.currentPlayer === 'player') {
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
    setTimeout(runAITurn, 600);
  } else {
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
    showTurnNotify(true);
  }
  requestRender();
}

function updateBattleUI() {
  var panel = document.getElementById('turnStatus');
  if (TurnState.phase !== 'battle') return;
  var dl = { easy: '简单', hard: '困难', legend: '传说' }[TurnState.difficulty] || '简单';
  var isPlayerTurn = TurnState.currentPlayer === 'player';
  var who = isPlayerTurn ? ('🔷 我方回合 （第' + TurnState.currentRound + '回合 · ' + dl + '难度）') : ('🔶 敌方回合（第' + TurnState.currentRound + '回合 · ' + dl + '难度）');
  var tipText = isPlayerTurn ? '<span style="font-size:12px;color:#6b4c2a;margin-left:8px">选己方棋子 → 移动（绿）或攻击（红）</span>' : '<span style="font-size:12px;color:#8b2500;margin-left:8px;font-weight:bold">⏳ AI 思考中...</span>';
  var btnState = isPlayerTurn ? '' : 'disabled';
  var btnText = isPlayerTurn ? '结束回合 →' : '敌方行动中...';

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

function showTurnNotify(isPlayer) {
  var el = document.getElementById('turnNotify');
  if (!el) return;
  var saveName = (typeof GameState !== 'undefined' && GameState.saveName) ? GameState.saveName : '我方';
  if (isPlayer) {
    el.textContent = '🔷 「' + saveName + '」的回合';
  } else {
    el.textContent = '🔶 敌方行动中...';
  }
  el.className = 'turn-notify';
  el.style.display = 'block';
  // 强制重排触发重新进入动画
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(function() {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(function() {
      el.style.display = 'none';
      el.className = 'turn-notify';
    }, 300);
  }, 1800);
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
}
