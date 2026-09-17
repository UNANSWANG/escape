import { _decorator, Node, Prefab, instantiate, Label } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { getItemDataByItemId } from '../json/jsonItemData';
import { JsonItemData } from '../json/jsonItem';
const { ccclass, property } = _decorator;


@ccclass('UIBackpack')
export class UIBackpack extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    searchNode: Node;

    @property(Node)
    container: Node;

    @property(Prefab)
    itemPrefab: Prefab;

    /** 当前打开容器传入的物品 itemId */
    itemData: number[] = [];

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(data?: { showSearchNode?: boolean; itemData?: number[] }) {
        if (this.searchNode) {
            this.searchNode.active = !!data?.showSearchNode;
        }
        this.itemData = data?.itemData ?? [];
        this.initData();
    }

    /** 根据容器传入的物品 id 刷新九个物品格子。 */
    initData() {
        const content = this.container?.getChildByName("content");
        if (!content || !this.itemPrefab) {
            console.warn("背包容器节点或物品预制体未配置");
            return;
        }

        const slots = content.children;
        for (let index = 0; index < slots.length; index++) {
            const slot = slots[index];
            ccTools.destroyAllChild(slot);

            const itemId = this.itemData[index];
            if (!Number.isFinite(itemId)) {
                continue;
            }

            const itemData = getItemDataByItemId(itemId) as JsonItemData;
            if (!itemData) {
                console.warn(`未找到物品配置，itemId: ${itemId}`);
                continue;
            }

            const itemNode = instantiate(this.itemPrefab);
            itemNode.parent = slot;
            this.setItemLabel(itemNode, "nameLab", itemData.name ?? "");
            this.setItemLabel(itemNode, "capacityLab", `${itemData.capacity ?? 0}`);
            this.setItemLabel(itemNode, "valueLab", ccTools.formatMonetaryNum(itemData.value ?? 0));
        }
    }

    /** 设置物品预制体内指定文本节点。 */
    private setItemLabel(itemNode: Node, nodeName: string, content: string) {
        const label = itemNode.getChildByName(nodeName)?.getComponent(Label);
        if (!label) {
            console.warn(`物品预制体缺少 ${nodeName} 标签`);
            return;
        }
        label.string = content;
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.node.on(Node.EventType.TOUCH_END, this.clickCloseBtn.bind(this));
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIBackpack);
    }
}


