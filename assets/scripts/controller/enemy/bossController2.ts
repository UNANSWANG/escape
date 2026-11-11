import { _decorator, Animation, AnimationClip, instantiate, Node, Sprite, Tween, UITransform, Vec3 } from 'cc';
import { BossAnimName, bossBaseController } from './bossBaseController';
import { bossConfig } from '../../json/jsonBoss';
import { commonConfig } from '../../json/jsonCommon';
import { GameEvent } from '../../manager/configData';
import { gm } from '../../manager/gm';
import { playerMgr } from '../../manager/playerManager';
import { uiMgr } from '../../manager/UIManager';
import { skillRangeRectLeftController } from '../indicator/skillRangeRectLeftController';
const { ccclass } = _decorator;

enum SkillStage { None, Start, Prepare, Active, Finish }

@ccclass('bossController2')
export class bossController2 extends bossBaseController {
    id = 2;
    private skillStage = SkillStage.None;
    private chargeTime = 0;
    private duration = 0;
    private turnSpeed = 0;
    private remaining = 0;
    private tickRemaining = 0;
    private skillVersion = 0;
    private direction = 0;
    private skillRoot: Node = null;
    private rangeNode: Node = null;
    private breathNode: Node = null;
    private damageArea: UITransform = null;
    private pausedRoleSpeed: number = null;
    private readonly beadPosition = new Vec3();
    private readonly playerLocal = new Vec3();

    get isUsingSkill(): boolean { return this.skillStage !== SkillStage.None; }

    protected onLoad(): void {
        super.onLoad();
        gm.Event?.on(GameEvent.gamePause, this.pauseSkill, this);
        gm.Event?.on(GameEvent.gameResume, this.resumeSkill, this);
    }

    protected initData(): void {
        super.initData();
        const data = bossConfig.getDataById(this.id);
        this.chargeTime = Number.isFinite(data?.chargeTime) ? Math.max(0, data.chargeTime) : 0;
        this.duration = Number.isFinite(data?.duration) ? Math.max(0, data.duration) : 0;
        const speed = commonConfig.getValueNumber('boss2SkillSpeed');
        this.turnSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    }

    protected startSkill(): boolean {
        if (this.isUsingSkill || this.duration <= 0 || !this.roleAnim?.findBone('bead')
            || !uiMgr.skillRangeRectLeftPrefab || !uiMgr.dragonBreathPrefab) return false;
        this.clearNavigationPath();
        this.skillVersion++;
        this.skillStage = SkillStage.Start;
        this.playOnce('skill1', () => this.startPrepare());
        return true;
    }

    protected chaseDuringSkill(_target: Vec3, _dt: number): void {}

    protected lateUpdate(): void {
        if (!gm.isGamePause && (this.skillStage === SkillStage.Prepare || this.skillStage === SkillStage.Active)) {
            this.updateAim(0);
        }
    }

    private playOnce(name: string, complete: () => void): void {
        const version = this.skillVersion;
        const stage = this.skillStage;
        let completed = false;
        const finish = () => {
            if (completed || !this.isValid || this.hp <= 0 || this.skillVersion !== version
                || this.skillStage !== stage) return;
            completed = true;
            complete();
        };
        const entry = this.playAnimation(name, false, true);
        if (entry) this.roleAnim.setTrackCompleteListener(entry, finish);
        else finish();
    }

    private startPrepare(): void {
        this.skillStage = SkillStage.Prepare;
        this.remaining = this.chargeTime;
        this.playAnimation('skill2', true, true);
        this.skillRoot = new Node('dragonBreathSkill');
        this.skillRoot.layer = this.node.layer;
        this.skillRoot.addComponent(UITransform);
        this.node.addChild(this.skillRoot);
        const area = uiMgr.dragonBreathPrefab.data.getChildByName('skillArea')?.getComponent(UITransform);
        if (!area) {
            this.stopSkill();
            this.playAnimation(BossAnimName.idle, true, true);
            return;
        }
        this.rangeNode = instantiate(uiMgr.skillRangeRectLeftPrefab);
        this.skillRoot.addChild(this.rangeNode);
        // skillRoot 已同步到 bead，指示器以左侧中点为起点，无需矩形中心偏移。
        this.rangeNode.setPosition(0, 0, 0);
        const controller = this.rangeNode.getComponent(skillRangeRectLeftController)
            ?? this.rangeNode.addComponent(skillRangeRectLeftController);
        controller.init(area.width, area.height, this.chargeTime);
        this.updateAim(0, true);
        if (this.remaining <= 0) this.startBreath();
    }

    protected updateSkill(dt: number): void {
        if (this.skillStage !== SkillStage.Prepare && this.skillStage !== SkillStage.Active) return;
        let elapsed = Math.max(0, dt);
        if (this.skillStage === SkillStage.Prepare) {
            const step = Math.min(elapsed, this.remaining);
            this.updateAim(step);
            this.remaining = Math.max(0, this.remaining - step);
            elapsed -= step;
            if (this.remaining > 1e-9) return;
            this.startBreath();
        }
        if (this.skillStage !== SkillStage.Active) return;
        while (elapsed > 0 && this.remaining > 1e-9) {
            const step = Math.min(elapsed, this.remaining, this.tickRemaining);
            this.updateAim(step);
            this.remaining = Math.max(0, this.remaining - step);
            this.tickRemaining -= step;
            elapsed -= step;
            if (this.tickRemaining <= 1e-9) {
                this.tickRemaining = 0.2;
                this.damagePlayer();
            }
        }
        if (this.remaining <= 1e-9) this.finishBreath();
    }

    private updateAim(dt: number, immediate = false): void {
        const bone = this.roleAnim?.findBone('bead');
        const roleTransform = this.roleAnim?.node.getComponent(UITransform);
        const transform = this.node.getComponent(UITransform);
        if (!bone || !roleTransform || !transform || !this.skillRoot?.isValid) return;
        roleTransform.convertToWorldSpaceAR(this.beadPosition.set(bone.worldX, bone.worldY, 0), this.beadPosition);
        transform.convertToNodeSpaceAR(this.beadPosition, this.beadPosition);
        this.skillRoot.setPosition(this.beadPosition);
        const player = playerMgr.playerComp;
        if (player?.node?.isValid && player.hp > 0) {
            transform.convertToNodeSpaceAR(player.node.worldPosition, this.playerLocal);
            const dx = this.playerLocal.x - this.beadPosition.x;
            const dy = this.playerLocal.y - this.beadPosition.y;
            if (dx * dx + dy * dy > 1e-9) {
                const target = Math.atan2(dy, dx) * 180 / Math.PI;
                const delta = ((target - this.direction) % 360 + 540) % 360 - 180;
                const step = this.turnSpeed * dt;
                this.direction = immediate ? target : this.direction + Math.max(-step, Math.min(step, delta));
                this.direction = ((this.direction % 360) + 360) % 360;
            }
        }
        this.skillRoot.angle = this.direction;
    }

    private startBreath(): void {
        this.skillStage = SkillStage.Active;
        this.remaining = this.duration;
        this.tickRemaining = 0.2;
        if (this.rangeNode?.isValid) {
            this.rangeNode.active = false;
            this.rangeNode.destroy();
        }
        this.rangeNode = null;
        this.breathNode = instantiate(uiMgr.dragonBreathPrefab);
        this.skillRoot.addChild(this.breathNode);
        this.breathNode.setPosition(0, 0, 0);
        this.damageArea = this.breathNode.getChildByName('skillArea')?.getComponent(UITransform);
        const animation = this.breathNode.getComponent(Animation);
        const clip = animation?.defaultClip;
        if (clip) {
            animation.getState(clip.name).wrapMode = AnimationClip.WrapMode.Loop;
            animation.play(clip.name);
        }
    }

    private damagePlayer(): void {
        const player = playerMgr.playerComp;
        if (!player?.node?.isValid || !player.node.activeInHierarchy || player.hp <= 0 || !player.hitArea) return;
        const area = this.damageArea;
        const bounds = player.hitArea.getBoundingBoxToWorld();
        const corners = [new Vec3(bounds.xMin, bounds.yMin), new Vec3(bounds.xMax, bounds.yMin),
            new Vec3(bounds.xMax, bounds.yMax), new Vec3(bounds.xMin, bounds.yMax)]
            .map(point => area.convertToNodeSpaceAR(point));
        const minX = -area.anchorX * area.width;
        const maxX = minX + area.width;
        const minY = -area.anchorY * area.height;
        const maxY = minY + area.height;
        const areaCorners = [new Vec3(minX, minY), new Vec3(maxX, minY),
            new Vec3(maxX, maxY), new Vec3(minX, maxY)];
        const edge = corners[1].clone().subtract(corners[0]);
        const side = corners[3].clone().subtract(corners[0]);
        const axes = [new Vec3(1, 0), new Vec3(0, 1), new Vec3(-edge.y, edge.x), new Vec3(-side.y, side.x)];
        for (const axis of axes) {
            const playerProjection = corners.map(point => point.x * axis.x + point.y * axis.y);
            const areaProjection = areaCorners.map(point => point.x * axis.x + point.y * axis.y);
            if (Math.max(...playerProjection) < Math.min(...areaProjection)
                || Math.max(...areaProjection) < Math.min(...playerProjection)) return;
        }
        player.takeDamage(1 + this.attackDamage * 0.1);
    }

    private finishBreath(): void {
        this.clearEffects();
        this.skillStage = SkillStage.Finish;
        this.playOnce('skill2', () => {
            this.stopSkill();
            this.playAnimation(BossAnimName.idle, true, true);
        });
    }

    private clearEffects(): void {
        this.breathNode?.getComponent(Animation)?.stop();
        if (this.skillRoot?.isValid) {
            this.skillRoot.active = false;
            this.skillRoot.destroy();
        }
        this.skillRoot = null;
        this.rangeNode = null;
        this.breathNode = null;
        this.damageArea = null;
    }

    protected stopSkill(): void {
        this.resumeSkill();
        this.skillVersion++;
        this.skillStage = SkillStage.None;
        this.remaining = 0;
        this.tickRemaining = 0;
        this.clearEffects();
    }

    private pauseSkill(): void {
        if (!this.isUsingSkill) return;
        if (this.roleAnim?.isValid && this.pausedRoleSpeed === null) {
            this.pausedRoleSpeed = this.roleAnim.timeScale;
            this.roleAnim.timeScale = 0;
        }
        const sprite = this.rangeNode?.getChildByName('bg')?.getComponent(Sprite);
        if (sprite) Tween.pauseAllByTarget(sprite);
        this.breathNode?.getComponent(Animation)?.pause();
    }

    private resumeSkill(): void {
        if (this.roleAnim?.isValid && this.pausedRoleSpeed !== null) this.roleAnim.timeScale = this.pausedRoleSpeed;
        this.pausedRoleSpeed = null;
        const sprite = this.rangeNode?.getChildByName('bg')?.getComponent(Sprite);
        if (sprite) Tween.resumeAllByTarget(sprite);
        this.breathNode?.getComponent(Animation)?.resume();
    }

    protected onDisable(): void {
        this.stopSkill();
        super.onDisable();
    }

    protected onDestroy(): void {
        gm.Event?.off(GameEvent.gamePause, this.pauseSkill, this);
        gm.Event?.off(GameEvent.gameResume, this.resumeSkill, this);
        this.stopSkill();
        super.onDestroy();
    }
}
