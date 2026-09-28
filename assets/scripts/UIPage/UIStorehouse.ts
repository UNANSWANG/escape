import { _decorator, Component, Node, ScrollView} from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
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

    @property(ScrollView)
    scrol: ScrollView;

    @property([Node])
    tabBtns: Node[] = [];

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        this.initData();
    }

    initData() {
        
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

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIStorehouse);
    }
}


