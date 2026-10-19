import { _decorator, Component, Node, sp, UITransform, Vec3 } from 'cc';
const { ccclass } = _decorator;

@ccclass('roleShowController')
export class roleShowController extends Component {
    private roleAnim: sp.Skeleton = null;
    private weaponNode: Node = null;
    private weaponSocketBone: any = null;
    private tempSocketLocalPos = new Vec3();
    private tempSocketWorldPos = new Vec3();
    private tempSocketParentLocalPos = new Vec3();

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
