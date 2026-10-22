import { UITransform, Vec3 } from 'cc';
import { aiCommonConfig } from '../../manager/configData';
import { gm } from '../../manager/gm';
import { StaticCollisionMover } from '../staticCollisionMover';
import { roleAnimName } from './roleController';
import type { roleController } from './roleController';

export class AIPatrol {
    private mover = new StaticCollisionMover();
    private path: Vec3[] = [];
    private pathIndex = 0;
    private target = new Vec3();
    private actualMove = new Vec3();
    private retryRemaining = 0;

    reset() {
        this.path.length = 0;
        this.pathIndex = 0;
        this.retryRemaining = 0;
    }

    update(role: roleController, dt: number) {
        if (gm.isGamePause || role.hp <= 0 || !role.gameComp || !role.roleData || dt <= 0) return;
        const collider = role.node.getChildByName('colliderBox')?.getComponent(UITransform);
        if (!collider) return;
        this.retryRemaining = Math.max(0, this.retryRemaining - dt);
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
                this.reset();
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
}
