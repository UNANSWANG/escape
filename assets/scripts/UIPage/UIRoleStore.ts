import { _decorator, Node, Prefab, Label, Sprite, instantiate } from 'cc';
import { UIBase } from './UIBase';
import { imgPath, ItemPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { ccResTools } from '../extention/resTools';
import { JsonRoleData, roleConfig } from '../json/jsonRole';
import { roleAvatarItemController } from '../controller/roleAvatarItemController';
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

    @property(Node)
    leftBtn: Node;

    @property(Node)
    rightBtn: Node;

    @property([Node])
    tabList: Node[] = [];

    @property([Node])
    pageList: Node[] = [];

    @property(Node)
    upgradeBtn: Node;

    /**页签名称，与角色类型一一对应 */
    private tabNames: string[] = ["全部", "突击", "治疗", "肉盾", "功能"];
    /**-1 表示全部，其余对应角色表的 type */
    private tabTypes: number[] = [-1, 0, 1, 2, 3];
    private selectedRoleType = -1;
    private selectedPageIndex = 0;
    private tabsInitialized = false;
    private selectedRole: JsonRoleData | null = null;
    private roleAvatarItems: roleAvatarItemController[] = [];
    private roleAvatarPrefab: Prefab | null = null;
    private roleAvatarPrefabLoad: Promise<Prefab> | null = null;
    private roleAvatarRefreshId = 0;

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

    /**刷新当前类型的角色头像，并默认选择表中第一个角色 */
    private async refreshRoleAvatars() {
        const refreshId = ++this.roleAvatarRefreshId;
        this.selectedRole = null;
        this.roleAvatarItems = [];
        this.clickPageTab(this.selectedPageIndex);
        this.refreshRoleSwitchButtons();
        ccTools.destroyAllChild(this.roleAvatarContent);
        const roles = (roleConfig.roleAllData ?? []).filter((role) =>
            this.selectedRoleType === -1 || role.type === this.selectedRoleType);
        if (roles.length === 0) {
            return;
        }

        if (!this.roleAvatarPrefab) {
            if (!this.roleAvatarPrefabLoad) {
                this.roleAvatarPrefabLoad = ccResTools.loadPrefab(uiMgr.resBundle, ItemPath.roleAvatarItem);
            }
            try {
                this.roleAvatarPrefab = await this.roleAvatarPrefabLoad;
            } finally {
                this.roleAvatarPrefabLoad = null;
            }
        }
        if (refreshId !== this.roleAvatarRefreshId || !this.node.isValid || !this.roleAvatarContent.isValid) {
            return;
        }
        if (!this.roleAvatarPrefab) {
            console.warn(`加载角色头像预制体失败: ${ItemPath.roleAvatarItem}`);
            return;
        }

        roles.forEach((role) => {
            const itemNode = instantiate(this.roleAvatarPrefab);
            this.roleAvatarContent.addChild(itemNode);
            const item = itemNode.getComponent(roleAvatarItemController) ?? itemNode.addComponent(roleAvatarItemController);
            item.initData(role);
            this.roleAvatarItems.push(item);
            const button = itemNode.getComponent(zoomButton) ?? itemNode.addComponent(zoomButton);
            button.onClick = this.clickRoleAvatar.bind(this, role.roleId);
        });
        this.clickRoleAvatar(roles[0].roleId);
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        const leftButton = this.leftBtn.getComponent(zoomButton) ?? this.leftBtn.addComponent(zoomButton);
        leftButton.onClick = this.clickLeftBtn.bind(this);
        const rightButton = this.rightBtn.getComponent(zoomButton) ?? this.rightBtn.addComponent(zoomButton);
        rightButton.onClick = this.clickRightBtn.bind(this);
        this.tabList.forEach((tabNode, index) => {
            tabNode.on(Node.EventType.TOUCH_END, () => {
                this.clickPageTab(index);
            }, this);
        });
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
        this.refreshRoleAvatars();
    }

    /**选择当前列表中的角色头像 */
    clickRoleAvatar(roleId: number) {
        const selectedItem = this.roleAvatarItems.find((item) => item.roleData?.roleId === roleId);
        if (!selectedItem) {
            return;
        }
        this.selectedRole = selectedItem.roleData;
        this.roleAvatarItems.forEach((item) => item.setSelected(item === selectedItem));
        this.clickPageTab(this.selectedPageIndex);
        this.refreshRoleSwitchButtons();
    }

    /**切换详情窗口页签：0 基础信息，1 皮肤 */
    clickPageTab(index: number) {
        if (index === 0) {
            this.showInfoPage();
        } else if (index === 1) {
            this.showSkinPage();
        }
    }

    /**显示当前角色的基础信息页面 */
    showInfoPage() {
        this.setDetailPage(0);
        const descLab = this.pageList[0]?.getChildByName("descLab")?.getComponent(Label);
        if (descLab) {
            descLab.string = this.selectedRole?.infoDesc ?? "";
        }
    }

    /**显示当前角色的皮肤页面 */
    showSkinPage() {
        this.setDetailPage(1);
    }

    /**同步详情页面显隐和页签选中状态 */
    private setDetailPage(index: number) {
        this.selectedPageIndex = index;
        this.pageList.forEach((pageNode, pageIndex) => {
            pageNode.active = pageIndex === index;
        });
        this.tabList.forEach((tabNode, tabIndex) => {
            const selectNode = tabNode.getChildByName("select");
            if (selectNode) {
                selectNode.active = tabIndex === index;
            }
        });
    }

    /**根据当前角色在页签列表中的位置更新切换按钮 */
    private refreshRoleSwitchButtons() {
        const index = this.roleAvatarItems.findIndex((item) => item.roleData === this.selectedRole);
        this.leftBtn.active = index > 0;
        this.rightBtn.active = index >= 0 && index < this.roleAvatarItems.length - 1;
    }

    /**选择当前页签中的相邻角色，不循环切换 */
    private switchRole(offset: number) {
        const index = this.roleAvatarItems.findIndex((item) => item.roleData === this.selectedRole);
        if (index < 0) {
            return;
        }
        const role = this.roleAvatarItems[index + offset]?.roleData;
        if (role) {
            this.clickRoleAvatar(role.roleId);
        }
    }

    clickLeftBtn() {
        this.switchRole(-1);
    }

    clickRightBtn() {
        this.switchRole(1);
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onUI_Close() {
        this.roleAvatarRefreshId++;
    }

    protected onDestroy(): void {
        this.roleAvatarRefreshId++;
    }

    onClose() {
        uiMgr.closePage(UIPath.UIRoleStore);
    }
}


