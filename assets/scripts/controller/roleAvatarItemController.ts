import { _decorator, Component, Label, Sprite } from 'cc';
import { JsonRoleData } from '../json/jsonRole';
import { ccTools } from '../extention/generalTools';
import { imgPath } from '../manager/pathConfig';
const { ccclass } = _decorator;

@ccclass('roleAvatarItemController')
export class roleAvatarItemController extends Component {
    roleData: JsonRoleData | null = null;

    initData(roleData: JsonRoleData) {
        this.roleData = roleData;
        const nameLab = this.node.getChildByPath("layout/lab")?.getComponent(Label);
        if (nameLab) {
            nameLab.string = roleData.name;
        }
        const icon = this.node.getChildByPath("layout/img")?.getComponent(Sprite);
        if (icon) {
            ccTools.loadImg(icon, imgPath.roleType + roleData.type);
        }
        this.setSelected(false);
    }

    setSelected(selected: boolean) {
        const selectNode = this.node.getChildByName("select");
        if (selectNode) {
            selectNode.active = selected;
        }
    }
}
