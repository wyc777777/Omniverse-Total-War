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

// ==================== TurnStateAPI ====================
// 全局回合状态访问接口：封装 TurnState 的读取和变更操作
// 内部仍操作全局 TurnState 变量，保持向后兼容
var TurnStateAPI = {
  // ===== 读取接口 =====

  // 返回当前阶段 ('dice' | 'deploy' | 'battle' | 'ended')
  getPhase: function() {
    return TurnState.phase;
  },

  // 返回当前行动方 ('player' | 'enemy')
  getCurrentPlayer: function() {
    return TurnState.currentPlayer;
  },

  // 返回当前回合数
  getCurrentRound: function() {
    return TurnState.currentRound;
  },

  // 返回先手方
  getFirstPlayer: function() {
    return TurnState.firstPlayer;
  },

  // 返回后手方（在 startBattlePhase 中设置）
  getSecondPlayer: function() {
    return TurnState.secondPlayer;
  },

  // 返回难度
  getDifficulty: function() {
    return TurnState.difficulty;
  },

  // 返回是否斗蛐蛐模式
  isDuelBattle: function() {
    return !!TurnState.isDuelBattle;
  },

  // 判断某阵营是否由 AI 控制（委托给全局 isControlledByAI 函数）
  isControlledByAI: function(team) {
    if (typeof isControlledByAI === 'function') {
      return isControlledByAI(team);
    }
    // 兜底实现：与全局函数逻辑保持一致
    if (TurnState.isDuelBattle) {
      if (team === 'player') return !!TurnState.sideAControlledByAI;
      if (team === 'enemy') return !!TurnState.sideBControlledByAI;
    }
    return team === 'enemy';
  },

  // 返回部署计数对象
  getDeployCount: function() {
    return TurnState.deployCount;
  },

  // 返回双方总数 {totalPlayer, totalEnemy}
  getTotals: function() {
    return {
      totalPlayer: TurnState.totalPlayer,
      totalEnemy: TurnState.totalEnemy
    };
  },

  // 返回 AI 回合是否活跃
  isAITurnActive: function() {
    return !!TurnState._aiTurnActive;
  },

  // 返回指定阵营的 AI 性格
  getAIPersonality: function(team) {
    return TurnState._aiPersonality[team];
  },

  // ===== 变更接口 =====

  // 设置当前阶段
  setPhase: function(phase) {
    TurnState.phase = phase;
  },

  // 设置当前行动方
  setCurrentPlayer: function(player) {
    TurnState.currentPlayer = player;
  },

  // 设置斗蛐蛐模式标记
  setDuelBattle: function(flag) {
    TurnState.isDuelBattle = !!flag;
  },

  // 设置某方是否由 AI 控制
  setSideControlled: function(team, flag) {
    if (team === 'player') {
      TurnState.sideAControlledByAI = !!flag;
    } else if (team === 'enemy') {
      TurnState.sideBControlledByAI = !!flag;
    }
  },

  // 设置难度
  setDifficulty: function(diff) {
    TurnState.difficulty = diff;
  },

  // 设置先手方
  setFirstPlayer: function(player) {
    TurnState.firstPlayer = player;
  },

  // 设置部署计数
  setDeployCount: function(counts) {
    TurnState.deployCount = counts;
  },

  // 设置双方总数
  setTotals: function(player, enemy) {
    TurnState.totalPlayer = player;
    TurnState.totalEnemy = enemy;
  },

  // 设置 AI 回合活跃标记
  setAITurnActive: function(flag) {
    TurnState._aiTurnActive = !!flag;
  },

  // 设置指定阵营的 AI 性格
  setAIPersonality: function(team, personality) {
    TurnState._aiPersonality[team] = personality;
  }
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
  var isDuel = !!TurnState.isDuelBattle;
  var isBattlePhase = TurnState.phase === 'battle';
  var showScoreboard = isDuel && isBattlePhase;
  var hideBenchInBattle = isBattlePhase;

  // 切换备战席/计分板显示
  var benchLeft = document.getElementById('benchLeft');
  var benchRight = document.getElementById('benchRight');
  var sbInlineA = document.getElementById('sbInlineA');
  var sbInlineB = document.getElementById('sbInlineB');
  var benchTitleLeft = document.getElementById('benchTitleLeft');
  var benchTitleRight = document.getElementById('benchTitleRight');
  var benchColLeft = document.getElementById('benchColLeft');
  var benchColRight = document.getElementById('benchColRight');

  // 战斗阶段隐藏备战席（所有模式都隐藏，斗蛐蛐额外显示计分板）
  if (hideBenchInBattle) {
    if (benchLeft) benchLeft.style.display = 'none';
    if (benchRight) benchRight.style.display = 'none';
    if (benchColLeft) benchColLeft.classList.add('battle-mode');
    if (benchColRight) benchColRight.classList.add('battle-mode');
  } else {
    if (benchLeft) benchLeft.style.display = '';
    if (benchRight) benchRight.style.display = '';
    if (benchColLeft) benchColLeft.classList.remove('battle-mode');
    if (benchColRight) benchColRight.classList.remove('battle-mode');
  }

  // 计分板仅斗蛐蛐模式战斗阶段显示
  if (showScoreboard) {
    if (sbInlineA) sbInlineA.style.display = 'flex';
    if (sbInlineB) sbInlineB.style.display = 'flex';
    var sideAName = (window._duelBattleData && window._duelBattleData.sideA && window._duelBattleData.sideA.name) || '甲方';
    var sideBName = (window._duelBattleData && window._duelBattleData.sideB && window._duelBattleData.sideB.name) || '乙方';
    if (benchTitleLeft) benchTitleLeft.textContent = '🔷 ' + sideAName;
    if (benchTitleRight) benchTitleRight.textContent = '🔶 ' + sideBName;
    var sbHA = document.getElementById('sbHeaderA');
    var sbHB = document.getElementById('sbHeaderB');
    if (sbHA) sbHA.textContent = sideAName;
    if (sbHB) sbHB.textContent = sideBName;
  } else {
    if (sbInlineA) sbInlineA.style.display = 'none';
    if (sbInlineB) sbInlineB.style.display = 'none';
    if (!hideBenchInBattle) {
      if (benchTitleLeft) benchTitleLeft.textContent = '🔷 我方';
      if (benchTitleRight) benchTitleRight.textContent = '🔶 敌方';
    }
  }

  if (showScoreboard) {
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
  }

  // 作战日志：所有模式战斗阶段都显示
  var logA = document.getElementById('combatLogA');
  var logB = document.getElementById('combatLogB');
  if (logA) logA.style.display = isBattlePhase ? 'flex' : 'none';
  if (logB) logB.style.display = isBattlePhase ? 'flex' : 'none';

  // 属性面板（快捷属性栏）：仅斗蛐蛐模式战斗阶段显示
  var attrPanelA = document.getElementById('unitAttrPanelA');
  var attrPanelB = document.getElementById('unitAttrPanelB');
  if (attrPanelA) attrPanelA.style.display = showScoreboard ? 'block' : 'none';
  if (attrPanelB) attrPanelB.style.display = showScoreboard ? 'block' : 'none';

  if (showScoreboard) {
    updateUnitAttrPanel('A');
    updateUnitAttrPanel('B');
  }
}

function toggleUnitAttrPanel(side) {
  var panelBody = document.getElementById('unitAttrPanel' + side + 'Body');
  if (!panelBody) return;
  panelBody.style.display = panelBody.style.display === 'none' ? 'flex' : 'none';
}

function updateUnitAttrPanel(side) {
  var team = side === 'A' ? 'player' : 'enemy';
  var body = document.getElementById('unitAttrPanel' + side + 'Body');
  if (!body) return;

  var pieces = [];
  for (var k in placedPieces) {
    var p = placedPieces[k];
    if (p.team === team && !p._routed) {
      pieces.push(p);
    }
  }

  if (pieces.length === 0) {
    body.innerHTML = '<div class="uap-empty">暂无单位</div>';
    return;
  }

  var html = '';
  pieces.forEach(function(p) {
    var ud = typeof unitDefByType === 'function' ? unitDefByType(p.unitType) : null;
    var st = typeof getPieceStats === 'function' ? getPieceStats(p) : null;
    var name = ud ? ud.name : '???';

    html += '<div class="uap-title">' + getUnitTypeEmoji(p.unitType) + ' ' + escapeHtml(name) + '</div>';

    if (st) {
      var weaponName = st.mainWeapon ? st.mainWeapon.name : '无';
      var armorName = st.armor ? st.armor.name : '无';
      var shieldName = st.shield ? st.shield.name : '无';
      var atkVal = st.mainBase !== undefined ? st.mainBase : (st.mainWeapon ? st.mainWeapon.baseDamage : 0);
      var defVal = st.totalArmor !== undefined ? st.totalArmor : 0;
      var moveVal = st.movement !== undefined ? st.movement : (st.moveSpeed || 1);
      var rangeVal = st.allowedRange !== undefined ? st.allowedRange : (st.attackRange || 1);

      html += '<div class="uap-row"><span class="uap-label">武器</span><span class="uap-value">' + escapeHtml(weaponName) + '</span></div>';
      if (st.shield) {
        html += '<div class="uap-row"><span class="uap-label">盾牌</span><span class="uap-value">' + escapeHtml(shieldName) + '</span></div>';
      }
      html += '<div class="uap-row"><span class="uap-label">护甲</span><span class="uap-value">' + escapeHtml(armorName) + '</span></div>';
      html += '<div class="uap-row"><span class="uap-label">攻击</span><span class="uap-value">' + atkVal + '</span></div>';
      html += '<div class="uap-row"><span class="uap-label">防御</span><span class="uap-value">' + defVal + '</span></div>';
      html += '<div class="uap-row"><span class="uap-label">移动</span><span class="uap-value">' + moveVal + '</span></div>';
      html += '<div class="uap-row"><span class="uap-label">射程</span><span class="uap-value">' + rangeVal + '</span></div>';
    } else {
      html += '<div class="uap-empty">属性数据不可用</div>';
    }
  });

  body.innerHTML = html;
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

// ==================== ScoreboardService ====================
// 计分板服务：封装全局 Scoreboard 及相关计分板函数的访问接口
// 内部仍调用全局函数，保持向后兼容
var ScoreboardService = {
  // ===== 记录接口 =====

  // 记录伤害（委托给全局 recordScoreboardDamage）
  recordDamage: function(pieceKey, dmg) {
    if (typeof recordScoreboardDamage === 'function') {
      recordScoreboardDamage(pieceKey, dmg);
    }
  },

  // 记录击杀（委托给全局 recordScoreboardKill）
  recordKill: function(pieceKey) {
    if (typeof recordScoreboardKill === 'function') {
      recordScoreboardKill(pieceKey);
    }
  },

  // 归档溃散单位的计分数据（委托给全局 archiveRoutedPiece）
  archiveRouted: function(pieceKey) {
    if (typeof archiveRoutedPiece === 'function') {
      archiveRoutedPiece(pieceKey);
    }
  },

  // ===== 控制接口 =====

  // 重置计分板（委托给全局 resetScoreboard）
  reset: function() {
    if (typeof resetScoreboard === 'function') {
      resetScoreboard();
    }
  },

  // 更新计分板UI（委托给全局 updateScoreboardUI）
  updateUI: function() {
    if (typeof updateScoreboardUI === 'function') {
      updateScoreboardUI();
    }
  },

  // ===== 作战日志接口 =====

  // 添加作战日志（委托给全局 addCombatLog）
  addLog: function(team, text, type) {
    if (typeof addCombatLog === 'function') {
      addCombatLog(team, text, type);
    }
  },

  // 清空作战日志（委托给全局 clearCombatLog）
  clearLog: function() {
    if (typeof clearCombatLog === 'function') {
      clearCombatLog();
    }
  },

  // ===== 读取接口 =====

  // 返回当前计分板数据 {damage, kills, routedArchive}
  getStats: function() {
    return {
      damage: Scoreboard.damage,
      kills: Scoreboard.kills,
      routedArchive: Scoreboard.routedArchive
    };
  },

  // 返回指定队伍总伤害
  getDamage: function(team) {
    return (Scoreboard.damage && Scoreboard.damage[team]) || 0;
  },

  // 返回指定队伍总击杀
  getKills: function(team) {
    return (Scoreboard.kills && Scoreboard.kills[team]) || 0;
  }
};

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

function updateBattleSpeedControlsVisibility() {
  var ctrl = document.getElementById('battleSpeedControls');
  if (!ctrl) return;
  // 速度控件在所有对战模式的战斗阶段都显示（玩家可控制AI动画速度）
  ctrl.style.display = TurnState.phase === 'battle' ? 'flex' : 'none';
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
  // 仅斗蛐蛐模式允许暂停
  if (!TurnState.isDuelBattle) return;
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
  // 重置观战暂停状态（防止上一场斗蛐蛐模式的暂停状态残留到下一场）
  _spectatorPaused = false;
  _deployPauseInitial = false;
  // 重置斗蛐蛐边对分配，确保每场新对战随机选择新的对称边
  _duelEdgeAssignment = null;
  // 重置地形，防止上一场战斗的地形残留
  if (typeof resetTerrain === 'function') resetTerrain();
  document.getElementById('turnStatus').style.display = 'none';
  document.getElementById('warReport').style.display = 'none';
  // 隐藏速度控件（非战斗阶段）
  var speedCtrl = document.getElementById('battleSpeedControls');
  if (speedCtrl) speedCtrl.style.display = 'none';
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

  var benchSlotsLeft = document.querySelectorAll('#benchLeft .bench-slot');
  var benchSlotsRight = document.querySelectorAll('#benchRight .bench-slot');
  TurnState.totalPlayer = 0;
  TurnState.totalEnemy = 0;
  benchSlotsLeft.forEach(function(s) { if (!s.classList.contains('empty')) TurnState.totalPlayer++; });
  benchSlotsRight.forEach(function(s) { if (!s.classList.contains('empty')) TurnState.totalEnemy++; });

  // 防御性检查：双方都没有棋子时给出提示，避免直接跳过部署阶段
  if (TurnState.totalPlayer === 0 && TurnState.totalEnemy === 0) {
    if (typeof showToast === 'function') {
      showToast('备战席为空，请检查部队配置', 'error');
    }
    TurnState.phase = 'dice';
    return;
  }

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
      if (typeof showDamageNumber === 'function') {
        showDamageNumber(p.hex, '被包围!', 'crit');
      }
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

// 兼容包装：实际实现已迁移到 BattleService.js 的 computePieceStats
function getPieceStats(piece) {
  if (typeof computePieceStats === 'function') {
    return computePieceStats(piece);
  }
  return null;
}

// initPieceRuntimeState 的实现已迁移到 BattleService.js（同名全局函数），此处不再重复定义

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

    // 结束回合快捷键：Enter（仅玩家回合且非斗蛐蛐观战模式）
    if (key === 'Enter') {
      if (typeof TurnState !== 'undefined' && TurnState.phase === 'battle' && TurnState.currentPlayer === 'player') {
        if (!TurnState.isDuelBattle) {
          e.preventDefault();
          endTurn();
          return;
        }
      }
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

