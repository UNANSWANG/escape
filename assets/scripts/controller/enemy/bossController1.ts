import { _decorator, instantiate, Node, sp, Tween, UITransform, Vec3 } from 'cc';
import { BossAnimName, bossBaseController } from './bossBaseController';
import { commonConfig } from '../../json/jsonCommon';
import { bossConfig } from '../../json/jsonBoss';
import { ccTools } from '../../extention/generalTools';
import { GameEvent } from '../../manager/configData';
import { gm } from '../../manager/gm';
import { playerMgr } from '../../manager/playerManager';
import { spinePath } from '../../manager/pathConfig';
import { uiMgr } from '../../manager/UIManager';
import { skillRangeRectController } from '../indicator/skillRangeRectController';
const { ccclass } = _decorator;

/** 本 Boss 专属技能动画。 */
enum Boss1SkillAnimName {
    /** 技能起手：原地播放一次，完成后进入蓄力并显示范围。 */
    skill1 = 'skill1',
    /** 蓄力：原地循环播放，范围预警在 Boss 表 chargeTime 秒内填满。 */
    skill2 = 'skill2',
    /** 释放前动作：范围预警完成后播放一次，完成后开始剑雨。 */
    skill3 = 'skill3',
    /** 释放剑雨：原地循环 Boss 表 duration 秒，期间造成范围伤害并获得减伤。 */
    skill4 = 'skill4',
    /** 技能收招：原地播放一次，完成后恢复追击、普攻和怒气积攒。 */
    skill5 = 'skill5',
}

enum SkillStage { None, Start, Prepare, Release, Active, Finish }

/** Boss1：站定蓄力后释放剑雨，剑雨期间获得减伤。 */
@ccclass('bossController1')
export class bossController1 extends bossBaseController {
    id = 1;
    private skillArea: UITransform = null;
    private skillPrepare = 0;
    private skillDuration = 0;
    private skillReduce = 0;
    private skillStage = SkillStage.None;
    private skillRemaining = 0;
    private tickRemaining = 0;
    private skillVersion = 0;
    private rangeNode: Node = null;
    private rainNode: Node = null;
    private rainSkeleton: sp.Skeleton = null;
    private pausedRoleSpeed: number = null;

    get isUsingSkill(): boolean { return this.skillStage !== SkillStage.None; }

    protected onLoad(): void {
        super.onLoad();
        this.skillArea = this.node.getChildByName('skillArea')?.getComponent(UITransform);
        gm.Event?.on(GameEvent.gamePause, this.pauseSkillEffects, this);
        gm.Event?.on(GameEvent.gameResume, this.resumeSkillEffects, this);
    }

    protected initData(): void {
        super.initData();
        const data = bossConfig.getDataById(this.id);
        const prepare = data?.chargeTime;
        const duration = data?.duration;
        const reduce = commonConfig.getValueNumber('boss1SkillReduce');
        this.skillPrepare = Number.isFinite(prepare) ? Math.max(0, prepare) : 0;
        this.skillDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
        this.skillReduce = Number.isFinite(reduce) ? Math.max(0, Math.min(1, reduce / 100)) : 0;
    }

    protected startSkill(): boolean {
        if (this.isUsingSkill || this.skillDuration <= 0 || !this.skillArea
            || !this.bottomEffect || !uiMgr.skillRangeRectPrefab || !uiMgr.gameSpineItemPrefab) return false;
        this.clearNavigationPath();
        this.skillVersion++;
        this.skillStage = SkillStage.Start;
        this.playSkillOnce(Boss1SkillAnimName.skill1, () => {
            this.skillStage = SkillStage.Prepare;
            this.skillRemaining = this.skillPrepare;
            this.playAnimation(Boss1SkillAnimName.skill2, true, true);
            this.showRange();
            if (this.skillRemaining <= 0) this.startRelease();
        });
        return true;
    }

    /** 蓄力、释放和收招期间均站定，禁止基类移动逻辑覆盖技能动画。 */
    protected chaseDuringSkill(_target: Vec3, _dt: number): void {}

    protected updateSkill(dt: number): void {
        let elapsed = Math.max(0, dt);
        if (this.skillStage === SkillStage.Prepare) {
            const step = Math.min(elapsed, this.skillRemaining);
            this.skillRemaining = Math.max(0, this.skillRemaining - step);
            elapsed -= step;
            if (this.skillRemaining > 1e-9) return;
            this.startRelease();
            return;
        }
        if (this.skillStage !== SkillStage.Active) return;
        const step = Math.min(elapsed, this.skillRemaining);
        this.skillRemaining = Math.max(0, this.skillRemaining - step);
        this.tickRemaining -= step;
        while (this.tickRemaining <= 1e-9 && this.skillStage === SkillStage.Active) {
            this.tickRemaining += 0.1;
            this.damageInArea();
        }
        if (this.skillRemaining <= 1e-9) this.finishSwordRain();
    }

    /** 减伤只覆盖剑雨释放阶段，蓄力与收招不减伤。 */
    takeDamage(damage: number) {
        return super.takeDamage(this.skillStage === SkillStage.Active ? damage * (1 - this.skillReduce) : damage);
    }

    private showRange(): void {
        this.rangeNode = instantiate(uiMgr.skillRangeRectPrefab);
        this.skillArea.node.addChild(this.rangeNode);
        this.rangeNode.layer = this.skillArea.node.layer;
        // UITransform 的矩形中心可能与节点原点不同。
        this.rangeNode.setPosition(
            (0.5 - this.skillArea.anchorX) * this.skillArea.width,
            (0.5 - this.skillArea.anchorY) * this.skillArea.height, 0);
        const controller = this.rangeNode.getComponent(skillRangeRectController)
            ?? this.rangeNode.addComponent(skillRangeRectController);
        controller.init(this.skillArea.width, this.skillArea.height, this.skillPrepare);
    }

    /** 单次动作按实际播放完成切换阶段，中断或重新释放后旧回调失效。 */
    private playSkillOnce(name: Boss1SkillAnimName, complete: () => void): void {
        const version = this.skillVersion;
        const stage = this.skillStage;
        let completed = false;
        const finish = () => {
            if (completed || !this.isValid || this.hp <= 0 || version !== this.skillVersion
                || this.skillStage !== stage) return;
            completed = true;
            complete();
        };
        const entry = this.playAnimation(name, false, true);
        if (entry) this.roleAnim.setTrackCompleteListener(entry, finish);
        else finish();
    }

    /** 预警填满后先播放释放动作，完成后进入剑雨持续阶段。 */
    private startRelease(): void {
        this.clearRange();
        this.skillStage = SkillStage.Release;
        this.playSkillOnce(Boss1SkillAnimName.skill3, () => this.startSwordRain());
    }

    private startSwordRain(): void {
        this.clearRange();
        this.skillStage = SkillStage.Active;
        this.skillRemaining = this.skillDuration;
        this.tickRemaining = 0.1;
        this.playAnimation(Boss1SkillAnimName.skill4, true, true);
        this.rainNode = instantiate(uiMgr.gameSpineItemPrefab);
        this.bottomEffect.addChild(this.rainNode);
        this.rainNode.layer = this.bottomEffect.layer;
        this.rainNode.setPosition(0, 0, 0);
        this.rainSkeleton = this.rainNode.getComponent(sp.Skeleton);
        if (this.rainSkeleton) void this.loadSwordRain(this.rainSkeleton, this.skillVersion);
    }

    private async loadSwordRain(skeleton: sp.Skeleton, version: number): Promise<void> {
        try {
            const loaded = await ccTools.loadSpine(skeleton, spinePath.swordRain);
            if (!loaded || !this.isValid || version !== this.skillVersion
                || this.skillStage !== SkillStage.Active || !skeleton.isValid) return;
            skeleton.timeScale = gm.isGamePause ? 0 : 1;
            skeleton.setAnimation(0, 'animation', true);
        } catch (error) {
            console.warn('Boss1 剑雨特效加载失败', error);
        }
    }

    /** 每 0.1 秒检查玩家受击区域，按剑雨范围结算一次伤害。 */
    private damageInArea(): void {
        const player = playerMgr.playerComp;
        if (!player?.node?.isValid || !player.node.activeInHierarchy || player.hp <= 0 || !player.hitArea) return;
        if (this.skillArea.getBoundingBoxToWorld().intersects(player.hitArea.getBoundingBoxToWorld())) {
            player.takeDamage(1 + this.attackDamage * 0.1);
        }
    }

    private finishSwordRain(): void {
        this.clearRain();
        this.skillStage = SkillStage.Finish;
        this.playSkillOnce(Boss1SkillAnimName.skill5, () => {
            this.stopSkill();
            this.playAnimation(BossAnimName.idle, true, true);
        });
    }

    private clearRange(): void {
        if (this.rangeNode?.isValid) {
            this.rangeNode.active = false;
            this.rangeNode.destroy();
        }
        this.rangeNode = null;
    }

    private clearRain(): void {
        if (this.rainSkeleton?.isValid) {
            ccTools.cancelAssetLoad(this.rainSkeleton);
            this.rainSkeleton.clearTracks();
        }
        if (this.rainNode?.isValid) {
            this.rainNode.active = false;
            this.rainNode.destroy();
        }
        this.rainNode = null;
        this.rainSkeleton = null;
    }

    protected stopSkill(): void {
        this.resumeSkillEffects();
        this.skillVersion++;
        this.skillStage = SkillStage.None;
        this.skillRemaining = 0;
        this.tickRemaining = 0;
        this.clearRange();
        this.clearRain();
    }

    private pauseSkillEffects(): void {
        if (!this.isUsingSkill) return;
        if (this.roleAnim?.isValid && this.pausedRoleSpeed === null) {
            this.pausedRoleSpeed = this.roleAnim.timeScale;
            this.roleAnim.timeScale = 0;
        }
        if (this.rainSkeleton?.isValid) this.rainSkeleton.timeScale = 0;
        const bg = this.rangeNode?.getChildByName('bg')?.getComponent(UITransform);
        if (bg) Tween.pauseAllByTarget(bg);
    }

    private resumeSkillEffects(): void {
        if (this.roleAnim?.isValid && this.pausedRoleSpeed !== null) this.roleAnim.timeScale = this.pausedRoleSpeed;
        this.pausedRoleSpeed = null;
        if (this.rainSkeleton?.isValid) this.rainSkeleton.timeScale = 1;
        const bg = this.rangeNode?.getChildByName('bg')?.getComponent(UITransform);
        if (bg) Tween.resumeAllByTarget(bg);
    }

    protected onDisable(): void {
        this.stopSkill();
        super.onDisable();
    }

    protected onDestroy(): void {
        gm.Event?.off(GameEvent.gamePause, this.pauseSkillEffects, this);
        gm.Event?.off(GameEvent.gameResume, this.resumeSkillEffects, this);
        this.stopSkill();
        super.onDestroy();
    }
}
