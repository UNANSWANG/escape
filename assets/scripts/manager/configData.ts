/**游戏配置 */
export const configData = {
    /**人物移动速度 */
    moveSpeed: 300,
    /**游戏开始后人物移动速度 */
    moveSpeedGame: 200,
    /**人物皮肤数量 */
    roleSkinCount: 7,
    /**怪物皮肤数量 */
    enemySkinCount: 5,
    /**子弹速度 */
    bulletSpeed: 2000,
    /**人机匹配显示时间区间（秒） */
    roleMatchTime: [0.5, 1.2],
    /**上报排名值的模式系数（rank = 模式ID * 系数 + 该模式关卡数） */
    rankModeFactor: 100000,
    /**加载单圈时间 */
    loadCircleTime: 0.5,
    /**小药品初始数量 */
    drugDrugCount: 3,
    /**小药品恢复血量 */
    drugDrugHp: 0.2,
    /**小药品广告赠送数量 */
    drugDrugAdCount: 2,
    /**小药品使用时间（秒） */
    drugDrugUseTime: 2,
    /**大药品初始数量 */
    drugDrugCountBig: 1,
    /**大药品恢复血量 */
    drugDrugHpBig: 1,
    /**大药品广告赠送数量 */
    drugDrugAdCountBig: 1,
    /**大药品使用时间（秒） */
    drugDrugUseTimeBig: 4,
    /**撤离时间（秒） */
    leaveTime: 10,
}

/**玩家通用配置（暂不读表） */
export const playerCommonConfig = {
    /**枪口回正时间（秒） */
    gunResetTime: 1,
}

/**敌人通用配置 */
export const enemyCommonConfig = {
    /**巡逻等待时间（秒） */
    patrolWaitTime: [2, 5],
}

/**小兵通用配置 */
export const soldierCommonConfig = {
    /**npc攻击力百分比 */
    npcAttackPercent: 0.2,
    /**npc速度百分比 */
    npcSpeedPercent: 0.8,
    /**npc的攻击范围百分比 */
    npcAttackRangePercent: 0.8,
    /**npc的射速百分比 */
    npcFireRatePercent: 0.8,
}

/**gm配置 */
export const gmConfig = {
    /**是否只攻击自身 */
    onlyAttackSelf: false,
    /**是否免广告 */
    isFreeAd: false,
    /**boss是否无敌 */
    isBossInvincible: false,
    /**强制引导 */
    forceGuide: false,
}

/**游戏事件 */
export enum GameEvent {
    /**游戏暂停 */
    gamePause = "gamePause",
    /**游戏继续 */
    gameResume = "gameResume",
    /**刷新红点 */
    refreshRed = "refreshRed",
    /**加载表格 */
    loadTable = "loadTable",
    /**检测登录页加载回调 */
    checkLoginLoad = "checkLoginLoad",
    /**全部表格加载完成回调 */
    tableLoadComplete = "tableLoadComplete",
    /**加载预制体 */
    loading = "loading",
    /**刷新游戏关卡 */
    refreshGameLevel = "refreshGameLevel",
    /**复活游戏 */
    resurrectionGame = "resurrectionGame",
    /**刷新道具 */
    refreshProps = "refreshProps",
    /**关闭奖励界面 */
    closeRewardPage = "closeRewardPage",
    /**侧边栏回调 */
    revisitSidebar = "revisitSidebar",
    /**刷新游戏摄像机视角 */
    refreshGameCamera = "refreshGameCamera",
    /**刷新游戏外货币（场外） */
    refreshPlayerMonetary = "refreshPlayerMonetary",
    /**通用配置表加载完成 */
    commonTableFinish = "commonTableFinish",
    /**游戏内增加货币 */
    addGameMonetary = "addGameMonetary",
    /**全皮肤 */
    fullSkin = "fullSkin",
    /**刷新角色皮肤 */
    refreshRoleSkin = "refreshRoleSkin",
}

/**货币类型 */
export enum MonetaryType {
    /**银币 */
    silver,
    /**金币 */
    gold,
}

/**存储的键值 */
export enum SaveKey {
    /**关卡数据 */
    level = "level",
    /**银币 */
    money = "money",
    /**金币 */
    gold = "gold",
    /**累计签到天数 */
    signDays = "signDays",
    /**今日是否已签到 */
    isGetSign = "isGetSign",
    /**道具存储 */
    props = "props",
    /**引导 */
    guide = "guide",
    /**音效开关 */
    effect = "effect",
    /**音效音量 */
    effectVolume = "effectVolume",
    /**音乐开关 */
    music = "music",
    /**音乐音量 */
    musicVolume = "musicVolume",
    /**振动开关 */
    vibrat = "vibrat",
    /**今日是否领取过侧边栏奖励 */
    isGetRevisit = "isGetRevisit",
    /**用户头像 */
    avatarUrl = "avatarUrl",
    /**敌人是否只攻击自身（gm配置） */
    onlyAttackSelf = "onlyAttackSelf",
    /**是否免广告（gm配置） */
    isFreeAd = "isFreeAd",
    /**是否开启自动瞄准 */
    isAutoAiming = "isAutoAiming",
}

/**道具索引 */
export enum PropsName {

}
