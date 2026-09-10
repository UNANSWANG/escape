import { _decorator, Color, Node, Sprite, UITransform, Vec3 } from 'cc';
import { uiMgr } from '../manager/UIManager';
import { poolMgr } from '../manager/poolManager';
import { gunController } from './gunController';
import { WeaponStats } from './weaponsController';
const { ccclass, property } = _decorator;

/** 狙击枪控制器：按住攻击时收拢两条瞄准线；自动模式蓄满开火，手动模式松手开火。 */
@ccclass('sniperController')
export class sniperController extends gunController {
    /** 装备狙击枪后的可视范围倍率：1.2 表示扩大 20%。 */
    viewScale = 1.2;

    /** 单侧辅助线相对射击方向的初始夹角，总张角为该值的两倍。 */
    chargeAngle = 30;

    /** 辅助线从初始夹角收拢至 0 度所需时间（秒）。 */
    chargeTime = 1;

    private isCharging = false;
    private isChargeComplete = false;
    private chargeElapsed = 0;
    private currentChargeAngle = 0;
    private upperLine: Node = null;
    private lowerLine: Node = null;
    private lineParent: Node = null;
    private tempMuzzleWorldPos = new Vec3();
    private tempAimWorldDirection = new Vec3();
    private tempMuzzleLocalPos = new Vec3();
    private tempAimEndWorldPos = new Vec3();
    private tempAimEndLocalPos = new Vec3();
    private tempReleaseWorldDirection = new Vec3();

    /**应用武器表配置，并读取狙击枪专用的蓄力时间。 */
    applyStats(stats: WeaponStats) {
        super.applyStats(stats);
        if (Number.isFinite(stats.chargeTime)) {
            this.chargeTime = Math.max(0, stats.chargeTime);
        }
    }

    /**
     * 第一次调用开始蓄力；蓄力完成后才真正生成子弹。
     * 开火成功后由 UIGame 的通用攻击间隔控制下一轮蓄力开始时间。
     */
    fireBullet(bulletParent: Node, deltaTime = 0, fireOnChargeComplete = true) {
        if (!bulletParent?.isValid) return false;

        if (!this.isCharging) {
            this.startCharge(bulletParent);
            return false;
        }

        this.chargeElapsed += Math.max(0, deltaTime);
        const duration = Math.max(0, this.chargeTime);
        const progress = duration <= 0 ? 1 : Math.min(1, this.chargeElapsed / duration);
        this.currentChargeAngle = Math.max(0, this.chargeAngle) * (1 - progress);
        if (progress >= 1 && !this.isChargeComplete) {
            this.isChargeComplete = true;
            this.setLineColor(Color.RED);
        }
        this.syncAimLines();

        if (!this.isChargeComplete || !fireOnChargeComplete) return false;
        const isFired = super.fireBullet(bulletParent);
        if (isFired) {
            // 成功开火后进入攻击间隔，期间不显示辅助线；下一次蓄力时重新创建。
            this.isCharging = false;
            this.recycleAimLines();
        }
        return isFired;
    }

    onWeaponUnequipped() {
        super.onWeaponUnequipped();
        this.cancelCharge();
    }

    /**
     * 攻击键状态变化时开始蓄力；蓄力中松开则在当前两条辅助线夹角内随机提前开火。
     * @returns 本次松手是否成功发射子弹。
     */
    setAttackHeld(isHeld: boolean, bulletParent: Node) {
        if (isHeld) {
            if (!this.isCharging) this.startCharge(bulletParent);
            return false;
        }

        if (!this.isCharging) {
            this.cancelCharge();
            return false;
        }

        const isFired = this.fireChargedBullet(this.lineParent ?? bulletParent, this.currentChargeAngle);
        this.cancelCharge();
        return isFired;
    }

    /** 松开攻击键时立即清除辅助线和本轮蓄力进度。 */
    cancelCharge() {
        this.isCharging = false;
        this.isChargeComplete = false;
        this.chargeElapsed = 0;
        this.currentChargeAngle = 0;
        this.recycleAimLines();
    }

    protected lateUpdate(): void {
        super.lateUpdate();
        if (this.upperLine || this.lowerLine) this.syncAimLines();
    }

    protected onDisable(): void {
        this.cancelCharge();
    }

    protected onDestroy(): void {
        this.recycleAimLines();
    }

    private startCharge(bulletParent: Node) {
        this.isCharging = true;
        this.isChargeComplete = false;
        this.chargeElapsed = 0;
        this.currentChargeAngle = Math.max(0, this.chargeAngle);
        this.lineParent = bulletParent;
        this.createAimLines();
        this.setLineColor(Color.WHITE);
        this.syncAimLines();
    }

    private createAimLines() {
        if (!this.lineParent?.isValid || !uiMgr.gameLinePrefab) return;
        if (!this.upperLine?.isValid) {
            this.upperLine = poolMgr.getGameLineNode(uiMgr.gameLinePrefab);
            this.lineParent.addChild(this.upperLine);
        }
        if (!this.lowerLine?.isValid) {
            this.lowerLine = poolMgr.getGameLineNode(uiMgr.gameLinePrefab);
            this.lineParent.addChild(this.lowerLine);
        }
    }

    /** 将线根同步到枪口上下 4 像素，并按当前蓄力角度向两侧展开。 */
    private syncAimLines() {
        if (!this.lineParent?.isValid) {
            this.recycleAimLines();
            return;
        }
        this.createAimLines();
        if (!this.upperLine?.isValid || !this.lowerLine?.isValid) return;
        if (!this.getShootData(this.tempMuzzleWorldPos, this.tempAimWorldDirection)) return;

        const parentTransform = this.lineParent.getComponent(UITransform);
        if (!parentTransform) return;
        parentTransform.convertToNodeSpaceAR(this.tempMuzzleWorldPos, this.tempMuzzleLocalPos);
        const aimLineRange = Math.max(0, this.attackRange);
        this.tempAimEndWorldPos.set(
            this.tempMuzzleWorldPos.x + this.tempAimWorldDirection.x * aimLineRange,
            this.tempMuzzleWorldPos.y + this.tempAimWorldDirection.y * aimLineRange,
            this.tempMuzzleWorldPos.z,
        );
        parentTransform.convertToNodeSpaceAR(this.tempAimEndWorldPos, this.tempAimEndLocalPos);

        const directionX = this.tempAimEndLocalPos.x - this.tempMuzzleLocalPos.x;
        const directionY = this.tempAimEndLocalPos.y - this.tempMuzzleLocalPos.y;
        const lineLength = Math.sqrt(directionX * directionX + directionY * directionY);
        if (lineLength <= 0) return;
        const centerAngle = Math.atan2(directionY, directionX) * 180 / Math.PI;

        // 面朝左时角度正负与画面上下相反，按水平朝向修正，避免两条线从根部交叉。
        const upperAngleSign = directionX >= 0 ? 1 : -1;
        this.updateLine(this.upperLine, 4, centerAngle + upperAngleSign * this.currentChargeAngle, lineLength);
        this.updateLine(this.lowerLine, -4, centerAngle - upperAngleSign * this.currentChargeAngle, lineLength);
    }

    private updateLine(line: Node, offsetY: number, directionAngle: number, length: number) {
        line.setPosition(this.tempMuzzleLocalPos.x, this.tempMuzzleLocalPos.y + offsetY, this.tempMuzzleLocalPos.z);
        // gameLine 的根部锚点在右侧，本地负 X 轴指向线的延伸方向。
        line.angle = directionAngle + 180;
        const transform = line.getComponent(UITransform);
        if (transform) {
            transform.setAnchorPoint(1, 0.5);
            transform.setContentSize(length, transform.height);
        }
    }

    /** 按当前蓄力剩余角度随机偏转后发射。0 度时即为正中心方向。 */
    private fireChargedBullet(bulletParent: Node, maxOffsetAngle: number) {
        if (!bulletParent?.isValid || !this.prepareFire()) return false;
        if (!this.getShootData(this.tempMuzzleWorldPos, this.tempAimWorldDirection)) return false;

        const offsetRadians = (Math.random() * 2 - 1) * Math.max(0, maxOffsetAngle) * Math.PI / 180;
        const centerRadians = Math.atan2(this.tempAimWorldDirection.y, this.tempAimWorldDirection.x);
        this.tempReleaseWorldDirection.set(
            Math.cos(centerRadians + offsetRadians),
            Math.sin(centerRadians + offsetRadians),
            0,
        );
        if (!this.spawnBullet(bulletParent, this.tempMuzzleWorldPos, this.tempReleaseWorldDirection)) return false;
        this.finishFire();
        return true;
    }

    private setLineColor(color: Color) {
        const upperSprite = this.upperLine?.getComponent(Sprite);
        const lowerSprite = this.lowerLine?.getComponent(Sprite);
        if (upperSprite) upperSprite.color = color;
        if (lowerSprite) lowerSprite.color = color;
    }

    private recycleAimLines() {
        if (this.upperLine?.isValid) poolMgr.putGameLineNode(this.upperLine);
        if (this.lowerLine?.isValid) poolMgr.putGameLineNode(this.lowerLine);
        this.upperLine = null;
        this.lowerLine = null;
        this.lineParent = null;
    }
}
