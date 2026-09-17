import { _decorator, Node, Prefab, instantiate, Label, Sprite, EventTouch } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { getItemDataByItemId } from '../json/jsonItemData';
import { JsonItemData } from '../json/jsonItem';
import { pData } from '../manager/playerData';
import { itemController } from '../controller/itemController';
const { ccclass, property } = _decorator;


@ccclass('UIBackpack')
export class UIBackpack extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    discardBtn: Node;

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
    /** 当前选中的容器格子。 */
    private selectedContainerSlot: Node = null;
    /** 当前选中的背包格子。 */
    private selectedBackpackSlot: Node = null;

    protected onLoad(): void {
        this.bindBtn();
        this.bindContainerSlots();
        this.bindBackpackSlots();
        this.discardBtn.active = false;
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
        this.initBackpack();
        this.refreshBackpack();
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.node.on(Node.EventType.TOUCH_END, this.clickCloseBtn.bind(this));
        this.discardBtn.addComponent(zoomButton).onClick = this.clickDiscardBtn.bind(this);
        // 防止点击丢弃按钮时，事件冒泡触发页面背景的关闭逻辑。
        this.discardBtn.on(Node.EventType.TOUCH_END, this.stopEventPropagation, this);
    }

    /** 根据容器传入的物品 id 刷新容器的九个物品格子。 */
    private initContainer() {
        if (!this.itemPrefab) {
            console.warn("背包容器节点或物品预制体未配置");
            return;
        }

        const slots = this.getContainerSlots();
        for (let index = 0; index < slots.length; index++) {
            const slot = slots[index];
            const itemContainer = slot.getChildByName("content");
            ccTools.destroyAllChild(itemContainer);

            const itemId = this.itemData[index];
            if (!Number.isFinite(itemId) || itemId === -1) {
                continue;
            }

            const itemNode = instantiate(this.itemPrefab);
            itemNode.parent = itemContainer;
            itemNode.getComponent(itemController).initData(itemId);
        }
    }

    /** 根据背包物品 id 刷新背包格子。 */
    private initBackpack() {
        const slots = this.getBackpackSlots();
        for (let index = 0; index < slots.length; index++) {
            const itemContainer = slots[index].getChildByName("content");
            ccTools.destroyAllChild(itemContainer);

            const itemId = pData.backpackItems[index];
            if (!Number.isFinite(itemId)) {
                continue;
            }

            const itemNode = instantiate(this.itemPrefab);
            itemNode.parent = itemContainer;
            itemNode.getComponent(itemController).initData(itemId);
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

    /** 绑定容器格子的点击事件。 */
    private bindContainerSlots() {
        for (const slot of this.getContainerSlots()) {
            slot.on(Node.EventType.TOUCH_END, this.clickContainerSlot, this);
        }
    }

    /** 绑定背包格子的点击事件。 */
    private bindBackpackSlots() {
        for (const slot of this.getBackpackSlots()) {
            slot.on(Node.EventType.TOUCH_END, this.clickBackpackSlot, this);
        }
    }

    /** 获取容器的九个物品格子。 */
    private getContainerSlots(): Node[] {
        return this.container.getChildByName("content").children;
    }

    /** 获取背包的物品格子。 */
    private getBackpackSlots(): Node[] {
        return this.backpackContainer.children;
    }

    /** 点击容器格子；再次点击已选中的物品时尝试放入背包。 */
    private clickContainerSlot(event: EventTouch) {
        event.propagationStopped = true;

        const slot = event.currentTarget as Node;
        const hasItem = slot.getChildByName("content").children.length > 0;
        if (!hasItem) {
            this.hideAllSelect();
            return;
        }

        if (this.selectedContainerSlot === slot) {
            this.moveContainerItemToBackpack(slot);
            return;
        }

        this.selectedContainerSlot = slot;
        this.selectedBackpackSlot = null;
        this.refreshSelect();
    }

    /** 点击背包格子；空格子会取消全部选中。 */
    private clickBackpackSlot(event: EventTouch) {
        event.propagationStopped = true;

        const slot = event.currentTarget as Node;
        const hasItem = slot.getChildByName("content").children.length > 0;
        if (!hasItem) {
            this.hideAllSelect();
            return;
        }

        this.selectedContainerSlot = null;
        this.selectedBackpackSlot = slot;
        this.refreshSelect();
    }

    /** 将选中的容器物品放入背包。 */
    private moveContainerItemToBackpack(slot: Node) {
        const slotIndex = this.getContainerSlots().indexOf(slot);
        const itemId = this.itemData[slotIndex];
        const itemData = getItemDataByItemId(itemId) as JsonItemData;
        if (!itemData) {
            return;
        }

        this.refreshBackpack();
        const itemCapacity = Number(itemData.capacity) || 0;
        if (pData.backpackCapacity + itemCapacity > pData.maxBackpackCapacity) {
            uiMgr.showTips("背包容量已满");
            return;
        }

        pData.backpackItems.push(itemId);
        this.itemData[slotIndex] = -1;
        ccTools.destroyAllChild(slot.getChildByName("content"));
        this.initBackpack();
        this.refreshBackpack();
        this.hideAllSelect();
    }

    /** 刷新容器与背包格子的选中状态。 */
    private refreshSelect() {
        for (const slot of this.getContainerSlots()) {
            slot.getChildByName("select").active = slot === this.selectedContainerSlot;
        }
        for (const slot of this.getBackpackSlots()) {
            slot.getChildByName("select").active = slot === this.selectedBackpackSlot;
        }
        this.discardBtn.active = this.selectedBackpackSlot !== null;
    }

    /** 隐藏所有容器和背包格子的选中框。 */
    private hideAllSelect() {
        this.selectedContainerSlot = null;
        this.selectedBackpackSlot = null;
        this.refreshSelect();
    }

    ///
    ///点击事件
    ///
    /**点击丢弃 */
    clickDiscardBtn() {
        if (!this.selectedBackpackSlot) {
            return;
        }

        const slotIndex = this.getBackpackSlots().indexOf(this.selectedBackpackSlot);
        if (slotIndex < 0 || !Number.isFinite(pData.backpackItems[slotIndex])) {
            this.hideAllSelect();
            return;
        }

        // 移除当前格子的物品；数组后续元素会自动前移一格。
        pData.backpackItems.splice(slotIndex, 1);
        this.hideAllSelect();
        this.initBackpack();
        this.refreshBackpack();
    }

    /** 阻止按钮点击冒泡到页面背景。 */
    private stopEventPropagation(event: EventTouch) {
        event.propagationStopped = true;
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIBackpack);
    }
}
