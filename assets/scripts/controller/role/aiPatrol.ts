import { UITransform, Vec3 } from 'cc';
import { aiCommonConfig } from '../../manager/configData';
import { gm } from '../../manager/gm';
import { playerMgr } from '../../manager/playerManager';
import { sniperController } from '../sniperController';
import { StaticCollisionMover } from '../staticCollisionMover';
import { roleAnimName } from './roleController';
import type { roleController } from './roleController';

export class AIPatrol {
    private mover = new StaticCollisionMover();
    private path: Vec3[] = [];
    private pathIndex = 0;
    private target = new Vec3();
    private actualMove = new Vec3();
    /** Keep the last AI movement direction while sliding; use facing before the first move. */
    private moveDirection = new Vec3();
    private retryRemaining = 0;
    private stayRemaining = 0;
    private isChasing = false;
    private isAttacking = false;
    private attackCooldown = 0;
    private replanRemaining = 0;

    reset() {
        this.path.length = 0;
        this.pathIndex = 0;
        this.moveDirection.set(0, 0, 0);
        this.retryRemaining = 0;
        this.stayRemaining = 0;
        this.isChasing = false;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.replanRemaining = 0;
    }

    update(role: roleController, dt: number) {
        if (gm.isGamePause || role.hp <= 0 || !role.gameComp || !role.roleData || dt <= 0) return;
        const collider = role.node.getChildByName('colliderBox')?.getComponent(UITransform);
        if (!collider) return;

        // The current three roles can cast their active skills without a target or HP condition.
        if (role.useSkill2()) role.interruptDrugUse();
        if (role.roleId === 0 && role.useSkill1()) {
            role.interruptDrugUse();
            this.stopAttack(role);
            if (this.moveDirection.lengthSqr() === 0) {
                this.moveDirection.set(role.roleAnim?.node.scale.x < 0 ? 1 : -1, 0, 0);
            }
        }
        // Preserve the slide direction and animation until the skill completes.
        if (role.isMoveDirectionLocked) {
            this.mover.moveWorld(role.node, collider, role.gameComp,
                this.moveDirection.x * role.moveSpeed * dt,
                this.moveDirection.y * role.moveSpeed * dt, this.actualMove);
            return;
        }
        this.retryRemaining = Math.max(0, this.retryRemaining - dt);
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        const player = playerMgr.playerComp;
        const hasPlayer = player?.node?.isValid && player.node.activeInHierarchy && player.hp > 0;
        if (hasPlayer && !this.isChasing && role.aiDetectRange > 0) {
            const current = role.node.worldPosition;
            const target = player.node.worldPosition;
            if ((target.x - current.x) ** 2 + (target.y - current.y) ** 2 <= role.aiDetectRange ** 2) {
                this.isChasing = true;
                this.path.length = 0;
                this.pathIndex = 0;
                this.retryRemaining = 0;
                this.stayRemaining = 0;
            }
        }
        if (this.isChasing) {
            if (!hasPlayer) {
                this.stopAttack(role);
                role.playRoleAnim(roleAnimName.idle, true);
                return;
            }
            if (this.updateAttack(role, player, dt)) return;
            this.replanRemaining = Math.max(0, this.replanRemaining - dt);
            const target = player.node.worldPosition;
            const targetMoved = (target.x - this.target.x) ** 2 + (target.y - this.target.y) ** 2 > 24 * 24;
            if (this.replanRemaining <= 0 && (!this.path.length || targetMoved)) {
                this.target.set(target);
                this.path.length = 0;
                this.pathIndex = 0;
                this.mover.findPath(role.node, collider, role.gameComp, this.target, this.path);
                this.replanRemaining = 0.35;
            }
            if (!this.path.length) {
                role.playRoleAnim(roleAnimName.idle, true);
                return;
            }
        }
        if (!this.isChasing && this.stayRemaining > 0) {
            this.stayRemaining = Math.max(0, this.stayRemaining - dt);
            role.playRoleAnim(roleAnimName.idle, true);
            return;
        }
        if (!this.path.length) {
            if (this.retryRemaining > 0) return;
            if (!this.pickTarget(role, collider)) {
                this.retryRemaining = 1;
                role.playRoleAnim(roleAnimName.idle, true);
                return;
            }
        }

        const current = role.node.worldPosition;
        let waypoint = this.path[this.pathIndex];
        let deltaX = waypoint.x - current.x;
        let deltaY = waypoint.y - current.y;
        let distance = Math.hypot(deltaX, deltaY);
        while (distance < 0.5) {
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
                this.path.length = 0;
                this.pathIndex = 0;
                this.stayRemaining = this.isChasing ? 0 : this.getStayTime();
                role.playRoleAnim(roleAnimName.idle, true);
                return;
            }
            waypoint = this.path[this.pathIndex];
            deltaX = waypoint.x - current.x;
            deltaY = waypoint.y - current.y;
            distance = Math.hypot(deltaX, deltaY);
        }

        const moveDistance = Math.min(distance, Math.max(0, role.moveSpeed * dt));
        if (moveDistance <= 0) {
            role.playRoleAnim(roleAnimName.idle, true);
            return;
        }
        if (Math.abs(deltaX) > 0.001) {
            const animNode = role.roleAnim?.node;
            if (animNode) {
                const scale = animNode.scale;
                animNode.setScale((deltaX > 0 ? -1 : 1) * Math.abs(scale.x), scale.y, scale.z);
            }
            role.setFacingByHorizontal(deltaX);
            role.syncCurrentWeaponDefaultPose();
        }
        role.playRoleAnim(roleAnimName.move, true);
        const directionX = deltaX / distance;
        const directionY = deltaY / distance;
        this.moveDirection.set(directionX, directionY, 0);
        this.mover.moveWorld(role.node, collider, role.gameComp,
            directionX * moveDistance, directionY * moveDistance, this.actualMove);
        const progress = this.actualMove.x * directionX + this.actualMove.y * directionY;
        if (progress < moveDistance * 0.2) {
            this.path.length = 0;
            this.pathIndex = 0;
            if (!this.mover.findPath(role.node, collider, role.gameComp, this.target, this.path)) {
                this.retryRemaining = 1;
            }
        }
    }

    private updateAttack(role: roleController, player: roleController, dt: number) {
        const weapon = role.weaponsController;
        if (!weapon) return false;
        const current = role.node.worldPosition;
        const target = player.node.worldPosition;
        const enterRange = Math.max(0, weapon.attackRange - Math.min(20, weapon.attackRange * 0.1));
        const range = this.isAttacking ? weapon.attackRange : enterRange;
        const blocked = role.gameComp.isWorldSegmentBlocked(current.x, current.y, target.x, target.y);
        if ((target.x - current.x) ** 2 + (target.y - current.y) ** 2 > range * range || blocked) {
            this.stopAttack(role);
            return false;
        }
        this.isAttacking = true;
        role.refreshCombatState();
        weapon.stopResetRotationTween();
        role.playRoleAnim(roleAnimName.idle, true);
        role.aimGunAt(player.node);
        if (this.attackCooldown <= 0 && role.attack(dt)) {
            this.attackCooldown = weapon.attackInterval;
        }
        return true;
    }

    private stopAttack(role: roleController) {
        if (!this.isAttacking) return;
        this.isAttacking = false;
        role.weaponsController?.node.getComponent(sniperController)?.cancelCharge();
        role.clearGunAimTarget();
        this.path.length = 0;
        this.pathIndex = 0;
        this.replanRemaining = 0;
    }

    private pickTarget(role: roleController, collider: UITransform) {
        const range = Number(aiCommonConfig.patrolRange);
        if (!Number.isFinite(range) || range <= 0) return false;
        const current = role.node.worldPosition;
        for (let attempt = 0; attempt < 20; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.sqrt(Math.random()) * range;
            this.target.set(current.x + Math.cos(angle) * radius,
                current.y + Math.sin(angle) * radius, current.z);
            role.gameComp.clampWorldPointToMap(role.node, this.target, this.target);
            if (Math.hypot(this.target.x - current.x, this.target.y - current.y) < 0.5) continue;
            if (!this.mover.findPath(role.node, collider, role.gameComp, this.target, this.path)) continue;
            this.pathIndex = 0;
            return true;
        }
        return false;
    }

    private getStayTime() {
        const stayTime = Number(aiCommonConfig.patrolStayTime);
        return Number.isFinite(stayTime) ? Math.max(0, stayTime) : 0;
    }
}
