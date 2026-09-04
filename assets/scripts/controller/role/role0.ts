import { _decorator } from 'cc';
import { roleAnimName, roleController, roleType } from './roleController';
const { ccclass, property } = _decorator;

@ccclass('role0')
export class role0 extends roleController {
    /**角色类型 */
    roleType: roleType = roleType.advance;

    /**技能1的时间倍率(动画原时长为1.15s) */
    skill1TimeScale: number = 4;
    /**技能1的速度倍率 */
    skill1SpeedScale: number = 4;

    /**技能1进行中，期间保持释放时的移动方向。 */
    private isUsingSkill1 = false;
    /**释放技能前的移速，用于动画结束后恢复。 */
    private moveSpeedBeforeSkill1 = 0;
    /**技能1冷却时间 */
    skill1Cooldown = 15;
    /**技能2冷却时间 */
    skill2Cooldown = 50;

    get isMoveDirectionLocked() { return this.isUsingSkill1; }

    /**使用技能1；移动方向由 UIGame 在技能期间锁定。 */
    useSkill1() {
        // 突进需要已有方向，通用技能不受此限制。
        if (!this.gameComp?.hasMoveDirectionInput()) return false;
        if (this.isUsingSkill1 || this.isSkillCooling(1) || !this.roleAnim?.skeletonData) return false;

        const entry = this.roleAnim.setAnimation(0, roleAnimName.useSkill1, false);
        if (!entry) return false;

        this.isUsingSkill1 = true;
        this.moveSpeedBeforeSkill1 = this.moveSpeed;
        this.moveSpeed *= this.skill1SpeedScale;
        entry.timeScale = Math.max(0.01, this.skill1TimeScale);
        this.curRoleAnimName = roleAnimName.useSkill1;
        this.roleAnim.setTrackCompleteListener(entry, () => this.finishSkill1());
        this.startSkillCooldown(1);
        return true;
    }

    /**技能1动画结束，恢复移动速度和普通动画控制权。 */
    private finishSkill1() {
        if (!this.isUsingSkill1) return;
        this.isUsingSkill1 = false;
        this.moveSpeed = this.moveSpeedBeforeSkill1;
        this.moveSpeedBeforeSkill1 = 0;
        this.curRoleAnimName = '';
    }
}
