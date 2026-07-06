// ==================== 万界全面战争 · 本地服务器 ====================
// 用法：node server.js
// 功能：1. 托管游戏静态文件  2. save/ 文件夹JSON存档读写  3. 壁纸管理  4. AI API 配置

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3456;

// ===== save/ 文件夹 =====
const SAVE_DIR = path.join(__dirname, 'save');
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

// ===== assets/wallpapers/ 文件夹 =====
const WALLPAPER_DIR = path.join(__dirname, 'assets', 'wallpapers');
if (!fs.existsSync(WALLPAPER_DIR)) fs.mkdirSync(WALLPAPER_DIR, { recursive: true });

// ===== 设置文件 =====
const SETTINGS_FILE = path.join(SAVE_DIR, '_settings.json');

// ===== AI 召唤配置 =====
// API 配置文件：assets/api_config.json（用户在前端保存后才会生成）
const API_CONFIG_FILE = path.join(__dirname, 'assets', 'api_config.json');

// 硬编码默认值（DeepSeek）
const DEFAULT_API_BASE = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-v4-flash';

function loadApiConfig() {
  try {
    if (fs.existsSync(API_CONFIG_FILE)) {
      var raw = JSON.parse(fs.readFileSync(API_CONFIG_FILE, 'utf-8'));
      if (raw.profiles) return raw;
      // 迁移旧格式 -> 新多profile格式
      if (raw.apiKey !== undefined || raw.apiBaseUrl !== undefined || raw.modelName !== undefined) {
        var migrated = {
          profiles: {
            '默认配置': {
              apiBaseUrl: raw.apiBaseUrl || DEFAULT_API_BASE,
              apiKey: raw.apiKey || '',
              modelName: raw.modelName || DEFAULT_MODEL
            }
          },
          activeProfile: '默认配置'
        };
        fs.writeFileSync(API_CONFIG_FILE, JSON.stringify(migrated, null, 2), 'utf-8');
        return migrated;
      }
    }
  } catch(e) {}
  return { profiles: {}, activeProfile: '' };
}

function getActiveProfileName() {
  var cfg = loadApiConfig();
  var names = Object.keys(cfg.profiles || {});
  if (cfg.activeProfile && cfg.profiles[cfg.activeProfile]) return cfg.activeProfile;
  if (names.length > 0) return names[0];
  return '';
}

function getActiveProfile() {
  var cfg = loadApiConfig();
  var name = getActiveProfileName();
  return name ? cfg.profiles[name] : null;
}

function getApiKey() {
  return (getActiveProfile() || {}).apiKey || '';
}
function getApiBase() {
  return (getActiveProfile() || {}).apiBaseUrl || DEFAULT_API_BASE;
}
function getModel() {
  return (getActiveProfile() || {}).modelName || DEFAULT_MODEL;
}

// API 配置查看（密钥打码）
function maskKey(key) {
  if (!key) return '(未配置)';
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// multer 配置：壁纸上传
const storage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, WALLPAPER_DIR); },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = 'wp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + ext;
    cb(null, safeName);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: function(req, file, cb) {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.indexOf(ext) >= 0) { cb(null, true); }
    else { cb(new Error('不支持的图片格式，仅支持 jpg/png/gif/webp/bmp')); }
  }
});

// ===== 设置 API =====

// 获取设置（壁纸等用户偏好）
app.get('/api/settings', (req, res) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      res.json(data);
    } else {
      res.json({});
    }
  } catch(e) {
    res.json({});
  }
});

// 保存设置
app.put('/api/settings', (req, res) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: '保存设置失败: ' + e.message });
  }
});

// 获取 API 配置（密钥打码）
app.get('/api/api-config', (req, res) => {
  var cfg = loadApiConfig();
  var activeName = getActiveProfileName();
  var active = activeName ? cfg.profiles[activeName] : null;
  var profileList = Object.keys(cfg.profiles || {}).map(function(name) {
    var p = cfg.profiles[name];
    return {
      name: name,
      apiBaseUrl: p.apiBaseUrl || DEFAULT_API_BASE,
      apiKeyMasked: maskKey(p.apiKey || ''),
      apiKeySet: !!(p.apiKey),
      modelName: p.modelName || DEFAULT_MODEL,
      configured: !!(p.apiKey)
    };
  });
  res.json({
    profiles: profileList,
    activeProfile: activeName,
    apiBaseUrl: active ? active.apiBaseUrl || DEFAULT_API_BASE : DEFAULT_API_BASE,
    apiKey: active ? maskKey(active.apiKey || '') : '(未配置)',
    apiKeySet: active ? !!(active.apiKey) : false,
    modelName: active ? active.modelName || DEFAULT_MODEL : DEFAULT_MODEL,
    configured: active ? !!(active.apiKey) : false,
    source: 'local'
  });
});

// 保存 API 配置（写入当前激活的 profile）
app.put('/api/api-config', (req, res) => {
  try {
    var cfg = loadApiConfig();
    var activeName = getActiveProfileName();
    if (!activeName) {
      return res.status(400).json({ error: '没有激活的 API 配置，请先创建一个' });
    }
    if (!cfg.profiles) cfg.profiles = {};
    if (!cfg.profiles[activeName]) cfg.profiles[activeName] = {};
    var profile = cfg.profiles[activeName];
    if (req.body.apiBaseUrl !== undefined) profile.apiBaseUrl = req.body.apiBaseUrl;
    if (req.body.apiKey !== undefined) profile.apiKey = req.body.apiKey;
    if (req.body.modelName !== undefined) profile.modelName = req.body.modelName;
    fs.writeFileSync(API_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: '保存失败: ' + e.message });
  }
});

// 清除当前激活 profile 的密钥
app.delete('/api/api-config', (req, res) => {
  try {
    var cfg = loadApiConfig();
    var activeName = getActiveProfileName();
    if (activeName && cfg.profiles[activeName]) {
      delete cfg.profiles[activeName].apiKey;
      fs.writeFileSync(API_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    }
    res.json({ ok: true, msg: '当前 profile 密钥已清除' });
  } catch(e) {
    res.status(500).json({ error: '清除失败: ' + e.message });
  }
});

// 创建新 API profile
app.post('/api/api-config/profile', (req, res) => {
  try {
    var cfg = loadApiConfig();
    var name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: '请输入配置名称' });
    if (cfg.profiles[name]) return res.status(400).json({ error: '该名称已存在' });
    if (!cfg.profiles) cfg.profiles = {};
    cfg.profiles[name] = {
      apiBaseUrl: req.body.apiBaseUrl || DEFAULT_API_BASE,
      apiKey: req.body.apiKey || '',
      modelName: req.body.modelName || DEFAULT_MODEL
    };
    cfg.activeProfile = name;
    fs.writeFileSync(API_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    res.json({ ok: true, name: name });
  } catch(e) {
    res.status(500).json({ error: '创建失败: ' + e.message });
  }
});

// 删除指定 API profile
app.delete('/api/api-config/profile/:name', (req, res) => {
  try {
    var cfg = loadApiConfig();
    var name = req.params.name;
    if (!cfg.profiles || !cfg.profiles[name]) {
      return res.status(404).json({ error: '配置不存在' });
    }
    delete cfg.profiles[name];
    if (cfg.activeProfile === name) {
      var names = Object.keys(cfg.profiles);
      cfg.activeProfile = names.length > 0 ? names[0] : '';
    }
    if (Object.keys(cfg.profiles).length === 0) {
      cfg.activeProfile = '';
      cfg.profiles = {};
    }
    fs.writeFileSync(API_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    res.json({ ok: true, activeProfile: cfg.activeProfile });
  } catch(e) {
    res.status(500).json({ error: '删除失败: ' + e.message });
  }
});

// 切换激活的 API profile
app.put('/api/api-config/active', (req, res) => {
  try {
    var cfg = loadApiConfig();
    var name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: '请指定配置名称' });
    if (!cfg.profiles || !cfg.profiles[name]) {
      return res.status(404).json({ error: '配置不存在' });
    }
    cfg.activeProfile = name;
    fs.writeFileSync(API_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    res.json({ ok: true, activeProfile: name });
  } catch(e) {
    res.status(500).json({ error: '切换失败: ' + e.message });
  }
});

// ===== 壁纸 API =====

// 列出所有壁纸
app.get('/api/wallpapers', (req, res) => {
  try {
    const supported = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const files = fs.readdirSync(WALLPAPER_DIR).filter(f => {
      return supported.indexOf(path.extname(f).toLowerCase()) >= 0;
    }).map(f => ({
      name: f,
      url: '/api/wallpapers/' + encodeURIComponent(f),
      size: fs.statSync(path.join(WALLPAPER_DIR, f)).size
    }));
    res.json(files);
  } catch(e) {
    res.json([]);
  }
});

// 上传壁纸（复制到 wallpapers 文件夹）
app.post('/api/wallpapers', upload.single('wallpaper'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未收到文件' });
  }
  res.json({
    ok: true,
    name: req.file.filename,
    url: '/api/wallpapers/' + encodeURIComponent(req.file.filename)
  });
});

// 获取壁纸图片
app.get('/api/wallpapers/:name', (req, res) => {
  const name = req.params.name;
  // 防路径穿越
  if (name.indexOf('..') >= 0 || name.indexOf('/') >= 0 || name.indexOf('\\') >= 0) {
    return res.status(403).send('Forbidden');
  }
  const filePath = path.join(WALLPAPER_DIR, name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(filePath);
});

// 删除壁纸
app.delete('/api/wallpapers/:name', (req, res) => {
  const name = req.params.name;
  if (name.indexOf('..') >= 0 || name.indexOf('/') >= 0 || name.indexOf('\\') >= 0) {
    return res.status(403).send('Forbidden');
  }
  const filePath = path.join(WALLPAPER_DIR, name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: '壁纸不存在' });
  }
});

// ===== 存档 API（必须在静态文件之前）=====

// 获取存档列表
app.get('/api/saves', (req, res) => {
  try {
    const files = fs.readdirSync(SAVE_DIR).filter(f =>
      f.endsWith('.json') &&
      !path.basename(f, '.json').startsWith('_') &&
      !path.basename(f, '.json').includes('_summoned')
    );
    const saves = {};
    files.forEach(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SAVE_DIR, f), 'utf-8'));
        const name = f.replace('.json', '');
        saves[name] = data;
      } catch(e) { /* 跳过损坏文件 */ }
    });
    res.json(saves);
  } catch(e) {
    res.json({});
  }
});

// 保存一个存档
app.put('/api/saves/:name', (req, res) => {
  try {
    const name = req.params.name;
    const safeName = name.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(SAVE_DIR, safeName + '.json');
    const data = req.body;
    data._serverSavedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ ok: true, file: safeName + '.json' });
  } catch(e) {
    res.status(500).json({ error: '保存失败: ' + e.message });
  }
});

// 删除一个存档
app.delete('/api/saves/:name', (req, res) => {
  try {
    const name = req.params.name;
    const safeName = name.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(SAVE_DIR, safeName + '.json');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: '存档不存在' });
    }
  } catch(e) {
    res.status(500).json({ error: '删除失败: ' + e.message });
  }
});

// ===== 召唤数据 API（与主存档分离，单独存储 races/weapons/armors/mounts/units）=====

// 获取召唤数据
app.get('/api/summoned/:name', (req, res) => {
  try {
    const safeName = req.params.name.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(SAVE_DIR, safeName + '_summoned.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      res.json(data);
    } else {
      res.status(404).json({ error: '无召唤数据' });
    }
  } catch(e) {
    res.status(500).json({ error: '读取召唤数据失败: ' + e.message });
  }
});

// 保存召唤数据
app.put('/api/summoned/:name', (req, res) => {
  try {
    const safeName = req.params.name.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(SAVE_DIR, safeName + '_summoned.json');
    const data = req.body || {};
    data._savedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ ok: true, file: safeName + '_summoned.json' });
  } catch(e) {
    res.status(500).json({ error: '保存召唤数据失败: ' + e.message });
  }
});

// 删除召唤数据（删主存档时级联调用）
app.delete('/api/summoned/:name', (req, res) => {
  try {
    const safeName = req.params.name.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(SAVE_DIR, safeName + '_summoned.json');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: '删除召唤数据失败: ' + e.message });
  }
});

// ===== AI 召唤：生成完整兵团（名字+装备+背景+属性）=====
app.post('/api/summon', async (req, res) => {
  const apiKey = getApiKey();
  const apiBase = getApiBase();
  const defaultModel = getModel() || 'gpt-3.5-turbo';

  if (!apiKey || apiKey === 'sk-your-api-key-here') {
    return res.status(500).json({ error: '请先在设置中配置 API Key' });
  }
  // 防护：req.body 可能为 null 或字段缺失
  const body = req.body || {};
  const { tierName, race, model, customDesc } = body;
  const worldName = body.worldName || '';
  const worldDesc = body.worldDesc || '';
  // tier 强制转数字，避免字符串 "1" 走错分支
  const tier = Number(body.tier);
  if (!tier || tier < 1 || tier > 4) {
    return res.status(400).json({ error: '无效召唤档次' });
  }
  const useModel = model || defaultModel;
  const useTemp = 0.85;

  // ===== System Message：硬规则（不变的部分）=====
  const systemContent = `你是《万界全面战争》的AI兵团生成器。这是一款汇聚诸天万界奇幻世界观的六边形战棋游戏，召唤兵团可以来自任何奇幻宇宙（战锤、魔兽、中土、DND、国漫、小说等）。

【⚡ 核心原则：背景第一，LLM全权决定 —— 以下内容请默念三遍】
背景是兵团的灵魂。你先构思背景故事，然后从背景中自然生长出一切——兵团名、武器、护甲、盾牌、坐骑，全部由你根据背景的世界观和战绩自由创造。
不要套用任何固定材质模板。不要从预设列表里选名字。每件装备的名字都必须能从背景故事中找到依据。

【装备设计自由度——你要全权决定以下所有事项】
1. 兵团用什么武器？ → 你根据背景决定武器类型（剑/矛/弓/弩）和名字
2. 兵团穿什么护甲？ → 你根据背景决定护甲类型（轻甲/中甲/重甲）和名字
3. 兵团有没有盾牌？ → 你根据背景判断。防守型兵团可能有盾，突击型可能没有。如果你决定有盾，给它起个名字
4. 兵团有没有坐骑？ → 你根据背景判断。骑兵和空军必须有坐骑，步兵和远程兵可以有也可以没有
5. 装备名字的风格 → 完全由背景的世界观调性决定

【装备命名调性检查——生成装备名前先问自己】
"这个名字，和背景故事里的世界观是一个调性吗？"
错误示例：矮人黑岩堡背景 → 噬星长戟 ❌
正确示例：矮人黑岩堡背景 → 黑铁战斧 ✅
错误示例：帝国军团背景 → 星辰圣剑 ❌ （万能前缀，没有故事感）
正确示例：帝国军团背景 → 米登海姆长剑 ✅

【输出格式——严格按此格式，每项一行 key:value，不输出任何其他内容】
类型:从[步兵,骑兵,远程兵,空军]中选一个
名字:5~12字，有世界观辨识度
背景:30~60字，必须包含具体地名和辉煌战绩
信念:10~20字，兵团的核心精神
主武器名字:4~7字，必须与背景世界观同一调性
主武器类型:从[short,long,bow,crossbow]中选一个（注意：步兵和骑兵只能用short或long，不能用bow/crossbow；弓兵/远程兵只能用bow或crossbow）
护甲名字:3~6字，必须与背景世界观同一调性
护甲类型:从[轻甲,中甲,重甲]中选一个，根据背景判断
盾牌名字:有盾牌就写名字(3~6字)，无盾牌写"无"
坐骑名字:无坐骑写"无"
武器描述:8~20字，简洁描述该武器的工艺、材质或标志性特征，呼应兵团背景
护甲描述:8~20字，简洁描述护甲的材质或战术定位
坐骑描述:8~20字，有坐骑时写坐骑的外形或特征，无坐骑写"无"
武器特性:可选特性列表（用逗号分隔，如"迅捷,惧怕近身,骑射"）。近战武器可选：迅捷（兵团背景描写速度极快、轻灵、迅疾时赋予，效果是血量-20%移动+1）。长柄武器自动获得"抵御冲锋"。弓类自动获得"惧怕近身"。弩类自动获得"无视近战干扰,重甲克制"。如果兵团是骑兵或空军使用弓/弩类武器（骑射手/空中射手），武器特性中必须包含"骑射"——该效果允许骑兵和空军装备此弓/弩。注：一个兵团可以有多个特性，不冲突的特性可以并存
主武器伤害:根据【装备数值区间】规则，结合背景判断的具体数字
主武器破甲:根据【装备数值区间】规则，结合背景判断的具体数字（必须小于护甲）
护甲防御:根据【装备数值区间】规则，结合背景判断的具体数字

【装备品阶匹配规则——装备品质必须与召唤档次一致】
- 召唤档次（tier）控制装备的基础品质
- 1级（黑铁）：普通装备，基础属性低，名字朴实
- 2级（青铜）：精良装备，属性中等，名字体现工艺
- 3级（黄金）：高级装备，属性优秀，名字有传说感
- 4级（钻石）：顶级传说装备，属性冠绝，名字有史诗感
- 注意：不能给1级黑铁兵团配钻石级别的装备名（如"龙焰神剑"），也不能给4级钻石兵团配黑铁级别的破烂
- 装备名字和描述的气质要与档次匹配

【攻击距离上限规则】
- 远程武器（弓/弩）的攻击距离（allowedRange）上限为4
- 只有钻石级武器可以达到4格攻击距离，黄金及以下最多3格
- 步枪/火枪视为弩类，受同样规则约束

【装备数值区间——由你根据背景在区间内决定具体数值】
**武器杀伤**（主武器伤害值，同品阶内可有±3浮动）：
- 1级（黑铁）：11~15
- 2级（青铜）：16~21
- 3级（黄金）：22~28
- 4级（钻石）：28~36
注意：双手武器伤害比单手高15%；远程武器因射程衰减比近战低10~15%。
如果背景描述"重型""强力""传奇"取区间上限，"劣质""轻巧""简陋"取下限。

**武器破甲**（对抗重甲时的最低伤害保障，必须小于护甲）：
- short近战：T1:1~3, T2:3~6, T3:6~9, T4:9~13
- long长柄：T1:1~2, T2:2~5, T3:4~7, T4:6~10
- bow弓：T1:1~2, T2:2~4, T3:3~6, T4:4~8
- crossbow弩：T1:2~4, T2:4~7, T3:7~11, T4:10~15
关键规则：破甲值必须小于同品阶护甲的最低值，否则护甲无意义！
如果背景描写"破甲""穿甲""锋利"取上限，"钝""劣质"取下限。

**护甲防御**：
- 轻甲：T1:6~9, T2:9~12, T3:12~15, T4:15~19
- 中甲：T1:7~10, T2:10~13, T3:13~17, T4:16~21
- 重甲：T1:9~13, T2:12~16, T3:15~20, T4:18~25
注意：护甲防御值必须大于同品阶武器破甲值上限。
"厚重""板甲""铁甲""钢"取上限，"轻便""破损""劣质"取下限。

【装备描述生成规则】
- 武器描述、护甲描述、坐骑描述请根据兵团背景和名字创作，体现该装备的材质、工艺、外观或战术特征
- 8~20字，简洁有力，不需要故事性——如"矮人黑铁锻造的重型战斧"、"精灵雕纹轻甲，柔韧如叶"
- 装备描述的风格要与兵团的世界观调性一致

【武器类型定义】
- short: 单手近战（剑/斧/锤/匕首），无特殊效果
- long: 长柄武器（长矛/长枪/战戟），有"抵御冲锋"效果
- bow: 弓类，有"惧怕近身"负面效果
- crossbow: 弩类，有"无视近战干扰"和"重甲克制"效果
注意：长剑/短剑都是short；长矛/长枪才是long。

【护甲类型定义】
- 轻甲：皮甲、链甲等轻型护具，防御低但不影响机动
- 中甲：锁甲、鳞甲等中型护具，攻守平衡
- 重甲：板甲、重鳞甲等重型护具，防御高但降低机动
护甲类型要和背景匹配：重装步兵穿重甲，游骑兵穿轻甲，正规军团穿中甲。

【盾牌设计原则】
- 单手武器（short）的步兵可以配盾牌
- 双手武器（long/bow/crossbow）不配盾牌
- 防守型背景（重装/铁卫/守备/防御）高概率有盾
- 突击型背景（轻装/冲锋/游侠/侦察）低概率有盾
- 骑兵可以配盾也可以不配
- 空军不配盾牌

【禁止项】
- 背景和信念不能为空，不能写"无"或"略"
- 装备名必须与背景同一世界观调性
- 禁止"龙鳞""秘银""星辰""噬星""碎星""灭世""天道"等万能或无来源的前缀（除非背景确实属于该世界观）
- 高档次（3~4级）不一定是巨型怪兽，精英常规部队同样可以是顶级兵团
- **背景里禁止使用"三百""五百""上千"等整齐的整数来描述人数！** 用不规则数字（如"六十七"、"百二"、"四十七骑"）或模糊修辞（"半数""残部""十之二三"）来替代。

【背景写作参考——四种叙事风格，学习其手法而非内容】
下面展示四种不同的叙事笔法。**你要学的是它们的写作手法（结构、视角、节奏），但必须自己创作全新的故事——不同的世界观、不同的地名、不同的人物和数字，绝不重复示例中的任何细节。**

风格A——**史诗叙事，画面感**：开门见山定调，用具体数字和动作细节构建画面感，结尾用留白制造余韵。
> 黑岩堡的矮人从不投降。第三次兽人大入侵时，七十六名铁卫死守城门七天七夜，当铁炉堡援军踏碎晨曦赶到时，城门后的三十七名幸存者浑身是血、沉默地举着残破的氏族旗帜。

风格B——**名声梗，从他者视角**：用"人人都知道"的口吻引入，侧面烘托兵团的威名，再用一个具体战绩证明。
> 谁都知道"不破防线"这个名号。帕兰诺平原上，这支步兵硬扛十七波冲击而阵线纹丝未动。战后清点，整编160人死了三分之二，没有一个活人后退过一步。

风格C——**氛围侧写，禁"曾经/曾在"**：用环境、声音、光线来暗示兵团的风格，不直接说他们强，而是让读者自己感受到。
> 月下掠过的白影，林间破空的轻响——灰谷长弓兵团不爱在白天打仗。月光比阳光更不会出卖弓弦的颤动，而精灵的箭头从不失手。

风格D——**反差叙述，打破预期**：先贬后扬，开头制造一个"弱"的印象，然后用事实反转，塑造出深藏不露的强悍。
> 按兵部账本，十字军的编制早该撤销了——成员不是残兵就是囚犯，装备全是淘汰货。但奇怪的是，每次王国有难，这支破烂兵团总能活着回来。而且打赢。

【输出格式示例——只展示排版结构，不要求内容雷同】
类型:步兵
名字:（自定义）
背景:（自定义，用上面四种风格之一创作全新的故事）
信念:（自定义）
主武器名字:（自定义）
主武器类型:（自定义）
护甲名字:（自定义）
护甲类型:（自定义）
盾牌名字:（自定义）
坐骑名字:（自定义）`;

  // ===== User Message：本次召唤参数（每次变化的部分）=====
  const userContent = `【本次召唤参数】
- 档次：${tierName}（${tier}级）
- 种族：${race}
- 注意：种族仅为占位默认值。如果你从玩家要求中推断出更合适的种族（如精灵、矮人、兽人、巨魔等），请以你的推断为准。
${worldName ? '- 世界观：' + worldName + '\n' : '- 世界观：由你根据玩家要求自行判断\n'}${worldDesc ? '- 世界观描述：' + worldDesc + '\n' : '- 世界观描述：由你从玩家要求中推断\n'}${customDesc ? '- 玩家自定义要求：' + customDesc + '\n' : '- 无玩家自定义要求，请随机从世界观库中抽取\n'}
【⚡ 创作思维链路——请作为首席设计师进行推理】
1. **世界观定调**：基于玩家要求，在脑海中构筑一个真实存在的或逻辑自洽的奇幻/历史时空。这个时空的科技、魔法水平和文明调性，是你后续所有决策的基石。
2. **叙事驱动身份**：在这个时空背景下，这支兵团是谁？他们为何而战？他们的战绩如何？让背景故事产生一种"这支部队真实存在过"的厚重感。
3. **装备的艺术化衍生**：装备的名字和配置不应是随机的，而应是背景故事的延伸。如果是贫民军，装备可能带有"生锈""拼凑"的词缀；如果是神选者，装备应体现其超凡脱俗的工艺。

【装备命名建议——追求辨识度与沉浸感】
- 避免廉价的网文风命名（如：神级战斧、至尊盔甲）。
- 尝试通过地名、战绩、材质或传说来命名。
- 示例：从"铁剑"进化为"白城禁卫钢剑"；从"皮甲"进化为"影幕林游侠轻铠"。

【数值分配的艺术】
你给出的每一项数字都应该能从背景描述中找到依据：
- 如果你描述该兵团"势不可挡"，其伤害应偏向区间上限。
- 如果描述其"甲胄厚重但行动迟缓"，则高防御与低移动速度相匹配。
- 请在给定的区间内，根据你创作的逻辑自由微调，让数值成为故事的一部分。

【创作灵感参考（不限于此）】
你可以尝试：史诗叙事（宏大的战场侧写）、他者视角（侧面烘托其恐怖或伟大）、氛围侧写（通过细节描写如月光、箭雨、呼吸声来传达风格）、或反差叙事（看似弱小实则坚韧）。

调性速查（装备名的语感必须和背景一致）：
- 中古战锤/中土魔戒 → 朴实硬朗：符文XX、黑铁XX、帝国XX、血神XX、氏族XX
- 魔兽/艾泽拉斯 → 史诗英雄感：灰烬XX、霜寒XX、圣光XX
- 东方修仙/玄幻 → 空灵缥缈：星辰XX、破虚XX、天道XX（仅限此背景）
- 暗黑/哥特 → 阴郁压迫：骸骨XX、暗影XX、诅咒XX
- 中国古代 → 写实古风：百炼XX、镔铁XX、玄甲XX

【种族文化参考】
- 人类（帝国/刚铎/巴托尼亚）：厚重正式，多用"骑士""军团""王家"
- 洛汗/诺斯卡：粗犷豪放，草原、战马、游牧色彩
- 矮人：力量感，锻造、山脉、氏族名（铁炉/黑铁/铜须/孤山）
- 精灵：优雅轻盈，"之"字结构，森林/月光
- 兽人/绿皮：野蛮直接，血腥、碎骨、战歌
- 混沌/四神：邪恶疯狂，毁灭、魔焰、血祭
- 亡灵/吸血鬼：阴森诡异，骸骨、暗影、诅咒、鲜血

现在开始生成，只输出key:value格式，不输出其他内容。`;

  try {
    // 超时控制：30秒后中止请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: useModel,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent }
        ],
        temperature: useTemp, max_tokens: 10000
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'AI API 调用失败: ' + errText });
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const result = {};
    content.split('\n').forEach(line => {
      // 只按第一个冒号分割，避免背景里的冒号导致解析错误
      const idx = line.search(/[：:]/);
      if (idx > 0) {
        result[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
      }
    });

    // ===== 服务端兜底：背景和信念为空时自动生成 =====
    const BG_POOL = [
      // 风格A：史诗画面
      '安其拉之门轰然碎裂的那一刻，远征军先锋连没有犹豫。他们迎着潮水般的虫群冲锋，用血肉在城门残骸上筑起第二道墙——直到援军赶到，墙还立着',
      '黑岩堡的矮人从不投降。第三次兽人大入侵时，三百铁卫死守城门七天七夜，当铁炉堡援军踏碎晨曦赶到时，城门后的三十七名幸存者浑身是血、沉默地举着残破的氏族旗帜',
      // 风格B：名声与他者视角
      '谁都知道"不破防线"这个名号。帕兰诺平原上，这支步兵硬扛十七波冲击而阵线纹丝未动。战后清点，整编160人死了三分之二，没有一个活人后退过一步',
      '洛汗草原上的牧民至今还在传唱骠骑精锐的故事：号角堡陷落前最后一刻，四十七骑骠骑从侧翼杀入万人兽人大军。歌里说他们全都战死，但兽人大军的攻势也停在那一刻',
      '北境边民有个说法——宁可遇上一整支混沌军团，也不要撞见黑色守望者的巡逻队。没人统计过他们到底处决了多少冰原入侵者，反正近三十年北境没有陷落过一座城池',
      // 风格C：氛围侧写
      '月下掠过的白影，林间破空的轻响——灰谷长弓兵团不爱在白天打仗。月光比阳光更不会出卖弓弦的颤动，而精灵的箭头从不失手',
      '没人见过他们整队出发的样子。银月城哨兵永远只出现在你需要他们的地方——通常在敌人发现之前就已经射完了第一轮箭雨',
      // 风格D：反差叙述
      '按兵部账本，十字军的编制早该撤销了——成员不是残兵就是囚犯，装备全是淘汰货。但奇怪的是，每次王国有难，这支破烂兵团总能活着回来。而且打赢',
      '吸血鬼伯爵从不承认希尔瓦尼亚亡者军团属于他的统治——他们不服从任何贵族，也不效忠任何王权。但每逢亡灵天灾入侵时，第一个挡在平民前方的永远是这支无名亡者',
      '恐虐的祭司看不起这支连仪式铠甲都没有的散兵。然而十三次混沌荒原正面冲突中，这支散兵活着回来了十二次，其中有五次还带回敌方将领的首级'
    ];
    const BELIEF_POOL = [
      '以血卫道，死战不退', '荣誉即生命，败即死亡', '为联盟而战，至死方休',
      '黑暗中的利刃，沉默中的雷霆', '守护弱者，斩尽邪恶', '战至最后一兵一卒',
      '以铁血铸就不朽传奇', '信仰即力量，团结即胜利', '宁碎不退，宁死不降',
      '传承千年的战意永不熄灭', '血祭血神，颅献颅座', '万物皆腐，唯纳垢永生',
      '万变之机，尽在吾手', '享乐至上，痛苦皆甘', '为了女皇的荣耀',
      '古圣的意志不可违背', '死亡只是新的开始', '金钱所指，刀锋所向',
      '白城永不陷落', '骠骑所至，无坚不摧', '孤山之誓，永不背弃',
      '星辰指引前路', '混沌终将吞噬一切'
    ];

    var unitType = result['类型'] || '步兵';
    var weaponType = result['主武器类型'] || 'short';
    // 校验武器类型与兵种匹配：步兵/骑兵只能用近战，弓兵只能用远程
    var isRanged = (weaponType === 'bow' || weaponType === 'crossbow');
    if (unitType === '步兵' || unitType === '骑兵') {
      if (isRanged) weaponType = 'short';
    } else if (unitType === '弓兵' || unitType === '远程兵') {
      if (!isRanged) weaponType = 'bow';
    }

    res.json({
      name: result['名字'] || '',
      background: result['背景'] && result['背景'] !== '无' ? result['背景'] : BG_POOL[Math.floor(Math.random() * BG_POOL.length)],
      belief: result['信念'] && result['信念'] !== '无' ? result['信念'] : BELIEF_POOL[Math.floor(Math.random() * BELIEF_POOL.length)],
      type: unitType,
      weaponName: result['主武器名字'] || '',
      weaponType: weaponType,
      weaponRange: result['武器攻击距离'] ? parseInt(result['武器攻击距离'].trim()) : 0,
      weaponEffects: result['武器特性'] || '',
      weaponDesc: result['武器描述'] || '',
      weaponDamage: result['主武器伤害'] ? parseInt(result['主武器伤害'].trim()) : 0,
      armorPierce: result['主武器破甲'] ? parseInt(result['主武器破甲'].trim()) : 0,
      armorName: result['护甲名字'] || '',
      armorType: result['护甲类型'] || '',
      armorDesc: result['护甲描述'] || '',
      armorDefense: result['护甲防御'] ? parseInt(result['护甲防御'].trim()) : 0,
      shieldName: result['盾牌名字'] || '无',
      mountName: result['坐骑名字'] || '无',
      mountDesc: result['坐骑描述'] || ''
    });
  } catch(e) {
    const msg = e.name === 'AbortError' ? 'AI 响应超时（30秒），请重试' : '连接 AI 服务失败: ' + e.message;
    res.status(500).json({ error: msg });
  }
});

// ===== AI 对战：通过召唤系统生成对手 =====
app.post('/api/ai-battle-generate', async (req, res) => {
  const apiKey = getApiKey();
  const apiBase = getApiBase();
  const defaultModel = getModel() || 'gpt-3.5-turbo';

  if (!apiKey) {
    return res.status(500).json({ error: '请先在设置中配置 API Key' });
  }

  const body = req.body || {};
  const userDesc = body.description || '';
  const unitCount = Math.min(10, Math.max(3, Number(body.unitCount) || 4));
  const intelligence = body.intelligence || 'hard';
  const strength = body.strength || 'hard';

  const strToTier = { easy: 1, hard: 2, legend: 3 };
  const tier = strToTier[strength] || 2;
  const tierNames = { 1: '低级/炮灰', 2: '中坚/正规军', 3: '高级/精锐' };
  const tierName = tierNames[tier] || '中坚/正规军';
  
  const loreLogic = `【身份与数值解耦原则】
1. **背景身份(Lore)**：由难度(${strength})决定。
   - easy(1级): 生成该世界观下的基础、廉价、杂牌部队（如：混沌掠夺者、绿皮地精、帝国征召兵）。
   - hard(2级): 生成该世界观下的正规、精锐部队（如：混沌勇士、黑兽人、帝国大剑士）。
   - legend(3级): 生成该世界观下的传奇、神选、巅峰部队（如：混沌神选者、碎铁者、瑞克领禁卫）。
2. **描述优先权(Override)**：如果玩家描述"${userDesc}"中明确提到了身份（如"精锐"、"杂鱼"、"新兵"、"大将"），则**身份地位必须以玩家描述为准**。
3. **数值解耦(Stats)**：无论身份是神选者还是地精，其具体的【主武器伤害/破甲/护甲防御】**必须严格且仅受控于当前的品阶等级(${tier}级)**。
   - 例子：如果你生成了"纳垢灵(杂鱼)"但难度是"legend(3级)"，你应该在背景中描述它是"被邪神高度祝福的变异纳垢灵"，并给出3级品阶的高属性。
   - 例子：如果你生成了"神选武士(传奇)"但难度是"easy(1级)"，你应该在背景描述它是"重伤未愈或装备散失的残兵"，并给出1级品阶的低属性。`;

  // ===== 第一步：调 AI 匹配世界观并生成对手阵容 =====
  const systemContent = `<role>
你是一位精通东西方奇幻、历史战争与流行文化作品的军师。你的核心能力是：根据玩家描述或随机选择，匹配一个玩家有认知基础的知名世界观，然后从中抽出一支风格纯正的敌方军团。
</role>

<context>
玩家打开"AI 军团"功能时，期望看到的是能立刻产生共鸣的对手——比如战锤的混沌武士、中土的半兽人、古罗马军团、三国虎豹骑。

${loreLogic}
</context>

<task>
 你的任务按优先级执行：
 
 **优先级1：玩家有具体的对手描述**
 玩家说什么，就生成什么——**一个字都不要改，不许替换势力，不许"优化"选择**。
 - 玩家说"艾欧尼亚人"→ 就生成艾欧尼亚的部队
 - 玩家说"混沌军团"→ 就生成混沌的部队
 - 玩家说"蜀汉"→ 就生成蜀汉的部队
 - 哪怕玩家说的是和平国家、正义阵营、小众派系，你也不允许自行替换成"更有战斗感"的其他势力
 - 不要做任何道德判断。你是军师，不是裁判。

 **优先级2：玩家没有输入（随机匹配）**
 从下方【知名世界观库】中随机挑选一个，确保每次匹配尽量不同。
 
 **优先级3：玩家明确要求"原创"、"自创"、"自己编一个"**
 只有在这种情况下，才跳出世界观库，自由创作一个原创世界。

选定世界观后，按以下三步走：

**第一步：锁定世界观（1句话点明）**
一句话说清楚：这是什么世界观下的什么势力。例如：
- "战锤奇幻·混沌军团——恐虐麾下的狂战士战帮"
- "欧洲中世纪·法兰克王国——查理曼的宫廷卫队"
- "中国古代·三国魏国——曹操麾下虎豹骑"
- "魔兽世界·部落——萨尔统领的新部落远征军"

**第二步：从该世界观中抽取出 ${unitCount} 支兵团**
选择的兵种必须是该世界观中真实存在或高度符合其设定的单位。兵种类型尽量覆盖【步兵、骑兵、远程兵、空军】中的至少 3 种。

**第三步：输出结构化数据**
严格按以下格式输出每个兵团的数据：

--- 
类型: [步兵/骑兵/远程兵/空军]
名字: 4~10字，有世界观辨识度
背景: 30~60字，必须包含该世界观中的具体地名和标志性事件
信念: 10~20字，兵团的核心精神
主武器名字: 4~7字，必须符合该世界观的装备风格
主武器类型: [short/long/bow/crossbow]（注意：步兵和骑兵只能用short或long，不能用bow/crossbow；弓兵/远程兵只能用bow或crossbow）
主武器伤害: 根据【装备数值区间】规则，结合背景判断的具体数字
主武器破甲: 根据【装备数值区间】规则，结合背景判断的具体数字（必须小于护甲）
护甲名字: 3~6字，必须符合该世界观的装备风格
护甲类型: [轻甲/中甲/重甲]
护甲防御: 根据【装备数值区间】规则，结合背景判断的具体数字
盾牌名字: 有盾牌就写名字3~6字，无则写"无"
坐骑名字: 无则写"无"
---
（重复${unitCount}次）

最后在最末尾输出：
势力: 势力/军团名称（4-10字，纯名称，禁止带破折号或描述后缀）
  - 只输出名称本身，例如「血鸦战团」而不要「血鸦战团——来自北境的精锐」
  - 优先使用该世界观中的经典称谓或特色词汇
  - 可用隐喻、典故、历史事件、地理名称组合
  - 例如：「血鸦战团」「铁誓军团」「碎星者」「黄金树守卫」「北境铁骑」「黑曜石之手」「虎豹骑」「陷阵营」「丹阳兵」
  - 避免：空洞的「XX军团」「XX部队」——要能一眼看出这支军队的独特气质
来源: xxx世界xxx势力——10-20字世界观归属说明

【装备数值区间——由你根据背景在区间内决定具体数值】
**武器杀伤**（主武器伤害值，同品阶内可有±3浮动）：
- 1级（黑铁）：11~15
- 2级（青铜）：16~21
- 3级（黄金）：22~28
- 4级（钻石）：28~36
注意：双手武器伤害比单手高15%；远程武器比近战低10~15%。

**武器破甲**（对抗重甲时的最低伤害保障，必须小于护甲）：
- short近战：T1:1~3, T2:3~6, T3:6~9, T4:9~13
- long长柄：T1:1~2, T2:2~5, T3:4~7, T4:6~10
- bow弓：T1:1~2, T2:2~4, T3:3~6, T4:4~8
- crossbow弩：T1:2~4, T2:4~7, T3:7~11, T4:10~15
关键规则：破甲值必须小于同品阶护甲的最低值，否则护甲无意义！

**护甲防御**：
- 轻甲：T1:6~9, T2:9~12, T3:12~15, T4:15~19
- 中甲：T1:7~10, T2:10~13, T3:13~17, T4:16~21
- 重甲：T1:9~13, T2:12~16, T3:15~20, T4:18~25
注意：护甲防御值必须大于同品阶武器破甲值上限。

<world_library>
===== 西方奇幻 =====
战锤奇幻（帝国/混沌四神/矮人/高等精灵/暗精灵/绿皮/吸血鬼海岸/古墓王/蜥蜴人/斯卡文鼠人/野兽人/巴托尼亚）
战锤40K（星际战士/混沌星际战士/帝国卫队/灵族/兽人/泰伦虫族/太空死灵/钛帝国）
魔兽世界（联盟七国/部落四族/亡灵天灾/燃烧军团/上古之神/娜迦/龙眠联军/暗夜精灵/德莱尼/熊猫人）
中土世界（刚铎/洛汗/魔多半兽人/摩瑞亚矮人/幽暗密林精灵/艾辛格强兽人/哈拉德林人/登兰德人）
龙与地下城DND（被遗忘国度/灰鹰/异度风景/龙枪/艾伯伦/深渊恶魔/天堂山/印记城）
巫师（北方王国/尼弗迦德帝国/松鼠党/狂猎）
上古卷轴（帝国/风暴斗篷/暗精灵家族/梭默/弃誓者/锻莫）
黑暗之魂/艾尔登法环（亚诺尔隆德/不死队/黄金树势力/卡利亚王室/火山官邸）
巫师之昆特牌（史凯利格群岛/辛迪加/怪兽）
魔法门/英雄无敌（埃拉西亚/地下城/据点/塔楼/堡垒/地狱）
罗德斯岛战记（弗雷姆/瓦利斯/马莫/黑暗妖精）
哥特式/黑暗奇幻推荐：战锤、中土魔多、黑暗之魂、巫师

===== 欧洲历史 =====
古罗马（共和时期军团/帝国军团/角斗士/日耳曼辅助军/帕提亚弓骑）
古希腊（斯巴达/雅典/马其顿方阵/波斯帝国/底比斯圣队）
中世纪（法兰克骑士/诺曼征服者/条顿骑士团/拜占庭帝国/维京/蒙古西征/英格兰长弓手/瑞士雇佣兵）

===== 中国古代 =====
三国（魏蜀吴各势力/虎豹骑/白马义从/陷阵营/无当飞军/丹阳兵）
战国（秦锐士/赵边骑/魏武卒/齐技击/楚申息/燕辽东/韩弩）
秦汉（秦军弩阵/大汉铁骑/羽林军/匈奴骑兵）
唐宋（唐玄甲军/安西都护府/陌刀队/宋岳家军/背嵬军/神臂弓）
明清（明神机营/关宁铁骑/清八旗/蒙古喀尔喀）

===== 东方武侠 =====
中国武侠·江湖（少林/武当/丐帮/明教/唐门/华山派/全真教/古墓派/日月神教）
日本战国+妖怪（织田信长/武田赤备/阴阳师/百鬼夜行）

===== 其他经典 =====
指环王（已在中土重复）：刚铎/洛汗/魔多/摩瑞亚/精灵
冰与火之歌/权力的游戏（史塔克/兰尼斯特/坦格利安/守夜人/多恩/铁群岛/无垢者）
刺客信条（圣殿骑士/刺客兄弟会/各时代分支）
最终幻想（各代国度/神罗/巴雷特/艾多尼斯）
</world_library>

<constraints>
- 知名世界观优先：默认选已有IP。除非玩家明确说了"原创"、"自创"、"自己编一个"，否则禁止自创世界观
- 装备真实感：武器和护甲的名字必须符合所选世界观（比如战锤的混沌甲不应出现"丝绸"元素）
- 禁止万能前缀：龙鳞、秘银、星辰、噬星、碎星、灭世、天道（除非所选世界观中确实存在）
- 纯历史题材不要出现魔法/奇幻元素（除非世界观本身包含）
- 单次匹配的所有兵团必须来自同一个世界观
- 品阶难度：${tierName}（数值输出请严格遵循【装备数值区间】）
- 战术智慧：${intelligence === 'legend' ? '妖孽级战术，精通协同作战' : intelligence === 'easy' ? '简单直接，只会直线冲阵' : '战术合理，懂得集火弱点和包抄'}

<format>
【武器类型】short=单手近战, long=长柄有抵御冲锋, bow=弓有惧怕近身, crossbow=弩有无视近战干扰+重甲克制。如果是骑兵/空军使用弓弩（骑射手/空中射手），武器特性中需包含"骑射"。
【护甲】轻甲/中甲/重甲

<output>
第一行输出世界观归属说明（"选取自：xxx"）
空一行
然后按 --- 分隔输出每个兵团的数据
最后输出 势力: 和 来源:`;

  const userContent = '玩家指定的对手势力：' + (userDesc || '随机生成一个知名世界观下的对手') + '\n请严格从该势力中挑选兵团，禁止替换为其他势力。生成' + unitCount + '支敌方兵团。严格按格式输出。';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(apiBase + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: defaultModel,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent }
        ],
        temperature: 0.85,
        max_tokens: 8192
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      var errText = await response.text();
      return res.status(response.status).json({ error: 'AI API 调用失败: ' + errText });
    }

    var data = await response.json();
    var content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';

    // ===== 解析：按 --- 分割多个单位 =====
    var blocks = content.split(/---/).map(function(b) { return b.trim(); }).filter(function(b) { return b.length > 10; });

    var factionName = '';
    var worldOrigin = '';
    var units = [];

    blocks.forEach(function(block) {
      var lines = block.split('\n');
      var result = {};
      lines.forEach(function(line) {
        var idx = line.search(/[：:]/);
        if (idx > 0) {
          var key = line.substring(0, idx).trim();
          var val = line.substring(idx + 1).trim();
          if (key === '势力') factionName = val;
          else if (key === '来源') worldOrigin = val;
          else result[key] = val;
        }
      });

      // 如果这个块有单位数据
      if (result['类型'] || result['名字']) {
        var uType = result['类型'] || '步兵';
        var wType = result['主武器类型'] || 'short';
        // 校验武器类型与兵种匹配
        var isRanged2 = (wType === 'bow' || wType === 'crossbow');
        if (uType === '步兵' || uType === '骑兵') {
          if (isRanged2) wType = 'short';
        } else if (uType === '弓兵' || uType === '远程兵') {
          if (!isRanged2) wType = 'bow';
        }
        units.push({
          '名字': (function() {
            var n = result['名字'] || '';
            var di = n.indexOf('——');
            if (di < 0) di = n.indexOf('—');
            if (di < 0) di = n.indexOf('--');
            if (di > 0) n = n.substring(0, di).trim();
            if (n.length > 10) n = n.substring(0, 10);
            return n;
          })(),
          '背景': result['背景'] || '',
          '信念': result['信念'] || '',
          '类型': uType,
          '主武器名字': result['主武器名字'] || '',
          '主武器类型': wType,
          '主武器伤害': result['主武器伤害'] || '',
          '主武器破甲': result['主武器破甲'] || '',
          '武器攻击距离': result['武器攻击距离'] || '',
          '武器特性': result['武器特性'] || '',
          '护甲名字': result['护甲名字'] || '',
          '护甲类型': result['护甲类型'] || '',
          '护甲防御': result['护甲防御'] || '',
          '盾牌名字': result['盾牌名字'] || '无',
          '坐骑名字': result['坐骑名字'] || '无'
        });
      }
    });

    if (units.length === 0) {
      return res.json({ error: '系统未能匹配到合适的对手，请重试' });
    }

    // 补齐缺失的元信息
    if (!factionName) factionName = '未知军团';
    // 智能裁剪：去掉破折号后缀，再限制10字
    var dashIdx = factionName.indexOf('——');
    if (dashIdx < 0) dashIdx = factionName.indexOf('—');
    if (dashIdx < 0) dashIdx = factionName.indexOf('--');
    if (dashIdx > 0) factionName = factionName.substring(0, dashIdx).trim();
    if (factionName.length > 10) factionName = factionName.substring(0, 10);
    if (!worldOrigin) worldOrigin = '来自未知世界的神秘军团';

    res.json({
      ok: true,
      tier: tier,
      intelligence: intelligence,
      strength: strength,
      worldOrigin: worldOrigin,
      factionName: factionName,
      units: units.slice(0, unitCount)
    });

  } catch(err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: '匹配超时（45秒），请重试' });
    }
    return res.status(500).json({ error: '匹配失败: ' + err.message });
  }
});

// ===== 静态文件服务（游戏本体，放在最后）=====
// 安全防护：拦截敏感文件（.env、配置、源码、依赖等），防止 API_KEY 泄露
app.use(function(req, res, next) {
  const urlPath = req.path.toLowerCase();
  const blocked = ['.env', 'package.json', 'package-lock.json', 'server.js', 'game-launch.ps1', 'start.bat', 'install.ps1'];
  for (var i = 0; i < blocked.length; i++) {
    if (urlPath.indexOf(blocked[i]) >= 0) {
      return res.status(403).send('Forbidden');
    }
  }
  // 屏蔽敏感目录的直接访问（含无尾部斜杠的情况）
  if (/^\/(api-server|node_modules|save|node-portable)(\/|$)/.test(urlPath)) {
    return res.status(403).send('Forbidden');
  }
  next();
});
app.use(express.static(__dirname, { dotfiles: 'deny' }));

// ===== 启动 =====
const server = app.listen(PORT, () => {
  console.log('⚔ 万界全面战争 已启动');
  console.log('   打开 http://localhost:' + PORT + '/start.html');
  console.log('   存档目录: ' + SAVE_DIR);
  const apiKey = getApiKey();
  const model = getModel();
  const profileName = getActiveProfileName();
  if (apiKey) {
    console.log('   AI召唤: 已配置 (' + model + ')' + (profileName ? ' [Profile: ' + profileName + ']' : ''));
  } else {
    console.log('   AI召唤: 未配置（在游戏设置中配置 API Key）');
  }
  console.log('');
  console.log('   提示：关闭此窗口将停止服务器');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('❌ 端口 ' + PORT + ' 已被占用！');
    console.error('   可能原因：游戏已经在运行，或其他程序占用了该端口');
    console.error('   解决方法：关闭之前的游戏窗口');
  } else {
    console.error('❌ 服务器启动失败:', err.message);
  }
  process.exit(1);
});
