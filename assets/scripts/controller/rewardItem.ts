import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { imgPath } from '../manager/pathConfig';
import { ccTools } from '../extention/generalTools';
import { getItemDataByItemId } from '../json/jsonItemData';
const { ccclass, property } = _decorator;

export interface rewardItemData {
    type: number;
    num: number;
}

@ccclass('rewardItem')
export class rewardItem extends Component {
    numLab: Label = null;
    nameLab: Label = null;
    imgSp: Sprite = null;
    lightNode: Node = null;

    protected onLoad(): void {
        this.numLab = this.node.getChildByName("numLab").getComponent(Label);
        this.nameLab = this.node.getChildByName("nameLab").getComponent(Label);
        this.imgSp = this.node.getChildByName("img").getComponent(Sprite);
        this.lightNode = this.node.getChildByName("light");
    }

    initData(data : number[]) {
        if (!data) {
            return;
        }

        let itemId = data[0];
        let num = data[1];
        let itemData = getItemDataByItemId(itemId);

        this.numLab.string = `x${num}`;
        this.nameLab.string = itemData?.name ?? "";
        // ccTools.loadImg(this.imgSp, imgPath.props + itemId);
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
