import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { ccResTools } from '../extention/resTools';
import { uiMgr } from '../manager/UIManager';
import { imgPath } from '../manager/pathConfig';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

export interface rewardItemData {
    type: number;
    num: number;
}

@ccclass('rewardItem')
export class rewardItem extends Component {
    numLab: Label = null;
    imgSp: Sprite = null;
    lightNode: Node = null;

    protected onLoad(): void {
        this.numLab = this.node.getChildByName("numLab").getComponent(Label);
        this.imgSp = this.node.getChildByName("img").getComponent(Sprite);
        this.lightNode = this.node.getChildByName("light");
    }

    initData(data : rewardItemData) {
        if (!data) {
            return;
        }

        let type = data.type;
        let num = data.num;

        this.numLab.string = `x${num}`;
        ccTools.loadImg(this.imgSp, imgPath.props + type);
        this.setLight(false);
    }

    /**设置发光状态 */
    setLight(isLight: boolean) {
        if(!this.lightNode){
            return;
        }
        this.lightNode.active = isLight;
    }
}
