import { _decorator, Component, Node, sp, UITransform, Vec3 } from 'cc';
import { ccStorageTools } from '../../extention/storageTools';
import { GameEvent, SaveKey } from '../../manager/configData';
import { gm } from '../../manager/gm';
const { ccclass } = _decorator;

@ccclass('roleShowController')
export class roleShowController extends Component {
    /** 当前展示的是否为玩家自身数据。 */
    private isPlayerData = true;

    /** 切换展示数据来源时同步刷新装备显示。 */
    setIsPlayerData(isPlayerData: boolean): void {
        this.isPlayerData = isPlayerData;
        this.refreshEquipmentDisplay();
    }

    private roleAnim: sp.Skeleton = null;
    private weaponNode: Node = null;
    private weaponSocketBone: any = null;
    private tempSocketLocalPos = new Vec3();
    private tempSocketWorldPos = new Vec3();
    private tempSocketParentLocalPos = new Vec3();

    protected onLoad(): void {
        this.refreshEquipmentDisplay();
        gm.Event.on(GameEvent.refreshEquipmentDisplay, this.refreshEquipmentDisplay, this);
    }

    protected onDestroy(): void {
        gm.Event.off(GameEvent.refreshEquipmentDisplay, this.refreshEquipmentDisplay, this);
    }

    /** 玩家自身跟随仓库装备显示设置，AI 始终显示装备图片。 */
    private refreshEquipmentDisplay(): void {
        const isVisible = !this.isPlayerData || ccStorageTools.getNumberData(SaveKey.isShowEquipment) !== 1;
        const roleAnimNode = this.node.getChildByName('roleAnim');
        for (const name of ['head', 'armor']) {
            const imageNode = roleAnimNode?.getChildByName(name)?.getChildByName('img');
            if (imageNode) imageNode.active = isVisible;
        }
    }

    protected start(): void {
        this.bindWeaponToRole();
    }

    /** 将 weapon 节点绑定到角色 Spine 的 G 挂点；更换角色骨骼后需重新调用。 */
    bindWeaponToRole(roleAnim: sp.Skeleton = this.node.getChildByName('roleAnim')?.getComponent(sp.Skeleton)) {
        this.roleAnim = roleAnim;
        this.weaponNode = this.node.getChildByName('weapon');
        this.weaponSocketBone = this.roleAnim?.findBone('G') ?? null;
        if (!this.weaponNode || !this.weaponSocketBone) return false;
        this.syncWeaponPosition();
        return true;
    }

    protected lateUpdate(): void {
        // 骨骼数据尚未准备好时继续尝试绑定，兼容异步加载的展示角色。
        if (!this.weaponSocketBone) {
            this.bindWeaponToRole(this.roleAnim ?? undefined);
            return;
        }
        this.syncWeaponPosition();
    }

    /** 同步挂点位置，保留展示武器自身的旋转和缩放。 */
    private syncWeaponPosition(): void {
        if (!this.weaponSocketBone || !this.roleAnim?.node?.isValid || !this.weaponNode?.isValid || !this.weaponNode.parent) return;
        this.roleAnim.node.updateWorldTransform();
        this.tempSocketLocalPos.set(this.weaponSocketBone.worldX, this.weaponSocketBone.worldY, 0);
        Vec3.transformMat4(this.tempSocketWorldPos, this.tempSocketLocalPos, this.roleAnim.node.worldMatrix);
        const parentTransform = this.weaponNode.parent.getComponent(UITransform);
        if (parentTransform) {
            parentTransform.convertToNodeSpaceAR(this.tempSocketWorldPos, this.tempSocketParentLocalPos);
            this.weaponNode.setPosition(this.tempSocketParentLocalPos);
        } else {
            this.weaponNode.setWorldPosition(this.tempSocketWorldPos);
        }
    }
}
