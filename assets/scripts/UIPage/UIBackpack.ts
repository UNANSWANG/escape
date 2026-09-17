import { _decorator, Node, Prefab, instantiate, Label, Sprite, EventTouch } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { getItemDataByItemId } from '../json/jsonItemData';
import { JsonItemData } from '../json/jsonItem';
import { pData } from '../manager/playerData';
const { ccclass, property } = _decorator;


@ccclass('UIBackpack')
export class UIBackpack extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    searchNode: Node;

    @property(Node)
    container: Node;

    @property(Label)
    valueLab: Label;

    @property(Node)
    backpackContainer: Node;

    @property(Label)
    capacityLab: Label;

    @property(Sprite)
    capacitySp: Sprite;

    @property(Prefab)
    itemPrefab: Prefab;

    /** 当前打开容器传入的物品 itemId */
    itemData: number[] = [];

    protected onLoad(): void {
        this.bindBtn();
        this.bindItemSlots();
    }

    onUI_Open(data?: { showSearchNode?: boolean; itemData?: number[] }) {
        if (this.searchNode) {
            this.searchNode.active = !!data?.showSearchNode;
        }
        this.itemData = data?.itemData ?? [];
        this.initData();
        this.hideAllSelect();
    }

    /** 初始化背包与当前打开容器的显示。 */
    initData() {
        this.initContainer();
        this.refreshBackpack();
    }

    /** 根据容器传入的物品 id 刷新容器的九个物品格子。 */
    private initContainer() {
        const content = this.container?.getChildByName("content");
        if (!content || !this.itemPrefab) {
            console.warn("背包容器节点或物品预制体未配置");
            return;
        }

        const slots = content.children;
        for (let index = 0; index < slots.length; index++) {
            const slot = slots[index];
            const itemContainer = slot.getChildByName("content");
            if (!itemContainer) {
                console.warn(`容器第 ${index + 1} 个格子缺少 content 节点`);
                continue;
            }
            ccTools.destroyAllChild(itemContainer);

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
            itemNode.parent = itemContainer;
            this.setItemLabel(itemNode, "nameLab", itemData.name ?? "");
            this.setItemLabel(itemNode, "capacityLab", `${itemData.capacity ?? 0}`);
            this.setItemLabel(itemNode, "valueLab", ccTools.formatMonetaryNum(itemData.value ?? 0));
        }
    }

    /** 根据背包物品重新计算并显示总价值与当前容量。 */
    refreshBackpack() {
        let backpackValue = 0;
        let backpackCapacity = 0;

        for (const itemId of pData.backpackItems) {
            const itemData = getItemDataByItemId(itemId);
            if (!itemData) {
                console.warn(`未找到背包物品配置，itemId: ${itemId}`);
                continue;
            }

            backpackCapacity += Number(itemData.capacity) || 0;
            if ("value" in itemData) {
                backpackValue += Number(itemData.value) || 0;
            }
        }

        pData.backpackValue = backpackValue;
        pData.backpackCapacity = backpackCapacity;

        this.valueLab.string = ccTools.formatMonetaryNum(pData.backpackValue);
        this.capacityLab.string = `${pData.backpackCapacity}/${pData.maxBackpackCapacity}`;

        const maxCapacity = pData.maxBackpackCapacity;
        this.capacitySp.fillRange = maxCapacity > 0
            ? Math.min(1, Math.max(0, pData.backpackCapacity / maxCapacity))
            : 0;
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

    /** 绑定容器和背包格子的选中事件。 */
    private bindItemSlots() {
        for (const slot of this.getItemSlots()) {
            slot.on(Node.EventType.TOUCH_END, this.clickItemSlot, this);
        }
    }

    /** 获取容器及背包中的全部物品格子。 */
    private getItemSlots(): Node[] {
        const containerContent = this.container.getChildByName("content");
        return [...containerContent.children, ...this.backpackContainer.children];
    }

    /** 点击物品格子：有物品时显示该格子的选中框，空格子时取消所有选中。 */
    private clickItemSlot(event: EventTouch) {
        event.propagationStopped = true;

        const slot = event.currentTarget as Node;
        const hasItem = slot.getChildByName("content").children.length > 0;
        this.refreshSelect(hasItem ? slot : null);
    }

    /** 刷新格子选中状态。 */
    private refreshSelect(selectedSlot: Node) {
        for (const slot of this.getItemSlots()) {
            slot.getChildByName("select").active = slot === selectedSlot;
        }
    }

    /** 隐藏所有容器和背包格子的选中框。 */
    private hideAllSelect() {
        this.refreshSelect(null);
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
