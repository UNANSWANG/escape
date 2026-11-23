import { _decorator, Component, Node, Animation} from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
const { ccclass, property } = _decorator;

@ccclass('UIGuide')
export class UIGuide extends UIBase {

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        this.initData();
    }

    initData() {
        
    }

    bindBtn() {
        
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIGuide);
    }
}


