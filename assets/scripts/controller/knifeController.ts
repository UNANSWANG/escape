import { _decorator, Animation, Node, UITransform, Vec3 } from 'cc';
import { enemyMgr } from '../manager/enemyManager';
import { playerMgr } from '../manager/playerManager';
import { WeaponStats, weaponsAnimName, weaponsController } from './weaponsController';
const { ccclass, property } = _decorator;

/**
 * 近战刀控制器。
 *
 * 刀和枪共用武器的挂点同步、翻转、瞄准及基础属性逻辑；
 * 刀专属的攻击行为后续在此类中实现，避免与枪械逻辑耦合。
 */
@ccclass('knifeController')
export class knifeController extends weaponsController {
    private isAttacking = false;
    private attackAnimationVersion = 0;

    /** 刀待机时相对水平线的角度。 */
    defaultAngle = 0;

    /** 近战武器隐藏 right 节点，left 保持显示。 */
    protected onLoad(): void {
        super.onLoad();
        if (this.rightHandNode) this.rightHandNode.active = false;
        this.hideGunFire();
        this.updateAttackInterval();
    }

    /** 近战攻击间隔由动画决定，不使用表中的攻击间隔。 */
    applyStats(stats: WeaponStats) {
        super.applyStats(stats);
        this.hideGunFire();
        this.updateAttackInterval();
    }

    /** 近战武器复用带枪口火焰的节点时，停止并隐藏已有特效。 */
    private hideGunFire() {
        const gunFire = this.node.getChildByName('gunFire');
        if (!gunFire) return;
        gunFire.getComponent(Animation)?.stop();
        gunFire.active = false;
    }

    private updateAttackInterval() {
        const duration = this.weaponSkeleton?.findAnimation(weaponsAnimName.attack)?.duration ?? 0;
        const timeScale = this.weaponSkeleton?.timeScale ?? 1;
        this.attackInterval = timeScale > 0 ? duration / timeScale : 0;
    }

    protected onDisable(): void {
        this.attackAnimationVersion++;
        this.isAttacking = false;
        this.playIdleAnim();
    }

    /** 攻击动画结束前，不允许外部待机请求打断攻击。 */
    playIdleAnim() {
        if (this.isAttacking) return;
        super.playIdleAnim();
    }

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
        if (!originNode || this.isAttacking) return false;
        return this.playAttackAnim();
    }

    /** 仅在攻击动画的 damage 事件帧，按当前坐标和朝向结算伤害。 */
    private applyAttackDamage(): void {
        const originNode = this.roleAnim?.node ?? this.node.parent;
        if (!originNode) return;
        originNode.updateWorldTransform();
        originNode.getWorldPosition(this.tempRoleWorldPos);
        // 以角色本体的当前朝向作为扇形正前方，而非武器节点自身的缩放状态。
        const facingX = this.roleAnim?.node?.scale.x < 0 ? 1 : -1;
        if (this.targetPlayer) {
            const player = playerMgr.playerComp;
            if (player?.node?.isValid && player.node.activeInHierarchy && player.hp > 0) {
                if (this.intersectsAttackArea(player.hitArea, facingX)) {
                    player.takeDamage(this.attack);
                }
            }
            return;
        }
        for (const enemy of enemyMgr.allEnemies) {
            if (!enemy?.node?.isValid || !enemy.node.activeInHierarchy || enemy.hp <= 0) continue;
            if (!this.intersectsAttackArea(enemy.hitArea, facingX)) continue;
            enemy.takeDamage(this.attack);
        }
        return;
    }

    private intersectsAttackArea(targetTransform: UITransform, facingX: number) {
        if (!targetTransform) return false;
        const bounds = targetTransform.getBoundingBoxToWorld();
        const originX = this.tempRoleWorldPos.x;
        const originY = this.tempRoleWorldPos.y;
        const minX = facingX > 0 ? Math.max(bounds.x, originX) : bounds.x;
        const maxX = facingX < 0 ? Math.min(bounds.x + bounds.width, originX) : bounds.x + bounds.width;
        if (minX > maxX) return false;
        const nearestX = Math.max(minX, Math.min(originX, maxX));
        const nearestY = Math.max(bounds.y, Math.min(originY, bounds.y + bounds.height));
        const offsetX = nearestX - originX;
        const offsetY = nearestY - originY;
        return offsetX * offsetX + offsetY * offsetY <= this.attackRange * this.attackRange;
    }

    /** 攻击动画完整播放后才解锁下一次攻击，并回到待机。 */
    private playAttackAnim(): boolean {
        if (!this.weaponSkeleton?.skeletonData || !this.weaponSkeleton.findAnimation(weaponsAnimName.attack)) return false;
        const entry = this.weaponSkeleton.setAnimation(0, weaponsAnimName.attack, false);
        if (!entry) return false;

        this.updateAttackInterval();
        this.isAttacking = true;
        this.curWeaponAnimName = weaponsAnimName.attack;
        const version = ++this.attackAnimationVersion;
        let damageApplied = false;
        this.weaponSkeleton.setTrackEventListener(entry, (_entry, event) => {
            if (typeof event === 'number') return;
            if (event.data.name !== 'damage' || damageApplied || !this.isValid
                || !this.enabledInHierarchy || !this.isAttacking || version !== this.attackAnimationVersion) return;
            damageApplied = true;
            this.applyAttackDamage();
        });
        this.weaponSkeleton.setTrackCompleteListener(entry, () => {
            if (version !== this.attackAnimationVersion) return;
            this.isAttacking = false;
            this.playIdleAnim();
        });
        return true;
    }

    /** 使用配置的刀默认角度。 */
    protected getDefaultAngle(): number {
        return this.defaultAngle;
    }
}
