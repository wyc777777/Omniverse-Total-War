// AI路径引导：如需查找相关代码路径，请先查阅 AI_PATH_GUIDE.md
// 每新增/修改一个文件后必须同步更新 AI_PATH_GUIDE.md
// ==================== 召唤页面UI（仪式殿堂风格）====================

// 六芒星 SVG（正六边形顶点 → 两个等边三角形）
// 正六边形 r=42, center=(50,50)，6个顶点均布
// V0(顶) V1(右上) V2(右下) V3(底) V4(左下) V5(左上)
// 上三角 = V0,V2,V4    下三角 = V1,V3,V5
function hexagramSVG(size, color, sw) {
  var s = size || 100;
  var c = color || '#c9a227';
  var w = sw || 1.5;
  var r = 42, cx = 50, cy = 50;
  var h = r * 0.8660; // cos30°
  var v0 = cx + ',' + (cy - r);             // (50, 8)
  var v1 = (cx + h) + ',' + (cy - r/2);     // (86.37, 29)
  var v2 = (cx + h) + ',' + (cy + r/2);     // (86.37, 71)
  var v3 = cx + ',' + (cy + r);             // (50, 92)
  var v4 = (cx - h) + ',' + (cy + r/2);     // (13.63, 71)
  var v5 = (cx - h) + ',' + (cy - r/2);     // (13.63, 29)
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
    '<polygon points="' + v0 + ' ' + v2 + ' ' + v4 + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linejoin="round"/>' +
    '<polygon points="' + v1 + ' ' + v3 + ' ' + v5 + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linejoin="round"/>' +
    '<circle cx="50" cy="50" r="2.5" fill="' + c + '"/>' +
    '</svg>';
}

function buildSummonPage() {
  var container = document.getElementById('summonContent');
  if (!container) return;
  container.innerHTML = '';

  // ===== 积分顶栏 =====
  var pointsBar = document.createElement('div');
  pointsBar.className = 'smn-points-bar';
  pointsBar.innerHTML =
    '<div class="smn-points-left">' +
      '<div class="smn-points-icon">' + hexagramSVG(28, '#d4a017', 2) + '</div>' +
      '<div>' +
        '<div class="smn-points-label">我 的 积 分</div>' +
        '<div class="smn-points-value" id="summonPoints">' + getPlayerPoints() + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="smn-points-hint">点击商城赚取积分</div>';
  container.appendChild(pointsBar);

  // ===== 六芒星祭坛 =====
  var altar = document.createElement('div');
  altar.className = 'smn-altar';
  altar.innerHTML =
    '<div class="smn-altar-ring smn-altar-ring-1"></div>' +
    '<div class="smn-altar-ring smn-altar-ring-2"></div>' +
    hexagramSVG(110, '#d4a017', 1.2);
  container.appendChild(altar);

  // ===== 四档召唤卡片（2x2网格）=====
  var tierMeta = [
    { tier: 4, name: '钻石召唤', tag: '钻石', desc: '战力 80~130 · 钻石级兵团 · 满编精锐' },
    { tier: 3, name: '黄金召唤', tag: '黄金', desc: '战力 45~80 · 黄金级兵团 · 攻防兼备' },
    { tier: 2, name: '青铜召唤', tag: '青铜', desc: '战力 20~45 · 青铜级兵团 · 各有所长' },
    { tier: 1, name: '黑铁召唤', tag: '黑铁', desc: '战力 5~20 · 黑铁级兵团 · 数量优势' }
  ];

  var tiersWrap = document.createElement('div');
  tiersWrap.className = 'smn-tiers';

  tierMeta.forEach(function(m) {
    var t = SUMMON_TIERS[m.tier];
    var canAfford = getPlayerPoints() >= t.cost;

    var card = document.createElement('div');
    card.className = 'smn-card';
    card.setAttribute('data-tier', m.tier);
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px)';
    card.innerHTML =
      '<div class="smn-card-head">' +
        '<div class="smn-card-name">' + m.name + '</div>' +
        '<div class="smn-card-tag">' + m.tag + '</div>' +
      '</div>' +
      '<div class="smn-card-desc">' + m.desc + '</div>' +
      '<div class="smn-card-foot">' +
        '<div class="smn-card-price">' + t.cost + '<span>积分</span></div>' +
        '<button class="smn-card-btn ' + (canAfford ? '' : 'disabled') + '" ' +
          (canAfford ? '' : 'disabled ') +
          'onclick="doSummon(' + m.tier + ')">' +
          (canAfford ? '召唤' : '不足') +
        '</button>' +
      '</div>';
    tiersWrap.appendChild(card);
  });

  container.appendChild(tiersWrap);

  // 入场动画
  if (window.gsap) {
    var cards = tiersWrap.querySelectorAll('.smn-card');
    gsap.to(cards, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, delay: 0.2, ease: 'power2.out' });
    var altarEl = container.querySelector('.smn-altar');
    if (altarEl) gsap.fromTo(altarEl, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' });
  }

  // ===== 自定义描述（始终可见）=====
  var customBox = document.createElement('div');
  customBox.className = 'smn-custom';
  customBox.innerHTML =
    '<div class="smn-custom-label">自定义描述</div>' +
    '<input class="smn-custom-input" id="summonCustomInput" placeholder="例：来自魔兽世界的兽人步兵，手持战斧，狂暴战士风格" ' +
      'onkeydown="if(event.key===\'Enter\') doSummon(1)">' +
    '<div class="smn-custom-hint">留空则完全随机生成</div>';
  container.appendChild(customBox);

  // ===== 召唤记录（折叠）=====
  var historyBox = document.createElement('div');
  historyBox.className = 'smn-history';
  var historyItems = '';
  if (GameState._summonHistory && GameState._summonHistory.length > 0) {
    GameState._summonHistory.forEach(function(h) {
      historyItems += '<div class="smn-history-item"><span style="color:#d4a017">-' + h.cost + '</span> ' + escapeHtml(h.name) + ' <span style="opacity:.5;font-size:10px">' + escapeHtml(h.time) + '</span></div>';
    });
  } else {
    historyItems = '<div class="smn-history-empty">暂无记录</div>';
  }
  historyBox.innerHTML =
    '<div class="smn-history-head" onclick="toggleSmnHistory(this)">' +
      '<span>召唤记录</span>' +
      '<span class="smn-history-arrow">▼</span>' +
    '</div>' +
    '<div class="smn-history-body">' + historyItems + '</div>';
  container.appendChild(historyBox);

  // ===== 底部提示 =====
  var tip = document.createElement('div');
  tip.className = 'smn-footer-tip';
  tip.innerHTML = '需先运行 <code>node server.js</code>，AI 生成兵团（名字/装备/背景均由 AI 创作）';
  container.appendChild(tip);
}

// 召唤记录折叠
function toggleSmnHistory(trigger) {
  var body = trigger.nextElementSibling;
  if (trigger.classList.contains('open')) {
    trigger.classList.remove('open');
    body.classList.remove('open');
  } else {
    trigger.classList.add('open');
    body.classList.add('open');
  }
}

// ===== 执行召唤 =====
function doSummon(tier) {
  var customInput = document.getElementById('summonCustomInput');
  var customDesc = customInput ? customInput.value.trim() : '';

  var t = SUMMON_TIERS[tier];
  var btns = document.querySelectorAll('.smn-card-btn');
  btns.forEach(function(b) { b.disabled = true; b.textContent = '...'; });

  var ritualOverlay = createSummonRitual();

  executeSummon(tier, customDesc, function(res) {
    btns.forEach(function(b) { b.disabled = false; b.textContent = '召唤'; });

    if (res.error) {
      if (ritualOverlay) ritualOverlay.remove();
      showToast(res.error, 'error');
      buildSummonPage();
      return;
    }

    var result = res.result;

    if (!GameState._summonHistory) GameState._summonHistory = [];
    GameState._summonHistory.unshift({
      cost: t.cost, name: result.summary.name, type: result.summary.type,
      time: new Date().toLocaleTimeString()
    });
    if (GameState._summonHistory.length > 20) GameState._summonHistory.length = 20;

    saveToBrowser(GameState.saveName);
    showToast('召唤成功 -' + t.cost + '积分 获得 ' + result.summary.name, 'success');

    setTimeout(function() {
      if (ritualOverlay && window.gsap) {
        gsap.to(ritualOverlay, {
          opacity: 0, duration: 0.4,
          onComplete: function() {
            ritualOverlay.remove();
            showSummonModal(result, tier);
            buildSummonPage();
          }
        });
      } else {
        if (ritualOverlay) ritualOverlay.remove();
        showSummonModal(result, tier);
        buildSummonPage();
      }
    }, 1200);
  });
}

// ===== 召唤仪式动画 =====
function createSummonRitual() {
  var overlay = document.createElement('div');
  overlay.className = 'smn-ritual-overlay';
  overlay.innerHTML =
    '<div class="ritual-container">' +
      '<div class="ritual-ring ritual-ring-1"></div>' +
      '<div class="ritual-ring ritual-ring-2"></div>' +
      '<div class="ritual-ring ritual-ring-3"></div>' +
      '<div class="ritual-core"></div>' +
      '<div class="ritual-hex">' + hexagramSVG(120, '#ffd700', 1.5) + '</div>' +
      '<div class="ritual-text">召 唤 中</div>' +
    '</div>';
  document.body.appendChild(overlay);

  if (window.gsap) {
    var tl = gsap.timeline();
    tl.to(overlay, { opacity: 1, duration: 0.4 })
      .fromTo('.ritual-ring-1', { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.2)
      .fromTo('.ritual-ring-2', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 0.7, duration: 0.5, ease: 'power2.out' }, 0.3)
      .fromTo('.ritual-ring-3', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 0.5, duration: 0.5, ease: 'power2.out' }, 0.4)
      .fromTo('.ritual-core', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.5)' }, 0.5)
      .fromTo('.ritual-hex', { scale: 0.5, opacity: 0, rotation: -180 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.6, ease: 'power3.out' }, 0.6)
      .fromTo('.ritual-text', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, 0.8)
      .to('.ritual-ring-1', { rotation: 360, duration: 2, ease: 'none', repeat: -1 }, 0.8)
      .to('.ritual-ring-2', { rotation: -360, duration: 2.5, ease: 'none', repeat: -1 }, 0.8)
      .to('.ritual-ring-3', { rotation: 360, duration: 3, ease: 'none', repeat: -1 }, 0.8)
      .to('.ritual-core', { scale: 1.3, opacity: 0.7, duration: 0.8, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 1)
      .to('.ritual-hex', { rotation: 360, duration: 8, ease: 'none', repeat: -1 }, 0.8);
  }

  return overlay;
}

// ===== 召唤结果弹窗 =====
function showSummonModal(result, tier) {
  var existing = document.getElementById('summonModal');
  if (existing) existing.remove();

  var s = result.summary;
  var t = SUMMON_TIERS[tier] || SUMMON_TIERS[1];

  var overlay = document.createElement('div');
  overlay.id = 'summonModal';
  overlay.className = 'smn-modal-overlay';

  var tierColors = { 4: '#a78bfa', 3: '#ffd700', 2: '#cd7f32', 1: '#888888' };
  var accentColor = tierColors[tier] || '#d4a017';

  var hp = s.hp !== undefined ? s.hp : '--';
  var hpPerUnit = s.hpPerUnit !== undefined ? s.hpPerUnit : '--';
  var armor = s.armor !== undefined ? s.armor : '--';
  var rangedResist = s.rangedResist !== undefined ? s.rangedResist : 0;
  var atk = s.atk !== undefined ? s.atk : '--';
  var ap = s.ap !== undefined ? s.ap : 0;
  var atkRange = s.atkRange !== undefined ? s.atkRange : 1;
  var allowedRange = s.allowedRange !== undefined ? s.allowedRange : 1;
  var move = s.move !== undefined ? s.move : '--';
  var morale = s.morale !== undefined ? s.morale : '--';
  var unitCount = s.unitCount !== undefined ? s.unitCount : '--';
  var power = s.power !== undefined ? s.power : '--';
  var shieldName = s.shieldName || '无';
  var weaponHanded = s.weaponHanded || 'one-handed';
  var handedLabel = weaponHanded === 'two-handed' ? '双手' : '单手';

  overlay.innerHTML =
    '<div class="smn-modal">' +
      '<div class="smn-modal-icon">' + escapeHtml(s.icon) + '</div>' +
      '<div class="smn-modal-name" style="color:' + accentColor + '">' + escapeHtml(s.name) + '</div>' +
      '<div class="smn-modal-meta">' + escapeHtml(s.tierLabel) + ' ' + escapeHtml(s.tierName) + ' · ' + escapeHtml(s.race) + ' · ' + escapeHtml(s.typeName) + '</div>' +
      '<div class="smn-modal-divider"></div>' +
      '<div class="smn-modal-stats">' +
        '<div class="smn-stat"><span class="smn-stat-label">总血量</span><span class="smn-stat-val">' + hp + '</span><span class="smn-stat-sub">单体' + hpPerUnit + ' x ' + unitCount + '</span></div>' +
        '<div class="smn-stat"><span class="smn-stat-label">护甲</span><span class="smn-stat-val">' + armor + '</span><span class="smn-stat-sub">远程免伤' + rangedResist + '%</span></div>' +
        '<div class="smn-stat"><span class="smn-stat-label">攻击</span><span class="smn-stat-val">' + atk + '</span><span class="smn-stat-sub">破甲' + ap + '</span></div>' +
        '<div class="smn-stat"><span class="smn-stat-label">射程</span><span class="smn-stat-val">' + allowedRange + '/' + atkRange + '</span><span class="smn-stat-sub">单次打' + atkRange + '单位</span></div>' +
        '<div class="smn-stat"><span class="smn-stat-label">机动/士气</span><span class="smn-stat-val">' + move + '/' + morale + '</span><span class="smn-stat-sub">规模' + (s.unitScale || '--') + '</span></div>' +
        '<div class="smn-stat"><span class="smn-stat-label">人数/战力</span><span class="smn-stat-val">' + unitCount + '/' + power + '</span><span class="smn-stat-sub">' + (s.tierName || '') + '</span></div>' +
      '</div>' +
      '<div class="smn-modal-equip">' +
        '<b>武器</b> ' + escapeHtml(s.weaponName) + ' (' + handedLabel + ')　' +
        '<b>盾牌</b> ' + escapeHtml(shieldName) + '<br>' +
        '<b>护甲</b> ' + escapeHtml(s.armorName) + '　' +
        '<b>坐骑</b> ' + escapeHtml(s.mountName) +
      '</div>' +
      '<div class="smn-modal-lore">' +
        '<b>背景：</b>' + escapeHtml(s.background) + '<br>' +
        '<b>信念：</b>' + escapeHtml(s.belief) +
      '</div>' +
      '<button class="smn-modal-confirm" onclick="closeSummonModal()">确 认</button>' +
    '</div>';

  document.body.appendChild(overlay);

  if (window.gsap) {
    var modalContent = overlay.querySelector('.smn-modal');
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(modalContent,
      { opacity: 0, scale: 0.7, rotationY: -15 },
      { opacity: 1, scale: 1, rotationY: 0, duration: 0.6, ease: 'back.out(1.4)' }
    );
    setTimeout(function() {
      var stats = modalContent.querySelectorAll('.smn-stat');
      if (stats.length) {
        gsap.fromTo(stats,
          { opacity: 0, y: 20, scale: 0.8 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(1.4)' }
        );
      }
    }, 200);
  }

  if (window.SummonAnimations && SummonAnimations.revealCard) {
    var revealTarget = overlay.querySelector('.smn-modal');
    if (revealTarget) SummonAnimations.revealCard(revealTarget);
  }
}

function closeSummonModal() {
  var modal = document.getElementById('summonModal');
  if (!modal) return;
  if (window.gsap) {
    var content = modal.querySelector('.smn-modal');
    if (content) gsap.to(content, { opacity: 0, scale: 0.9, duration: 0.2, ease: 'power2.in' });
    gsap.to(modal, { opacity: 0, duration: 0.22, ease: 'power2.in' });
    setTimeout(function() { modal.remove(); }, 220);
  } else {
    modal.remove();
  }
}

// ===== 暴露给全局 =====
window.buildSummonPage = buildSummonPage;
window.doSummon = doSummon;
window.closeSummonModal = closeSummonModal;
window.toggleSmnHistory = toggleSmnHistory;
