// ==================== 设置系统 ====================
// 统一管理：壁纸选择 + 壁纸放映模式

var GameSettings = (function() {
  var defaults = {
    wallpaper: '',           // 当前选中的壁纸文件名（空=无壁纸）
    wallpaperMode: 'fixed'   // 'fixed' 固定一张 | 'random' 每次进入随机
  };

  var settings = {};
  var loaded = false;
  var _onApplied = null;

  function loadLocal() {
    try {
      var saved = localStorage.getItem('gameSettings');
      if (saved) {
        settings = JSON.parse(saved);
      } else {
        settings = {};
      }
    } catch(e) {
      settings = {};
    }
    for (var k in defaults) {
      if (settings[k] === undefined) settings[k] = defaults[k];
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem('gameSettings', JSON.stringify(settings));
    } catch(e) {}
  }

  function syncToServer() {
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(function() {});
  }

  function syncFromServer(callback) {
    fetch('/api/settings')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && typeof data === 'object') {
          for (var k in defaults) {
            if (data[k] !== undefined) settings[k] = data[k];
          }
          saveLocal();
        }
        if (callback) callback();
      })
      .catch(function() {
        if (callback) callback();
      });
  }

  function init(callback) {
    loadLocal();
    syncFromServer(function() {
      loaded = true;
      if (callback) callback();
    });
  }

  function get(key) {
    if (!loaded) loadLocal();
    return settings[key];
  }

  function set(key, value) {
    settings[key] = value;
    saveLocal();
    syncToServer();
  }

  function getAll() {
    if (!loaded) loadLocal();
    return settings;
  }

  // ===== 应用壁纸到准备界面（壁纸画在 #wallpaper-layer 上，铺满整个窗口）=====
  function applyWallpaper() {
    var prepPage = document.getElementById('pagePrep');
    var wpLayer = document.getElementById('wallpaper-layer');
    if (!prepPage) return;
    var wpName = settings.wallpaper;
    if (wpName) {
      prepPage.classList.add('has-wallpaper');
      document.body.classList.add('body-wallpaper');
      if (wpLayer) {
        wpLayer.style.backgroundImage = 'url(/api/wallpapers/' + encodeURIComponent(wpName) + ')';
        wpLayer.style.backgroundSize = '100% 100%';
        wpLayer.style.backgroundPosition = 'center top';
        wpLayer.style.backgroundRepeat = 'no-repeat';
      }
      // 清掉 prepPage 上的背景，避免重复
      prepPage.style.backgroundImage = '';
    } else {
      prepPage.classList.remove('has-wallpaper');
      document.body.classList.remove('body-wallpaper');
      if (wpLayer) {
        wpLayer.style.backgroundImage = '';
        wpLayer.style.backgroundSize = '';
        wpLayer.style.backgroundPosition = '';
        wpLayer.style.backgroundRepeat = '';
      }
    }
    if (_onApplied) _onApplied();
  }

  function removeWallpaper() {
    document.body.classList.remove('body-wallpaper');
    var wpLayer = document.getElementById('wallpaper-layer');
    if (wpLayer) {
      wpLayer.style.backgroundImage = '';
      wpLayer.style.backgroundSize = '';
      wpLayer.style.backgroundPosition = '';
      wpLayer.style.backgroundRepeat = '';
    }
  }

  // 随机壁纸模式：从壁纸库随机选一张
  function applyRandomWallpaper() {
    fetch('/api/wallpapers')
      .then(function(r) { return r.json(); })
      .then(function(list) {
        if (!list || list.length === 0) return;
        var wp = list[Math.floor(Math.random() * list.length)];
        var prepPage = document.getElementById('pagePrep');
        var wpLayer = document.getElementById('wallpaper-layer');
        if (!prepPage) return;
        prepPage.classList.add('has-wallpaper');
        document.body.classList.add('body-wallpaper');
        if (wpLayer) {
          wpLayer.style.backgroundImage = 'url(' + wp.url + ')';
          wpLayer.style.backgroundSize = '100% 100%';
          wpLayer.style.backgroundPosition = 'center';
          wpLayer.style.backgroundRepeat = 'no-repeat';
        }
        prepPage.style.backgroundImage = '';
        // 临时保存随机选中的，供下次显示
        settings._lastRandomWp = wp.name;
        if (_onApplied) _onApplied();
      })
      .catch(function() {});
  }

  // 根据模式自动选择应用方式
  function applyWallpaperAuto() {
    if (settings.wallpaperMode === 'random') {
      applyRandomWallpaper();
    } else {
      applyWallpaper();
    }
  }

  function onApplied(fn) {
    _onApplied = fn;
  }

  return {
    init: init,
    get: get,
    set: set,
    getAll: getAll,
    applyWallpaper: applyWallpaper,
    applyRandomWallpaper: applyRandomWallpaper,
    applyWallpaperAuto: applyWallpaperAuto,
    onApplied: onApplied,
    defaults: defaults
  };
})();

// ==================== 设置弹窗 UI ====================
var SettingsUI = (function() {

  // ESC 键关闭弹窗的命名处理函数（便于 add/removeEventListener 配对）
  function handleEscKey(e) {
    if (e.key === 'Escape') close();
  }

  function open() {
    close();

    var modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.className = 'settings-modal';
    modal.innerHTML = buildHTML();
    document.body.appendChild(modal);

    fillValues();
    loadWallpaperList();
    loadApiConfig();
    bindEvents();

    if (window.gsap) {
      gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      gsap.fromTo(modal.querySelector('.settings-panel'), { opacity: 0, y: 20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.3)', delay: 0.05 });
    }
  }

  function close() {
    document.removeEventListener('keydown', handleEscKey);
    var modal = document.getElementById('settingsModal');
    if (!modal) return;
    if (window.gsap) {
      gsap.to(modal, {
        opacity: 0, duration: 0.2,
        onComplete: function() { modal.remove(); }
      });
    } else {
      modal.remove();
    }
  }

  function buildHTML() {
    return '<div class="settings-overlay" onclick="SettingsUI.close()"></div>' +
      '<div class="settings-panel">' +
        '<div class="settings-header">' +
          '<h3>设置</h3>' +
          '<button class="settings-close" onclick="SettingsUI.close()">&times;</button>' +
        '</div>' +

        '<div class="settings-tabs">' +
          '<button class="settings-tab active" data-tab="wallpaper">壁纸设置</button>' +
          '<button class="settings-tab" data-tab="api">API 配置</button>' +
        '</div>' +

        // ====== 壁纸设置页 ======
        '<div class="settings-body settings-tab-content active" id="settingsTabWallpaper">' +

          // 壁纸放映模式
          '<div class="settings-section-title">放映模式</div>' +
          '<div class="settings-wp-mode" id="settingsWpMode">' +
            '<label class="settings-radio">' +
              '<input type="radio" name="wpMode" value="fixed" onchange="SettingsUI.setWpMode(\'fixed\')">' +
              '<span class="settings-radio-label">固定壁纸</span>' +
              '<span class="settings-radio-desc">使用选定的壁纸</span>' +
            '</label>' +
            '<label class="settings-radio">' +
              '<input type="radio" name="wpMode" value="random" onchange="SettingsUI.setWpMode(\'random\')">' +
              '<span class="settings-radio-label">随机壁纸</span>' +
              '<span class="settings-radio-desc">每次进入从壁纸库随机选取</span>' +
            '</label>' +
          '</div>' +

          // 当前壁纸
          '<div class="settings-section-title" style="margin-top:16px">当前壁纸</div>' +
          '<div class="settings-current-wp" id="settingsCurrentWp">未设置壁纸</div>' +

          // 壁纸库
          '<div class="settings-section-title" style="margin-top:16px;display:flex;align-items:center;gap:12px">' +
            '<span>壁纸库</span>' +
            '<button class="settings-btn settings-btn-primary settings-btn-small" onclick="SettingsUI.importWallpaper()" style="margin-left:auto">导入壁纸</button>' +
          '</div>' +
          '<div class="settings-wp-grid" id="settingsWpGrid">' +
            '<div class="settings-wp-empty">加载中...</div>' +
          '</div>' +
          '<input type="file" id="wpFileInput" accept="image/*" style="display:none" onchange="SettingsUI.handleFileSelect(event)">' +
        '</div>' +

        // ====== API 配置页 ======
        '<div class="settings-body settings-tab-content" id="settingsTabApi">' +
          // Profile 选择器
          '<div class="settings-section-title" style="display:flex;align-items:center;gap:8px">' +
            '<span>API 配置</span>' +
            '<select id="settingsApiProfile" class="settings-api-select" onchange="SettingsUI.switchProfile()">' +
              '<option value="">无配置</option>' +
            '</select>' +
            '<button class="settings-btn settings-btn-small" onclick="SettingsUI.addProfile()" title="新建配置">+ 新建</button>' +
            '<button class="settings-btn settings-btn-small settings-btn-danger" onclick="SettingsUI.deleteProfile()" title="删除当前配置" style="margin-left:auto">删除</button>' +
          '</div>' +

          '<div class="settings-api-status" id="settingsApiStatus">加载中...</div>' +

          '<div class="settings-field">' +
            '<label>API Base URL</label>' +
            '<input type="text" id="settingsApiBase" placeholder="https://api.deepseek.com/v1">' +
            '<div class="settings-field-hint">AI API 的基础地址</div>' +
          '</div>' +
          '<div class="settings-field">' +
            '<label>API Key</label>' +
            '<input type="password" id="settingsApiKey" placeholder="sk-...">' +
            '<div class="settings-field-hint">你的 API 密钥，保存到服务端本地文件</div>' +
          '</div>' +
          '<div class="settings-field">' +
            '<label>模型名称</label>' +
            '<input type="text" id="settingsModel" placeholder="deepseek-v4-flash">' +
            '<div class="settings-field-hint">召唤引擎使用的 AI 模型</div>' +
          '</div>' +
          '<div class="settings-api-actions">' +
            '<button class="settings-btn settings-btn-primary" onclick="SettingsUI.saveApi()">保存当前配置</button>' +
            '<button class="settings-btn settings-btn-danger" onclick="SettingsUI.clearAllKeys()">清除密钥</button>' +
          '</div>' +
          '<div class="settings-api-hint">可保存多组 API 配置自由切换。清除密钥后召唤引擎将不可用。</div>' +
        '</div>' +

        '<div class="settings-footer">设置自动保存到本地</div>' +
      '</div>';
  }

  function fillValues() {
    // 壁纸模式 radio
    var mode = GameSettings.get('wallpaperMode') || 'fixed';
    var radios = document.querySelectorAll('input[name="wpMode"]');
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].value === mode) radios[i].checked = true;
    }
    updateCurrentWp();
  }

  // ===== 壁纸放映模式 =====
  function setWpMode(mode) {
    GameSettings.set('wallpaperMode', mode);
    if (typeof showToast === 'function') showToast(mode === 'fixed' ? '已切换为固定壁纸' : '已切换为随机壁纸', 'success');
  }

  // ===== API 配置 =====
  var _apiProfiles = [];
  var _activeProfileName = '';

  function loadApiConfig() {
    var statusEl = document.getElementById('settingsApiStatus');
    fetch('/api/api-config')
      .then(function(r) { return r.json(); })
      .then(function(config) {
        _apiProfiles = config.profiles || [];
        _activeProfileName = config.activeProfile || '';

        var sel = document.getElementById('settingsApiProfile');
        if (sel) {
          sel.innerHTML = '';
          if (_apiProfiles.length === 0) {
            sel.innerHTML = '<option value="">无配置</option>';
          } else {
            _apiProfiles.forEach(function(p) {
              var opt = document.createElement('option');
              opt.value = p.name;
              opt.textContent = p.name + (p.configured ? ' ✓' : '');
              if (p.name === _activeProfileName) opt.selected = true;
              sel.appendChild(opt);
            });
          }
        }

        fillApiFields(config);
      })
      .catch(function() {
        if (statusEl) {
          statusEl.innerHTML = '<span class="settings-api-no">无法读取 API 配置</span>';
          statusEl.className = 'settings-api-status settings-api-status-no';
        }
      });
  }

  function fillApiFields(config) {
    var apiBase = document.getElementById('settingsApiBase');
    var apiKey = document.getElementById('settingsApiKey');
    var model = document.getElementById('settingsModel');
    var statusEl = document.getElementById('settingsApiStatus');

    if (apiBase) apiBase.value = config.apiBaseUrl || '';
    if (apiKey) apiKey.value = '';
    if (model) model.value = config.modelName || '';

    if (statusEl) {
      if (config.configured) {
        statusEl.innerHTML = '<span class="settings-api-ok">API 已配置</span> — 召唤引擎可用';
        statusEl.className = 'settings-api-status settings-api-status-ok';
      } else {
        statusEl.innerHTML = '<span class="settings-api-no">API 未配置</span> — 召唤引擎不可用';
        statusEl.className = 'settings-api-status settings-api-status-no';
      }
    }
  }

  function switchProfile() {
    var sel = document.getElementById('settingsApiProfile');
    if (!sel) return;
    var name = sel.value;
    if (!name) return;

    fetch('/api/api-config/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res.ok) {
        loadApiConfig();
        if (typeof showToast === 'function') showToast('已切换到: ' + name, 'success');
      }
    })
    .catch(function() {
      if (typeof showToast === 'function') showToast('切换失败', 'error');
    });
  }

  function addProfile() {
    var name = prompt('请输入新 API 配置名称（如 DeepSeek、OpenAI）:');
    if (!name || !name.trim()) return;
    name = name.trim();

    fetch('/api/api-config/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res.ok) {
        loadApiConfig();
        if (typeof showToast === 'function') showToast('已创建配置: ' + name, 'success');
      } else {
        if (typeof showToast === 'function') showToast(res.error || '创建失败', 'error');
      }
    })
    .catch(function() {
      if (typeof showToast === 'function') showToast('创建失败', 'error');
    });
  }

  function deleteProfile() {
    if (_apiProfiles.length === 0) {
      if (typeof showToast === 'function') showToast('没有可删除的配置', 'warning');
      return;
    }
    if (!confirm('确定删除配置 "' + _activeProfileName + '"？\n\n此操作不可恢复。')) return;

    fetch('/api/api-config/profile/' + encodeURIComponent(_activeProfileName), { method: 'DELETE' })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.ok) {
          loadApiConfig();
          if (typeof showToast === 'function') showToast('已删除配置', 'success');
        } else {
          if (typeof showToast === 'function') showToast(res.error || '删除失败', 'error');
        }
      })
      .catch(function() {
        if (typeof showToast === 'function') showToast('删除失败', 'error');
      });
  }

  function saveApi() {
    if (!_activeProfileName) {
      if (typeof showToast === 'function') showToast('请先创建一个 API 配置', 'warning');
      return;
    }
    var apiBase = document.getElementById('settingsApiBase');
    var apiKey = document.getElementById('settingsApiKey');
    var model = document.getElementById('settingsModel');
    var data = {};
    if (apiBase && apiBase.value.trim()) data.apiBaseUrl = apiBase.value.trim();
    if (apiKey && apiKey.value.trim()) data.apiKey = apiKey.value.trim();
    if (model && model.value.trim()) data.modelName = model.value.trim();

    fetch('/api/api-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res.ok) {
        if (typeof showToast === 'function') showToast('API 配置已保存', 'success');
        loadApiConfig();
      }
    })
    .catch(function() {
      if (typeof showToast === 'function') showToast('保存失败', 'error');
    });
  }

  function clearAllKeys() {
    if (!_activeProfileName) {
      if (typeof showToast === 'function') showToast('没有可清除的配置', 'warning');
      return;
    }
    if (!confirm('确定清除 "' + _activeProfileName + '" 的 API 密钥？\n\n清除后召唤引擎将不可用。')) return;
    fetch('/api/api-config', { method: 'DELETE' })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        var apiKey = document.getElementById('settingsApiKey');
        if (apiKey) apiKey.value = '';
        loadApiConfig();
        if (typeof showToast === 'function') showToast('密钥已清除', 'success');
      })
      .catch(function() {
        if (typeof showToast === 'function') showToast('清除失败', 'error');
      });
  }

  // ===== 当前壁纸预览 =====
  function updateCurrentWp() {
    var el = document.getElementById('settingsCurrentWp');
    if (!el) return;
    var mode = GameSettings.get('wallpaperMode') || 'fixed';
    var wpName = GameSettings.get('wallpaper');
    if (mode === 'random') {
      el.innerHTML = '<div class="settings-wp-mode-tag">随机模式</div>' +
        '<div class="settings-wp-empty">每次进入准备界面时，从壁纸库随机选取一张</div>';
    } else if (wpName) {
      el.innerHTML = '<div class="settings-current-wp-preview">' +
        '<img src="/api/wallpapers/' + encodeURIComponent(wpName) + '" alt="当前壁纸">' +
        '</div>' +
        '<div class="settings-current-wp-info">当前使用: ' + escapeHtml(wpName) + '</div>' +
        '<button class="settings-btn settings-btn-small" onclick="SettingsUI.clearWallpaper()">清除壁纸</button>';
    } else {
      el.innerHTML = '<div class="settings-wp-empty">未设置壁纸，准备界面将使用默认背景</div>';
    }
  }

  // ===== 壁纸列表 =====
  function loadWallpaperList() {
    var grid = document.getElementById('settingsWpGrid');
    if (!grid) return;

    fetch('/api/wallpapers')
      .then(function(r) { return r.json(); })
      .then(function(list) {
        if (!list || list.length === 0) {
          grid.innerHTML = '<div class="settings-wp-empty">壁纸库为空，点击下方"导入壁纸"添加</div>';
          return;
        }
        var currentWp = GameSettings.get('wallpaper');
        var html = '';
        list.forEach(function(wp) {
          var isActive = wp.name === currentWp;
          var sizeKB = Math.round(wp.size / 1024);
          html += '<div class="settings-wp-card' + (isActive ? ' active' : '') + '" data-name="' + escapeAttr(wp.name) + '">' +
            '<img src="' + wp.url + '" alt="' + escapeAttr(wp.name) + '">' +
            '<div class="settings-wp-card-info">' +
              '<span class="settings-wp-card-name">' + escapeHtml(wp.name) + '</span>' +
              '<span class="settings-wp-card-size">' + sizeKB + ' KB</span>' +
            '</div>' +
            (isActive ? '<div class="settings-wp-active-badge">使用中</div>' : '') +
            '<button class="settings-wp-card-del" data-del="' + escapeAttr(wp.name) + '" title="删除壁纸">&times;</button>' +
          '</div>';
        });
        grid.innerHTML = html;

        grid.querySelectorAll('.settings-wp-card').forEach(function(card) {
          card.addEventListener('click', function(e) {
            if (e.target.classList.contains('settings-wp-card-del')) return;
            selectWallpaper(card.dataset.name);
          });
        });
        grid.querySelectorAll('.settings-wp-card-del').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteWallpaper(btn.dataset.del);
          });
        });
      })
      .catch(function() {
        grid.innerHTML = '<div class="settings-wp-empty">加载壁纸列表失败</div>';
      });
  }

  function selectWallpaper(name) {
    GameSettings.set('wallpaper', name);
    // 如果当前是随机模式，自动切到固定模式
    if (GameSettings.get('wallpaperMode') === 'random') {
      GameSettings.set('wallpaperMode', 'fixed');
      var radios = document.querySelectorAll('input[name="wpMode"]');
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].value === 'fixed') radios[i].checked = true;
      }
    }
    GameSettings.applyWallpaper();
    updateCurrentWp();
    loadWallpaperList();
    if (typeof showToast === 'function') showToast('壁纸已更换', 'success');
  }

  function clearWallpaper() {
    GameSettings.set('wallpaper', '');
    GameSettings.applyWallpaper();
    updateCurrentWp();
    loadWallpaperList();
    if (typeof showToast === 'function') showToast('壁纸已清除', 'success');
  }

  function deleteWallpaper(name) {
    if (!confirm('确定删除这张壁纸？')) return;
    fetch('/api/wallpapers/' + encodeURIComponent(name), { method: 'DELETE' })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.ok) {
          if (GameSettings.get('wallpaper') === name) {
            GameSettings.set('wallpaper', '');
            GameSettings.applyWallpaper();
            updateCurrentWp();
          }
          loadWallpaperList();
          if (typeof showToast === 'function') showToast('壁纸已删除', 'success');
        } else {
          if (typeof showToast === 'function') showToast(res.error || '删除失败', 'error');
        }
      })
      .catch(function() {
        if (typeof showToast === 'function') showToast('删除失败', 'error');
      });
  }

  function importWallpaper() {
    var input = document.getElementById('wpFileInput');
    if (input) input.click();
  }

  function handleFileSelect(e) {
    var file = e.target.files[0];
    if (!file) return;

    var allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (allowed.indexOf(file.type) < 0) {
      if (typeof showToast === 'function') showToast('不支持的文件格式', 'error');
      e.target.value = '';
      return;
    }

    var formData = new FormData();
    formData.append('wallpaper', file);

    var grid = document.getElementById('settingsWpGrid');
    if (grid) grid.innerHTML = '<div class="settings-wp-empty">上传中...</div>';

    fetch('/api/wallpapers', {
      method: 'POST',
      body: formData
    })
    .then(function(r) {
      if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || '上传失败'); });
      return r.json();
    })
    .then(function(res) {
      if (res.ok) {
        loadWallpaperList();
        if (typeof showToast === 'function') showToast('壁纸导入成功', 'success');
      }
    })
    .catch(function(err) {
      if (typeof showToast === 'function') showToast(err.message || '上传失败', 'error');
      loadWallpaperList();
    });

    e.target.value = '';
  }

  function bindEvents() {
    var tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = tab.dataset.tab;
        document.querySelectorAll('.settings-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.settings-tab-content').forEach(function(c) { c.classList.remove('active'); });
        tab.classList.add('active');
        var contentId = 'settingsTab' + target.charAt(0).toUpperCase() + target.slice(1);
        var content = document.getElementById(contentId);
        if (content) content.classList.add('active');
      });
    });

    document.addEventListener('keydown', handleEscKey);
  }

  return {
    open: open,
    close: close,
    importWallpaper: importWallpaper,
    handleFileSelect: handleFileSelect,
    saveApi: saveApi,
    clearAllKeys: clearAllKeys,
    clearWallpaper: clearWallpaper,
    setWpMode: setWpMode,
    switchProfile: switchProfile,
    addProfile: addProfile,
    deleteProfile: deleteProfile
  };
})();

window.GameSettings = GameSettings;
window.SettingsUI = SettingsUI;
