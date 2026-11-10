import { _decorator, Component, Node, Animation, Label} from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
const { ccclass, property } = _decorator;

@ccclass('UIMoneyAdd')
export class UIMoneyAdd extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    getBtn_0: Node;

    @property(Node)
    getBtn_1: Node;

    @property(Label)
    addNumLab: Label;

    @property(Label)
    addNumLab2: Label;

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
        uiMgr.closePage(UIPath.UIMoneyAdd);
    }
}


