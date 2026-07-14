// AI路径引导：如需查找其他文件路径和功能说明，请先查看项目根目录的 AI_PATH_GUIDE.md；每新增/修改一个文件后，必须同步更新AI_PATH_GUIDE.md
// ==================== 页面流程控制器 ====================
var currentPage = '';

// ====== 页面配置注册到 PanelManager ======
function initPagePanels() {
  if (!window.PanelManager) return;

  var pageConfigs = {
    Menu: {
      elementId: 'pageMenu',
      buildFn: function() { showMenuScreen(); },
      contentSelector: '.menu-btn, .save-item, .big-title, .big-sub, .name-input',
      entranceDelay: 0.03,
      entranceFn: function() {
        if (window.PageTransitions) {
          PageTransitions.staggerItems('.menu-btn, .save-item, .big-title, .big-sub, .name-input', null, 0.03);
        }
      }
    },
    Prep: {
      elementId: 'pagePrep',
      buildFn: function() { refreshPrepPage(); },
      contentSelector: '.prep-card, .prep-points',
      entranceDelay: 0.05,
      entranceFn: function() {
        if (window.PageTransitions) {
          PageTransitions.staggerItems('.prep-card', null, 0.05);
          PageTransitions.slideIn('.prep-points', 'down');
        }
      }
    },
    Barracks: {
      elementId: 'pageBarracks',
      buildFn: function() { if (typeof buildBarracks === 'function') buildBarracks(); },
      contentSelector: '.barracks-item',
      entranceDelay: 0.03,
      entranceFn: function() {
        if (window.PageTransitions) {
          PageTransitions.staggerItems('.barracks-item', null, 0.03);
        }
      }
    },
    Select: {
      elementId: 'pageSelect',
      buildFn: function() { if (typeof buildUnitSelect === 'function') buildUnitSelect(); },
      contentSelector: '.select-card',
      entranceDelay: 0.04,
      entranceFn: function() {
        if (window.PageTransitions) {
          PageTransitions.staggerItems('.select-card', null, 0.04);
        }
      }
    },
    Battle: {
      elementId: 'pageBattle',
      buildFn: function() { startBattlePage(); },
      contentSelector: '',
      entranceDelay: 0,
      entranceFn: function() {}
    },
    Shop: {
      elementId: 'pageShop',
      buildFn: function() { if (typeof buildShop === 'function') buildShop(); },
      contentSelector: '.shop-card',
      entranceDelay: 0.04,
      entranceFn: function() {
        if (window.PageTransitions) {
          PageTransitions.staggerItems('.shop-card', null, 0.04);
        }
      }
    },
    Summon: {
      elementId: 'pageSummon',
      buildFn: function() { if (typeof buildSummonPage === 'function') buildSummonPage(); },
      contentSelector: '.summon-tier-card',
      entranceDelay: 0.05,
      entranceFn: function() {
        if (window.PageTransitions) {
          PageTransitions.staggerItems('.summon-tier-card', null, 0.05);
        }
      }
    },
    AIBattle: {
      elementId: 'pageAIBattle',
      buildFn: function() { if (typeof buildAIBattlePage === 'function') buildAIBattlePage(); },
      contentSelector: '.ai-btn, .ai-opponent-card, .ai-empty-hint',
      entranceDelay: 0.04,
      entranceFn: function() {
        if (window.PageTransitions) {
          PageTransitions.staggerItems('.ai-btn, .ai-opponent-card, .ai-empty-hint', null, 0.04);
        }
      }
    },
    DuelArena: {
      elementId: 'pageDuelArena',
      buildFn: function() { if (typeof buildDuelArenaPage === 'function') buildDuelArenaPage(); },
      contentSelector: '.duel-side, .duel-vs, .duel-actions',
      entranceDelay: 0.04,
      entranceFn: function() {
        if (window.PageTransitions) {
          PageTransitions.staggerItems('.duel-side, .duel-vs, .duel-actions', null, 0.04);
        }
      }
    },
    Levels: {
      elementId: 'pageLevels',
      buildFn: function() { if (typeof buildLevelsPage === 'function') buildLevelsPage(); },
      contentSelector: '.level-card, .levels-overview',
      entranceDelay: 0.04,
      entranceFn: function() {
        if (window.PageTransitions) {
          PageTransitions.staggerItems('.level-card', null, 0.04);
        }
      }
    }
  };

  Object.keys(pageConfigs).forEach(function(name) {
    var cfg = pageConfigs[name];
    PanelManager.register(name, {
      buildFn: cfg.buildFn,
      elementId: cfg.elementId,
      contentSelector: cfg.contentSelector,
      entranceDelay: cfg.entranceDelay,
      entranceFn: cfg.entranceFn,
      autoBuild: false
    });
  });
}

// ====== 应用页面壁纸（过渡前调用，确保过渡期间壁纸稳定） ======
function applyPageWallpaper(name) {
  if (name === 'Prep' && window.GameSettings) {
    GameSettings.applyWallpaperAuto();
  } else if (name === 'Menu' || name === 'Battle') {
    document.body.classList.remove('body-wallpaper');
    var wpLayer = document.getElementById('wallpaper-layer');
    if (wpLayer) {
      wpLayer.style.backgroundImage = '';
      wpLayer.style.backgroundSize = '';
      wpLayer.style.backgroundPosition = '';
      wpLayer.style.backgroundRepeat = '';
    }
    var prepPage = document.getElementById('pagePrep');
    if (prepPage) prepPage.classList.remove('has-wallpaper');
  }
}

// ====== 更新页面状态（动画结束后） ======
function updatePageState(name) {
  currentPage = name;
  var topBar = document.getElementById('topBar');
  if (topBar) topBar.style.display = (name === 'Menu') ? 'none' : 'flex';
  var tag = document.getElementById('saveTag');
  if (tag) tag.innerHTML = GameState.saveName ? '<svg class="tb-icon"><use href="#icon-inventory"/></svg> ' + GameState.saveName : '<svg class="tb-icon"><use href="#icon-inventory"/></svg> 保存';

  var prepInvBadge = document.getElementById('prepInvBadge');
  if (prepInvBadge) {
    var invCount = typeof getInventoryCount === 'function' ? getInventoryCount() : 0;
    var oldInvCount = parseInt(prepInvBadge.textContent, 10);
    if (isNaN(oldInvCount)) oldInvCount = invCount;
    prepInvBadge.style.display = invCount > 0 ? 'inline-flex' : 'none';
    // 数量变化时：数字滚动 + 弹跳反馈（scale 1.3 → 1, 0.3s back.out）
    if (invCount !== oldInvCount) {
      if (typeof animateNumber === 'function') {
        animateNumber(prepInvBadge, oldInvCount, invCount, 0.3);
      } else {
        prepInvBadge.textContent = invCount;
      }
      if (window.gsap) {
        gsap.fromTo(prepInvBadge, { scale: 1.3 }, { scale: 1, duration: 0.3, ease: 'back.out(1.4)' });
      }
    } else {
      prepInvBadge.textContent = invCount;
    }
  }

  if (name === 'Menu' && window.ParticleBG) {
    ParticleBG.start();
  } else if (window.ParticleBG) {
    ParticleBG.stop();
  }
}

var _showPageTimer = null;
var _lastPendingPage = null;
var _lastPendingData = null;
var _enteredPages = {};  // 记录已首次进入的页面，避免重复播放入场动画

function showPage(name, data) {
  // 防抖：快速连续点卡片只处理最后一次
  if (_showPageTimer) {
    _lastPendingPage = name;
    _lastPendingData = data;
    return;
  }

  _doShowPage(name, data);
}

function _doShowPage(name, data) {
  var oldEl = document.getElementById('page' + currentPage);
  var newEl = document.getElementById('page' + name);

  var panelConfig = null;
  if (window.PanelManager && PanelManager.has(name)) {
    panelConfig = PanelManager.getConfig(name);
  }

  function buildContent() {
    try {
      if (panelConfig && typeof panelConfig.buildFn === 'function') {
        panelConfig.buildFn(data);
      } else {
        if (name === 'Menu') showMenuScreen();
        else if (name === 'Prep') refreshPrepPage();
        else if (name === 'Barracks') { if (typeof buildBarracks === 'function') buildBarracks(); }
        else if (name === 'Select') { if (typeof buildUnitSelect === 'function') buildUnitSelect(); }
        else if (name === 'Battle') { startBattlePage(); }
        else if (name === 'Shop') { if (typeof buildShop === 'function') buildShop(); }
        else if (name === 'Summon') { if (typeof buildSummonPage === 'function') buildSummonPage(); }
        else if (name === 'AIBattle') { if (typeof buildAIBattlePage === 'function') buildAIBattlePage(); }
        else if (name === 'DuelArena') { if (typeof buildDuelArenaPage === 'function') buildDuelArenaPage(); }
        else if (name === 'Levels') { if (typeof buildLevelsPage === 'function') buildLevelsPage(); }
      }
    } catch(e) {
      console.warn('[showPage] buildContent error for', name, e);
    }
  }

  function playEntrance() {
    if (panelConfig && typeof panelConfig.entranceFn === 'function') {
      panelConfig.entranceFn();
    } else {
      if (!window.gsap || !window.PageTransitions) return;
      if (name === 'Menu') {
        PageTransitions.staggerItems('.menu-btn, .save-item, .big-title, .big-sub, .name-input', null, 0.03);
      } else if (name === 'Prep') {
        PageTransitions.staggerItems('.prep-card', null, 0.05);
        PageTransitions.slideIn('.prep-points', 'down');
      } else if (name === 'Barracks') {
        PageTransitions.staggerItems('.barracks-item', null, 0.03);
      } else if (name === 'Select') {
        PageTransitions.staggerItems('.select-card', null, 0.04);
      } else if (name === 'Shop') {
        PageTransitions.staggerItems('.shop-card', null, 0.04);
      } else if (name === 'Summon') {
        PageTransitions.staggerItems('.summon-tier-card', null, 0.05);
      } else if (name === 'AIBattle') {
        PageTransitions.staggerItems('.ai-btn, .ai-opponent-card, .ai-empty-hint', null, 0.04);
      } else if (name === 'DuelArena') {
        PageTransitions.staggerItems('.duel-side, .duel-vs, .duel-actions', null, 0.04);
      } else if (name === 'Levels') {
        PageTransitions.staggerItems('.level-card', null, 0.04);
      }
    }
  }

  function getContentSelectors() {
    if (panelConfig && panelConfig.contentSelector) {
      return panelConfig.contentSelector;
    }
    if (name === 'Menu') return '.menu-btn, .save-item, .big-title, .big-sub, .name-input';
    else if (name === 'Prep') return '.prep-card, .prep-points';
    else if (name === 'Barracks') return '.barracks-item';
    else if (name === 'Select') return '.select-card';
    else if (name === 'Shop') return '.shop-card';
    else if (name === 'Summon') return '.summon-tier-card';
    else if (name === 'AIBattle') return '.ai-btn, .ai-opponent-card, .ai-empty-hint';
    else if (name === 'DuelArena') return '.duel-side, .duel-vs, .duel-actions';
    else if (name === 'Levels') return '.level-card, .levels-overview';
    return '';
  }

  function updateState() {
    updatePageState(name);
    syncPanelManagerState(name, data);
  }

  // 进入任何页面时，先阻止 buildContent 内的 stagger 动画
  //（因为 buildShop 等函数内部会调用 staggerItems，导致卡片跳动）
  if (window.PageTransitions && window.PageTransitions.setSkipStagger) {
    window.PageTransitions.setSkipStagger(true);
  }

  // 防御性措施：确保只有新页面显示，其他所有页面都隐藏
  var allPages = document.querySelectorAll('.page');
  allPages.forEach(function(p) {
    if (p !== newEl) {
      p.classList.remove('active');
    }
  });

  if (window.PageTransitions && oldEl && newEl && currentPage && window.gsap) {
    var prepPage = document.getElementById('pagePrep');
    if (prepPage) prepPage.classList.remove('no-gsap');
    buildContent();
    applyPageWallpaper(name);
    var _reflow = newEl.offsetHeight;

    var contentSelectors = getContentSelectors();
    if (contentSelectors && !_enteredPages[name]) {
      var items = newEl.querySelectorAll(contentSelectors);
      if (items.length) gsap.set(items, { opacity: 0, y: 12 });
    }

    PageTransitions.pageTransition(oldEl, newEl, {
      onVisible: function() {},
      onComplete: function() {
        // 再次确保只有新页面显示（防御性）
        var allPages2 = document.querySelectorAll('.page');
        allPages2.forEach(function(p) {
          p.classList.toggle('active', p === newEl);
        });

        // 首次进入：播放 stagger 入场动画
        if (!_enteredPages[name]) {
          _enteredPages[name] = true;
          // 重置 skipStagger，让 playEntrance 中的 staggerItems 正常执行
          if (window.PageTransitions && window.PageTransitions.setSkipStagger) {
            window.PageTransitions.setSkipStagger(false);
          }
          playEntrance();
        } else {
          // 再次进入：保持 skipStagger=true，不做任何动画
          if (window.PageTransitions && window.PageTransitions.setSkipStagger) {
            window.PageTransitions.setSkipStagger(false);
          }
        }
        updateState();
        startShowPageCooldown(name);
      }
    });
  } else {
    var prepPage = document.getElementById('pagePrep');
    if (prepPage && !window.gsap) prepPage.classList.add('no-gsap');
    if (newEl) newEl.classList.add('active');
    buildContent();
    applyPageWallpaper(name);
    _enteredPages[name] = true;
    // 重置跳过标志
    if (window.PageTransitions && window.PageTransitions.setSkipStagger) {
      window.PageTransitions.setSkipStagger(false);
    }
    updateState();
    startShowPageCooldown(name);
  }
}

function startShowPageCooldown(currentName) {
  _showPageTimer = setTimeout(function() {
    _showPageTimer = null;
    if (_lastPendingPage && _lastPendingPage !== currentName) {
      var pendingName = _lastPendingPage;
      var pendingData = _lastPendingData;
      _lastPendingPage = null;
      _lastPendingData = null;
      _doShowPage(pendingName, pendingData);
    } else {
      _lastPendingPage = null;
      _lastPendingData = null;
    }
  }, 200);
}

function syncPanelManagerState(name, data) {
  if (!window.PanelManager || !PanelManager.has(name)) return;
  var activeId = PanelManager.getActive();
  if (activeId && activeId !== name) {
    PanelManager._addToHistory(activeId);
    PanelManager._setVisible(activeId, false);
    PanelManager._emitHide(activeId);
  }
  PanelManager._setActive(name);
  PanelManager._setVisible(name, true);
  PanelManager._setLastData(name, data);
  PanelManager._setBuilt(name, true);
  PanelManager._emitShow(name, data);
}

function goBack() {
  // 战斗页面：必须走 exitBattle 完整清理流程，避免战场状态残留
  if (currentPage === 'Battle') {
    exitBattle();
    return;
  }
  // 斗蛐蛐配置页面：返回时清理已生成的临时单位
  if (currentPage === 'DuelArena') {
    if (typeof DUEL_STATE !== 'undefined') {
      if (DUEL_STATE.sideA && typeof clearAIOpponentUnitsForDuelSide === 'function') {
        clearAIOpponentUnitsForDuelSide('A');
      }
      if (DUEL_STATE.sideB && typeof clearAIOpponentUnitsForDuelSide === 'function') {
        clearAIOpponentUnitsForDuelSide('B');
      }
    }
    showPage('Prep');
    return;
  }
  if (window.PanelManager) {
    // 跳过历史栈中的 Battle、Select（战斗流程临时页面）和当前页面本身
    // 这些页面在结算后不应作为返回目标，避免用户需要多次点击返回
    var prevId = PanelManager._popHistory();
    while (prevId === 'Battle' || prevId === 'Select' || prevId === currentPage) {
      prevId = PanelManager._popHistory();
    }
    if (prevId && PanelManager.has(prevId)) {
      showPage(prevId);
      return;
    }
  }
  if (currentPage === 'Barracks' || currentPage === 'Shop' || currentPage === 'Summon' || currentPage === 'Levels' || currentPage === 'AIBattle') showPage('Prep');
  else if (currentPage === 'Select') showPage('Prep');
}

// 刷新准备页面数据
function refreshPrepPage() {
  var countEl = document.getElementById('prepUnitCount');
  if (countEl) countEl.textContent = GameState.playerUnits.length + ' 支部队';
  // 更新积分显示（数字滚动动画：0.5s power2.out）
  var pointsEl = document.getElementById('prepPointsDisplay');
  if (pointsEl) {
    var newVal = GameState.points || 0;
    var oldVal = parseInt(pointsEl.textContent, 10);
    if (isNaN(oldVal)) oldVal = newVal;
    if (typeof animateNumber === 'function') {
      animateNumber(pointsEl, oldVal, newVal, 0.5);
    } else {
      pointsEl.textContent = newVal;
    }
  }
}

// ===== 主菜单 =====
var _menuSavesRefreshed = false;
function showMenuScreen() {
  var wrap = document.getElementById('menuContent');
  _menuSavesRefreshed = false;

  // 先显示缓存/本地存档
  var saves = getAllSavesSync();
  renderMenuScreen(wrap, saves);

  window._onSavesUpdated = function(updated) {
    if (_menuSavesRefreshed) return;
    _menuSavesRefreshed = true;
    renderMenuScreen(wrap, updated);
  };
  // 触发异步拉取服务器存档（完成后回调 _onSavesUpdated）
  getAllSaves();
}

function renderMenuScreen(wrap, saves) {
  var saveNames = Object.keys(saves);
  wrap.innerHTML = '';

  if (saveNames.length > 0) {
    wrap.innerHTML += '<div class="big-title">万界全面战争</div>';
    wrap.innerHTML += '<div class="big-sub">—— 六边棋盘 · 兵团推演 ——</div>';
    wrap.innerHTML += '<button class="menu-btn" onclick="showNewGame()">开始新游戏</button>';
    wrap.innerHTML += '<div style="font-size:14px;color:#c4a97d;text-align:center;margin:10px 0;text-shadow:0 1px 4px rgba(0,0,0,0.6)">—— 或读取存档 ——</div>';
    wrap.innerHTML += '<div class="save-list" id="saveList"></div>';
    var list = document.getElementById('saveList');
    saveNames.forEach(function(name) {
      var s = saves[name];
      var safeName = window.escText ? window.escText(name) : name;
      var safeTime = window.escText ? window.escText(s.timestamp||'未知时间') : (s.timestamp||'未知时间');
      var div = document.createElement('div'); div.className = 'save-item';
      div.innerHTML = '<div><span class="sname">' + safeName + '</span><br><span class="stime">' + safeTime + ' · ' + (s.playerUnits?s.playerUnits.length:0) + '支部队 · ' + (s.points||0) + '积分</span></div><span class="del-btn" data-savename="' + safeName + '">删除</span>';
      var delBtn = div.querySelector('.del-btn');
      if (delBtn) {
        delBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          deleteSave(name);
          showMenuScreen();
        });
      }
      div.addEventListener('click', function() {
        loadFromBrowser(name, function(ok) {
          if (!ok) { showToast('存档加载失败', 'error'); return; }
          if (GameState._shadowAndSunUsed && typeof createSponsorUnits === 'function') createSponsorUnits();
          showPage('Prep');
        });
      });
      list.appendChild(div);
    });
  } else {
    showNewGame();
  }
}

function showNewGame() {
  var wrap = document.getElementById('menuContent');
  wrap.innerHTML = '';
  wrap.innerHTML += '<div class="big-title">万界全面战争</div>';
  wrap.innerHTML += '<div class="big-sub">—— 六边棋盘 · 兵团推演 ——</div>';
  wrap.innerHTML += '<input class="name-input" id="saveNameInput" placeholder="请输入存档名称..." value="战报一">';
  wrap.innerHTML += '<button class="menu-btn" onclick="startNewGame()">开始新游戏</button>';
  var saves = getAllSaves();
  if (Object.keys(saves).length > 0) {
    wrap.innerHTML += '<button class="menu-btn small" onclick="showMenuScreen()">返回主菜单</button>';
  }
}

function startNewGame() {
  var input = document.getElementById('saveNameInput');
  var name = (input && input.value.trim()) ? input.value.trim() : '战报一';
  initNewGame(name);
  showPage('Prep');
}

// ===== 开始对战 =====
function confirmBattle() {
  var allCards = document.querySelectorAll('#selectWrap .select-card');
  selectedUnitTypes = [];
  allCards.forEach(function(card) {
    if (card.classList.contains('selected')) {
      var idx = parseInt(card.dataset.idx);
      if (!isNaN(idx) && GameState.playerUnits[idx]) {
        selectedUnitTypes.push(GameState.playerUnits[idx].type);
      }
    }
  });

  if (selectedUnitTypes.length === 0) { showToast('请至少选择 1 支部队', 'warning'); return; }
  if (selectedUnitTypes.length > 6) { showToast('最多选择 6 支部队', 'warning'); return; }

  var enemyFinal = [];

  // 关卡战斗分支：使用关卡配置的敌方units
  if (window._currentLevelOpponent && window._currentLevelOpponent.enemyUnits && window._currentLevelOpponent.enemyUnits.length) {
    enemyFinal = window._currentLevelOpponent.enemyUnits.map(function(u) { return u.type; });
    if (typeof TurnState !== 'undefined') {
      TurnState.isLevelBattle = true;
    }
  }
  // AI对战分支：使用 AI 对手 units
  else if (window._aiBattleOpponent && window._aiBattleOpponent.units && window._aiBattleOpponent.units.length) {
    enemyFinal = window._aiBattleOpponent.units.map(function(u) { return u.type; });
    if (typeof TurnState !== 'undefined') {
      TurnState.isAIBattle = true;
      TurnState.aiOpponent = window._aiBattleOpponent;
    }
  }

  if (enemyFinal.length === 0) {
    showToast('未找到敌方部队配置', 'error');
    return;
  }

  BT = {
    player: selectedUnitTypes.slice(),
    enemy: enemyFinal
  };

  showPage('Battle');
}

// 从对战返回准备
function exitBattle() {
  Object.keys(placedPieces).forEach(function(k) {
    returnToBench(placedPieces[k].slotIdx); delete placedPieces[k];
  });
  if (typeof stopAnimLoop === 'function') stopAnimLoop();
  selectedPieceKey = null;
  initTurns();
  interactionInited = false;

  // 确保数据已保存（防止部队丢失）
  if (typeof saveToBrowser === 'function' && GameState.saveName) {
    saveToBrowser(GameState.saveName);
  }

  // 隐藏幕布（不需要恢复，因为已经退出战斗了）
  var curtain = document.getElementById('battleCurtain');
  if (curtain) {
    curtain.style.opacity = '0';
    curtain.style.display = 'none';
  }

  // 清除AI对战残留的临时单位、种族、装备
  if (typeof clearAIOpponentUnits === 'function') {
    clearAIOpponentUnits([]);
  }

  // 清除斗蛐蛐对战残留：双方临时单位、TurnState 标记
  if (window._duelBattleData) {
    var duelKeepIds = [];
    if (typeof DUEL_STATE !== 'undefined') {
      DUEL_STATE.sideA = null;
      DUEL_STATE.sideB = null;
      DUEL_STATE.bothGenerated = false;
    }
    window._duelBattleData = null;
  }

  // 重置记分板数据（使用 ScoreboardService 解耦）
  if (typeof ScoreboardService !== 'undefined') {
    // 直接重置数据，不触发 UI 更新（此时可能不在战斗页面）
    var _sb = ScoreboardService.getStats();
    _sb.damage.player = 0; _sb.damage.enemy = 0;
    _sb.kills.player = 0; _sb.kills.enemy = 0;
    _sb.routedArchive = [];
  }

  // 重置所有对战类型标记（使用 TurnStateAPI 解耦，防止状态泄露）
  if (typeof TurnStateAPI !== 'undefined') {
    TurnStateAPI.setDuelBattle(false);
    TurnStateAPI.setSideControlled('player', false);
    TurnStateAPI.setSideControlled('enemy', false);
    // isLevelBattle 和 isAIBattle 是 AI 对战专用属性，TurnStateAPI 未覆盖
    if (typeof TurnState !== 'undefined') {
      TurnState.isLevelBattle = false;
      TurnState.isAIBattle = false;
    }
  }

  // 清除关卡/AI对战运行时状态（防止结算时 else-if 兜底误判对战类型）
  if (typeof LEVEL_BATTLE_STATE !== 'undefined') {
    LEVEL_BATTLE_STATE.currentLevelOpponent = null;
    window._currentLevelId = null;
    window._currentLevelOpponent = null;
  }
  if (typeof AI_BATTLE_STATE !== 'undefined') {
    AI_BATTLE_STATE.currentOpponent = null;
  }

  // 清空作战日志、恢复备战席显示（须在 TurnState 标记重置之后）
  if (typeof clearCombatLog === 'function') clearCombatLog();
  if (typeof updateScoreboardUI === 'function') updateScoreboardUI();

  // 清空历史栈（退出战斗后不需要保留 Battle/Select/DuelArena 等临时页面的历史，避免返回时多次点击）
  if (window.PanelManager && typeof PanelManager._clearHistory === 'function') {
    PanelManager._clearHistory();
  }

  // 统一走 showPage 逻辑，确保动画一致
  showPage('Prep');
}

// ===== 初始化 =====
function init() {
  initPagePanels();

  Promise.all([
    fetch('assets/data/race_config.json?t=' + Date.now()).then(function(r){return r.json()}),
    fetch('assets/data/equipment_config.json?t=' + Date.now()).then(function(r){return r.json()}),
    fetch('assets/data/unit_config.json?t=' + Date.now()).then(function(r){return r.json()}),
    fetch('assets/data/difficulty_config.json?t=' + Date.now()).then(function(r){return r.json()}),
    fetch('assets/data/level_config.json?t=' + Date.now()).then(function(r){return r.json()}).catch(function(){ return { levels: [] }; })
  ]).then(function(result) {
    RD = result[0]; ED = result[1]; UD = result[2];
    window.DC = result[3];
    window.LC = result[4] || { levels: [] };
    showPage('Menu');
  }).catch(function() {
    // Fallback：使用 js/fallback-data.js 中的硬编码数据
    RD = FALLBACK_DATA.RD;
    ED = FALLBACK_DATA.ED;
    UD = FALLBACK_DATA.UD;
    window.DC = FALLBACK_DATA.DC;
    window.LC = FALLBACK_DATA.LC;
    showPage('Menu');
  });

  // 预检服务器可用性（让首次保存就能写文件）
  if (typeof checkServerAvailable === 'function') { checkServerAvailable(function(){}); }

  // 页面关闭前自动保存（防止直接关网页丢档）
  window.addEventListener('beforeunload', function() {
    if (GameState.saveName && typeof saveToBrowserSync === 'function') {
      saveToBrowserSync(GameState.saveName);
    }
  });
  // 页面失焦时也触发一次保存（更保险）
  window.addEventListener('blur', function() {
    if (GameState.saveName && typeof saveToBrowser === 'function') {
      saveToBrowser(GameState.saveName);
    }
  });
}

// 进入战斗时初始化棋盘
function startBattlePage() {
  interactionInited = false;
  initTurns();
  var curtain = document.getElementById('battleCurtain');
  if (curtain) {
    curtain.style.display = 'flex';
    curtain.style.opacity = '1';
    if (curtain.children) {
      for (var i = 0; i < curtain.children.length; i++) {
        curtain.children[i].style.opacity = '1';
        curtain.children[i].style.transform = 'scale(1)';
      }
    }
  }
  preloadImages(function() {
    if (!ensureCtx()) return;
    initBench();
    initInteractions();
    render();
    if (typeof startAnimLoop === 'function') startAnimLoop();
    // 动作一：棋盘入场序列（战雾 + 逐圈显现 + 棋子落入）
    if (typeof startBoardEntryAnim === 'function') startBoardEntryAnim();
  });
}

// 暴露给 onclick
window.showPage = showPage;
window.showNewGame = showNewGame;
window.startNewGame = startNewGame;
window.showMenuScreen = showMenuScreen;
window.endTurn = endTurn;
window.executeCombat = executeCombat;
window.updateDeployUI = updateDeployUI;
window.startBattlePhase = startBattlePhase;

// ===== 作弊码 =====
window.showCheatInput = function() {
  var existing = document.getElementById('cheatModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'cheatModal';
  modal.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:rgba(20,15,10,0.8);display:flex;' +
    'align-items:center;justify-content:center;z-index:2000;';

  modal.innerHTML =
    '<div style="background:linear-gradient(135deg,#f5ecd7 0%,#e8dcc0 100%);' +
      'border:2px solid #8b4513;border-radius:12px;padding:24px 28px;' +
      'max-width:360px;width:90%;text-align:center;' +
      'box-shadow:0 0 40px rgba(0,0,0,0.5);">' +
      '<div style="font-size:32px;margin-bottom:8px">🎮</div>' +
      '<h3 style="color:#3d1a00;margin:0 0 12px;font-family:SimSun,serif;letter-spacing:2px">作弊码</h3>' +
      '<input id="cheatCodeInput" type="password" placeholder="输入作弊码..." ' +
        'style="width:90%;padding:10px 12px;font-size:14px;border:1px solid #c4b290;' +
        'border-radius:6px;background:#fff;color:#3d1a00;margin-bottom:12px;box-sizing:border-box;" ' +
        'onkeydown="if(event.key===\'Enter\') submitCheat()">' +
      '<div>' +
        '<button onclick="submitCheat()" style="padding:8px 24px;margin:0 6px;border:1px solid #8b4513;' +
          'border-radius:6px;background:#8b4513;color:#f5ecd7;cursor:pointer;font-family:SimSun,serif;">确认</button>' +
        '<button onclick="closeCheatModal()" style="padding:8px 24px;margin:0 6px;border:1px solid #8a6d4b;' +
          'border-radius:6px;background:transparent;color:#5a3e20;cursor:pointer;font-family:SimSun,serif;">取消</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  setTimeout(function() {
    var input = document.getElementById('cheatCodeInput');
    if (input) input.focus();
  }, 50);
};

window.closeCheatModal = function() {
  var modal = document.getElementById('cheatModal');
  if (modal) modal.remove();
};

window.submitCheat = function() {
  var input = document.getElementById('cheatCodeInput');
  if (!input) return;
  var code = input.value.trim();

  var _ = [107,101,119,117,107,101,119,117];
  if (code === String.fromCharCode.apply(null, _)) {
    if (GameState._cheatKWUsed) {
      if (typeof showToast === 'function') showToast('该作弊码本存档已使用过', 'warning');
      closeCheatModal();
      return;
    }
    GameState.points += 5000;
    GameState._cheatKWUsed = true;
    saveToBrowser(GameState.saveName);
    if (typeof refreshPrepPage === 'function') refreshPrepPage();
    if (typeof buildSummonPage === 'function' && currentPage === 'Summon') buildSummonPage();
    if (typeof showToast === 'function') showToast('🎮 作弊成功！+5000 积分', 'success');
    closeCheatModal();
  } else if (code === String.fromCharCode.apply(null, [121,105,110,103,121,117,121,97,110,103])) {
    if (GameState._shadowAndSunUsed) {
      if (typeof showToast === 'function') showToast('该作弊码本存档已使用过', 'warning');
      closeCheatModal();
      return;
    }
    if (typeof createSponsorUnits === 'function') createSponsorUnits();
    GameState.points += 10000;
    GameState.playerUnits.push({ type: 'taiyin_rider', _sponsorUnit: true });
    GameState.playerUnits.push({ type: 'sun_rider', _sponsorUnit: true });
    GameState._shadowAndSunUsed = true;
    saveToBrowser(GameState.saveName);
    if (typeof refreshPrepPage === 'function') refreshPrepPage();
    if (typeof buildSummonPage === 'function' && currentPage === 'Summon') buildSummonPage();
    if (typeof showToast === 'function') showToast('🎮 作弊成功！+10000 积分', 'success');
    closeCheatModal();
  } else {
    if (typeof showToast === 'function') showToast('❌ 作弊码错误', 'error');
    input.value = '';
    input.focus();
  }
};

window.manualSave = function() {
  if (!GameState.saveName) return;
  saveToBrowser(GameState.saveName);
  var tag = document.getElementById('saveTag');
  if (tag) { tag.innerHTML = '<svg class="tb-icon"><use href="#icon-inventory"/></svg> ' + GameState.saveName + ' ✓'; setTimeout(function() { tag.innerHTML = '<svg class="tb-icon"><use href="#icon-inventory"/></svg> ' + GameState.saveName; }, 2000); }
  // 文件保存反馈
  window._onFileSaved = function(file) {
    if (tag) { tag.textContent = '💾 ' + file + ' ✓'; setTimeout(function() { tag.textContent = '💾 ' + GameState.saveName; }, 2500); }
  };
};
window.liftCurtain = function() {
  var curtain = document.getElementById('battleCurtain');
  if (!curtain) return;

  if (window.gsap) {
    // 增强的揭幕动画
    var curtainContent = curtain.firstElementChild ? curtain.children : [];
    var tl = gsap.timeline({
      onComplete: function() {
        curtain.style.display = 'none';
        rollDiceAndStart();
      }
    });

    // 内容先放大淡出
    tl.to(curtain.children, {
      opacity: 0,
      scale: 1.2,
      duration: 0.3,
      ease: 'power2.in'
    });

    // 幕布向两侧揭开
    tl.to(curtain, {
      opacity: 0,
      scale: 1.05,
      duration: 0.5,
      ease: 'power3.inOut'
    }, 0.2);
  } else {
    curtain.style.opacity = '0';
    setTimeout(function() { curtain.style.display = 'none'; }, 600);
    rollDiceAndStart();
  }
};

// 棋盘相关（保留原有功能）
window.toggleAxes = function() { showAxes = !showAxes; document.getElementById('btnShowAxes').classList.toggle('active'); requestRender(); };
window.resetView = function() { selectedPieceKey = null; updateMoveHint(); updateUnitCard(null); requestRender(); };
window.clearBoard = function() { Object.keys(placedPieces).forEach(function(k){ returnToBench(placedPieces[k].slotIdx); delete placedPieces[k]; }); selectedPieceKey = null; updateMoveHint(); updateUnitCard(null); requestRender(); };

// 初始化粒子背景
function initParticleBG() {
  if (window.ParticleBG && document.getElementById('menuParticleCanvas')) {
    ParticleBG.init('menuParticleCanvas');
  }
}

// 启动
window.addEventListener('load', function() {
  initParticleBG();
  // 初始化设置系统（异步加载服务端设置，不阻塞页面）
  if (window.GameSettings) {
    GameSettings.init(function() {
      // 设置加载完成后应用壁纸（如果已在准备页）
      GameSettings.applyWallpaper();
    });
  }
  init();
});

// 打开设置面板
window.showSettingsPanel = function() {
  if (window.SettingsUI) SettingsUI.open();
};
