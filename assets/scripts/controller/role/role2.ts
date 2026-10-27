import { _decorator } from 'cc';
import { roleController, roleType } from './roleController';
import { gm } from '../../manager/gm';
const { ccclass } = _decorator;

@ccclass('role2')
export class role2 extends roleController {
    /**角色类型 */
    roleType: roleType = roleType.shield;

    /**主动技能剩余无敌时间（秒）。 */
    private invincibleRemainTime = 0;

    get isInvincible(): boolean {
        return this.hp > 0 && this.invincibleRemainTime > 0;
    }

    /**被动：将当前等级配置的减伤百分比转换为受伤倍率。 */
    get damageTakenScale(): number {
        const value = Number(this.roleLevelData?.passiveValue);
        return Number.isFinite(value) ? 1 - Math.min(100, Math.max(0, value)) / 100 : 1;
    }

    initData(): void {
        super.initData();
        const cooldown = Number(this.roleLevelData?.initiativeCd);
        this.skill2Cooldown = Number.isFinite(cooldown) ? Math.max(0, cooldown) : 0;
    }

    /**主动技能：在配置的持续时间内免疫所有伤害。 */
    useSkill2() {
        if (this.hp <= 0 || this.isInvincible || this.isSkillCooling(2)) return false;
        const duration = Number(this.roleLevelData?.initiativeTime);
        if (!Number.isFinite(duration) || duration <= 0) return false;

        this.invincibleRemainTime = duration;
        this.startSkillCooldown(2);
        return true;
    }

    /**无敌时直接拦截伤害，护甲和生命值均不会减少。 */
    takeDamage(damage: number) {
        if (this.isInvincible) return false;
        return super.takeDamage(damage);
    }

    protected update(dt: number): void {
        if (this.hp <= 0) {
            this.invincibleRemainTime = 0;
            return;
        }
        if (gm.isGamePause || dt <= 0) return;
        super.update(dt);
        this.invincibleRemainTime = Math.max(0, this.invincibleRemainTime - dt);
    }

    protected onDisable(): void {
        super.onDisable();
        this.invincibleRemainTime = 0;
    }
}
