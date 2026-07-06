// AI路径引导：如需查找相关代码路径，请先查阅 AI_PATH_GUIDE.md
// 每新增/修改一个文件后必须同步更新 AI_PATH_GUIDE.md
// ===== UI 工具函数（统一实现）=====
// 提供 showToast、escapeHtml、escapeAttr 等通用 UI 工具函数
// 必须在所有业务脚本之前加载

// ===== Toast 通知提示 =====
var toastTimer = null;
function showToast(msg, type) {
  type = type || 'info';
  var existing = document.getElementById('shopToast');
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  var toast = document.createElement('div');
  toast.id = 'shopToast';
  toast.style.cssText =
    'position:fixed;top:80px;left:50%;transform:translateX(-50%);' +
    'padding:10px 24px;border-radius:6px;font-size:14px;font-family:SimSun,serif;' +
    'z-index:9999;transition:opacity 0.3s;pointer-events:none;';

  if (type === 'error') {
    toast.style.background = 'rgba(192,57,43,0.95)';
    toast.style.color = '#fff';
    toast.style.border = '1px solid #c0392b';
  } else if (type === 'success') {
    toast.style.background = 'rgba(39,174,96,0.95)';
    toast.style.color = '#fff';
    toast.style.border = '1px solid #27ae60';
  } else {
    toast.style.background = 'rgba(212,131,10,0.95)';
    toast.style.color = '#fff';
    toast.style.border = '1px solid #d4830a';
  }

  toast.textContent = msg;
  document.body.appendChild(toast);

  // 激活 showToastAnim 动画（GSAP 不可用时由其内部 fallback 跳过）
  if (typeof showToastAnim === 'function') {
    showToastAnim(toast);
  }

  toastTimer = setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 300);
  }, 1500);
}

// ===== HTML 转义函数 =====
// 转义 & < > " ' 共 5 个字符，用于 HTML 文本内容
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 转义 & " ' < > 共 5 个字符，用于 HTML 属性值
function escapeAttr(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ===== 数字滚动动画工具 =====
// 从 fromVal 平滑过渡到 toVal， onUpdate 写入 element.textContent
// formatter 可选：自定义格式化函数（如加分隔符、单位等）
function animateNumber(element, fromVal, toVal, duration, formatter) {
  if (!window.gsap || !element) {
    element.textContent = (formatter ? formatter(toVal) : toVal);
    return;
  }
  var obj = { val: fromVal };
  gsap.to(obj, {
    val: toVal,
    duration: duration || 0.5,
    ease: 'power2.out',
    onUpdate: function() {
      element.textContent = formatter ? formatter(obj.val) : Math.round(obj.val);
    }
  });
}

// ===== 暴露给全局 =====
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.animateNumber = animateNumber;
// 向后兼容别名：main.js 和 panels.js 通过 window.escText 调用
window.escText = escapeHtml;
