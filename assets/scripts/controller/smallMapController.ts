import { _decorator, Component, Node, Sprite, UITransform, Vec3 } from 'cc';
import { playerMgr } from '../manager/playerManager';
import { imgPath } from '../manager/pathConfig';
import { pData } from '../manager/playerData';
import { ccTools } from '../extention/generalTools';
const { ccclass } = _decorator;

@ccclass('smallMapController')
export class smallMapController extends Component {
    private roleIcon: Node = null;
    private mapTransform: UITransform = null;
    private playerMapPosition = new Vec3();
    private iconScaleX = 1;
    private avatarRoleId = -1;

    protected onLoad(): void {
        this.roleIcon = this.node.getChildByName('roleIcon');
        this.mapTransform = this.getComponent(UITransform);
        if (this.roleIcon) this.iconScaleX = Math.abs(this.roleIcon.scale.x);
    }

    protected onEnable(): void {
        this.initRoleAvatar();
        this.syncRoleIcon();
    }

    private async initRoleAvatar(): Promise<void> {
        const sprite = this.roleIcon?.getComponent(Sprite);
        const roleId = playerMgr.playerComp?.roleId ?? pData.roleId;
        if (!sprite || this.avatarRoleId === roleId) return;
        this.avatarRoleId = roleId;
        const loaded = await ccTools.loadImg(sprite, imgPath.smallMapAvatar + roleId);
        if (!loaded && this.avatarRoleId === roleId) this.avatarRoleId = -1;
    }

    protected lateUpdate(): void {
        this.syncRoleIcon();
    }

    private syncRoleIcon(): void {
        const player = playerMgr.player;
        if (!this.roleIcon?.isValid || !this.mapTransform || !player?.isValid) return;
        const playerComp = playerMgr.playerComp;
        const map = playerComp?.gameComp?.mapNode;
        const background = map?.getChildByName('bg')?.getComponent(UITransform);
        if (!background || background.width <= 0 || background.height <= 0) return;

        background.convertToNodeSpaceAR(player.worldPosition, this.playerMapPosition);
        const normalizedX = this.playerMapPosition.x / background.width + background.anchorX;
        const normalizedY = this.playerMapPosition.y / background.height + background.anchorY;
        this.roleIcon.setPosition(
            (normalizedX - this.mapTransform.anchorX) * this.mapTransform.width,
            (normalizedY - this.mapTransform.anchorY) * this.mapTransform.height,
            this.roleIcon.position.z,
        );

        const roleAnim = playerComp.roleAnim?.node;
        if (roleAnim) {
            const direction = roleAnim.scale.x < 0 ? -1 : 1;
            this.roleIcon.setScale(this.iconScaleX * direction, this.roleIcon.scale.y, this.roleIcon.scale.z);
        }
    }
}


