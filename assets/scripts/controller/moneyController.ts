import { _decorator, Component, Label, Node } from 'cc';
import { pData } from '../manager/playerData';
import { gm } from '../manager/gm';
import { GameEvent } from '../manager/configData';
import { uiMgr } from '../manager/UIManager';
const { ccclass, property } = _decorator;

@ccclass('moneyController')
export class moneyController extends Component {
    numLabel: Label = null;
    moneyImg: Node = null;

    protected onLoad(): void {
        this.numLabel = this.node.getChildByName("numLab").getComponent(Label);
        this.moneyImg = this.node.getChildByName("img");
        this.refreshMoney();
    }

    protected onEnable(): void {
        gm.Event.on(GameEvent.refreshPlayerMonetary, this.refreshMoney, this);
        //延后一帧等待widget刷新后再刷坐标
        this.scheduleOnce(() => {
            this.refreshMoneyTargetPos();
        }, 0);
    }

    protected onDisable(): void {
        gm.Event.off(GameEvent.refreshPlayerMonetary, this.refreshMoney, this);
    }

    /**刷新感染币的世界坐标 */
    private refreshMoneyTargetPos() {
        uiMgr.moneyTargetPos.set(this.moneyImg.worldPosition);
    }

    /**刷新感染币 */
    private refreshMoney() {
        this.numLabel.string = pData.money.toString();
    }
}