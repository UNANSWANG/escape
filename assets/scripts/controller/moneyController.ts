import { _decorator, Component, Enum, Label, Node } from 'cc';
import { pData } from '../manager/playerData';
import { gm } from '../manager/gm';
import { GameEvent, MonetaryType } from '../manager/configData';
import { uiMgr } from '../manager/UIManager';
const { ccclass, property } = _decorator;

@ccclass('moneyController')
export class moneyController extends Component {
    @property({
        type: Enum(MonetaryType),
        tooltip: '选择货币类型'
    })
    moneyType: MonetaryType = MonetaryType.silver;

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

    /**刷新当前货币动画的目标世界坐标 */
    private refreshMoneyTargetPos() {
        if (this.moneyType === MonetaryType.gold) {
            uiMgr.goldTargetPos.set(this.moneyImg.worldPosition);
        } else {
            uiMgr.moneyTargetPos.set(this.moneyImg.worldPosition);
        }
    }

    /**刷新货币数值 */
    private refreshMoney() {
        const monetary = this.moneyType === MonetaryType.gold ? pData.gold : pData.money;
        this.numLabel.string = monetary.toString();
    }
}
