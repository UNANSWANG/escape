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
    bulletSpeed: 1000,
    /**人机匹配显示时间区间（秒） */
    roleMatchTime: [0.5, 1.2],
    /**上报排名值的模式系数（rank = 模式ID * 系数 + 该模式关卡数） */
    rankModeFactor: 100000,
}

/**玩家通用配置（赞不读表） */
export const playerCommonConfig = {
    /**自动瞄准检测范围 */
    autoAttackRange: 400,
    /**射击间隔（秒）（临时） */
    shootInterval: 0.2,
}

/**敌人通用配置 */
export const enemyCommonConfig = {
   
}

/**人机通用配置 */
export const robotCommonConfig = {
    
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

/**存储的键值 */
export enum SaveKey {
    /**关卡数据 */
    level = "level",
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
}

/**道具索引 */
export enum PropsName {

}
