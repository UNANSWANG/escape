/**游戏页面路径 */
export enum gamePath {
    /**游戏页面 */
    UIGame = "prefabs/UIPage/UIGame",
}

/**界面路径 */
export enum UIPath {
    /**加载页面 */
    UILoading = "UILoading",
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
}

/**物品路径 */
export enum ItemPath {
    /**提示 */
    tips = "prefabs/notice/tips",
    /**子弹 */
    bullet = "prefabs/Item/bullet",
    /**游戏通用物体 */
    gameItem = "prefabs/Item/gameItem",
    /**游戏图片物体 */
    gameSpriteItem = "prefabs/Item/gameSpriteItem",
    /**游戏spine物体 */
    gameSpineItem = "prefabs/Item/gameSpineItem",
    /**游戏animation物体 */
    gameAnimItem = "prefabs/Item/gameAnimItem",
    /**特效物体 */
    effectItem = "prefabs/Item/effectItem",
}

/**音效路径 */
export enum audioPath {
    /**主页背景音乐 */
    background = "audio/zhuyeBGM",
    /**游戏内背景音乐 */
    gameBackground = "audio/juneiBGM",
    /**游戏内点击音效 */
    click = "audio/dianji",
    /**单局胜利音效 */
    success = "audio/shengli",
    /**游戏内失败音效 */
    fail = "audio/shibai",
    /**获得金币音效 */
    getMoney = "audio/jinbihuode",
    /**点击准备音效 */
    clickPrepare = "audio/zhunbei",
}

/**图片路径 */
export enum imgPath {
    /**道具图片 */
    props = "texture/reward/props/props_",
    /**默认头像 */
    defAvatar = "texture/rank/moren",
    /**子弹皮肤 */
    bulletSkin = "texture/game/bullet/bullet_",
    /**角色全身 */
    roleBodyFull = "texture/role/all/all_",
    /**鼠鼠币 */
    money = "texture/common/money",
    /**排行榜底 */
    rankItemBg = "texture/rank/bg/bg_",
    /**排行榜线 */
    rankItemLine = "texture/rank/line/line_",
}

/**spine路径 */
export enum spinePath {
    /**角色spine（文件夹） */
    role = "spine/role/role_",
    /**敌人spine（文件夹） */
    boss = "spine/boss/boss_",
    /**眩晕 */
    dizziness = "spine/dizziness/vertigo",
    /**手指点击 */
    click = "spine/click/dianji",
}

/**动画路径 */
export enum animPath {
    
}
