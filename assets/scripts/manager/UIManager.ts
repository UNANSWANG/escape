import { _decorator, AnimationClip, AssetManager, Component, instantiate, Node, Prefab, Sprite, tween, UITransform, Vec3 } from 'cc';
import { UIBase } from '../UIPage/UIBase';
import { animPath, audioPath, gamePath, imgPath, ItemPath, UIPath } from './pathConfig';
import { ccResTools } from '../extention/resTools';
import { tipsNotice } from '../UIPage/tips/tipsNotice';
import { pData } from './playerData';
import { ccTools } from '../extention/generalTools';
import { audioMgr } from './audioManager';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager {
    resBundle: AssetManager.Bundle = null;
    tipsPrefab: Prefab = null;
    bulletPrefab: Prefab = null;
    effectItemPrefab: Prefab = null;
    gameSpriteItemPrefab: Prefab = null;
    gameSpineItemPrefab: Prefab = null;
    gameAnimItemPrefab: Prefab = null;

    private gamePage: Node = null;
    private uiPage: Node = null;
    private noticePage: Node = null;
    private effectNode: Node = null;

    private uiMap: Map<string, Node> = new Map();
    /**等待依次打开的界面队列 */
    private queuePageArr: queuePageData[] = [];
    /**当前通过队列打开的界面 */
    private currentQueuePage: queuePageData = null;
    /**游戏资源预加载任务，防止匹配页重复打开时并发加载 */
    private gamePreloadPromise: Promise<void> = null;
    /**游戏资源是否已全部预加载 */
    private gamePreloadComplete = false;

    initData(node) {
        this.initPage(node);
    }

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

    /**预加载游戏页及游戏内使用的页面、预制体和动画 */
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

    /**加载游戏内动态创建的预制体 */
    private async loadGamePrefab() {
        let prefabs = await Promise.all([
            ccResTools.loadPrefab(this.resBundle, ItemPath.bullet, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameSpriteItem, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameSpineItem, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameAnimItem, false),
        ]);

        if (prefabs.some((prefab) => !prefab)) {
            throw new Error("游戏预制体加载失败");
        }

        this.bulletPrefab = prefabs[0];
        this.gameSpriteItemPrefab = prefabs[1];
        this.gameSpineItemPrefab = prefabs[2];
        this.gameAnimItemPrefab = prefabs[3];
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

    /**开始游戏 */
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

    /**关闭游戏 */
    closeGame() {
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

    /**预加载界面 */
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

    /**打开界面 */
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

    /**打开下一个排队界面 */
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

    /**关闭界面 */
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

    /**获取界面名称 */
    getUIName(str) {
        let strs = str.split('/');
        return strs[strs.length - 1];
    }

    /**货币动画目标位置(世界坐标) */
    moneyTargetPos: Vec3 = new Vec3();

    /**播放货币动画
     * @param rootNode 货币动画初始节点
     * @param num 货币数量
     */
    playMoneyAnim(rootNode: Node, num: number, call?) {
        if (num <= 0) {
            return;
        }
        if (!rootNode || !rootNode.isValid || !this.effectNode || !this.effectNode.isValid
            || !this.effectItemPrefab || !this.resBundle) {
            pData.fixMoney(num);
            return;
        }

        let effectTransform = this.effectNode.getComponent(UITransform);
        if (!effectTransform) {
            pData.fixMoney(num);
            return;
        }

        let startCenter = effectTransform.convertToNodeSpaceAR(rootNode.worldPosition);
        let targetPos = effectTransform.convertToNodeSpaceAR(this.moneyTargetPos);
        if (!this.effectNode.isValid) {
            pData.fixMoney(num);
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
                ccTools.loadImg(sprite, imgPath.money);
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
                        pData.fixMoney(num);
                        call && call();
                    }
                })
                .start();
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
        let itemCount = Math.min(Math.ceil(num / 10), 10);
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

interface queuePageData {
    pagePath: string;
    data?: any;
}

export let uiMgr = new UIManager();
