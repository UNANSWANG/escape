import { _decorator, Component, Label, Node, Sprite, UITransform } from 'cc';
import { ccTools } from '../extention/generalTools';
import { getItemDataByItemId } from '../json/jsonItemData';
import { imgPath } from '../manager/pathConfig';
const { ccclass, property } = _decorator;

@ccclass('showItemController')
export class showItemController extends Component {
    initData(itemId: number, num: number = 1) {
        const numLab = this.node.getChildByName('numLab')?.getComponent(Label);
        if (numLab) {
            numLab.string = `x${num}`;
        }
        const itemData = getItemDataByItemId(itemId);
        const nameLab = this.node.getChildByName('nameLab')?.getComponent(Label);
        if (nameLab) {
            nameLab.string = itemData?.name ?? '';
        }
        const bgSp = this.node.getChildByName('bg')?.getComponent(Sprite);
        let itemImg = this.node.getChildByName('itemImg');
        if (!itemImg) {
            itemImg = new Node('itemImg');
            itemImg.layer = this.node.layer;
            itemImg.addComponent(UITransform).setContentSize(80, 80);
            itemImg.addComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;
            this.node.addChild(itemImg);
            itemImg.setSiblingIndex(1);
        }
        const itemSp = itemImg.getComponent(Sprite);
        itemSp.spriteFrame = null;
        if (!itemData) {
            console.warn(`未找到物品配置，itemId: ${itemId}`);
            return;
        }
        ccTools.loadImg(bgSp, imgPath.itemBg + itemData.quality);
        //TODO 物品图片不齐，暂时先屏蔽
        // ccTools.loadImg(itemSp, imgPath.item + itemId);
    }
}


