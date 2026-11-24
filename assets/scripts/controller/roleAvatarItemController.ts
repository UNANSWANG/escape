import { _decorator, Component, Label, Sprite } from 'cc';
import { JsonRoleData } from '../json/jsonRole';
import { ccTools } from '../extention/generalTools';
import { imgPath } from '../manager/pathConfig';
import { pData } from '../manager/playerData';
const { ccclass } = _decorator;

const roleTypeNames = ["突击", "治疗", "肉盾", "功能"];

@ccclass('roleAvatarItemController')
export class roleAvatarItemController extends Component {
    roleData: JsonRoleData | null = null;

    initData(roleData: JsonRoleData) {
        this.roleData = roleData;
        const avatar = this.node.getChildByName("img")?.getComponent(Sprite);
        if (avatar) {
            ccTools.loadImg(avatar, imgPath.roleAvatar + roleData.roleId);
        }
        const nameLab = this.node.getChildByPath("layout/lab")?.getComponent(Label);
        if (nameLab) {
            nameLab.string = roleTypeNames[roleData.type] ?? "";
        }
        const icon = this.node.getChildByPath("layout/img")?.getComponent(Sprite);
        if (icon) {
            ccTools.loadImg(icon, imgPath.roleType + roleData.type);
        }
        this.setSelected(false);
        this.refreshLock();
    }

    /**同步头像锁标记，购买成功后可直接刷新。 */
    refreshLock() {
        const lock = this.node.getChildByName('lock');
        if (lock) lock.active = !!this.roleData && !pData.isRoleUnlocked(this.roleData.roleId);
    }

    setSelected(selected: boolean) {
        const selectNode = this.node.getChildByName("select");
        if (selectNode) {
            selectNode.active = selected;
        }
    }
}
