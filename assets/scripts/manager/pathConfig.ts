/**游戏页面路径 */
export enum gamePath {
    /**游戏页面 */
    UIGame = "prefabs/UIPage/UIGame",
}

/**界面路径 */
export enum UIPath {
    /**主页面 */
    UIMain = "prefabs/UIPage/UIMain",
    /**成功页面 */
    UISuccess = "prefabs/UIPage/UISuccess",
    /**失败页面 */
    UIFail = "prefabs/UIPage/UIFail",
    /**设置页面 */
    UISetting = "prefabs/UIPage/UISetting",
    /**恭喜获得页面 */
    UIReward = "prefabs/UIPage/UIReward",
    /**复访页面 */
    UIRevisit = "prefabs/UIPage/UIRevisit",
    /**排行榜 */
    UIRank = "prefabs/UIPage/UIRank",
    /**控制台 */
    UIConsole = "prefabs/UIPage/UIConsole",
    /**匹配页面 */
    UIMatch = "prefabs/UIPage/UIMatch",
    /**背包页面 */
    UIBackpack = "prefabs/UIPage/UIBackpack",
    /**商店页面 */
    UIStore = "prefabs/UIPage/UIStore",
    /**商店子页面 */
    storePage = "prefabs/UIPage/store/storePage",
    /**签到页面 */
    UISign = "prefabs/UIPage/UISign",
    /**仓库页面 */
    UIStorehouse = "prefabs/UIPage/UIStorehouse",
    /**角色商店页面 */
    UIRoleStore = "prefabs/UIPage/UIRoleStore",
    /**图鉴页面 */
    UIHandBook = "prefabs/UIPage/UIHandBook",
    /**地图页面 */
    UIMap = "prefabs/UIPage/UIMap",
    /**礼包页面 */
    UIGift = "prefabs/UIPage/UIGift",
    /**显示物品页面 */
    UIShowItem = "prefabs/UIPage/UIShowItem",
    /**添加金币页面 */
    UIMoneyAdd = "prefabs/UIPage/UIMoneyAdd",
    /**小地图页面 */
    UISmallMap = "prefabs/UIPage/UISmallMap",
    /**游戏引导页面 */
    UIGameGuide = "prefabs/UIPage/UIGameGuide",
    /**通用引导页面 */
    UIGuide = "prefabs/UIPage/UIGuide",
}

/**物品路径 */
export enum ItemPath {
    /**提示 */
    tips = "prefabs/notice/tips",
    /**提示2 */
    tips2 = "prefabs/notice/tips2",
    /**子弹 */
    bullet = "prefabs/Item/bullet",
    /**游戏内连线 */
    gameLine = "prefabs/Item/gameLine",
    /**游戏图片物体 */
    gameSpriteItem = "prefabs/Item/gameSpriteItem",
    /**游戏文本物体 */
    gameLabelItem = "prefabs/Item/gameLabelItem",
    /**游戏spine物体 */
    gameSpineItem = "prefabs/Item/gameSpineItem",
    /**特效物体 */
    effectItem = "prefabs/Item/effectItem",
    /**超武商城物品 */
    superWeaponItem = "prefabs/Item/superWeaponItem",
    /**商店通用物品 */
    storeItem = "prefabs/Item/storeItem",
    /**物品 */
    item = "prefabs/Item/item",
    /**显示物品 */
    showItem = "prefabs/Item/showItem",
    /**角色头像物品 */
    roleAvatarItem = "prefabs/Item/roleAvatarItem",
    /**角色预制体 */
    role = "prefabs/game/role",
    /**士兵预制体 */
    soldier = "prefabs/game/soldier",
    /**角色显示预制体 */
    roleShow = "prefabs/common/roleShow",
    /**淘汰盒 */
    eliminationBox = "prefabs/game/box/eliminationBox",
    /**物资盒 */
    supplyBox = "prefabs/game/box/supplyBox",
    /**Boss盒 */
    bossBox = "prefabs/game/box/bossBox",
    /**角色1无人机 */
    drone = "prefabs/game/drone",
    /**圆形技能范围指示器 */
    skillRangeCircle = "prefabs/game/skillRangeCircle",
    /**矩形技能范围指示器 */
    skillRangeRect = "prefabs/game/skillRangeRect",
    /**矩形技能范围指示器-左 */
    skillRangeRectLeft = "prefabs/game/skillRangeRectLeft",
    /**注射器 */
    syringe = "prefabs/game/syringe",
    /**直升机 */
    helicopter = "prefabs/game/helicopter",
}

/**animation动画预制体 */
export enum animationItemPath {
    /**弹壳特效 */
    bulletShell = "prefabs/anim/bulletShell",
    /**旋风动画 */
    whirlwind = "prefabs/anim/whirlwind",
    /**滑铲烟雾动画 */
    shovelSmoke = "prefabs/anim/shovelSmoke",
    /**子弹爆炸动画 */
    bomb = "prefabs/anim/bomb",
    /**龙息动画 */
    dragonBreath = "prefabs/anim/dragonBreath",
}

/**音效路径 */
export enum audioPath {
    /**主页背景音乐 */
    background = "audio/zhuyeBGM",
    /**游戏内背景音乐 */
    gameBackground = "",
    /**游戏内点击音效 */
    click = "audio/dianji",
    /**单局胜利音效 */
    success = "audio/success",
    /**游戏内失败音效 */
    fail = "audio/fail",
    /**获得金币音效 */
    getMoney = "audio/getMoney",
    /**换弹音效 */
    reload = "audio/reload",
    /**击中敌人反馈 */
    hitEnemyFeedback = "audio/hitEnemyFeedback",
    /**击中建筑反馈 */
    hitBuildingFeedback = "audio/hitBuildingFeedback",
    /**走路右 */
    walkRight = "audio/walkRight",
    /**走路左 */
    walkLeft = "audio/walkLeft",
    /**武器 */
    weapon = "audio/weapon/",
    /**死亡音效 */
    death = "audio/death",
    /**霸王猫技能（循环） */
    boss0Skill = "audio/boss0Skill",
    /**霸王猫死亡 */
    boss0Death = "audio/boss0Death",
    /**机甲技能（循环） */
    boss1Skill = "audio/boss1Skill",
    /**机甲死亡 */
    boss1Death = "audio/boss1Death",
    /**冰龙技能（循环） */
    boss2Skill = "audio/boss2Skill",
    /**冰龙死亡 */
    boss2Death = "audio/boss2Death",
    /**角色0技能 */
    role0Skill = "audio/role0Skill",
    /**角色0被动(滑铲) */
    role0Passive = "audio/role0Passive",
    /**角色1技能 */
    role1Skill = "audio/role1Skill",
    /**角色2技能 */
    role2Skill = "audio/role2Skill",
    /**获得奖励（恭喜获得） */
    getReward = "audio/getReward",
    /**匹配成功 */
    matchSuccess = "audio/matchSuccess",
    /**人物升级 */
    roleUpgrade = "audio/roleUpgrade",
}

/**图片路径 */
export enum imgPath {
    /**默认头像 */
    defAvatar = "texture/rank/defaultAvatar",
    /**子弹 */
    bullet = "texture/game/bullet/bullet_",
    /**银币 */
    money = "texture/icon/item/item_200001",
    /**金币 */
    gold = "texture/icon/item/item_200002",
    /**排行榜底 */
    rankItemBg = "texture/rank/bg/bg_",
    /**排行榜线 */
    rankItemLine = "texture/rank/line/line_",
    /**物品背景 */
    itemBg = "texture/common/itemBg_",
    /**物品 */
    item = "texture/icon/item/item_",
    /**武器icon */
    weaponIcon = "texture/icon/weapons/weapons_",
    /**武器空图标 */
    weaponNone = "texture/icon/weapons/weaponNone",
    /**装备icon */
    equipIcon = "texture/icon/equipment/equipment_",
    /**商店物品背景 */
    storeItemBg = "texture/store/storeItemBg_",
    /**图鉴藏品背景 */
    bookItemBg = "texture/handbook/bookItemBg_",
    /**未解锁图鉴物品 */
    unItem = "texture/handbook/unItem",
    /**角色类型 */
    roleType = "texture/roleStore/roleType_",
    /**血条 */
    hpBar = "texture/game/hpBar",
    /**盒子品质光 */
    boxLight = "texture/game/boxLight/light_",
    /**士兵左手 */
    soldierLeftHand = "texture/soldier/hand/left_",
    /**士兵右手 */
    soldierRightHand = "texture/soldier/hand/right_",
    /**角色左手 */
    roleLeftHand = "texture/role/hand/left_",
    /**角色右手 */
    roleRightHand = "texture/role/hand/right_",
    /**段位徽章 */
    rankBadge = "texture/rank/badge/badge_",
    /**装备 */
    equipment = "texture/role/equipment/equipment_",
    /**头盔空图标 */
    headNone = "texture/icon/equipment/headNone",
    /**护甲空图标 */
    armorNone = "texture/icon/equipment/armorNone",
    /**残影 */
    ghost = "texture/role/skill/ghost",
    /**boss头像 */
    bossAvatar = "texture/boss/avatar/avatar_",
    /**boss全身 */
    bossBody = "texture/boss/body/body_",
    /**boss全身阴影 */
    bossMask = "texture/boss/mask/mask_",
    /**主动图标 */
    activeIcon = "texture/roleStore/skillIcon/active_",
    /**被动图标 */
    passiveIcon = "texture/roleStore/skillIcon/passive_",
    /**角色头像 */
    roleAvatar = "texture/role/avatar/avatar_",
    /**显示地图 */
    showMap = "texture/map/show/map_",
    /**小地图头像 */
    smallMapAvatar = "texture/role/mapAvatar/avatar_",
}

/**spine路径 */
export enum spinePath {
    /**角色spine（文件夹） */
    role = "spine/role/role_",
    /**士兵spine（文件夹） */
    soldier = "spine/soldier/soldier_",
    /**武器spine（文件夹） */
    weapon = "spine/weapons/weapons_",
    /**眩晕 */
    dizziness = "spine/dizziness/vertigo",
    /**手指点击 */
    click = "spine/click/dianji",
    /**宝石 */
    gem = "spine/roleSkill/gem/gem",
    /**剑雨spine（文件夹） */
    swordRain = "spine/bossSkill/swordRain",
    /**光盾（文件夹） */
    shield = "spine/roleSkill/shield",
    /**无人机回血（文件夹） */
    droneHeal = "spine/roleSkill/droneHeal",
}

/**地图数组 */
export const mapList = [
    {
        bundleName: "map_0",
        mapPath: "map_0",
        smallMapPath: "smallMap0",
    },
    {
        bundleName: "map_1",
        mapPath: "map_1",
        smallMapPath: "smallMap1",
    },
    {
        bundleName: "map_2",
        mapPath: "map_2",
        smallMapPath: "smallMap2",
    },
]
