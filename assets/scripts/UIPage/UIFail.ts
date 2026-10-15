import { _decorator, instantiate, Label, Layout, Node, Prefab } from 'cc';
import { audioPath, ItemPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { UIBase } from './UIBase';
import { gm } from '../manager/gm';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { pData } from '../manager/playerData';
import { audioMgr } from '../manager/audioManager';
import { ccResTools } from '../extention/resTools';
import { showItemController } from '../controller/showItemController';
const { ccclass, property } = _decorator;

export enum FailType {
    /**时间到 */
    TimeOut = 0,
    /**生命值为0 */
    LifeZero = 1,
}
@ccclass('UIFail')
export class UIFail extends UIBase {
    @property(Node)
    mainBtn: Node;

    @property(Node)
    retrieveBtn: Node;

    @property(Label)
    timeLab: Label;

    @property(Label)
    dropNumLab: Label;

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

    onUI_Open(data?: any) {
        gm.gamePause();
        audioMgr.playEffect(audioPath.fail);
        this.initData(data);
    }

    initData(data?) {
        uiMgr.clearBackpack();
        const survivalTime = Math.floor(Math.max(0, Number(data?.survivalTime) || 0));
        const minutes = String(Math.floor(survivalTime / 60)).padStart(2, '0');
        const seconds = String(survivalTime % 60).padStart(2, '0');
        this.timeLab.string = `存活时间: ${minutes}:${seconds}`;
        this.dropNumLab.string = ccTools.formatMonetaryNum(pData.getLostItemsValue());
        this.refreshLostItems();

        pData.SDKReportLevelFail();
        pData.reportLevel(false);
    }

    /**动态加载 showItem，并防止页面关闭后异步创建过期列表。 */
    private async refreshLostItems() {
        const version = ++this.itemListVersion;
        ccTools.destroyAllChild(this.itemContent);
        const items = pData.lostItems.map(([itemId, num]) => [itemId, num]);
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
        uiMgr.closePage(UIPath.UIFail);
        gm.gameResume();
    }
}
