// ==================== EventBus 事件总线 ====================

/**
 * @fileoverview 事件总线模块 - 提供统一的事件订阅与发布机制
 * @module js/core/EventBus
 * @description 使用单例模式实现的事件总线，支持事件的注册、注销、触发和一次性监听
 * @example
 * // 注册事件监听
 * EventBus.on('equipmentChanged', function(data) {
 *   console.log('装备变化:', data);
 * });
 *
 * // 触发事件
 * EventBus.emit('equipmentChanged', { slot: 'shield', itemId: 'S001' });
 *
 * // 注册一次性事件
 * EventBus.once('gameStart', function() {
 *   console.log('游戏开始！');
 * });
 *
 * // 取消监听（通过 on 返回的取消函数）
 * const cancel = EventBus.on('update', handler);
 * cancel(); // 取消监听
 */

(function(global) {
  'use strict';

  /**
   * 事件总线类
   * @class
   */
  function EventBus() {
    /**
     * 存储事件监听器
     * @type {Map<string, Set<Function>>}
     * @private
     */
    this._listeners = new Map();

    /**
     * 存储一次性事件监听器（触发后自动移除）
     * @type {Map<string, Set<Function>>}
     * @private
     */
    this._onceListeners = new Map();
  }

  /**
   * 注册事件监听
   * @param {string} eventName - 事件名称
   * @param {Function} handler - 事件处理函数
   * @returns {Function} 取消监听函数，调用后可取消该监听
   * @description 注册指定事件的监听器，返回一个取消函数用于移除该监听
   * @example
   * const cancel = EventBus.on('click', function(data) {
   *   console.log('clicked', data);
   * });
   * // 稍后取消监听
   * cancel();
   */
  EventBus.prototype.on = function(eventName, handler) {
    if (typeof handler !== 'function') {
      console.warn('[EventBus] handler must be a function:', eventName);
      return function() {};
    }

    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    this._listeners.get(eventName).add(handler);

    // 返回取消函数
    var self = this;
    return function() {
      self.off(eventName, handler);
    };
  };

  /**
   * 取消事件监听
   * @param {string} eventName - 事件名称
   * @param {Function} handler - 事件处理函数
   * @description 移除指定事件的指定监听器
   * @example
   * function handler(data) { console.log(data); }
   * EventBus.on('update', handler);
   * EventBus.off('update', handler);
   */
  EventBus.prototype.off = function(eventName, handler) {
    var listeners = this._listeners.get(eventName);
    if (listeners) {
      listeners.delete(handler);
      if (listeners.size === 0) {
        this._listeners.delete(eventName);
      }
    }

    // 同时移除 once 注册的同函数
    var onceListeners = this._onceListeners.get(eventName);
    if (onceListeners) {
      onceListeners.delete(handler);
      if (onceListeners.size === 0) {
        this._onceListeners.delete(eventName);
      }
    }
  };

  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {*} [data] - 传递给监听器的数据
   * @description 触发指定事件，调用该事件的所有监听器
   * @example
   * EventBus.emit('playerMoved', { x: 10, y: 20 });
   */
  EventBus.prototype.emit = function(eventName, data) {
    // 处理普通监听器
    var listeners = this._listeners.get(eventName);
    if (listeners) {
      // 复制一份避免监听器中修改集合导致的问题
      var handlers = Array.from(listeners);
      for (var i = 0; i < handlers.length; i++) {
        try {
          handlers[i](data);
        } catch (e) {
          console.error('[EventBus] Error in handler for', eventName, e);
        }
      }
    }

    // 处理一次性监听器（触发后自动移除）
    var onceListeners = this._onceListeners.get(eventName);
    if (onceListeners) {
      var onceHandlers = Array.from(onceListeners);
      this._onceListeners.delete(eventName);
      for (var j = 0; j < onceHandlers.length; j++) {
        try {
          onceHandlers[j](data);
        } catch (e) {
          console.error('[EventBus] Error in once handler for', eventName, e);
        }
      }
    }
  };

  /**
   * 注册一次性事件监听
   * @param {string} eventName - 事件名称
   * @param {Function} handler - 事件处理函数，触发后自动移除
   * @description 注册只执行一次的事件监听，事件触发后自动注销
   * @example
   * EventBus.once('firstClick', function() {
   *   console.log('首次点击！');
   * });
   */
  EventBus.prototype.once = function(eventName, handler) {
    if (typeof handler !== 'function') {
      console.warn('[EventBus] handler must be a function:', eventName);
      return;
    }

    if (!this._onceListeners.has(eventName)) {
      this._onceListeners.set(eventName, new Set());
    }
    this._onceListeners.get(eventName).add(handler);
  };

  /**
   * 清除所有监听器（内存泄漏防护）
   * @description 清空所有已注册的事件监听器，用于模块卸载或重置场景
   * @example
   * // 切换场景时清理
   * EventBus.clear();
   */
  EventBus.prototype.clear = function() {
    this._listeners.clear();
    this._onceListeners.clear();
  };

  /**
   * 获取当前监听器数量统计
   * @returns {Object} 包含 listeners 和 onceListeners 的统计信息
   * @description 用于调试和监控，查看当前注册了多少监听器
   */
  EventBus.prototype.getStats = function() {
    var listenerCount = 0;
    var onceCount = 0;

    this._listeners.forEach(function(set) {
      listenerCount += set.size;
    });

    this._onceListeners.forEach(function(set) {
      onceCount += set.size;
    });

    return {
      eventTypes: this._listeners.size + this._onceListeners.size,
      listeners: listenerCount,
      onceListeners: onceCount,
      total: listenerCount + onceCount
    };
  };

  // ==================== 单例模式导出 ====================

  /**
   * EventBus 单例实例
   * @global
   * @type {EventBus}
   */
  var EventBus = new EventBus();

  // 防止外部修改实例
  Object.freeze(EventBus);

  // 导出到全局
  global.EventBus = EventBus;

})(typeof window !== 'undefined' ? window : this);
