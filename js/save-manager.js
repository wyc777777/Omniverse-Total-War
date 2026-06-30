var SAVE_VERSION = 4; // v4：盾牌独立，武器单手/双手属性

var GameState = {
  saveName: '',
  version: SAVE_VERSION,
  playerUnits: [],       // [{type:'infantry', name:'磐石重步兵团', id:'u_...'}]
  points: 0,
  timestamp: '',
  inventory: {           // 背包系统：存放可拆卸装备
    weapons: [],         // [{id, name, ...装备数据}]
    shields: [],         // 盾牌（独立分类）
    armors: [],
    mounts: []
  },
  _summonedData: { races: [], weapons: [], shields: [], armors: [], mounts: [], units: [] },
  _summonHistory: [],
  summonModel: 'deepseek-v4-flash',
  completedLevels: {}      // 关卡进度：{ levelId: { completed:true, firstClearTime: timestamp } }
};

// ===== 背包操作 =====
function addItemToInventory(item, slotType) {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.addToInventory) {
    return EquipmentService.addToInventory(item, slotType);
  }
  return false;
}

function removeItemFromInventory(itemId) {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.removeFromInventory) {
    return EquipmentService.removeFromInventory(itemId);
  }
  return null;
}

function findItemInInventory(itemId) {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.findInInventory) {
    return EquipmentService.findInInventory(itemId);
  }
  return null;
}

function getInventoryCount() {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.getInventoryCount) {
    return EquipmentService.getInventoryCount();
  }
  return 0;
}

// 拆卸兵团装备到背包
function unequipToInventory(unitDef, slot) {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.unequipToInventory) {
    return EquipmentService.unequipToInventory(unitDef, slot);
  }
  return null;
}

// 从背包装备到兵团（原装备回收到背包）
function equipFromInventory(unitDef, slot, itemId) {
  if (typeof EquipmentService !== 'undefined' && EquipmentService.equipFromInventory) {
    return EquipmentService.equipFromInventory(unitDef, slot, itemId);
  }
  return {success:false};
}

var _serverAvailable = null; // null = 未检测, true/false

// ===== 检测服务器是否可用 =====
function checkServerAvailable(callback) {
  if (_serverAvailable !== null) { callback(_serverAvailable); return; }
  fetch('/api/saves', { method: 'GET' })
    .then(function(r) {
      if (!r.ok) throw new Error('no');
      return r.json();
    })
    .then(function() {
      _serverAvailable = true;
      callback(true);
    })
    .catch(function() {
      _serverAvailable = false;
      callback(false);
    });
}

// ===== 保存主存档（不含召唤数据，召唤数据单独存）=====
function saveToBrowser(name) {
  GameState.version = SAVE_VERSION;
  var data = buildMainSaveData(name);

  // localStorage 兜底：主存档 + 召唤数据一起存（离线时仍可恢复）
  _saveToLocal(name, data);

  // 服务器在线：主存档 + 召唤数据分别写文件
  if (_serverAvailable === true) {
    _saveMainToFile(data, name);
    _saveSummonedToFile(name);
  } else if (_serverAvailable === null) {
    checkServerAvailable(function(ok) {
      if (ok) {
        _saveMainToFile(data, name);
        _saveSummonedToFile(name);
      }
    });
  }
}

// 同步保存（initNewGame 等需要立即完成的场景）
function saveToBrowserSync(name) {
  var data = buildMainSaveData(name);
  _saveToLocal(name, data);

  if (_serverAvailable === true) {
    _saveMainToFile(data, name);
    _saveSummonedToFile(name);
  } else if (_serverAvailable === null) {
    // 预检还没完成，尝试直接发请求
    fetch('/api/saves/' + encodeURIComponent(name), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r) { return r.json(); })
      .then(function(result) {
        if (result.ok) {
          _serverAvailable = true;
          _saveSummonedToFile(name);
        }
      })
      .catch(function() { _serverAvailable = false; });
  }
}

// 构建主存档数据（不含 _summonedData，减小体积）
function buildMainSaveData(name) {
  var data = JSON.parse(JSON.stringify(GameState));
  data.name = name;
  data.version = SAVE_VERSION;
  data.timestamp = new Date().toISOString();
  // localStorage 兜底需要 _summonedData（离线时无单独文件）
  // 但 JSON 文件不写 _summonedData（单独存）
  return data;
}

// 写主存档到 JSON 文件（剥离 _summonedData）
function _saveMainToFile(data, name) {
  var fileData = JSON.parse(JSON.stringify(data));
  delete fileData._summonedData; // 主存档文件不含召唤数据
  fetch('/api/saves/' + encodeURIComponent(name), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fileData)
  }).then(function(r) { return r.json(); })
    .then(function(result) {
      if (result.ok && window._onFileSaved) window._onFileSaved(result.file);
    })
    .catch(function() {});
}

// 写召唤数据到单独 JSON 文件
function _saveSummonedToFile(name) {
  var summonedData = GameState._summonedData || { races: [], weapons: [], shields: [], armors: [], mounts: [], units: [] };
  fetch('/api/summoned/' + encodeURIComponent(name), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(summonedData)
  }).catch(function() {});
}

function _saveToLocal(name, data) {
  var saves = getAllLocalSaves();
  saves[name] = data;
  try {
    localStorage.setItem('wwqz_saves', JSON.stringify(saves));
  } catch (e) {
    console.error('localStorage write failed:', e);
  }
}

// ===== 读取：JSON 文件优先，localStorage 兜底 =====
// 改为异步回调（因为 fetch 是异步的）
function loadFromBrowser(name, callback) {
  // 服务器可能可用时，优先读 JSON 文件
  if (_serverAvailable !== false) {
    fetch('/api/saves/' + encodeURIComponent(name))
      .then(function(r) {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then(function(mainData) {
        if (!mainData || (!mainData.name && !mainData.saveName)) {
          throw new Error('invalid');
        }
        // 主存档加载成功，继续加载召唤数据
        applyMainSaveData(mainData);
        // localStorage 同步写入始终最新，覆盖服务器可能滞后写入的字段
        var localCheck = getAllLocalSaves();
        var localLatest = localCheck && localCheck[name];
        if (localLatest && localLatest._hiddenShopUnitTypes !== undefined) {
          GameState._hiddenShopUnitTypes = localLatest._hiddenShopUnitTypes;
        }
        // 加载召唤数据（单独文件）
        _loadSummonedFromFile(name, function(summonedData) {
          if (summonedData) {
            applySummonedData(summonedData);
          } else {
            // 召唤数据文件不存在（可能是旧存档或新游戏），用主存档里的（兼容旧格式）
            var legacySummoned = mainData._summonedData;
            applySummonedData(legacySummoned || { races: [], weapons: [], armors: [], mounts: [], units: [] });
          }
          if (window._onSavesUpdated) window._onSavesUpdated(getAllSavesSync());
          if (callback) callback(true);
        });
      })
      .catch(function() {
        _serverAvailable = false;
        // JSON 不可用，回退到 localStorage
        var ok = _loadFromLocal(name);
        if (callback) callback(ok);
      });
  } else {
    // 服务器不可用，直接用 localStorage
    var ok = _loadFromLocal(name);
    if (callback) callback(ok);
  }
}

// 从 localStorage 加载（兜底）
function _loadFromLocal(name) {
  var localSaves = getAllLocalSaves();
  if (localSaves[name]) {
    applyMainSaveData(localSaves[name]);
    // localStorage 里 _summonedData 内嵌在主存档中
    applySummonedData(localSaves[name]._summonedData || { races: [], weapons: [], armors: [], mounts: [], units: [] });
    return true;
  }
  return false;
}

// 从 JSON 文件加载召唤数据
function _loadSummonedFromFile(name, callback) {
  fetch('/api/summoned/' + encodeURIComponent(name))
    .then(function(r) {
      if (!r.ok) throw new Error('no summoned');
      return r.json();
    })
    .then(function(data) { callback(data); })
    .catch(function() { callback(null); });
}

// 应用主存档数据（不含召唤数据）
function applyMainSaveData(d) {
  if (!d) d = {};
  GameState.saveName = d.name || d.saveName || '';
  GameState.playerUnits = Array.isArray(d.playerUnits) ? d.playerUnits : [];
  GameState.points = typeof d.points === 'number' ? d.points : (parseInt(d.points, 10) || 0);
  GameState.timestamp = d.timestamp || '';
  GameState.version = d.version || 0;
  GameState.summonModel = d.summonModel || 'deepseek-v4-flash';
  if (d._summonHistory !== undefined) GameState._summonHistory = d._summonHistory;
  // 隐藏的商店兵种类型（用户清理过的）
  if (d._hiddenShopUnitTypes !== undefined) {
    GameState._hiddenShopUnitTypes = Array.isArray(d._hiddenShopUnitTypes) ? d._hiddenShopUnitTypes : [];
  }
  if (d._shadowAndSunUsed !== undefined) GameState._shadowAndSunUsed = d._shadowAndSunUsed;
  if (d._cheatKWUsed !== undefined) GameState._cheatKWUsed = d._cheatKWUsed;
  // 背包数据（v3+），旧存档为空背包
  if (d.inventory && typeof d.inventory === 'object') {
    GameState.inventory = {
      weapons: Array.isArray(d.inventory.weapons) ? d.inventory.weapons : [],
      shields: Array.isArray(d.inventory.shields) ? d.inventory.shields : [],
      armors: Array.isArray(d.inventory.armors) ? d.inventory.armors : [],
      mounts: Array.isArray(d.inventory.mounts) ? d.inventory.mounts : []
    };
  } else {
    GameState.inventory = { weapons: [], shields: [], armors: [], mounts: [] };
  }
  // 旧存档副武器迁移：把subWeapon类型为shield的移到shields
  if (GameState.inventory.weapons && GameState.inventory.weapons.length) {
    var oldShields = GameState.inventory.weapons.filter(function(w) { return w.type === 'shield' || w.slot === 'sub'; });
    if (oldShields.length > 0) {
      GameState.inventory.shields = GameState.inventory.shields.concat(oldShields);
      GameState.inventory.weapons = GameState.inventory.weapons.filter(function(w) { return w.type !== 'shield' && w.slot !== 'sub'; });
    }
  }
  // 背包里的装备也要注入ED，否则findWeapon/findShield/findArmor/findMount找不到
  if (typeof injectInventoryToED === 'function') injectInventoryToED();
  // 关卡进度（向后兼容：旧存档无此字段则空对象）
  if (d.completedLevels && typeof d.completedLevels === 'object' && !Array.isArray(d.completedLevels)) {
    GameState.completedLevels = d.completedLevels;
  } else {
    GameState.completedLevels = {};
  }
}

// ===== 关卡进度存储 =====
// 判断某关是否已通关
function isLevelCompleted(levelId) {
  if (!levelId || !GameState.completedLevels) return false;
  var rec = GameState.completedLevels[levelId];
  return !!(rec && rec.completed === true);
}

// 标记某关通关（仅记录首次通关时间，重复通关不覆盖）
function markLevelCompleted(levelId) {
  if (!levelId) return false;
  if (!GameState.completedLevels) GameState.completedLevels = {};
  if (GameState.completedLevels[levelId] && GameState.completedLevels[levelId].completed) {
    return false; // 已通关，不覆盖首通时间
  }
  GameState.completedLevels[levelId] = {
    completed: true,
    firstClearTime: Date.now()
  };
  return true;
}

// 获取全部已通关关卡记录
function getCompletedLevels() {
  return GameState.completedLevels || {};
}

// 应用召唤数据（单独处理，注入到 RD/ED/UD）
function applySummonedData(d) {
  if (!d) d = {};
  var hiddenTypes = GameState._hiddenShopUnitTypes || [];
  GameState._summonedData = {
    races: Array.isArray(d.races) ? d.races : [],
    weapons: Array.isArray(d.weapons) ? d.weapons : [],
    shields: Array.isArray(d.shields) ? d.shields : [],
    armors: Array.isArray(d.armors) ? d.armors : [],
    mounts: Array.isArray(d.mounts) ? d.mounts : [],
    units: Array.isArray(d.units) ? d.units.filter(function(u) {
      if (u._levelBattleTemp || u._aiBattleTemp) return false;
      if (hiddenTypes.indexOf(u.type) >= 0) return false;
      return true;
    }) : []
  };
  if (typeof clearSummonedData === 'function') clearSummonedData();
  if (typeof injectSummonedData === 'function') injectSummonedData();
}

// 兼容旧代码：applySaveData 同时应用主存档 + 召唤数据
function applySaveData(d) {
  if (!d) d = {};
  applyMainSaveData(d);
  applySummonedData(d._summonedData);
}

// ===== 获取存档列表：合并服务器 + localStorage =====
function getAllSaves() {
  checkServerAvailable(function(serverOk) {
    if (serverOk) {
      fetch('/api/saves')
        .then(function(r) { return r.json(); })
        .then(function(serverSaves) {
          var local = getAllLocalSaves();
          // localStorage 同步写入始终最新，覆盖同名的服务器旧数据
          var merged = {};
          Object.keys(serverSaves).forEach(function(k) { merged[k] = serverSaves[k]; });
          Object.keys(local).forEach(function(k) { merged[k] = local[k]; });
          _cachedSaves = merged;
          if (window._onSavesUpdated) window._onSavesUpdated(merged);
        })
        .catch(function() {
          _cachedSaves = getAllLocalSaves();
          if (window._onSavesUpdated) window._onSavesUpdated(_cachedSaves);
        });
    } else {
      _cachedSaves = getAllLocalSaves();
      if (window._onSavesUpdated) window._onSavesUpdated(_cachedSaves);
    }
  });
  return _cachedSaves || getAllLocalSaves();
}

var _cachedSaves = null;
function getAllSavesSync() {
  // 始终合并缓存服务端数据 + 本地最新数据，保证数量准确
  var local = getAllLocalSaves();
  if (!_cachedSaves) return local;
  var merged = {};
  Object.keys(_cachedSaves).forEach(function(k) { merged[k] = _cachedSaves[k]; });
  Object.keys(local).forEach(function(k) { merged[k] = local[k]; });
  return merged;
}

function getAllLocalSaves() {
  try { return JSON.parse(localStorage.getItem('wwqz_saves')) || {}; }
  catch(e) { return {}; }
}

// ===== 删除存档：主存档 + 召唤数据 + localStorage 级联删除 =====
function deleteSave(name) {
  checkServerAvailable(function(ok) {
    if (ok) {
      // 删主存档
      fetch('/api/saves/' + encodeURIComponent(name), { method: 'DELETE' }).catch(function(){});
      // 级联删召唤数据
      fetch('/api/summoned/' + encodeURIComponent(name), { method: 'DELETE' }).catch(function(){});
    }
  });
  var saves = getAllLocalSaves();
  delete saves[name];
  try {
    localStorage.setItem('wwqz_saves', JSON.stringify(saves));
  } catch (e) {
    console.error('localStorage write failed:', e);
  }
}

// ===== 初始化新游戏 =====
function initNewGame(saveName) {
  GameState.saveName = saveName;
  var now = Date.now();
  var rnd = Math.floor(Math.random() * 100000);
  GameState.playerUnits = [
    { type: 'peasant_archer', name: '农民弓兵团', id: 'u_' + now + '_' + rnd + '_init_0' },
    { type: 'cavalry', name: '暴风骑兵团', id: 'u_' + now + '_' + rnd + '_init_1' },
    { type: 'elite_archer', name: '精锐弩兵兵团', id: 'u_' + now + '_' + rnd + '_init_2' },
    { type: 'beast_infantry', name: '战犬侦查营', id: 'u_' + now + '_' + rnd + '_init_3' },
    { type: 'infantry', name: '磐石重步兵团', id: 'u_' + now + '_' + rnd + '_init_4' },
    { type: 'flying', name: '雷霆狮鹫空军兵团', id: 'u_' + now + '_' + rnd + '_init_5' }
  ];
  GameState.points = 1000;
  GameState.timestamp = new Date().toISOString();
  GameState._summonedData = { races: [], weapons: [], shields: [], armors: [], mounts: [], units: [] };
  GameState.inventory = { weapons: [], shields: [], armors: [], mounts: [] };
  GameState.completedLevels = {};
  GameState.summonModel = 'deepseek-v4-flash';
  if (typeof clearSummonedData === 'function') clearSummonedData();
  if (typeof injectSummonedData === 'function') injectSummonedData();
  if (typeof injectInventoryToED === 'function') injectInventoryToED();
  saveToBrowserSync(saveName);
}

// ===== 暴露给全局 =====
window.saveToBrowser = saveToBrowser;
window.saveToBrowserSync = saveToBrowserSync;
window.loadFromBrowser = loadFromBrowser;
window.getAllSaves = getAllSaves;
window.getAllSavesSync = getAllSavesSync;
window.deleteSave = deleteSave;
window.initNewGame = initNewGame;
window.isLevelCompleted = isLevelCompleted;
window.markLevelCompleted = markLevelCompleted;
window.getCompletedLevels = getCompletedLevels;
