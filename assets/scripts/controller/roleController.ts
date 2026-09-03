import { _decorator, Component, Label, Node, sp } from 'cc';
import type { UIGame } from '../UIPage/UIGame';
import { enemyMgr } from '../manager/enemyManager';
import { enemyBaseController } from './enemy/enemyBaseController';
import { gunController } from './gunController';
const { ccclass } = _decorator;

export enum roleAnimName {
    idle = 'idle',
    move = 'move',
}

@ccclass('roleController')
export class roleController extends Component {
    /**角色当前游戏内 id */
    roleId = 0;
    /**角色皮肤 id */
    skinId = 0;
    /**游戏界面脚本 */
    gameComp: UIGame = null;
    /**角色当前播放的动画名 */
    private curRoleAnimName = '';

    /** 角色本体 Spine。 */
    roleAnim: sp.Skeleton = null;
    /** 角色头顶名称文本。 */
    roleNameLab: Label = null;
    /** 枪节点上的枪械控制器。 */
    private gunComp: gunController = null;

    /** 缓存角色自身与子节点组件。 */
    protected onLoad(): void {
        this.roleAnim = this.node.getChildByName('roleAnim')?.getComponent(sp.Skeleton);
        this.roleNameLab = this.node.getChildByName('roleNameLab')?.getComponent(Label);
        this.gunComp = this.node.getChildByName('gun')?.getComponent(gunController);
    }

    /**当前装备的枪械组件 */
    get gunController() {
        return this.gunComp;
    }

    /**查找当前枪械自动攻击范围内最近的有效敌人 */
    findNearestEnemyInAutoAttackRange() {
        if (!this.gunComp) return null;
        const rolePos = this.node.position;
        const rangeSquared = this.gunComp.autoAttackRange ** 2;
        let nearestEnemy: enemyBaseController = null;
        let nearestDistanceSquared = rangeSquared;
        for (const enemy of enemyMgr.enemyArr) {
            if (!enemy || !enemy.node?.isValid || !enemy.node.activeInHierarchy || enemy.hp <= 0) continue;
            const offsetX = enemy.node.position.x - rolePos.x;
            const offsetY = enemy.node.position.y - rolePos.y;
            const distanceSquared = offsetX * offsetX + offsetY * offsetY;
            if (distanceSquared <= nearestDistanceSquared) {
                nearestEnemy = enemy;
                nearestDistanceSquared = distanceSquared;
            }
        }
        return nearestEnemy;
    }

    /** 初始化角色所属界面、身份数据和初始动画。 */
    init(comp: UIGame, id: number, skinId: number, nickname = '') {
        this.gameComp = comp;
        this.roleId = id;
        this.skinId = skinId;
        this.refreshRoleSpine();
        if (this.roleNameLab) this.roleNameLab.string = this.roleId === 0 ? '你' : (nickname || `人机${this.roleId}`);
    }

    /** 刷新角色初始状态，同时通知枪械重新绑定角色挂点。 */
    private async refreshRoleSpine() {
        this.curRoleAnimName = '';
        this.gunComp?.bindToRole(this.roleAnim);
        this.playRoleAnim(roleAnimName.idle, true);
        this.gunComp?.playIdleAnim();
    }

    /**角色朝向仍从角色控制器入口调用，具体人物与枪械翻转由枪械控制器处理。 */
    setFacingByHorizontal(directionX: number) {
        this.gunComp?.setFacingByHorizontal(directionX);
    }

    /** 将瞄准请求转交给当前装备的枪械。 */
    aimGunAt(target: Node) {
        return this.gunComp?.aimAt(target) ?? false;
    }

    /** 清除枪械锁定目标。 */
    clearGunAimTarget() {
        this.gunComp?.clearAimTarget();
    }

    /** 由当前枪械从游戏 UI 节点中生成子弹。 */
    fireBullet() {
        return this.gunComp?.fireBullet(this.gameComp?.gameUINode) ?? false;
    }

    /** 播放角色本体 Spine 动画。 */
    playRoleAnim(animName: string, loop = true) {
        if (!this.roleAnim || !this.roleAnim.skeletonData || this.curRoleAnimName === animName) return;
        this.curRoleAnimName = animName;
        this.roleAnim.setAnimation(0, animName, loop);
    }
}
