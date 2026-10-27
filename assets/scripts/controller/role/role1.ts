import { _decorator, instantiate, Node, UITransform, Vec3 } from 'cc';
import { roleController, roleType } from './roleController';
import { uiMgr } from '../../manager/UIManager';
import { enemyMgr } from '../../manager/enemyManager';
import { gm } from '../../manager/gm';
const { ccclass } = _decorator;

@ccclass('role1')
export class role1 extends roleController {
    /**角色类型 */
    roleType: roleType = roleType.heal;

    /**无人机跟随的响应时间（秒），越大则移动延迟越明显。 */
    droneFollowDelay = 0.2;
    private droneNode: Node = null;
    private droneRemainTime = 0;
    private droneTickTime = 0;
    private droneHealPercent = 0;
    private droneDamagePercent = 0;
    private droneTargetPos = new Vec3();
    private droneNextPos = new Vec3();
    private droneCheckPos = new Vec3();
    private droneBoundsWorldPos = new Vec3();

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

        const values = this.getInitiativeValues();
        this.droneHealPercent = Math.max(0, values[0] ?? 0) / 100;
        this.droneDamagePercent = Math.max(0, values[1] ?? 0) / 100;
        this.droneRemainTime = duration;
        this.droneTickTime = 0;
        this.droneNode = instantiate(uiMgr.dronePrefab);
        this.gameComp.gameUINode.addChild(this.droneNode);
        this.getDroneTargetPosition(uiTransform);
        this.droneNode.setPosition(this.droneTargetPos);
        this.startSkillCooldown(2);
        return true;
    }

    /**在人物移动后更新无人机，坐标和效果范围统一使用 gameUINode 的本地坐标。 */
    protected lateUpdate(dt: number): void {
        if (!this.droneNode) return;
        const uiNode = this.gameComp?.gameUINode;
        if (this.hp <= 0 || !this.droneNode.isValid || !uiNode?.activeInHierarchy) {
            this.finishDrone();
            return;
        }
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
            this.applyDroneEffect(uiTransform);
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
        this.droneTargetPos.y += 140;
        this.droneTargetPos.z = 0;
    }

    /**以人物本体包围盒与无人机效果区域相交判定，避免只检测脚下原点而漏伤。 */
    private isInDroneRange(target: Node, uiTransform: UITransform) {
        const dronePos = this.droneNode.position;
        const hitNode = target.getChildByName('roleAnim') || target;
        const hitTransform = hitNode.getComponent(UITransform);
        if (!hitTransform) {
            uiTransform.convertToNodeSpaceAR(target.worldPosition, this.droneCheckPos);
            return Math.abs(this.droneCheckPos.x - dronePos.x) <= 50
                && this.droneCheckPos.y <= dronePos.y && this.droneCheckPos.y >= dronePos.y - 140;
        }

        // 与子弹使用相同的人物本体受击包围盒，不包含血条和名字。
        const bounds = hitTransform.getBoundingBoxToWorld();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < 4; i++) {
            this.droneBoundsWorldPos.set(i % 2 === 0 ? bounds.xMin : bounds.xMax,
                i < 2 ? bounds.yMin : bounds.yMax, hitNode.worldPosition.z);
            uiTransform.convertToNodeSpaceAR(this.droneBoundsWorldPos, this.droneCheckPos);
            minX = Math.min(minX, this.droneCheckPos.x);
            maxX = Math.max(maxX, this.droneCheckPos.x);
            minY = Math.min(minY, this.droneCheckPos.y);
            maxY = Math.max(maxY, this.droneCheckPos.y);
        }
        return maxX >= dronePos.x - 50 && minX <= dronePos.x + 50
            && maxY >= dronePos.y - 140 && minY <= dronePos.y;
    }

    private applyDroneEffect(uiTransform: UITransform) {
        if (this.droneHealPercent > 0 && this.isInDroneRange(this.node, uiTransform)) {
            this.heal(this.maxHp * this.droneHealPercent);
        }
        if (this.droneDamagePercent <= 0) return;
        for (const enemy of enemyMgr.allEnemies) {
            if (enemy === this || !enemy?.node?.isValid || !enemy.node.activeInHierarchy || enemy.hp <= 0) continue;
            if (this.isInDroneRange(enemy.node, uiTransform)) {
                enemy.takeDamage(enemy.maxHp * this.droneDamagePercent);
            }
        }
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
        this.droneRemainTime = 0;
        this.droneTickTime = 0;
    }
}
