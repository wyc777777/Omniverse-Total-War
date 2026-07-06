// AI路径引导：如需查找其他文件路径和功能说明，请先查看项目根目录的 AI_PATH_GUIDE.md；每新增/修改一个文件后，必须同步更新AI_PATH_GUIDE.md
// ==================== 背包与装备UI ====================

var _currentEquipUnitType = null;
var _currentEquipSlot = null;

// ===== 装备槽渲染（带拆卸/更换按钮）=====
// 常规状态：只显示图标+装备名称（无属性）
// 点击展开：显示完整属性+效果+操作按钮（按钮在下方新一行）
function buildEqSlotInteractive(icon, label, eq, slot, unitDef) {
  // 判断装备状态：直接看 unitDef 的装备数据，而非 computeStats 生成的天然装备
  // eq 来自 computeStats（可能返回天然武器/护甲），仅用于展示属性
  var realEquipId = unitDef && unitDef.equipment ? unitDef.equipment[slot] : null;
  var hasRealEquip = !!realEquipId;
  var isNatural = !hasRealEquip;  // 无真实装备 → 显示为天赋/天然
  
  // 更精美的装备图标
  var iconMap = {
    'mainWeapon': '⚔️',
    'shield': '🛡️',
    'armor': '🛡️',
    'mount': '🐴'
  };
  var actualIcon = iconMap[slot] || icon;
  
  // 野兽种族槽位禁用判断（mainWeapon/shield/mount 不可用，仅 armor 可用）
  var isSlotDisabled = !!(unitDef && !canEquipSlot(unitDef, slot));
  // 盾牌槽特殊处理：双手武器时显示"不可用"（保留现有逻辑）
  var isShieldDisabled = slot === 'shield' && unitDef && !canUseShield(unitDef);
  var disabledHint = '';
  if (isSlotDisabled) {
    disabledHint = '<span style="color:#7a7a7a;font-size:10px;margin-left:4px">🔒 野兽不可用</span>';
  } else if (isShieldDisabled) {
    disabledHint = '<span style="color:#c0392b;font-size:10px;margin-left:4px">(双手武器不可用)</span>';
  }
  var isAnyDisabled = isSlotDisabled || isShieldDisabled;
  
  // 展开后显示的属性详情
  var detail = '';
  if (eq) {
    if (eq.baseDamage !== undefined) {
      var handedLabel = eq.handed ? (eq.handed === 'two-handed' ? '双手' : '单手') : '';
      detail = '基础杀伤 <b>' + eq.baseDamage + '</b> · 破甲 <b>' + eq.armorPierce + '</b> · 攻击距离 <b>' + (eq.allowedRange||'?') + '</b>格 · 单次 <b>' + (eq.attackRange||1) + '</b>单位';
      if (handedLabel) detail += ' · ' + handedLabel;
    }
    else if (eq.defense !== undefined) detail = '护甲强度 <b>' + eq.defense + '</b>' + (eq.mobilityPenalty<0 ? ' · 机动 <b>' + eq.mobilityPenalty + '</b>' : '') + (eq.category ? ' · ' + eq.category : '');
    else if (eq.scale !== undefined) detail = '规模 <b>' + eq.scale + '</b> · HP <b>+' + (eq.bonusHP||0) + '</b> · 护甲 <b>+' + (eq.bonusArmor||0) + '</b> · 移动 <b>+' + (eq.bonusMove||0) + '</b>';
  }
  var effects = '';
  if (eq && eq.effects && eq.effects.length) effects = '<div style="color:#8b2500;font-size:9px;margin-top:4px;font-weight:500">效果: ' + eq.effects.join(' · ') + '</div>';

  // 常规状态：只显示名称（简洁）
  var nameLine = label + '：';
  if (!eq) nameLine += isAnyDisabled ? '不可用' : '无';
  else if (isNatural) nameLine += '<span style="color:#8a6d4b">' + eq.name + '</span> <span style="color:#8a6d4b;font-size:9px">(天赋)</span>';
  else nameLine += eq.name;
  nameLine += disabledHint;

  // 展开后：名称加粗 + 完整属性
  var expandedName = label + '：';
  if (!eq) expandedName += isAnyDisabled ? '不可用' : '无';
  else if (isNatural) expandedName += '<b style="color:#8a6d4b">' + eq.name + '</b> <span style="color:#8a6d4b;font-size:9px;font-weight:500">(天赋)</span>';
  else expandedName += '<b>' + eq.name + '</b>';
  expandedName += disabledHint;

  // 操作按钮区域（单独一行）
  // 野兽禁用槽位（canEquipSlot 返回 false）或双手武器禁用盾牌时不显示按钮
  var actionsHtml = '';
  if (!isAnyDisabled) {
    var btns = [];
    if (hasRealEquip) btns.push('<button class="eq-action-btn unequip-btn" onclick="event.stopPropagation();doUnequip(\'' + slot + '\')">卸下</button>');
    btns.push('<button class="eq-action-btn equip-btn" onclick="event.stopPropagation();openEquipPicker(\'' + slot + '\')">' + (hasRealEquip ? '更换' : '装备') + '</button>');
    actionsHtml = '<div class="eq-actions-row">' + btns.join('') + '</div>';
  }

  // 装备适用性信息（名称下方小字灰色）
  var applicabilityHtml = '';
  if (eq) {
    var appText = (typeof getEquipmentApplicabilityText === 'function') ? getEquipmentApplicabilityText(eq) : '';
    if (appText) applicabilityHtml = '<div class="equip-applicability">' + appText + '</div>';
  }

  // 常规：只有名称；展开：名称+属性+效果+按钮（按钮在下方）
  var detailHtml = eq ? ('<div class="eq-detail">' + detail + effects + '</div>') : '';

  var disabledClass = isSlotDisabled ? ' eq-slot-disabled' : (isShieldDisabled ? ' shield-disabled' : '');
  var onClickToggle = isAnyDisabled ? '' : 'var ex=this.classList.toggle(\'expanded\');var n=this.querySelector(\'.eq-name\');if(n){n.innerHTML=decodeURIComponent(ex?n.dataset.expanded:n.dataset.collapsed);n.style.fontWeight=ex?\'bold\':\'normal\';}';

  return '<div class="eq-slot interactive' + disabledClass + '" onclick="event.stopPropagation();' + onClickToggle + '">' +
    '<div class="eq-header-row">' +
      '<span class="eq-icon">' + actualIcon + '</span>' +
      '<div class="eq-info">' +
        '<span class="eq-name" data-collapsed="' + encodeURIComponent(nameLine) + '" data-expanded="' + encodeURIComponent(expandedName) + '">' + nameLine + '</span>' +
        applicabilityHtml +
      '</div>' +
      (isAnyDisabled ? '' : '<span class="eq-arrow">▶</span>') +
    '</div>' +
    '<div class="eq-expand-content">' +
      detailHtml +
      actionsHtml +
    '</div>' +
  '</div>';
}

// 拆卸装备
function doUnequip(slot) {
  if (!_currentEquipUnitType) return;
  var ud = unitDefByType(_currentEquipUnitType);
  if (!ud) return;
  var item = unequipToInventory(ud, slot);
  if (item) {
    _refreshAll();
  }
}

// 刷新所有相关UI（仅更新轻量元素，重型rebuild由EventBus debounce触发）
function _refreshAll() {
  if (window._onSavesUpdated) window._onSavesUpdated({});
  // 立即更新背包徽章（轻量操作）
  var prepInvBadge = document.getElementById('prepInvBadge');
  if (prepInvBadge) {
    var invCount = typeof getInventoryCount === 'function' ? getInventoryCount() : 0;
    prepInvBadge.textContent = invCount;
    prepInvBadge.style.display = invCount > 0 ? 'inline-flex' : 'none';
  }
  // 注：buildBarracks 和 buildInventory 的完整重建由 EventBus debounce 触发，
  // 避免重复重建导致卡顿
}

// ===== 装备选择弹窗 =====
function openEquipPicker(slot) {
  if (!_currentEquipUnitType) return;
  var ud = unitDefByType(_currentEquipUnitType);
  if (!ud) return;
  _currentEquipSlot = slot;

  var modal = document.getElementById('equipPickerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'equipPickerModal';
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal-content equip-picker">' +
        '<div class="modal-header">' +
          '<h3>选择装备</h3>' +
          '<button class="modal-close-btn" onclick="closeEquipPicker()">×</button>' +
        '</div>' +
        '<div class="modal-body" id="equipPickerBody"></div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  var slotLabels = { mainWeapon: '主武器', shield: '盾牌', armor: '护甲', mount: '坐骑' };
  modal.querySelector('.modal-header h3').textContent = '选择' + (slotLabels[slot] || slot);
  var body = document.getElementById('equipPickerBody');
  body.innerHTML = renderEquipPickerItems(slot, ud);
  modal.classList.add('active');
}

function closeEquipPicker() {
  var modal = document.getElementById('equipPickerModal');
  if (modal) modal.classList.remove('active');
}

function renderEquipPickerItems(slot, unitDef) {
  var inv = GameState.inventory;
  var items = [];
  if (slot === 'mainWeapon') items = inv.weapons.slice();
  else if (slot === 'shield') items = inv.shields ? inv.shields.slice() : [];
  else if (slot === 'armor') items = inv.armors.slice();
  else if (slot === 'mount') items = inv.mounts.slice();

  // 过滤主武器：只显示能主手用的（slot=main 或没有slot属性）
  if (slot === 'mainWeapon') {
    items = items.filter(function(w) { return !w.slot || w.slot === 'main'; });
  }

  if (items.length === 0) {
    return '<div class="inv-empty">背包中没有可用的' + (slot==='mount'?'坐骑':slot==='shield'?'盾牌':'装备') + '<br><span style="font-size:11px;color:#8a6d4b">从兵团卸下装备后会进入背包</span></div>';
  }

  var html = '<div class="inv-grid">';
  items.forEach(function(item) {
    var compatible = isEquipmentCompatible(unitDef, item);
    var detail = buildEqItemDetail(item);
    var appText = (typeof getEquipmentApplicabilityText === 'function') ? getEquipmentApplicabilityText(item) : '';
    var appHtml = appText ? '<div class="equip-applicability">' + appText + '</div>' : '';
    html += '<div class="inv-item ' + (compatible ? '' : 'incompatible') + '" onclick="' + (compatible ? 'doEquip(\'' + item.id + '\')' : '') + '">' +
      '<div class="inv-item-name">' + item.name + '</div>' +
      appHtml +
      '<div class="inv-item-detail">' + detail + '</div>' +
      (compatible ? '' : '<div class="inv-item-badge">不适用</div>') +
      '</div>';
  });
  html += '</div>';
  return html;
}

function buildEqItemDetail(item) {
  var parts = [];
  if (item.baseDamage !== undefined) {
    parts.push('杀伤 ' + item.baseDamage + ' / 破甲 ' + item.armorPierce);
    parts.push('攻击距离 ' + (item.allowedRange || 1) + ' 格');
    if (item.handed) parts.push(item.handed === 'two-handed' ? '双手' : '单手');
  }
  if (item.defense !== undefined && item.category === '盾牌') {
    parts.push('护甲 ' + item.defense);
    parts.push('盾牌');
  } else if (item.defense !== undefined) {
    parts.push('护甲 ' + item.defense);
    if (item.mobilityPenalty < 0) parts.push('机动 ' + item.mobilityPenalty);
    if (item.category) parts.push(item.category);
  }
  if (item.scale !== undefined) {
    parts.push('规模 ' + item.scale);
    parts.push('HP +' + (item.bonusHP || 0));
    parts.push('移动 +' + (item.bonusMove || 0));
  }
  if (item.effects && item.effects.length) {
    parts.push('<span style="color:#8b2500">' + item.effects.join('、') + '</span>');
  }
  return parts.join(' · ');
}

function doEquip(itemId) {
  if (!_currentEquipUnitType || !_currentEquipSlot) return;
  var ud = unitDefByType(_currentEquipUnitType);
  if (!ud) return;
  var result = equipFromInventory(ud, _currentEquipSlot, itemId);
  if (result.success) {
    closeEquipPicker();
    _refreshAll();
  } else if (result.reason) {
    alert(result.reason);
  }
}

// ===== 背包弹窗 =====
function openInventory() {
  var modal = document.getElementById('inventoryModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'inventoryModal';
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal-content inventory-modal">' +
        '<div class="modal-header">' +
          '<h3>🎒 装备背包</h3>' +
          '<button class="modal-close-btn" onclick="closeInventory()">×</button>' +
        '</div>' +
        '<div class="inv-tabs">' +
          '<button class="inv-tab active" data-cat="all" onclick="switchInvTab(this)">全部</button>' +
          '<button class="inv-tab" data-cat="weapons" onclick="switchInvTab(this)">武器</button>' +
          '<button class="inv-tab" data-cat="shields" onclick="switchInvTab(this)">盾牌</button>' +
          '<button class="inv-tab" data-cat="armors" onclick="switchInvTab(this)">护甲</button>' +
          '<button class="inv-tab" data-cat="mounts" onclick="switchInvTab(this)">坐骑</button>' +
        '</div>' +
        '<div class="modal-body" id="inventoryBody"></div>' +
        '<div class="inv-footer"><span id="invCount" style="font-size:12px;color:#8a6d4b"></span></div>' +
      '</div>';
    document.body.appendChild(modal);
  }
  buildInventory('all');
  modal.classList.add('active');
}

function closeInventory() {
  var modal = document.getElementById('inventoryModal');
  if (!modal) return;
  if (window.gsap) {
    var content = modal.firstElementChild;
    modal.classList.add('modal-closing');
    if (content) {
      gsap.to(content, { opacity: 0, scale: 0.9, duration: 0.2, ease: 'power2.in' });
    }
    gsap.to(modal, { opacity: 0, duration: 0.22, ease: 'power2.in' });
    setTimeout(function() {
      modal.classList.remove('active');
      modal.classList.remove('modal-closing');
      if (content) gsap.set(content, { clearProps: 'opacity,scale' });
      gsap.set(modal, { clearProps: 'opacity' });
    }, 220);
  } else {
    modal.classList.remove('active');
  }
}

function switchInvTab(btn) {
  document.querySelectorAll('.inv-tab').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  var body = document.getElementById('inventoryBody');
  // 切换前预隐藏物品（防止闪烁）
  if (window.PageTransitions && body && PageTransitions.prepareStagger) {
    PageTransitions.prepareStagger('.inv-item', body);
  }
  buildInventory(btn.dataset.cat);
  // 新标签内容入场交错动画
  if (window.PageTransitions && body) {
    PageTransitions.staggerItems('.inv-item', body, 0);
  }
}

function buildInventory(cat) {
  var body = document.getElementById('inventoryBody');
  if (!body) return;
  var inv = GameState.inventory;
  var items = [];
  if (!cat || cat === 'all') {
    items = inv.weapons.concat((inv.shields||[]), inv.armors, inv.mounts);
  } else if (cat === 'weapons') {
    items = inv.weapons.slice();
  } else if (cat === 'shields') {
    items = (inv.shields||[]).slice();
  } else if (cat === 'armors') {
    items = inv.armors.slice();
  } else if (cat === 'mounts') {
    items = inv.mounts.slice();
  }

  var countEl = document.getElementById('invCount');
  if (countEl) countEl.textContent = '共 ' + items.length + ' 件装备';

  if (items.length === 0) {
    body.innerHTML = '<div class="inv-empty">背包空空如也<br><span style="font-size:11px;color:#8a6d4b">从兵团卸下装备后会进入背包</span></div>';
    return;
  }

  var html = '<div class="inv-grid">';
  items.forEach(function(item) {
    var typeLabel = '';
    if (item.baseDamage !== undefined) typeLabel = '武器';
    else if (item.defense !== undefined && item.category === '盾牌') typeLabel = '盾牌';
    else if (item.defense !== undefined) typeLabel = '护甲';
    else if (item.scale !== undefined) typeLabel = '坐骑';
    var detail = buildEqItemDetail(item);
    var appText = (typeof getEquipmentApplicabilityText === 'function') ? getEquipmentApplicabilityText(item) : '';
    var appHtml = appText ? '<div class="equip-applicability">' + appText + '</div>' : '';
    var tierName = (typeof getTierName === 'function') ? getTierName(item.tier || 'iron') : '黑铁';
    var tierColor = (typeof getTierColor === 'function') ? getTierColor(item.tier || 'iron') : '#4a4a4a';
    html += '<div class="inv-item">' +
      '<button class="inv-sell-btn" onclick="sellInventoryItem(\'' + item.id + '\', event)" title="售卖">🗑</button>' +
      '<div class="inv-item-type">' + typeLabel + '</div>' +
      '<span class="inv-tier-badge" style="background:' + tierColor + ';color:#fff;font-size:10px;padding:1px 6px;border-radius:3px;margin-right:4px;vertical-align:middle;">' + tierName + '</span>' +
      '<div class="inv-item-name" style="display:inline;">' + item.name + '</div>' +
      appHtml +
      '<div class="inv-item-detail">' + detail + '</div>' +
      '</div>';
  });
  html += '</div>';
  body.innerHTML = html;
  // 背包物品入场交错动画（列表 stagger 0.04s）
  if (window.PageTransitions) {
    PageTransitions.staggerItems('.inv-item', body, 0.04);
  }
}

// ===== 售卖背包装备 =====
function sellInventoryItem(itemId, event) {
  if (event) event.stopPropagation();
  if (!GameState.inventory) return;
  // 从所有装备分类中查找
  var found = null;
  var foundCat = null;
  var cats = ['weapons', 'shields', 'armors', 'mounts'];
  for (var i = 0; i < cats.length; i++) {
    var cat = cats[i];
    var arr = GameState.inventory[cat] || [];
    for (var j = 0; j < arr.length; j++) {
      if (arr[j].id === itemId) {
        found = arr[j];
        foundCat = cat;
        break;
      }
    }
    if (found) break;
  }
  if (!found) {
    if (typeof showToast === 'function') showToast('未找到该装备', 'error');
    return;
  }
  // 计算售卖价格（装备定价的30%折旧）
  var tier = found.tier || 'iron';
  var category = getEquipCategoryForItem(found);
  if (!category) {
    if (typeof showToast === 'function') showToast('该装备不可售卖', 'error');
    return;
  }
  var priceTable = typeof EQUIP_PRICE_TABLE !== 'undefined' ? EQUIP_PRICE_TABLE :
    { iron: { weapon: 50, shield: 40, armor: 60, mount: 80 } };
  var basePrice = (priceTable[tier] && priceTable[tier][category]) || 50;
  var sellRates = { iron: 0.3, bronze: 0.2, gold: 0.15, diamond: 0.1 };
  var sellRate = sellRates[tier] || 0.3;
  var refund = Math.floor(basePrice * sellRate);

  // 找到要移除的卡片元素（用于退场动画）
  var cardEl = event && event.target ? event.target.closest('.inv-item') : null;

  // 实际移除 + 重建逻辑（保持原有行为不变）
  function doRemoveAndRebuild() {
    // 从背包移除
    var arr = GameState.inventory[foundCat];
    var idx = arr.indexOf(found);
    if (idx >= 0) arr.splice(idx, 1);
    // 加分
    GameState.points += refund;
    // 刷新
    if (typeof injectInventoryToED === 'function') injectInventoryToED();
    if (typeof showToast === 'function') showToast('售出 ' + found.name + '，返还 ' + refund + ' 积分', 'info');
    if (typeof EventBus !== 'undefined' && EventBus.emit) {
      EventBus.emit('inventory:changed');
      EventBus.emit('points:changed', { points: GameState.points, delta: refund });
    }
    // 重建当前标签
    var activeTab = document.querySelector('.inv-tab.active');
    var cat = activeTab ? activeTab.dataset.cat : 'all';
    buildInventory(cat);
  }

  // 卡片退场动画：opacity 0, scale 0.8, 0.3s power2.in，完成后再移除+重建
  if (window.gsap && cardEl) {
    gsap.to(cardEl, {
      opacity: 0,
      scale: 0.8,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: doRemoveAndRebuild
    });
  } else {
    doRemoveAndRebuild();
  }
}

// 暴露到全局
window.openInventory = openInventory;
window.closeInventory = closeInventory;
window.openEquipPicker = openEquipPicker;
window.closeEquipPicker = closeEquipPicker;
window.doUnequip = doUnequip;
window.doEquip = doEquip;
window.buildEqSlotInteractive = buildEqSlotInteractive;
window.switchInvTab = switchInvTab;
window.sellInventoryItem = sellInventoryItem;
window._currentEquipUnitType = _currentEquipUnitType;
