import { _decorator, Node, Animation, Prefab, instantiate, Layout } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { gm } from '../manager/gm';
import { GameEvent} from '../manager/configData';
import { pData } from '../manager/playerData';
import { ccTools } from '../extention/generalTools';
import { rewardItem } from '../controller/rewardItem';
const { ccclass, property } = _decorator;

@ccclass('UIReward')
export class UIReward extends UIBase {
    @property(Node)
    rewardNode: Node;

    @property(Prefab)
    rewardItemPre: Prefab;

    /**奖励数据 0:奖励id 1:奖励数量 */
    rewardData: number[][] = [];

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

        this.applyRewards();
        this.showReward();
    }

    /**领取并持久化当前奖励 */
    private applyRewards() {
        const storehouseRewards: number[][] = [];
        for (const [itemId, num] of this.rewardData) {
            if (itemId === 200001) {
                pData.fixMoney(num);
            } else if (itemId === 200002) {
                pData.fixGold(num);
            } else {
                storehouseRewards.push([itemId, num]);
            }
        }
        pData.fixStorehouseDatas(storehouseRewards);
    }

    bindBtn() {
        this.node.getChildByName("mask").on(Node.EventType.TOUCH_END, this.clickCloseBtn.bind(this));
    }

    /**显示奖励（不刷新数据） */
    showReward() {
        const layout = this.rewardNode.getComponent(Layout);
        if (layout) {
            layout.enabled = true;
        }
        ccTools.destroyAllChild(this.rewardNode);
        for (let i = 0; i < this.rewardData.length; i++) {
            let item = this.rewardData[i];
            let itemNode = instantiate(this.rewardItemPre);
            this.rewardNode.addChild(itemNode);
            itemNode.getComponent(rewardItem).initData(item);
        }

        if (layout) {
            layout.updateLayout();
            if (this.rewardData.length === 1) {
                const itemNode = this.rewardNode.children[0];
                if (itemNode) {
                    itemNode.setPosition(0, itemNode.position.y, itemNode.position.z);
                }
                layout.enabled = false;
            }
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

    onClose() {
        this.refreshData();
        gm.Event.emit(GameEvent.closeRewardPage);
        uiMgr.closePage(UIPath.UIReward);
    }
}


