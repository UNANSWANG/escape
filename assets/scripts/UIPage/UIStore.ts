import { _decorator, Node, Prefab, Label, instantiate } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('UIStore')
export class UIStore extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    tabContent: Node;

    @property(Node)
    pageContent: Node;

    @property(Prefab)
    storeTabPrefab: Prefab;

    /**页签名称 */
    private storeTabNames: string[] = ["黑市", "超武", "武器", "装备", "道具"];
    /**页签数组 */
    private storeTabsArray: number[] = [1, 2, 3, 4];

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        this.initData();
    }

    initData() {
        ccTools.destroyAllChild(this.tabContent);
        this.storeTabsArray.forEach((tabIndex, index) => {
            const tabNode = instantiate(this.storeTabPrefab);
            this.tabContent.addChild(tabNode);
            const nameLab = tabNode.getChildByName("lab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = this.storeTabNames[tabIndex] ?? "";
            }
            const button = tabNode.getComponent(zoomButton) ?? tabNode.addComponent(zoomButton);
            button.onClick = this.clickTabBtn.bind(this, index);
        });
        this.clickTabBtn(0);
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
    }

    ///
    ///点击事件
    ///

    clickTabBtn(index: number) {
        this.tabContent.children.forEach((tabNode, tabIndex) => {
            const selectNode = tabNode.getChildByName("select");
            if (selectNode) {
                selectNode.active = tabIndex === index;
            }
        });
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIStore);
    }
}

