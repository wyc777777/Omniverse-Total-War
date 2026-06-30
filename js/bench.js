// ==================== 备战席系统 ====================
var BPS = 10; var benchState = [];
function initBench() {
  var Lc = document.getElementById('benchLeft'), Rc = document.getElementById('benchRight');
  if (!Lc || !Rc) return;
  Lc.innerHTML = ''; Rc.innerHTML = '';
  benchState = [];

  var playerTypes = (BT && BT.player) ? BT.player : [];
  var enemyTypes = (BT && BT.enemy) ? BT.enemy : ['infantry','infantry','infantry','cavalry','cavalry','cavalry','archer','archer','flying','flying'];

  // 敌方总是10个
  var enemyCount = Math.min(enemyTypes.length, BPS);
  // 玩家只显示选中的
  var playerCount = Math.min(playerTypes.length, BPS);

  for (var i = 0; i < playerCount; i++) {
    createSlot(Lc, i, 'player', playerTypes[i], i+1, 'P');
  }
  for (var i = 0; i < enemyCount; i++) {
    createSlot(Rc, BPS + i, 'enemy', enemyTypes[i], i+1, 'E');
  }
  // 补齐空格
  for (var i = playerCount; i < BPS; i++) {
    createEmptySlot(Lc, i, 'P'+(i+1));
  }

  function createSlot(ct, slotIdx, team, unitType, labelNum, prefix) {
    var u = getUnit(unitType);
    var sl = document.createElement('div'); sl.className = 'bench-slot'; sl.draggable = true;
    sl.dataset.slotIdx = slotIdx; sl.dataset.team = team;
    sl.dataset.unitType = unitType; sl.dataset.placed = 'false';
    var il = document.createElement('span'); il.className = 'slot-idx'; il.textContent = prefix + labelNum; sl.appendChild(il);
    if (u) {
      var ig = document.createElement('img'); ig.className = 'unit-thumb'; ig.src = u.image; ig.alt = u.name; ig.draggable = false; sl.appendChild(ig);
      var lb = document.createElement('span'); lb.className = 'slot-label'; lb.textContent = u.name; sl.appendChild(lb);
    }
    sl.addEventListener('dragstart', function(e) { if (this.dataset.placed === 'true') { e.preventDefault(); return; } this.classList.add('dragging'); e.dataTransfer.setData('text/plain', JSON.stringify({slotIdx: parseInt(this.dataset.slotIdx), team: this.dataset.team, unitType: this.dataset.unitType})); e.dataTransfer.effectAllowed = 'move'; });
    sl.addEventListener('dragend', function() { this.classList.remove('dragging'); });
    ct.appendChild(sl); benchState[slotIdx] = true;
  }

  function createEmptySlot(ct, slotIdx, label) {
    var sl = document.createElement('div'); sl.className = 'bench-slot empty'; sl.draggable = false;
    var il = document.createElement('span'); il.className = 'slot-idx'; il.textContent = label; sl.appendChild(il);
    ct.appendChild(sl);
    // 空槽位不写入 benchState，避免覆盖敌方槽位状态（benchState 仅用于标记可拖拽槽位）
    if (benchState[slotIdx] === undefined) benchState[slotIdx] = false;
  }
}

function getSlot(i) {
  var Lc = document.getElementById('benchLeft'), Rc = document.getElementById('benchRight');
  // 找对应slotIdx的元素
  var all = document.querySelectorAll('.bench-slot');
  for (var j = 0; j < all.length; j++) {
    if (parseInt(all[j].dataset.slotIdx) === i) return all[j];
  }
  return null;
}
function returnToBench(i) {
  if (benchState[i]) return;
  benchState[i] = true;
  var s = getSlot(i);
  if (s) { s.dataset.placed = 'false'; s.classList.remove('empty'); s.draggable = true; }
}
