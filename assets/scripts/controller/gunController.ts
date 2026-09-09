import { _decorator, Node, UITransform, Vec3 } from 'cc';
import { uiMgr } from '../manager/UIManager';
import { poolMgr } from '../manager/poolManager';
import { bulletController } from './bulletController';
import { weaponsAnimName, weaponsController, WeaponStats } from './weaponsController';
const { ccclass } = _decorator;

/** 枪械 Spine 使用的动画名称。 */
export enum gunAnimName { idle = 'idle', attack = 'attack', reload = 'reload' }

/** 远程武器控制器：处理弹匣、换弹和子弹生成。 */
@ccclass('gunController')
export class gunController extends weaponsController {
    /** 两发子弹间隔，单位为秒。 */
    shootInterval = 0.2;
    /** 换弹动画时长。 */
    reloadTime = 0;

    private currentAmmo = 0;
    private isReloading = false;
    private shootBone: any = null;
    private tempGunWorldPos = new Vec3();
    private tempShootRootWorldPos = new Vec3();
    private tempBulletSpawnWorldPos = new Vec3();
    private tempBulletWorldDirection = new Vec3();
    private tempBulletLocalPos = new Vec3();
    private tempBulletLocalDirection = new Vec3();
    private tempBulletDirectionEndWorldPos = new Vec3();
    private tempBulletDirectionEndLocalPos = new Vec3();

    protected onLoad(): void {
        super.onLoad();
        this.currentAmmo = this.capacity;
        this.updateReloadTime();
    }

    get ammo() { return this.currentAmmo; }
    get reloading() { return this.isReloading; }

    /** 枪械在应用配置后，以新的弹匣容量重新装填。 */
    applyStats(stats: WeaponStats) {
        super.applyStats(stats);
        this.currentAmmo = this.capacity;
    }

    private updateReloadTime() {
        const reloadAnimation = this.weaponSkeleton?.findAnimation(gunAnimName.reload);
        this.reloadTime = reloadAnimation?.duration ?? 0;
    }

    /** 按枪口骨骼而非节点中心修正瞄准角度。 */
    protected updateAimRotation() {
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform || !this.weaponSkeleton) return;
        this.shootBone ??= this.weaponSkeleton.findBone('kaihuo');
        if (!this.shootBone) return;

        parentTransform.convertToNodeSpaceAR(this.tempTargetWorldPos, this.tempTargetParentLocalPos);
        const targetOffsetX = this.tempTargetParentLocalPos.x - this.node.position.x;
        const targetOffsetY = this.tempTargetParentLocalPos.y - this.node.position.y;
        const targetAngle = Math.atan2(targetOffsetY, targetOffsetX) * 180 / Math.PI;
        const scaledMuzzleX = this.shootBone.worldX * this.node.scale.x;
        const scaledMuzzleY = this.shootBone.worldY * this.node.scale.y;
        const muzzleAngle = Math.atan2(scaledMuzzleY, scaledMuzzleX) * 180 / Math.PI;
        let localAngle = targetAngle - muzzleAngle;
        localAngle = (localAngle + 180) % 360;
        if (localAngle < 0) localAngle += 360;
        localAngle -= 180;
        this.node.angle = Math.max(-90, Math.min(90, localAngle));
    }

    /** 从枪口创建一枚直线飞行的子弹。 */
    fireBullet(bulletParent: Node) {
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
        bulletComp.initStraight(this.tempBulletLocalDirection, this.attack, this.attackRange, this.flightSpeed);
        this.currentAmmo--;
        if (this.currentAmmo <= 0) {
            this.playShootAnim(true);
            this.startReload(true);
        } else {
            this.playShootAnim();
        }
        return true;
    }

    reload() {
        if (this.isReloading) {
            uiMgr.showTips('正在换弹中...');
            return false;
        }
        if (this.currentAmmo >= this.capacity) {
            uiMgr.showTips('弹夹已满');
            return false;
        }
        return this.startReload(false);
    }

    private startReload(afterCurrentAnimation: boolean) {
        if (this.isReloading || this.currentAmmo >= this.capacity) return false;
        this.isReloading = true;
        this.node.emit('reload-start', this.reloadTime);
        const reloadEntry = afterCurrentAnimation ? this.queueReloadAnim() : this.playReloadAnim();
        if (reloadEntry && this.weaponSkeleton) {
            this.weaponSkeleton.setTrackCompleteListener(reloadEntry, () => this.finishReload());
        } else {
            this.finishReload();
        }
        return true;
    }

    private finishReload() {
        this.currentAmmo = this.capacity;
        this.isReloading = false;
        this.playIdleAnim();
    }

    private getShootData(outPosition: Vec3, outDirection: Vec3) {
        if (!this.weaponSkeleton) return false;
        this.shootBone ??= this.weaponSkeleton.findBone('kaihuo');
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

    private playShootAnim(reloadAfter = false) {
        if (!this.weaponSkeleton?.skeletonData) return;
        this.curWeaponAnimName = weaponsAnimName.attack;
        this.weaponSkeleton.setAnimation(0, gunAnimName.attack, false);
        if (!reloadAfter) {
            this.weaponSkeleton.addAnimation(0, gunAnimName.idle, true, 0);
            this.curWeaponAnimName = weaponsAnimName.idle;
        }
    }

    private playReloadAnim() {
        if (!this.weaponSkeleton?.skeletonData) return null;
        this.curWeaponAnimName = gunAnimName.reload;
        return this.weaponSkeleton.setAnimation(0, gunAnimName.reload, false);
    }

    private queueReloadAnim() {
        if (!this.weaponSkeleton?.skeletonData) return null;
        this.curWeaponAnimName = gunAnimName.reload;
        return this.weaponSkeleton.addAnimation(0, gunAnimName.reload, false, 0);
    }
}
