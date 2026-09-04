import { _decorator, Component, Label, Node, sp } from 'cc';
import { enemyMgr } from '../../manager/enemyManager';
import { UIGame } from '../../UIPage/UIGame';
import { configData, playerCommonConfig } from '../../manager/configData';
import { enemyBaseController } from '../enemy/enemyBaseController';
import { gunController } from '../gunController';
const { ccclass } = _decorator;

export enum roleAnimName {
    idle = 'idle',
    move = 'move',
    /**使用技能1 */
    useSkill1 = 'skill1',
    /**使用技能2 */
    useSkill2 = 'useSkill2',
}

export enum roleType {
    /**突进 */
    advance = 'advance',
    /**治疗 */
    heal = 'heal',
    /**肉盾 */
    shield = 'shield',
    /**功能 */
    function = 'function',
}

/** 角色战斗状态。 */
export enum roleBattleState {
    /**非战斗状态 */
    nonCombat = 'nonCombat',
    /**战斗状态 */
    combat = 'combat',
}

@ccclass('roleController')
export class roleController extends Component {
    /**角色当前游戏内 id */
    roleId = 0;
    /**角色皮肤 id */
    skinId = 0;
    /**当前移速 */
    moveSpeed = 0;
    /**游戏界面脚本 */
    gameComp: UIGame = null;
    /**角色当前播放的动画名 */
    protected curRoleAnimName = '';

    /**角色类型 */
    roleType: roleType = roleType.advance;
    /** 角色本体 Spine。 */
    roleAnim: sp.Skeleton = null;
    /** 角色头顶名称文本。 */
    roleNameLab: Label = null;
    /** 枪节点上的枪械控制器。 */
    private gunComp: gunController = null;
    /**当前战斗状态。 */
    private battleState: roleBattleState = roleBattleState.nonCombat;
    /**战斗状态剩余时间，攻击松开或成功开火时刷新。 */
    private combatRemainTime = 0;
    /**是否正在按住攻击键。按住期间保持战斗状态，但不逐帧刷新计时。 */
    private isAttackHeld = false;

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

    /**当前是否处于战斗状态。 */
    get isInCombat() {
        return this.battleState === roleBattleState.combat;
    }

    /**当前战斗状态。 */
    get currentBattleState() {
        return this.battleState;
    }

    /**进入或刷新战斗状态。 */
    refreshCombatState() {
        const isEnterCombat = this.battleState === roleBattleState.nonCombat;
        this.battleState = roleBattleState.combat;
        this.combatRemainTime = Math.max(0, playerCommonConfig.gunResetTime);
        if (isEnterCombat) this.gunComp?.stopResetRotationTween();
    }

    /**设置攻击键是否按住；松开后才开始退出战斗的倒计时。 */
    setAttackHeld(isHeld: boolean) {
        if (this.isAttackHeld === isHeld) return;
        this.isAttackHeld = isHeld;
        if (isHeld) {
            this.refreshCombatState();
        } else if (this.battleState === roleBattleState.combat) {
            this.combatRemainTime = Math.max(0, playerCommonConfig.gunResetTime);
        }
    }

    protected update(dt: number): void {
        this.updateBattleState(dt);
    }

    /**更新战斗状态；超时后将枪口复位。 */
    private updateBattleState(dt: number) {
        if (this.battleState !== roleBattleState.combat || this.isAttackHeld) return;
        this.combatRemainTime -= dt;
        if (this.combatRemainTime > 0) return;

        this.combatRemainTime = 0;
        this.battleState = roleBattleState.nonCombat;
        this.gunComp?.resetRotation();
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
        this.moveSpeed = configData.moveSpeed;
        this.refreshRoleSpine();
        if (this.roleNameLab) this.roleNameLab.string = this.roleId === 0 ? '你' : (nickname || `人机${this.roleId}`);
    }

    /** 刷新角色初始状态，同时通知枪械重新绑定角色挂点。 */
    private async refreshRoleSpine() {
        this.curRoleAnimName = '';
        this.gunComp?.bindToRole(this.roleAnim);
        this.gunComp?.resetRotation(true);
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
        const isFired = this.gunComp?.fireBullet(this.gameComp?.gameUINode) ?? false;
        if (isFired) this.refreshCombatState();
        return isFired;
    }

    /** 播放角色本体 Spine 动画。 */
    playRoleAnim(animName: string, loop = true) {
        if (!this.roleAnim || !this.roleAnim.skeletonData || this.curRoleAnimName === animName) return;
        this.curRoleAnimName = animName;
        this.roleAnim.setAnimation(0, animName, loop);
    }

    /** 使用技能1 */
    useSkill1() { return false; }

    /**技能是否正在锁定移动方向。 */
    get isMoveDirectionLocked() { return false; }

    /** 使用技能2 */
    useSkill2() {
        
    }
}
