import { _decorator, Component, Label, Node, sp, Vec3 } from 'cc';
import { ccTools } from '../extention/generalTools';
import type { UIGame } from '../UIPage/UIGame';
import { spinePath, UIPath } from '../manager/pathConfig';
const { ccclass, property } = _decorator;

export enum roleState {
    /**正常 */
    normal = 0,
    /**床上 */
    bed = 1,
    /**死亡 */
    dead = 2,
}

export enum roleAnimName {
    /**静止 */
    idle = "idle",
    /**移动 */
    move = "move",
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

    ///
    ///节点
    ///
    /**角色spine节点 */
    roleAnim: sp.Skeleton = null;
    /**角色名称 */
    roleNameLab: Label = null;
    /**挂在 Spine bone16 挂点上的枪节点 */
    private gunNode: Node = null;
    /**枪口发射点 */
    private shootRoot: Node = null;
    /**Spine 中路径为 root/.../g/bone16 的挂点骨骼 */
    private gunSocketBone: any = null;
    /**瞄准计算用的临时世界坐标 */
    private tempRoleWorldPos = new Vec3();
    private tempGunWorldPos = new Vec3();
    private tempShootRootWorldPos = new Vec3();
    private tempTargetWorldPos = new Vec3();

    protected onLoad(): void {
        this.roleAnim = this.node.getChildByName("roleAnim").getComponent(sp.Skeleton);
        this.roleNameLab = this.node.getChildByName("roleNameLab").getComponent(Label);
        this.gunNode = this.node.getChildByName("gun");
        this.shootRoot = this.gunNode?.getChildByName("shootRoot");
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
        // this.bindGunToSocket();
        this.playRoleAnim(roleAnimName.idle, true);
    }

    /**将 roleAnim 下的 gun 节点绑定到 Spine 的 bone16 挂点，仅跟随位置 */
    bindGunToSocket() {
        this.gunSocketBone = this.roleAnim?.findBone("g") ?? null;

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

        this.node.getWorldPosition(this.tempRoleWorldPos);
        target.getWorldPosition(this.tempTargetWorldPos);
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

    /**获取枪口世界坐标及枪管当前指向，用于生成不锁定目标的子弹 */
    getGunShootData(outPosition: Vec3, outDirection: Vec3) {
        if (!this.gunNode || !this.shootRoot) {
            return false;
        }

        // 当前帧刚调整过枪角度时，主动刷新变换后再读取枪口位置。
        this.gunNode.updateWorldTransform();
        this.shootRoot.updateWorldTransform();
        this.gunNode.getWorldPosition(this.tempGunWorldPos);
        this.shootRoot.getWorldPosition(this.tempShootRootWorldPos);

        const directionX = this.tempShootRootWorldPos.x - this.tempGunWorldPos.x;
        const directionY = this.tempShootRootWorldPos.y - this.tempGunWorldPos.y;
        const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionLength <= 0) {
            return false;
        }

        outPosition.set(this.tempShootRootWorldPos);
        outDirection.set(directionX / directionLength, directionY / directionLength, 0);
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
}
