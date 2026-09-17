import { _decorator, Component, Label } from 'cc';
import { ccTools } from '../extention/generalTools';
import { getItemDataByItemId } from '../json/jsonItemData';
import { JsonItemData } from '../json/jsonItem';
const { ccclass } = _decorator;

@ccclass('itemController')
export class itemController extends Component {
    /** 当前物品的 itemId。 */
    itemId = 0;

    /** 初始化物品显示。 */
    initData(itemId: number) {
        this.itemId = itemId;
        const itemData = getItemDataByItemId(itemId) as JsonItemData;
        if (!itemData) {
            console.warn(`未找到物品配置，itemId: ${itemId}`);
            return;
        }

        this.setLabel("nameLab", itemData.name ?? "");
        this.setLabel("capacityLab", `${itemData.capacity ?? 0}`);
        this.setLabel("valueLab", ccTools.formatMonetaryNum(itemData.value ?? 0));
    }

    /** 设置物品预制体内的标签。 */
    private setLabel(nodeName: string, content: string) {
        const label = this.node.getChildByName(nodeName).getComponent(Label);
        label.string = content;
    }
}


