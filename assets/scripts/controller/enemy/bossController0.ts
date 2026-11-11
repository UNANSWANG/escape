import { _decorator, Animation, AnimationClip, instantiate, Node, Vec3 } from 'cc';
import { uiMgr } from '../../manager/UIManager';
import { skillRangeCircleController } from '../indicator/skillRangeCircleController';
import { playerMgr } from '../../manager/playerManager';
import { commonConfig } from '../../json/jsonCommon';
import { bossConfig } from '../../json/jsonBoss';
import { BossAnimName, bossBaseController } from './bossBaseController';
const { ccclass } = _decorator;

/** 本 Boss 专属技能动画。 */
enum Boss0SkillAnimName {
    /** 旋风技能第一段前摇：原地播放一次，期间显示圆形范围预警。 */
    skill1 = 'skill1',
    /** 旋风技能第二段前摇：原地播放一次，结束后进入旋风持续伤害阶段。 */
    skill2 = 'skill2',
}

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
    skillInterval = 0.2;
    /** 技能圆形伤害半径。 */
    skillRadius = 200;
    /**技能持续期间移速加成 */
    skillSpeed = 0.2;
    private skillRemaining = 0;
    private skillTickRemaining = 0;
    private isInSkillRange = false;
    private skillStage = SkillStage.None;
    private skillVersion = 0;
    private skillRangeNode: Node = null;
    private whirlwindNode: Node = null;

    get isUsingSkill(): boolean { return this.skillStage !== SkillStage.None; }

    /** 从 Boss 表读取持续时间，通用表的移速加成按百分比转换。 */
    protected initData(): void {
        super.initData();
        const duration = bossConfig.getDataById(this.id)?.duration;
        const speed = commonConfig.getValueNumber('boss0SkillMoveSpeed');
        this.skillDuration = Number.isFinite(duration) ? Math.max(0, duration) : 3;
        this.skillSpeed = Number.isFinite(speed) ? Math.max(0, speed) / 100 : 0.2;
    }

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
        const skill1Duration = this.roleAnim?.findAnimation(Boss0SkillAnimName.skill1)?.duration ?? 0;
        const skill2Duration = this.roleAnim?.findAnimation(Boss0SkillAnimName.skill2)?.duration ?? 0;
        const duration = (skill1Duration / skill1Speed + skill2Duration / skill2Speed)
            / Math.max(0.01, this.roleAnim?.timeScale ?? 1);
        this.showSkillRange(duration);
        this.playSkillWindup(Boss0SkillAnimName.skill1, skill1Speed, version, () => {
            this.skillStage = SkillStage.Skill2;
            this.playSkillWindup(Boss0SkillAnimName.skill2, skill2Speed, version, () => {
                this.clearSkillRange();
                this.skillStage = SkillStage.Active;
                this.skillRemaining = this.skillDuration;
                this.skillTickRemaining = this.skillInterval;
                this.playAnimation(BossAnimName.idle, true, true);
                this.showWhirlwind();
            });
        });
        return true;
    }

    /** 前摇使用动画完成回调，倍率只作用于当前动画轨道。 */
    private playSkillWindup(name: Boss0SkillAnimName, speed: number, version: number, complete: () => void) {
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
        if (this.whirlwindNode?.isValid) {
            this.whirlwindNode.getComponent(Animation)?.stop();
            this.whirlwindNode.active = false;
        }
        if (this.roleAnim?.isValid) this.roleAnim.node.active = true;
        this.skillVersion++;
        this.skillStage = SkillStage.None;
        this.skillRemaining = 0;
        this.skillTickRemaining = 0;
        this.isInSkillRange = false;
    }

    /** 首次创建后保留，后续技能只重播并切换显隐。 */
    private showWhirlwind(): void {
        if (!this.effectNode?.isValid || !uiMgr.whirlwindPrefab) return;
        if (!this.whirlwindNode?.isValid) {
            this.whirlwindNode = instantiate(uiMgr.whirlwindPrefab);
            this.effectNode.addChild(this.whirlwindNode);
            this.whirlwindNode.layer = this.effectNode.layer;
        }
        this.whirlwindNode.setPosition(0, 104, 0);
        this.effectNode.active = true;
        this.whirlwindNode.active = true;
        const animation = this.whirlwindNode.getComponent(Animation);
        const clip = animation?.defaultClip;
        if (clip) {
            const state = animation.getState(clip.name);
            state.wrapMode = AnimationClip.WrapMode.Loop;
            animation.play(clip.name);
        }
        if (this.roleAnim) this.roleAnim.node.active = false;
    }

    /** Show the warning below the Boss throughout both windup animations. */
    private showSkillRange(duration: number): void {
        this.clearSkillRange();
        if (!uiMgr.skillRangeCirclePrefab) return;
        this.skillRangeNode = instantiate(uiMgr.skillRangeCirclePrefab);
        this.node.addChild(this.skillRangeNode);
        this.skillRangeNode.setPosition(0, 0, 0);
        this.skillRangeNode.setSiblingIndex(0);
        const controller = this.skillRangeNode.getComponent(skillRangeCircleController)
            ?? this.skillRangeNode.addComponent(skillRangeCircleController);
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
        if (!this.isInSkillRange) this.moveToward(target, dt, BossAnimName.idle, this.moveSpeed * (1 + this.skillSpeed));
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
        if (this.intersectsPlayerHitArea(this.skillRadius)) {
            player.takeDamage(1 + 0.1 * this.attackDamage);
        }
    }
}
