// ==================== 动画系统 - 算法艺术 + GSAP ====================

// ========== 主菜单粒子背景 · 战后余烬（Aftermath Embers） ==========
// 算法表达：多层正弦流场驱动的粒子系统，模拟战场热上升气流中飘浮的火星与灰烬
var ParticleBG = (function() {
  var canvas, ctx, embers = [], ash = [], animId = null, resizeHandler = null;
  var time = 0;
  var W, H;

  // 多层正弦叠加流场 —— 模拟热气湍流
  function flowField(x, y, t) {
    return Math.sin(x * 0.007 + t * 0.35) * Math.cos(y * 0.005 - t * 0.28) * 0.5
         + Math.sin(x * 0.013 - t * 0.62) * 0.28
         + Math.cos(y * 0.011 + t * 0.45) * 0.22;
  }

  function spawnEmber(randomY) {
    var size = Math.random() * 2.2 + 0.6;
    var zone = Math.random();
    var startX, startY;
    if (randomY) {
      startX = Math.random() * W;
      startY = Math.random() * H;
    } else {
      // 底部集中生成，模拟地面余烬被热气卷起
      startX = Math.random() * W;
      startY = H + size + Math.random() * 40;
      if (zone > 0.85) { startX = Math.random() * W * 0.3 + W * 0.35; startY = H * 0.75 + Math.random() * H * 0.25; }
    }
    return {
      x: startX, y: startY,
      size: size,
      vx: 0, vy: -(Math.random() * 0.55 + 0.25 + size * 0.12),
      life: 0,
      lifeSpeed: Math.random() * 0.0012 + 0.0006,
      maxLife: Math.random() * 0.35 + 0.55,
      brightness: Math.random() * 0.35 + 0.65,
      hueShift: Math.random() * 20 - 5,
      phase: Math.random() * Math.PI * 2,
      flickerSpeed: Math.random() * 10 + 3,
      driftInfluence: Math.random() * 0.4 + 0.6
    };
  }

  function createEmbers() {
    embers = [];
    var count = Math.max(25, Math.floor(W * H / 25000));
    for (var i = 0; i < count; i++) embers.push(spawnEmber(true));
  }

  function createAsh() {
    ash = [];
    var count = Math.max(35, Math.floor(W * H / 18000));
    for (var i = 0; i < count; i++) {
      ash.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 1.0 + 0.25,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -(Math.random() * 0.18 + 0.04),
        alpha: Math.random() * 0.22 + 0.06,
        phase: Math.random() * Math.PI * 2,
        drift: Math.random() * 0.5 + 0.5
      });
    }
  }

  // ========== 余烬 sprite 预渲染（避免每帧 createRadialGradient 开销） ==========
  var emberSprites = [];
  function buildEmberSprites() {
    emberSprites = [];
    var sizes = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5];  // sprite 半径倍数
    for (var i = 0; i < sizes.length; i++) {
      var radius = Math.max(8, sizes[i] * 6);  // 基础半径
      var cnv = document.createElement('canvas');
      cnv.width = radius * 2;
      cnv.height = radius * 2;
      var c = cnv.getContext('2d');
      var cx = radius, cy = radius;
      // 预渲染发光渐变（绘制时通过 globalAlpha 调节明暗）
      var grad = c.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, 'rgba(255, 200, 80, 1)');
      grad.addColorStop(0.4, 'rgba(255, 150, 50, 0.6)');
      grad.addColorStop(1, 'rgba(255, 80, 20, 0)');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(cx, cy, radius, 0, Math.PI * 2);
      c.fill();
      emberSprites.push({ canvas: cnv, radius: radius });
    }
  }
  function getEmberSprite(size) {
    // 选择最接近的 sprite
    if (!emberSprites.length) buildEmberSprites();
    var best = emberSprites[0];
    var bestDiff = Math.abs(best.radius - size * 3.5);
    for (var i = 1; i < emberSprites.length; i++) {
      var diff = Math.abs(emberSprites[i].radius - size * 3.5);
      if (diff < bestDiff) { best = emberSprites[i]; bestDiff = diff; }
    }
    return best;
  }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    resizeHandler = function() {
      resize();
      createEmbers();
      createAsh();
    };
    window.addEventListener('resize', resizeHandler);
    createEmbers();
    createAsh();
    buildEmberSprites();
    start();
  }

  function resize() {
    if (!canvas) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width = rect.width;
    H = canvas.height = rect.height;
  }

  function updateEmbers() {
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      var n = flowField(e.x, e.y, time);
      e.vx += n * 0.014 * e.driftInfluence;
      e.vx *= 0.975;
      e.x += e.vx;
      e.y += e.vy;
      e.life += e.lifeSpeed;
      // 闪烁：亮度在基础值上叠加快速正弦波动
      var flicker = Math.sin(time * e.flickerSpeed + e.phase) * 0.08;
      e.brightness = Math.max(0.2, Math.min(1, e.brightness + flicker * 0.015));
      // 重生
      if (e.life > e.maxLife || e.y < -e.size * 3) {
        embers[i] = spawnEmber(false);
      }
      if (e.x < -e.size * 3) e.x = W + e.size;
      if (e.x > W + e.size * 3) e.x = -e.size;
    }
  }

  function updateAsh() {
    for (var i = 0; i < ash.length; i++) {
      var a = ash[i];
      var n = flowField(a.x, a.y, time * 0.6);
      a.x += a.vx + n * 0.008 * a.drift;
      a.y += a.vy;
      if (a.y < -4) { a.y = H + 4; a.x = Math.random() * W; }
      if (a.x < -4) a.x = W + 2;
      if (a.x > W + 4) a.x = -2;
    }
  }

  function drawEmbers() {
    ctx.save();
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      var lifeRatio = 1 - (e.life / e.maxLife);
      if (lifeRatio <= 0) continue;
      var alpha = lifeRatio * e.brightness;
      // 颜色从亮黄橙渐变为暗红
      var t = e.life / e.maxLife;
      var r = 255;
      var g = Math.floor(200 - t * 130 + e.hueShift);
      var b = Math.floor(80 - t * 60);
      var gx = e.x, gy = e.y;
      // 发光晕（使用预渲染 sprite，避免每帧 createRadialGradient）
      if (e.size > 1.2 && alpha > 0.25) {
        var sprite = getEmberSprite(e.size);
        ctx.save();
        ctx.globalAlpha = alpha * 0.35;
        // 通过 composite 进行着色绘制
        var drawSize = sprite.radius * 2 * (e.size * 3.5 / sprite.radius);
        ctx.drawImage(sprite.canvas, gx - drawSize/2, gy - drawSize/2, drawSize, drawSize);
        ctx.restore();
      }
      // 核心
      ctx.beginPath();
      ctx.arc(gx, gy, e.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + r + ',' + Math.max(0,g) + ',' + Math.max(0,b) + ',' + alpha + ')';
      ctx.fill();
      // 亮心
      if (alpha > 0.5 && e.size > 1.0) {
        ctx.beginPath();
        ctx.arc(gx, gy, e.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,240,200,' + (alpha * 0.6) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawAsh() {
    for (var i = 0; i < ash.length; i++) {
      var a = ash[i];
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
      var pulse = 0.55 + 0.45 * Math.sin(time * 0.4 + a.phase);
      ctx.fillStyle = 'rgba(170, 150, 120, ' + (a.alpha * pulse) + ')';
      ctx.fill();
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    time += 0.016;
    updateAsh();
    drawAsh();
    updateEmbers();
    drawEmbers();
    animId = requestAnimationFrame(animate);
  }

  function start() {
    if (!animId) animate();
  }

  function stop() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function destroy() {
    stop();
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
    embers = [];
    ash = [];
  }

  return { init: init, start: start, stop: stop, destroy: destroy };
})();

// ========== 页面过渡动画 ==========
var PageTransitions = (function() {
  var isTransitioning = false;
  var _currentPageAnim = null;

  // 预隐藏元素（防止渲染后再动画的闪烁）
  function prepareStagger(selector, parent) {
    if (!window.gsap) return;
    var container = parent || document;
    var items = container.querySelectorAll(selector);
    if (!items.length) return;
    gsap.set(items, { opacity: 0, y: 12 });
  }

  function slideIn(element, direction) {
    if (!element || !window.gsap) return;
    gsap.killTweensOf(element);
    var fromVars = { opacity: 0 };
    if (direction === 'up') fromVars.y = 20;
    else if (direction === 'down') fromVars.y = -20;
    else if (direction === 'left') fromVars.x = 20;
    else if (direction === 'right') fromVars.x = -20;
    else fromVars.y = 12;

    gsap.fromTo(element, fromVars, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.45,
      ease: 'power2.out'
    });
  }

  function fadeIn(element, duration) {
    if (!element || !window.gsap) return;
    gsap.killTweensOf(element);
    gsap.fromTo(element, { opacity: 0 }, {
      opacity: 1,
      duration: duration || 0.35,
      ease: 'power2.out'
    });
  }

  // 全局标志：跳过 stagger 动画（用于已访问过的页面）
  var _skipStagger = false;
  function setSkipStagger(val) { _skipStagger = val; }
  function getSkipStagger() { return _skipStagger; }

  function staggerItems(selector, parent, delay) {
    if (!window.gsap) return;
    // 如果全局标志要求跳过动画，直接设置最终状态
    if (_skipStagger) {
      var container = parent || document;
      var items = container.querySelectorAll(selector);
      if (items.length) gsap.set(items, { opacity: 1, y: 0 });
      return;
    }
    var container = parent || document;
    var items = container.querySelectorAll(selector);
    if (!items.length) return;

    // 先设置初始状态，防止闪烁
    gsap.set(items, { opacity: 0, y: 12 });

    gsap.to(items, {
      opacity: 1,
      y: 0,
      duration: 0.4,
      stagger: 0.06,
      delay: delay || 0,
      ease: 'power2.out',
      overwrite: true
    });
  }

  function pageTransition(oldPage, newPage, options) {
    if (isTransitioning) {
      if (oldPage) oldPage.classList.remove('active');
      if (newPage) newPage.classList.add('active');
      var fallbackVisible = typeof options === 'function' ? options : (options && options.onVisible);
      var fallbackComplete = options && options.onComplete;
      try { if (fallbackVisible) fallbackVisible(); } catch(e) {}
      try { if (fallbackComplete) fallbackComplete(); } catch(e) {}
      return;
    }
    isTransitioning = true;

    var oldEl = oldPage;
    var newEl = newPage;
    var onVisible = typeof options === 'function' ? options : (options && options.onVisible);
    var onComplete = options && options.onComplete;

    var oldOrigWillChange = oldEl ? oldEl.style.willChange : '';
    var oldOrigTransform = oldEl ? oldEl.style.transform : '';
    var newOrigWillChange = newEl ? newEl.style.willChange : '';
    var newOrigTransform = newEl ? newEl.style.transform : '';

    document.body.classList.add('transition-active');
    if (oldEl) {
      oldEl.style.willChange = 'opacity, transform';
      oldEl.style.transform = 'translateZ(0)';
    }
    if (newEl) {
      newEl.style.willChange = 'opacity, transform';
      newEl.style.transform = 'translateZ(0)';
    }

    function cleanupPerformance() {
      document.body.classList.remove('transition-active');
      if (oldEl) {
        oldEl.style.willChange = oldOrigWillChange;
        if (oldEl.style.transform === 'translateZ(0)') {
          oldEl.style.transform = oldOrigTransform;
        }
      }
      if (newEl) {
        newEl.style.willChange = newOrigWillChange;
        if (newEl.style.transform === 'translateZ(0)') {
          newEl.style.transform = newOrigTransform;
        }
      }
    }

    function safeComplete() {
      cleanupPerformance();
      try {
        if (onComplete) onComplete();
      } catch(e) {
        console.warn('[Transition] onComplete error:', e);
      }
      isTransitioning = false;
    }

    function safeVisible() {
      try {
        if (onVisible) onVisible();
      } catch(e) {
        console.warn('[Transition] onVisible error:', e);
      }
    }

    if (oldEl && newEl && window.gsap) {
      gsap.killTweensOf(newEl);
      gsap.set(newEl, { opacity: 0, y: 8 });

      gsap.to(oldEl, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: function() {
          if (oldEl) {
            oldEl.classList.remove('active');
            gsap.set(oldEl, { opacity: 1, y: 0 });
          }
          if (newEl) {
            newEl.classList.add('active');
            safeVisible();
            gsap.to(newEl, {
              opacity: 1,
              y: 0,
              duration: 0.28,
              ease: 'power2.out',
              onComplete: function() {
                safeComplete();
              }
            });
          } else {
            safeComplete();
          }
        }
      });
    } else {
      if (oldEl) oldEl.classList.remove('active');
      if (newEl) newEl.classList.add('active');
      safeVisible();
      safeComplete();
    }
  }

  return {
    slideIn: slideIn,
    fadeIn: fadeIn,
    staggerItems: staggerItems,
    prepareStagger: prepareStagger,
    pageTransition: pageTransition,
    setSkipStagger: setSkipStagger,
    getSkipStagger: getSkipStagger
  };
})();

// ========== 召唤动画 ==========
var SummonAnimations = (function() {
  function createSummonEffect(container, callback) {
    if (!container || !window.gsap) {
      if (callback) callback();
      return;
    }

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(20,15,10,0.85);z-index:3000;display:flex;align-items:center;justify-content:center;opacity:0;';
    overlay.innerHTML = '<div id="summonRitual" style="position:relative;width:300px;height:300px;">' +
      '<div id="summonRing" style="position:absolute;inset:0;border:3px solid #d4a017;border-radius:50%;opacity:0;"></div>' +
      '<div id="summonRing2" style="position:absolute;inset:20px;border:2px solid #c4a060;border-radius:50%;opacity:0;"></div>' +
      '<div id="summonCore" style="position:absolute;inset:80px;background:radial-gradient(circle,rgba(212,160,23,0.8),transparent);border-radius:50%;opacity:0;"></div>' +
      '<div id="summonRunes" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:60px;opacity:0;">📯</div>' +
    '</div>';
    document.body.appendChild(overlay);

    var tl = gsap.timeline({
      onComplete: function() {
        setTimeout(function() {
          gsap.to(overlay, {
            opacity: 0,
            duration: 0.4,
            onComplete: function() {
              overlay.remove();
              if (callback) callback();
            }
          });
        }, 300);
      }
    });

    tl.to(overlay, { opacity: 1, duration: 0.3 })
      .fromTo('#summonRing', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.1)
      .fromTo('#summonRing2', { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 0.6, duration: 0.5, ease: 'power2.out' }, 0.2)
      .fromTo('#summonCore', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.5)' }, 0.3)
      .fromTo('#summonRunes', { scale: 0.5, opacity: 0, rotation: -180 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.6, ease: 'power3.out' }, 0.4)
      .to('#summonRing', { rotation: 360, duration: 1.5, ease: 'none', repeat: 1 }, 0.5)
      .to('#summonRing2', { rotation: -360, duration: 1.5, ease: 'none', repeat: 1 }, 0.5)
      .to('#summonCore', { scale: 1.3, opacity: 0.8, duration: 0.4, ease: 'power2.inOut', yoyo: true, repeat: 1 }, 0.6)
      .to('#summonRunes', { scale: 1.5, duration: 0.3, ease: 'power2.out' }, 1.6);
  }

  function revealCard(cardElement) {
    if (!cardElement || !window.gsap) return;
    gsap.fromTo(cardElement,
      { opacity: 0, scale: 0.5, rotationY: 90 },
      {
        opacity: 1,
        scale: 1,
        rotationY: 0,
        duration: 0.6,
        ease: 'back.out(1.4)'
      }
    );
  }

  return { createSummonEffect: createSummonEffect, revealCard: revealCard };
})();

// ========== Toast 动画 ==========
function showToastAnim(toastEl) {
  if (!toastEl || !window.gsap) return;
  gsap.fromTo(toastEl,
    { opacity: 0, y: -20, scale: 0.9 },
    { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.4)' }
  );
}

// ========== 初始化 ==========
window.ParticleBG = ParticleBG;
window.PageTransitions = PageTransitions;
window.SummonAnimations = SummonAnimations;
window.showToastAnim = showToastAnim;

// ========== 伤害飘字对象池（减少 DOM 创建开销） ==========
var _dmgPool = [];
var _DMG_POOL_MAX = 20;
function getDmgElement() {
  // 优先复用池中已释放的元素
  for (var i = 0; i < _dmgPool.length; i++) {
    if (_dmgPool[i]._inUse === false) {
      _dmgPool[i]._inUse = true;
      _dmgPool[i].style.display = '';
      return _dmgPool[i];
    }
  }
  // 池未满则新建
  if (_dmgPool.length < _DMG_POOL_MAX) {
    var el = document.createElement('div');
    el._inUse = true;
    _dmgPool.push(el);
    return el;
  }
  // 池已满 - 复用最早的元素
  var oldest = _dmgPool[0];
  oldest._inUse = true;
  oldest.style.display = '';
  return oldest;
}
function releaseDmgElement(el) {
  el._inUse = false;
  el.style.display = 'none';
  // 从父节点卸载但保留在池中
  if (el.parentNode) el.parentNode.removeChild(el);
}

// ========== 冲击波（DOM 叠加层，用于非 canvas 上下文；canvas 波纹由 hex-board.js 管理） ==========
function showImpactWave(x, y, parentEl) {
  if (!window.gsap || !parentEl) return;
  var wave = document.createElement('div');
  wave.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;' +
    'width:20px;height:20px;border-radius:50%;border:2px solid #d4a017;' +
    'transform:translate(-50%,-50%) scale(0.3);opacity:0.8;pointer-events:none;z-index:100;';
  parentEl.appendChild(wave);
  gsap.to(wave, {
    scale: 2.5,
    opacity: 0,
    duration: 0.4,
    ease: 'power2.out',
    onComplete: function() { if (wave.parentNode) wave.parentNode.removeChild(wave); }
  });
}

// ========== 战斗伤害飘字（DOM 浮动数字，向上飘+缩放+淡出，GSAP增强动画） ==========
function showDamageNumber(hex, text, type) {
  if(!LO) return;
  var wrap = document.getElementById('boardDropZone');
  if(!wrap) return;
  var p = hPx(hex.q, hex.r, HS);
  var cx = p.x + LO.ox;
  var cy = p.y + LO.oy;

  // 战斗闪光效果
  if (type === 'crit' || type === 'routed') {
    var flash = document.createElement('div');
    flash.className = 'combat-flash';
    flash.style.left = cx + 'px';
    flash.style.top = cy + 'px';
    wrap.appendChild(flash);
    if (window.gsap) {
      gsap.fromTo(flash,
        { opacity: 0, scale: 0.5 },
        {
          opacity: 1,
          scale: 1.5,
          duration: 0.15,
          ease: 'power2.out',
          onComplete: function() {
            gsap.to(flash, {
              opacity: 0,
              scale: 2,
              duration: 0.3,
              ease: 'power2.in',
              onComplete: function() { flash.remove(); }
            });
          }
        }
      );
    } else {
      setTimeout(function(){ if(flash.parentNode) flash.parentNode.removeChild(flash); }, 400);
    }
  }

  // 从对象池获取元素（避免每帧创建 DOM）
  var el = getDmgElement();
  // 重置内联样式（清除上一轮 GSAP 残留的 transform/opacity/filter）
  el.style.cssText = '';
  el.className = 'dmg-num dmg-' + (type || 'normal');
  el.textContent = text;
  el.style.left = cx + 'px';
  el.style.top = cy + 'px';
  wrap.appendChild(el);

  // 使用GSAP动画（如果可用）
  if (window.gsap) {
    var offsetX = (Math.random() - 0.5) * 30;
    var riseDist = type === 'crit' ? 80 : 60;
    var duration = type === 'crit' ? 1.8 : 1.4;

    gsap.fromTo(el,
      { opacity: 0, y: 0, scale: 0.4, x: offsetX * 0.3 },
      {
        opacity: 1,
        y: -riseDist * 0.5,
        scale: type === 'crit' ? 1.3 : 1.1,
        x: offsetX,
        duration: 0.25,
        ease: 'back.out(2)'
      }
    );
    gsap.to(el, {
      y: -riseDist,
      scale: 0.9,
      duration: duration * 0.6,
      delay: 0.25,
      ease: 'power1.out'
    });
    gsap.to(el, {
      opacity: 0,
      duration: duration * 0.3,
      delay: duration * 0.7,
      ease: 'power2.in',
      onComplete: function() { releaseDmgElement(el); }
    });
  } else {
    setTimeout(function(){ releaseDmgElement(el); }, 1500);
  }
}
window.showDamageNumber = showDamageNumber;
window.showImpactWave = showImpactWave;
