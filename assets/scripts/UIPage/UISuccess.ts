import { _decorator, instantiate, Label, Layout, Node, Prefab, Animation, Sprite } from 'cc';
import { UIBase } from './UIBase';
import { audioPath, imgPath, ItemPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { pData } from '../manager/playerData';
import { configData, GameEvent, SaveKey } from '../manager/configData';
import { ccStorageTools } from '../extention/storageTools';
import { gm } from '../manager/gm';
import { audioMgr } from '../manager/audioManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { showItemController } from '../controller/showItemController';
import { RankScoreAnimation } from '../extention/rankScoreAnimation';
import { MonetaryValueAnimation } from '../extention/monetaryValueAnimation';
import { itemConfig } from '../json/jsonItem';
import { rankConfig } from '../json/jsonRank';
const { ccclass, property } = _decorator;

@ccclass('UISuccess')
export class UISuccess extends UIBase {
    @property(Node)
    mainBtn: Node;

    @property(Label)
    timeLab: Label;

    @property(Label)
    getNumLab: Label;

    @property(Label)
    curRankNumLab: Label;

    @property(Label)
    addRankNumLab: Label;

    @property(Sprite)
    rankBadge: Sprite;

    @property(Node)
    itemContent: Node;

    private showItemPrefab: Prefab = null;
    private itemListVersion = 0;
    private rankScoreAnimation = new RankScoreAnimation();
    private valueAnimation = new MonetaryValueAnimation();
    private isGuideLevel = false;
    private returningToMain = false;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(data?) {
        this.isGuideLevel = data?.isGuideLevel === true;
        this.returningToMain = false;
        let anim = this.getComponent(Animation);
        anim.play();
        gm.gamePause();
        audioMgr.playEffect(audioPath.success);
        gm.Event.on(GameEvent.refreshRank, this.refreshRankBadge, this);
        const scoreChange = this.rankScoreAnimation.play(this.curRankNumLab, Number(data?.rankScoreChange) || 0);
        if (this.addRankNumLab) this.addRankNumLab.string = '+' + scoreChange;
        this.refreshRankBadge();
        this.initData(data);
    }

    initData(data?) {
        const survivalTime = Math.floor(Math.max(0, Number(data?.survivalTime) || 0));
        const minutes = String(Math.floor(survivalTime / 60)).padStart(2, '0');
        const seconds = String(survivalTime % 60).padStart(2, '0');
        this.timeLab.string = `存活时间: ${minutes}:${seconds}`;
        const items: [number, number][] = Array.isArray(data?.backpackItems)
            ? data.backpackItems.map(([itemId, num]): [number, number] => [itemId, num]) : [];
        const collectionValue = items.reduce((total, [itemId, num]) => {
            const itemData = itemConfig.getDataByItemId(itemId);
            return total + Math.max(0, Number(itemData?.value) || 0) * Math.max(0, Math.floor(num));
        }, 0);
        this.valueAnimation.play(this.getNumLab, collectionValue);
        this.refreshItems(items);

        pData.SDKReportLevelComplete();
        pData.reportLevelComplete();
    }

    private async refreshItems(items: [number, number][]) {
        const version = ++this.itemListVersion;
        ccTools.destroyAllChild(this.itemContent);
        if (items.length === 0) return;
        if (!this.showItemPrefab) {
            this.showItemPrefab = await uiMgr.preLoadPrefab(ItemPath.showItem);
        }
        if (version !== this.itemListVersion || !this.node.isValid || !this.node.activeInHierarchy) return;
        if (!this.showItemPrefab) {
            console.warn(`加载显示物品预制体失败: ${ItemPath.showItem}`);
            return;
        }
        for (const [itemId, num] of items) {
            const itemNode = instantiate(this.showItemPrefab);
            this.itemContent.addChild(itemNode);
            itemNode.getComponent(showItemController).initData(itemId, num);
            const dropNode = itemNode.getChildByName('drop');
            if (dropNode) dropNode.active = false;
        }
        this.itemContent.getComponent(Layout)?.updateLayout();
    }

    /** 超出配置范围的段位沿用最后一枚徽章，晋升后同步刷新。 */
    private refreshRankBadge() {
        const rankData = rankConfig.getRankData(pData.rank);
        if (this.rankBadge && rankData) {
            ccTools.loadImg(this.rankBadge, imgPath.rankBadge + rankData.rankId);
        }
    }

    onUI_Close() {
        gm.Event.off(GameEvent.refreshRank, this.refreshRankBadge, this);
        ++this.itemListVersion;
        this.rankScoreAnimation.finish();
        this.valueAnimation.stop();
    }

    protected onDisable(): void {
        this.rankScoreAnimation.finish();
        this.valueAnimation.stop();
    }

    bindBtn() {
        this.mainBtn.addComponent(zoomButton).onClick = this.clickMainBtn.bind(this);
    }

    ///
    ///点击事件
    ///

    /**点击返回主界面按钮 */
    async clickMainBtn() {
        if (this.returningToMain) return;
        this.returningToMain = true;
        const guideLevel = this.isGuideLevel;
        if (guideLevel) {
            pData.selectMapData = [0, 0];
            pData.hasConfirmedMapSelection = true;
            ccStorageTools.setData(SaveKey.selectMapData, pData.selectMapData.slice());
        }
        this.onClose();
        try {
            await uiMgr.closeGame();
            if (guideLevel) await uiMgr.startPostGameGuide();
        } catch (error) {
            console.error('返回大厅引导失败', error);
        }
    }

    onClose() {
        gm.gameResume();
        uiMgr.closePage(UIPath.UISuccess);
    }
}
