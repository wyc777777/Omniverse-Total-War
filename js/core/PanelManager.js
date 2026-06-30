// ==================== PanelManager 面板管理器 ====================

/**
 * @fileoverview 面板管理器模块 - 统一管理游戏中各面板的生命周期
 * @module js/core/PanelManager
 * @description 使用单例模式实现的面板管理器，提供面板注册、显示、隐藏、刷新等统一接口，
 *              通过 EventBus 触发面板相关事件，保持与现有面板函数的向后兼容。
 * @example
 * // 注册面板
 * PanelManager.register('inventory', {
 *   buildFn: buildInventory,
 *   onShow: function(data) { openInventory(); },
 *   onHide: function() { closeInventory(); }
 * });
 *
 * // 显示面板
 * PanelManager.show('inventory', { category: 'weapons' });
 *
 * // 监听面板事件
 * EventBus.on('panel:show', function(e) {
 *   console.log('面板显示:', e.panelId);
 * });
 */

(function(global) {
  'use strict';

  /**
   * 面板配置对象
   * @typedef {Object} PanelConfig
   * @property {Function} [buildFn] - 面板内容构建函数，用于初始化或刷新面板内容
   * @property {Function} [onShow] - 面板显示时的回调函数，接收 data 参数
   * @property {Function} [onHide] - 面板隐藏时的回调函数
   * @property {boolean} [autoBuild=true] - 是否在首次显示时自动调用 buildFn
   */

  /**
   * 面板状态对象
   * @typedef {Object} PanelState
   * @property {string} id - 面板唯一标识
   * @property {PanelConfig} config - 面板配置
   * @property {boolean} visible - 是否可见
   * @property {boolean} built - 是否已构建
   * @property {*} lastData - 上次显示时传入的数据
   */

  /**
   * 面板管理器类
   * @class
   */
  function PanelManager() {
    /**
     * 已注册的面板集合
     * @type {Map<string, PanelState>}
     * @private
     */
    this._panels = new Map();

    /**
     * 当前活动的面板ID
     * @type {string|null}
     * @private
     */
    this._activePanelId = null;

    /**
     * 面板历史栈（用于返回上一面板）
     * @type {Array<string>}
     * @private
     */
    this._history = [];
  }

  /**
   * 注册面板
   * @param {string} panelId - 面板唯一标识
   * @param {PanelConfig} config - 面板配置对象
   * @returns {boolean} 是否注册成功
   * @description 注册一个新面板，配置包含构建函数、显示回调和隐藏回调。
   *              如果面板ID已存在，注册将失败并返回 false。
   * @example
   * PanelManager.register('inventory', {
   *   buildFn: function(data) { buildInventory(data && data.category); },
   *   onShow: function(data) { openInventory(); },
   *   onHide: function() { closeInventory(); }
   * });
   */
  PanelManager.prototype.register = function(panelId, config) {
    if (!panelId || typeof panelId !== 'string') {
      console.warn('[PanelManager] panelId must be a non-empty string');
      return false;
    }

    if (this._panels.has(panelId)) {
      console.warn('[PanelManager] panel already registered:', panelId);
      return false;
    }

    var panelState = {
      id: panelId,
      config: config || {},
      visible: false,
      built: false,
      lastData: null
    };

    this._panels.set(panelId, panelState);
    return true;
  };

  /**
   * 注销面板
   * @param {string} panelId - 面板唯一标识
   * @returns {boolean} 是否注销成功
   * @description 从管理器中移除指定面板，如果面板正在显示则先隐藏
   */
  PanelManager.prototype.unregister = function(panelId) {
    var panel = this._panels.get(panelId);
    if (!panel) {
      console.warn('[PanelManager] panel not found:', panelId);
      return false;
    }

    if (panel.visible) {
      this.hide(panelId);
    }

    this._panels.delete(panelId);
    return true;
  };

  /**
   * 显示面板
   * @param {string} panelId - 面板唯一标识
   * @param {*} [data] - 传递给面板的数据
   * @returns {boolean} 是否显示成功
   * @description 显示指定面板。如果面板配置了 autoBuild（默认开启）且尚未构建，
   *              会先调用 buildFn 构建内容。显示前会自动隐藏当前活动面板。
   *              通过 EventBus 触发 'panel:show' 事件。
   * @fires EventBus#panel:show
   * @example
   * PanelManager.show('inventory', { category: 'weapons' });
   */
  PanelManager.prototype.show = function(panelId, data) {
    var panel = this._panels.get(panelId);
    if (!panel) {
      console.warn('[PanelManager] panel not found:', panelId);
      return false;
    }

    if (panel.visible) {
      this.refresh(panelId, data);
      return true;
    }

    if (this._activePanelId && this._activePanelId !== panelId) {
      this._history.push(this._activePanelId);
      this.hide(this._activePanelId);
    }

    var config = panel.config;
    var autoBuild = config.autoBuild !== false;

    if (autoBuild && !panel.built && typeof config.buildFn === 'function') {
      try {
        config.buildFn(data);
        panel.built = true;
      } catch (e) {
        console.error('[PanelManager] Error in buildFn for', panelId, e);
      }
    }

    if (typeof config.onShow === 'function') {
      try {
        config.onShow(data);
      } catch (e) {
        console.error('[PanelManager] Error in onShow for', panelId, e);
      }
    }

    panel.visible = true;
    panel.lastData = data;
    this._activePanelId = panelId;

    if (global.EventBus && typeof global.EventBus.emit === 'function') {
      global.EventBus.emit('panel:show', { panelId: panelId, data: data });
    }

    return true;
  };

  /**
   * 隐藏面板
   * @param {string} panelId - 面板唯一标识
   * @returns {boolean} 是否隐藏成功
   * @description 隐藏指定面板，调用配置中的 onHide 回调。
   *              通过 EventBus 触发 'panel:hide' 事件。
   * @fires EventBus#panel:hide
   * @example
   * PanelManager.hide('inventory');
   */
  PanelManager.prototype.hide = function(panelId) {
    var panel = this._panels.get(panelId);
    if (!panel) {
      console.warn('[PanelManager] panel not found:', panelId);
      return false;
    }

    if (!panel.visible) {
      return true;
    }

    var config = panel.config;

    if (typeof config.onHide === 'function') {
      try {
        config.onHide();
      } catch (e) {
        console.error('[PanelManager] Error in onHide for', panelId, e);
      }
    }

    panel.visible = false;

    if (this._activePanelId === panelId) {
      this._activePanelId = null;
    }

    if (global.EventBus && typeof global.EventBus.emit === 'function') {
      global.EventBus.emit('panel:hide', { panelId: panelId });
    }

    return true;
  };

  /**
   * 刷新面板内容
   * @param {string} panelId - 面板唯一标识
   * @param {*} [data] - 传递给面板的新数据
   * @returns {boolean} 是否刷新成功
   * @description 刷新指定面板内容，调用配置中的 buildFn。
   *              如果面板尚未构建且不可见，则只刷新状态不触发显示。
   *              通过 EventBus 触发 'panel:refresh' 事件。
   * @fires EventBus#panel:refresh
   * @example
   * PanelManager.refresh('inventory');
   */
  PanelManager.prototype.refresh = function(panelId, data) {
    var panel = this._panels.get(panelId);
    if (!panel) {
      console.warn('[PanelManager] panel not found:', panelId);
      return false;
    }

    var config = panel.config;
    var refreshData = data !== undefined ? data : panel.lastData;

    if (typeof config.buildFn === 'function') {
      try {
        config.buildFn(refreshData);
        panel.built = true;
      } catch (e) {
        console.error('[PanelManager] Error in buildFn (refresh) for', panelId, e);
        return false;
      }
    }

    panel.lastData = refreshData;

    if (global.EventBus && typeof global.EventBus.emit === 'function') {
      global.EventBus.emit('panel:refresh', { panelId: panelId, data: refreshData });
    }

    return true;
  };

  /**
   * 获取当前活动面板
   * @returns {string|null} 当前活动面板的ID，没有则返回 null
   * @description 返回当前正在显示的面板ID
   * @example
   * var active = PanelManager.getActive();
   * console.log('当前活动面板:', active);
   */
  PanelManager.prototype.getActive = function() {
    return this._activePanelId;
  };

  /**
   * 检查面板是否已注册
   * @param {string} panelId - 面板唯一标识
   * @returns {boolean} 是否已注册
   */
  PanelManager.prototype.has = function(panelId) {
    return this._panels.has(panelId);
  };

  /**
   * 检查面板是否可见
   * @param {string} panelId - 面板唯一标识
   * @returns {boolean} 是否可见
   */
  PanelManager.prototype.isVisible = function(panelId) {
    var panel = this._panels.get(panelId);
    return panel ? panel.visible : false;
  };

  /**
   * 获取面板配置
   * @param {string} panelId - 面板唯一标识
   * @returns {PanelConfig|null} 面板配置，不存在则返回 null
   */
  PanelManager.prototype.getConfig = function(panelId) {
    var panel = this._panels.get(panelId);
    return panel ? panel.config : null;
  };

  /**
   * 返回上一个面板
   * @returns {boolean} 是否成功返回
   * @description 从历史栈中弹出上一个面板并显示
   */
  PanelManager.prototype.back = function() {
    if (this._history.length === 0) {
      return false;
    }

    var prevPanelId = this._history.pop();
    if (prevPanelId && this._panels.has(prevPanelId)) {
      this.show(prevPanelId);
      return true;
    }

    return false;
  };

  // ==================== 低级辅助方法（供外部自定义切换流程使用） ====================

  PanelManager.prototype._addToHistory = function(panelId) {
    if (panelId && this._panels.has(panelId)) {
      this._history.push(panelId);
    }
  };

  PanelManager.prototype._popHistory = function() {
    if (this._history.length === 0) return null;
    return this._history.pop();
  };

  PanelManager.prototype._setActive = function(panelId) {
    if (this._panels.has(panelId)) {
      this._activePanelId = panelId;
    }
  };

  PanelManager.prototype._setVisible = function(panelId, visible) {
    var panel = this._panels.get(panelId);
    if (panel) {
      panel.visible = !!visible;
    }
  };

  PanelManager.prototype._setLastData = function(panelId, data) {
    var panel = this._panels.get(panelId);
    if (panel) {
      panel.lastData = data;
    }
  };

  PanelManager.prototype._setBuilt = function(panelId, built) {
    var panel = this._panels.get(panelId);
    if (panel) {
      panel.built = built !== false;
    }
  };

  PanelManager.prototype._emitShow = function(panelId, data) {
    if (global.EventBus && typeof global.EventBus.emit === 'function') {
      global.EventBus.emit('panel:show', { panelId: panelId, data: data });
    }
  };

  PanelManager.prototype._emitHide = function(panelId) {
    if (global.EventBus && typeof global.EventBus.emit === 'function') {
      global.EventBus.emit('panel:hide', { panelId: panelId });
    }
  };

  PanelManager.prototype._emitRefresh = function(panelId, data) {
    if (global.EventBus && typeof global.EventBus.emit === 'function') {
      global.EventBus.emit('panel:refresh', { panelId: panelId, data: data });
    }
  };

  // ==================== 单例模式导出 ====================

  /**
   * PanelManager 单例实例
   * @global
   * @type {PanelManager}
   */
  var PanelManager = new PanelManager();

  // 防止外部修改实例
  Object.freeze(PanelManager);

  // 导出到全局
  global.PanelManager = PanelManager;

})(typeof window !== 'undefined' ? window : this);
