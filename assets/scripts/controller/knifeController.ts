import { _decorator, Node, Vec3 } from 'cc';
import { enemyMgr } from '../manager/enemyManager';
import { weaponsAnimName, weaponsController } from './weaponsController';
const { ccclass, property } = _decorator;

/**
 * 近战刀控制器。
 *
 * 刀和枪共用武器的挂点同步、翻转、瞄准及基础属性逻辑；
 * 刀专属的攻击行为后续在此类中实现，避免与枪械逻辑耦合。
 */
@ccclass('knifeController')
export class knifeController extends weaponsController {
    /** 刀待机时相对水平线的角度绝对值；左右朝向会自动取相反符号。 */
    @property({ tooltip: '刀的默认角度（绝对值）' })
    defaultAngle = 10;

    /**自动攻击时根据最近敌人的方向改变人物朝向，刀保持默认角度。 */
    aimAt(target: Node) {
        if (!target?.isValid) return false;

        this.clearAimTarget();
        const originNode = this.roleAnim?.node ?? this.node.parent;
        if (!originNode) return false;

        originNode.getWorldPosition(this.tempRoleWorldPos);
        target.getWorldPosition(this.tempTargetWorldPos);
        this.setFacingByHorizontal(this.tempTargetWorldPos.x - this.tempRoleWorldPos.x);
        this.resetRotation(true);
        // 返回 true，攻击期间人物朝向不会被移动方向覆盖。
        return true;
    }

    /**持刀手动瞄准时只改变人物朝向，不旋转刀去指向目标。 */
    aimInDirection(direction: Vec3) {
        if (direction.x === 0 && direction.y === 0) return false;
        this.clearAimTarget();
        this.setFacingByHorizontal(direction.x);
        this.resetRotation(true);
        // 返回 true，使移动期间的人物朝向继续由攻击摇杆控制。
        return true;
    }

    /**
     * 攻击当前朝向前方 180° 扇形内的所有敌人。
     * 范围半径和伤害分别使用 weapons 表的 attackRange、attack；不消耗弹药。
     */
    attackInFacingDirection() {
        const originNode = this.roleAnim?.node ?? this.node.parent;
        if (!originNode) return false;

        this.playAttackAnim();
        originNode.updateWorldTransform();
        originNode.getWorldPosition(this.tempRoleWorldPos);
        const rangeSquared = this.attackRange ** 2;
        // 以角色本体的当前朝向作为扇形正前方，而非武器节点自身的缩放状态。
        const facingX = this.roleAnim?.node?.scale.x < 0 ? 1 : -1;
        for (const enemy of enemyMgr.enemyArr) {
            if (!enemy?.node?.isValid || !enemy.node.activeInHierarchy || enemy.hp <= 0) continue;
            enemy.node.getWorldPosition(this.tempTargetWorldPos);
            const offsetX = this.tempTargetWorldPos.x - this.tempRoleWorldPos.x;
            const offsetY = this.tempTargetWorldPos.y - this.tempRoleWorldPos.y;
            const distanceSquared = offsetX * offsetX + offsetY * offsetY;
            if (distanceSquared > rangeSquared || offsetX * facingX < 0) continue;
            enemy.takeDamage(this.attack);
        }
        return true;
    }

    /** 播放一次攻击动画，结束后回到待机动画。 */
    private playAttackAnim() {
        if (!this.weaponSkeleton?.skeletonData) return;
        this.curWeaponAnimName = weaponsAnimName.attack;
        this.weaponSkeleton.setAnimation(0, weaponsAnimName.attack, false);
        this.weaponSkeleton.addAnimation(0, weaponsAnimName.idle, true, 0);
        this.curWeaponAnimName = weaponsAnimName.idle;
    }

    /** 使用配置的刀默认角度，并随角色左右朝向镜像。 */
    protected getDefaultAngle(): number {
        const angle = Math.abs(this.defaultAngle);
        return this.node.scale.x < 0 ? angle : -angle;
    }
}
