import { _decorator, Node, Vec3 } from 'cc';
import { gunController } from './gunController';
import { WeaponStats } from './weaponsController';
const { ccclass, property } = _decorator;

/**
 * 霰弹枪控制器。
 *
 * 每次攻击按照 weapons 表的 bulletNum 发射扇形分裂子弹；每枚子弹均使用 weapons 表的
 * attack 作为伤害，但全部弹丸只会共同消耗 1 发弹夹。
 */
@ccclass('shotgunController')
export class shotgunController extends gunController {
    /** 单次攻击的弹丸数，由 weapons 表 bulletNum 配置。 */
    bulletNum = 1;

    /** 所有弹丸可随机分布的总扇形角度（度） */
    bulletSpreadAngle = 40;

    private tempShotgunSpawnWorldPos = new Vec3();
    private tempShotgunWorldDirection = new Vec3();
    private tempShotgunSpreadDirection = new Vec3();

    applyStats(stats: WeaponStats) {
        super.applyStats(stats);
        if (Number.isFinite(stats.bulletNum)) this.bulletNum = Math.max(1, Math.floor(stats.bulletNum));
    }

    /** 发射全部分裂弹丸；每枚均在枪口朝向的扇形区域内随机偏转，结束后统一结算一次弹药与射击动画。 */
    fireBullet(bulletParent: Node) {
        if (!this.prepareFire()) return false;
        if (!this.getShootData(this.tempShotgunSpawnWorldPos, this.tempShotgunWorldDirection)) return false;

        const bulletCount = Math.max(1, this.bulletNum);
        const baseAngle = Math.atan2(this.tempShotgunWorldDirection.y, this.tempShotgunWorldDirection.x);
        const spreadRadians = this.bulletSpreadAngle * Math.PI / 180;
        let hasFired = false;
        for (let index = 0; index < bulletCount; index++) {
            const angle = baseAngle + (Math.random() - 0.5) * spreadRadians;
            this.tempShotgunSpreadDirection.set(Math.cos(angle), Math.sin(angle), 0);
            hasFired = this.spawnBullet(bulletParent, this.tempShotgunSpawnWorldPos, this.tempShotgunSpreadDirection) || hasFired;
        }
        if (!hasFired) return false;

        this.finishFire();
        return true;
    }
}
