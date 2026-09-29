import { _decorator, Component, Node, ScrollView} from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccStorageTools } from '../extention/storageTools';
import { SaveKey } from '../manager/configData';
const { ccclass, property } = _decorator;
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

    @property(ScrollView)
    scrol: ScrollView;

    @property([Node])
    tabBtns: Node[] = [];

    private selectedTabIndex = 0;
    private isShowEquipment = 0;

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
        for(let i = 0; i < this.tabBtns.length; i++){
            this.tabBtns[i].on(Node.EventType.TOUCH_END, this.clickTabBtn.bind(this, i));
        }
    }

    ///
    ///点击事件
    ///
    /**点击排序 */
    clickSortBtn() {
        console.log("点击排序");
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

    /**点击页签 */
    clickTabBtn(index: number) {
        if (index < 0 || index >= this.tabBtns.length) {
            return;
        }

        this.selectedTabIndex = index;
        for (let i = 0; i < this.tabBtns.length; i++) {
            const selectNode = this.tabBtns[i]?.getChildByName("select");
            if (selectNode) {
                selectNode.active = i === this.selectedTabIndex;
            }
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


