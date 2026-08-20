import { _decorator, Component, Node, Animation, Prefab, instantiate } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { gm } from '../manager/gm';
import { GameEvent} from '../manager/configData';
import { pData } from '../manager/playerData';
import { ccTools } from '../extention/generalTools';
import { rewardItem, rewardItemData } from '../controller/rewardItem';
const { ccclass, property } = _decorator;

@ccclass('UIReward')
export class UIReward extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    rewardNode: Node;

    @property(Node)
    getBtn: Node;

    @property(Prefab)
    rewardItemPre: Prefab;

    /**奖励数据 type:奖励类型 num:奖励数量 */
    rewardData: rewardItemData[] = [];

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(data?) {
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData(data);
    }

    initData(data?) {
        if (data) {
            this.rewardData = data.rewardData;
        }

        this.showReward();
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.getBtn.addComponent(zoomButton).onClick = this.clickGetBtn.bind(this);
    }

    /**显示奖励（不刷新数据） */
    showReward() {
        ccTools.destroyAllChild(this.rewardNode);
        for (let i = 0; i < this.rewardData.length; i++) {
            let item: rewardItemData = this.rewardData[i];
            pData.fixPropsNum(item.type, item.num, false);
            let itemNode = instantiate(this.rewardItemPre);
            this.rewardNode.addChild(itemNode);
            itemNode.getComponent(rewardItem).initData(item);
        }
    }

    /**刷新数据 */
    refreshData() {
        gm.Event.emit(GameEvent.refreshProps);
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    /**点击获取 */
    clickGetBtn() {
        this.onClose();
    }

    onClose() {
        this.refreshData();
        gm.Event.emit(GameEvent.closeRewardPage);
        uiMgr.closePage(UIPath.UIReward);
    }
}


