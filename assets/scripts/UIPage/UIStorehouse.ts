import { _decorator, EventTouch, Label, Node, UITransform, Vec3 } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccStorageTools } from '../extention/storageTools';
import { SaveKey } from '../manager/configData';
import List from '../sdk/virtualList/List';
import { pData } from '../manager/playerData';
import { equipmentConfig } from '../json/jsonEquipment';
import { weaponsConfig } from '../json/jsonWeapons';
import { itemConfig } from '../json/jsonItem';
import { itemController } from '../controller/itemController';
const { ccclass, property } = _decorator;

interface StorehouseListItem {
    itemId: number;
    num: number;
}

@ccclass('UIStorehouse')
export class UIStorehouse extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    sortBtn: Node;

    @property(Node)
    sellBtn: Node;

    @property(Node)
    weapons_0: Node;

    @property(Node)
    weapons_1: Node;

    @property(Node)
    knife: Node;

    @property(Node)
    head: Node;

    @property(Node)
    armor: Node;

    @property(Node)
    backpack: Node;

    @property(Node)
    showWeaponNode: Node;

    @property(Node)
    equipBtn: Node;

    @property(Node)
    removeBtn: Node;

    @property(List)
    scrolList: List;

    @property([Node])
    tabBtns: Node[] = [];

    private selectedTabIndex = 0;
    private isShowEquipment = 0;
    private readonly minItemCount = 20;
    private listData: StorehouseListItem[] = [];
    private selectedEquipmentNode: Node = null;
    private selectedStorehouseIndex = -1;
    private isListScrolling = false;
    private readonly renderedItemIndexes = new Map<Node, number>();
    private readonly tempWorldPosition = new Vec3();
    private readonly tempLocalPosition = new Vec3();

    protected onLoad(): void {
        this.bindBtn();
        this.hideAllSelect();
    }

    onUI_Open() {
        this.initData();
    }

    initData() {
        this.clickTabBtn(this.selectedTabIndex);
        this.isShowEquipment = ccStorageTools.getNumberData(SaveKey.isShowEquipment) === 1 ? 1 : 0;
        this.refreshEquipmentDisplay();
        this.refreshWeaponNames();
        this.refreshEquipmentNames();
    }

    /**根据装备栏前三项刷新主武器、副武器和近战武器名称。 */
    private refreshWeaponNames() {
        const weaponNodes = [this.weapons_0, this.weapons_1, this.knife];
        weaponNodes.forEach((weaponNode, slotIndex) => {
            const nameLab = weaponNode?.getChildByName("nameLab")?.getComponent(Label);
            if (!nameLab) {
                return;
            }

            const weaponData = weaponsConfig.getDataById(pData.equipmentIds[slotIndex]);
            nameLab.string = weaponData?.name ?? "";
        });
    }

    /**根据装备栏后三项刷新头盔、护甲和背包名称。 */
    private refreshEquipmentNames() {
        const equipmentNodes = [this.head, this.armor, this.backpack];
        equipmentNodes.forEach((equipmentNode, index) => {
            const nameLab = equipmentNode?.getChildByName("nameLab")?.getComponent(Label);
            if (!nameLab) {
                return;
            }

            const slotIndex = index + 3;
            const equipmentData = equipmentConfig.getDataById(pData.equipmentIds[slotIndex]);
            nameLab.string = equipmentData?.name ?? "";
        });
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.sortBtn.addComponent(zoomButton).onClick = this.clickSortBtn.bind(this);
        this.sellBtn.addComponent(zoomButton).onClick = this.clickSellBtn.bind(this);
        this.equipBtn.addComponent(zoomButton).onClick = this.clickEquipBtn.bind(this);
        this.removeBtn.addComponent(zoomButton).onClick = this.clickRemoveBtn.bind(this);
        this.showWeaponNode.addComponent(zoomButton).onClick = this.clickShowWeaponBtn.bind(this);
        this.weapons_0.on(Node.EventType.TOUCH_END, this.clickWeaponsBtn.bind(this, 0));
        this.weapons_1.on(Node.EventType.TOUCH_END, this.clickWeaponsBtn.bind(this, 1));
        this.knife.on(Node.EventType.TOUCH_END, this.clickKnifeBtn, this);
        this.head.on(Node.EventType.TOUCH_END, this.clickHeadBtn, this);
        this.armor.on(Node.EventType.TOUCH_END, this.clickArmorBtn, this);
        this.backpack.on(Node.EventType.TOUCH_END, this.clickBackpackBtn, this);
        this.node.on(Node.EventType.TOUCH_END, this.clickBlankArea, this);
        this.scrolList.node.on('scrolling', this.onListScrolling, this);
        this.scrolList.node.on('scroll-ended', this.onListScrollEnded, this);
        for (let i = 0; i < this.tabBtns.length; i++) {
            this.tabBtns[i].on(Node.EventType.TOUCH_END, this.clickTabBtn.bind(this, i));
        }
    }

    /**渲染数据 */
    onListRender(item: any, idx: number) {
        item.off(Node.EventType.TOUCH_END, this.clickStorehouseItem, this);
        item.on(Node.EventType.TOUCH_END, this.clickStorehouseItem, this);
        this.renderedItemIndexes.set(item, idx);

        const selectNode = item.getChildByName("select");
        if (selectNode) {
            selectNode.active = idx === this.selectedStorehouseIndex && !!this.listData[idx];
        }

        const contentNode = item?.getChildByName("content");
        const itemNode = contentNode?.children?.[0];
        if (!itemNode) {
            return;
        }

        const listItem = this.listData[idx];
        if (!listItem) {
            itemNode.active = false;
            return;
        }

        itemNode.active = true;
        const itemComp = itemNode.getComponent(itemController);
        if (!itemComp) {
            return;
        }

        itemComp.initData(listItem.itemId, listItem.num);
        const capacityNode = itemNode.getChildByName("normal")?.getChildByName("capacityLab");
        if (capacityNode) {
            capacityNode.active = false;
        }

        const valueNode = itemNode.getChildByName("normal")?.getChildByName("valueLab");
        if (valueNode) {
            const isEquipment = !!weaponsConfig.getDataByItemId(listItem.itemId)
                || !!equipmentConfig.getDataByItemId(listItem.itemId);
            valueNode.active = !isEquipment;
        }
    }

    /**点击仓库物品并刷新右侧选中状态。 */
    private clickStorehouseItem(event: EventTouch) {
        if (this.isListScrolling || this.isTouchMoved(event)) {
            this.hideAllSelect();
            return;
        }

        const itemNode = event.currentTarget as Node;
        const itemIndex = this.renderedItemIndexes.get(itemNode);
        if (itemIndex === undefined) {
            this.hideAllSelect();
            return;
        }
        const listItem = this.listData[itemIndex];
        if (!listItem) {
            this.hideAllSelect();
            return;
        }

        this.selectedEquipmentNode = null;
        this.selectedStorehouseIndex = itemIndex;
        this.refreshSelect();

        if (this.isEquipment(listItem.itemId)) {
            this.moveEquipButtonToItemRight(itemNode);
        }
    }

    /**刷新左右两侧选中框及操作按钮。 */
    private refreshSelect() {
        for (const equipmentNode of this.getEquipmentNodes()) {
            const selectNode = equipmentNode?.getChildByName("select");
            if (selectNode) {
                selectNode.active = equipmentNode === this.selectedEquipmentNode;
            }
        }

        for (const [itemNode, itemIndex] of this.renderedItemIndexes) {
            const selectNode = itemNode?.getChildByName("select");
            if (selectNode) {
                selectNode.active = itemIndex === this.selectedStorehouseIndex && !!this.listData[itemIndex];
            }
        }

        const selectedStorehouseItem = this.listData[this.selectedStorehouseIndex];
        const selectedEquipmentSlot = this.getEquipmentNodes().indexOf(this.selectedEquipmentNode);
        this.removeBtn.active = selectedEquipmentSlot >= 0 && this.getEquippedItemId(selectedEquipmentSlot) >= 0;
        this.equipBtn.active = !!selectedStorehouseItem && this.isEquipment(selectedStorehouseItem.itemId);
    }

    /**取消左右两侧的全部选中状态。 */
    private hideAllSelect() {
        this.selectedEquipmentNode = null;
        this.selectedStorehouseIndex = -1;
        this.refreshSelect();
    }

    /**选中左侧已装备的武器或装备。 */
    private selectEquipment(event: EventTouch) {
        this.selectedEquipmentNode = event.currentTarget as Node;
        this.selectedStorehouseIndex = -1;
        this.refreshSelect();
    }

    /**将装备按钮移动到右侧选中物品的右边。 */
    private moveEquipButtonToItemRight(itemNode: Node) {
        const itemTransform = itemNode.getComponent(UITransform);
        const buttonTransform = this.equipBtn.getComponent(UITransform);
        const buttonParentTransform = this.equipBtn.parent?.getComponent(UITransform);
        if (!itemTransform || !buttonTransform || !buttonParentTransform) {
            return;
        }

        this.tempLocalPosition.set(
            itemTransform.width * (1 - itemTransform.anchorX),
            itemTransform.height * (0.5 - itemTransform.anchorY),
            0,
        );
        itemTransform.convertToWorldSpaceAR(this.tempLocalPosition, this.tempWorldPosition);
        buttonParentTransform.convertToNodeSpaceAR(this.tempWorldPosition, this.tempLocalPosition);
        this.tempLocalPosition.x += buttonTransform.width * this.equipBtn.scale.x * buttonTransform.anchorX;
        this.tempLocalPosition.y += buttonTransform.height * this.equipBtn.scale.y * (buttonTransform.anchorY - 0.5);
        this.equipBtn.setPosition(this.tempLocalPosition);
    }

    private getEquipmentNodes(): Node[] {
        return [this.weapons_0, this.weapons_1, this.knife, this.head, this.armor, this.backpack];
    }

    private isEquipment(itemId: number): boolean {
        return !!weaponsConfig.getDataByItemId(itemId) || !!equipmentConfig.getDataByItemId(itemId);
    }

    /**根据物品配置获取应该装备到的槽位。 */
    private getEquipmentSlotIndex(itemId: number): number {
        const weaponData = weaponsConfig.getDataByItemId(itemId);
        if (weaponData) {
            if (weaponData.type === 0) {
                return 2;
            }
            if (pData.equipmentIds[0] < 0) {
                return 0;
            }
            if (pData.equipmentIds[1] < 0) {
                return 1;
            }
            return 0;
        }

        const equipmentData = equipmentConfig.getDataByItemId(itemId);
        if (!equipmentData) {
            return -1;
        }
        if (equipmentData.type === 0) {
            return 3;
        }
        if (equipmentData.type === 1) {
            return 4;
        }
        if (equipmentData.type === 2) {
            return 5;
        }
        return -1;
    }

    /**根据物品配置取得写入 equipmentIds 的配置 id。 */
    private getEquipmentConfigId(itemId: number): number {
        const weaponData = weaponsConfig.getDataByItemId(itemId);
        if (weaponData) {
            return weaponData.id;
        }
        return equipmentConfig.getDataByItemId(itemId)?.id ?? -1;
    }

    /**获取指定槽位当前装备对应的仓库物品 id。 */
    private getEquippedItemId(slotIndex: number): number {
        const equipmentId = pData.equipmentIds[slotIndex];
        if (equipmentId === pData.getDefaultEquipmentId(slotIndex)) {
            return -1;
        }

        if (slotIndex <= 2) {
            return weaponsConfig.getDataById(equipmentId)?.itemId ?? -1;
        }
        return equipmentConfig.getDataById(equipmentId)?.itemId ?? -1;
    }

    /**装备变化后刷新装备名称和当前仓库列表。 */
    private refreshAfterEquipmentChange() {
        this.refreshWeaponNames();
        this.refreshEquipmentNames();
        this.clickTabBtn(this.selectedTabIndex);
    }

    private isTouchMoved(event: EventTouch): boolean {
        const startPosition = event.getUIStartLocation();
        const endPosition = event.getUILocation();
        return Math.abs(endPosition.x - startPosition.x) > 10
            || Math.abs(endPosition.y - startPosition.y) > 10;
    }

    private onListScrolling() {
        this.isListScrolling = true;
        this.hideAllSelect();
    }

    private onListScrollEnded() {
        this.isListScrolling = false;
    }

    /**点击页面其他区域时取消选中。 */
    private clickBlankArea(event: EventTouch) {
        const targetNode = event.target as Node;
        if (this.isNodeInside(targetNode, this.equipBtn)
            || this.isNodeInside(targetNode, this.removeBtn)
            || this.getEquipmentNodes().some((equipmentNode) => this.isNodeInside(targetNode, equipmentNode))
            || Array.from(this.renderedItemIndexes.keys()).some((itemNode) => this.isNodeInside(targetNode, itemNode))) {
            return;
        }
        this.hideAllSelect();
    }

    private isNodeInside(targetNode: Node, parentNode: Node): boolean {
        let currentNode = targetNode;
        while (currentNode) {
            if (currentNode === parentNode) {
                return true;
            }
            currentNode = currentNode.parent;
        }
        return false;
    }

    private getTabData(index: number): StorehouseListItem[] {
        const storehouseData = pData.getStorehouseData();
        return storehouseData
            .filter((itemData) => Array.isArray(itemData) && itemData.length >= 2)
            .filter(([itemId]) => {
                if (index === 0) {
                    return true;
                }
                if (index === 1) {
                    return !!weaponsConfig.getDataByItemId(itemId) || !!equipmentConfig.getDataByItemId(itemId);
                }
                return !!itemConfig.getDataByItemId(itemId);
            })
            .map(([itemId, num]) => ({ itemId, num }));
    }

    /**刷新装备显示状态 */
    private refreshEquipmentDisplay() {
        const isVisible = this.isShowEquipment === 0;
        const equipmentNode = this.showWeaponNode?.parent?.getChildByName("equipmentNode");
        if (equipmentNode) {
            equipmentNode.active = isVisible;
        }

        const checkNode = this.showWeaponNode?.getChildByName("check");
        if (checkNode) {
            checkNode.active = isVisible;
        }
    }

    ///
    ///点击事件
    ///
    /**点击排序 */
    clickSortBtn() {
        pData.sortStorehouseData((itemA, itemB) => {
            const itemIdA = itemA[0];
            const itemIdB = itemB[0];
            const weaponA = weaponsConfig.getDataByItemId(itemIdA);
            const weaponB = weaponsConfig.getDataByItemId(itemIdB);
            const equipmentA = equipmentConfig.getDataByItemId(itemIdA);
            const equipmentB = equipmentConfig.getDataByItemId(itemIdB);
            const collectionA = itemConfig.getDataByItemId(itemIdA);
            const collectionB = itemConfig.getDataByItemId(itemIdB);
            const categoryA = weaponA ? 0 : equipmentA ? 1 : collectionA ? 2 : 3;
            const categoryB = weaponB ? 0 : equipmentB ? 1 : collectionB ? 2 : 3;

            if (categoryA !== categoryB) {
                return categoryA - categoryB;
            }
            if (weaponA && weaponB) {
                return (Number(weaponA.type) || 0) - (Number(weaponB.type) || 0);
            }
            if (equipmentA && equipmentB) {
                return (Number(equipmentA.type) || 0) - (Number(equipmentB.type) || 0);
            }
            if (collectionA && collectionB) {
                return (Number(collectionB.quality) || 0) - (Number(collectionA.quality) || 0);
            }
            return 0;
        });
        uiMgr.showTips("整理完成");
        this.clickTabBtn(this.selectedTabIndex);
    }

    /**点击出售 */
    clickSellBtn() {
        console.log("点击出售");
    }

    /**点击武器 */
    clickWeaponsBtn(index: number, event: EventTouch) {
        this.selectEquipment(event);
        console.log("点击武器", index);
    }

    /**点击刀 */
    clickKnifeBtn(event: EventTouch) {
        this.selectEquipment(event);
        console.log("点击刀");
    }

    /**点击头 */
    clickHeadBtn(event: EventTouch) {
        this.selectEquipment(event);
        console.log("点击头");
    }

    /**点击护甲 */
    clickArmorBtn(event: EventTouch) {
        this.selectEquipment(event);
        console.log("点击护甲");
    }

    /**点击背包 */
    clickBackpackBtn(event: EventTouch) {
        this.selectEquipment(event);
        console.log("点击背包");
    }

    /**点击装备按钮。 */
    clickEquipBtn() {
        const selectedItem = this.listData[this.selectedStorehouseIndex];
        if (!selectedItem || selectedItem.num <= 0) {
            this.hideAllSelect();
            return;
        }

        const slotIndex = this.getEquipmentSlotIndex(selectedItem.itemId);
        const equipmentId = this.getEquipmentConfigId(selectedItem.itemId);
        if (slotIndex < 0 || equipmentId < 0) {
            this.hideAllSelect();
            return;
        }

        const replacedItemId = this.getEquippedItemId(slotIndex);
        pData.setEquipmentId(slotIndex, equipmentId);
        const storehouseChanges = [[selectedItem.itemId, -1]];
        if (replacedItemId >= 0) {
            storehouseChanges.push([replacedItemId, 1]);
        }
        pData.fixStorehouseDatas(storehouseChanges);
        this.refreshAfterEquipmentChange();
    }

    /**点击卸下按钮。 */
    clickRemoveBtn() {
        const slotIndex = this.getEquipmentNodes().indexOf(this.selectedEquipmentNode);
        if (slotIndex < 0) {
            this.hideAllSelect();
            return;
        }

        const removedItemId = this.getEquippedItemId(slotIndex);
        if (removedItemId < 0 || !pData.removeEquipment(slotIndex)) {
            this.hideAllSelect();
            return;
        }

        pData.fixStorehouseData(removedItemId, 1);
        this.refreshAfterEquipmentChange();
    }

    /**点击显示装备开关 */
    clickShowWeaponBtn() {
        this.isShowEquipment = this.isShowEquipment === 0 ? 1 : 0;
        ccStorageTools.setData(SaveKey.isShowEquipment, this.isShowEquipment);
        this.refreshEquipmentDisplay();
    }

    /**点击页签 */
    clickTabBtn(index: number) {
        if (index < 0 || index >= this.tabBtns.length || index > 2) {
            return;
        }

        this.hideAllSelect();
        this.selectedTabIndex = index;
        this.listData = this.getTabData(index);
        for (let i = 0; i < this.tabBtns.length; i++) {
            const selectNode = this.tabBtns[i]?.getChildByName("select");
            if (selectNode) {
                selectNode.active = i === this.selectedTabIndex;
            }
        }

        if (this.scrolList) {
            this.scrolList.numItems = Math.max(this.minItemCount, this.listData.length);
            this.scrolList.scrollTo(0, 0);
        }
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIStorehouse);
    }
}


