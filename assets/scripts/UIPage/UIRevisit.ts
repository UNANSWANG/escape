import { _decorator, Component, Node, Animation, Prefab, instantiate, RenderRoot2D } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { gm, PlatType } from '../manager/gm';
import { GameEvent, SaveKey } from '../manager/configData';
import { pData } from '../manager/playerData';
import { ccTools } from '../extention/generalTools';
import { rewardItem, rewardItemData } from '../controller/rewardItem';
import { ccStorageTools } from '../extention/storageTools';
import { TTManager } from '../sdk/plat/tt/TTManager';
const { ccclass, property } = _decorator;

@ccclass('UIRevisit')
export class UIRevisit extends UIBase {
    get TTMgr() {
        return gm.API as TTManager;
    }

    @property(Node)
    closeBtn: Node;

    @property(Node)
    goBtn: Node;

    @property(Node)
    gettedBtn: Node;

    isGetted = false;

    protected onLoad(): void {
        this.bindBtn();
    }

    protected onEnable(): void {
        this.addListener();
    }

    protected onDisable(): void {
        this.removeListener();
    }

    addListener() {
        gm.Event.on(GameEvent.revisitSidebar, this.clickGoBtn, this);
    }

    removeListener() {
        gm.Event.off(GameEvent.revisitSidebar, this.clickGoBtn, this);
    }

    onUI_Open() {
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData();
    }

    initData() {
        this.isGetted = ccStorageTools.getLimitTimeData(SaveKey.isGetRevisit) == 1;

        this.goBtn.active = !this.isGetted;
        this.gettedBtn.active = this.isGetted;
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.goBtn.addComponent(zoomButton).onClick = this.clickGoBtn.bind(this);
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    /**点击前往侧边栏 */
    clickGoBtn() {
        if (gm.platType != PlatType.tt) {
            uiMgr.showTips("非抖音平台，无法复访");
            return;
        }
        let canGet = this.TTMgr.checkCanGetGift();
        if (canGet && !this.isGetted) {
            ccStorageTools.setLimitTimeData(SaveKey.isGetRevisit, 1);
            uiMgr.showTips("获取代币+200");
            pData.fixMoney(200);
            this.onClose();
        } else {
            if (this.isGetted) {
                uiMgr.showTips("今日奖励已领取");
            } else {
                this.TTMgr.navigateToScene();
            }
        }
    }

    onClose() {
        uiMgr.closePage(UIPath.UIRevisit);
    }
}


