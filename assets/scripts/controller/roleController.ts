import { _decorator, Component, Label, Node, sp } from 'cc';
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
    /**枪节点 */
    /**角色名称 */
    roleNameLab: Label = null;
    /**挂在 Spine bone16 挂点上的枪节点 */
    private gunNode: Node = null;
    /**Spine 中路径为 root/.../g/bone16 的挂点骨骼 */
    private gunSocketBone: any = null;

    protected onLoad(): void {
        this.roleAnim = this.node.getChildByName("roleAnim").getComponent(sp.Skeleton);
        this.roleNameLab = this.node.getChildByName("roleNameLab").getComponent(Label);
        this.gunNode = this.node.getChildByName("gun");
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

    /**播放角色动画 */
    playRoleAnim(animName: string, loop: boolean = true) {
        if (!this.roleAnim || !this.roleAnim.skeletonData || this.curRoleAnimName == animName) {
            return;
        }

        this.curRoleAnimName = animName;
        this.roleAnim.setAnimation(0, animName, loop);
    }
}
