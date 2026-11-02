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
    imgSp: Sprite = null;
    bgSp: Sprite = null;

    protected onLoad(): void {
        this.numLab = this.node.getChildByName("numLab").getComponent(Label);
        this.imgSp = this.node.getChildByName("img").getComponent(Sprite);
        this.bgSp = this.node.getChildByName("bg").getComponent(Sprite);
    }

    initData(data : number[]) {
        if (!data) {
            return;
        }

        let itemId = data[0];
        let num = data[1];
        let itemData = getItemDataByItemId(itemId);

        this.numLab.string = `x${num}`;
        // 背景统一使用物品表中的品质，货币也不例外。
        ccTools.cancelAssetLoad(this.bgSp);
        this.bgSp.spriteFrame = null;
        if (itemData && Number.isInteger(itemData.quality)) {
            ccTools.loadImg(this.bgSp, imgPath.itemBg + itemData.quality);
        } else {
            console.warn(`奖励物品缺少有效的品质配置，itemId: ${itemId}`);
        }
        if (this.imgSp) {
            const isWeapon = Number.isInteger(itemId) && itemId >= 0 && itemId <= 100000;
            this.imgSp.node.angle = isWeapon ? -35 : 0;
            ccTools.cancelAssetLoad(this.imgSp);
            this.imgSp.spriteFrame = null;
            const isCurrency = itemId === 200001 || itemId === 200002;
            const scale = isCurrency ? 1 : 0.7;
            this.imgSp.node.setScale(scale, scale, scale);
            const iconPath = itemId === 200001 ? imgPath.money
                : itemId === 200002 ? imgPath.gold : ccTools.getItemIconPath(itemId);
            ccTools.loadImg(this.imgSp, iconPath);
        }
    }
}
