// AI路径引导：如需查找相关代码路径，请先查阅 AI_PATH_GUIDE.md
// 每新增/修改一个文件后必须同步更新 AI_PATH_GUIDE.md
// ==================== 召唤页面UI ====================

function buildSummonPage() {
  var container = document.getElementById('summonContent');
  if (!container) return;

  container.innerHTML = '';

  // 积分展示
  var pointsBar = document.createElement('div');
  pointsBar.className = 'summon-points-bar';
  pointsBar.innerHTML =
    '<div class="smn-icon smn-portal-icon"><div class="sp-ring sp-ring-1"></div><div class="sp-ring sp-ring-2"></div><div class="sp-core"></div><div class="sp-hex"></div></div>' +
    '<div class="smn-info">' +
      '<div class="smn-label">我的积分</div>' +
      '<div class="smn-value" id="summonPoints">' + getPlayerPoints() + '</div>' +
    '</div>' +
    '<div class="smn-tip">⚠ 需要先运行 <code>node server.js</code>，AI 生成兵团（名字/装备/背景均由 AI 创作）</div>';
  container.appendChild(pointsBar);

  // 玩家自定义描述
  var customRow = document.createElement('div');
  customRow.className = 'summon-custom-row';
  customRow.innerHTML =
    '<span class="sml-label">✨ 自定义描述（可选）：</span>' +
    '<input class="sml-input sml-custom-input" id="summonCustomInput" placeholder="例：来自魔兽世界的兽人步兵，手持战斧，狂暴战士风格" ' +
    'onkeydown="if(event.key===\'Enter\') doSummon(1)">' +
    '<span class="sml-hint">留空则完全随机生成</span>';
  container.appendChild(customRow);

  // 四档召唤（从SUMMON_TIERS读取，避免硬编码价格错误）
  var tierMeta = [
    { tier: 4, name: '💎 钻石召唤', color: TIER_LEVELS.diamond.color },
    { tier: 3, name: '🟡 黄金召唤', color: '#ffd700' },
    { tier: 2, name: '🟤 青铜召唤', color: '#cd7f32' },
    { tier: 1, name: '⚫ 黑铁召唤', color: '#4a4a4a' }
  ];
  var tierDescs = {
    4: '战力 80~130 · 钻石级兵团 · 满编精锐',
    3: '战力 45~80 · 黄金级兵团 · 攻防兼备',
    2: '战力 20~45 · 青铜级兵团 · 各有所长',
    1: '战力 5~20 · 黑铁级兵团 · 数量优势'
  };

  tierMeta.forEach(function(m) {
    var t = SUMMON_TIERS[m.tier];
    var card = document.createElement('div');
    card.className = 'summon-tier-card';
    card.style.borderColor = m.color;
    card.style.background = 'rgba(' + (m.tier === 4 ? '0,200,232' : m.tier === 3 ? '255,215,0' : m.tier === 2 ? '205,127,50' : '74,74,74') + ',0.10)';

    var canAfford = getPlayerPoints() >= t.cost;

    card.innerHTML =
      '<div class="stc-header">' +
        '<div class="stc-name">' + m.name + '</div>' +
        '<div class="stc-desc">' + tierDescs[m.tier] + '</div>' +
      '</div>' +
      '<div class="stc-body">' +
        '<div class="stc-price">💎 ' + t.cost + ' 积分</div>' +
        '<button class="stc-btn ' + (canAfford ? '' : 'disabled') + '" ' + (canAfford ? '' : 'disabled') + ' ' +
          'onclick="doSummon(' + m.tier + ')">' +
          (canAfford ? '召唤！' : '积分不足') +
        '</button>' +
      '</div>';

    container.appendChild(card);
  });

  // 历史记录
  var historyDiv = document.createElement('div');
  historyDiv.className = 'summon-history';
  historyDiv.id = 'summonHistory';
  var historyHtml = '<div class="sh-header">📜 召唤记录</div>';
  if (GameState._summonHistory && GameState._summonHistory.length > 0) {
    GameState._summonHistory.forEach(function(h) {
      historyHtml += '<div class="sh-item"><span style="color:#d4a017">💎-'+h.cost+'</span> ' + escapeHtml(h.name) + ' <span style="color:#8a6d4b;font-size:10px">' + escapeHtml(h.time) + '</span></div>';
    });
  } else {
    historyHtml += '<div class="sh-empty">暂无召唤记录</div>';
  }
  historyDiv.innerHTML = historyHtml;
  container.appendChild(historyDiv);

  // 召唤记录卡片入场交错动画（列表 stagger 0.04s）
  if (window.PageTransitions) {
    PageTransitions.staggerItems('.sh-item', historyDiv, 0.04);
  }
}

// ===== 执行召唤并展示结果 =====
function doSummon(tier) {
  var customInput = document.getElementById('summonCustomInput');
  var customDesc = customInput ? customInput.value.trim() : '';

  var t = SUMMON_TIERS[tier];
  var btns = document.querySelectorAll('.stc-btn');
  btns.forEach(function(b) { b.disabled = true; b.textContent = '召唤中...'; });

  // 显示召唤仪式动画
  var ritualOverlay = createSummonRitual();

  executeSummon(tier, customDesc, function(res) {
    btns.forEach(function(b) { b.disabled = false; b.textContent = '召唤！'; });

    if (res.error) {
      if (ritualOverlay) ritualOverlay.remove();
      showToast(res.error, 'error');
      buildSummonPage();
      return;
    }

    var result = res.result;

    // 记录历史
    if (!GameState._summonHistory) GameState._summonHistory = [];
    GameState._summonHistory.unshift({
      cost: t.cost, name: result.summary.name, type: result.summary.type,
      time: new Date().toLocaleTimeString()
    });
    if (GameState._summonHistory.length > 20) GameState._summonHistory.length = 20;

    saveToBrowser(GameState.saveName);
    showToast('召唤成功！-' + t.cost + '积分 获得 ' + result.summary.name, 'success');

    // 仪式动画完成后显示结果
    setTimeout(function() {
      if (ritualOverlay && window.gsap) {
        gsap.to(ritualOverlay, {
          opacity: 0,
          duration: 0.4,
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

// 创建召唤仪式动画
function createSummonRitual() {
  var overlay = document.createElement('div');
  overlay.id = 'summonRitualOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(20,15,10,0.92);z-index:2000;display:flex;align-items:center;justify-content:center;opacity:0;';
  overlay.innerHTML =
    '<div style="position:relative;width:320px;height:320px;">' +
      '<div id="ritualRing1" style="position:absolute;inset:0;border:3px solid #d4a017;border-radius:50%;opacity:0;box-shadow:0 0 20px rgba(212,160,23,0.5),inset 0 0 20px rgba(212,160,23,0.2);"></div>' +
      '<div id="ritualRing2" style="position:absolute;inset:25px;border:2px solid #c4a060;border-radius:50%;opacity:0;"></div>' +
      '<div id="ritualRing3" style="position:absolute;inset:50px;border:1px solid #b89b6e;border-radius:50%;opacity:0;"></div>' +
      '<div id="ritualCore" style="position:absolute;inset:80px;background:radial-gradient(circle,rgba(212,160,23,0.9),rgba(212,160,23,0.3) 50%,transparent);border-radius:50%;opacity:0;"></div>' +
      '<div id="ritualRune" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;">' +
        '<div class="ritual-hexagram" style="width:80px;height:80px;position:relative;">' +
          '<div style="position:absolute;inset:0;background:linear-gradient(60deg,transparent 42%,#ffd700 42%,#ffd700 58%,transparent 58%),linear-gradient(-60deg,transparent 42%,#ffd700 42%,#ffd700 58%,transparent 58%);clip-path:polygon(50% 0%,100% 100%,0% 100%);filter:drop-shadow(0 0 10px rgba(255,215,0,0.8));"></div>' +
          '<div style="position:absolute;inset:0;background:linear-gradient(60deg,transparent 42%,#ffd700 42%,#ffd700 58%,transparent 58%),linear-gradient(-60deg,transparent 42%,#ffd700 42%,#ffd700 58%,transparent 58%);clip-path:polygon(50% 0%,100% 100%,0% 100%);transform:rotate(180deg);filter:drop-shadow(0 0 10px rgba(255,215,0,0.8));"></div>' +
        '</div>' +
      '</div>' +
      '<div id="ritualText" style="position:absolute;bottom:-40px;left:0;right:0;text-align:center;color:#d4a017;font-size:16px;letter-spacing:6px;opacity:0;font-family:SimSun,serif;">召唤中...</div>' +
    '</div>';
  document.body.appendChild(overlay);

  if (window.gsap) {
    var tl = gsap.timeline();
    tl.to(overlay, { opacity: 1, duration: 0.4 })
      .fromTo('#ritualRing1', { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.2)
      .fromTo('#ritualRing2', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 0.7, duration: 0.5, ease: 'power2.out' }, 0.3)
      .fromTo('#ritualRing3', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 0.5, duration: 0.5, ease: 'power2.out' }, 0.4)
      .fromTo('#ritualCore', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.5)' }, 0.5)
      .fromTo('#ritualRune', { scale: 0.5, opacity: 0, rotation: -180 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.6, ease: 'power3.out' }, 0.6)
      .fromTo('#ritualText', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, 0.8)
      .to('#ritualRing1', { rotation: 360, duration: 2, ease: 'none', repeat: -1 }, 0.8)
      .to('#ritualRing2', { rotation: -360, duration: 2.5, ease: 'none', repeat: -1 }, 0.8)
      .to('#ritualRing3', { rotation: 360, duration: 3, ease: 'none', repeat: -1 }, 0.8)
      .to('#ritualCore', { scale: 1.2, opacity: 0.8, duration: 0.8, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 1)
      .to('#ritualRune', { scale: 1.2, duration: 0.6, ease: 'power2.inOut', yoyo: true, repeat: -1 }, 1);
  }

  return overlay;
}

// ===== 召唤成果弹窗 =====
function showSummonModal(result, tier) {
  var existing = document.getElementById('summonModal');
  if (existing) existing.remove();

  var s = result.summary;
  var t = SUMMON_TIERS[tier] || SUMMON_TIERS[1];

  var modal = document.createElement('div');
  modal.id = 'summonModal';
  modal.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:rgba(20,15,10,0.88);display:flex;' +
    'align-items:center;justify-content:center;z-index:1000;';

  var typeColor = s.type === 'flying' ? '#7b68ee' : (s.type === 'cavalry' ? '#d4a017' : (s.type === 'archer' ? '#4a9c2d' : '#8b4513'));

  // 兜底：所有可能为 undefined 的字段都给默认值
  var hp = s.hp !== undefined ? s.hp : '—';
  var hpPerUnit = s.hpPerUnit !== undefined ? s.hpPerUnit : '—';
  var armor = s.armor !== undefined ? s.armor : '—';
  var rangedResist = s.rangedResist !== undefined ? s.rangedResist : 0;
  var atk = s.atk !== undefined ? s.atk : '—';
  var ap = s.ap !== undefined ? s.ap : 0;
  var atkRange = s.atkRange !== undefined ? s.atkRange : 1;
  var allowedRange = s.allowedRange !== undefined ? s.allowedRange : 1;
  var move = s.move !== undefined ? s.move : '—';
  var morale = s.morale !== undefined ? s.morale : '—';
  var unitScale = s.unitScale !== undefined ? s.unitScale : '—';
  var unitCount = s.unitCount !== undefined ? s.unitCount : '—';
  var power = s.power !== undefined ? s.power : '—';
  // 盾牌名字：优先用 summary 里的
  var shieldName = s.shieldName || '无';
  var weaponHanded = s.weaponHanded || 'one-handed';
  var handedLabel = weaponHanded === 'two-handed' ? '双手' : '单手';

  modal.innerHTML =
    '<div style="' +
      'background:linear-gradient(135deg,#f5ecd7 0%,#e8dcc0 100%);' +
      'border:3px solid ' + typeColor + ';' +
      'border-radius:16px;padding:28px 32px;max-width:520px;width:90%;' +
      'max-height:85vh;overflow-y:auto;' +
      'box-shadow:0 0 60px rgba(0,0,0,0.4);' +
    '">' +

      // 标题
      '<div style="text-align:center;margin-bottom:16px">' +
        '<div style="font-size:48px">' + escapeHtml(s.icon) + '</div>' +
        '<h2 style="font-size:24px;color:' + typeColor + ';margin:6px 0;letter-spacing:4px;font-family:SimSun,serif">' + escapeHtml(s.name) + '</h2>' +
        '<div style="font-size:12px;color:#8a6d4b">' + escapeHtml(s.tierLabel) + ' ' + escapeHtml(s.tierName) + '　·　' + escapeHtml(s.race) + '　·　' + escapeHtml(s.typeName) + '</div>' +
      '</div>' +

      // 分隔线
      '<div style="height:2px;background:linear-gradient(90deg,transparent,' + typeColor + ',transparent);margin:12px 0"></div>' +

      // 属性六宫格
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">' +
        '<div style="background:rgba(139,69,19,0.08);border:1px solid #c4b290;border-radius:8px;padding:10px;text-align:center">' +
          '<div style="font-size:10px;color:#8a6d4b">🩸 总血量</div><div style="font-size:18px;color:#8b2500;font-weight:bold">' + hp + '</div>' +
          '<div style="font-size:9px;color:#8a6d4b">单体' + hpPerUnit + '×' + unitCount + '人</div>' +
        '</div>' +
        '<div style="background:rgba(139,69,19,0.08);border:1px solid #c4b290;border-radius:8px;padding:10px;text-align:center">' +
          '<div style="font-size:10px;color:#8a6d4b">🛡 护甲</div><div style="font-size:18px;color:#8b2500;font-weight:bold">' + armor + '</div>' +
          '<div style="font-size:9px;color:#8a6d4b">远程免伤' + rangedResist + '%</div>' +
        '</div>' +
        '<div style="background:rgba(139,69,19,0.08);border:1px solid #c4b290;border-radius:8px;padding:10px;text-align:center">' +
          '<div style="font-size:10px;color:#8a6d4b">⚔ 攻击</div><div style="font-size:18px;color:#8b2500;font-weight:bold">' + atk + '</div>' +
          '<div style="font-size:9px;color:#8a6d4b">破甲' + ap + '</div>' +
        '</div>' +
        '<div style="background:rgba(139,69,19,0.08);border:1px solid #c4b290;border-radius:8px;padding:10px;text-align:center">' +
          '<div style="font-size:10px;color:#8a6d4b">🎯 范围/攻击距离</div><div style="font-size:18px;color:#8b2500;font-weight:bold">' + atkRange + '/' + allowedRange + '</div>' +
          '<div style="font-size:9px;color:#8a6d4b">单次打' + atkRange + '单位</div>' +
        '</div>' +
        '<div style="background:rgba(139,69,19,0.08);border:1px solid #c4b290;border-radius:8px;padding:10px;text-align:center">' +
          '<div style="font-size:10px;color:#8a6d4b">🏃 机动/士气</div><div style="font-size:18px;color:#8b2500;font-weight:bold">' + move + '格/' + morale + '</div>' +
          '<div style="font-size:9px;color:#8a6d4b">规模' + unitScale + '</div>' +
        '</div>' +
        '<div style="background:rgba(139,69,19,0.08);border:1px solid #c4b290;border-radius:8px;padding:10px;text-align:center">' +
          '<div style="font-size:10px;color:#8a6d4b">👥 人数</div><div style="font-size:18px;color:#8b2500;font-weight:bold">' + unitCount + '</div>' +
          '<div style="font-size:9px;color:#8a6d4b">战力' + power + '</div>' +
        '</div>' +
      '</div>' +

      // 装备一览
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;color:#5a3e20;margin-bottom:12px;padding:10px;background:rgba(0,0,0,0.03);border-radius:8px">' +
        '<div>🗡 主武器：' + escapeHtml(s.weaponName) + ' <span style="color:#8a6d4b">(' + handedLabel + ')</span></div>' +
        '<div>🛡 盾牌：' + escapeHtml(shieldName) + '</div>' +
        '<div>🛡 护甲：' + escapeHtml(s.armorName) + '</div>' +
        '<div>🐴 坐骑：' + escapeHtml(s.mountName) + '</div>' +
        '<div>🧬 种族：' + escapeHtml(s.race) + '</div>' +
      '</div>' +

      // 背景与信念
      '<div style="font-size:11px;color:#5a3e20;line-height:1.7;margin-bottom:12px;padding:10px;background:rgba(0,0,0,0.02);border-radius:8px">' +
        '<p><b>背景：</b>' + escapeHtml(s.background) + '</p>' +
        '<p><b>信念：</b>' + escapeHtml(s.belief) + '</p>' +
      '</div>' +

      // 底部按钮
      '<div style="text-align:center">' +
        '<button onclick="closeSummonModal()" style="' +
          'padding:10px 36px;font-size:15px;border:2px solid ' + typeColor + ';border-radius:8px;' +
          'background:linear-gradient(135deg,#f5ecd7 0%,#e8dcc0 100%);' +
          'color:#3d1a00;cursor:pointer;font-family:SimSun,serif;letter-spacing:2px;' +
        '">确认</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  // 弹窗入场动画
  if (window.gsap) {
    var modalContent = modal.firstElementChild;
    gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(modalContent,
      { opacity: 0, scale: 0.7, rotationY: -15 },
      {
        opacity: 1,
        scale: 1,
        rotationY: 0,
        duration: 0.6,
        ease: 'back.out(1.4)'
      }
    );
    // 属性格子交错入场
    setTimeout(function() {
      var stats = modalContent.querySelectorAll('[style*="grid-template-columns"] > div');
      if (stats.length) {
        gsap.fromTo(stats,
          { opacity: 0, y: 20, scale: 0.8 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.4,
            stagger: 0.08,
            ease: 'back.out(1.4)'
          }
        );
      }
    }, 200);
  }

  // 激活 revealCard 卡牌揭示动画（叠加在入场动画之上：rotationY 90→0, scale 0.5→1, 0.6s back.out(1.4)）
  // 保留上方既有入场动画逻辑不变，revealCard 后调用其数值覆盖呈现卡牌翻转效果
  if (window.SummonAnimations && SummonAnimations.revealCard) {
    var revealTarget = modal.firstElementChild;
    if (revealTarget) SummonAnimations.revealCard(revealTarget);
  }
}

function closeSummonModal() {
  var modal = document.getElementById('summonModal');
  if (!modal) return;
  if (window.gsap) {
    var content = modal.firstElementChild;
    modal.classList.add('modal-closing');
    if (content) {
      gsap.to(content, { opacity: 0, scale: 0.9, duration: 0.2, ease: 'power2.in' });
    }
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
