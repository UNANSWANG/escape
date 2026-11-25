import { audioPath } from '../../manager/pathConfig';
import { audioMgr } from '../../manager/audioManager';
import { _decorator, instantiate, Node, Rect, sp, UITransform, Vec3 } from 'cc';
import { roleController, roleType } from './roleController';
import { uiMgr } from '../../manager/UIManager';
import { enemyMgr, EnemyTarget } from '../../manager/enemyManager';
import { playerMgr } from '../../manager/playerManager';
import { gm } from '../../manager/gm';
const { ccclass } = _decorator;

@ccclass('role1')
export class role1 extends roleController {
    /**角色类型 */
    roleType: roleType = roleType.heal;

    /**无人机跟随的响应时间（秒），越大则移动延迟越明显。 */
    droneFollowDelay = 0.2;
    private droneNode: Node = null;
    private droneSkeleton: sp.Skeleton = null;
    private droneArea: UITransform = null;
    private droneRemainTime = 0;
    private droneTickTime = 0;
    private droneHealPercent = 0;
    private droneDamagePercent = 0;
    private droneTargetPos = new Vec3();
    private droneNextPos = new Vec3();

    /**被动：将当前等级配置的治疗加成百分比转换为治疗倍率。 */
    get healingEffectScale(): number {
        const value = Number(this.roleLevelData?.passiveValue);
        return Number.isFinite(value) ? 1 + Math.max(0, value) / 100 : 1;
    }

    initData(): void {
        super.initData();
        this.skill2Cooldown = Math.max(0, Number(this.roleLevelData?.initiativeCd) || 0);
    }

    /**主动技能：在头顶召唤无人机，每秒结算一次范围治疗和伤害。 */
    useSkill2() {
        if (this.hp <= 0 || this.droneNode?.isValid || this.isSkillCooling(2)
            || !uiMgr.dronePrefab || !this.gameComp?.gameUINode?.activeInHierarchy) return false;
        const uiTransform = this.gameComp.gameUINode.getComponent(UITransform);
        const duration = Number(this.roleLevelData?.initiativeTime);
        if (!uiTransform || !Number.isFinite(duration) || duration <= 0) return false;

        const drone = instantiate(uiMgr.dronePrefab);
        const skeleton = drone.getChildByName('animation')?.getComponent(sp.Skeleton);
        const area = drone.getChildByName('area')?.getComponent(UITransform);
        if (!skeleton || !area) {
            drone.destroy();
            return false;
        }
        const values = this.getInitiativeValues();
        this.droneHealPercent = Math.max(0, values[0] ?? 0) / 100;
        this.droneDamagePercent = Math.max(0, values[1] ?? 0) / 100;
        this.droneRemainTime = duration;
        this.droneTickTime = 0;
        this.droneNode = drone;
        this.droneSkeleton = skeleton;
        this.droneArea = area;
        this.gameComp.gameUINode.addChild(this.droneNode);
        this.droneNode.layer = this.gameComp.gameUINode.layer;
        this.getDroneTargetPosition(uiTransform);
        this.droneNode.setPosition(this.droneTargetPos);
        this.startSkillCooldown(2);
        if (this.isPlayer) audioMgr.playSceneEffect(audioPath.role1Skill);
        skeleton.timeScale = gm.isGamePause ? 0 : 1;
        skeleton.setAnimation(0, 'animation', true);
        return true;
    }

    /**在人物移动后更新无人机，跟随位置使用 gameUINode 本地坐标，效果范围读取 area 世界包围盒。 */
    protected lateUpdate(dt: number): void {
        super.lateUpdate(dt);
        if (!this.droneNode) return;
        const uiNode = this.gameComp?.gameUINode;
        if (this.hp <= 0 || !this.droneNode.isValid || !uiNode?.activeInHierarchy) {
            this.finishDrone();
            return;
        }
        if (this.droneSkeleton?.isValid) this.droneSkeleton.timeScale = gm.isGamePause ? 0 : 1;
        if (gm.isGamePause || dt <= 0) return;
        const uiTransform = uiNode.getComponent(UITransform);
        if (!uiTransform) {
            this.finishDrone();
            return;
        }

        const elapsed = Math.min(dt, this.droneRemainTime);
        this.getDroneTargetPosition(uiTransform);
        const followRatio = this.droneFollowDelay > 0 ? 1 - Math.exp(-elapsed / this.droneFollowDelay) : 1;
        Vec3.lerp(this.droneNextPos, this.droneNode.position, this.droneTargetPos, followRatio);
        this.droneNode.setPosition(this.droneNextPos);
        this.droneTickTime += elapsed;
        this.droneRemainTime = Math.max(0, this.droneRemainTime - elapsed);
        // 先结算再结束，确保持续 8 秒时包含第 8 秒的效果。
        while (this.droneTickTime >= 1 - 1e-6) {
            this.droneTickTime = Math.max(0, this.droneTickTime - 1);
            this.applyDroneEffect();
        }
        if (this.droneRemainTime <= 1e-6) this.finishDrone();
    }

    protected onDisable(): void {
        super.onDisable();
        this.finishDrone();
    }

    playDeath(onComplete?: () => void) {
        this.finishDrone();
        super.playDeath(onComplete);
    }

    private getDroneTargetPosition(uiTransform: UITransform) {
        uiTransform.convertToNodeSpaceAR(this.node.worldPosition, this.droneTargetPos);
        // this.droneTargetPos.y += 140;
        // this.droneTargetPos.z = 0;
    }

    /** 每次结算读取预制体 area 的世界范围，与目标 hitArea 相交即生效。 */
    private applyDroneEffect() {
        if (!this.droneArea?.isValid || !this.droneArea.node.activeInHierarchy) return;
        const bounds = this.droneArea.getBoundingBoxToWorld();
        if (this.droneHealPercent > 0 && this.hitArea
            && bounds.intersects(this.hitArea.getBoundingBoxToWorld())) {
            this.heal(this.maxHp * this.droneHealPercent);
        }
        if (this.droneDamagePercent <= 0) return;
        // 人机无人机只攻击玩家；玩家无人机攻击全部敌方。
        if (this.isAI) {
            this.damageDroneTarget(playerMgr.playerComp, bounds);
            return;
        }
        for (const enemy of enemyMgr.allEnemies) {
            this.damageDroneTarget(enemy, bounds);
        }
    }

    /** 对范围内所有存活的敌对目标结算，施放者自身不受伤。 */
    private damageDroneTarget(target: EnemyTarget, bounds: Rect) {
        if (!target || target === this || !target.node?.isValid
            || target.node === this.node || !target.node.activeInHierarchy || target.hp <= 0) return;
        const hitArea = target.hitArea;
        if (!hitArea?.isValid || !bounds.intersects(hitArea.getBoundingBoxToWorld())) return;
        target.takeDamage(target.maxHp * this.droneDamagePercent);
    }

    /**兼容表格中 JSON 字符串及已解析数组。 */
    private getInitiativeValues(): number[] {
        const raw: unknown = this.roleLevelData?.initiativeValue;
        let values: unknown = raw;
        if (typeof raw === 'string') {
            try {
                values = JSON.parse(raw);
            } catch {
                return [];
            }
        }
        return Array.isArray(values)
            ? values.map(value => Number.isFinite(Number(value)) ? Number(value) : 0)
            : [];
    }

    private finishDrone() {
        if (this.droneNode?.isValid) this.droneNode.destroy();
        this.droneNode = null;
        this.droneSkeleton = null;
        this.droneArea = null;
        this.droneRemainTime = 0;
        this.droneTickTime = 0;
    }
}
