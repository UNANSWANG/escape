import { _decorator, Animation, Color, instantiate, Node, sp, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { roleAnimName, roleController, roleType } from './roleController';
import { enemyMgr } from '../../manager/enemyManager';
import { gm } from '../../manager/gm';
import { uiMgr } from '../../manager/UIManager';
import { ccTools } from '../../extention/generalTools';
import { imgPath, spinePath } from '../../manager/pathConfig';
import { ccResTools } from '../../extention/resTools';
import { GameEvent } from '../../manager/configData';
import type { EnemyTarget } from '../../manager/enemyManager';
const { ccclass, property } = _decorator;

/**技能2倒计时变更事件，参数依次为剩余秒数和是否显示。 */
export const role0Skill2RemainEvent = 'role0-skill2-remain-update';

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
    private shovelSmokeNode: Node = null;
    private shovelSmokeAnim: Animation = null;
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
    /**技能2提供的视野加成百分比（initiativeValue 第四项）。 */
    private skill2ViewPercent = 0;
    /**已记录死亡的敌人，避免同一敌人重复结算。 */
    private defeatedEnemies = new Set<EnemyTarget>();
    /**主动技能前摇期间保留节点，防止重复释放和异步加载串入下一次技能。 */
    private skill2EffectNode: Node = null;
    private skill2EffectSpine: sp.Skeleton = null;
    private skill2MoveTween: Tween<Node> = null;
    /**角色颜色 */
    private roleColor: string = "#F7BFBF";
    private ghostSpriteFrame: SpriteFrame = null;
    private ghostElapsed = 0;
    private ghostLastWorldPos = new Vec3();
    /** 根据位置历史插值得到 0.02 秒前的位置。 */
    private ghostPreviousSpawnWorldPos = new Vec3();
    private ghostHistoryTime = 0;
    private ghostPositionHistory: { time: number; position: Vec3 }[] = [];
    private ghostWorldPos = new Vec3();
    private ghostWorldScale = new Vec3();
    private ghostParentWorldScale = new Vec3();
    private ghosts: { node: Node; opacity: UIOpacity; remain: number }[] = [];

    protected onLoad(): void {
        super.onLoad();
        gm.Event.on(GameEvent.gamePause, this.pauseSkill2Animation, this);
        gm.Event.on(GameEvent.gameResume, this.resumeSkill2Animation, this);
    }

    protected onDestroy(): void {
        this.clearShovelSmoke();
        this.clearGhosts();
        gm.Event.off(GameEvent.gamePause, this.pauseSkill2Animation, this);
        gm.Event.off(GameEvent.gameResume, this.resumeSkill2Animation, this);
        super.onDestroy();
    }

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
        if (!this.isAI && !this.gameComp?.hasMoveDirectionInput()) return false;
        if (this.isUsingSkill1 || this.isSkillCooling(1) || !this.roleAnim?.skeletonData) return false;

        const entry = this.roleAnim.setAnimation(0, roleAnimName.useSkill1, false);
        if (!entry) return false;

        this.isUsingSkill1 = true;
        this.playShovelSmoke();
        entry.timeScale = Math.max(0.01, this.skill1TimeScale);
        this.curRoleAnimName = roleAnimName.useSkill1;
        this.roleAnim.setTrackCompleteListener(entry, () => this.finishSkill1());
        this.startSkillCooldown(1);
        return true;
    }

    /** 滑铲烟雾使用 effectNode 的本地坐标。 */
    private playShovelSmoke(): void {
        this.clearShovelSmoke();
        if (!this.effectNode?.activeInHierarchy || !uiMgr.shovelSmokePrefab) return;
        const smoke = instantiate(uiMgr.shovelSmokePrefab);
        this.shovelSmokeNode = smoke;
        this.effectNode.addChild(smoke);
        // 默认朝左；朝右滑铲时，烟雾方向和水平偏移一起镜像。
        const directionScale = this.roleAnim.node.scale.x < 0 ? -1 : 1;
        smoke.setPosition(40 * directionScale, 4, 0);
        smoke.setScale(smoke.scale.x * directionScale, smoke.scale.y, smoke.scale.z);
        this.shovelSmokeAnim = smoke.getComponent(Animation);
        this.shovelSmokeAnim?.play();
        if (gm.isGamePause) this.shovelSmokeAnim?.pause();
    }

    private clearShovelSmoke(): void {
        if (this.shovelSmokeAnim?.isValid) this.shovelSmokeAnim.stop();
        if (this.shovelSmokeNode?.isValid) this.shovelSmokeNode.destroy();
        this.shovelSmokeAnim = null;
        this.shovelSmokeNode = null;
    }

    initData(): void {
        this.skill1Cooldown = this.roleLevelData?.passiveCd ?? 15;
        this.skill2Cooldown = this.roleLevelData?.initiativeCd ?? 50;
        const values = this.getInitiativeValues();
        this.skill2MoveSpeedPercent = values[0] ?? 0;
        this.skill2KillHealPercent = (values[1] ?? 0) / 100;
        this.skill2KillExtendTime = values[2] ?? 0;
        this.skill2ViewPercent = Math.max(0, values[3] ?? 0);
    }

    /**释放时进入冷却，宝石动画结束后才开始技能效果及持续时间。 */
    useSkill2() {
        if (this.hp <= 0 || this.isUsingSkill2 || this.skill2EffectNode || this.isSkillCooling(2)
            || !this.effectNode?.activeInHierarchy || !uiMgr.gameSpineItemPrefab) return false;

        this.skill2Duration = Math.max(0, this.roleLevelData?.initiativeTime ?? 0);
        if (this.skill2Duration <= 0) return false;

        const effect = instantiate(uiMgr.gameSpineItemPrefab);
        const skeleton = effect.getComponent(sp.Skeleton);
        if (!skeleton) {
            effect.destroy();
            return false;
        }
        this.skill2EffectNode = effect;
        this.skill2EffectSpine = skeleton;
        this.effectNode.addChild(effect);
        effect.setPosition(0, 140, 0);
        this.startSkillCooldown(2);
        void this.playSkill2Animation(effect, skeleton);
        return true;
    }

    private async playSkill2Animation(effect: Node, skeleton: sp.Skeleton): Promise<void> {
        try {
            const loaded = await ccTools.loadSpine(skeleton, spinePath.gem, false);
            if (this.skill2EffectNode !== effect || !effect.isValid) return;
            if (!loaded || !skeleton.findAnimation('animation') || !skeleton.findAnimation('animation2')) {
                this.clearSkill2Animation();
                return;
            }
            skeleton.timeScale = gm.isGamePause ? 0 : 1;
            skeleton.setAnimation(0, 'animation', false);
            this.skill2MoveTween = tween(effect)
                .to(0.2, { position: new Vec3(0, 65, 0) })
                .call(() => {
                    this.skill2MoveTween = null;
                    const entry = skeleton.setAnimation(0, 'animation2', false);
                    entry.timeScale = 1.5;
                    skeleton.setTrackCompleteListener(entry, () => {
                        if (this.skill2EffectNode !== effect) return;
                        this.clearSkill2Animation();
                        if (this.hp > 0 && this.node.activeInHierarchy) this.activateSkill2();
                    });
                })
                .start();
            if (gm.isGamePause) this.pauseSkill2Animation();
        } catch (error) {
            if (this.skill2EffectNode === effect) this.clearSkill2Animation();
            console.warn('role0 主动技能宝石动画加载失败', error);
        }
    }

    /**动画播放期间的击杀不计入技能效果。 */
    private activateSkill2(): void {
        this.isUsingSkill2 = true;
        if (this.isPlayer) this.gameComp?.setSkillViewScale(1 + this.skill2ViewPercent / 100);
        this.refreshSkillColor();
        this.ghostElapsed = 0;
        this.node.getWorldPosition(this.ghostLastWorldPos);
        this.roleAnim.node.getWorldPosition(this.ghostPreviousSpawnWorldPos);
        this.ghostHistoryTime = 0;
        this.ghostPositionHistory = [{ time: 0, position: this.ghostPreviousSpawnWorldPos.clone() }];
        void ccResTools.loadPic(uiMgr.resBundle, imgPath.ghost).then((frame) => {
            if (this.isValid) this.ghostSpriteFrame = frame;
        });
        this.skill2RemainTime = this.skill2Duration;
        // 技能开始前已死亡的敌人不能触发本次技能效果。
        this.rememberDefeatedEnemies();
        this.emitSkill2Remain();
    }

    private pauseSkill2Animation(): void {
        if (this.shovelSmokeAnim?.isValid) this.shovelSmokeAnim.pause();
        this.skill2MoveTween?.pause();
        if (this.skill2EffectSpine?.isValid) this.skill2EffectSpine.timeScale = 0;
    }

    private resumeSkill2Animation(): void {
        if (this.shovelSmokeAnim?.isValid) this.shovelSmokeAnim.resume();
        this.skill2MoveTween?.resume();
        if (this.skill2EffectSpine?.isValid) this.skill2EffectSpine.timeScale = 1;
    }

    private clearSkill2Animation(): void {
        this.skill2MoveTween?.stop();
        this.skill2MoveTween = null;
        const effect = this.skill2EffectNode;
        const skeleton = this.skill2EffectSpine;
        this.skill2EffectNode = null;
        this.skill2EffectSpine = null;
        if (skeleton?.isValid) {
            ccTools.cancelAssetLoad(skeleton);
            skeleton.setCompleteListener(null);
        }
        if (effect?.isValid) effect.destroy();
    }

    protected update(dt: number): void {
        if (gm.isGamePause) return;
        super.update(dt);
        this.updateSkill2(dt);
    }

    protected onDisable(): void {
        super.onDisable();
        this.clearGhosts();
        this.clearSkill2Animation();
        this.finishSkill1();
        this.finishSkill2();
    }

    playDeath(onComplete?: () => void) {
        this.clearGhosts();
        this.clearSkill2Animation();
        this.finishSkill1();
        this.finishSkill2();
        super.playDeath(onComplete);
    }

    /** 在移动完成后采样位置；残影与角色分离，使用游戏时间计时。 */
    protected lateUpdate(dt: number): void {
        super.lateUpdate(dt);
        if (gm.isGamePause || dt <= 0) return;
        for (let index = this.ghosts.length - 1; index >= 0; index--) {
            const ghost = this.ghosts[index];
            ghost.remain -= dt;
            // 0.08 秒渐显到 200，保持 0.3 秒，再用 0.6 秒淡出。
            if (ghost.opacity.isValid) {
                const elapsed = 0.98 - ghost.remain;
                const opacityRatio = elapsed < 0.08
                    ? elapsed / 0.08
                    : (elapsed < 0.38 ? 1 : ghost.remain / 0.6);
                ghost.opacity.opacity = 200 * Math.max(0, Math.min(1, opacityRatio));
            }
            if (ghost.remain <= 1e-6 || !ghost.node.isValid) {
                if (ghost.node.isValid) ghost.node.destroy();
                this.ghosts.splice(index, 1);
            }
        }
        if (!this.isUsingSkill2) return;
        this.ghostHistoryTime += dt;
        this.ghostPositionHistory.push({
            time: this.ghostHistoryTime,
            position: this.roleAnim.node.worldPosition.clone(),
        });
        const sampleTime = this.ghostHistoryTime - 0.02;
        // 保留目标时刻前后各一个采样点，兼容不同帧率。
        while (this.ghostPositionHistory.length > 2 && this.ghostPositionHistory[1].time <= sampleTime) {
            this.ghostPositionHistory.shift();
        }
        const first = this.ghostPositionHistory[0];
        const second = this.ghostPositionHistory[1];
        const ratio = second && second.time > first.time
            ? Math.max(0, Math.min(1, (sampleTime - first.time) / (second.time - first.time))) : 0;
        Vec3.lerp(this.ghostPreviousSpawnWorldPos, first.position, second?.position ?? first.position, ratio);
        this.node.getWorldPosition(this.ghostWorldPos);
        const moved = Vec3.squaredDistance(this.ghostWorldPos, this.ghostLastWorldPos) > 1e-6;
        this.ghostLastWorldPos.set(this.ghostWorldPos);
        if (!moved) {
            this.ghostElapsed = 0;
            return;
        }
        this.ghostElapsed += dt;
        if (this.ghostElapsed >= 0.12 - 1e-6) {
            this.ghostElapsed = Math.max(0, this.ghostElapsed - 0.12) % 0.12;
            this.spawnGhost(this.ghostPreviousSpawnWorldPos);
        }
    }

    private spawnGhost(worldPosition: Vec3): void {
        const parent = this.gameComp?.gameUINode;
        if (!parent?.activeInHierarchy || !this.ghostSpriteFrame || !this.roleAnim?.isValid
            || !uiMgr.gameSpriteItemPrefab) return;
        const ghost = instantiate(uiMgr.gameSpriteItemPrefab);
        const transform = ghost.getComponent(UITransform);
        const sprite = ghost.getComponent(Sprite);
        if (!transform || !sprite) {
            ghost.destroy();
            return;
        }
        ghost.layer = parent.layer;
        transform.setAnchorPoint(0.5, 0);
        sprite.spriteFrame = this.ghostSpriteFrame;
        parent.addChild(ghost);
        ghost.setWorldPosition(worldPosition);
        ghost.setPosition(ghost.position.x, ghost.position.y - 5, ghost.position.z);
        ghost.setWorldRotation(this.roleAnim.node.worldRotation);
        // 残影图片使用人物根节点的缩放，避免叠加 roleAnim 的 0.65 美术缩放。
        this.node.getWorldScale(this.ghostWorldScale);
        parent.getWorldScale(this.ghostParentWorldScale);
        ghost.setScale(
            this.ghostWorldScale.x * (this.roleAnim.node.scale.x < 0 ? -1 : 1) / (this.ghostParentWorldScale.x || 1),
            this.ghostWorldScale.y / (this.ghostParentWorldScale.y || 1),
            1,
        );
        const opacity = ghost.getComponent(UIOpacity) ?? ghost.addComponent(UIOpacity);
        opacity.opacity = 0;
        this.ghosts.push({ node: ghost, opacity, remain: 0.98 });
    }

    private clearGhosts(): void {
        for (const ghost of this.ghosts) {
            if (ghost.node.isValid) ghost.node.destroy();
        }
        this.ghosts.length = 0;
        this.ghostElapsed = 0;
        this.ghostPositionHistory.length = 0;
        this.ghostHistoryTime = 0;
    }

    /**将角色等级表的主动数值兼容解析为数值数组。 */
    private getInitiativeValues() {
        const rawValue: unknown = this.roleLevelData?.initiativeValue;
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
        if (this.skill2RemainTime <= 0) {
            this.finishSkill2();
            return;
        }
        this.emitSkill2Remain();
    }

    /**记录当前已死亡的敌人，或结算技能期间首次死亡的敌人。 */
    private rememberDefeatedEnemies() {
        for (const enemy of enemyMgr.allEnemies) {
            if (enemy?.hp <= 0) this.defeatedEnemies.add(enemy);
        }
    }

    /**检查技能2生效期间的新击杀。 */
    private checkSkill2EnemyDefeats() {
        for (const enemy of enemyMgr.allEnemies) {
            if (!enemy || enemy.hp > 0 || this.defeatedEnemies.has(enemy)) continue;

            this.defeatedEnemies.add(enemy);
            this.onSkill2KillEnemy();
        }
    }

    /**处理技能2击杀奖励：恢复最大生命值百分比，并延长剩余时间但不超过原始时长。 */
    private onSkill2KillEnemy() {
        if (this.skill2KillHealPercent > 0) {
            this.heal(this.maxHp * this.skill2KillHealPercent);
        }

        if (this.skill2KillExtendTime > 0) {
            this.skill2RemainTime = Math.min(this.skill2Duration, this.skill2RemainTime + this.skill2KillExtendTime);
        }
    }

    /**结束技能2并清理本次生效状态。 */
    private finishSkill2() {
        const wasUsingSkill2 = this.isUsingSkill2 || this.skill2RemainTime > 0;
        this.isUsingSkill2 = false;
        this.refreshSkillColor();
        this.skill2RemainTime = 0;
        this.defeatedEnemies.clear();
        if (wasUsingSkill2) {
            if (this.isPlayer) this.gameComp?.setSkillViewScale(1);
            this.emitSkill2Remain();
        }
    }

    /**派发技能2的实时剩余时间，由游戏界面负责显示或隐藏倒计时。 */
    private emitSkill2Remain() {
        this.node.emit(role0Skill2RemainEvent, this.skill2RemainTime, this.isUsingSkill2);
    }

    /**技能1动画结束，恢复普通动画控制权。 */
    private finishSkill1() {
        this.clearShovelSmoke();
        if (!this.isUsingSkill1) return;
        this.isUsingSkill1 = false;
        this.curRoleAnimName = '';
    }

    /** 仅技能2生效期间使用技能色，结束后恢复白色。 */
    private refreshSkillColor(): void {
        if (!this.roleAnim?.isValid) return;
        this.roleAnim.color = new Color(this.isUsingSkill2 ? this.roleColor : '#FFFFFF');
    }
}
