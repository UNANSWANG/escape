import { _decorator } from 'cc';
import { roleAnimName, roleController, roleType } from './roleController';
import { enemyBaseController } from '../enemy/enemyBaseController';
import { enemyMgr } from '../../manager/enemyManager';
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
    /**技能1冷却时间 */
    skill1Cooldown = 15;
    /**技能2冷却时间 */
    skill2Cooldown = 50;

    /**技能2是否正在生效。 */
    private isUsingSkill2 = false;
    /**技能2剩余生效时间（秒）。 */
    private skill2RemainTime = 0;
    /**技能2原始持续时间上限（秒）。 */
    private skill2Duration = 0;
    /**技能2提供的移速加成百分比。 */
    private skill2MoveSpeedPercent = 0;
    /**技能2期间每次击杀的回血百分比。 */
    private skill2KillHealPercent = 0;
    /**技能2期间每次击杀延长的时间（秒）。 */
    private skill2KillExtendTime = 0;
    /**已记录死亡的敌人，避免同一敌人重复结算。 */
    private defeatedEnemies = new Set<enemyBaseController>();

    get isMoveDirectionLocked() { return this.isUsingSkill1; }

    /**
     * role0 的最终移速统一在读取时按当前技能状态计算，
     * 不在技能释放时直接修改基础移速，便于后续叠加其他速度效果。
     */
    get moveSpeed() {
        let speed = this.baseMoveSpeed;
        if (this.isUsingSkill1) speed *= this.skill1SpeedScale;
        if (this.isUsingSkill2) speed *= Math.max(0, 1 + this.skill2MoveSpeedPercent / 100);
        return speed;
    }

    /**使用技能1；移动方向由 UIGame 在技能期间锁定。 */
    useSkill1() {
        // 突进需要已有方向，通用技能不受此限制。
        if (!this.gameComp?.hasMoveDirectionInput()) return false;
        if (this.isUsingSkill1 || this.isSkillCooling(1) || !this.roleAnim?.skeletonData) return false;

        const entry = this.roleAnim.setAnimation(0, roleAnimName.useSkill1, false);
        if (!entry) return false;

        this.isUsingSkill1 = true;
        entry.timeScale = Math.max(0.01, this.skill1TimeScale);
        this.curRoleAnimName = roleAnimName.useSkill1;
        this.roleAnim.setTrackCompleteListener(entry, () => this.finishSkill1());
        this.startSkillCooldown(1);
        return true;
    }

    initData(): void {
        //TODO 临时1s
        this.skill1Cooldown = 1//this.roleData?.passiveCd ?? 15;
        this.skill2Cooldown = this.roleData?.initiativeCd ?? 50;
        const values = this.getInitiativeValues();
        this.skill2MoveSpeedPercent = values[0] ?? 0;
        this.skill2KillHealPercent = values[1] ?? 0;
        this.skill2KillExtendTime = values[2] ?? 0;
    }

    /**使用技能2：生效期间提高移速，击杀敌人回血并延长剩余时间。 */
    useSkill2() {
        if (this.isUsingSkill2 || this.isSkillCooling(2)) return false;

        this.skill2Duration = Math.max(0, this.roleData?.initiativeTime ?? 0);
        if (this.skill2Duration <= 0) return false;

        this.isUsingSkill2 = true;
        this.skill2RemainTime = this.skill2Duration;
        // 技能开始前已死亡的敌人不能触发本次技能效果。
        this.rememberDefeatedEnemies();
        this.startSkillCooldown(2);
        return true;
    }

    protected update(dt: number): void {
        super.update(dt);
        this.updateSkill2(dt);
    }

    protected onDisable(): void {
        super.onDisable();
        this.finishSkill2();
    }

    /**将角色表的主动数值兼容解析为数值数组。 */
    private getInitiativeValues() {
        const rawValue: unknown = this.roleData?.initiativeValue;
        let values: unknown[] = [];
        if (Array.isArray(rawValue)) {
            values = rawValue;
        } else if (typeof rawValue === 'string') {
            try {
                const parsedValue: unknown = JSON.parse(rawValue);
                if (Array.isArray(parsedValue)) values = parsedValue;
            } catch {
                // 配置格式异常时使用 0 值，避免技能逻辑中断。
            }
        }
        return values.map((value) => Number.isFinite(Number(value)) ? Number(value) : 0);
    }

    /**更新技能2状态，并在有效期内结算新增击杀。 */
    private updateSkill2(dt: number) {
        if (!this.isUsingSkill2) return;

        this.checkSkill2EnemyDefeats();
        this.skill2RemainTime = Math.max(0, this.skill2RemainTime - dt);
        if (this.skill2RemainTime <= 0) this.finishSkill2();
    }

    /**记录当前已死亡的敌人，或结算技能期间首次死亡的敌人。 */
    private rememberDefeatedEnemies() {
        for (const enemy of enemyMgr.enemyArr) {
            if (enemy?.hp <= 0) this.defeatedEnemies.add(enemy);
        }
    }

    /**检查技能2生效期间的新击杀。 */
    private checkSkill2EnemyDefeats() {
        for (const enemy of enemyMgr.enemyArr) {
            if (!enemy || enemy.hp > 0 || this.defeatedEnemies.has(enemy)) continue;

            this.defeatedEnemies.add(enemy);
            this.onSkill2KillEnemy();
        }
    }

    /**处理技能2击杀奖励：恢复最大生命值百分比，并延长剩余时间但不超过原始时长。 */
    private onSkill2KillEnemy() {
        const maxHp = Math.max(0, this.roleData?.hp ?? 0);
        if (maxHp > 0 && this.skill2KillHealPercent > 0) {
            const healAmount = maxHp * this.skill2KillHealPercent / 100;
            this.hp = Math.min(maxHp, this.hp + healAmount);
        }

        if (this.skill2KillExtendTime > 0) {
            this.skill2RemainTime = Math.min(this.skill2Duration, this.skill2RemainTime + this.skill2KillExtendTime);
        }
    }

    /**结束技能2并清理本次生效状态。 */
    private finishSkill2() {
        this.isUsingSkill2 = false;
        this.skill2RemainTime = 0;
        this.defeatedEnemies.clear();
    }

    /**技能1动画结束，恢复普通动画控制权。 */
    private finishSkill1() {
        if (!this.isUsingSkill1) return;
        this.isUsingSkill1 = false;
        this.curRoleAnimName = '';
    }
}
