import { _decorator, Component, Node, Animation} from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
const { ccclass, property } = _decorator;


@ccclass('UIBackpack')
export class UIBackpack extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    searchNode: Node;

    @property(Node)
    container: Node;

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

    initData() {
        
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


