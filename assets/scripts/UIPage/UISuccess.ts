import { _decorator, instantiate, Label, Layout, Node, Prefab } from 'cc';
import { UIBase } from './UIBase';
import { audioPath, ItemPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { pData } from '../manager/playerData';
import { gm } from '../manager/gm';
import { audioMgr } from '../manager/audioManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { ccResTools } from '../extention/resTools';
import { showItemController } from '../controller/showItemController';
import { itemConfig } from '../json/jsonItem';
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

    @property(Node)
    itemContent: Node;

    private showItemPrefab: Prefab = null;
    private itemListVersion = 0;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(data?) {
        gm.gamePause();
        audioMgr.playEffect(audioPath.success);
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
        this.getNumLab.string = ccTools.formatMonetaryNum(collectionValue);
        this.refreshItems(items);

        pData.SDKReportLevelComplete();
        pData.addLevel();
    }

    private async refreshItems(items: [number, number][]) {
        const version = ++this.itemListVersion;
        ccTools.destroyAllChild(this.itemContent);
        if (items.length === 0) return;
        if (!this.showItemPrefab) {
            this.showItemPrefab = await ccResTools.loadPrefab(uiMgr.resBundle, ItemPath.showItem, false);
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

    onUI_Close() {
        ++this.itemListVersion;
    }

    bindBtn() {
        this.mainBtn.addComponent(zoomButton).onClick = this.clickMainBtn.bind(this);
    }

    ///
    ///点击事件
    ///

    /**点击返回主界面按钮 */
    clickMainBtn() {
        this.onClose();
        uiMgr.closeGame();
    }

    onClose() {
        gm.gameResume();
        uiMgr.closePage(UIPath.UISuccess);
    }
}
