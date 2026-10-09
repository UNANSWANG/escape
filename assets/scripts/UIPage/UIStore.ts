import { _decorator, Component, Node, Animation, Prefab} from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
const { ccclass, property } = _decorator;

@ccclass('UIStore')
export class UIStore extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    content: Node;

    @property(Prefab)
    storeTabPrefab: Prefab;

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
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIStore);
    }
}

