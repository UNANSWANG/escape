import { _decorator, Component, Label, Sprite } from 'cc';
import { ccTools } from '../extention/generalTools';
import { getItemDataByItemId } from '../json/jsonItemData';
import { imgPath } from '../manager/pathConfig';
const { ccclass, property } = _decorator;

@ccclass('showItemController')
export class showItemController extends Component {
    initData(itemId: number, num?: number) {
        const numLab = this.node.getChildByName('numLab')?.getComponent(Label);
        if (numLab) {
            numLab.node.active = num !== undefined;
            numLab.string = `x${Math.max(0, Number(num) || 0)}`;
        }
        const itemData = getItemDataByItemId(itemId);
        const nameLab = this.node.getChildByName('nameLab')?.getComponent(Label);
        if (nameLab) {
            nameLab.string = itemData?.name ?? '';
        }
        const bgSp = this.node.getChildByName('bg')?.getComponent(Sprite);
        const itemSp = this.node.getChildByName('img')?.getComponent(Sprite);
        if (itemSp) {
            ccTools.cancelAssetLoad(itemSp);
            itemSp.spriteFrame = null;
            itemSp.node.active = true;
        }
        if (!itemData) {
            console.warn(`未找到物品配置，itemId: ${itemId}`);
            return;
        }
        ccTools.loadImg(bgSp, imgPath.itemBg + itemData.quality);
        //TODO 物品图片不齐，暂时先屏蔽
        // ccTools.loadImg(itemSp, imgPath.item + itemId);
    }
}


