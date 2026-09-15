import { _decorator, Component, Node, Animation} from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
const { ccclass, property } = _decorator;

@ccclass('UISign')
export class UISign extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    getBtn: Node;

    @property(Node)
    adBtn: Node;

    @property([Node])
    itemList: Node[] = [];

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
        this.getBtn.addComponent(zoomButton).onClick = this.clickGetBtn.bind(this);
        this.adBtn.addComponent(zoomButton).onClick = this.clickAdBtn.bind(this);
    }

    ///
    ///点击事件
    ///
    /**点击获取 */
    clickGetBtn() {
        console.log("点击获取");
    }

    /**点击广告 */
    clickAdBtn() {
        console.log("点击广告");
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UISign);
    }
}



