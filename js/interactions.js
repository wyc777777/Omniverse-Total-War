// AI路径引导：如需查找其他文件路径和功能说明，请先查看项目根目录的 AI_PATH_GUIDE.md；每新增/修改一个文件后，必须同步更新AI_PATH_GUIDE.md
// ==================== 交互系统 v2 ====================
var interactionInited = false;
var _listenersAttached = false;
var _clickHandler = null;
var _dropHandler = null;
var _dragoverHandler = null;
var _dragleaveHandler = null;
var _mousemoveHandler = null;
var _mouseleaveHandler = null;

function initInteractions() {
  var bdz = document.getElementById('boardDropZone');
  if (!bdz || !canvas) return;

  // 先移除旧监听器
  if (_listenersAttached) {
    bdz.removeEventListener('dragover', _dragoverHandler);
    bdz.removeEventListener('dragleave', _dragleaveHandler);
    bdz.removeEventListener('drop', _dropHandler);
    canvas.removeEventListener('click', _clickHandler);
    canvas.removeEventListener('mousemove', _mousemoveHandler);
    canvas.removeEventListener('mouseleave', _mouseleaveHandler);
  }

  // ===== 拖放（部署阶段）=====
  _dragoverHandler = function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; bdz.classList.add('drag-over'); };
  _dragleaveHandler = function() { bdz.classList.remove('drag-over'); };
  bdz.addEventListener('dragover', _dragoverHandler);
  bdz.addEventListener('dragleave', _dragleaveHandler);
  _dropHandler = function(e) {
    e.preventDefault(); bdz.classList.remove('drag-over');
    var raw = e.dataTransfer.getData('text/plain'); if (!raw) return;
    var d = JSON.parse(raw);
    if (benchState[d.slotIdx] === false) return;

    var rect = canvas.getBoundingClientRect();
    var h = pix2hex((e.clientX - rect.left) * canvas.width / rect.width, (e.clientY - rect.top) * canvas.height / rect.height);
    if (!h) return;
    var key = h.q + ',' + h.r + ',' + h.s;
    if (placedPieces[key]) return;

    if (TurnState.phase === 'deploy') {
      // 仅当前部署方（且非 AI 控制）的棋子可放置
      if (d.team !== TurnState.currentPlayer) return;
      if (isControlledByAI(TurnState.currentPlayer)) return;
      // 中心一环以内禁止放置
      if (hDist(h, {q:0,r:0,s:0}) <= 1) return;
      // 不允许在敌人 2 格范围内放置
      for (var pk in placedPieces) {
        if (placedPieces[pk].team !== d.team && hDist(placedPieces[pk].hex, h) <= 2) {
          if (typeof showToast === 'function') showToast('不能在敌人 2 格范围内放置！', 'warning');
          return;
        }
      }
    }
    if (TurnState.phase === 'battle') return;

    placedPieces[key] = { unitType: d.unitType, team: d.team, slotIdx: d.slotIdx, hex: { q: h.q, r: h.r, s: h.s } };
    // 设置初始朝向（朝向棋盘中心）
    placedPieces[key]._facing = getFacingToCenter(h);
    initPieceRuntimeState(placedPieces[key]);
    if (typeof startPlaceAnim === 'function') startPlaceAnim(key);
    benchState[d.slotIdx] = false;
    var sl = document.querySelectorAll('.bench-slot[data-slot-idx="' + d.slotIdx + '"]')[0];
    if (sl) { sl.dataset.placed = 'true'; sl.classList.add('empty'); sl.draggable = false; }

    if (TurnState.phase === 'deploy') {
      onPlayerPlacePiece();
    }

    selectedPieceKey = null; updateMoveHint(); updateUnitCard(null); requestRender();
  };
  bdz.addEventListener('drop', _dropHandler);

  // ===== 点击 =====
  var lcT = 0, lcK = '';
  _clickHandler = function(e) {
    var rect = canvas.getBoundingClientRect(), h = pix2hex((e.clientX - rect.left) * canvas.width / rect.width, (e.clientY - rect.top) * canvas.height / rect.height);
    if (!h) { deselectAll(); requestRender(); return; }
    var key = h.q + ',' + h.r + ',' + h.s, now = Date.now(), dbl = (key === lcK && now - lcT < 350); lcT = now; lcK = key;

    // === 斗蛐蛐模式：玩家始终为观战者，仅暂停时可点击棋子查看面板 ===
    if (TurnState.isDuelBattle) {
      if (!_spectatorPaused) return;
      if (placedPieces[key] && !placedPieces[key]._routed) {
        var tp = placedPieces[key];
        selectedPieceKey = key;
        updateUnitCard(tp);
        updateMoveHint();
        if (tp.team === 'player' && typeof startSelectAnim === 'function') startSelectAnim(key);
        requestRender();
      } else {
        deselectAll();
        requestRender();
      }
      return;
    }

    // === 任意时刻点击棋子查看面板（不改变选中状态，选中由后面的「选中棋子」逻辑处理）===
    if (placedPieces[key] && !placedPieces[key]._routed) {
      var tp2 = placedPieces[key];
      updateUnitCard(tp2);
      updateMoveHint();
      requestRender();
      if (TurnState.phase === 'battle' && TurnState.currentPlayer !== 'player') return;
      if (TurnState.phase === 'deploy') return;
    }

    // === 战斗模式 ===
    if (TurnState.phase === 'battle' && TurnState.currentPlayer === 'player') {
      // 选中己方 → 点敌方攻击
      if (selectedPieceKey && placedPieces[selectedPieceKey] && placedPieces[key]) {
        var sp = placedPieces[selectedPieceKey], tp = placedPieces[key];
        if (sp.team === 'player' && tp.team === 'enemy' && !sp._routed && !tp._routed) {
          var stu = getPieceStats(sp);
          var atkR = stu ? stu.allowedRange : 1;
          if (hDist(sp.hex, tp.hex) <= atkR) {
            if (sp._attackedThisTick) { deselectAll(); requestRender(); return; }
            // 弓兵近战封锁：持弓+相邻敌军→禁止攻击，允许移动
            if (isBowBlockedByAdjacentEnemy(sp)) {
              var spUD = unitDefByType(sp.unitType);
              showToast((spUD ? spUD.name : '弓兵') + ' 被贴近，无法攻击！', 'warning');
              deselectAll(); requestRender();
              return;
            }
            executeCombat(selectedPieceKey, key);
            sp._facing = getDirectionBetween(sp.hex, tp.hex);
            sp._actionUsedThisTurn = true;
            sp._attackedThisTick = true;
            sp._chargeDistance = 0;
            selectedPieceKey = null; updateMoveHint(); updateUnitCard(null);
            checkAndTriggerVictory();
            return;
          }
        }
      }
      if (dbl && placedPieces[key] && placedPieces[key].team === 'player') { deselectAll(); requestRender(); return; }
    }

    // === 双击回收（仅部署阶段，仅玩家自己的棋子）===
    if (dbl && placedPieces[key] && TurnState.phase === 'deploy' && placedPieces[key].team === 'player') {
      if (typeof startRecycleAnim === 'function') startRecycleAnim(key);
      var pc2 = placedPieces[key]; delete placedPieces[key]; returnToBench(pc2.slotIdx);
      TurnState.deployCount.player--;
      updateDeployUI();
      deselectAll(); requestRender(); return;
    }

    // === 部署阶段：不能点已有的棋子移动 ===
    if (TurnState.phase === 'deploy' && placedPieces[key]) {
      selectedPieceKey = null; updateUnitCard(null); updateMoveHint(); requestRender(); return;
    }

    // === 移动 ===
    if (selectedPieceKey && placedPieces[selectedPieceKey] && !placedPieces[key]) {
      var sp2 = placedPieces[selectedPieceKey];
      if (sp2._routed) { deselectAll(); requestRender(); return; }
      if (TurnState.phase === 'battle') {
        if (TurnState.currentPlayer !== 'player') { deselectAll(); requestRender(); return; }
        if (sp2.team !== 'player') { deselectAll(); requestRender(); return; }
        if (sp2._actionUsedThisTurn) { deselectAll(); requestRender(); return; }
      }
      var sh2 = sp2.hex, ud2 = unitDefByType(sp2.unitType), st2 = ud2 ? computeStats(ud2) : null, r2 = st2 ? st2.movement : 1;
      if (hDist(h, sh2) <= r2 && !(typeof isTerrainBlocked === 'function' && isTerrainBlocked(h))) {
        // 追击检查：离开前看是否有敌方近战在附近
        if (typeof tryOpportunityAttack === 'function') {
          tryOpportunityAttack(selectedPieceKey);
        }
        if (sp2._routed) {
          // 偷袭导致溃逃，中止移动
          deselectAll();
          requestRender();
          return;
        }
        var oldHex = { q: sh2.q, r: sh2.r, s: sh2.s };
        var newHex = { q: h.q, r: h.r, s: h.s };
        var movedDist = hDist(newHex, oldHex);
        delete placedPieces[selectedPieceKey]; sp2.hex = newHex; placedPieces[key] = sp2;
        if (movedDist >= 1) {
          sp2._facing = getDirectionBetween(oldHex, newHex);
        }
        selectedPieceKey = key;
        if (TurnState.phase === 'battle') {
          sp2._actionUsedThisTurn = true;
          sp2._didActionThisTurn = true;
          sp2._chargeDistance = movedDist;
        }
        updateMoveHint(); updateUnitCard(sp2);
        if (typeof startPieceMoveAnim === 'function') {
          startPieceMoveAnim(key, oldHex, newHex, 260, function() { requestRender(); });
        }
        requestRender(); return;
      }
    }

    // === 选中棋子 ===
    if (placedPieces[key] && !placedPieces[key]._routed) {
      var tp2 = placedPieces[key];
      if (TurnState.phase === 'deploy') { deselectAll(); requestRender(); return; }
      if (TurnState.phase === 'battle' && TurnState.currentPlayer === 'player') {
        if (tp2.team === 'player') {
          selectedPieceKey = (selectedPieceKey === key) ? null : key;
          if (selectedPieceKey) {
            if (typeof startSelectAnim === 'function') startSelectAnim(selectedPieceKey);
          } else {
            if (typeof stopSelectAnim === 'function') stopSelectAnim();
          }
          updateUnitCard(selectedPieceKey ? tp2 : null);
          updateMoveHint(); requestRender(); return;
        } else {
          selectedPieceKey = null;
          if (typeof stopSelectAnim === 'function') stopSelectAnim();
          updateUnitCard(tp2); updateMoveHint(); requestRender(); return;
        }
      }
      if (selectedPieceKey === key) { selectedPieceKey = null; updateUnitCard(null); if (typeof stopSelectAnim === 'function') stopSelectAnim(); }
      else { selectedPieceKey = key; updateUnitCard(tp2); if (tp2.team === 'player' && typeof startSelectAnim === 'function') startSelectAnim(key); }
      updateMoveHint(); requestRender(); return;
    }

    deselectAll(); requestRender();
  };
  canvas.addEventListener('click', _clickHandler);

  _mousemoveHandler = function(e) {
    var rect = canvas.getBoundingClientRect(), h = pix2hex((e.clientX - rect.left) * canvas.width / rect.width, (e.clientY - rect.top) * canvas.height / rect.height);
    hoveredHex = h; canvas.style.cursor = h ? 'pointer' : 'default';
    var hc = document.getElementById('hoverCoord'); if (hc) hc.textContent = '(' + (h ? h.q : '—') + ', ' + (h ? h.r : '—') + ', ' + (h ? h.s : '—') + ')';
    updateCombatPreview(e.clientX, e.clientY);
    requestRender();
  };
  canvas.addEventListener('mousemove', _mousemoveHandler);

  _mouseleaveHandler = function() { hoveredHex = null; hideCombatPreview(); requestRender(); };
  canvas.addEventListener('mouseleave', _mouseleaveHandler);

  interactionInited = true;
  _listenersAttached = true;
}

function deselectAll() { selectedPieceKey = null; updateMoveHint(); updateUnitCard(null); hideCombatPreview(); }
function resetInteractions() { interactionInited = false; }

// ===== 悬停伤害预览 tooltip =====
function updateCombatPreview(mx, my) {
  var wrap = document.getElementById('boardDropZone');
  if (!wrap || TurnState.phase !== 'battle' || TurnState.currentPlayer !== 'player') { hideCombatPreview(); return; }
  if (!selectedPieceKey || !placedPieces[selectedPieceKey]) { hideCombatPreview(); return; }
  var sp = placedPieces[selectedPieceKey];
  if (sp.team !== 'player' || sp._routed || sp._attackedThisTick) { hideCombatPreview(); return; }
  if (!hoveredHex) { hideCombatPreview(); return; }
  var key = hoveredHex.q + ',' + hoveredHex.r + ',' + hoveredHex.s;
  if (key === selectedPieceKey) { hideCombatPreview(); return; }
  var tp = placedPieces[key];
  if (!tp || tp.team !== 'enemy' || tp._routed) { hideCombatPreview(); return; }

  var stu = getPieceStats(sp);
  var atkR = stu ? stu.allowedRange : 1;
  if (hDist(sp.hex, tp.hex) > atkR) { hideCombatPreview(); return; }

  if (typeof computeCombatPreview !== 'function') return;
  var result = computeCombatPreview(sp, tp);
  if (!result) { hideCombatPreview(); return; }
  if (result.blocked) {
    showCombatTooltip(mx, my, '弓兵被贴近，无法攻击');
    return;
  }

  var html = '<div class="cpt-dmg">伤害: <b>' + result.damage + '</b></div>';
  if (result.lostMen > 0) html += '<div class="cpt-loss">阵亡: <b>' + result.lostMen + '</b> 人</div>';
  if (result.willRout) {
    html += '<div class="cpt-rout">❗ 预计击溃!</div>';
  } else {
    var delta = result.moraleAfter - result.moraleBefore;
    var moClass = delta < 0 ? 'cpt-mo-down' : 'cpt-mo-up';
    html += '<div class="cpt-morale">士气: <span class="' + moClass + '">' + delta + '</span> (' + result.moraleAfter + ')</div>';
  }
  if (result.azimuth !== 'front') {
    html += '<div class="cpt-azimuth">方位: ' + (result.azimuth === 'flank' ? '侧翼 ⚡' : '背面 💥') + '</div>';
  }
  showCombatTooltip(mx, my, html);
}

function showCombatTooltip(mx, my, content) {
  var el = document.getElementById('combatPreviewTip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'combatPreviewTip';
    el.className = 'combat-preview-tip';
    var wrap = document.getElementById('boardDropZone') || document.body;
    wrap.appendChild(el);
  }
  el.innerHTML = content;
  el.style.display = 'block';
  // 定位：跟随鼠标（偏移避免遮挡）
  el.style.left = (mx + 16) + 'px';
  el.style.top = (my - 10) + 'px';
  // 防溢出屏幕（延迟一帧让浏览器先计算尺寸）
  setTimeout(function() {
    var rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) el.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) el.style.top = (window.innerHeight - rect.height - 8) + 'px';
    if (rect.left < 0) el.style.left = '8px';
    if (rect.top < 0) el.style.top = '8px';
  }, 0);
}

function hideCombatPreview() {
  var el = document.getElementById('combatPreviewTip');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
}
