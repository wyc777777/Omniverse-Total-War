// AI路径引导：如需查找其他文件路径和功能说明，请先查看项目根目录的 AI_PATH_GUIDE.md；每新增/修改一个文件后，必须同步更新AI_PATH_GUIDE.md
// ==================== 棋盘引擎 ====================
const RADIUS=5,HS=46,SQRT3=Math.sqrt(3),PAD=70;
const hexes=(function(){var h=[];for(var q=-RADIUS;q<=RADIUS;q++)for(var r=-RADIUS;r<=RADIUS;r++){var s=-q-r;if(Math.abs(s)<=RADIUS)h.push({q:q,r:r,s:s})}return h})();
var canvas=null,ctx=null,LO=null,initDone=false;

// ===== 帧率优化：脏标记 / 离屏缓存 / stats 缓存 =====
var _needsRender = false;
function requestRender(){ _needsRender = true; }

var _bgCanvas = null, _bgCtx = null;
function buildBackgroundCache(){
  if(!ctx||!LO) return;
  _bgCanvas = document.createElement('canvas');
  _bgCanvas.width = LO.w;
  _bgCanvas.height = LO.h;
  _bgCtx = _bgCanvas.getContext('2d');
  // 仅渲染静态六边形网格（填充+描边+坐标轴标记），跳过棋子/高亮/动画
  hexes.forEach(function(h){
    var p=hPx(h.q,h.r,HS),cx=p.x+LO.ox,cy=p.y+LO.oy,crs=hCrn(cx,cy);
    _bgCtx.beginPath();
    crs.forEach(function(pt,i){i===0?_bgCtx.moveTo(pt.x,pt.y):_bgCtx.lineTo(pt.x,pt.y)});
    _bgCtx.closePath();
    var d=hDist(h,{q:0,r:0,s:0});
    var rT=Math.round(165+30*(1-d/RADIUS)),gT=Math.round(145+25*(1-d/RADIUS)),bT=Math.round(115+20*(1-d/RADIUS));
    var fill,stroke,sw;
    if(d===0){fill='rgba(180,160,110,0.5)';stroke='#8b6914';sw=2}
    else if(d<=1&&typeof TurnState!=='undefined'&&TurnState.phase==='deploy'){fill='rgba(200,150,130,0.45)';stroke='rgba(180,80,40,0.4)';sw=1}
    else{fill='rgba('+rT+','+gT+','+bT+',0.7)';stroke='#c4b290';sw=1}
    _bgCtx.fillStyle=fill;_bgCtx.fill();
    _bgCtx.strokeStyle=stroke;_bgCtx.lineWidth=sw;_bgCtx.stroke();
  });
}
function invalidateBackgroundCache(){ _bgCanvas=null; }

var _unitImgCache = {};
function getCachedUnitImage(unitType,team){
  var key=unitType+'|'+team;
  if(_unitImgCache[key]) return _unitImgCache[key];
  var u=getUnit(unitType);
  if(!u) return null;
  var img=UI[u.image];
  if(!img||!img.complete||img.naturalWidth<=0) return null;
  var isz=36;
  var cnv=document.createElement('canvas');
  cnv.width=isz;cnv.height=isz;
  var c=cnv.getContext('2d');
  c.save();
  c.beginPath();c.arc(isz/2,isz/2,isz/2,0,Math.PI*2);c.clip();
  c.drawImage(img,0,0,isz,isz);
  c.fillStyle=team==='player'?'rgba(107,142,35,0.18)':'rgba(139,37,0,0.18)';
  c.fillRect(0,0,isz,isz);
  c.restore();
  c.beginPath();c.arc(isz/2,isz/2,isz/2,0,Math.PI*2);
  c.strokeStyle=team==='player'?'#6b8e23':'#8b2500';c.lineWidth=2;c.stroke();
  _unitImgCache[key]=cnv;
  return cnv;
}
function invalidateUnitImageCache(unitType){
  if(unitType){
    Object.keys(_unitImgCache).forEach(function(k){
      if(k.indexOf(unitType+'|')===0) delete _unitImgCache[k];
    });
  } else { _unitImgCache={}; }
}

var _statsCache = {};
function getCachedStats(unitDef){
  if(!unitDef||!unitDef.type) return null;
  if(_statsCache[unitDef.type]) return _statsCache[unitDef.type];
  var stats=(typeof computeStats==='function')?computeStats(unitDef):null;
  if(stats) _statsCache[unitDef.type]=stats;
  return stats;
}
function invalidateStatsCache(unitType){
  if(unitType) delete _statsCache[unitType];
  else _statsCache={};
}

// ===== 动作一：棋盘入场序列 =====
var _boardEntryAnim = null;
function startBoardEntryAnim(){
  _boardEntryAnim = { active:true, startTime:performance.now() };
  requestRender();
  setTimeout(function(){
    if(_boardEntryAnim) _boardEntryAnim.active=false;
    requestRender();
  }, 1300);
}

// ===== 动作二：棋子苏醒选择反馈 =====
var _selectAnim = null;
function startSelectAnim(pieceKey){
  var piece = placedPieces[pieceKey];
  if(!piece) return;
  _selectAnim = { active:true, key:pieceKey, startTime:performance.now(), rings:{} };
  _selectAnim.rings[pieceKey] = { start:performance.now(), phase:'expand' };
  requestRender();
  setTimeout(function(){
    if(_selectAnim && _selectAnim.key===pieceKey){
      _selectAnim.active=false;
      if(_selectAnim.rings[pieceKey]) _selectAnim.rings[pieceKey].phase='pulse';
    }
    requestRender();
  }, 450);
}
function stopSelectAnim(){
  if(_selectAnim){
    _selectAnim.active=false;
    _selectAnim.rings={};
  }
  requestRender();
}

// ===== 动作三：攻击冲击动作 =====
var _shakeAtkHex = null;
var _impactWaves = [];
function startAttackImpact(atkPieceKey, defHex){
  var piece = placedPieces[atkPieceKey];
  if(!piece||!piece.hex) return;
  var dir = getDirectionBetween(piece.hex, defHex);
  var dirAngle = HEX_DIRS[dir].angle * Math.PI / 180;
  _shakeAtkHex = { active:true, key:atkPieceKey, angle:dirAngle, startTime:performance.now(), duration:250 };
  if(LO){
    var p = hPx(defHex.q, defHex.r, HS);
    _impactWaves.push({ x:p.x+LO.ox, y:p.y+LO.oy, startTime:performance.now(), duration:400 });
  }
  requestRender();
  setTimeout(function(){
    if(_shakeAtkHex && _shakeAtkHex.key===atkPieceKey) _shakeAtkHex.active=false;
    requestRender();
  }, 260);
}

// ===== 棋子放置/回收反馈 =====
var _placeAnim = null;
function startPlaceAnim(pieceKey){
  _placeAnim = { active:true, key:pieceKey, startTime:performance.now(), duration:300 };
  var piece = placedPieces[pieceKey];
  if(piece && piece.hex && LO){
    var p = hPx(piece.hex.q, piece.hex.r, HS);
    _impactWaves.push({ x:p.x+LO.ox, y:p.y+LO.oy, startTime:performance.now(), duration:300, isPlace:true });
  }
  requestRender();
  setTimeout(function(){
    if(_placeAnim && _placeAnim.key===pieceKey) _placeAnim.active=false;
    requestRender();
  }, 320);
}
function startRecycleAnim(pieceKey){
  _placeAnim = { active:true, key:pieceKey, startTime:performance.now(), duration:250, isRecycle:true };
  requestRender();
  setTimeout(function(){
    if(_placeAnim && _placeAnim.key===pieceKey) _placeAnim.active=false;
    requestRender();
  }, 260);
}

// ===== 移动动画系统 =====
var _moveAnimations = [];

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function startPieceMoveAnim(pieceKey, fromHex, toHex, duration, onComplete) {
  var piece = placedPieces[pieceKey];
  if (!piece) return;
  piece._animating = true;
  piece._animFrom = { q: fromHex.q, r: fromHex.r, s: fromHex.s };
  piece._animTo = { q: toHex.q, r: toHex.r, s: toHex.s };
  piece._animStart = performance.now();
  piece._animDuration = duration || 280;
  piece._animEasing = 'easeOutCubic';
  // 移除同 pieceKey 的旧动画（避免 NaN 坐标）
  for (var i = _moveAnimations.length - 1; i >= 0; i--) {
    if (_moveAnimations[i].key === pieceKey) {
      _moveAnimations.splice(i, 1);
    }
  }
  _moveAnimations.push({
    key: pieceKey,
    piece: piece,
    onComplete: onComplete || null
  });
}

function updateMoveAnimations(now) {
  for (var i = _moveAnimations.length - 1; i >= 0; i--) {
    var anim = _moveAnimations[i];
    var piece = anim.piece;
    var elapsed = now - piece._animStart;
    var progress = Math.min(1, elapsed / piece._animDuration);
    var eased = easeOutCubic(progress);
    piece._animProgress = eased;
    if (progress >= 1) {
      piece._animating = false;
      piece._animProgress = 1;
      delete piece._animFrom;
      delete piece._animTo;
      delete piece._animStart;
      delete piece._animDuration;
      delete piece._animEasing;
      if (anim.onComplete) {
        try { anim.onComplete(); } catch(e) {}
      }
      _moveAnimations.splice(i, 1);
    }
  }
  return _moveAnimations.length > 0;
}

function getAnimHexPos(piece) {
  if (!piece._animating || !piece._animFrom || !piece._animTo) return null;
  var t = piece._animProgress || 0;
  var fq = piece._animFrom.q + (piece._animTo.q - piece._animFrom.q) * t;
  var fr = piece._animFrom.r + (piece._animTo.r - piece._animFrom.r) * t;
  var fs = -fq - fr;
  return { q: fq, r: fr, s: fs };
}

function getAnimHexKey(piece) {
  if (!piece._animating) return null;
  var hp = getAnimHexPos(piece);
  if (!hp) return null;
  return hp.q.toFixed(3) + ',' + hp.r.toFixed(3) + ',' + hp.s.toFixed(3);
}

function isAnyPieceAnimating() {
  for (var i = 0; i < _moveAnimations.length; i++) {
    if (_moveAnimations[i].piece._animating) return true;
  }
  return false;
}

function getPieceAtHexForRender(h) {
  var key = h.q + ',' + h.r + ',' + h.s;
  if (placedPieces[key] && !placedPieces[key]._animating) {
    return placedPieces[key];
  }
  return null;
}

function drawAnimatingPiecesOnCanvas() {
  for (var i = 0; i < _moveAnimations.length; i++) {
    var anim = _moveAnimations[i];
    var piece = anim.piece;
    if (!piece._animating) continue;
    var ahp = getAnimHexPos(piece);
    if (!ahp) continue;
    var p = hPx(ahp.q, ahp.r, HS);
    var acx = p.x + LO.ox;
    var acy = p.y + LO.oy;
    var scale = HS * 0.88;
    // 移动动画中的棋子带半透明拖影效果
    ctx.save();
    ctx.globalAlpha = 0.85;
    drawUnitOnCanvas(acx, acy, piece.unitType, piece.team, scale);
    ctx.restore();
    // 移动方向指示
    if (piece._animProgress < 0.9) {
      ctx.save();
      ctx.globalAlpha = 0.3 * (1 - piece._animProgress);
      var trailP = hPx(
        piece._animFrom.q + (piece._animTo.q - piece._animFrom.q) * Math.max(0, piece._animProgress - 0.15),
        piece._animFrom.r + (piece._animTo.r - piece._animFrom.r) * Math.max(0, piece._animProgress - 0.15),
        HS
      );
      drawUnitOnCanvas(trailP.x + LO.ox, trailP.y + LO.oy, piece.unitType, piece.team, scale * 0.7);
      ctx.restore();
    }
  }
}

// ===== 六边形方向常量（0-5，顺时针从右开始）=====
// 方向0: 右    (q+1, r)
// 方向1: 右上  (q+1, r-1)
// 方向2: 左上  (q,   r-1)
// 方向3: 左    (q-1, r)
// 方向4: 左下  (q-1, r+1)
// 方向5: 右下  (q,   r+1)
const HEX_DIRS = [
  { q: +1, r: 0,   angle: 0 },
  { q: +1, r: -1,  angle: -60 },
  { q: 0,  r: -1,  angle: -120 },
  { q: -1, r: 0,   angle: 180 },
  { q: -1, r: +1,  angle: 120 },
  { q: 0,  r: +1,  angle: 60 }
];

// ===== 朝向工具函数 =====

// 计算从 fromHex 指向 toHex 的方向（返回0-5方向编号）
// 如果有多个方向得分相同，选更靠近棋盘中心的方向
function getDirectionBetween(fromHex, toHex) {
  var dq = toHex.q - fromHex.q;
  var dr = toHex.r - fromHex.r;
  var ds = -dq - dr;

  // 找主要方向（绝对值最大的轴）
  var maxAbs = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
  if (maxAbs === 0) return 0;
  var nq = dq / maxAbs;
  var nr = dr / maxAbs;

  // 找最接近的方向
  var tied = [];  // 收集所有并列最佳方向
  var bestDot = -Infinity;
  for (var i = 0; i < 6; i++) {
    var d = HEX_DIRS[i];
    var dot = nq * d.q + nr * d.r + (-nq - nr) * (-d.q - d.r);
    if (dot > bestDot) { bestDot = dot; tied = [i]; }
    else if (dot === bestDot) { tied.push(i); }
  }

  // 无歧义：直接返回
  if (tied.length === 1) return tied[0];

  // 有歧义（如from(0,0)→to(1,1)：方向0和5得分相同）
  // tiebreaker：选方向指向更靠近棋盘中心
  var best = tied[0];
  var bestDist = Infinity;
  for (var j = 0; j < tied.length; j++) {
    var dir = HEX_DIRS[tied[j]];
    var hq = fromHex.q + dir.q;
    var hr = fromHex.r + dir.r;
    var dist = Math.abs(hq) + Math.abs(hr) + Math.abs(-hq - hr);
    if (dist < bestDist) { bestDist = dist; best = tied[j]; }
  }
  return best;
}

// 计算朝向棋盘中心的方向（放置棋子时用）
function getFacingToCenter(hex) {
  var center = { q: 0, r: 0, s: 0 };
  // 如果就在中心，默认朝右
  if (hex.q === 0 && hex.r === 0) return 0;
  return getDirectionBetween(hex, center);
}

// 判断攻击来自哪个方位（相对于防御方的朝向）
// 返回: 'front' | 'flank' | 'rear'
function getAttackAzimuth(atkHex, defHex, defFacing) {
  var atkDir = getDirectionBetween(defHex, atkHex);
  // 攻击方向与朝向的差值（顺时针）
  var diff = (atkDir - defFacing + 6) % 6;
  // 0=正面, 1和5=侧面, 2/3/4=背面
  if (diff === 0) return 'front';
  if (diff === 1 || diff === 5) return 'flank';
  return 'rear';
}

// ===== 状态系统 =====

// 给棋子添加状态
function addPieceStatus(piece, statusName, turns, icon, color) {
  if (!piece._statuses) piece._statuses = {};
  piece._statuses[statusName] = { turns: turns, icon: icon, color: color };
}

// 移除棋子状态
function removePieceStatus(piece, statusName) {
  if (piece._statuses && piece._statuses[statusName]) {
    delete piece._statuses[statusName];
  }
}

// 检查棋子是否有某状态
function hasPieceStatus(piece, statusName) {
  return piece._statuses && piece._statuses[statusName];
}

// 所有状态回合数-1，过期的移除
function tickStatuses(piece) {
  if (!piece._statuses) return;
  var expired = [];
  Object.keys(piece._statuses).forEach(function(name) {
    piece._statuses[name].turns--;
    if (piece._statuses[name].turns <= 0) expired.push(name);
  });
  expired.forEach(function(name) { delete piece._statuses[name]; });
}
function ensureCtx(){
  if(initDone)return !!ctx;
  canvas=document.getElementById('boardCanvas');
  if(!canvas)return false;
  ctx=canvas.getContext('2d');
  // 计算画布尺寸
  var mnX=1/0,mxX=-1/0,mnY=1/0,mxY=-1/0;
  hexes.forEach(function(h){var p=hPx(h.q,h.r,HS);mnX=Math.min(mnX,p.x-HS);mxX=Math.max(mxX,p.x+HS);mnY=Math.min(mnY,p.y-HS);mxY=Math.max(mxY,p.y+HS)});
  LO={ox:PAD-mnX,oy:PAD-mnY,w:mxX-mnX+PAD*2,h:mxY-mnY+PAD*2};
  canvas.width=LO.w;canvas.height=LO.h;
  initDone=true;
  buildBackgroundCache();
  return true;
}

let showAxes=true, hoveredHex=null, selectedPieceKey=null;
const placedPieces={};

function hPx(q,r,size){return{x:size*SQRT3*(q+r/2),y:size*3/2*r}}
function hDist(a,b){return Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.s-b.s))}

function hCrn(cx,cy){var p=[];for(var i=0;i<6;i++){var a=Math.PI/180*(60*i-30);p.push({x:cx+HS*Math.cos(a),y:cy+HS*Math.sin(a)})}return p}

function drawUnitOnCanvas(cx,cy,unitType,team,s){
  var u=getUnit(unitType);if(!u)return;var sc=s/HS;
  // 优先使用缓存的单位图像（含圆形裁剪+底色+边框，离屏 canvas 预渲染）
  var cached=getCachedUnitImage(unitType,team);
  if(cached){
    var drawSize=36*sc;
    ctx.save();ctx.translate(cx,cy);
    ctx.drawImage(cached,-drawSize/2,-drawSize/2,drawSize,drawSize);
    ctx.restore();
    return;
  }
  var img=UI[u.image];
  ctx.save();ctx.translate(cx,cy);ctx.scale(sc,sc);
  if(img&&img.complete&&img.naturalWidth>0){
    var isz=36;ctx.save();ctx.beginPath();ctx.arc(0,0,isz/2,0,Math.PI*2);ctx.clip();
    ctx.drawImage(img,-isz/2,-isz/2,isz,isz);
    ctx.fillStyle=team==='player'?'rgba(107,142,35,0.18)':'rgba(139,37,0,0.18)';ctx.fillRect(-isz/2,-isz/2,isz,isz);
    ctx.restore();ctx.beginPath();ctx.arc(0,0,isz/2,0,Math.PI*2);
    ctx.strokeStyle=team==='player'?'#6b8e23':'#8b2500';ctx.lineWidth=2;ctx.stroke();
  }else{
    ctx.fillStyle=team==='player'?'#6b8e23':'#8b2500';ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♟',0,0);
  }
  ctx.restore();
}

// 绘制朝向三角形（小三角，在六边形边缘外侧）
function drawFacingTriangle(cx, cy, facing, team) {
  var dir = HEX_DIRS[facing] || HEX_DIRS[0];
  var angle = dir.angle * Math.PI / 180;
  // 三角形放在六边形外边缘
  var r = HS * 0.82 - 6; // 向中心挪动6像素
  var triSize = 18; // 小三角形，清晰可见且不遮挡图标（再放大一倍）

  // 顶点朝外
  var tipX = cx + Math.cos(angle) * (r + triSize * 0.5);
  var tipY = cy + Math.sin(angle) * (r + triSize * 0.5);

  // 底边两个点（在六边形边缘上）
  var baseAngle1 = angle + Math.PI / 2; // +90度
  var baseAngle2 = angle - Math.PI / 2; // -90度
  var baseX1 = cx + Math.cos(baseAngle1) * triSize + Math.cos(angle) * r;
  var baseY1 = cy + Math.sin(baseAngle1) * triSize + Math.sin(angle) * r;
  var baseX2 = cx + Math.cos(baseAngle2) * triSize + Math.cos(angle) * r;
  var baseY2 = cy + Math.sin(baseAngle2) * triSize + Math.sin(angle) * r;

  var color = team === 'player' ? '#4fc3f7' : '#ff7043';

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseX1, baseY1);
  ctx.lineTo(baseX2, baseY2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// 绘制状态图标（含弓兵近战封锁动态检测）
function drawStatusIcons(cx, cy, piece) {
  // 弓兵近战封锁 —— 动态检测相邻敌军
  var showMeleeBan = false;
  if (piece.unitType && typeof unitDefByType === 'function' && typeof placedPieces !== 'undefined' && typeof hDist === 'function') {
    var ud = unitDefByType(piece.unitType);
    if (ud && ud.type === 'archer') {
      Object.keys(placedPieces).forEach(function(k) {
        var p = placedPieces[k];
        if (p.team !== piece.team && !p._routed && hDist(piece.hex, p.hex) <= 1) showMeleeBan = true;
      });
    }
  }

  var hasStatuses = piece._statuses && Object.keys(piece._statuses).length > 0;
  if (!hasStatuses && !showMeleeBan) return;

  // 收集所有要绘制的图标
  var icons = [];
  if (hasStatuses) {
    Object.keys(piece._statuses).forEach(function(name) {
      icons.push({ icon: piece._statuses[name].icon, color: piece._statuses[name].color });
    });
  }
  if (showMeleeBan) {
    icons.push({ icon: '🚫', color: '#ff0000' });
  }

  var iconSize = 12;
  var gap = 2;
  var totalW = icons.length * iconSize + (icons.length - 1) * gap;
  var startX = cx - totalW / 2;
  var y = cy - HS * 0.42;

  icons.forEach(function(item, i) {
    var x = startX + i * (iconSize + gap);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + iconSize/2, y + iconSize/2, iconSize/2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    ctx.strokeStyle = item.color || '#888';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = item.color || '#fff';
    ctx.fillText(item.icon || '?', x + iconSize/2, y + iconSize/2 + 1);
    ctx.restore();
  });
}

function drawHex(h,hl){
  var p=hPx(h.q,h.r,HS),cx=p.x+LO.ox,cy=p.y+LO.oy,crs=hCrn(cx,cy);
  ctx.beginPath();crs.forEach(function(pt,i){i===0?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y)});ctx.closePath();
  var d=hDist(h,{q:0,r:0,s:0}),key=h.q+','+h.r+','+h.s,hasP=placedPieces[key];
  var isAnimating=hasP&&placedPieces[key]._animating;
  var isRouted=hasP&&placedPieces[key]._routed;
  var isAxis=(h.q===0||h.r===0||h.s===0)&&!hasP;

  // ===== 地形渲染 =====
  var terrainType = (typeof getTerrainType === 'function') ? getTerrainType(h) : null;
  if (terrainType) {
    if (terrainType === 'lake') {
      // 湖泊：水的颜色，白字标注"湖泊"
      ctx.fillStyle = 'rgba(60,140,220,0.85)';
      ctx.fill();
      ctx.strokeStyle = '#2a6bb5';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 绘制"湖泊"文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('湖泊', cx, cy);
      return; // 地形格不画棋子
    } else if (terrainType === 'mountain') {
      // 山脉：深土棕色，标注"山脉"
      ctx.fillStyle = 'rgba(120,90,50,0.85)';
      ctx.fill();
      ctx.strokeStyle = '#6b4e2a';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 绘制"山脉"文字
      ctx.fillStyle = '#f0e6d0';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('山脉', cx, cy);
      return; // 地形格不画棋子
    }
  }

  var rT=Math.round(165+30*(1-d/RADIUS)),gT=Math.round(145+25*(1-d/RADIUS)),bT=Math.round(115+20*(1-d/RADIUS));
  var fill,stroke,sw;
  if(isAnimating){fill='rgba('+rT+','+gT+','+bT+',0.7)';stroke='#b8a080';sw=1.2}
  else if(hl==='sp'){fill='rgba(180,160,120,0.7)';stroke='#8b6914';sw=3}
  else if(hl==='mv'){fill='rgba(160,190,140,0.55)';stroke='#6b8e23';sw=2.2}
  else if(hl==='atk'){fill='rgba(190,140,130,0.5)';stroke='#cc3333';sw=2}
  else if(hasP){fill='rgba('+rT+','+gT+','+bT+',0.7)';stroke='#b8a080';sw=1.2}
  else if(d===0){fill='rgba(180,160,110,0.5)';stroke='#8b6914';sw=2}
  else if(hl==='hv'){fill='rgba(180,145,100,0.5)';stroke='#6b8e23';sw=2}
  else if(d<=1&&TurnState.phase==='deploy'){fill='rgba(200,150,130,0.45)';stroke='rgba(180,80,40,0.4)';sw=1}
  else{fill='rgba('+rT+','+gT+','+bT+',0.7)';stroke='#c4b290';sw=1}
  ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();
  if(hasP){
    if(isAnimating){
      // 正在动画中：不在此格绘制棋子，稍后由 drawAnimatingPiecesOnCanvas 绘制
    }else{
      // 行动完毕灰化效果
      var done = placedPieces[key]._actionUsedThisTurn && placedPieces[key]._attackedThisTick;
      var scale = HS * 0.88;
      // 悬停放大效果
      if(hl==='hv') scale = HS * 0.98;
      // 动作三：攻击方前冲偏移
      var shakeOffX = 0, shakeOffY = 0;
      if(_shakeAtkHex && _shakeAtkHex.active && _shakeAtkHex.key === key){
        var st2 = (performance.now() - _shakeAtkHex.startTime) / _shakeAtkHex.duration;
        if(st2 < 1){
          var amt = st2 < 0.4 ? 8 * (st2 / 0.4) : 8 * (1 - (st2 - 0.4) / 0.6);
          shakeOffX = Math.cos(_shakeAtkHex.angle) * amt;
          shakeOffY = Math.sin(_shakeAtkHex.angle) * amt;
        }
      }
      // 动作二：选中弹性 scale
      var selScale = 1;
      if(_selectAnim && _selectAnim.active && _selectAnim.key === key){
        var sct = (performance.now() - _selectAnim.startTime) / 400;
        if(sct < 1){
          selScale = sct < 0.5 ? 0.92 + 0.14 * (sct * 2) : 1.06 - 0.06 * ((sct - 0.5) * 2);
        }
      }
      // 动作十一：放置/回收反馈
      var placeScale = 1, placeAlpha = 1;
      if(_placeAnim && _placeAnim.active && _placeAnim.key === key){
        var pt2 = (performance.now() - _placeAnim.startTime) / _placeAnim.duration;
        if(pt2 < 1){
          if(_placeAnim.isRecycle){
            placeScale = 1 - 0.5 * pt2;
            placeAlpha = 1 - pt2;
          } else {
            // back.out(1.4) 近似
            placeScale = 0.5 + 0.5 * (1 - Math.pow(1 - pt2, 3));
          }
        }
      }
      ctx.save();
      if(placeAlpha < 1) ctx.globalAlpha = placeAlpha;
      var finalScale = scale * selScale * placeScale;
      if(done && TurnState.phase==='battle'){
        ctx.globalAlpha=0.45 * placeAlpha;
      }
      drawUnitOnCanvas(cx + shakeOffX, cy + shakeOffY, placedPieces[key].unitType, placedPieces[key].team, finalScale);
      ctx.restore();
      // 单位名称（棋子上方）
      var udef = getUnit(placedPieces[key].unitType);
      if(udef && udef.name){
        var nameText = udef.name;
        if(nameText.length > 6) nameText = nameText.substring(0, 5) + '..';
        var nameY = cy - HS * 0.62;
        ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        var nameW = ctx.measureText(nameText).width;
        ctx.fillStyle='rgba(0,0,0,0.65)';
        ctx.fillRect(cx - nameW/2 - 4, nameY - 7, nameW + 8, 14);
        ctx.fillStyle=placedPieces[key].team==='player' ? '#c8e6a0' : '#f0b8a0';
        ctx.fillText(nameText, cx, nameY);
      }
      // HP条 + 士气条（有运行时数据就显示，不限阶段）
      if(placedPieces[key]._initialHP){
        var hpPct=placedPieces[key]._currentHP/placedPieces[key]._initialHP;
        var barW=38,barH=5,barX=cx-barW/2,barY=cy+HS*.50;
        // HP条背景+标签
        ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(barX-1,barY-1,barW+2,barH+2);
        ctx.fillStyle=hpPct>0.5?'#6b8e23':(hpPct>0.25?'#c4a020':'#8b2500');
        ctx.fillRect(barX,barY,barW*Math.max(0,hpPct),barH);
        ctx.fillStyle='#fff';ctx.font='bold 6px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
        ctx.fillText('HP',barX,barY-7);
        // 士气条
        var moPct=(placedPieces[key]._currentMorale||0)/100;
        var moY=barY+barH+3;
        ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(barX-1,moY-1,barW+2,barH+2);
        ctx.fillStyle=moPct>0.5?'#5b7cb5':(moPct>0.25?'#8b65c4':'#c44a6a');
        ctx.fillRect(barX,moY,barW*Math.max(0,moPct),barH);
        ctx.fillStyle='#fff';ctx.font='bold 6px sans-serif';
        ctx.fillText('士',barX,moY-7);
      }
      // 行动完毕图标 ✓
      if(done && TurnState.phase==='battle'){
        ctx.fillStyle='rgba(50,50,50,0.85)';ctx.beginPath();ctx.arc(cx+HS*0.42,cy-HS*0.42,11,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#88ff88';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('✓',cx+HS*0.42,cy-HS*0.42);
      }
      // 朝向三角形
      if (placedPieces[key]._facing !== undefined) {
        drawFacingTriangle(cx, cy, placedPieces[key]._facing, placedPieces[key].team);
      }
      // 状态图标
      drawStatusIcons(cx, cy, placedPieces[key]);
      // 选中发光效果（金色双描边，静态即可，不耗性能）
      if(hl==='sp'){
        ctx.strokeStyle='#ffd700';ctx.lineWidth=4;
        ctx.beginPath();crs.forEach(function(pt,i){i===0?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y)});ctx.closePath();ctx.stroke();
        ctx.strokeStyle='rgba(255,215,0,0.35)';ctx.lineWidth=8;
        ctx.beginPath();crs.forEach(function(pt,i){i===0?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y)});ctx.closePath();ctx.stroke();
      }
    }
  }
  if(hl==='mv'){
    ctx.fillStyle='#6b8e23';ctx.beginPath();ctx.arc(cx,cy,4,0,Math.PI*2);ctx.fill();
    // 移动范围格加脚印图标
    ctx.fillStyle='rgba(107,142,35,0.6)';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('👣',cx,cy);
  }
  if(hl==='atk'){
    ctx.fillStyle='#cc3333';ctx.beginPath();ctx.arc(cx,cy,4,0,Math.PI*2);ctx.fill();
    // 攻击范围格加交叉剑图标
    ctx.fillStyle='#fff';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('⚔',cx,cy);
  }
}

function drawAxes(){
  if(!showAxes)return;
  var dirs=[{q:1,r:0,s:-1},{q:0,r:1,s:-1},{q:-1,r:1,s:0}],cols=['#6b8e23','#8b4513','#8b2500'],lbs=['q','r','s'];
  var c=hPx(0,0,HS),ox=c.x+LO.ox,oy=c.y+LO.oy;
  dirs.forEach(function(d,i){
    var e=hPx(d.q*RADIUS,d.r*RADIUS,HS),ex=e.x+LO.ox,ey=e.y+LO.oy;
    ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ex,ey);ctx.strokeStyle=cols[i];ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
    var a=Math.atan2(ey-oy,ex-ox);
    ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-10*Math.cos(a-.4),ey-10*Math.sin(a-.4));
    ctx.moveTo(ex,ey);ctx.lineTo(ex-10*Math.cos(a+.4),ey-10*Math.sin(a+.4));ctx.stroke();
    ctx.fillStyle=cols[i];ctx.font='bold 13px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lbs[i],ex+14*Math.cos(a),ey+14*Math.sin(a));
  });
}

function render(){
  if(!ensureCtx())return;
  var now = performance.now();
  updateMoveAnimations(now);
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#d9c9a8';ctx.fillRect(0,0,canvas.width,canvas.height);
  var mv=new Set();
  var atk=new Set();
  if(selectedPieceKey&&placedPieces[selectedPieceKey]&&!placedPieces[selectedPieceKey]._routed){
    var sp=placedPieces[selectedPieceKey],sh=sp.hex,ud=unitDefByType(sp.unitType),st=ud?getCachedStats(ud):null;
    var range=st?st.movement:1;
    var atkRange=st&&st.mainWeapon?st.mainWeapon.allowedRange:1;
    hexes.forEach(function(h){
      var key=h.q+','+h.r+','+h.s;
      if(hDist(h,sh)<=range&&!placedPieces[key]&&!(typeof isTerrainBlocked==='function'&&isTerrainBlocked(h)))mv.add(key);
      if(TurnState.phase==='battle'&&hDist(h,sh)<=atkRange&&hDist(h,sh)>=1&&placedPieces[key]&&placedPieces[key].team!==sp.team&&!placedPieces[key]._routed)atk.add(key);
    })
  }
  // 动作一：棋盘入场序列 —— 战雾 + 逐圈显现
  var entryActive = _boardEntryAnim && _boardEntryAnim.active;
  var entryElapsed = entryActive ? (now - _boardEntryAnim.startTime) : 9999;
  var fogProgress = Math.min(1, entryElapsed / 500);

  // 背景层：优先用离屏缓存 drawImage，否则回退到逐格 drawHex
  if(_bgCanvas && !entryActive){
    ctx.drawImage(_bgCanvas, 0, 0);
  } else {
    hexes.forEach(function(h){
      var key=h.q+','+h.r+','+h.s;
      if(!placedPieces[key]) drawHex(h, null);
    });
  }

  if(entryActive){
    var hexEntryStart = entryElapsed - 200;
    if(hexEntryStart > 0){
      hexes.forEach(function(h){
        var d=hDist(h,{q:0,r:0,s:0});
        var delay = d * 40;
        var hexT = Math.max(0, Math.min(1, (hexEntryStart - delay) / 400));
        if(hexT <= 0) return;
        var key=h.q+','+h.r+','+h.s,hl=null;
        if(selectedPieceKey===key&&placedPieces[key]&&!placedPieces[key]._animating)hl='sp';
        else if(atk.has(key))hl='atk';
        else if(hoveredHex&&h.q===hoveredHex.q&&h.r===hoveredHex.r&&h.s===hoveredHex.s)hl='hv';
        else if(mv.has(key))hl='mv';
        if(hexT < 1){
          var p=hPx(h.q,h.r,HS),cx=p.x+LO.ox,cy=p.y+LO.oy;
          ctx.save();
          ctx.globalAlpha = hexT;
          var sc = 0.92 + 0.08 * hexT;
          ctx.translate(cx,cy);ctx.scale(sc,sc);ctx.translate(-cx,-cy);
          drawHex(h, hl);
          ctx.restore();
        } else {
          drawHex(h, hl);
        }
      });
    }
    if(fogProgress < 1){
      ctx.save();
      ctx.fillStyle = 'rgba(15,10,5,' + (0.6 * (1 - fogProgress)) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  } else {
    // 非入场：仅画有棋子/高亮的格子（底已由缓存画过）
    if(_bgCanvas){
      hexes.forEach(function(h){
        var key=h.q+','+h.r+','+h.s,hl=null;
        var hasP=placedPieces[key];
        if(selectedPieceKey===key&&hasP&&!hasP._animating)hl='sp';
        else if(atk.has(key))hl='atk';
        else if(hoveredHex&&h.q===hoveredHex.q&&h.r===hoveredHex.r&&h.s===hoveredHex.s)hl='hv';
        else if(mv.has(key))hl='mv';
        if(hl || hasP) drawHex(h, hl);
      });
    } else {
      hexes.forEach(function(h){
        var key=h.q+','+h.r+','+h.s,hl=null;
        if(selectedPieceKey===key&&placedPieces[key]&&!placedPieces[key]._animating)hl='sp';
        else if(atk.has(key))hl='atk';
        else if(hoveredHex&&h.q===hoveredHex.q&&h.r===hoveredHex.r&&h.s===hoveredHex.s)hl='hv';
        else if(mv.has(key))hl='mv';
        drawHex(h,hl);
      });
    }
  }

  drawAxes();

  // 动作二：选中光环
  if(_selectAnim && _selectAnim.rings){
    Object.keys(_selectAnim.rings).forEach(function(pk){
      var ring = _selectAnim.rings[pk];
      var piece = placedPieces[pk];
      if(!piece || !piece.hex) return;
      var p = hPx(piece.hex.q, piece.hex.r, HS);
      var cx = p.x + LO.ox, cy = p.y + LO.oy;
      var rt = (now - ring.start);
      if(ring.phase === 'expand'){
        var t = Math.min(1, rt / 500);
        var radius = HS * 1.2 * t;
        var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, radius));
        grad.addColorStop(0, 'rgba(212,160,23,0)');
        grad.addColorStop(0.7, 'rgba(212,160,23,' + (0.6 * t) + ')');
        grad.addColorStop(1, 'rgba(212,160,23,0)');
        ctx.save();
        ctx.beginPath();ctx.arc(cx, cy, Math.max(1, radius), 0, Math.PI*2);
        ctx.fillStyle = grad;ctx.fill();
        ctx.restore();
      } else if(ring.phase === 'pulse'){
        var pulseT = (Math.sin(rt / 1800 * Math.PI * 2) + 1) / 2;
        var opacity = 0.25 + 0.2 * pulseT;
        var radius = HS * 1.2;
        var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, 'rgba(212,160,23,0)');
        grad.addColorStop(0.7, 'rgba(212,160,23,' + opacity + ')');
        grad.addColorStop(1, 'rgba(212,160,23,0)');
        ctx.save();
        ctx.beginPath();ctx.arc(cx, cy, radius, 0, Math.PI*2);
        ctx.fillStyle = grad;ctx.fill();
        ctx.restore();
      }
    });
  }

  drawAnimatingPiecesOnCanvas();

  // 动作三：绘制冲击波
  for(var wi = _impactWaves.length - 1; wi >= 0; wi--){
    var w = _impactWaves[wi];
    var wt = (now - w.startTime) / w.duration;
    if(wt >= 1){ _impactWaves.splice(wi, 1); continue; }
    var wScale = 0.3 + 2.2 * wt;
    var wAlpha = 0.8 * (1 - wt);
    var wr = HS * wScale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(w.x, w.y, Math.max(1, wr), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212,160,23,' + wAlpha + ')';
    ctx.lineWidth = 3 * (1 - wt * 0.5);
    ctx.stroke();
    var wgrad = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, Math.max(1, wr));
    wgrad.addColorStop(0, 'rgba(255,200,80,' + (wAlpha * 0.3) + ')');
    wgrad.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = wgrad;ctx.fill();
    ctx.restore();
  }

  var pcEl=document.getElementById('pieceCount');if(pcEl)pcEl.textContent=Object.keys(placedPieces).length;
}

function pix2hex(px,py){
  var ax=px-LO.ox,ay=py-LO.oy,rr=(2/3*ay)/HS,rq=(ax/SQRT3-ay/3)/HS;
  // 标准 Red Blob Games 六边形舍入算法：从分数坐标计算 s，再修正最大误差项
  var rs=-rq-rr;
  var qR=Math.round(rq),rR=Math.round(rr),sR=Math.round(rs);
  var dq=Math.abs(qR-rq),dr=Math.abs(rR-rr),ds=Math.abs(sR-rs);
  if(dq>dr&&dq>ds)qR=-rR-sR;else if(dr>ds)rR=-qR-sR;else sR=-qR-rR;
  if(Math.abs(qR)<=RADIUS&&Math.abs(rR)<=RADIUS&&Math.abs(sR)<=RADIUS&&qR+rR+sR===0)return{q:qR,r:rR,s:sR};return null;
}

// ===== 战斗视觉效果系统=====
// 攻击震动效果：通过 _shakeAtkHex 状态在 render() 中绘制棋子前冲偏移
function shakePiece(pieceKey) {
  var piece = placedPieces[pieceKey];
  if(!piece) { requestRender(); return; }
  _shakeAtkHex = {
    active: true,
    key: pieceKey,
    angle: 0,
    startTime: performance.now(),
    duration: 200
  };
  requestRender();
  setTimeout(function(){
    if(_shakeAtkHex && _shakeAtkHex.key === pieceKey) _shakeAtkHex.active = false;
    requestRender();
  }, 210);
}

// 动画循环：持续 rAF，内部用脏标记优化（无变化时跳过 render）
var _animFrame = null;
function startAnimLoop() {
  if(_animFrame) return;
  function loop() {
    var now = performance.now();
    var hasAnim = updateMoveAnimations(now);
    var hasSelectAnim = _selectAnim && _selectAnim.active;
    var hasShakeAnim = _shakeAtkHex && _shakeAtkHex.active;
    var hasEntryAnim = _boardEntryAnim && _boardEntryAnim.active;
    var hasPlaceAnim = _placeAnim && _placeAnim.active;
    var hasImpacts = _impactWaves.length > 0;
    var hasSelectPulse = _selectAnim && _selectAnim.rings && Object.keys(_selectAnim.rings).some(function(k){ return _selectAnim.rings[k].phase === 'pulse'; });
    var anyActive = hasAnim || hasSelectAnim || hasShakeAnim || hasEntryAnim || hasPlaceAnim || hasImpacts || hasSelectPulse;
    if(anyActive || _needsRender){
      render();
      _needsRender = false;
    }
    _animFrame = requestAnimationFrame(loop);
  }
  _animFrame = requestAnimationFrame(loop);
}
function stopAnimLoop() {
  if(_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
}

// 暴露动画系统到全局
window.startPieceMoveAnim = startPieceMoveAnim;
window.isAnyPieceAnimating = isAnyPieceAnimating;
// 帧率优化 API
window.requestRender = requestRender;
window.invalidateBackgroundCache = invalidateBackgroundCache;
window.invalidateUnitImageCache = invalidateUnitImageCache;
window.invalidateStatsCache = invalidateStatsCache;
window.getCachedStats = getCachedStats;
// 动画系统 API
window.startBoardEntryAnim = startBoardEntryAnim;
window.startSelectAnim = startSelectAnim;
window.stopSelectAnim = stopSelectAnim;
window.startAttackImpact = startAttackImpact;
window.startPlaceAnim = startPlaceAnim;
window.startRecycleAnim = startRecycleAnim;
