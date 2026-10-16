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

    /**页签名称，与角色类型一一对应 */
    private tabNames: string[] = ["全部", "突击", "治疗", "肉盾", "功能"];
    /**-1 表示全部，其余对应角色表的 type */
    private tabTypes: number[] = [-1, 0, 1, 2, 3];
    private selectedRoleType = -1;
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


