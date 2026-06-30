// ==================== AI 引擎系统 ====================
// 三档难度：简单 / 困难 / 传说

// ===== 六边形方向向量 =====
const AI_HEX_DIRS = [
  { q: +1, r: 0, s: -1 },
  { q: +1, r: -1, s: 0 },
  { q: 0, r: -1, s: +1 },
  { q: -1, r: 0, s: +1 },
  { q: -1, r: +1, s: 0 },
  { q: 0, r: +1, s: -1 }
];

// ===== AI 难度配置 =====
const AI_DIFFICULTY_CONFIG = {
  easy: {
    name: '简单',
    // 只会向着最近的敌人移动并攻击，不会战术
    targeting: 'nearest',
    moveStyle: 'toward',
    maxMoveSteps: 3,
    aggression: 0.4,
    preferRanged: false,
    flankingBonus: false,
    coordinatedAttack: false,
    formationBonus: false,
    retreatWhenLow: false,
    // 20% 概率不动
    skipChance: 0.2,
    // 不考虑士气
    moraleSensitive: false
  },
  hard: {
    name: '困难',
    // 会思考移动，会抱团，对血量低的敌人攻击欲望更高，知道侧面背面打击
    targeting: 'smart',
    moveStyle: 'coordinated',
    maxMoveSteps: 4,
    aggression: 0.75,
    preferRanged: true,
    flankingBonus: true,
    coordinatedAttack: true,
    formationBonus: true,
    retreatWhenLow: false,
    // 不会跳过回合
    skipChance: 0,
    // 对士气不敏感（不会因低士气改变策略）
    moraleSensitive: false
  },
  legend: {
    name: '传说',
    // 会抱团会集火，攻击欲望强，会计算距离使自己更容易打到玩家
    // 让玩家打不到自己或无法包围自己，会先以减员玩家部队为目的
    targeting: 'tactical',
    moveStyle: 'legend',
    maxMoveSteps: 5,
    aggression: 0.95,
    preferRanged: true,
    flankingBonus: true,
    coordinatedAttack: true,
    formationBonus: true,
    retreatWhenLow: false,
    // 永远不会跳过回合
    skipChance: 0,
    // 会考虑士气但不采用逃避策略
    moraleSensitive: true,
    moraleRetreat: false
  }
};

// 兼容旧代码的难度映射
var DIFF_MAP = {
  low: 'easy', medium: 'easy', high: 'hard', extreme: 'legend',
  easy: 'easy', hard: 'hard', legend: 'legend'
};

// ===== AI 状态追踪 =====
var AIState = {
  difficulty: 'easy',
  config: null,
  assignedTargets: {},
  actedThisTurn: new Set(),
  formationCenter: null,
  focusedTargetKey: null  // 传说难度：集火目标
};

// ===== 远程武器识别辅助函数 =====
function isRangedWeapon(st) {
  var t = st && st.mainWeapon && st.mainWeapon.type;
  return t === 'bow' || t === 'crossbow';
}

// ===== 获取当前难度配置 =====
function getAIConfig(difficulty) {
  var rawDiff = difficulty || TurnState.difficulty || 'easy';
  var diff = DIFF_MAP[rawDiff] || rawDiff || 'easy';
  // 优先从 difficulty_config.json 读取
  if (window.DC && window.DC.levels && window.DC.levels[diff] && window.DC.levels[diff].ai) {
    var dcAI = window.DC.levels[diff].ai;
    return {
      name: window.DC.levels[diff].label || diff,
      targeting: dcAI.targeting || 'nearest',
      moveStyle: dcAI.moveStyle || 'toward',
      maxMoveSteps: dcAI.maxMoveSteps || 3,
      aggression: dcAI.aggression !== undefined ? dcAI.aggression : 0.5,
      preferRanged: dcAI.preferRanged || false,
      flankingBonus: dcAI.flankingBonus || false,
      coordinatedAttack: dcAI.coordinatedAttack || false,
      formationBonus: dcAI.formationBonus || false,
      retreatWhenLow: dcAI.retreatWhenLow || false,
      skipChance: dcAI.skipChance || 0,
      moraleSensitive: dcAI.moraleSensitive || false,
      moraleRetreat: false
    };
  }
  return AI_DIFFICULTY_CONFIG[diff] || AI_DIFFICULTY_CONFIG.easy;
}

// ===== 初始化AI状态 =====
function initAIState(difficulty) {
  var rawDiff = difficulty || 'easy';
  var diff = DIFF_MAP[rawDiff] || rawDiff || 'easy';
  AIState.difficulty = diff;
  AIState.config = getAIConfig(diff);
  AIState.assignedTargets = {};
  AIState.actedThisTurn.clear();
  AIState.formationCenter = null;
  AIState.focusedTargetKey = null;
  // 传说难度：开局选定集火目标（最弱的可攻击目标）
  if (diff === 'legend') {
    AIState.focusedTargetKey = null; // 在回合中动态更新
  }
}

// ===== 目标选择策略 =====

// 最近目标（简单难度）
function aiTargetNearest(aiUnit, enemies) {
  var best = null, bestDist = Infinity;
  enemies.forEach(function(e) {
    if (e.piece._routed) return;
    var d = hDist(aiUnit.piece.hex, e.piece.hex);
    if (d < bestDist) { bestDist = d; best = e; }
  });
  return best;
}

// 智能目标选择（困难难度：血量低优先 + 远程优先 + 距离）
function aiTargetSmart(aiUnit, enemies) {
  var config = AIState.config;
  var valid = enemies.filter(function(e) { return !e.piece._routed; });
  if (valid.length === 0) return null;

  var best = null, bestScore = -Infinity;

  valid.forEach(function(e) {
    var score = 0;
    var dist = hDist(aiUnit.piece.hex, e.piece.hex);
    var enemySt = getPieceStats(e.piece);

    // 1. 血量低优先（容易击杀）
    var hpRatio = e.piece._currentHP / Math.max(1, e.piece._initialHP);
    if (hpRatio < 0.3) score += 35;
    else if (hpRatio < 0.5) score += 20;
    else if (hpRatio < 0.7) score += 8;

    // 2. 距离近优先
    if (dist <= 1) score += 18;
    else if (dist <= 2) score += 10;
    else if (dist <= 3) score += 4;

    // 3. 远程单位优先（先干掉输出）
    if (isRangedWeapon(enemySt)) {
      score += config.preferRanged ? 22 : 10;
    }

    // 4. 溃逃单位优先
    // (已移除 aiTargetSmart 死分支：if (e.piece._routed) score += 15;)

    // 5. 血量比例
    score += (1 - hpRatio) * 30;

    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  });

  return best;
}

// 战术目标选择（传说难度：按照优先级 能击溃>能击杀>3集火>降士气>降血量>防守>2集火>自保）
function aiTargetTactical(aiUnit, enemies) {
  var config = AIState.config;
  var valid = enemies.filter(function(e) { return !e.piece._routed; });
  if (valid.length === 0) return null;

  var st = getPieceStats(aiUnit.piece);
  var best = null, bestScore = -Infinity;

  valid.forEach(function(e) {
    var score = 0;
    var enemySt = getPieceStats(e.piece);
    var dist = hDist(aiUnit.piece.hex, e.piece.hex);
    var atkRange = (st && st.allowedRange) ? st.allowedRange : 1;
    var canReach = (dist <= atkRange);
    var canReachAfterMove = (dist <= atkRange + (st ? st.movement || 3 : 3));

    if (!st) return;

    // 估算伤害（与 combat.js fullDamage 公式一致）
    var mainWeapon = st.mainWeapon;
    var estimatedHpDmg = (mainWeapon ? mainWeapon.baseDamage || 10 : 10) * (st.attackRange || 1) * (st.unitCount || 1);
    var estMoraleDmg = 5;  // 与 combat.js L572 一致（固定 -5 士气）

    // 第1优先级：能击溃（HP击杀 或 士气击溃）
    var canKill = e.piece._currentHP <= estimatedHpDmg || e.piece._currentMorale <= estMoraleDmg;
    if (canKill) {
      score += 500;
      if (canReach) score += 200;
    }

    // 第3优先级：多人集火同一目标（3+）
    if (config.coordinatedAttack && AIState.assignedTargets[e.key]) {
      var focusCount = AIState.assignedTargets[e.key].count;
      if (focusCount >= 3) score += 120;
      else if (focusCount >= 2) score += 50;
    }

    // 第4优先级：能造成高士气伤害（士气降到危险线）
    if (e.piece._currentMorale !== undefined && e.piece._initialMorale !== undefined) {
      var moraleRatio = e.piece._currentMorale / Math.max(1, e.piece._initialMorale);
      if (moraleRatio < 0.3) score += 60;  // 士气已崩溃边缘
      else if (moraleRatio < 0.5) score += 40;  // 士气危险
      else if (moraleRatio < 0.7) score += 15;  // 士气偏低
    }

    // 第5优先级：高血量伤害
    if (e.piece._currentHP && e.piece._initialHP) {
      var hpRatio = e.piece._currentHP / e.piece._initialHP;
      if (hpRatio < 0.3) score += 70;
      else if (hpRatio < 0.5) score += 40;
      else if (hpRatio > 0.8) score += 10; // 杀满血的也有价值
    }

    // 第6优先级：远程/高威胁单位优先
    if (isRangedWeapon(enemySt)) {
      score += 25;
      if (dist <= 3) score += 15; // 远程就在附近，危险
    }

    // 距离修正：越近越容易攻击
    if (canReach) score += 30;
    else if (canReachAfterMove) score += 15;

    // 骑兵特化：侧袭背袭得分翻倍
    var ud_piece = unitDefByType(aiUnit.piece.unitType);
    var pieceBaseType = ud_piece ? (ud_piece.baseType || ud_piece.type) : '';
    if (pieceBaseType === 'cavalry' || pieceBaseType === 'flying') {
      score += 10; // 骑兵倾向任何目标
    }

    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  });

  return best;
}

// 随机选择
function aiTargetRandom(enemies) {
  var valid = enemies.filter(function(e) { return !e.piece._routed; });
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

// 主目标选择函数
function aiSelectTarget(aiUnit, enemies) {
  var strategy = AIState.config ? AIState.config.targeting : 'nearest';
  switch (strategy) {
    case 'smart': return aiTargetSmart(aiUnit, enemies);
    case 'tactical': return aiTargetTactical(aiUnit, enemies);
    case 'nearest':
    default: return aiTargetNearest(aiUnit, enemies);
  }
}

// ===== 移动策略 =====

// 获取所有可用移动位置（BFS）
function aiGetMoveCandidates(aiUnit, maxSteps) {
  var candidates = [];
  var visited = {};
  var queue = [{ hex: aiUnit.piece.hex, steps: 0 }];
  visited[aiUnit.piece.hex.q + ',' + aiUnit.piece.hex.r + ',' + aiUnit.piece.hex.s] = true;

  while (queue.length > 0) {
    var curr = queue.shift();
    if (curr.steps > 0 && !placedPieces[curr.hex.q + ',' + curr.hex.r + ',' + curr.hex.s]) {
      candidates.push({ hex: curr.hex, dist: curr.steps });
    }
    if (curr.steps < maxSteps) {
      for (var i = 0; i < AI_HEX_DIRS.length; i++) {
        var d = AI_HEX_DIRS[i];
        var nq = curr.hex.q + d.q;
        var nr = curr.hex.r + d.r;
        var ns = curr.hex.s + d.s;
        var nkey = nq + ',' + nr + ',' + ns;
        if (Math.abs(nq) > RADIUS || Math.abs(nr) > RADIUS || Math.abs(ns) > RADIUS) continue;
        if (visited[nkey]) continue;
        if (placedPieces[nkey] && placedPieces[nkey].team !== aiUnit.piece.team) continue;
        visited[nkey] = true;
        queue.push({ hex: { q: nq, r: nr, s: ns }, steps: curr.steps + 1 });
      }
    }
  }
  return candidates;
}

// 朝向目标移动（简单难度使用）
function aiMoveToward(aiUnit, target) {
  var configMax = AIState.config ? AIState.config.maxMoveSteps : 3;
  var st = getPieceStats(aiUnit.piece);
  var actualMove = st ? st.movement : 1;
  var maxSteps = Math.min(configMax, actualMove); // 不能超过单位实际移动力
  var candidates = aiGetMoveCandidates(aiUnit, maxSteps);
  if (candidates.length === 0) return null;

  var best = null, bestDist = Infinity;
  candidates.forEach(function(c) {
    var d = hDist(c.hex, target.piece.hex);
    if (d < bestDist) { bestDist = d; best = c; }
  });
  return best;
}

// 困难难度：背袭>侧袭>正击 + 血量<40%时保守（不冒险走位）
function aiMoveCoordinated(aiUnit, target, allies, enemies) {
  var config = AIState.config;
  var configMax = config ? config.maxMoveSteps : 4;
  var st = getPieceStats(aiUnit.piece);
  var actualMove = st ? st.movement : 1;
  var maxSteps = Math.min(configMax, actualMove);
  var candidates = aiGetMoveCandidates(aiUnit, maxSteps);
  if (candidates.length === 0) return null;

  var hpRatio = aiUnit.piece._currentHP !== undefined && aiUnit.piece._initialHP !== undefined
    ? aiUnit.piece._currentHP / Math.max(1, aiUnit.piece._initialHP) : 1;
  var isConservative = hpRatio < 0.4; // 血量<40% = 害怕被偷袭
  var isRanged = isRangedWeapon(st);
  var myRange = st ? (st.allowedRange || 1) : 1;

  var best = null, bestScore = -Infinity;

  candidates.forEach(function(c) {
    var score = 0;
    var distToTarget = hDist(c.hex, target.piece.hex);
    var canAttack = distToTarget <= myRange;

    if (isConservative) {
      // ===== 保守模式：避免冒险，优先挨着友军 + 保持距离 =====
      // 1. 抱团：紧贴友军中心
      if (config.formationBonus && AIState.formationCenter) {
        var distToCenter = hDist(c.hex, AIState.formationCenter);
        score -= distToCenter * 5;
      }
      // 2. 远离敌人
      var minDistToEnemy = Infinity;
      enemies.forEach(function(e) {
        if (e.piece._routed) return;
        var d = hDist(c.hex, e.piece.hex);
        if (d < minDistToEnemy) minDistToEnemy = d;
      });
      score += minDistToEnemy * 6;
      // 3. 能攻击到就小加分（站桩输出）
      if (canAttack) score += 15;
      // 4. 弓兵保持距离
      if (isRanged && distToTarget < 2) score -= 20;
    } else {
      // ===== 攻击模式：走位背袭>侧袭>正击 =====
      // 1. 走位质量（权重最高）
      if (config.flankingBonus && typeof getAttackAzimuth === 'function' && target.piece._facing !== undefined) {
        var az = getAttackAzimuth(c.hex, target.piece.hex, target.piece._facing);
        if (az === 'rear') {
          score += 50;
          if (canAttack) score += 25;
        } else if (az === 'flank') {
          score += 28;
          if (canAttack) score += 15;
        } else {
          if (canAttack) score += 8;
        }
      } else {
        if (canAttack) score += 20;
      }
      // 2. 靠近目标（次要）
      score -= distToTarget * 3;
      // 3. 抱团
      if (config.formationBonus && AIState.formationCenter) {
        var distToCenter2 = hDist(c.hex, AIState.formationCenter);
        score -= distToCenter2 * 2;
      }
      // 4. 弓兵保持距离
      if (isRanged) {
        if (distToTarget < 2) score -= 25;
        else if (distToTarget >= 2 && distToTarget <= 4) score += 12;
      }
      // 5. 骑兵冲锋
      if (st && (st.baseType === 'cavalry' || st.baseType === 'flying')) {
        if (distToTarget <= 3) score += 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });

  return best;
}

// 传说难度：分兵种走位 + 集火 + 骑兵切后排
function aiMoveLegend(aiUnit, target, allies, enemies) {
  var config = AIState.config;
  var configMax = config ? config.maxMoveSteps : 5;
  var st = getPieceStats(aiUnit.piece);
  var actualMove = st ? st.movement : 1;
  var maxSteps = Math.min(configMax, actualMove);
  var candidates = aiGetMoveCandidates(aiUnit, maxSteps);
  if (candidates.length === 0) return null;

  st = getPieceStats(aiUnit.piece);
  var best = null, bestScore = -Infinity;
  var myRange = st ? (st.allowedRange || 1) : 1;
  var baseType = st ? (st.baseType || 'infantry') : 'infantry';
  var isRanged = isRangedWeapon(st);
  var hpRatio = aiUnit.piece._currentHP !== undefined && aiUnit.piece._initialHP !== undefined
    ? aiUnit.piece._currentHP / Math.max(1, aiUnit.piece._initialHP) : 1;

  candidates.forEach(function(c) {
    var score = 0;
    var distToTarget = hDist(c.hex, target.piece.hex);
    var canAttack = distToTarget <= myRange;
    var az = 'front';
    if (typeof getAttackAzimuth === 'function' && target.piece._facing !== undefined) {
      az = getAttackAzimuth(c.hex, target.piece.hex, target.piece._facing);
    }

    if (baseType === 'cavalry' || baseType === 'flying') {
      // ===== 骑兵/空军：原逻辑，血再低也冲 =====
      if (az === 'rear') {
        score += 70;
        if (canAttack) score += 35;
      } else if (az === 'flank') {
        score += 40;
        if (canAttack) score += 20;
      } else {
        if (canAttack) score += 10;
      }
      score -= distToTarget * 2 + (hpRatio < 0.2 ? 0 : 0); // 残血不减分
      // 切后排远程
      enemies.forEach(function(e) {
        if (e.piece._routed) return;
        var eSt = getPieceStats(e.piece);
        if (isRangedWeapon(eSt)) {
          var d2 = hDist(c.hex, e.piece.hex);
          if (d2 <= 3) score += 18;
          if (d2 <= myRange) score += 30;
        }
      });

    } else if (isRanged) {
      // ===== 远程：侧袭>正击>自己不会被打>背击 =====
      // 1. 检测新位置是否会遭到反击
      var canBeCountered = false;
      enemies.forEach(function(e) {
        if (e.piece._routed) return;
        var eSt = getPieceStats(e.piece);
        if (!eSt) return;
        var eRange = eSt.allowedRange || 1;
        if (hDist(c.hex, e.piece.hex) <= eRange) canBeCountered = true;
      });

      if (az === 'flank') {
        score += 45;
        if (canAttack) score += 25;
      } else if (az === 'rear') {
        score += 30;
        if (canAttack) score += 15;
      } else {
        if (canAttack) score += 18;
      }
      if (!canBeCountered) score += 20; // 安全位加分
      score -= distToTarget * 2;
      // 保持2-3格距离
      if (distToTarget < 2) score -= 20;
      else if (distToTarget >= 2 && distToTarget <= 4) score += 10;
      // 抱团
      if (config.formationBonus && AIState.formationCenter) {
        var distR = hDist(c.hex, AIState.formationCenter);
        score -= distR * 2;
      }

    } else {
      // ===== 近战步兵：稳固防线，侧袭优先>正击>背击（背袭可能离战线太远）=====
      if (az === 'flank') {
        score += 50;
        if (canAttack) score += 30;
      } else if (az === 'rear') {
        score += 15;  // 背袭权重低，不能离开战线
        if (canAttack) score += 10;
      } else {
        if (canAttack) score += 22;  // 正击也很好（稳固）
      }
      score -= distToTarget * 2;
      // 抱团权重高（保护后排）
      if (config.formationBonus && AIState.formationCenter) {
        var distM = hDist(c.hex, AIState.formationCenter);
        score -= distM * 3;
      }
      // 离己方远程近（保护它们）
      allies.forEach(function(a) {
        if (a.piece._routed) return;
        var aSt = getPieceStats(a.piece);
        if (isRangedWeapon(aSt)) {
          var da = hDist(c.hex, a.piece.hex);
          if (da <= 2) score += 12;
        }
      });
      // 骑兵冲锋加成（如果这个近战是骑步混编的possibility）
      if (distToTarget <= 2) score += 5;
    }

    // 通用：集火
    if (config.coordinatedAttack && AIState.focusedTargetKey) {
      var focusedEnemy = enemies.find(function(e) { return e.key === AIState.focusedTargetKey; });
      if (focusedEnemy) {
        var distToFocused = hDist(c.hex, focusedEnemy.piece.hex);
        if (distToFocused <= myRange) score += 12;
        score -= distToFocused * 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });

  return best;
}

// ===== 士气崩溃撤退：远离所有敌人，靠近友方撤退 =====
function aiFindRetreat(aiUnit, enemies, allies) {
  var config = AIState.config;
  var configMax = config ? config.maxMoveSteps : 5;
  var st = getPieceStats(aiUnit.piece);
  var actualMove = st ? st.movement : 1;
  var maxSteps = Math.min(configMax, actualMove);
  var candidates = aiGetMoveCandidates(aiUnit, maxSteps);
  if (candidates.length === 0) return null;

  var best = null, bestScore = -Infinity;
  candidates.forEach(function(c) {
    var score = 0;

    // 远离所有敌人（安全第一）
    var minDistToEnemy = Infinity;
    enemies.forEach(function(e) {
      if (e.piece._routed) return;
      var d = hDist(c.hex, e.piece.hex);
      if (d < minDistToEnemy) minDistToEnemy = d;
    });
    score += minDistToEnemy * 8;

    // 靠近友方（重整）
    var minDistToAlly = Infinity;
    allies.forEach(function(a) {
      if (a.piece._routed) return;
      var d = hDist(c.hex, a.piece.hex);
      if (d < minDistToAlly) minDistToAlly = d;
    });
    if (minDistToAlly < Infinity) score -= minDistToAlly * 2;

    if (score > bestScore) { bestScore = score; best = c; }
  });
  return best;
}

// 弓兵保护逻辑（困难+传说共用）
function aiRangerFindCover(aiUnit, enemies) {
  var st = getPieceStats(aiUnit.piece);
  if (!st || !st.mainWeapon || st.mainWeapon.type !== 'bow') return null;

  var config = AIState.config;
  var configMax = config ? config.maxMoveSteps : 3;
  var actualMove = st ? st.movement : 1;
  var maxSteps = Math.min(configMax, actualMove);
  var candidates = aiGetMoveCandidates(aiUnit, maxSteps);
  if (candidates.length === 0) return null;

  // 被贴脸时逃跑
  var surrounded = false;
  enemies.forEach(function(e) {
    if (!e.piece._routed && hDist(aiUnit.piece.hex, e.piece.hex) <= 1) surrounded = true;
  });
  if (surrounded) {
    var best = null, bestSafety = -Infinity;
    candidates.forEach(function(c) {
      var minDist = Infinity;
      enemies.forEach(function(e) {
        if (e.piece._routed) return;
        var d = hDist(c.hex, e.piece.hex);
        if (d < minDist) minDist = d;
      });
      if (minDist > bestSafety) { bestSafety = minDist; best = c; }
    });
    return best;
  }

  // 保持理想距离（能打到人的前提下），未达到则全速靠近
  var best = null, bestScore = -Infinity;
  var myRange = st.mainWeapon.allowedRange || 1;
  var idealDist = Math.max(2, myRange - 1);
  candidates.forEach(function(c) {
    var minDist = Infinity;
    var minDistEnemy = null;
    enemies.forEach(function(e) {
      if (e.piece._routed) return;
      var d = hDist(c.hex, e.piece.hex);
      if (d < minDist) { minDist = d; minDistEnemy = e; }
    });
    if (!isFinite(minDist)) { minDist = 99; } // 没有活着的敌人时，统一用大数
    var score = 0;
    // 能打到敌人：大幅加分
    if (minDist <= myRange) score += 30;
    // 离理想距离越近越好（两端都扣分，但远处对称bug已消除，改用递减公式）
    var distError = Math.abs(minDist - idealDist);
    score -= distError * 3;  // 远离2.5的每一步扣3分，打破对称
    // 略微偏好靠近敌人（远处时确保方向正确）
    score -= minDist * 0.5;
    if (score > bestScore) { bestScore = score; best = c; }
  });
  return best;
}

// ===== 指挥官统筹层：回合开始时评估全局，输出战术方针和行动顺序 =====
function aiCommanderPlan(enemyPieces, playerPieces) {
  var config = AIState.config;
  var difficulty = AIState.difficulty;

  // 简单难度不做战术评估，直接按"必逃→必杀→必攻→其它"排序
  if (difficulty === 'easy') {
    var easyOrder = aiSortActionOrder(enemyPieces, playerPieces, null);
    return {
      tactic: 'aggressive',
      focusTargetKey: null,
      threatPriority: [],
      protectList: [],
      actionOrder: easyOrder
    };
  }

  // ===== Hard/Legend：战术方针判定 =====
  var tactic = 'aggressive';
  var focusTargetKey = null;
  var threatPriority = [];
  var protectList = [];

  // 1. 统计玩家远程单位
  var playerRanged = [];
  var playerCavalry = [];
  playerPieces.forEach(function(p) {
    if (p.piece._routed) return;
    var pst = getPieceStats(p.piece);
    if (isRangedWeapon(pst)) {
      playerRanged.push(p);
    }
    var ud = unitDefByType(p.piece.unitType);
    var bt = ud ? (ud.baseType || ud.type) : '';
    if (bt === 'cavalry' || bt === 'flying') playerCavalry.push(p);
  });

  // 2. 统计我方骑兵/空军（用于切后排）
  var myFlankers = [];
  enemyPieces.forEach(function(e) {
    if (e.piece._routed) return;
    var ud = unitDefByType(e.piece.unitType);
    var bt = ud ? (ud.baseType || ud.type) : '';
    if (bt === 'cavalry' || bt === 'flying') myFlankers.push(e);
  });

  // 3. 找玩家残血单位（HP%<30%）
  var weakestPlayer = null;
  var weakestRatio = 1.0;
  playerPieces.forEach(function(p) {
    if (p.piece._routed) return;
    if (!p.piece._currentHP || !p.piece._initialHP) return;
    var r = p.piece._currentHP / p.piece._initialHP;
    if (r < weakestRatio) { weakestRatio = r; weakestPlayer = p; }
  });

  // 4. 我方总 HP%
  var myTotalHP = 0, myMaxHP = 0;
  enemyPieces.forEach(function(e) {
    if (e.piece._routed) return;
    myTotalHP += (e.piece._currentHP || 0);
    myMaxHP += (e.piece._initialHP || 1);
  });
  var myHPRatio = myMaxHP > 0 ? myTotalHP / myMaxHP : 1;

  // ===== 战术方针判定（按优先级） =====
  // 优先级 1: 玩家有远程 + 我方有骑兵/空军 → focus_ranged
  if (playerRanged.length > 0 && myFlankers.length > 0) {
    tactic = 'focus_ranged';
    // 集火目标：玩家远程中血量最低的
    var weakestRanged = null, wrRatio = 1.0;
    playerRanged.forEach(function(p) {
      var r = p.piece._currentHP / Math.max(1, p.piece._initialHP);
      if (r < wrRatio) { wrRatio = r; weakestRanged = p; }
    });
    if (weakestRanged) focusTargetKey = weakestRanged.key;
  }
  // 优先级 2: 玩家有残血单位 → focus_weak
  else if (weakestPlayer && weakestRatio < 0.3) {
    tactic = 'focus_weak';
    focusTargetKey = weakestPlayer.key;
  }
  // 优先级 3: 我方总 HP%<60% → defensive
  else if (myHPRatio < 0.6) {
    tactic = 'defensive';
  }
  // 默认 aggressive
  else {
    tactic = 'aggressive';
    if (weakestPlayer && weakestRatio < 0.5) focusTargetKey = weakestPlayer.key;
  }

  // ===== 威胁排序（玩家远程 > 骑兵 > 步兵） =====
  threatPriority = playerPieces.slice().sort(function(a, b) {
    if (a.piece._routed) return 1;
    if (b.piece._routed) return -1;
    var aIsRanged = false, bIsRanged = false;
    var aSt = getPieceStats(a.piece);
    var bSt = getPieceStats(b.piece);
    if (isRangedWeapon(aSt)) aIsRanged = true;
    if (isRangedWeapon(bSt)) bIsRanged = true;
    if (aIsRanged && !bIsRanged) return -1;
    if (!aIsRanged && bIsRanged) return 1;
    return 0;
  }).map(function(p) { return p.key; });

  // ===== 保护清单（残血弓兵、被贴脸的我方单位） =====
  enemyPieces.forEach(function(e) {
    if (e.piece._routed) return;
    var eSt = getPieceStats(e.piece);
    var isRanged = isRangedWeapon(eSt);
    var hpRatio = e.piece._currentHP && e.piece._initialHP ? e.piece._currentHP / e.piece._initialHP : 1;
    var isPinned = false;
    playerPieces.forEach(function(p) {
      if (p.piece._routed) return;
      if (hDist(e.piece.hex, p.piece.hex) <= 1) isPinned = true;
    });
    if (isRanged && (hpRatio < 0.4 || isPinned)) protectList.push(e.key);
  });

  // ===== 动态行动顺序 =====
  var actionOrder = aiSortActionOrder(enemyPieces, playerPieces, {
    tactic: tactic,
    focusTargetKey: focusTargetKey,
    myFlankers: myFlankers
  });

  return {
    tactic: tactic,
    focusTargetKey: focusTargetKey,
    threatPriority: threatPriority,
    protectList: protectList,
    actionOrder: actionOrder
  };
}

// ===== 行动顺序排序：必逃→必杀→必攻→配合移动→推进→站桩 =====
function aiSortActionOrder(enemyPieces, playerPieces, plan) {
  var order = [];

  // 每个单位计算优先级分数
  var scored = enemyPieces.map(function(ep) {
    if (ep.piece._routed) return { ep: ep, score: -1 };
    var st = getPieceStats(ep.piece);
    if (!st) return { ep: ep, score: -1 };
    var role = aiClassify(ep, st);
    var myRange = st.allowedRange || 1;
    var score = 50; // 基础分

    // 1. 必逃：被贴脸的弓兵
    if (role === 'bow') {
      var pinned = false;
      playerPieces.forEach(function(p) {
        if (p.piece._routed) return;
        if (hDist(ep.piece.hex, p.piece.hex) <= 1) pinned = true;
      });
      if (pinned) score += 1000;
    }

    // 2. 必杀：能一击击杀敌人
    var canKill = false;
    playerPieces.forEach(function(p) {
      if (p.piece._routed) return;
      if (hDist(ep.piece.hex, p.piece.hex) > myRange) return;
      var est = (st.mainWeapon ? st.mainWeapon.baseDamage || 10 : 10) * (st.unitCount || 1);
      if (p.piece._currentHP && p.piece._currentHP <= est) canKill = true;
    });
    if (canKill) score += 800;

    // 3. 必攻：能攻击且指挥官指定目标可达
    if (plan && plan.focusTargetKey) {
      var focused = playerPieces.find(function(p) { return p.key === plan.focusTargetKey; });
      if (focused && !focused.piece._routed) {
        var d = hDist(ep.piece.hex, focused.piece.hex);
        if (d <= myRange) score += 600;
        else if (d <= myRange + (st.movement || 3)) score += 300;
      }
    }

    // 4. 配合移动：切后排（tactic=focus_ranged 时，骑兵/空军提前）
    if (plan && plan.tactic === 'focus_ranged' && (role === 'cavalry' || role === 'flying')) {
      score += 400;
    }

    // 5. 推进：步兵前线推进（敌人在视野内时优先级提升）
    if (role === 'infantry' || role === 'beast') {
      var minDist = Infinity;
      playerPieces.forEach(function(p) {
        if (p.piece._routed) return;
        var d = hDist(ep.piece.hex, p.piece.hex);
        if (d < minDist) minDist = d;
      });
      if (minDist <= 3) score += 100;
    }

    // 6. 站桩：远程原地输出（默认基础分）
    // 不额外加分

    return { ep: ep, score: score };
  });

  scored.sort(function(a, b) { return b.score - a.score; });
  scored.forEach(function(s) {
    if (s.score >= 0) order.push(s.ep);
  });
  return order;
}

// ===== 兵种分类 =====
// 弓兵(bow): 惧怕近身，远程输出
// 弩兵(crossbow): 无惧怕近身，远程输出
// 骑兵(cavalry): 游走士气打击，侧袭背袭
// 步兵(infantry): 抗线推进，抱团
// 空军(flying): 类似骑兵，优先切远程兵
// 野兽(beast): 类似步兵，正面冲
function aiClassify(aiUnit, st) {
  var wpType = st && st.mainWeapon ? st.mainWeapon.type : '';
  if (wpType === 'bow') return 'bow';
  if (wpType === 'crossbow') return 'crossbow';
  var ud = unitDefByType(aiUnit.piece.unitType);
  var bt = ud ? (ud.baseType || ud.type) : 'infantry';
  if (bt === 'cavalry') return 'cavalry';
  if (bt === 'flying') return 'flying';
  if (bt === 'beast' || bt === 'beast_infantry') return 'beast';
  return 'infantry';
}

// 困难/传说：当前能打到人时，寻找更好的位置
// 弓兵：不贴脸 > 攻击 > 队友
// 弩兵：攻击 > 队友 > 不贴脸
// 骑兵/空军：找侧袭/背袭位 + 游走
// 步兵/野兽：队友 > 攻击 > 推进
function aiDecideMoveOptimize(aiUnit, enemies, allies, st) {
  var config = AIState.config;
  var configMax = config ? config.maxMoveSteps : 4;
  var actualMove = st ? st.movement : 1;
  var maxSteps = Math.min(configMax, actualMove);
  var candidates = aiGetMoveCandidates(aiUnit, maxSteps);
  if (candidates.length === 0) return null;

  var myRange = st ? (st.allowedRange || 1) : 1;
  var role = aiClassify(aiUnit, st);
  var strategy = config ? config.moveStyle : 'coordinated';

  // 候选格里加上当前位置（确保不会无意义移动）
  candidates.unshift({ hex: aiUnit.piece.hex, dist: 0 });

  var best = null, bestScore = -Infinity;
  candidates.forEach(function(c) {
    var canAttackAny = false, attackDist = Infinity, attackTarget = null;
    enemies.forEach(function(e) {
      if (e.piece._routed) return;
      var d = hDist(c.hex, e.piece.hex);
      if (d <= myRange) { canAttackAny = true; if (d < attackDist) { attackDist = d; attackTarget = e; } }
    });

    var surrounded = false;
    enemies.forEach(function(e) {
      if (e.piece._routed) return;
      if (hDist(c.hex, e.piece.hex) <= 1) surrounded = true;
    });

    var minAllyDist = Infinity;
    allies.forEach(function(a) {
      if (a.piece._routed || a === aiUnit) return;
      var d = hDist(c.hex, a.piece.hex);
      if (d < minAllyDist) minAllyDist = d;
    });

    // 方位计算（骑兵/空军用）
    var az = 'front';
    if (strategy !== 'toward' && attackTarget && attackTarget.piece._facing !== undefined && typeof getAttackAzimuth === 'function') {
      az = getAttackAzimuth(c.hex, attackTarget.piece.hex, attackTarget.piece._facing);
    }

    // 友军分（不贴脸时不重要，贴脸时有援军就好）
    var allyScore = 0;
    if (isFinite(minAllyDist)) {
      if (minAllyDist <= 1) allyScore = 400;
      else if (minAllyDist <= 2) allyScore = 280;
      else if (minAllyDist <= 3) allyScore = 160;
      else allyScore = -(minAllyDist - 3) * 40;
    }

    // 安全分（不被贴脸）
    var safeScore = !surrounded ? 800 : -800;

    // 攻击分（能打到人）
    var atkScore = canAttackAny ? 1200 : -600;
    if (canAttackAny) atkScore += Math.max(0, myRange - attackDist) * 15; // 距离越近越好

    // 传说集火
    var focusBonus = (strategy === 'legend' && attackTarget && AIState.assignedTargets[attackTarget.key] && AIState.assignedTargets[attackTarget.key].count >= 1) ? 500 : 0;

    var score = 0;

    if (role === 'bow') {
      // 弓兵：三个维度同时参与，不贴脸略重于攻击，攻击重于队友
      // safeScore=±800, atkScore=+1200/-600, allyScore≤400 → 安全+攻击=2000, 贴脸+攻击=400, 安全+打不到=200
      score = safeScore * 1.2 + atkScore + allyScore + focusBonus;
    } else if (role === 'crossbow') {
      // 弩兵：攻击 > 队友 > 安全（贴脸无所谓）
      score = atkScore * 1.5 + allyScore + safeScore * 0.3 + focusBonus;
    } else if (role === 'cavalry' || role === 'flying') {
      // 骑兵/空军：有攻击位 > 侧袭/背袭 > 队友
      var flankScore = 0;
      if (az === 'rear') flankScore = 2000;
      else if (az === 'flank') flankScore = 1200;
      // 骑兵/空军切敌方远程兵加分（不限 flying，cavalry 也要）
      if (attackTarget) {
        var tUD = unitDefByType(attackTarget.piece.unitType);
        var tWpn = tUD && tUD.equipment && tUD.equipment.mainWeapon
          ? (ED && ED.weapons ? ED.weapons.find(function(w) { return w.id === tUD.equipment.mainWeapon; }) : null) : null;
        if (tWpn && (tWpn.type === 'bow' || tWpn.type === 'crossbow')) flankScore += 1000;
      }
      // Legend + focus_ranged 战术：额外加分
      if (strategy === 'legend' && AIState.commanderPlan && AIState.commanderPlan.tactic === 'focus_ranged') {
        flankScore += 500;
      }
      score = atkScore + flankScore + allyScore * 0.3 + focusBonus;
      if (!canAttackAny) return;
    } else {
      // 步兵/野兽：队友 > 攻击 > 推进
      if (!canAttackAny) return;
      score = allyScore * 2 + atkScore + focusBonus;
      // Legend：步兵为远程让位（若友方远程被贴脸需撤退，让出通道加分）
      if (strategy === 'legend' && AIState.commanderPlan && AIState.commanderPlan.protectList.length > 0) {
        // 检查是否远离被保护的远程单位（让出通道）
        var protectBonus = 0;
        AIState.commanderPlan.protectList.forEach(function(pk) {
          var prot = placedPieces[pk];
          if (!prot || prot._routed) return;
          var dToProt = hDist(c.hex, prot.hex);
          if (dToProt >= 2) protectBonus += 30; // 离被保护单位远=让位
        });
        score += protectBonus;
        // 同时检查是否阻挡了被保护单位的撤退路径（远离敌人方向）
        // 简化处理：步兵若站在被保护单位与敌人之间且距离<=1，扣分
        AIState.commanderPlan.protectList.forEach(function(pk) {
          var prot = placedPieces[pk];
          if (!prot || prot._routed) return;
          enemies.forEach(function(e) {
            if (e.piece._routed) return;
            // 是否挡在 prot 和 enemy 之间
            var dProtEnemy = hDist(prot.hex, e.piece.hex);
            if (dProtEnemy <= 2) {
              var dSelfProt = hDist(c.hex, prot.hex);
              var dSelfEnemy = hDist(c.hex, e.piece.hex);
              if (dSelfProt <= 1 && dSelfEnemy <= 1) score -= 50; // 挡路了
            }
          });
        });
      }
    }

    if (score > bestScore) { bestScore = score; best = c; }
  });

  if (best && bestScore > 5 && hDist(best.hex, aiUnit.piece.hex) > 0) return best;
  return null;
}

// 主移动决策函数（当前打不到任何人时调用）
function aiDecideMove(aiUnit, target, allies, enemies) {
  var config = AIState.config;
  var strategy = config ? config.moveStyle : 'toward';
  var st = getPieceStats(aiUnit.piece);
  var configMax = config ? config.maxMoveSteps : 3;
  var actualMove = st ? st.movement : 1;
  var maxSteps = Math.min(configMax, actualMove);
  var candidates = aiGetMoveCandidates(aiUnit, maxSteps);
  if (candidates.length === 0) return null;

  var myRange = st ? (st.allowedRange || 1) : 1;
  var role = aiClassify(aiUnit, st);

  if (strategy === 'toward') {
    // 简单：按 role 简化决策
    var bestS = null, bestScoreS = -Infinity;
    candidates.forEach(function(c) {
      var score = 0;
      var minEnemyDist = Infinity;
      enemies.forEach(function(e) {
        if (e.piece._routed) return;
        var d = hDist(c.hex, e.piece.hex);
        if (d < minEnemyDist) minEnemyDist = d;
        if (d <= myRange) score += 40;
      });

      if (role === 'bow') {
        // 弓兵：保持 3-4 格距离，被贴脸逃向远离方向
        var pinned = minEnemyDist <= 1;
        if (pinned) {
          // 被贴脸：远离敌人方向优先
          score += minEnemyDist * 50;
        } else {
          // 未被贴脸：理想距离 3-4 格
          if (minEnemyDist >= 3 && minEnemyDist <= 4) score += 60;
          else if (minEnemyDist < 2) score -= 80;
          else if (minEnemyDist > 5) score -= (minEnemyDist - 5) * 8;
          if (minEnemyDist <= myRange) score += 30; // 能打到加分
        }
      } else if (role === 'cavalry' || role === 'flying' || role === 'beast') {
        // 骑兵/空军/野兽：直接冲最近敌人
        score -= minEnemyDist * 5;
      } else {
        // 步兵/弩兵：朝目标移动
        score -= hDist(c.hex, target.piece.hex) * 3;
      }
      if (score > bestScoreS) { bestScoreS = score; bestS = c; }
    });
    return bestS;
  }

  // 困难/传说：按兵种职责，三个维度同时打分
  var best = null, bestScore = -Infinity;
  candidates.forEach(function(c) {
    var distToTarget = hDist(c.hex, target.piece.hex);

    var canAttackAny = false, nearestEnemyDist = Infinity;
    enemies.forEach(function(e) {
      if (e.piece._routed) return;
      var d = hDist(c.hex, e.piece.hex);
      if (d <= myRange) canAttackAny = true;
      if (d < nearestEnemyDist) nearestEnemyDist = d;
    });

    var surrounded = false;
    enemies.forEach(function(e) {
      if (e.piece._routed) return;
      if (hDist(c.hex, e.piece.hex) <= 1) surrounded = true;
    });

    var minAllyDist = Infinity;
    allies.forEach(function(a) {
      if (a.piece._routed || a === aiUnit) return;
      var d = hDist(c.hex, a.piece.hex);
      if (d < minAllyDist) minAllyDist = d;
    });

    var allyScore = 0;
    if (isFinite(minAllyDist)) {
      if (minAllyDist <= 1) allyScore = 400;
      else if (minAllyDist <= 2) allyScore = 280;
      else if (minAllyDist <= 3) allyScore = 160;
      else allyScore = -(minAllyDist - 3) * 40;
    }

    var safeScore = !surrounded ? 800 : -800;
    var atkScore = canAttackAny ? 1200 : -600;
    var focusBonus = (strategy === 'legend' && AIState.assignedTargets[target.key] && AIState.assignedTargets[target.key].count >= 1) ? 500 : 0;

    // 方位（骑兵/空军用）
    var az = 'front';
    if (target.piece._facing !== undefined && typeof getAttackAzimuth === 'function') {
      az = getAttackAzimuth(c.hex, target.piece.hex, target.piece._facing);
    }

    var score = 0;

    if (role === 'bow') {
      // 弓兵：不贴脸 > 攻击 > 队友（比例打分，贴脸+攻击 > 安全+打不到）
      score = safeScore * 1.2 + atkScore + allyScore - distToTarget * 8 + focusBonus;
    } else if (role === 'crossbow') {
      // 弩兵：攻击 > 队友 > 不贴脸
      score = atkScore * 1.5 + allyScore + safeScore * 0.3 - distToTarget * 6 + focusBonus;
    } else if (role === 'cavalry' || role === 'flying') {
      // 骑兵/空军：侧袭背袭 > 靠近 > 队友(次要)
      var flankScore = 0;
      if (az === 'rear') flankScore = 2000;
      else if (az === 'flank') flankScore = 1200;
      if (role === 'flying') {
        var tUD = unitDefByType(target.piece.unitType);
        var tWpn = tUD && tUD.equipment && tUD.equipment.mainWeapon
          ? (ED && ED.weapons ? ED.weapons.find(function(w) { return w.id === tUD.equipment.mainWeapon; }) : null) : null;
        if (tWpn && (tWpn.type === 'bow' || tWpn.type === 'crossbow')) flankScore += 1000;
      }
      score = atkScore + flankScore + allyScore * 0.3 - distToTarget * 4 + focusBonus;
    } else {
      // 步兵/野兽：队友 > 攻击 > 推进
      score = allyScore * 2 + atkScore - distToTarget * 6 + focusBonus;
    }

    if (score > bestScore) { bestScore = score; best = c; }
  });

  if (best) return best;
  return aiMoveToward(aiUnit, target);
}

// ===== 攻击决策 =====

function aiCanAttack(aiUnit, target, st) {
  var dist = hDist(aiUnit.piece.hex, target.piece.hex);
  var atkRange = st ? (st.allowedRange || 1) : 1;
  if (dist > atkRange) return false;
  // 弓兵惧怕近身：相邻有任一敌军→完全禁止攻击
  if (st && st.mainWeapon && st.mainWeapon.type === 'bow') {
    var bowBlocked = false;
    Object.keys(placedPieces).forEach(function(k) {
      var p = placedPieces[k];
      if (p.team !== aiUnit.piece.team && !p._routed && hDist(aiUnit.piece.hex, p.hex) <= 1) bowBlocked = true;
    });
    if (bowBlocked) return false;
  }
  return true;
}

function aiCalculateAggression(aiUnit, target, st) {
  var aggression = AIState.config ? AIState.config.aggression : 0.5;
  var dist = hDist(aiUnit.piece.hex, target.piece.hex);
  if (target.piece._currentHP && target.piece._initialHP) {
    var hpRatio = target.piece._currentHP / target.piece._initialHP;
    if (hpRatio < 0.3) aggression += 0.2;
    if (hpRatio > 0.8) aggression -= 0.1;
  }
  if (isRangedWeapon(st) && dist > 2) aggression += 0.1;
  if (st && st.mainWeapon && st.mainWeapon.type !== 'bow' && dist <= 1) aggression += 0.1;
  // 士气低于10才考虑撤退，且必须是仍有友军存活时才允许撤（孤军作战不退）
  var hasLivingAllies = false;
  var currentMorale = aiUnit.piece._currentMorale;
  Object.keys(placedPieces).forEach(function(k) {
    var p = placedPieces[k];
    if (p.team === aiUnit.piece.team && !p._routed && p !== aiUnit.piece) hasLivingAllies = true;
  });
  if (currentMorale !== undefined && currentMorale < 10 && hasLivingAllies) aggression = -1;
  return Math.max(0, Math.min(1, aggression));
}

function aiGetFlankingBonus(attacker, defender) {
  if (!AIState.config || !AIState.config.flankingBonus) return 0;
  var sideAllyCount = 0;
  for (var i = 0; i < AI_HEX_DIRS.length; i++) {
    var d = AI_HEX_DIRS[i];
    var nq = defender.piece.hex.q + d.q;
    var nr = defender.piece.hex.r + d.r;
    var ns = defender.piece.hex.s + d.s;
    var nkey = nq + ',' + nr + ',' + ns;
    if (placedPieces[nkey] && placedPieces[nkey].team === attacker.piece.team && !placedPieces[nkey]._routed) {
      sideAllyCount++;
    }
  }
  if (sideAllyCount >= 2) return 0.2;
  if (sideAllyCount >= 1) return 0.1;
  return 0;
}

// ===== 执行移动 =====
function aiExecuteMove(aiUnit, moveTarget) {
  if (!moveTarget) return false;
  // 追击检查：离开前看是否有敌方近战在附近
  if (typeof tryOpportunityAttack === 'function') {
    tryOpportunityAttack(aiUnit.key);
  }
  var oldKey = aiUnit.key;
  var newKey = moveTarget.hex.q + ',' + moveTarget.hex.r + ',' + moveTarget.hex.s;
  var oldHex = { q: aiUnit.piece.hex.q, r: aiUnit.piece.hex.r, s: aiUnit.piece.hex.s };
  var newHex = { q: moveTarget.hex.q, r: moveTarget.hex.r, s: moveTarget.hex.s };
  var movedDist = hDist(oldHex, newHex);
  delete placedPieces[oldKey];
  aiUnit.piece.hex = newHex;
  aiUnit.piece._actionUsedThisTurn = true;
  aiUnit.piece._didActionThisTurn = true;
  aiUnit.piece._chargeDistance = movedDist;
  if (movedDist >= 1 && typeof getDirectionBetween === 'function') {
    aiUnit.piece._facing = getDirectionBetween(oldHex, newHex);
  }
  placedPieces[newKey] = aiUnit.piece;
  aiUnit.key = newKey;
  // ★ 启动移动动画：从 oldHex 插值到 newHex（260ms），修复敌方棋子瞬移问题
  // 动画系统通过 piece._animating 标记读取 _animFrom/_animTo，独立于 placedPieces 的键查找
  if (typeof startPieceMoveAnim === 'function') {
    startPieceMoveAnim(newKey, oldHex, newHex, 260, function() { if (typeof requestRender === 'function') requestRender(); });
  }
  if (typeof requestRender === 'function') requestRender();
  return true;
}

// ===== 执行攻击 =====
function aiExecuteAttack(aiUnit, target) {
  executeCombat(aiUnit.key, target.key);
  aiUnit.piece._facing = getDirectionBetween(aiUnit.piece.hex, target.piece.hex);
  return true;
}

// ===== AI 主回合循环 =====
function runAITurn() {
  if (TurnState.currentPlayer !== 'enemy' || TurnState.phase !== 'battle') return;

  initAIState(TurnState.difficulty);

  // 强制清除所有AI棋子的移动/攻击标记（防止上回合残留）
  Object.keys(placedPieces).forEach(function(key) {
    var p = placedPieces[key];
    if (p.team === 'enemy' && !p._routed) {
      p._actionUsedThisTurn = false;
      p._attackedThisTick = false;
      p._chargeDistance = 0;
    }
  });

  var enemyPieces = [];
  var playerPieces = [];
  Object.keys(placedPieces).forEach(function(key) {
    var p = placedPieces[key];
    if (p._routed) return;
    if (p.team === 'enemy') {
      enemyPieces.push({ key: key, piece: p });
    } else {
      playerPieces.push({ key: key, piece: p });
    }
  });

  if (enemyPieces.length === 0 || playerPieces.length === 0) {
    setTimeout(function() { endTurn(); }, 400);
    return;
  }

  // 计算AI阵型中心
  if (enemyPieces.length > 0) {
    var sumQ = 0, sumR = 0;
    enemyPieces.forEach(function(e) {
      sumQ += e.piece.hex.q;
      sumR += e.piece.hex.r;
    });
    AIState.formationCenter = (function() {
      var fcQ = Math.round(sumQ / enemyPieces.length);
      var fcR = Math.round(sumR / enemyPieces.length);
      return { q: fcQ, r: fcR, s: -(fcQ + fcR) };
    })();
  }

  // 传说难度：开局选定集火目标
  if (AIState.difficulty === 'legend' && playerPieces.length > 0) {
    var weakest = null, weakestHP = Infinity;
    playerPieces.forEach(function(p) {
      if (p.piece._routed) return;
      var ratio = p.piece._currentHP / Math.max(1, p.piece._initialHP);
      if (ratio < weakestHP) { weakestHP = ratio; weakest = p; }
    });
    if (weakest) AIState.focusedTargetKey = weakest.key;
  }

  // ===== 指挥官统筹层：评估全局战术 + 生成动态行动顺序 =====
  var commanderPlan = aiCommanderPlan(enemyPieces, playerPieces);
  AIState.commanderPlan = commanderPlan;  // 供 processUnitWithAnim 中的单位决策参考
  if (commanderPlan.focusTargetKey) {
    AIState.focusedTargetKey = commanderPlan.focusTargetKey;  // 兼容原有集火逻辑
  }
  var actionQueue = commanderPlan.actionOrder;

  AIState.actedThisTurn.clear();
  AIState.assignedTargets = {};

  // ===== AI 回合安全守护 =====
  var _aiTurnGuard = null;
  function _clearAITurnGuard() {
    if (_aiTurnGuard) { clearTimeout(_aiTurnGuard); _aiTurnGuard = null; }
  }
  function _setAITurnGuard() {
    _clearAITurnGuard();
    _aiTurnGuard = setTimeout(function() {
      // 10秒仍未结束，强制收尾
      if (TurnState.phase === 'battle' && TurnState.currentPlayer === 'enemy') {
        AIState.assignedTargets = {};
        requestRender();
        endTurn();
      }
    }, 10000);
  }

  var actionIdx = 0;

  function getLiveEnemies() {
    var list = [];
    Object.keys(placedPieces).forEach(function(key) {
      var p = placedPieces[key];
      if (!p._routed && p.team === 'player') {
        list.push({ key: key, piece: p });
      }
    });
    return list;
  }

  function processUnitWithAnim(unit, enemies, callback) {
    if (unit.piece._routed) { callback(); return; }
    var st = getPieceStats(unit.piece);
    if (!st) { callback(); return; }

    if (AIState.config.skipChance > 0 && Math.random() < AIState.config.skipChance) {
      AIState.actedThisTurn.add(unit.key);
      callback();
      return;
    }

    // 感知指挥官战术
    var plan = AIState.commanderPlan;
    var tacticFocusRanged = plan && plan.tactic === 'focus_ranged';
    var role = aiClassify(unit, st);

    var isRanged = isRangedWeapon(st);
    var myRange = st.allowedRange || 1;
    var strategy = AIState.config.moveStyle || 'toward';

    // 第1步：从当前能攻击到的目标中选最优
    var reachableTargets = [];
    enemies.forEach(function(e) {
      if (e.piece._routed) return;
      if (aiCanAttack(unit, e, st)) reachableTargets.push(e);
    });

    if (reachableTargets.length > 0) {
      // 士气<10撤退
      var hasAlliesCheck = false;
      var curMorale = unit.piece._currentMorale;
      Object.keys(placedPieces).forEach(function(k) {
        var p = placedPieces[k];
        if (p.team === unit.piece.team && !p._routed && p !== unit.piece) hasAlliesCheck = true;
      });
      if (curMorale !== undefined && curMorale < 10 && hasAlliesCheck) {
        var retreatTarget = aiFindRetreat(unit, enemies, enemyPieces);
        if (retreatTarget) aiExecuteMove(unit, retreatTarget);
        AIState.actedThisTurn.add(unit.key);
        requestRender();
        setTimeout(function() { callback(); }, 350);
        return;
      }

      // 选目标
      var immediateTarget;
      switch (AIState.config.targeting) {
        case 'tactical': immediateTarget = aiTargetTactical(unit, reachableTargets); break;
        case 'smart': immediateTarget = aiTargetSmart(unit, reachableTargets); break;
        default: immediateTarget = aiTargetNearest(unit, reachableTargets); break;
      }
      if (!immediateTarget) immediateTarget = reachableTargets[0];
      var isFocusTarget = plan && plan.focusTargetKey && immediateTarget && immediateTarget.key === plan.focusTargetKey;

      if (AIState.config.coordinatedAttack) {
        AIState.assignedTargets[immediateTarget.key] = AIState.assignedTargets[immediateTarget.key] || { count: 0 };
        AIState.assignedTargets[immediateTarget.key].count++;
      }

      // 简单难度：能打到就不动，直接攻击
      if (strategy === 'toward') {
        aiExecuteAttack(unit, immediateTarget);
        unit.piece._attackedThisTick = true;
        AIState.actedThisTurn.add(unit.key);
        checkAndTriggerVictory();
        requestRender();
        setTimeout(function() { callback(); }, 350);
        return;
      }

      // 困难/传说：检查是否有更好的位置（靠近友军+能攻击）
      var betterPos = aiDecideMoveOptimize(unit, enemies, enemyPieces, st);
      if (betterPos && hDist(betterPos.hex, unit.piece.hex) > 0) {
        aiExecuteMove(unit, betterPos);
        unit.piece._actionUsedThisTurn = true;
        setTimeout(function() {
          var postEnemies = getLiveEnemies();
          var reachable = [];
          for (var pi = 0; pi < postEnemies.length; pi++) {
            if (aiCanAttack(unit, postEnemies[pi], st)) reachable.push(postEnemies[pi]);
          }
          if (reachable.length > 0) {
            var bestTarget = aiSelectTarget(unit, reachable);
            if (!bestTarget) bestTarget = reachable[0];
            aiExecuteAttack(unit, bestTarget);
            unit.piece._attackedThisTick = true;
          } else if (immediateTarget && !immediateTarget.piece._routed && aiCanAttack(unit, immediateTarget, st)) {
            aiExecuteAttack(unit, immediateTarget);
            unit.piece._attackedThisTick = true;
          }
          AIState.actedThisTurn.add(unit.key);
          requestRender();
          checkAndTriggerVictory();
          setTimeout(function() { callback(); }, 350);
        }, 350);
        return;
      }

      // 没有更好的位置→原地攻击
      aiExecuteAttack(unit, immediateTarget);
      unit.piece._attackedThisTick = true;
      AIState.actedThisTurn.add(unit.key);
      checkAndTriggerVictory();
      requestRender();
      setTimeout(function() { callback(); }, 350);
      return;
    }

    // 第2步：当前打不到任何人，选最优目标移动
    var target = aiSelectTarget(unit, enemies);
    if (!target) { callback(); return; }

    if (AIState.config.coordinatedAttack) {
      AIState.assignedTargets[target.key] = AIState.assignedTargets[target.key] || { count: 0 };
      AIState.assignedTargets[target.key].count++;
    }

    var moveTarget = aiDecideMove(unit, target, enemyPieces, enemies);
    if (moveTarget && hDist(moveTarget.hex, unit.piece.hex) > 0) {
      aiExecuteMove(unit, moveTarget);
      unit.piece._actionUsedThisTurn = true;
      setTimeout(function() {
        var postEnemies = getLiveEnemies();
        var reachable2 = [];
        for (var pj = 0; pj < postEnemies.length; pj++) {
          if (aiCanAttack(unit, postEnemies[pj], st)) reachable2.push(postEnemies[pj]);
        }
        if (reachable2.length > 0) {
          var bestTarget2 = aiSelectTarget(unit, reachable2);
          if (!bestTarget2) bestTarget2 = reachable2[0];
          aiExecuteAttack(unit, bestTarget2);
          unit.piece._attackedThisTick = true;
          checkAndTriggerVictory();
        }
        AIState.actedThisTurn.add(unit.key);
        requestRender();
        setTimeout(function() { callback(); }, 350);
      }, 350);
      return;
    }

    AIState.actedThisTurn.add(unit.key);
    callback();
  }

  function processNext() {
    if (TurnState.phase !== 'battle') { _clearAITurnGuard(); return; }
    var livePlayer = getLiveEnemies();
    if (livePlayer.length === 0) {
      _clearAITurnGuard();
      requestRender();
      setTimeout(function() { endTurn(); }, 400);
      return;
    }

    if (actionIdx >= actionQueue.length) {
      _clearAITurnGuard();
      AIState.assignedTargets = {};
      requestRender();
      setTimeout(function() { endTurn(); }, 500);
      return;
    }

    var unit = actionQueue[actionIdx];
    actionIdx++;

    var enemies = getLiveEnemies();
    try {
      processUnitWithAnim(unit, enemies, function() {
        requestRender();
        setTimeout(function() {
          processNext();
        }, 250);
      });
    } catch(e) {
      console.error('AI processUnit error:', e, unit);
      requestRender();
      setTimeout(function() { processNext(); }, 250);
    }
  }

  // 启动安全守护并开始行动
  _setAITurnGuard();
  setTimeout(function() { processNext(); }, 400);
}

// ===== 调试 =====
function getAIDebugInfo() {
  return {
    difficulty: AIState.difficulty,
    config: AIState.config,
    assignedTargets: Object.keys(AIState.assignedTargets).length,
    actedCount: AIState.actedThisTurn.size,
    formationCenter: AIState.formationCenter,
    focusedTargetKey: AIState.focusedTargetKey
  };
}

// ===== 暴露到全局 =====
window.AIState = AIState;
window.getAIConfig = getAIConfig;
window.initAIState = initAIState;
window.getAIDebugInfo = getAIDebugInfo;
window.runAITurn = runAITurn;
window.DIFF_MAP = DIFF_MAP;
