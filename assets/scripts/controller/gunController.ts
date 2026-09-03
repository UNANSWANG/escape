import { _decorator, Component, Mat4, Node, sp, UITransform, Vec3 } from 'cc';
import { uiMgr } from '../manager/UIManager';
import { poolMgr } from '../manager/poolManager';
import { bulletController } from './bulletController';
const { ccclass } = _decorator;

/** 枪械 Spine 使用的动画名称。 */
export enum gunAnimName { idle = 'idle', attack = 'attack', reload = 'reload' }

@ccclass('gunController')
export class gunController extends Component {
    /** 自动瞄准检测范围。 */
    autoAttackRange = 400;
    /** 两发子弹之间的冷却时间，单位：秒。 */
    shootInterval = 0.2;
    /** 当前弹夹中剩余的子弹数。 */
    private currentAmmo = 0;
    /** 是否正处于换弹阶段；该阶段内不能开枪。 */
    private isReloading = false;
    /** 每个弹夹可容纳的子弹数量。 */
    bulletNum = 20;
    /** 持枪角色的 Spine，用于读取枪械挂点和翻转角色显示。 */
    private roleAnim: sp.Skeleton = null;
    /** 当前枪械节点上的 Spine 组件。 */
    private gunSkeleton: sp.Skeleton = null;
    /** 枪械 Spine 的 kaihuo 骨骼，作为子弹实际生成位置。 */
    private shootBone: any = null;
    /** 角色 Spine 的 G 骨骼，枪节点每帧跟随它的位置。 */
    private gunSocketBone: any = null;
    /** 用于手部跟随的显示节点与对应的枪械骨骼。 */
    private rightHandNode: Node = null;
    private leftHandNode: Node = null;
    private rightHandBone: any = null;
    private leftHandBone: any = null;
    /** 当前枪械动画名，避免重复设置待机动画。 */
    private curGunAnimName = '';
    /** 是否存在锁定目标；决定子弹按目标方向还是枪口朝向飞行。 */
    private hasAimTarget = false;
    /** 瞄准和弹道计算复用的临时坐标，避免运行时频繁创建 Vec3。 */
    private tempRoleWorldPos = new Vec3();
    private tempGunWorldPos = new Vec3();
    private tempShootRootWorldPos = new Vec3();
    private tempTargetWorldPos = new Vec3();
    private tempTargetWorldScale = new Vec3();
    private tempBulletSpawnWorldPos = new Vec3();
    private tempBulletWorldDirection = new Vec3();
    private tempBulletLocalPos = new Vec3();
    private tempBulletLocalDirection = new Vec3();
    private tempBulletDirectionEndWorldPos = new Vec3();
    private tempBulletDirectionEndLocalPos = new Vec3();
    private tempHandBoneMatrix = new Mat4();

    /** 缓存枪械 Spine 与手部节点。 */
    protected onLoad(): void {
        this.gunSkeleton = this.getComponent(sp.Skeleton);
        this.rightHandNode = this.node.getChildByName('right');
        this.leftHandNode = this.node.getChildByName('left');
        if (this.rightHandNode) this.rightHandNode.active = true;
        if (this.leftHandNode) this.leftHandNode.active = true;
        this.currentAmmo = this.bulletNum;
    }

    /** 当前弹夹中的剩余子弹数。 */
    get ammo() {
        return this.currentAmmo;
    }

    /** 当前是否正在换弹。 */
    get reloading() {
        return this.isReloading;
    }

    /**
     * 将枪械绑定到角色 Spine 的 G 挂点。
     * @returns 是否成功找到挂点骨骼。
     */
    bindToRole(roleAnim: sp.Skeleton) {
        this.roleAnim = roleAnim;
        this.gunSocketBone = this.roleAnim?.findBone('G') ?? null;
        if (!this.gunSocketBone) return false;
        this.syncToRoleSocket();
        return true;
    }

    /** 在角色 Spine 更新完成后同步枪械位置。 */
    protected lateUpdate(): void {
        this.syncToRoleSocket();
        // this.syncHandsToGunBones();
    }

    /** 仅同步挂点位置，保留瞄准产生的旋转和水平翻转。 */
    private syncToRoleSocket() {
        if (this.gunSocketBone) this.node.setPosition(this.gunSocketBone.worldX, this.gunSocketBone.worldY, 0);
    }

    /** 根据水平方向同步翻转角色显示和枪械显示。 */
    setFacingByHorizontal(directionX: number) {
        if (directionX === 0) return;
        const facingRight = directionX > 0;
        if (this.roleAnim?.node) this.roleAnim.node.setScale((facingRight ? -1 : 1) * Math.abs(this.roleAnim.node.scale.x), this.roleAnim.node.scale.y, this.roleAnim.node.scale.z);
        this.node.setScale((facingRight ? -1 : 1) * Math.abs(this.node.scale.x), this.node.scale.y, this.node.scale.z);
    }

    /**
     * 瞄准目标身体中部，并记录目标点供子弹弹道使用。
     * @returns 目标有效且完成瞄准时返回 true。
     */
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
        this.node.getWorldPosition(this.tempGunWorldPos);
        const baseAngle = Math.atan2(this.tempTargetWorldPos.y - this.tempGunWorldPos.y, Math.abs(this.tempTargetWorldPos.x - this.tempGunWorldPos.x)) * 180 / Math.PI;
        this.node.angle = Math.max(-90, Math.min(90, offsetX >= 0 ? baseAngle : -baseAngle));
        return true;
    }

    /** 解除目标锁定；后续子弹沿当前枪口方向飞行。 */
    clearAimTarget() { this.hasAimTarget = false; }

    /**
     * 从枪口取出子弹并初始化直线飞行。
     * @param bulletParent 子弹加入的 UI/游戏父节点。
     */
    fireBullet(bulletParent: Node) {
        // 弹夹打空时自动开始换弹；换弹期间的所有开火请求均无效。
        if (this.isReloading) return false;
        if (this.currentAmmo <= 0) {
            this.reload();
            return false;
        }
        if (!bulletParent || !uiMgr.bulletPrefab || !this.getShootData(this.tempBulletSpawnWorldPos, this.tempBulletWorldDirection)) return false;
        const bulletNode = poolMgr.getBulletNode(uiMgr.bulletPrefab);
        bulletParent.addChild(bulletNode);
        const parentTransform = bulletParent.getComponent(UITransform);
        if (parentTransform) {
            parentTransform.convertToNodeSpaceAR(this.tempBulletSpawnWorldPos, this.tempBulletLocalPos);
            this.tempBulletDirectionEndWorldPos.set(this.tempBulletSpawnWorldPos.x + this.tempBulletWorldDirection.x, this.tempBulletSpawnWorldPos.y + this.tempBulletWorldDirection.y, this.tempBulletSpawnWorldPos.z);
            parentTransform.convertToNodeSpaceAR(this.tempBulletDirectionEndWorldPos, this.tempBulletDirectionEndLocalPos);
            this.tempBulletLocalDirection.set(this.tempBulletDirectionEndLocalPos.x - this.tempBulletLocalPos.x, this.tempBulletDirectionEndLocalPos.y - this.tempBulletLocalPos.y, 0);
            bulletNode.setPosition(this.tempBulletLocalPos);
        } else {
            bulletNode.setWorldPosition(this.tempBulletSpawnWorldPos);
            this.tempBulletLocalDirection.set(this.tempBulletWorldDirection);
        }
        const bulletComp = bulletNode.getComponent(bulletController);
        if (!bulletComp) { poolMgr.putBulletNode(bulletNode); return false; }
        bulletComp.initStraight(this.tempBulletLocalDirection);
        this.currentAmmo--;
        if (this.currentAmmo <= 0) {
            // 保留最后一发的开火动画，动画结束后再接换弹动画。
            this.playShootAnim(true);
            this.startReload(true);
        } else {
            this.playShootAnim();
        }
        return true;
    }

    /**
     * 开始换弹。换弹动画播放完成后，弹夹恢复为满弹状态。
     * 外部可调用此方法主动换弹；弹夹已满或正在换弹时不会重复执行。
     * @returns 是否实际开始了本次换弹。
     */
    reload() {
        return this.startReload(false);
    }

    /** 启动换弹流程；最后一发自动换弹时可选择追加到当前开火动画之后。 */
    private startReload(afterCurrentAnimation: boolean) {
        if (this.isReloading || this.currentAmmo >= this.bulletNum) return false;
        this.isReloading = true;
        const reloadEntry = afterCurrentAnimation ? this.queueReloadAnim() : this.playReloadAnim();
        if (reloadEntry && this.gunSkeleton) {
            this.gunSkeleton.setTrackCompleteListener(reloadEntry, () => this.finishReload());
        } else {
            // 没有可播放的换弹动画时立即完成，避免枪械永久处于换弹锁定。
            this.finishReload();
        }
        return true;
    }

    /** 完成换弹，恢复满弹并回到待机动画。 */
    private finishReload() {
        this.currentAmmo = this.bulletNum;
        this.isReloading = false;
        this.playIdleAnim();
    }

    /** 获取实际枪口的世界坐标，以及归一化后的世界发射方向。 */
    private getShootData(outPosition: Vec3, outDirection: Vec3) {
        if (!this.gunSkeleton) return false;
        this.shootBone ??= this.gunSkeleton.findBone('kaihuo');
        if (!this.shootBone) return false;
        this.node.updateWorldTransform();
        this.tempShootRootWorldPos.set(this.shootBone.worldX, this.shootBone.worldY, 0);
        Vec3.transformMat4(this.tempShootRootWorldPos, this.tempShootRootWorldPos, this.node.worldMatrix);
        let directionX: number;
        let directionY: number;
        if (this.hasAimTarget) {
            directionX = this.tempTargetWorldPos.x - this.tempShootRootWorldPos.x;
            directionY = this.tempTargetWorldPos.y - this.tempShootRootWorldPos.y;
        } else {
            this.node.getWorldPosition(this.tempGunWorldPos);
            directionX = this.tempShootRootWorldPos.x - this.tempGunWorldPos.x;
            directionY = this.tempShootRootWorldPos.y - this.tempGunWorldPos.y;
        }
        const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionLength <= 0) return false;
        outPosition.set(this.tempShootRootWorldPos);
        outDirection.set(directionX / directionLength, directionY / directionLength, 0);
        return true;
    }

    /** 播放循环待机动画。 */
    playIdleAnim() {
        if (!this.gunSkeleton?.skeletonData || this.curGunAnimName === gunAnimName.idle) return;
        this.curGunAnimName = gunAnimName.idle;
        this.gunSkeleton.setAnimation(0, gunAnimName.idle, true);
    }

    /**
     * 播放一次开火动画。
     * @param reloadAfter 是否在本次开火动画结束后衔接换弹动画。
     */
    private playShootAnim(reloadAfter = false) {
        if (!this.gunSkeleton?.skeletonData) return;
        this.curGunAnimName = gunAnimName.attack;
        this.gunSkeleton.setAnimation(0, gunAnimName.attack, false);
        if (!reloadAfter) {
            this.gunSkeleton.addAnimation(0, gunAnimName.idle, true, 0);
            this.curGunAnimName = gunAnimName.idle;
        }
    }

    /** 播放一次换弹动画，并返回其动画轨道以监听播放完成事件。 */
    private playReloadAnim() {
        if (!this.gunSkeleton?.skeletonData) return null;
        this.curGunAnimName = gunAnimName.reload;
        return this.gunSkeleton.setAnimation(0, gunAnimName.reload, false);
    }

    /** 将换弹动画追加到当前动画队列末尾，用于最后一发射出后的自动换弹。 */
    private queueReloadAnim() {
        if (!this.gunSkeleton?.skeletonData) return null;
        this.curGunAnimName = gunAnimName.reload;
        return this.gunSkeleton.addAnimation(0, gunAnimName.reload, false, 0);
    }

    /** 按枪械 Spine 骨骼的完整二维变换同步手部节点。当前按需启用。 */
    private syncHandsToGunBones() {
        if (!this.rightHandBone || !this.leftHandBone) if (!this.bindHandsToGunBones()) return;
        this.syncNodeToBone2D(this.rightHandNode, this.rightHandBone);
        this.syncNodeToBone2D(this.leftHandNode, this.leftHandBone);
    }

    /** 缓存左右手骨骼，并关闭 Spine Socket 对手部节点的覆盖。 */
    private bindHandsToGunBones() {
        if (!this.gunSkeleton?.skeletonData || !this.rightHandNode || !this.leftHandNode) return false;
        this.gunSkeleton.sockets = [];
        this.rightHandBone = this.gunSkeleton.findBone('youshou');
        this.leftHandBone = this.gunSkeleton.findBone('zuoshou');
        return !!this.rightHandBone && !!this.leftHandBone;
    }

    /** 将 Spine 的二维仿射矩阵转换为 Creator 节点变换。 */
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
