// AI路径引导：如需查找相关代码路径，请先查阅 AI_PATH_GUIDE.md
// 每新增/修改一个文件后必须同步更新 AI_PATH_GUIDE.md
// ==================== 兵营事件监听初始化 ====================
(function() {
  var _barracksRefreshTimer = null;
  var _inventoryRefreshTimer = null;
  var _refreshPending = false;

  function debounceBarracksRefresh() {
    if (_barracksRefreshTimer) clearTimeout(_barracksRefreshTimer);
    _barracksRefreshTimer = setTimeout(function() {
      _refreshPending = false;
      if (typeof buildBarracks === 'function') {
        var grid = document.getElementById('unitGrid');
        if (grid && grid.offsetParent !== null) {
          buildBarracks();
        }
      }
    }, 200);
  }

  function debounceInventoryRefresh() {
    if (_inventoryRefreshTimer) clearTimeout(_inventoryRefreshTimer);
    _inventoryRefreshTimer = setTimeout(function() {
      if (typeof buildInventory === 'function') {
        var modal = document.getElementById('inventoryModal');
        if (modal && modal.classList.contains('active')) {
          var activeTab = document.querySelector('.inv-tab.active');
          var cat = activeTab ? activeTab.dataset.cat : 'all';
          buildInventory(cat);
        }
      }
      var prepInvBadge = document.getElementById('prepInvBadge');
      if (prepInvBadge) {
        var invCount = typeof getInventoryCount === 'function' ? getInventoryCount() : 0;
        prepInvBadge.textContent = invCount;
        prepInvBadge.style.display = invCount > 0 ? 'inline-flex' : 'none';
      }
    }, 200);
  }

  function initBarracksEventListeners() {
    if (typeof EventBus === 'undefined' || !EventBus.on) return;

    EventBus.on('unit:added', function() {
      debounceBarracksRefresh();
    });

    EventBus.on('equipment:changed', function() {
      debounceBarracksRefresh();
    });

    EventBus.on('inventory:changed', function() {
      debounceBarracksRefresh();
      debounceInventoryRefresh();
    });

    EventBus.on('weapon:added', function() {
      debounceInventoryRefresh();
    });

    EventBus.on('shield:added', function() {
      debounceInventoryRefresh();
    });

    EventBus.on('armor:added', function() {
      debounceInventoryRefresh();
    });

    EventBus.on('mount:added', function() {
      debounceInventoryRefresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBarracksEventListeners);
  } else {
    initBarracksEventListeners();
  }
})();

// ==================== 兵营列表 + 兵源地 ====================
function buildBarracks() {
  var grid = document.getElementById('unitGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!UD) return;
  if (GameState.playerUnits.length === 0) {
    grid.innerHTML =
      '<div style="text-align:center;padding:60px 20px;color:#8a6d4b;">' +
        '<div style="font-size:48px;margin-bottom:12px;">🏕️</div>' +
        '<div style="font-size:16px;margin-bottom:6px;">暂无部队</div>' +
        '<div style="font-size:12px;">前往商城购买或召唤之门获取兵团</div>' +
      '</div>';
    return;
  }
  GameState.playerUnits.forEach(function(pu) {
    var ud = unitDefByType(pu.type); if (!ud) return;
    var st = computeStats(ud); if (!st) return;
    var mw = st.mainWeapon, sh = st.shield, ar = st.armor, mt = st.mount, r = st.race;

    // 品质等级（统一使用商城的品阶逻辑）
    var tierInfo = (typeof getUnitTierConfig === 'function') ? getUnitTierConfig(ud.type) : {
      tierName: '普通', color: '#999', bgColor: 'rgba(150,150,150,0.12)'
    };
    var tn = tierInfo.tierName;
    var tc = tierInfo.color;
    var tbg = tierInfo.bgColor;

    var item = document.createElement('div'); item.className = 'barracks-item tier-' + (tierInfo.tier || 'iron');
    item.style.borderColor = tc; item.style.background = tbg;
    item.innerHTML =
      '<div class="bi-header">' +
        '<div class="bi-img-wrap">' +
          '<img class="bi-img" src="' + ud.image + '" alt="' + ud.name + '" onerror="this.style.display=\'none\'">' +
          '<span class="bi-tier">' + tn + '</span>' +
        '</div>' +
        '<div class="bi-info">' +
          '<h3>' + ud.icon + ' ' + ud.name + ' (' + ud.typeName + ')</h3>' +
          '<div class="bi-meta">🧬 ' + r.name + ' | 血量<b>' + st.totalHP + '</b> | 杀伤<b>' + (mw?mw.baseDamage:r.naturalWeapon) + '</b> | 护甲<b>' + st.totalArmor + '</b> | 移动<b>' + st.movement + '格</b> | 规模<b>' + st.totalScale + '</b></div>' +
        '</div>' +
        '<span class="bi-arrow">▼</span>' +
      '</div>' +
      '<div class="bi-detail">' +
        // 左：图片
        '<div class="bi-col-l"><img src="' + ud.image + '" alt=""><span class="bi-type">' + ud.typeName + '</span></div>' +
        // 中：装备 + 种族
        '<div class="bi-col-m">' +
          buildEqSlotInteractive('', '主武器', mw, 'mainWeapon', ud) +
          buildEqSlotInteractive('', '盾牌', sh, 'shield', ud) +
          buildEqSlotInteractive('', '护甲', ar, 'armor', ud) +
          buildEqSlotInteractive('', '坐骑', mt, 'mount', ud) +
          buildRaceSlot(r) +
        '</div>' +
        // 右：合成属性
        '<div class="bi-col-r"><h4>📊 最终属性</h4>' +
          statRow('单体血量', st.hpPerUnit) +
          statRow('总血量', st.totalHP + ' (' + ud.unitCount + '人)') +
          statRow('护甲强度', st.totalArmor + ' (' + r.naturalArmor + '天然+' + (ar?ar.defense:0) + '装备+' + (mt?mt.bonusArmor:0) + '坐骑)') +
          statRow('移动力', st.movement + ' 格') +
          statRow('士气', st.morale) +
          statRow('单体规模', st.unitScale) +
          statRow('总规模', st.totalScale) +
          statRow('主武器杀伤', (mw?mw.baseDamage:r.naturalWeapon) + ' / 破甲' + (mw?mw.armorPierce:0)) +
          statRow('攻击范围', '单次打 ' + st.attackRange + ' 单位 / 攻击距离 ' + st.allowedRange + ' 格') +
          statRow('远程免伤', Math.round(st.rangedResist*100) + '%') +
          statRow('部队战力', ud.powerIndex || '—') +
        '</div>' +
      '</div>';
    item.addEventListener('click', function(e) {
      if (e.target.closest('.eq-slot') || e.target.closest('.race-slot') || e.target.closest('.eq-action-btn')) return;
      // 点击展开时设置当前操作单位
      window._currentEquipUnitType = ud.type;
      this.classList.toggle('expanded');
    });
    grid.appendChild(item);
  });
}

function buildRaceSlot(r) {
  return '<div class="race-slot" onclick="event.stopPropagation();this.classList.toggle(\'expanded\')">' +
    '<div class="race-sum">🧬 种族：' + r.name + '（' + (r.typeLabel||'常规体型') + '）</div>' +
    '<div class="race-detail">' +
      '单体血量 <b>' + r.baseHP + '</b> | 天然护甲 <b>' + r.naturalArmor + '</b><br>' +
      '天然武器 <b>' + r.naturalWeapon + '</b> | 士气 <b>' + r.baseMorale + '</b> | 移动 <b>' + r.baseMovement + '</b> 格<br>' +
      '单体规模 <b>' + r.scale + '</b> | 攻击范围 <b>' + r.attackRange + '</b>' +
    '</div></div>';
}

function statRow(k,v){return '<div class="stat-row"><span class="sk">'+k+'</span><span class="sv">'+(v===0||v==='0'||v===null||v===undefined?'—':v)+'</span></div>'}

// 部队选择页面
var selectedDifficulty = 'easy';
window.selectedDifficulty = 'easy';  // 初始化

function buildUnitSelect() {
  var wrap = document.getElementById('selectWrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  // 选兵网格
  var grid = document.createElement('div'); grid.className = 'select-grid';
  var selected = [];
  var updateBtn = function() {
    var btn = document.getElementById('selectConfirm');
    if (!btn) return;
    btn.disabled = selected.length === 0;
    btn.textContent = '确认出战（已选 ' + selected.length + ' / 6 支部队）';
  };

  GameState.playerUnits.forEach(function(pu, idx) {
    var ud = unitDefByType(pu.type); if (!ud) return;
    var card = document.createElement('div'); card.className = 'select-card';
    card.dataset.idx = idx;  // 保存原始 playerUnits 索引，供 confirmBattle 读取
    card.innerHTML =
      '<img class="sc-img" src="' + ud.image + '" alt="">' +
      '<div class="sc-info"><div class="sc-name">' + ud.icon + ' ' + ud.name + '</div>' +
        '<div class="sc-type">' + ud.typeName + ' · 🧬 ' + (ud.race?ud.race.name:'?') + '</div>' +
        '<div class="sc-brief">' + (ud.background||'').substring(0,30) + '...</div></div>';

    var isSelected = false;
    card.addEventListener('click', function() {
      if (isSelected) {
        isSelected = false; this.classList.remove('selected');
        selected = selected.filter(function(i) { return i !== idx; });
      } else {
        if (selected.length >= 6) return;
        isSelected = true; this.classList.add('selected');
        selected.push(idx);
      }
      updateBtn();
    });
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  updateBtn();
}

// 获取选中的部队列表
var selectedUnitTypes = [];

function getSelectedForBattle() { return selectedUnitTypes; }

// ==================== 战场面板（棋盘上选中棋子时显示） ====================
function updateUnitCard(piece) {
  var cd = document.getElementById('unitCard');
  if (!cd) return;
  if (!piece) { cd.classList.remove('show'); return; }
  var ud = unitDefByType(piece.unitType);
  if (!ud) { cd.classList.remove('show'); return; }
  var st = computeStats(ud);
  if (!st) { cd.classList.remove('show'); return; }
  var imgEl = document.getElementById('unitCardImg');
  var nameEl = document.getElementById('unitCardName');
  var bdEl = document.getElementById('unitCardBreakdown');
  var descEl = document.getElementById('unitCardDesc');
  if (imgEl) imgEl.src = ud.image;
  if (nameEl) nameEl.textContent = ud.icon + ' ' + ud.name + ' (' + ud.typeName + ') [' + (piece.team === 'player' ? '蓝方' : '红方') + ']';
  var r = st.race, mw = st.mainWeapon, sh = st.shield, ar = st.armor, mt = st.mount;
  var esc = window.escText || function(s){return s;};  // 转义函数兜底
  if (bdEl) {
    bdEl.innerHTML =
      '<div class="uc-col"><h4>🧬 ' + esc(r.name) + ' 基底</h4>' +
        '<p>单体HP <b>' + r.baseHP + '</b> | 天然护甲 <b>' + r.naturalArmor + '</b> | 士气 <b>' + r.baseMorale + '</b> | 移动 <b>' + r.baseMovement + '</b></p></div>' +
      '<div class="uc-col"><h4>⚔ 装备 → 最终</h4>' +
        '<p>' + (mw ? '<b>' + esc(mw.name) + '</b> 杀' + mw.baseDamage + '/破' + mw.armorPierce + ' 程' + mw.allowedRange + '格' : '') + (mw && mw.effects && mw.effects.length ? ' <span class="add">[' + mw.effects.join(',') + ']</span>' : '') + '</p>' +
        '<p>' + (sh ? '<b>' + esc(sh.name) + '</b>' : '') + (sh ? ' <span class="add">远程免伤+' + Math.round((st.rangedResist||0) * 100) + '%</span>' : '') + (ar ? ' | <b>' + esc(ar.name) + '</b> +' + ar.defense + '防' : '') + (mt ? ' | <b>' + esc(mt.name) + '</b> +' + mt.scale + '规 HP+' + mt.bonusHP + ' 移+' + mt.bonusMove : '') + '</p>' +
        '<p class="total">血量 <b>' + st.totalHP + '</b> | 护甲 <b>' + st.totalArmor + '</b> | 移动 <b>' + st.movement + '格</b> | 士气 <b>' + st.morale + '</b> | 规模 <b>' + st.totalScale + '</b> | 攻击 <b>' + st.attackRange + '单位/次</b> 攻击距离<b>' + st.allowedRange + '格</b></p></div>';
  }
  if (descEl) descEl.textContent = ud.background + '　·　' + ud.belief;
  cd.classList.add('show');
}
function updateMoveHint() {
  var h = document.getElementById('moveHint');
  if (!h) return;
  if (TurnState.phase === 'deploy') {
    h.style.display = 'inline';
    h.textContent = '📦 拖拽棋子到棋盘（棕红色格子禁止放置）';
    return;
  }
  if (selectedPieceKey && placedPieces[selectedPieceKey] && !placedPieces[selectedPieceKey]._routed) {
    var sp = placedPieces[selectedPieceKey], ud = unitDefByType(sp.unitType), st = ud ? computeStats(ud) : null;
    var atkR = st ? st.allowedRange : 1;
    if (TurnState.phase === 'battle') {
      if (sp._actionUsedThisTurn) {
        if (sp._attackedThisTick) {
          h.style.display = 'inline'; h.textContent = '⛔ 本回合已行动过（移动+攻击）';
        } else {
          h.style.display = 'inline'; h.textContent = '⛔ 本回合已移动过 | 可攻击红点敌军';
        }
      } else if (sp._attackedThisTick) {
        h.style.display = 'inline'; h.textContent = '⛔ 本回合已攻击过 | 还可移动';
      } else {
        h.style.display = 'inline'; h.textContent = '📍 移动' + (st ? st.movement : '?') + '格（绿）| ⚔ 攻击' + atkR + '格 单次' + (st ? st.attackRange : '?') + '单位（红）';
      }
    }
  } else { h.style.display = 'none'; }
}
