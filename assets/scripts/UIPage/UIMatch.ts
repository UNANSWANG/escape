import { _decorator, Node, Animation, Label } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
const { ccclass, property } = _decorator;

@ccclass('UIMatch')
export class UIMatch extends UIBase {
    @property(Node)
    cancelBtn: Node;

    @property(Label)
    timeLab: Label;

    @property(Label)
    titleLab: Label;

    @property(Node)
    contentLayout: Node;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        let anim = this.getComponent(Animation);
        anim.play();
    }

    bindBtn() {
        this.cancelBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
    }

    clickCloseBtn() {
        this.onClose();
        uiMgr.openPage(UIPath.UIMain);
    }

    onClose() {
        uiMgr.closePage(UIPath.UIMatch);
    }
}
