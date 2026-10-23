import { _decorator, Vec3 } from 'cc';
import { playerMgr } from '../../manager/playerManager';
import { BossAnimName, bossBaseController } from './bossBaseController';
const { ccclass } = _decorator;

@ccclass('bossController0')
export class bossController0 extends bossBaseController {
    /** Boss 表编号。 */
    id = 0;
    /** 技能持续时间（秒）。 */
    skillDuration = 3;
    /** 技能伤害间隔（秒）。 */
    skillInterval = 0.5;
    /** 技能圆形伤害半径。 */
    skillRadius = 100;
    /** 每次伤害的攻击力比例。 */
    skillDamageScale = 0.1;
    private skillRemaining = 0;
    private skillTickRemaining = 0;
    private isInSkillRange = false;

    get isUsingSkill(): boolean { return this.skillRemaining > 0; }

    protected startSkill(): boolean {
        if (this.isUsingSkill || this.skillDuration <= 0 || this.skillInterval <= 0) return false;
        this.isInSkillRange = false;
        this.skillRemaining = this.skillDuration;
        this.skillTickRemaining = this.skillInterval;
        return true;
    }

    /** 首次伤害在 0.5 秒后，3 秒内共结算 6 次。 */
    protected updateSkill(dt: number): void {
        if (!this.isUsingSkill) return;
        const elapsed = Math.min(Math.max(0, dt), this.skillRemaining);
        this.skillRemaining = Math.max(0, this.skillRemaining - elapsed);
        this.skillTickRemaining -= elapsed;
        while (this.skillTickRemaining <= 0.000001) {
            this.skillTickRemaining += Math.max(0.01, this.skillInterval);
            this.damageAround();
        }
    }

    protected stopSkill(): void {
        this.skillRemaining = 0;
        this.skillTickRemaining = 0;
        this.isInSkillRange = false;
    }

    /** 追到技能半径的 80%，避免停在伤害范围外。 */
    protected chaseDuringSkill(target: Vec3, dt: number): void {
        const dx = target.x - this.node.worldPosition.x;
        const dy = target.y - this.node.worldPosition.y;
        const stopDistance = this.skillRadius * (this.isInSkillRange ? 1 : 0.8);
        this.isInSkillRange = dx * dx + dy * dy <= stopDistance * stopDistance;
        if (!this.isInSkillRange) this.moveToward(target, dt);
        else {
            this.clearNavigationPath();
            this.faceTarget(target);
            this.playAnimation(BossAnimName.idle);
        }
    }

    /** 技能范围随 Boss 移动，覆盖四周完整圆形。 */
    private damageAround(): void {
        const player = playerMgr.playerComp;
        if (!player?.node?.isValid || !player.node.activeInHierarchy || player.hp <= 0) return;
        const dx = player.node.worldPosition.x - this.node.worldPosition.x;
        const dy = player.node.worldPosition.y - this.node.worldPosition.y;
        if (dx * dx + dy * dy <= this.skillRadius ** 2) {
            player.takeDamage(this.attackDamage * this.skillDamageScale);
        }
    }
}
