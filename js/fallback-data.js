// AI路径引导：如需查找其他文件路径和功能说明，请先查看项目根目录的 AI_PATH_GUIDE.md；每新增/修改一个文件后，必须同步更新AI_PATH_GUIDE.md
// Fallback 配置数据
// 当 assets/data/*.json 加载失败时使用此处的硬编码数据
// 注意：P1-D14 已补全 W010/W013/W014 武器 ID，请勿丢失
// AI 提示：本文件与以下 assets/data/*.json 文件关联，如若修改，必须同时修改对应文件保持一致：
//   RD.races       ↔ race_config.json
//   ED.weapons/shields/armors/mounts ↔ equipment_config.json
//   UD.units/enemyUnits ↔ unit_config.json
//   DC.levels      ↔ difficulty_config.json
//   LC.levels      ↔ level_config.json
var FALLBACK_DATA = {
  RD: {races:[
    {id:'human',name:'人类',scale:1,typeLabel:'常规体型',baseHP:100,naturalArmor:3,naturalWeapon:3,baseMorale:60,baseMovement:1,attackRange:1,description:'意志坚定，纪律性强'},
    {id:'elf',name:'精灵',scale:1,typeLabel:'常规体型',baseHP:85,naturalArmor:2,naturalWeapon:3,baseMorale:65,baseMovement:1,attackRange:1,description:'精神坚韧，长寿沉稳'},
    {id:'war_dog',name:'战犬',scale:1,typeLabel:'小型野兽',baseHP:60,naturalArmor:2,naturalWeapon:8,baseMorale:45,baseMovement:2,attackRange:1,description:'训练有素的军犬，速度快、咬合力强',_isBeast:true},
    {id:'darkborn',name:'暗裔',scale:1,typeLabel:'常规体型',baseHP:120,naturalArmor:4,naturalWeapon:4,baseMorale:70,baseMovement:1,attackRange:1,description:'来自暗影深渊的邪恶种族，肉体强悍且意志冰冷，天生擅长杀戮与毁灭'}
  ]},
  ED: {weapons:[
    {id:'W001',name:'制式精铁长剑',tier:'iron',category:'近战武器',type:'short',handed:'one-handed',slot:'main',baseDamage:13,armorPierce:3,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:[],desc:'人族常规步兵标配，单手剑+盾组合'},
    {id:'W002',name:'制式精铁长戈',tier:'iron',category:'近战武器',type:'long',handed:'two-handed',slot:'main',baseDamage:13,armorPierce:3,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:['抵御冲锋'],desc:'双手长柄武器，抵御冲锋：正面防守骑兵时清零对方冲锋动能'},
    {id:'W003',name:'重型战斧',tier:'bronze',category:'近战武器',type:'short',handed:'two-handed',slot:'main',baseDamage:21,armorPierce:6,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵'],effects:[],desc:'双手重斧，破甲+5，兽人/野蛮人标配'},
    {id:'W004',name:'精灵长弓',tier:'iron',category:'远程武器',type:'bow',handed:'two-handed',slot:'main',baseDamage:12,armorPierce:2,attackRange:1,allowedRange:3,forUnits:['远程兵'],effects:['惧怕近身'],desc:'双手长弓，惧怕近身：相邻格有敌军时禁射'},
    {id:'W005',name:'制式钢弩',tier:'bronze',category:'远程武器',type:'crossbow',handed:'one-handed',slot:'main',baseDamage:15,armorPierce:4,attackRange:1,allowedRange:2,forUnits:['远程兵'],effects:['无视近战干扰'],desc:'单手钢弩，无视近战干扰：相邻格有敌军仍可射击'},
    {id:'W006',name:'重型攻城弩',tier:'bronze',category:'远程武器',type:'crossbow',handed:'two-handed',slot:'main',baseDamage:18,armorPierce:5,attackRange:1,allowedRange:3,forUnits:['远程兵'],effects:['重甲克制','无视近战干扰'],desc:'双手重弩，重甲克制：攻击护甲≥30目标时伤害×1.2，无视近战干扰'},
    {id:'W009',name:'精灵短剑',tier:'iron',category:'近战武器',type:'short',handed:'one-handed',slot:'main',baseDamage:13,armorPierce:3,attackRange:1,allowedRange:1,forUnits:['远程兵','步兵'],effects:[],desc:'单手短剑，远程兵应急近战装备'},
    {id:'W010',name:'兽人双刃斧',tier:'iron',category:'近战武器',type:'short',handed:'two-handed',slot:'main',baseDamage:15,armorPierce:4,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:[],desc:'兽人双手短斧，劈砍威力巨大'},
    {id:'W011',name:'矮人战锤',tier:'iron',category:'近战武器',type:'short',handed:'two-handed',slot:'main',baseDamage:15,armorPierce:4,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:[],desc:'矮人工匠打造的双手重锤'},
    {id:'W012',name:'亡灵骨弓',tier:'iron',category:'远程武器',type:'bow',handed:'two-handed',slot:'main',baseDamage:12,armorPierce:2,attackRange:1,allowedRange:3,forUnits:['远程兵'],effects:['惧怕近身'],desc:'双手骨弓，亡灵族远程标配'},
    {id:'W013',name:'魅魔皮鞭',tier:'iron',category:'近战武器',type:'short',handed:'one-handed',slot:'main',baseDamage:13,armorPierce:3,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:[],desc:'单手皮鞭，魅魔专属近战武器'},
    {id:'W014',name:'巨人木棒',tier:'iron',category:'近战武器',type:'short',handed:'two-handed',slot:'main',baseDamage:15,armorPierce:4,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:[],desc:'巨人双手木棒，仅大型单位可装备'},
    {id:'W015',name:'龙息火枪',tier:'bronze',category:'远程武器',type:'crossbow',handed:'two-handed',slot:'main',baseDamage:18,armorPierce:5,attackRange:1,allowedRange:3,forUnits:['远程兵'],effects:['无视近战干扰'],desc:'超远程狙击火枪，附带枪刺可近战'},
    {id:'W016',name:'生锈草叉',tier:'iron',category:'近战武器',type:'long',handed:'two-handed',slot:'main',baseDamage:8,armorPierce:3,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:[],desc:'双手长叉，农用草叉磨尖了就当武器'},
    {id:'W017',name:'石块投索',tier:'iron',category:'远程武器',type:'bow',handed:'one-handed',slot:'main',baseDamage:6,armorPierce:0,attackRange:1,allowedRange:2,forUnits:['远程兵'],effects:['惧怕近身'],desc:'单手投索，麻绳编的投索扔石头'},
    {id:'W018',name:'锈镰刀',tier:'iron',category:'近战武器',type:'short',handed:'two-handed',slot:'main',baseDamage:4,armorPierce:1,attackRange:1,allowedRange:1,forUnits:['步兵','远程兵'],effects:[],desc:'双手镰刀，收获用的镰刀'},
    {id:'W019',name:'青铜长剑',tier:'bronze',category:'近战武器',type:'short',handed:'one-handed',slot:'main',baseDamage:18,armorPierce:5,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:[],desc:'青铜锻造的单手长剑，步兵骑兵通用，破甲略胜精铁'},
    {id:'W020',name:'青铜战戟',tier:'bronze',category:'近战武器',type:'long',handed:'two-handed',slot:'main',baseDamage:18,armorPierce:4,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:['抵御冲锋'],desc:'青铜双手长柄战戟，正面防守骑兵时可抵御冲锋'},
    {id:'W021',name:'秘银长剑',tier:'gold',category:'近战武器',type:'short',handed:'one-handed',slot:'main',baseDamage:23,armorPierce:7,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:['无视近战干扰'],desc:'秘银锻造的黄金单手长剑，近战时无视近战干扰'},
    {id:'W022',name:'精灵神弓',tier:'gold',category:'远程武器',type:'bow',handed:'two-handed',slot:'main',baseDamage:21,armorPierce:3,attackRange:1,allowedRange:3,forUnits:['远程兵'],effects:['惧怕近身'],desc:'精灵族黄金神弓，攻击距离极远，但惧怕近身'},
    {id:'W023',name:'穿甲重弩',tier:'gold',category:'远程武器',type:'crossbow',handed:'two-handed',slot:'main',baseDamage:23,armorPierce:7,attackRange:1,allowedRange:3,forUnits:['远程兵'],effects:['重甲克制','无视近战干扰'],desc:'黄金重弩，重甲克制且无视近战干扰，破甲利器'},
    {id:'W024',name:'精灵长矛',tier:'bronze',category:'近战武器',type:'long',handed:'two-handed',slot:'main',baseDamage:18,armorPierce:4,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:['抵御冲锋'],desc:'精灵族双手长矛，轻盈却致命，抵御骑兵冲锋效果显著'},
    {id:'W025',name:'精灵战弓',tier:'bronze',category:'远程武器',type:'bow',handed:'two-handed',slot:'main',baseDamage:16,armorPierce:2,attackRange:1,allowedRange:3,forUnits:['远程兵','空军'],effects:['惧怕近身'],desc:'精灵族制式战弓，攻击距离与精度远超人族的同类武器'},
    {id:'W026',name:'暗裔巨刃',tier:'gold',category:'近战武器',type:'short',handed:'two-handed',slot:'main',baseDamage:26,armorPierce:8,attackRange:1,allowedRange:1,forUnits:['步兵','骑兵','空军'],effects:[],desc:'暗裔战士的双手巨刃，一击便可劈开最坚固的板甲'},
    {id:'W027',name:'暗裔重弩',tier:'gold',category:'远程武器',type:'crossbow',handed:'two-handed',slot:'main',baseDamage:23,armorPierce:7,attackRange:1,allowedRange:3,forUnits:['远程兵'],effects:['重甲克制','无视近战干扰'],desc:'暗裔军团的制式重弩，完美结合了穿甲火力和持续压制能力'},
    {id:'W028',name:'万界终结者',tier:'diamond',category:'远程武器',type:'crossbow',handed:'two-handed',slot:'main',baseDamage:60,armorPierce:35,attackRange:1,allowedRange:4,forUnits:['远程兵'],effects:['重甲克制','无视近战干扰','迅捷','骑射'],desc:'传说中终结万界的灭世重弩，迅捷灵巧，一击粉碎一切护甲。仅有通关传说终局者可获此殊荣。',_unique:true}
  ],shields:[
    {id:'S001',name:'制式圆铁盾',tier:'bronze',category:'盾牌',defense:2,forUnits:['全兵种'],effects:['远程免伤+25%'],desc:'步兵标配圆盾，可与单手武器配合使用'},
    {id:'S002',name:'重型塔盾',tier:'iron',category:'盾牌',defense:5,forUnits:['步兵'],effects:['远程免伤+40%'],desc:'重步兵/枪兵标配，提供大量远程防护'},
    {id:'S003',name:'木盾',tier:'iron',category:'盾牌',defense:1,forUnits:['步兵'],effects:['远程免伤+10%'],desc:'木板拼的简陋盾牌'},
    {id:'S004',name:'青铜鸢盾',tier:'bronze',category:'盾牌',defense:3,forUnits:['全兵种'],effects:['远程免伤+30%'],desc:'青铜鸢盾，全兵种通用，远程免伤+30%'},
    {id:'S005',name:'秘银塔盾',tier:'gold',category:'盾牌',defense:6,forUnits:['步兵'],effects:['远程免伤+50%','全伤害减免5%'],desc:'秘银塔盾，步兵专用，远程免伤+50%且全伤害减免5%'},
    {id:'S006',name:'精灵纹章盾',tier:'bronze',category:'盾牌',defense:3,forUnits:['全兵种'],effects:['远程免伤+25%'],desc:'精灵族雕纹圆盾，轻盈且防护出色'},
    {id:'S007',name:'暗裔铁盾',tier:'gold',category:'盾牌',defense:4,forUnits:['步兵'],effects:['远程免伤+35%','近战伤害减免3'],desc:'暗裔重装步兵的铁盾，同时提供远程和近战双重防护'}
  ],armors:[
    {id:'A001',name:'人族制式皮甲',tier:'iron',category:'轻甲',defense:7,mobilityPenalty:0,forUnits:['远程兵','轻步兵'],forScale:['小型','中型','大型'],effects:[],desc:'人族常规步兵标配'},
    {id:'A002',name:'人族制式锁子甲',tier:'bronze',category:'中甲',defense:11,mobilityPenalty:0,forUnits:['重步兵','骑兵'],forScale:['中型','大型'],effects:[],desc:'人族重步兵标配'},
    {id:'A003',name:'人族制式重型板甲',tier:'bronze',category:'重甲',defense:14,mobilityPenalty:-1,forUnits:['重步兵','枪兵'],forScale:['中型','大型'],effects:['机动惩罚'],desc:'人族精锐重步兵标配'},
    {id:'A004',name:'精灵族皮甲',tier:'iron',category:'轻甲',defense:7,mobilityPenalty:0,forUnits:['远程兵','轻步兵'],forScale:['小型','中型','大型'],effects:[],desc:'精灵族标配'},
    {id:'A005',name:'兽人族重型皮甲',tier:'iron',category:'中甲',defense:8,mobilityPenalty:0,forUnits:['步兵','骑兵'],forScale:['中型','大型'],effects:[],desc:'兽人族常规标配'},
    {id:'A006',name:'兽人族重型板甲',tier:'iron',category:'重甲',defense:11,mobilityPenalty:-1,forUnits:['重步兵','骑兵'],forScale:['中型','大型'],effects:[],desc:'兽人族精锐标配'},
    {id:'A007',name:'亡灵族骨甲',tier:'iron',category:'轻甲',defense:7,mobilityPenalty:0,forUnits:['全兵种'],forScale:['小型','中型','大型'],effects:[],desc:'亡灵族标配'},
    {id:'A008',name:'魅魔族皮甲',tier:'iron',category:'轻甲',defense:7,mobilityPenalty:0,forUnits:['全兵种'],forScale:['小型','中型','大型'],effects:[],desc:'魅魔族标配'},
    {id:'A009',name:'龙鳞甲',tier:'gold',category:'特殊',defense:20,mobilityPenalty:0,forUnits:['全兵种'],forScale:['小型','中型','大型'],effects:['全伤害减免10%'],desc:'传奇护甲'},
    {id:'A010',name:'暗影皮甲',tier:'iron',category:'轻甲',defense:7,mobilityPenalty:0,forUnits:['远程兵','刺客'],forScale:['小型','中型','大型'],effects:[],desc:'暗夜精灵标配'},
    {id:'A011',name:'重型攻城护甲',tier:'bronze',category:'重甲',defense:16,mobilityPenalty:-1,forUnits:['步兵'],forScale:['中型','大型'],effects:[],desc:'攻城部队标配'},
    {id:'A012',name:'骑兵制式胸甲',tier:'iron',category:'中甲',defense:8,mobilityPenalty:0,forUnits:['骑兵'],forScale:['中型','大型'],effects:[],desc:'骑兵标配'},
    {id:'A013',name:'空军制式轻甲',tier:'iron',category:'轻甲',defense:7,mobilityPenalty:0,forUnits:['空军'],forScale:['小型','中型','大型'],effects:[],desc:'空军标配'},
    {id:'A014',name:'粗布衣',tier:'iron',category:'轻甲',defense:7,mobilityPenalty:0,forUnits:['全兵种'],forScale:['小型','中型','大型'],effects:[],desc:'粗麻织的衣裳，挡不住刀'},
    {id:'A015',name:'皮革护具',tier:'iron',category:'轻甲',defense:7,mobilityPenalty:0,forUnits:['全兵种'],forScale:['小型','中型','大型'],effects:[],desc:'硬皮革拼凑的简易护具'},
    {id:'A016',name:'青铜锁甲',tier:'bronze',category:'中甲',defense:11,mobilityPenalty:0,forUnits:['重步兵','骑兵','远程兵'],forScale:['中型','大型'],effects:[],desc:'青铜锁子甲，重步兵骑兵远程兵通用'},
    {id:'A017',name:'秘银板甲',tier:'gold',category:'重甲',defense:17,mobilityPenalty:0,forUnits:['重步兵','枪兵'],forScale:['中型','大型'],effects:['全伤害减免5%'],desc:'秘银板甲，重步兵枪兵专用，全伤害减免5%'},
    {id:'A018',name:'龙鳞甲',tier:'gold',category:'中甲',defense:14,mobilityPenalty:0,forUnits:['全兵种'],forScale:['小型','中型','大型'],effects:['火焰抗性'],desc:'龙鳞锻造的黄金中甲，全兵种通用，附带火焰抗性'},
    {id:'A019',name:'精灵链甲',tier:'bronze',category:'中甲',defense:11,mobilityPenalty:0,forUnits:['全兵种'],forScale:['小型','中型','大型'],effects:[],desc:'精灵族精工链甲，轻便而不失防护力'},
    {id:'A020',name:'暗裔板甲',tier:'gold',category:'重甲',defense:17,mobilityPenalty:-1,forUnits:['步兵','骑兵'],forScale:['中型','大型'],effects:[],desc:'暗裔军团的厚重板甲，提供顶级防护但影响机动'}
  ],mounts:[
    {id:'M001',name:'人族轻型战马',tier:'iron',type:'小型',scale:1,bonusHP:100,bonusArmor:2,bonusMove:2,bonusAtkRange:0,forUnits:['轻骑兵'],effects:[],desc:'人族轻骑兵标配'},
    {id:'M002',name:'人族重型战马',tier:'gold',type:'中型',scale:3,bonusHP:300,bonusArmor:5,bonusMove:3,bonusAtkRange:2,forUnits:['重骑兵'],effects:[],desc:'人族重骑兵标配'},
    {id:'M003',name:'精灵族角鹿',tier:'gold',type:'小型',scale:1,bonusHP:100,bonusArmor:1,bonusMove:4,bonusAtkRange:0,forUnits:['轻骑兵','空军'],effects:[],desc:'精灵族标配'},
    {id:'M004',name:'兽人族战狼',tier:'bronze',type:'中型',scale:2,bonusHP:200,bonusArmor:3,bonusMove:3,bonusAtkRange:1,forUnits:['骑兵'],effects:[],desc:'兽人族常规标配'},
    {id:'M005',name:'兽人族重型战熊',tier:'bronze',type:'大型',scale:5,bonusHP:500,bonusArmor:8,bonusMove:2,bonusAtkRange:1,forUnits:['重骑兵'],effects:[],desc:'兽人族精锐标配'},
    {id:'M006',name:'矮人族战羊',tier:'bronze',type:'中型',scale:3,bonusHP:300,bonusArmor:6,bonusMove:3,bonusAtkRange:1,forUnits:['骑兵'],effects:[],desc:'矮人族标配'},
    {id:'M007',name:'亡灵族骨马',tier:'bronze',type:'小型',scale:1,bonusHP:100,bonusArmor:0,bonusMove:3,bonusAtkRange:1,forUnits:['骑兵'],effects:[],desc:'亡灵族标配'},
    {id:'M008',name:'魅魔族梦魇马',tier:'gold',type:'中型',scale:3,bonusHP:300,bonusArmor:4,bonusMove:4,bonusAtkRange:1,forUnits:['骑兵'],effects:[],desc:'魅魔族标配'},
    {id:'M009',name:'巨人族猛犸象',tier:'bronze',type:'大型',scale:7,bonusHP:700,bonusArmor:10,bonusMove:2,bonusAtkRange:1,forUnits:['重骑兵'],effects:[],desc:'巨人族标配'},
    {id:'M010',name:'龙族幼龙',tier:'diamond',type:'传奇',scale:10,bonusHP:1000,bonusArmor:15,bonusMove:5,bonusAtkRange:1,forUnits:['空军','骑兵'],effects:['飞行能力'],desc:'传奇坐骑'},
    {id:'M011',name:'人族空军狮鹫',tier:'gold',type:'中型',scale:4,bonusHP:400,bonusArmor:8,bonusMove:3,bonusAtkRange:1,forUnits:['空军'],effects:['飞行能力','空中震慑'],desc:'人族空军标配'},
    {id:'M012',name:'精灵族空军巨鹰',tier:'diamond',type:'中型',scale:3,bonusHP:300,bonusArmor:6,bonusMove:5,bonusAtkRange:1,forUnits:['空军'],effects:['飞行能力','空中震慑'],desc:'精灵族空军标配'},
    {id:'M013',name:'亡灵族空军骨龙',tier:'diamond',type:'大型',scale:8,bonusHP:800,bonusArmor:12,bonusMove:3,bonusAtkRange:1,forUnits:['空军'],effects:['飞行能力','空中震慑'],desc:'亡灵族空军标配'},
    {id:'M014',name:'战象',tier:'bronze',type:'大型',scale:7,bonusHP:700,bonusArmor:10,bonusMove:2,bonusAtkRange:1,forUnits:['重骑兵'],effects:[],desc:'常规重型坐骑'},
    {id:'M015',name:'独角兽',tier:'gold',type:'中型',scale:3,bonusHP:300,bonusArmor:5,bonusMove:4,bonusAtkRange:1,forUnits:['骑兵','空军'],effects:[],desc:'传奇坐骑'},
    {id:'M016',name:'银翼狮鹫',tier:'gold',type:'中型',scale:4,bonusHP:400,bonusArmor:8,bonusMove:3,bonusAtkRange:1,forUnits:['空军'],effects:['飞行能力'],desc:'黄金品阶银翼狮鹫，空军专用飞行坐骑'}
  ]},
  UD: {units:[
    {id:'01',name:'磐石重步兵团',race:{id:'human',name:'人族'},type:'infantry',typeName:'步兵',image:'assets/images/icon_bronze_melee.png',icon:'🛡️',unitCount:160,equipment:{mainWeapon:'W002',shield:null,armor:'A002',mount:null},background:'边境常驻主力',belief:'正面稳守',_summonTier:2},
    {id:'02',name:'暴风骑兵团',race:{id:'human',name:'人族'},type:'cavalry',typeName:'骑兵',image:'assets/images/icon_gold_cavalry.png',icon:'🐴',unitCount:40,equipment:{mainWeapon:'W001',shield:'S001',armor:'A012',mount:'M002'},background:'皇家近卫',belief:'侧翼包抄',_summonTier:3},
    {id:'03',name:'鹰眼弓箭手兵团',race:{id:'elf',name:'精灵族'},type:'archer',typeName:'远程兵',image:'assets/images/icon_bronze_ranged.png',icon:'🏹',unitCount:160,equipment:{mainWeapon:'W004',shield:null,armor:'A004',mount:null},background:'精灵森林',belief:'精准隐蔽',_summonTier:2},
    {id:'04',name:'雷霆狮鹫空军兵团',race:{id:'human',name:'人族'},type:'flying',typeName:'空军',image:'assets/images/icon_gold_flying.png',icon:'🦅',unitCount:20,equipment:{mainWeapon:'W001',shield:null,armor:'A013',mount:'M011'},background:'空中主力',belief:'空中制霸',_summonTier:3},
    {id:'05',name:'农民步兵团',race:{id:'human',name:'人族'},type:'peasant_infantry',typeName:'农民步兵',image:'assets/images/icon_iron_melee.png',icon:'🔰',unitCount:80,equipment:{mainWeapon:'W016',shield:null,armor:'A015',mount:null},background:'临时征召',belief:'保家卫乡',_summonTier:1},
    {id:'06',name:'农民弓兵团',race:{id:'human',name:'人族'},type:'peasant_archer',typeName:'农民弓兵',image:'assets/images/icon_iron_ranged.png',icon:'🔰',unitCount:160,equipment:{mainWeapon:'W017',shield:null,armor:'A014',mount:null},background:'配发猎弓',belief:'射中就赚',_summonTier:1},
    {id:'07',name:'战犬侦查营',race:{id:'war_dog',name:'战犬'},type:'beast_infantry',typeName:'野兽步兵',image:'assets/images/icon_iron_beast.png',icon:'🐺',unitCount:160,equipment:{mainWeapon:null,shield:null,armor:null,mount:null},background:'精锐战犬，擅长侦察和骚扰',belief:'忠诚勇猛',_summonTier:1},
    {id:'08',name:'精锐弩兵兵团',race:{id:'human',name:'人族'},type:'elite_archer',typeName:'远程兵',image:'assets/images/icon_bronze_ranged.png',icon:'🏹',unitCount:160,equipment:{mainWeapon:'W005',shield:null,armor:'A004',mount:null},background:'精锐弩兵，钢弩破甲',belief:'精准至上',_summonTier:2}
  ],enemyUnits:[
    {id:'EA01',name:'蛮族步卒',race:{id:'human',name:'人族'},type:'infantry',typeName:'步兵',unitCount:160,equipment:{mainWeapon:'W016',shield:null,armor:'A015',mount:null}},
    {id:'EA02',name:'猎弓手',race:{id:'human',name:'人族'},type:'archer',typeName:'远程兵',unitCount:160,equipment:{mainWeapon:'W017',shield:null,armor:'A014',mount:null}},
    {id:'EA03',name:'轻骑斥候',race:{id:'human',name:'人族'},type:'cavalry',typeName:'骑兵',unitCount:60,equipment:{mainWeapon:'W018',shield:null,armor:'A015',mount:null}},
    {id:'EB01',name:'铁卫步兵',race:{id:'human',name:'人族'},type:'infantry',typeName:'步兵',unitCount:160,equipment:{mainWeapon:'W002',shield:'S001',armor:'A002',mount:null}},
    {id:'EB02',name:'神射手',race:{id:'elf',name:'精灵族'},type:'archer',typeName:'远程兵',unitCount:160,equipment:{mainWeapon:'W004',shield:null,armor:'A004',mount:null}},
    {id:'EB03',name:'铁甲骑士',race:{id:'human',name:'人族'},type:'cavalry',typeName:'骑兵',unitCount:40,equipment:{mainWeapon:'W001',shield:'S001',armor:'A012',mount:'M002'}},
    {id:'EC01',name:'皇家铁卫',race:{id:'human',name:'人族'},type:'infantry',typeName:'步兵',unitCount:160,equipment:{mainWeapon:'W002',shield:'S001',armor:'A002',mount:null}},
    {id:'EC02',name:'龙骑士',race:{id:'human',name:'人族'},type:'flying',typeName:'空军',unitCount:20,equipment:{mainWeapon:'W001',shield:null,armor:'A013',mount:'M011'}},
    {id:'EC03',name:'战狼群',race:{id:'human',name:'人族'},type:'beast_infantry',typeName:'野兽步兵',unitCount:60,equipment:{mainWeapon:null,shield:null,armor:null,mount:null}},
    {id:'ED01',name:'精灵长矛护卫',race:{id:'elf',name:'精灵族'},type:'infantry',typeName:'步兵',unitCount:160,equipment:{mainWeapon:'W024',shield:null,armor:'A019',mount:null}},
    {id:'ED02',name:'精灵游侠',race:{id:'elf',name:'精灵族'},type:'archer',typeName:'远程兵',unitCount:160,equipment:{mainWeapon:'W025',shield:null,armor:'A004',mount:null}},
    {id:'ED03',name:'精灵风骑兵',race:{id:'elf',name:'精灵族'},type:'cavalry',typeName:'骑兵',unitCount:40,equipment:{mainWeapon:'W009',shield:'S006',armor:'A019',mount:'M003'}},
    {id:'ED04',name:'精灵剑舞者',race:{id:'elf',name:'精灵族'},type:'infantry',typeName:'步兵',unitCount:160,equipment:{mainWeapon:'W009',shield:'S006',armor:'A004',mount:null}},
    {id:'ED05',name:'精灵鹰射手',race:{id:'elf',name:'精灵族'},type:'archer',typeName:'远程兵',unitCount:160,equipment:{mainWeapon:'W004',shield:null,armor:'A004',mount:null}},
    {id:'EE01',name:'暗裔重装战士',race:{id:'darkborn',name:'暗裔'},type:'infantry',typeName:'步兵',unitCount:160,equipment:{mainWeapon:'W026',shield:'S007',armor:'A020',mount:null}},
    {id:'EE02',name:'暗裔弩手',race:{id:'darkborn',name:'暗裔'},type:'archer',typeName:'远程兵',unitCount:160,equipment:{mainWeapon:'W027',shield:null,armor:'A015',mount:null}},
    {id:'EE03',name:'暗裔死亡骑士',race:{id:'darkborn',name:'暗裔'},type:'cavalry',typeName:'骑兵',unitCount:40,equipment:{mainWeapon:'W010',shield:'S007',armor:'A020',mount:'M002'}},
    {id:'EE04',name:'暗裔巨魔',race:{id:'darkborn',name:'暗裔'},type:'beast_infantry',typeName:'野兽步兵',unitCount:60,equipment:{mainWeapon:'W014',shield:null,armor:null,mount:null}},
    {id:'EE05',name:'暗裔怨灵',race:{id:'darkborn',name:'暗裔'},type:'flying',typeName:'空军',unitCount:20,equipment:{mainWeapon:'W013',shield:null,armor:'A009',mount:'M008'}}
  ]},
  DC: {levels:{
    easy:{
      label:'低',
      desc:'敌方多为农民兵，AI 行动迟缓',
      enemy:["peasant_infantry","peasant_infantry","peasant_infantry","peasant_archer","peasant_archer","peasant_archer"],
      ai:{targeting:"random",moveStyle:"random",maxMoveSteps:1}
    },
    medium:{
      label:'中',
      desc:'敌方混编农民与正规兵，AI 主动进攻',
      enemy:["peasant_infantry","peasant_infantry","infantry","peasant_archer","peasant_archer","archer"],
      ai:{targeting:"nearest",moveStyle:"toward",maxMoveSteps:1}
    },
    hard:{
      label:'高',
      desc:'敌方全正规兵种，AI 精准集火',
      enemy:["infantry","infantry","cavalry","cavalry","archer","flying"],
      ai:{targeting:"weakest",moveStyle:"advance",maxMoveSteps:2}
    },
    extreme:{
      label:'极难',
      desc:'敌方精锐大军压境，AI 穷追不舍',
      enemy:["infantry","infantry","infantry","cavalry","cavalry","cavalry","archer","archer","flying","flying"],
      ai:{targeting:"focus_fire",moveStyle:"hunt",maxMoveSteps:3}
    }
  },defaultEnemy:["infantry","infantry","infantry","cavalry","cavalry","cavalry","archer","archer","flying","flying"]},
  LC: { levels: [
    {id:'easy_1',name:'蛮族前哨',difficulty:'easy',tier:'iron',enemySetId:'setA',enemyUnitIds:['EA01','EA01','EA01','EA01'],rewardPoints:100,guaranteedDrop:null,desc:'蛮族步卒四散在前哨营地'},
    {id:'easy_2',name:'骚扰部队',difficulty:'easy',tier:'iron',enemySetId:'setA',enemyUnitIds:['EA01','EA01','EA01','EA02','EA02'],rewardPoints:120,guaranteedDrop:null,desc:'蛮族步卒掩护猎弓手从两翼袭扰'},
    {id:'easy_3',name:'骑兵突袭',difficulty:'easy',tier:'iron',enemySetId:'setA',enemyUnitIds:['EA01','EA01','EA02','EA02','EA03','EA03'],rewardPoints:150,guaranteedDrop:'W020',desc:'轻骑斥候从侧翼突击，步弓协同压上'},
    {id:'easy_4',name:'蛮族围营',difficulty:'easy',tier:'iron',enemySetId:'setA',enemyUnitIds:['EA01','EA01','EA01','EA02','EA02','EA03'],rewardPoints:180,guaranteedDrop:null,desc:'蛮族步弓骑三路并进攻营'},
    {id:'easy_5',name:'蛮族大军',difficulty:'easy',tier:'iron',enemySetId:'setA',enemyUnitIds:['EA01','EA01','EA01','EA02','EA02','EA03','EA03'],rewardPoints:250,guaranteedDrop:null,desc:'蛮族大军压境'},
    {id:'easy_6',name:'蛮族首领',difficulty:'easy',tier:'iron',enemySetId:'setA',enemyUnitIds:['EA01','EA01','EA01','EA02','EA02','EA03','EA03'],rewardPoints:300,guaranteedDrop:'W019',desc:'蛮族首领集结全部战力大举压境'},
    {id:'medium_1',name:'精灵前哨',difficulty:'medium',tier:'bronze',enemySetId:'setB',enemyUnitIds:['ED01','ED01','ED01','ED01'],rewardPoints:200,guaranteedDrop:null,desc:'精灵长矛护卫镇守森林前哨'},
    {id:'medium_2',name:'游侠巡逻',difficulty:'medium',tier:'bronze',enemySetId:'setB',enemyUnitIds:['ED01','ED01','ED01','ED02','ED02'],rewardPoints:250,guaranteedDrop:null,desc:'精灵游侠与长矛护卫协同巡逻'},
    {id:'medium_3',name:'风骑突袭',difficulty:'medium',tier:'bronze',enemySetId:'setB',enemyUnitIds:['ED01','ED01','ED02','ED02','ED03','ED03'],rewardPoints:300,guaranteedDrop:'S006',desc:'精灵风骑兵从两侧包抄突击'},
    {id:'medium_4',name:'剑舞战阵',difficulty:'medium',tier:'bronze',enemySetId:'setB',enemyUnitIds:['ED01','ED01','ED04','ED04','ED02','ED02'],rewardPoints:350,guaranteedDrop:null,desc:'精灵剑舞者加入战阵双持短剑切入'},
    {id:'medium_5',name:'森林围猎',difficulty:'medium',tier:'bronze',enemySetId:'setB',enemyUnitIds:['ED01','ED01','ED04','ED04','ED03','ED03','ED05','ED05'],rewardPoints:400,guaranteedDrop:null,desc:'精灵鹰射手居高临下校准射击'},
    {id:'medium_6',name:'精灵圣殿',difficulty:'medium',tier:'bronze',enemySetId:'setB',enemyUnitIds:['ED01','ED01','ED01','ED04','ED04','ED03','ED03','ED05'],rewardPoints:500,guaranteedDrop:'W025',desc:'精灵圣殿守卫全军出击'},
    {id:'hard_1',name:'钢甲前哨',difficulty:'hard',tier:'bronze',enemySetId:'setC',enemyUnitIds:['EB01','EB01','EB01','EB02','EB02'],rewardPoints:300,guaranteedDrop:null,desc:'精锐铁卫与神射手组成正规防线'},
    {id:'hard_2',name:'双线压制',difficulty:'hard',tier:'bronze',enemySetId:'setC',enemyUnitIds:['EB01','EB01','EB02','EB02','EB03','EB03'],rewardPoints:350,guaranteedDrop:null,desc:'铁甲骑士率铁卫正面压阵'},
    {id:'hard_3',name:'暗裔先锋',difficulty:'hard',tier:'bronze',enemySetId:'setC',enemyUnitIds:['EB01','EB01','EB02','EB02','EE01','EE01'],rewardPoints:400,guaranteedDrop:'A017',desc:'暗裔重装战士作为先锋登场'},
    {id:'hard_4',name:'精锐会战',difficulty:'hard',tier:'bronze',enemySetId:'setC',enemyUnitIds:['EB01','EB01','EB03','EB03','EE01','EE01','EE02','EE02'],rewardPoints:450,guaranteedDrop:null,desc:'铁甲骑士与暗裔弩手混编联合作战'},
    {id:'hard_5',name:'暗裔入侵',difficulty:'hard',tier:'bronze',enemySetId:'setC',enemyUnitIds:['EE01','EE01','EE02','EE02','EE03','EE03','EE04','EE04'],rewardPoints:550,guaranteedDrop:'S007',desc:'暗裔军团大举入侵死亡骑士统领巨魔'},
    {id:'hard_6',name:'钢铁长城',difficulty:'hard',tier:'bronze',enemySetId:'setC',enemyUnitIds:['EB01','EB01','EB03','EB03','EE01','EE01','EE03','EE03'],rewardPoints:650,guaranteedDrop:'W026',desc:'钢甲与暗影交织的最终防线'},
    {id:'legend_1',name:'皇家卫队',difficulty:'legend',tier:'gold',enemySetId:'setD',enemyUnitIds:['EC01','EC01','EC01','EC03','EC03'],rewardPoints:500,guaranteedDrop:null,desc:'皇家铁卫与战狼群侧翼突袭'},
    {id:'legend_2',name:'龙骑降临',difficulty:'legend',tier:'gold',enemySetId:'setD',enemyUnitIds:['EC01','EC01','EC02','EC02','EC03','EC03'],rewardPoints:650,guaranteedDrop:null,desc:'双龙骑士俯冲铁卫战狼地面协同'},
    {id:'legend_3',name:'暗裔天罚',difficulty:'legend',tier:'gold',enemySetId:'setD',enemyUnitIds:['EC01','EC01','EC02','EC02','EE03','EE03','EE05','EE05'],rewardPoints:750,guaranteedDrop:'W021',desc:'暗裔怨灵随死亡骑士降临'},
    {id:'legend_4',name:'终焉联军',difficulty:'legend',tier:'gold',enemySetId:'setD',enemyUnitIds:['EC01','EC01','EC03','EC03','EE03','EE03','EE05','EE05'],rewardPoints:850,guaranteedDrop:null,desc:'皇家与暗裔终焉联军碾压而来'},
    {id:'legend_5',name:'暗影王座',difficulty:'legend',tier:'gold',enemySetId:'setD',enemyUnitIds:['EC01','EC01','EC02','EC02','EE03','EE03','EE05','EE05'],rewardPoints:1050,guaranteedDrop:null,desc:'暗影王座前的最终守卫'},
    {id:'legend_6',name:'万界霸主',difficulty:'legend',tier:'gold',enemySetId:'setD',enemyUnitIds:['EC01','EC01','EC01','EC02','EC02','EE03','EE03','EE05'],rewardPoints:1200,guaranteedDrop:'W028',desc:'万界霸主的终极军势'}
  ] }
};
window.FALLBACK_DATA = FALLBACK_DATA;
