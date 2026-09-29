import { _decorator, Node } from 'cc';
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

    @property(List)
    scrolList: List;

    @property([Node])
    tabBtns: Node[] = [];

    private selectedTabIndex = 0;
    private isShowEquipment = 0;
    private readonly minItemCount = 20;
    private listData: StorehouseListItem[] = [];

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        this.initData();
    }

    initData() {
        this.clickTabBtn(this.selectedTabIndex);
        this.isShowEquipment = ccStorageTools.getNumberData(SaveKey.isShowEquipment) === 1 ? 1 : 0;
        this.refreshEquipmentDisplay();
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.sortBtn.addComponent(zoomButton).onClick = this.clickSortBtn.bind(this);
        this.sellBtn.addComponent(zoomButton).onClick = this.clickSellBtn.bind(this);
        this.weapons_0.addComponent(zoomButton).onClick = this.clickWeaponsBtn.bind(this, 0);
        this.weapons_1.addComponent(zoomButton).onClick = this.clickWeaponsBtn.bind(this, 1);
        this.knife.addComponent(zoomButton).onClick = this.clickKnifeBtn.bind(this);
        this.head.addComponent(zoomButton).onClick = this.clickHeadBtn.bind(this);
        this.armor.addComponent(zoomButton).onClick = this.clickArmorBtn.bind(this);
        this.backpack.addComponent(zoomButton).onClick = this.clickBackpackBtn.bind(this);
        this.showWeaponNode.addComponent(zoomButton).onClick = this.clickShowWeaponBtn.bind(this);
        for (let i = 0; i < this.tabBtns.length; i++) {
            this.tabBtns[i].on(Node.EventType.TOUCH_END, this.clickTabBtn.bind(this, i));
        }
    }

    /**渲染数据 */
    onListRender(item: any, idx: number) {
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
    clickWeaponsBtn(index: number) {
        console.log("点击武器", index);
    }

    /**点击刀 */
    clickKnifeBtn() {
        console.log("点击刀");
    }

    /**点击头 */
    clickHeadBtn() {
        console.log("点击头");
    }

    /**点击护甲 */
    clickArmorBtn() {
        console.log("点击护甲");
    }

    /**点击背包 */
    clickBackpackBtn() {
        console.log("点击背包");
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


