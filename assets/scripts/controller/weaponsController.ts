import { _decorator, Component, Mat4, Node, sp, Tween, tween, UITransform, Vec3 } from 'cc';
const { ccclass } = _decorator;

/** 所有手持武器共用的动画名称。 */
export enum weaponsAnimName { idle = 'idle', attack = 'attack' }

/** 从 weapons 表读取并应用到武器控制器的基础数值。 */
export interface WeaponStats {
    attackInterval: number;
    flightSpeed: number;
    attack: number;
    capacity: number;
    attackRange: number;
    /** 单次攻击生成的子弹数；仅霰弹枪等多弹丸武器使用。 */
    bulletNum?: number;
}

/**
 * 手持武器基类。
 *
 * 负责角色挂点同步、朝向、瞄准、待机和回正等共通表现；子类只实现各自的攻击方式。
 */
@ccclass('weaponsController')
export class weaponsController extends Component {
    /** 攻击间隔（秒），由 weapons 表 attackInterval 配置。 */
    attackInterval = 0.2;
    /** 子弹飞行速度；远程武器会逐发传给子弹控制器。 */
    flightSpeed = 2000;
    /** 攻击力。 */
    attack = 5;
    /** 弹匣容量；近战武器可配置为 1。 */
    capacity = 20;
    /** 攻击距离：用于自动索敌，并限制远程子弹的最大飞行距离。 */
    attackRange = 600;

    protected roleAnim: sp.Skeleton = null;
    protected weaponSkeleton: sp.Skeleton = null;
    protected weaponSocketBone: any = null;
    protected rightHandNode: Node = null;
    protected leftHandNode: Node = null;
    protected rightHandBone: any = null;
    protected leftHandBone: any = null;
    protected curWeaponAnimName = '';
    protected hasAimTarget = false;
    protected tempRoleWorldPos = new Vec3();
    protected tempSocketLocalPos = new Vec3();
    protected tempSocketWorldPos = new Vec3();
    protected tempSocketParentLocalPos = new Vec3();
    protected tempTargetParentLocalPos = new Vec3();
    protected tempTargetWorldPos = new Vec3();
    protected tempTargetWorldScale = new Vec3();
    protected tempHandBoneMatrix = new Mat4();
    private resetRotationTween: Tween<Node> = null;

    protected onLoad(): void {
        this.weaponSkeleton = this.getComponent(sp.Skeleton);
        this.rightHandNode = this.node.getChildByName('right');
        this.leftHandNode = this.node.getChildByName('left');
        if (this.rightHandNode) this.rightHandNode.active = true;
        if (this.leftHandNode) this.leftHandNode.active = true;
    }

    /** 应用 weapons 表中的基础数值；非法值保留当前默认值。 */
    applyStats(stats: WeaponStats) {
        if (Number.isFinite(stats.attackInterval)) this.attackInterval = Math.max(0, stats.attackInterval);
        if (Number.isFinite(stats.flightSpeed)) this.flightSpeed = Math.max(0, stats.flightSpeed);
        if (Number.isFinite(stats.attack)) this.attack = Math.max(0, stats.attack);
        if (Number.isFinite(stats.capacity)) this.capacity = Math.max(0, Math.floor(stats.capacity));
        if (Number.isFinite(stats.attackRange)) this.attackRange = Math.max(0, stats.attackRange);
    }

    /** 绑定到角色 Spine 的 G 挂点。 */
    bindToRole(roleAnim: sp.Skeleton) {
        this.roleAnim = roleAnim;
        this.weaponSocketBone = this.roleAnim?.findBone('G') ?? null;
        if (!this.weaponSocketBone) return false;
        this.syncToRoleSocket();
        return true;
    }

    protected lateUpdate(): void {
        this.syncToRoleSocket();
    }

    /** 同步武器节点到角色挂点，并保留武器自身的旋转和翻转。 */
    protected syncToRoleSocket() {
        if (!this.weaponSocketBone || !this.roleAnim?.node || !this.node.parent) return;
        this.roleAnim.node.updateWorldTransform();
        this.tempSocketLocalPos.set(this.weaponSocketBone.worldX, this.weaponSocketBone.worldY, 0);
        Vec3.transformMat4(this.tempSocketWorldPos, this.tempSocketLocalPos, this.roleAnim.node.worldMatrix);
        const parentTransform = this.node.parent.getComponent(UITransform);
        if (parentTransform) {
            parentTransform.convertToNodeSpaceAR(this.tempSocketWorldPos, this.tempSocketParentLocalPos);
            this.node.setPosition(this.tempSocketParentLocalPos);
        } else {
            this.node.setWorldPosition(this.tempSocketWorldPos);
        }
    }

    /** 根据水平移动或攻击方向翻转角色与当前武器。 */
    setFacingByHorizontal(directionX: number) {
        if (directionX === 0) return;
        const scaleX = directionX > 0 ? -1 : 1;
        const roleAnimNode = this.roleAnim?.node;
        if (roleAnimNode) {
            roleAnimNode.setScale(scaleX * Math.abs(roleAnimNode.scale.x), roleAnimNode.scale.y, roleAnimNode.scale.z);
        }
        const isWeaponFacingChanged = (this.node.scale.x < 0) !== (scaleX < 0);
        const isResettingRotation = !!this.resetRotationTween;
        this.node.setScale(scaleX * Math.abs(this.node.scale.x), this.node.scale.y, this.node.scale.z);
        if (isWeaponFacingChanged) {
            this.node.angle = -this.node.angle;
            if (isResettingRotation) this.resetRotation();
        }
    }

    /** 对准目标；子类可重写 updateAimRotation 适配枪口或近战攻击点。 */
    aimAt(target: Node) {
        if (!target?.isValid) return false;
        target.getWorldPosition(this.tempTargetWorldPos);
        const targetBody = target.getChildByName('roleAnim') || target;
        const targetHeight = targetBody.getComponent(UITransform)?.height || 0;
        targetBody.getWorldScale(this.tempTargetWorldScale);
        this.tempTargetWorldPos.y += targetHeight * Math.abs(this.tempTargetWorldScale.y) * 0.5;
        this.hasAimTarget = true;
        this.node.parent?.getWorldPosition(this.tempRoleWorldPos);
        const offsetX = this.tempTargetWorldPos.x - this.tempRoleWorldPos.x;
        this.setFacingByHorizontal(offsetX || 1);
        this.syncToRoleSocket();
        this.updateAimRotation();
        return true;
    }

    /** 默认按武器节点中心对准，枪械子类会按枪口骨骼修正。 */
    protected updateAimRotation() {
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) return;
        parentTransform.convertToNodeSpaceAR(this.tempTargetWorldPos, this.tempTargetParentLocalPos);
        const offsetX = this.tempTargetParentLocalPos.x - this.node.position.x;
        const offsetY = this.tempTargetParentLocalPos.y - this.node.position.y;
        const targetAngle = Math.atan2(offsetY, offsetX) * 180 / Math.PI;
        this.node.angle = Math.max(-90, Math.min(90, targetAngle));
    }

    clearAimTarget() { this.hasAimTarget = false; }

    resetRotation(isImmediate = false) {
        this.stopResetRotationTween();
        const resetAngle = this.getDefaultAngle();
        if (isImmediate) {
            this.node.angle = resetAngle;
            return;
        }
        this.resetRotationTween = tween(this.node)
            .to(0.1, { angle: resetAngle })
            .call(() => this.resetRotationTween = null)
            .start();
    }

    /** 默认待机角度；子类可按各自武器类型覆盖。 */
    protected getDefaultAngle(): number {
        return this.node.scale.x < 0 ? 10 : -10;
    }

    stopResetRotationTween() {
        this.resetRotationTween?.stop();
        this.resetRotationTween = null;
    }

    playIdleAnim() {
        if (!this.weaponSkeleton?.skeletonData || this.curWeaponAnimName === weaponsAnimName.idle) return;
        this.curWeaponAnimName = weaponsAnimName.idle;
        this.weaponSkeleton.setAnimation(0, weaponsAnimName.idle, true);
    }

    protected syncHandsToWeaponBones() {
        if (!this.rightHandBone || !this.leftHandBone) if (!this.bindHandsToWeaponBones()) return;
        this.syncNodeToBone2D(this.rightHandNode, this.rightHandBone);
        this.syncNodeToBone2D(this.leftHandNode, this.leftHandBone);
    }

    private bindHandsToWeaponBones() {
        if (!this.weaponSkeleton?.skeletonData || !this.rightHandNode || !this.leftHandNode) return false;
        this.weaponSkeleton.sockets = [];
        this.rightHandBone = this.weaponSkeleton.findBone('youshou');
        this.leftHandBone = this.weaponSkeleton.findBone('zuoshou');
        return !!this.rightHandBone && !!this.leftHandBone;
    }

    private syncNodeToBone2D(node: Node, bone: any) {
        if (!node || !bone) return;
        const matrix = this.tempHandBoneMatrix;
        Mat4.identity(matrix);
        matrix.m00 = bone.a; matrix.m01 = bone.c; matrix.m04 = bone.b; matrix.m05 = bone.d;
        matrix.m12 = bone.worldX; matrix.m13 = bone.worldY;
        node.matrix = matrix;
        node.setRotationFromEuler(0, 0, node.eulerAngles.z);
    }
}
