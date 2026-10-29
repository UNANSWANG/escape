import { _decorator, instantiate, Node, Vec3 } from 'cc';
import { uiMgr } from '../../manager/UIManager';
import { skillRangeController } from '../indicator/skillRangeController';
import { playerMgr } from '../../manager/playerManager';
import { BossAnimName, bossBaseController } from './bossBaseController';
const { ccclass } = _decorator;

enum SkillStage {
    None,
    Skill1,
    Skill2,
    Active,
}

@ccclass('bossController0')
export class bossController0 extends bossBaseController {
    /** Boss 表编号。 */
    id = 0;
    /** 技能持续时间（秒）。 */
    skillDuration = 3;
    /** 技能伤害间隔（秒）。 */
    skillInterval = 0.5;
    /** 技能圆形伤害半径。 */
    skillRadius = 200;
    /** 每次伤害的攻击力比例。 */
    skillDamageScale = 0.1;
    private skillRemaining = 0;
    private skillTickRemaining = 0;
    private isInSkillRange = false;
    private skillStage = SkillStage.None;
    private skillVersion = 0;
    private skillRangeNode: Node = null;

    get isUsingSkill(): boolean { return this.skillStage !== SkillStage.None; }

    protected startSkill(): boolean {
        if (this.isUsingSkill || this.skillDuration <= 0 || this.skillInterval <= 0) return false;
        this.isInSkillRange = false;
        this.skillRemaining = 0;
        this.skillTickRemaining = 0;
        this.clearNavigationPath();
        this.skillStage = SkillStage.Skill1;
        const version = ++this.skillVersion;
        const skill1Speed = 1;
        const skill2Speed = 1.2;
        const skill1Duration = this.roleAnim?.findAnimation(BossAnimName.skill1)?.duration ?? 0;
        const skill2Duration = this.roleAnim?.findAnimation(BossAnimName.skill2)?.duration ?? 0;
        const duration = (skill1Duration / skill1Speed + skill2Duration / skill2Speed)
            / Math.max(0.01, this.roleAnim?.timeScale ?? 1);
        this.showSkillRange(duration);
        this.playSkillWindup(BossAnimName.skill1, skill1Speed, version, () => {
            this.skillStage = SkillStage.Skill2;
            this.playSkillWindup(BossAnimName.skill2, skill2Speed, version, () => {
                this.clearSkillRange();
                this.skillStage = SkillStage.Active;
                this.skillRemaining = this.skillDuration;
                this.skillTickRemaining = this.skillInterval;
                this.playAnimation(BossAnimName.idle, true, true);
            });
        });
        return true;
    }

    /** 前摇使用动画完成回调，倍率只作用于当前动画轨道。 */
    private playSkillWindup(name: BossAnimName, speed: number, version: number, complete: () => void) {
        const finish = () => {
            if (!this.isValid || this.hp <= 0 || this.skillVersion !== version || !this.isUsingSkill) return;
            complete();
        };
        const entry = this.playAnimation(name, false, true);
        if (!entry) {
            finish();
            return;
        }
        entry.timeScale = speed;
        this.roleAnim.setTrackCompleteListener(entry, finish);
    }

    /** 两段前摇结束后才计时；默认首次伤害在生效 0.5 秒后，3 秒内共结算 6 次。 */
    protected updateSkill(dt: number): void {
        if (this.skillStage !== SkillStage.Active) return;
        const elapsed = Math.min(Math.max(0, dt), this.skillRemaining);
        this.skillRemaining = Math.max(0, this.skillRemaining - elapsed);
        this.skillTickRemaining -= elapsed;
        while (this.skillTickRemaining <= 0.000001) {
            this.skillTickRemaining += Math.max(0.01, this.skillInterval);
            this.damageAround();
        }
        if (this.skillRemaining <= 0) this.stopSkill();
    }

    protected stopSkill(): void {
        this.clearSkillRange();
        this.skillVersion++;
        this.skillStage = SkillStage.None;
        this.skillRemaining = 0;
        this.skillTickRemaining = 0;
        this.isInSkillRange = false;
    }

    /** Show the warning below the Boss throughout both windup animations. */
    private showSkillRange(duration: number): void {
        this.clearSkillRange();
        if (!uiMgr.skillRangePrefab) return;
        this.skillRangeNode = instantiate(uiMgr.skillRangePrefab);
        this.node.addChild(this.skillRangeNode);
        this.skillRangeNode.setPosition(0, 0, 0);
        this.skillRangeNode.setSiblingIndex(0);
        const controller = this.skillRangeNode.getComponent(skillRangeController)
            ?? this.skillRangeNode.addComponent(skillRangeController);
        controller.init(this.skillRadius, duration);
    }

    private clearSkillRange(): void {
        if (this.skillRangeNode?.isValid) {
            this.skillRangeNode.active = false;
            this.skillRangeNode.destroy();
        }
        this.skillRangeNode = null;
    }

    protected onDisable(): void {
        this.stopSkill();
        super.onDisable();
    }

    protected onDestroy(): void {
        this.clearSkillRange();
        super.onDestroy();
    }

    /** Chase to 80% of the skill radius. */
    protected chaseDuringSkill(target: Vec3, dt: number): void {
        // 前摇期间站定，不允许移动逻辑覆盖 skill1、skill2 动画。
        if (this.skillStage !== SkillStage.Active) return;
        const dx = target.x - this.node.worldPosition.x;
        const dy = target.y - this.node.worldPosition.y;
        const stopDistance = this.skillRadius * (this.isInSkillRange ? 1 : 0.8);
        this.isInSkillRange = dx * dx + dy * dy <= stopDistance * stopDistance;
        if (!this.isInSkillRange) this.moveToward(target, dt, BossAnimName.idle);
        else {
            this.clearNavigationPath();
            this.faceTarget(target);
            this.playAnimation(BossAnimName.idle);
        }
        // 技能生效期间暂时用循环 idle 替代专用持续动画。
        this.playAnimation(BossAnimName.idle);
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
