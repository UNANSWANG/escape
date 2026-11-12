import { _decorator, Component, Node, Animation} from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
const { ccclass, property } = _decorator;

@ccclass('UISmallMap')
export class UISmallMap extends UIBase {
    @property(Node)
    mapBg: Node;

    @property(Node)
    mapParent: Node;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData();
    }

    initData() {
        
    }

    bindBtn() {
        this.node.getChildByName('mask').on(Node.EventType.TOUCH_END, this.clickCloseBtn, this);
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UISmallMap);
    }
}

