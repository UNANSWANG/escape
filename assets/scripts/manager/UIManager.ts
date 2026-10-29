import { _decorator, AnimationClip, AssetManager, Component, instantiate, Node, Prefab, Sprite, tween, UITransform, Vec3 } from 'cc';
import { UIBase } from '../UIPage/UIBase';
import { UIBackpack } from '../UIPage/UIBackpack';
import { animPath, audioPath, gamePath, imgPath, ItemPath, UIPath } from './pathConfig';
import { ccResTools } from '../extention/resTools';
import { tipsNotice } from '../UIPage/tips/tipsNotice';
import { pData } from './playerData';
import { ccTools } from '../extention/generalTools';
import { audioMgr } from './audioManager';
import { MonetaryType } from './configData';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
/**统一管理界面缓存、页面切换、预制体加载和奖励动画 */
export class UIManager {
    /**界面与游戏资源所在的资源包 */
    resBundle: AssetManager.Bundle = null;
    /**通用文字提示预制体 */
    tipsPrefab: Prefab = null;
    /**游戏子弹预制体 */
    bulletPrefab: Prefab = null;
    /**游戏连线预制体 */
    gameLinePrefab: Prefab = null;
    /**货币和奖励飞行动画使用的特效预制体 */
    effectItemPrefab: Prefab = null;
    /**游戏通用图片节点预制体 */
    gameSpriteItemPrefab: Prefab = null;
    /**游戏通用文本节点预制体，也用于伤害飘字 */
    gameLabelItemPrefab: Prefab = null;
    /**游戏通用 Spine 动画节点预制体 */
    gameSpineItemPrefab: Prefab = null;
    /**游戏通用 Animation 动画节点预制体 */
    gameAnimItemPrefab: Prefab = null;
    /**通过 ItemPath.role 加载，供游戏界面创建玩家 */
    rolePrefab: Prefab = null;
    /**通过 ItemPath.soldier 加载，供游戏界面创建士兵 */
    soldierPrefab: Prefab = null;
    /**通过 ItemPath.roleShow 加载，供匹配界面显示角色 */
    roleShowPrefab: Prefab = null;
    /**死亡掉落容器预制体。 */
    supplyBoxPrefab: Prefab = null;
    eliminationBoxPrefab: Prefab = null;
    bossBoxPrefab: Prefab = null;
    /**role1 主动技能使用的无人机预制体。 */
    dronePrefab: Prefab = null;
    /** Shared circular skill warning prefab. */
    skillRangePrefab: Prefab = null;
    /**角色打药使用的注射器预制体。 */
    syringePrefab: Prefab = null;

    /**游戏页面挂载节点 */
    private gamePage: Node = null;
    /**普通界面挂载节点 */
    private uiPage: Node = null;
    /**提示界面挂载节点 */
    private noticePage: Node = null;
    /**货币和奖励动画挂载节点 */
    private effectNode: Node = null;

    /**以路径末段名称为键缓存界面实例，关闭后保留供再次打开 */
    private uiMap: Map<string, Node> = new Map();
    /**等待依次打开的界面队列 */
    private queuePageArr: queuePageData[] = [];
    /**当前通过队列打开的界面 */
    private currentQueuePage: queuePageData = null;
    /**游戏资源预加载任务，防止匹配页重复打开时并发加载 */
    private gamePreloadPromise: Promise<void> = null;
    /**游戏资源是否已全部预加载 */
    private gamePreloadComplete = false;

    /**从场景容器中初始化各类页面和特效的挂载节点 */
    initData(node) {
        this.initPage(node);
    }

    /**获取父节点下的 Game、UI、Notice 和 Effect 容器 */
    initPage(parent) {
        this.gamePage = parent.getChildByName('Game');
        this.uiPage = parent.getChildByName('UI');
        this.noticePage = parent.getChildByName('Notice');
        this.effectNode = parent.getChildByName('Effect');
    }

    /**加载启动后各页面都可能使用的预制体 */
    async preLoadCommonPrefab() {
        if (this.tipsPrefab) {
            return;
        }
        if (!this.resBundle) {
            throw new Error("资源包尚未加载");
        }

        this.tipsPrefab = await ccResTools.loadPrefab(this.resBundle, ItemPath.tips, false);
        if (!this.tipsPrefab) {
            throw new Error(`加载预制体失败: ${ItemPath.tips}`);
        }
        this.effectItemPrefab = await ccResTools.loadPrefab(this.resBundle, ItemPath.effectItem, false);
    }

    /**预加载结算界面、游戏预制体和动画；并发调用共享任务，失败后允许重试 */
    async preLoadGame() {
        if (this.gamePreloadComplete) {
            return;
        }
        if (this.gamePreloadPromise) {
            return this.gamePreloadPromise;
        }

        this.gamePreloadPromise = this.loadGameResources();
        try {
            await this.gamePreloadPromise;
            this.gamePreloadComplete = true;
        } catch (error) {
            // 清除失败任务，避免后续调用一直复用已失败的 Promise。
            this.gamePreloadPromise = null;
            throw error;
        }
    }

    /**执行游戏资源预加载 */
    private async loadGameResources() {
        if (!this.resBundle) {
            throw new Error("资源包尚未加载");
        }

        await Promise.all([
            // this.preLoadPage(gamePath.UIGame),
            this.preLoadPage(UIPath.UISuccess),
            this.preLoadPage(UIPath.UIFail),
            this.loadGamePrefab(),
            this.loadGameAnim(),
        ]);
    }

    /**并行加载游戏内动态创建的预制体，全部成功后写入公共字段 */
    private async loadGamePrefab() {
        let prefabs = await Promise.all([
            ccResTools.loadPrefab(this.resBundle, ItemPath.bullet, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameLine, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameSpriteItem, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameLabelItem, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameSpineItem, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameAnimItem, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.role, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.soldier, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.roleShow, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.supplyBox, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.eliminationBox, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.bossBox, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.drone, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.skillRange, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.syringe, false),
        ]);

        if (prefabs.some((prefab) => !prefab)) {
            throw new Error("游戏预制体加载失败");
        }

        this.bulletPrefab = prefabs[0];
        this.gameLinePrefab = prefabs[1];
        this.gameSpriteItemPrefab = prefabs[2];
        this.gameLabelItemPrefab = prefabs[3];
        this.gameSpineItemPrefab = prefabs[4];
        this.gameAnimItemPrefab = prefabs[5];
        this.rolePrefab = prefabs[6];
        this.soldierPrefab = prefabs[7];
        this.roleShowPrefab = prefabs[8];
        this.supplyBoxPrefab = prefabs[9];
        this.eliminationBoxPrefab = prefabs[10];
        this.bossBoxPrefab = prefabs[11];
        this.dronePrefab = prefabs[12];
        this.skillRangePrefab = prefabs[13];
        this.syringePrefab = prefabs[14];
    }

    /**加载游戏动画 */
    private async loadGameAnim() {
        let clips = await Promise.all([
            
        ]);

        if (clips.some((clip) => !clip)) {
            throw new Error("游戏动画加载失败");
        }
    }

    /**显示提示 */
    showTips(str?) {
        let noticeItem = instantiate(this.tipsPrefab);
        this.noticePage.addChild(noticeItem);

        let notice = noticeItem.getComponent(tipsNotice);
        notice.initData(str);
    }

    /**激活已预加载的游戏页面，切换背景音乐并将参数传给 onUI_Open */
    startGame(data?: any) {
        if (!this.resBundle) {
            return;
        }
        let keyName = this.getUIName(gamePath.UIGame);
        if (!this.uiMap.has(keyName)) {
            console.error("游戏页尚未预加载，无法开始游戏");
            return;
        }
        let gameNode = this.uiMap.get(keyName);
        gameNode.active = true;
        this.gamePage.addChild(gameNode);
        let uiComp = gameNode.getComponent(UIBase);
        uiMgr.closePage(UIPath.UIMain);
        audioMgr.closeBackgroundMusic();
        audioMgr.playBackgroundMusic(audioPath.gameBackground);
        uiComp.onUI_Open(data);
    }

    /**清理本局背包并关闭游戏，恢复主页和主页背景音乐 */
    closeGame() {
        this.clearBackpack();
        this.closePage(UIPath.UIBackpack);
        let keyName = this.getUIName(gamePath.UIGame);
        if (this.uiMap.has(keyName)) {
            let uiComp = this.uiMap.get(keyName).getComponent(UIBase);
            uiComp.onUI_Close();
            this.uiMap.get(keyName).active = false;
        }
        audioMgr.closeBackgroundMusic();
        audioMgr.playBackgroundMusic(audioPath.background);
        uiMgr.openPage(UIPath.UIMain);
    }

    /**清除玩家背包数据，并同步重置已创建的背包界面 */
    clearBackpack() {
        pData.clearBackpack();
        const backpackNode = this.uiMap.get(this.getUIName(UIPath.UIBackpack));
        if (backpackNode?.isValid) {
            backpackNode.getComponent(UIBackpack)?.resetBackpack();
        }
    }

    /**加载并实例化界面后缓存，保持隐藏；已缓存的界面直接复用 */
    async preLoadPage(pagePath: string) {
        if (!this.resBundle) {
            throw new Error("资源包尚未加载");
        }
        let keyName = this.getUIName(pagePath);
        if (this.uiMap.has(keyName)) {
            return;
        }
        let pagePre = await ccResTools.loadPrefab(this.resBundle, pagePath);
        if (!pagePre) {
            throw new Error(`加载页面失败: ${pagePath}`);
        }
        let pageNode = instantiate(pagePre);
        this.uiMap.set(keyName, pageNode);
        pageNode.active = false;
    }

    /**复用或加载界面实例，挂载到 UI 容器并调用 onUI_Open(data) */
    async openPage(pagePath: string, data?: any) {
        if (!this.resBundle) {
            return;
        }
        let keyName = this.getUIName(pagePath);
        let pageNode = null;
        if (this.uiMap.has(keyName)) {
            pageNode = this.uiMap.get(keyName);
            this.uiPage.addChild(pageNode);
        } else {
            let pagePre = await ccResTools.loadPrefab(this.resBundle, pagePath);
            pageNode = instantiate(pagePre);
            this.uiPage.addChild(pageNode);
            this.uiMap.set(keyName, pageNode);
        }
        pageNode.active = true;
        let uiComp: UIBase = pageNode.getComponent(UIBase);
        uiComp.onUI_Open(data);
    }

    /**将界面加入队列，关闭当前队列界面后依次打开 */
    openQueuePage(pagePath: string, data?: any) {
        if (!this.resBundle || !pagePath) {
            return;
        }

        this.queuePageArr.push({ pagePath: pagePath, data: data });
        this.openNextQueuePage();
    }

    /**队列中同时只打开一个界面；加载失败时继续处理下一项 */
    private async openNextQueuePage() {
        if (this.currentQueuePage || this.queuePageArr.length == 0) {
            return;
        }

        let queuePage = this.queuePageArr.shift();
        this.currentQueuePage = queuePage;
        try {
            await this.openPage(queuePage.pagePath, queuePage.data);
        } catch (error) {
            console.error(`打开排队界面失败: ${queuePage.pagePath}`, error);
            if (this.currentQueuePage == queuePage) {
                this.currentQueuePage = null;
                this.openNextQueuePage();
            }
        }
    }

    /**调用关闭回调并隐藏、移出界面；保留缓存，队列界面关闭后继续下一项 */
    closePage(pagePath: string) {
        let keyName = this.getUIName(pagePath);
        let isCurrentQueuePage = this.currentQueuePage
            && this.getUIName(this.currentQueuePage.pagePath) == keyName;
        let hasClosedPage = false;
        if (this.uiMap.has(keyName)) {
            let pageNode = this.uiMap.get(keyName);;
            hasClosedPage = pageNode.active;
            let uiComp = pageNode.getComponent(UIBase);
            uiComp.onUI_Close();
            pageNode.active = false;
            //将自己移出父节点但不删除节点
            pageNode.removeFromParent();
        }

        if (isCurrentQueuePage && hasClosedPage) {
            this.currentQueuePage = null;
            this.openNextQueuePage();
        }
    }

    /**页面是否正在显示 */
    isPageOpen(pagePath: string) {
        const pageNode = this.uiMap.get(this.getUIName(pagePath));
        return !!pageNode && pageNode.activeInHierarchy;
    }

    /**取资源路径的最后一段作为界面缓存键 */
    getUIName(str) {
        let strs = str.split('/');
        return strs[strs.length - 1];
    }

    /**货币动画目标位置(世界坐标) */
    moneyTargetPos: Vec3 = new Vec3();
    /**金币动画目标位置(世界坐标) */
    goldTargetPos: Vec3 = new Vec3();

    /**播放货币动画
     * @param rootNode 货币动画初始节点
     * @param num 货币数量
     * @param moneyType 货币类型，默认银币
     * @param call 动画完成回调
     */
    playMoneyAnim(rootNode: Node, num: number, moneyType: MonetaryType = MonetaryType.silver, call?) {
        if (num <= 0) {
            return;
        }
        if (!rootNode || !rootNode.isValid || !this.effectNode || !this.effectNode.isValid
            || !this.effectItemPrefab || !this.resBundle) {
            this.fixMonetary(moneyType, num);
            return;
        }

        let effectTransform = this.effectNode.getComponent(UITransform);
        if (!effectTransform) {
            this.fixMonetary(moneyType, num);
            return;
        }

        let startCenter = effectTransform.convertToNodeSpaceAR(rootNode.worldPosition);
        const targetWorldPos = moneyType === MonetaryType.gold ? this.goldTargetPos : this.moneyTargetPos;
        let targetPos = effectTransform.convertToNodeSpaceAR(targetWorldPos);
        if (!this.effectNode.isValid) {
            this.fixMonetary(moneyType, num);
            return;
        }

        audioMgr.playEffect(audioPath.getMoney);
        let itemCount = Math.min(Math.ceil(num / 10), 10);
        let completedCount = 0;

        for (let i = 0; i < itemCount; i++) {
            let effectItem = instantiate(this.effectItemPrefab);
            this.effectNode.addChild(effectItem);

            effectItem.setPosition(startCenter);
            effectItem.setScale(2, 2, 1);

            let sprite = effectItem.getComponent(Sprite);
            if (sprite) {
                const iconPath = moneyType === MonetaryType.gold ? imgPath.gold : imgPath.money;
                ccTools.loadImg(sprite, iconPath);
            }

            let moneyTween = tween(effectItem).delay(i * 0.02);
            if (itemCount > 1) {
                let randomAngle = Math.random() * Math.PI * 2;
                let randomRadius = Math.sqrt(Math.random()) * 200;
                let randomPos = new Vec3(
                    startCenter.x + Math.cos(randomAngle) * randomRadius,
                    startCenter.y + Math.sin(randomAngle) * randomRadius,
                    startCenter.z,
                );
                moneyTween.to(0.1, { position: randomPos }, { easing: 'quadOut' });
            }

            moneyTween
                .to(0.5, { position: targetPos, scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
                .call(() => {
                    effectItem.destroy();
                    completedCount++;
                    if (completedCount === itemCount) {
                        this.fixMonetary(moneyType, num);
                        call && call();
                    }
                })
                .start();
        }
    }

    /**增加指定类型的货币 */
    private fixMonetary(moneyType: MonetaryType, num: number) {
        if (moneyType === MonetaryType.gold) {
            pData.fixGold(num);
        } else {
            pData.fixMoney(num);
        }
    }

    /**存储节点 */
    storeNode = null;

    /**播放通用奖励获取动画
     * @param startNode 奖励动画起点及图标节点
     * @param targetNode 奖励动画目标节点
     * @param num 奖励数量
     * @param complete 动画完成回调
     */
    playRewardAnim(startNode: Node, targetNode: Node, num: number, complete?: () => void) {
        if (num <= 0) {
            complete && complete();
            return;
        }
        if (!startNode || !startNode.isValid) {
            console.warn("播放奖励动画失败：起点节点为空或已销毁，请检查节点是否存在于对应父节点下", startNode);
            complete && complete();
            return;
        }
        if (!targetNode || !targetNode.isValid) {
            console.warn("播放奖励动画失败：终点节点为空或已销毁", targetNode);
            complete && complete();
            return;
        }
        if (!this.effectNode || !this.effectNode.isValid || !this.effectItemPrefab) {
            console.warn("播放奖励动画失败：特效节点或特效预制体未就绪");
            complete && complete();
            return;
        }

        let effectTransform = this.effectNode.getComponent(UITransform);
        if (!effectTransform) {
            console.warn("播放奖励动画失败：特效节点缺少UITransform组件");
            complete && complete();
            return;
        }

        //起点和终点允许是未激活（active为false）的节点，此处仅取其世界坐标与图标，
        //未激活节点的世界矩阵可能未刷新，先主动刷新再取世界坐标。
        startNode.updateWorldTransform();
        targetNode.updateWorldTransform();
        let startCenter = effectTransform.convertToNodeSpaceAR(startNode.worldPosition);
        let targetPos = effectTransform.convertToNodeSpaceAR(targetNode.worldPosition);
        let iconSpriteFrame = startNode.getComponent(Sprite)?.spriteFrame;
        let itemCount = num <= 10 ? num : Math.min(Math.ceil(num / 10), 10);
        let completedCount = 0;

        for (let i = 0; i < itemCount; i++) {
            let effectItem = instantiate(this.effectItemPrefab);
            this.effectNode.addChild(effectItem);
            effectItem.setPosition(startCenter);
            effectItem.setScale(1, 1, 1);

            let sprite = effectItem.getComponent(Sprite);
            if (sprite && iconSpriteFrame) {
                sprite.spriteFrame = iconSpriteFrame;
            }

            let rewardTween = tween(effectItem).delay(i * 0.02);
            if (itemCount > 1) {
                let randomAngle = Math.random() * Math.PI * 2;
                let randomRadius = Math.sqrt(Math.random()) * 200;
                let randomPos = new Vec3(
                    startCenter.x + Math.cos(randomAngle) * randomRadius,
                    startCenter.y + Math.sin(randomAngle) * randomRadius,
                    startCenter.z,
                );
                rewardTween.to(0.1, { position: randomPos }, { easing: 'quadOut' });
            }

            rewardTween
                .to(0.5, { position: targetPos, scale: new Vec3(0.8, 0.8, 1) }, { easing: 'quadIn' })
                .call(() => {
                    effectItem.destroy();
                    completedCount++;
                    if (completedCount === itemCount) {
                        complete && complete();
                    }
                })
                .start();
        }
    }
}

/**等待按顺序打开的界面及其初始化参数 */
interface queuePageData {
    /**界面预制体资源路径 */
    pagePath: string;
    /**传递给界面 onUI_Open 的参数 */
    data?: any;
}

/**全局共用的界面管理器实例 */
export let uiMgr = new UIManager();
