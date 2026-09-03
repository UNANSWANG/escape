import { _decorator, Component, Label, Mat4, Node, sp, UITransform, Vec3 } from 'cc';
import { ccTools } from '../extention/generalTools';
import type { UIGame } from '../UIPage/UIGame';
import { spinePath, UIPath } from '../manager/pathConfig';
import { bulletController } from './bulletController';
import { gunController } from './gunController';
import { uiMgr } from '../manager/UIManager';
import { poolMgr } from '../manager/poolManager';
import { enemyMgr } from '../manager/enemyManager';
import { enemyBaseController } from './enemy/enemyBaseController';
const { ccclass, property } = _decorator;

export enum roleAnimName {
    /**静止 */
    idle = "idle",
    /**移动 */
    move = "move",
}

export enum gunAnimName {
    /**静止 */
    idle = "idle",
    /**开枪 */
    attack = "attack_ak",
    /**换弹 */
    reload = "reload",
}

@ccclass('roleController')
export class roleController extends Component {
    /**角色当前游戏内id */
    roleId: number = 0;
    /**角色皮肤id */
    skinId: number = 0;
    /**游戏脚本 */
    gameComp: UIGame = null;
    /**当前播放的角色动画名称 */
    private curRoleAnimName: string = "";
    /**当前播放的枪械动画名称 */
    private curGunAnimName: string = "";

    ///
    ///节点
    ///
    /**角色spine节点 */
    roleAnim: sp.Skeleton = null;
    /**角色名称 */
    roleNameLab: Label = null;
    /**挂在 Spine bone16 挂点上的枪节点 */
    private gunNode: Node = null;
    /**枪械配置与行为组件 */
    private gunComp: gunController = null;
    /**枪械 Spine，用于手部节点的手动跟随 */
    private gunSkeleton: sp.Skeleton = null;
    /**枪口发射点骨骼 */
    private shootBone: any = null;
    /**右手显示节点 */
    private rightHandNode: Node = null;
    /**左手显示节点 */
    private leftHandNode: Node = null;
    /**Spine 中路径为 root/.../g/bone16 的挂点骨骼 */
    private gunSocketBone: any = null;
    /**瞄准计算用的临时世界坐标 */
    private tempRoleWorldPos = new Vec3();
    private tempGunWorldPos = new Vec3();
    private tempShootRootWorldPos = new Vec3();
    private tempTargetWorldPos = new Vec3();
    private tempTargetWorldScale = new Vec3();
    /**子弹发射点世界坐标 */
    private tempBulletSpawnWorldPos = new Vec3();
    /**子弹世界飞行方向 */
    private tempBulletWorldDirection = new Vec3();
    /**子弹父节点本地坐标 */
    private tempBulletLocalPos = new Vec3();
    /**子弹父节点本地飞行方向 */
    private tempBulletLocalDirection = new Vec3();
    /**换算子弹方向时使用的世界终点 */
    private tempBulletDirectionEndWorldPos = new Vec3();
    /**换算子弹方向时使用的本地终点 */
    private tempBulletDirectionEndLocalPos = new Vec3();
    /**最近一次瞄准的目标世界坐标，用于从实际枪口计算弹道。 */
    private hasGunAimTarget = false;
    /**手部骨骼同步使用的二维变换矩阵 */
    private tempHandBoneMatrix = new Mat4();
    /**枪械 Spine 中的右手、左手骨骼 */
    private rightHandBone: any = null;
    private leftHandBone: any = null;

    protected onLoad(): void {
        this.roleAnim = this.node.getChildByName("roleAnim").getComponent(sp.Skeleton);
        this.roleNameLab = this.node.getChildByName("roleNameLab").getComponent(Label);
        this.gunNode = this.node.getChildByName("gun");
        this.gunComp = this.gunNode?.getComponent(gunController);
        this.gunSkeleton = this.gunNode?.getComponent(sp.Skeleton);
        this.rightHandNode = this.gunNode?.getChildByName("right");
        this.leftHandNode = this.gunNode?.getChildByName("left");

        this.rightHandNode.active = true;
        this.leftHandNode.active = true;
    }

    /**当前装备的枪械组件 */
    get gunController() {
        return this.gunComp;
    }

    /**查找当前枪械自动攻击范围内最近的有效敌人 */
    findNearestEnemyInAutoAttackRange() {
        if (!this.gunComp) {
            return null;
        }

        const rolePos = this.node.position;
        const range = this.gunComp.autoAttackRange;
        const rangeSquared = range * range;
        let nearestEnemy: enemyBaseController = null;
        let nearestDistanceSquared = rangeSquared;

        for (const enemy of enemyMgr.enemyArr) {
            if (!enemy || !enemy.node?.isValid || !enemy.node.activeInHierarchy || enemy.hp <= 0) {
                continue;
            }

            const enemyPos = enemy.node.position;
            const offsetX = enemyPos.x - rolePos.x;
            const offsetY = enemyPos.y - rolePos.y;
            const distanceSquared = offsetX * offsetX + offsetY * offsetY;
            if (distanceSquared <= nearestDistanceSquared) {
                nearestEnemy = enemy;
                nearestDistanceSquared = distanceSquared;
            }
        }

        return nearestEnemy;
    }

    init(comp: UIGame, id: number, skinId: number, nickname = "") {
        this.gameComp = comp;
        this.roleId = id;
        this.skinId = skinId;
        this.refreshRoleSpine();

        if (this.roleId == 0) {
            this.roleNameLab.string = `你`
        } else {
            this.roleNameLab.string = nickname || `人机${this.roleId}`
        }
    }

    /**根据皮肤id刷新角色spine */
    private async refreshRoleSpine() {
        // if (this.roleAnim) {
        //     this.roleAnim.skeletonData = null;
        // }

        // let isLoaded = await ccTools.loadSpine(this.roleAnim, spinePath.role + this.skinId);
        // if (!isLoaded) {
        //     return;
        // }

        this.curRoleAnimName = "";
        this.curGunAnimName = "";
        this.bindGunToSocket();
        this.playRoleAnim(roleAnimName.idle, true);
        this.playGunAnim(gunAnimName.idle, true);
    }

    /**将 roleAnim 下的 gun 节点绑定到 Spine 的 bone16 挂点，仅跟随位置 */
    bindGunToSocket() {
        this.gunSocketBone = this.roleAnim?.findBone("G") ?? null;

        if (!this.gunNode || !this.gunSocketBone) {
            console.warn("绑定枪械挂点失败：请确认 roleAnim/gun 节点和 Spine 的 bone16 挂点存在");
            return false;
        }

        this.syncGunToSocket();
        return true;
    }

    /**同步 gun 到 bone16 挂点的位置，不改变 gun 自身旋转和缩放 */
    private syncGunToSocket() {
        if (!this.gunNode || !this.gunSocketBone) {
            return;
        }

        const bone = this.gunSocketBone;
        this.gunNode.setPosition(bone.worldX, bone.worldY, 0);
    }

    protected lateUpdate(): void {
        this.syncGunToSocket();
        // this.syncHandsToGunBones();
    }

    /**手部节点不使用 Socket 覆盖，改由脚本按骨骼完整变换矩阵跟随。 */
    private syncHandsToGunBones() {
        if (!this.rightHandBone || !this.leftHandBone) {
            if (!this.bindHandsToGunBones()) {
                return;
            }
        }

        this.syncNodeToBone2D(this.rightHandNode, this.rightHandBone);
        this.syncNodeToBone2D(this.leftHandNode, this.leftHandBone);
    }

    /**绑定枪械 Spine 中的手部骨骼，并关闭原有 Socket 覆盖 */
    private bindHandsToGunBones() {
        if (!this.gunSkeleton?.skeletonData || !this.rightHandNode || !this.leftHandNode) {
            return false;
        }

        // Socket 会每帧写入完整变换矩阵；改由本脚本使用相同的二维矩阵同步。
        this.gunSkeleton.sockets = [];
        this.rightHandBone = this.gunSkeleton.findBone("youshou");
        this.leftHandBone = this.gunSkeleton.findBone("zuoshou");
        return !!this.rightHandBone && !!this.leftHandBone;
    }

    /**
     * 使用 Spine 的世界二维仿射矩阵同步手部。
     * Spine: x' = a * x + b * y + worldX，y' = c * x + d * y + worldY。
     * 因此映射到 Creator Mat4 时，第一列必须是 (a, c)，第二列必须是 (b, d)。
     */
    private syncNodeToBone2D(node: Node, bone: any) {
        if (!node || !bone) {
            return;
        }

        const matrix = this.tempHandBoneMatrix;
        // 清除上一帧可能遗留的 3D 分量，再写入当前骨骼的完整 2D 变换。
        Mat4.identity(matrix);
        matrix.m00 = bone.a;
        matrix.m01 = bone.c;
        matrix.m04 = bone.b;
        matrix.m05 = bone.d;
        matrix.m12 = bone.worldX;
        matrix.m13 = bone.worldY;
        node.matrix = matrix;

        // Node.matrix 会将二维仿射矩阵分解为 3D SRT。骨骼存在镜像或剪切时，
        // 分解结果可能混入 X/Y 轴旋转；保留其已同步的位置和缩放，仅重设为 Z 轴旋转。
        node.setRotationFromEuler(0, 0, node.eulerAngles.z);
    }

    /**按水平方向翻转人物和枪；当前资源未翻转时均朝左 */
    setFacingByHorizontal(directionX: number) {
        if (directionX === 0) {
            return;
        }

        const facingRight = directionX > 0;
        if (this.roleAnim?.node) {
            this.roleAnim.node.setScale(
                (facingRight ? -1 : 1) * Math.abs(this.roleAnim.node.scale.x),
                this.roleAnim.node.scale.y,
                this.roleAnim.node.scale.z,
            );
        }
        if (this.gunNode) {
            this.gunNode.setScale(
                (facingRight ? -1 : 1) * Math.abs(this.gunNode.scale.x),
                this.gunNode.scale.y,
                this.gunNode.scale.z,
            );
        }
    }

    /**瞄准目标：角色仅左右翻转，枪口在当前半边内旋转 */
    aimGunAt(target: Node) {
        if (!target || !target.isValid) {
            return false;
        }

        //目标点暂存世界坐标
        target.getWorldPosition(this.tempTargetWorldPos);
        // 敌人根节点位于脚底；将瞄准点提升到角色显示区域的中部。
        const targetBody = target.getChildByName("roleAnim") || target;
        const targetHeight = targetBody.getComponent(UITransform)?.height || 0;
        targetBody.getWorldScale(this.tempTargetWorldScale);
        this.tempTargetWorldPos.y += targetHeight * Math.abs(this.tempTargetWorldScale.y) * 0.5;
        this.hasGunAimTarget = true;

        this.node.getWorldPosition(this.tempRoleWorldPos);
        const offsetX = this.tempTargetWorldPos.x - this.tempRoleWorldPos.x;
        const offsetY = this.tempTargetWorldPos.y - this.tempRoleWorldPos.y;
        this.setFacingByHorizontal(offsetX || 1);

        if (!this.gunNode) {
            return false;
        }

        // 以枪节点实际位置计算，避免挂点偏移造成瞄准误差。
        this.gunNode.getWorldPosition(this.tempGunWorldPos);
        const gunOffsetX = this.tempTargetWorldPos.x - this.tempGunWorldPos.x;
        const gunOffsetY = this.tempTargetWorldPos.y - this.tempGunWorldPos.y;
        // 玩家在敌人左侧时枪节点已翻转朝右，正角度正确；在敌人右侧时需镜像角度。
        const baseAngle = Math.atan2(gunOffsetY, Math.abs(gunOffsetX)) * 180 / Math.PI;
        const angle = offsetX >= 0 ? baseAngle : -baseAngle;
        this.gunNode.angle = Math.max(-90, Math.min(90, angle));
        return true;
    }

    /**清除锁定目标；之后发射的子弹会沿当前枪口朝向飞行。 */
    clearGunAimTarget() {
        this.hasGunAimTarget = false;
    }

    /**获取 kaihuo 骨骼的世界坐标及枪口方向，用于生成不锁定目标的子弹 */
    getGunShootData(outPosition: Vec3, outDirection: Vec3) {
        if (!this.gunNode || !this.gunSkeleton) {
            return false;
        }

        // SkeletonData 可能在 onLoad 后才完成赋值，因此延迟获取骨骼。
        this.shootBone ??= this.gunSkeleton.findBone("kaihuo");
        if (!this.shootBone) {
            return false;
        }

        // 当前帧刚调整过枪角度时，主动刷新枪节点世界变换。
        this.gunNode.updateWorldTransform();
        const gunWorldMatrix = this.gunNode.worldMatrix;
        this.tempShootRootWorldPos.set(this.shootBone.worldX, this.shootBone.worldY, 0);
        Vec3.transformMat4(this.tempShootRootWorldPos, this.tempShootRootWorldPos, gunWorldMatrix);

        // 枪口位置改变后，方向也必须从实际枪口指向目标，弹道才能经过目标位置。
        // 没有目标时，则沿当前枪口朝向发射。
        let directionX: number;
        let directionY: number;
        if (this.hasGunAimTarget) {
            directionX = this.tempTargetWorldPos.x - this.tempShootRootWorldPos.x;
            directionY = this.tempTargetWorldPos.y - this.tempShootRootWorldPos.y;
        } else {
            this.gunNode.getWorldPosition(this.tempGunWorldPos);
            directionX = this.tempShootRootWorldPos.x - this.tempGunWorldPos.x;
            directionY = this.tempShootRootWorldPos.y - this.tempGunWorldPos.y;
        }
        const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionLength <= 0) {
            return false;
        }

        outPosition.set(this.tempShootRootWorldPos);
        outDirection.set(directionX / directionLength, directionY / directionLength, 0);
        return true;
    }

    /**从枪口发射一颗固定方向飞行、不锁定目标的子弹。 */
    fireBullet() {
        const bulletParent = this.gameComp?.gameUINode;
        if (!bulletParent || !uiMgr.bulletPrefab ||
            !this.getGunShootData(this.tempBulletSpawnWorldPos, this.tempBulletWorldDirection)) {
            return false;
        }

        const bulletNode = poolMgr.getBulletNode(uiMgr.bulletPrefab);
        bulletParent.addChild(bulletNode);

        const parentTransform = bulletParent.getComponent(UITransform);
        if (parentTransform) {
            parentTransform.convertToNodeSpaceAR(this.tempBulletSpawnWorldPos, this.tempBulletLocalPos);
            this.tempBulletDirectionEndWorldPos.set(
                this.tempBulletSpawnWorldPos.x + this.tempBulletWorldDirection.x,
                this.tempBulletSpawnWorldPos.y + this.tempBulletWorldDirection.y,
                this.tempBulletSpawnWorldPos.z,
            );
            parentTransform.convertToNodeSpaceAR(this.tempBulletDirectionEndWorldPos, this.tempBulletDirectionEndLocalPos);
            this.tempBulletLocalDirection.set(
                this.tempBulletDirectionEndLocalPos.x - this.tempBulletLocalPos.x,
                this.tempBulletDirectionEndLocalPos.y - this.tempBulletLocalPos.y,
                0,
            );
            bulletNode.setPosition(this.tempBulletLocalPos);
        } else {
            bulletNode.setWorldPosition(this.tempBulletSpawnWorldPos);
            this.tempBulletLocalDirection.set(this.tempBulletWorldDirection);
        }

        const bulletComp = bulletNode.getComponent(bulletController);
        if (!bulletComp) {
            poolMgr.putBulletNode(bulletNode);
            return false;
        }

        bulletComp.initStraight(this.tempBulletLocalDirection);
        this.playGunShootAnim();
        return true;
    }

    /**播放角色动画 */
    playRoleAnim(animName: string, loop: boolean = true) {
        if (!this.roleAnim || !this.roleAnim.skeletonData || this.curRoleAnimName == animName) {
            return;
        }

        this.curRoleAnimName = animName;
        this.roleAnim.setAnimation(0, animName, loop);
    }

    /**播放枪械动画；待机动画会持续循环。 */
    private playGunAnim(animName: gunAnimName, loop: boolean = true) {
        if (!this.gunSkeleton || !this.gunSkeleton.skeletonData ||
            (loop && this.curGunAnimName === animName)) {
            return;
        }

        this.curGunAnimName = animName;
        this.gunSkeleton.setAnimation(0, animName, loop);
    }

    /**枪械开火：每发子弹播放一次 attack，完成后自动回到 idle。 */
    playGunShootAnim() {
        if (!this.gunSkeleton || !this.gunSkeleton.skeletonData) {
            return;
        }

        // setAnimation 会清除上一发尚未完成的队列，确保每颗子弹都从 attack 起始帧播放。
        this.curGunAnimName = gunAnimName.attack;
        this.gunSkeleton.setAnimation(0, gunAnimName.attack, false);
        this.gunSkeleton.addAnimation(0, gunAnimName.idle, true, 0);
        this.curGunAnimName = gunAnimName.idle;
    }
}
