import { _decorator, Node, Prefab, Label, Sprite, instantiate } from 'cc';
import { UIBase } from './UIBase';
import { imgPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('UIRoleStore')
export class UIRoleStore extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    tabContent: Node;

    @property(Prefab)
    tabPrefab: Prefab;

    @property(Node)
    roleAvatarContent: Node;

    /**页签名称，与角色类型一一对应 */
    private tabNames: string[] = ["全部", "突击", "治疗", "肉盾", "功能"];
    /**-1 表示全部，其余对应角色表的 type */
    private tabTypes: number[] = [-1, 0, 1, 2, 3];
    private selectedRoleType = -1;
    private tabsInitialized = false;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        this.initData();
    }

    initData() {
        if (!this.tabsInitialized) {
            this.initTabs();
            this.tabsInitialized = true;
        }
        this.clickTabBtn(this.selectedRoleType);
    }

    private initTabs() {
        ccTools.destroyAllChild(this.tabContent);
        this.tabTypes.forEach((roleType, index) => {
            const tabNode = instantiate(this.tabPrefab);
            this.tabContent.addChild(tabNode);
            const nameLab = tabNode.getChildByPath("layout/lab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = this.tabNames[index];
            }
            const icon = tabNode.getChildByPath("layout/img")?.getComponent(Sprite);
            if (icon) {
                ccTools.loadImg(icon, imgPath.roleType + (roleType === -1 ? "all" : roleType));
            }
            const button = tabNode.getComponent(zoomButton) ?? tabNode.addComponent(zoomButton);
            button.onClick = this.clickTabBtn.bind(this, roleType);
        });
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
    }

    ///
    ///点击事件
    ///

    /**切换角色类型页签，-1 为全部 */
    clickTabBtn(roleType: number) {
        if (!this.tabTypes.includes(roleType)) {
            return;
        }
        this.selectedRoleType = roleType;
        this.tabContent.children.forEach((tabNode, index) => {
            const selectNode = tabNode.getChildByName("select");
            if (selectNode) {
                selectNode.active = this.tabTypes[index] === roleType;
            }
        });
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIRoleStore);
    }
}


