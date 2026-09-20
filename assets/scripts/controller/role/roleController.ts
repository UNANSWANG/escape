import { _decorator, Component, Label, Node, sp, Sprite, tween, Tween, UITransform, Vec3 } from 'cc';
import { enemyMgr } from '../../manager/enemyManager';
import { UIGame, StaticCollisionShape } from '../../UIPage/UIGame';
import { configData, GameEvent, playerCommonConfig } from '../../manager/configData';
import { gm } from '../../manager/gm';
import { enemyBaseController } from '../enemy/enemyBaseController';
import { gunController } from '../gunController';
import { knifeController } from '../knifeController';
import { shotgunController } from '../shotgunController';
import { sniperController } from '../sniperController';
import { weaponsController } from '../weaponsController';
import { uiMgr } from '../../manager/UIManager';
import { JsonRoleData, roleConfig } from '../../json/jsonRole';
import { weaponsConfig } from '../../json/jsonWeapons';
import { pData } from '../../manager/playerData';
const { ccclass } = _decorator;

export enum roleAnimName {
    idle = 'idle',
    move = 'move',
    /**使用技能1 */
    useSkill1 = 'skill1',
    /**使用技能2 */
    useSkill2 = 'useSkill2',
}

export enum roleType {
    /**突进 */
    advance = 'advance',
    /**治疗 */
    heal = 'heal',
    /**肉盾 */
    shield = 'shield',
    /**功能 */
    function = 'function',
}

/** 角色战斗状态。 */
export enum roleBattleState {
    /**非战斗状态 */
    nonCombat = 'nonCombat',
    /**战斗状态 */
    combat = 'combat',
}

@ccclass('roleController')
export class roleController extends Component {
    /**角色当前游戏内 id */
    roleId = 0;
    /**角色皮肤 id */
    skinId = 0;
    /**角色未计算武器倍率前的原始移速。 */
    private originalMoveSpeed = 0;
    /**游戏界面脚本 */
    gameComp: UIGame = null;
    /** 静态障碍物候选列表与坐标临时量，由所有角色各自复用。 */
    private moveCollisionCandidates: StaticCollisionShape[] = [];
    private moveLocalPoint = new Vec3();
    private moveWorldPoint = new Vec3();
    private moveWorldOrigin = new Vec3();
    private moveShadow: UITransform = null;
    /**角色当前播放的动画名 */
    protected curRoleAnimName = '';

    /**角色类型 */
    roleType: roleType = roleType.advance;
    /** 角色本体 Spine。 */
    roleAnim: sp.Skeleton = null;
    /** 角色头顶名称文本。 */
    roleNameLab: Label = null;
    /** 打药剩余时间文本。 */
    private remainTimeLab: Label = null;
    /** 打药剩余时间环形进度。 */
    private remainCircle: Sprite = null;
    /** 枪节点上的枪械控制器。 */
    /** 武器根节点下的全部武器控制器：主武器、副武器、近战武器。 */
    private weaponComps: Array<weaponsController | null> = [];
    /** 主武器、副武器、近战武器的显示节点，索引与 equipmentIds 前三项一致。 */
    private weaponNodes: Array<Node | null> = [];
    /** 当前激活的武器控制器。 */
    private currentWeaponComp: weaponsController = null;
    /** 当前装备为枪械时的专用控制器，供既有射击和换弹逻辑使用。 */
    private gunComp: gunController = null;
    /**当前战斗状态。 */
    private battleState: roleBattleState = roleBattleState.nonCombat;
    /**战斗状态剩余时间，攻击松开或成功开火时刷新。 */
    private combatRemainTime = 0;
    /**是否正在按住攻击键。按住期间保持战斗状态，但不逐帧刷新计时。 */
    private isAttackHeld = false;
    /**技能1的持续时长（秒）。 */
    skill1Duration = 3;
    /**技能1的速度倍率 */
    skill1SpeedScale = 1.2;
    /**通用技能1是否正在生效。专属角色重写 useSkill1 时不使用此状态。 */
    private isUsingCommonSkill1 = false;
    /**通用技能1剩余持续时间（秒）。 */
    private commonSkill1RemainTime = 0;
    /**技能1冷却时间 */
    skill1Cooldown = 15;
    /**技能2冷却时间 */
    skill2Cooldown = 30;
    /**技能1剩余冷却时间。 */
    private skill1CooldownRemaining = 0;
    /**技能2剩余冷却时间。 */
    private skill2CooldownRemaining = 0;
    /**角色最大血量 */
    maxHp = 100;
    /**角色当前血量 */
    hp = 0;
    /**血量节点 */
    hpNode: Node = null;
    /**当前血量图片 */
    hpBar: Sprite = null;
    /**血量虚影 */
    baseHp: Sprite = null;
    /**血量虚影追赶动画时长 */
    private hpShadowDuration = 0.3;
    /**角色数据 */
    roleData: JsonRoleData = null;
    /**是否正在使用药品。 */
    private isUsingDrug = false;
    /**本次打药剩余时间（秒）。 */
    private drugRemainTime = 0;
    /**本次打药总时间（秒），用于计算环形进度。 */
    private drugDuration = 0;
    /**本次药品恢复的最大生命值比例。 */
    private drugHealPercent = 0;
    /**药品成功使用后的回调。 */
    private drugCompleteCallback: (() => void) = null;

    /** 缓存角色自身与子节点组件。 */
    protected onLoad(): void {
        this.moveShadow = this.node.getChildByName('shadow')?.getComponent(UITransform)
            ?? this.node.getComponent(UITransform);
        this.roleAnim = this.node.getChildByName('roleAnim')?.getComponent(sp.Skeleton);
        this.roleNameLab = this.node.getChildByName('roleNameLab')?.getComponent(Label);
        this.remainTimeLab = this.node.getChildByName('remainTimeLab')?.getComponent(Label);
        if (this.remainTimeLab) this.remainTimeLab.node.active = false;
        this.remainCircle = this.node.getChildByName('remainCircle')?.getComponent(Sprite);
        if (this.remainCircle) {
            this.remainCircle.node.active = false;
            this.remainCircle.fillRange = 0;
        }
        this.hpNode = this.node.getChildByName('hpBg');
        this.hpBar = this.hpNode?.getChildByName('hpBar')?.getComponent(Sprite);
        this.baseHp = this.hpNode?.getChildByName('baseHp')?.getComponent(Sprite);
        const weaponRoot = this.node.getChildByName('weapons');
        const weaponNodes = ['weapons_0', 'weapons_1', 'weapons_2'];
        this.weaponNodes = weaponNodes.map((name) => weaponRoot?.getChildByName(name) ?? null);
        this.weaponComps = this.weaponNodes.map((node) => node?.getComponent(weaponsController) ?? null);
        this.currentWeaponComp = this.weaponComps.find((weapon) => weapon?.node.activeInHierarchy) ?? null;
        this.gunComp = this.currentWeaponComp?.node.getComponent(gunController) ?? null;
        gm.Event.on(GameEvent.loadTable, this.onTableLoad, this);
    }

    protected onDestroy(): void {
        if (this.baseHp) Tween.stopAllByTarget(this.baseHp);
        // 节点销毁阶段组件引用可能仍存在，但 component.node 已经为空，此处只释放回调数据。
        this.drugCompleteCallback = null;
        gm.Event.off(GameEvent.loadTable, this.onTableLoad, this);
    }

    /**当前装备的枪械组件 */
    get gunController() {
        return this.gunComp;
    }

    /** 当前激活的通用武器控制器；近战武器和枪械均通过此入口访问共同行为。 */
    get weaponsController() {
        return this.currentWeaponComp;
    }

    /**获取指定装备槽位的武器控制器。 */
    getWeaponController(slotIndex: number) {
        return this.weaponComps[slotIndex] ?? null;
    }

    /**
     * 切换当前装备槽位：0 为主武器、1 为副武器、2 为近战武器。
     * 即使近战控制器尚未实现，也会正确切换武器节点显示。
     */
    equipWeapon(slotIndex: number) {
        const targetNode = this.weaponNodes[slotIndex];
        if (!targetNode) return false;
        const isWeaponChanged = targetNode !== this.currentWeaponComp?.node;
        if (isWeaponChanged) this.gunComp?.onWeaponUnequipped();

        this.weaponNodes.forEach((node, index) => {
            if (node) node.active = index === slotIndex;
        });
        this.currentWeaponComp = this.weaponComps[slotIndex] ?? null;
        this.gunComp = this.currentWeaponComp?.node.getComponent(gunController) ?? null;
        this.updateWeaponViewScale();

        if (this.currentWeaponComp) {
            this.syncCurrentWeaponDefaultPose();
            this.currentWeaponComp.playIdleAnim();
        }
        return true;
    }

    /** UI 完成换弹事件绑定后调用，处理当前枪械的切入状态。 */
    onCurrentWeaponEquipped() {
        this.gunComp?.onWeaponEquipped();
        this.currentWeaponComp?.node.getComponent(sniperController)
            ?.setAttackHeld(this.isAttackHeld, this.gameComp?.gameUINode);
    }

    /**
     * 立即同步当前武器到角色挂点，并按角色当前朝向设置默认角度。
     * 枪械在攻击时会在此基础上被 aimAt 覆盖为瞄准角度；刀始终保持该默认角度。
     */
    syncCurrentWeaponDefaultPose() {
        if (!this.currentWeaponComp) return;
        this.currentWeaponComp.bindToRole(this.roleAnim);
        const directionX = this.roleAnim?.node?.scale.x < 0 ? 1 : -1;
        this.currentWeaponComp.setFacingByHorizontal(directionX);
        this.currentWeaponComp.resetRotation(true);
    }

    /**基础移速属性：角色原始移速 × 当前武器速度倍率。 */
    protected get baseMoveSpeed() {
        return this.originalMoveSpeed * (this.currentWeaponComp?.moveSpeedScale ?? 1);
    }

    /**当前移速：在基础移速属性上叠加通用技能1倍率。 */
    get moveSpeed() {
        return this.baseMoveSpeed
            * (this.isUsingCommonSkill1 ? this.skill1SpeedScale : 1);
    }

    /** 使用 shadow 范围移动；玩家和 AI 均可调用，返回实际移动的本地坐标偏移。 */
    moveWithStaticCollision(deltaX: number, deltaY: number, out: Vec3) {
        out.set(0, 0, 0);
        if (!this.moveShadow || (!deltaX && !deltaY)) return out;
        if (!this.gameComp) {
            this.node.setPosition(this.node.position.x + deltaX, this.node.position.y + deltaY, this.node.position.z);
            out.set(deltaX, deltaY, 0);
            return out;
        }

        const bounds = this.moveShadow.getBoundingBoxToWorld();
        const parentMatrix = this.node.parent?.worldMatrix;
        const start = this.node.position;
        this.moveLocalPoint.set(start.x, start.y, start.z);
        if (parentMatrix) Vec3.transformMat4(this.moveWorldOrigin, this.moveLocalPoint, parentMatrix);
        else this.moveWorldOrigin.set(this.moveLocalPoint);
        this.moveLocalPoint.set(start.x + deltaX, start.y + deltaY, start.z);
        if (parentMatrix) Vec3.transformMat4(this.moveWorldPoint, this.moveLocalPoint, parentMatrix);
        else this.moveWorldPoint.set(this.moveLocalPoint);
        const worldDeltaX = this.moveWorldPoint.x - this.moveWorldOrigin.x;
        const worldDeltaY = this.moveWorldPoint.y - this.moveWorldOrigin.y;

        this.gameComp.queryStaticColliders(
            Math.min(bounds.x, bounds.x + worldDeltaX),
            Math.min(bounds.y, bounds.y + worldDeltaY),
            Math.max(bounds.x + bounds.width, bounds.x + bounds.width + worldDeltaX),
            Math.max(bounds.y + bounds.height, bounds.y + bounds.height + worldDeltaY),
            this.moveCollisionCandidates,
        );
        if (!this.moveCollisionCandidates.length) {
            this.node.setPosition(start.x + deltaX, start.y + deltaY, start.z);
            out.set(deltaX, deltaY, 0);
            return out;
        }

        // 小步推进避免一帧越过薄障碍；通常一帧只执行一步。
        const stepLength = Math.max(1, Math.min(bounds.width, bounds.height) * 0.5);
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(worldDeltaX), Math.abs(worldDeltaY)) / stepLength));
        let x = bounds.x, y = bounds.y;
        let movedX = 0, movedY = 0;
        const localStepX = deltaX / steps, localStepY = deltaY / steps;
        for (let step = 0; step < steps; step++) {
            if (localStepX) {
                const worldStep = this.localMovementToWorld(localStepX, 0);
                const fraction = this.allowedMoveFraction(x, y, bounds.width, bounds.height, worldStep.x, worldStep.y);
                x += worldStep.x * fraction;
                y += worldStep.y * fraction;
                movedX += localStepX * fraction;
            }
            if (localStepY) {
                const worldStep = this.localMovementToWorld(0, localStepY);
                const fraction = this.allowedMoveFraction(x, y, bounds.width, bounds.height, worldStep.x, worldStep.y);
                x += worldStep.x * fraction;
                y += worldStep.y * fraction;
                movedY += localStepY * fraction;
            }
        }
        this.node.setPosition(start.x + movedX, start.y + movedY, start.z);
        out.set(movedX, movedY, 0);
        return out;
    }

    private localMovementToWorld(dx: number, dy: number) {
        const parentMatrix = this.node.parent?.worldMatrix;
        const position = this.node.position;
        this.moveLocalPoint.set(position.x + dx, position.y + dy, position.z);
        if (parentMatrix) Vec3.transformMat4(this.moveWorldPoint, this.moveLocalPoint, parentMatrix);
        else this.moveWorldPoint.set(this.moveLocalPoint);
        this.moveWorldPoint.subtract(this.moveWorldOrigin);
        return this.moveWorldPoint;
    }

    private allowedMoveFraction(x: number, y: number, width: number, height: number, dx: number, dy: number) {
        // 检测整个移动路径，终点已越过薄障碍时也不会漏检。
        if (!this.sweepIntersectsStaticShape(x, y, width, height, dx, dy, 1)) return 1;
        if (this.intersectsStaticShape(x, y, width, height)) return 0;
        let low = 0, high = 1;
        for (let i = 0; i < 10; i++) {
            const middle = (low + high) * 0.5;
            if (this.sweepIntersectsStaticShape(x, y, width, height, dx, dy, middle)) high = middle;
            else low = middle;
        }
        return low;
    }

    private sweepIntersectsStaticShape(x: number, y: number, width: number, height: number,
        dx: number, dy: number, fraction: number) {
        return this.intersectsStaticShape(
            Math.min(x, x + dx * fraction), Math.min(y, y + dy * fraction),
            width + Math.abs(dx * fraction), height + Math.abs(dy * fraction));
    }

    private intersectsStaticShape(x: number, y: number, width: number, height: number) {
        const right = x + width, top = y + height;
        for (const shape of this.moveCollisionCandidates) {
            if (right <= shape.minX || x >= shape.maxX || top <= shape.minY || y >= shape.maxY) continue;
            if (!shape.points || this.rectIntersectsPolygon(x, y, right, top, shape.points)) return true;
        }
        return false;
    }

    /** 支持凹多边形：顶点包含检测加线段相交检测。 */
    private rectIntersectsPolygon(left: number, bottom: number, right: number, top: number,
        points: ReadonlyArray<{ x: number; y: number }>) {
        for (const point of points) {
            if (point.x > left && point.x < right && point.y > bottom && point.y < top) return true;
        }
        if (this.pointInPolygon(left, bottom, points) || this.pointInPolygon(right, bottom, points)
            || this.pointInPolygon(right, top, points) || this.pointInPolygon(left, top, points)) return true;
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            if (this.segmentsCross(a.x, a.y, b.x, b.y, left, bottom, right, bottom)
                || this.segmentsCross(a.x, a.y, b.x, b.y, right, bottom, right, top)
                || this.segmentsCross(a.x, a.y, b.x, b.y, right, top, left, top)
                || this.segmentsCross(a.x, a.y, b.x, b.y, left, top, left, bottom)) return true;
        }
        return false;
    }

    private pointInPolygon(x: number, y: number, points: ReadonlyArray<{ x: number; y: number }>) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[i], b = points[j];
            if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    private segmentsCross(ax: number, ay: number, bx: number, by: number,
        cx: number, cy: number, dx: number, dy: number) {
        const abC = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const abD = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
        const cdA = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
        const cdB = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
        return abC * abD < 0 && cdA * cdB < 0;
    }

    /**当前是否处于战斗状态。 */
    get isInCombat() {
        return this.battleState === roleBattleState.combat;
    }

    /**当前战斗状态。 */
    get currentBattleState() {
        return this.battleState;
    }

    /**进入或刷新战斗状态。 */
    refreshCombatState() {
        const isEnterCombat = this.battleState === roleBattleState.nonCombat;
        this.battleState = roleBattleState.combat;
        this.combatRemainTime = Math.max(0, playerCommonConfig.gunResetTime);
        if (isEnterCombat) this.currentWeaponComp?.stopResetRotationTween();
    }

    /**设置攻击键是否按住；松开后才开始退出战斗的倒计时。 */
    setAttackHeld(isHeld: boolean, canStartSniperCharge = true) {
        if (this.isAttackHeld === isHeld) return false;
        this.isAttackHeld = isHeld;
        const isFiredOnRelease = this.currentWeaponComp?.node.getComponent(sniperController)
            ?.setAttackHeld(isHeld && canStartSniperCharge, this.gameComp?.gameUINode) ?? false;
        if (isHeld) {
            this.refreshCombatState();
        } else if (this.battleState === roleBattleState.combat) {
            this.combatRemainTime = Math.max(0, playerCommonConfig.gunResetTime);
        }
        if (isFiredOnRelease) {
            this.interruptDrugUse();
            this.refreshCombatState();
        }
        return isFiredOnRelease;
    }

    protected update(dt: number): void {
        this.updateBattleState(dt);
        this.updateCommonSkill1(dt);
        this.updateSkillCooldown(dt);
        this.updateDrugUse(dt);
    }

    /**组件停用时终止通用技能1，避免加速状态遗留到下次启用。 */
    protected onDisable(): void {
        this.finishCommonSkill1();
        this.interruptDrugUse();
    }

    /**开始使用药品；大小药品共用同一个状态，期间不能再次使用。 */
    useDrug(useTime: number, healPercent: number, complete?: () => void) {
        if (this.isUsingDrug || this.hp <= 0) return false;

        this.isUsingDrug = true;
        this.drugDuration = Math.max(0, useTime);
        this.drugRemainTime = this.drugDuration;
        this.drugHealPercent = Math.max(0, healPercent);
        this.drugCompleteCallback = complete ?? null;
        this.refreshDrugRemainTime();
        if (this.drugRemainTime <= 0) this.finishDrugUse();
        return true;
    }

    /**动作发生时中断打药；移动、切换武器及界面操作不调用此方法。 */
    interruptDrugUse() {
        if (!this.isUsingDrug) return false;
        this.clearDrugUse();
        return true;
    }

    /**当前是否处于打药状态。 */
    get usingDrug() {
        return this.isUsingDrug;
    }

    /**更新打药倒计时；游戏暂停时冻结。 */
    private updateDrugUse(dt: number) {
        if (!this.isUsingDrug || gm.isGamePause) return;
        this.drugRemainTime = Math.max(0, this.drugRemainTime - dt);
        this.refreshDrugRemainTime();
        if (this.drugRemainTime <= 0) this.finishDrugUse();
    }

    /**倒计时保留一位小数并显示在角色头顶。 */
    private refreshDrugRemainTime() {
        const remainTimeNode = this.remainTimeLab?.node;
        if (remainTimeNode) {
            remainTimeNode.active = this.isUsingDrug;
            if (this.isUsingDrug) this.remainTimeLab.string = this.drugRemainTime.toFixed(1);
        }
        const remainCircleNode = this.remainCircle?.node;
        if (remainCircleNode) {
            remainCircleNode.active = this.isUsingDrug;
            this.remainCircle.fillRange = this.isUsingDrug && this.drugDuration > 0
                ? Math.max(0, Math.min(1, this.drugRemainTime / this.drugDuration))
                : 0;
        }
    }

    /**完成使用：先清理状态，再回血和通知 UI 扣除库存。 */
    private finishDrugUse() {
        if (!this.isUsingDrug) return;
        const healAmount = this.maxHp * this.drugHealPercent;
        const complete = this.drugCompleteCallback;
        this.clearDrugUse();
        this.heal(healAmount);
        complete?.();
    }

    /**清理打药状态与头顶倒计时。 */
    private clearDrugUse() {
        this.isUsingDrug = false;
        this.drugRemainTime = 0;
        this.drugDuration = 0;
        this.drugHealPercent = 0;
        this.drugCompleteCallback = null;
        const remainTimeNode = this.remainTimeLab?.node;
        if (remainTimeNode) remainTimeNode.active = false;
        const remainCircleNode = this.remainCircle?.node;
        if (remainCircleNode) {
            this.remainCircle.fillRange = 0;
            remainCircleNode.active = false;
        }
    }

    /**更新战斗状态；超时后将枪口复位。 */
    private updateBattleState(dt: number) {
        if (this.battleState !== roleBattleState.combat || this.isAttackHeld) return;
        this.combatRemainTime -= dt;
        if (this.combatRemainTime > 0) return;

        this.combatRemainTime = 0;
        this.battleState = roleBattleState.nonCombat;
        this.currentWeaponComp?.resetRotation();
    }

    /**更新通用技能1的持续时间。 */
    private updateCommonSkill1(dt: number) {
        if (!this.isUsingCommonSkill1) return;
        this.commonSkill1RemainTime -= dt;
        if (this.commonSkill1RemainTime <= 0) this.finishCommonSkill1();
    }

    /**更新两个技能的冷却状态。 */
    private updateSkillCooldown(dt: number) {
        this.skill1CooldownRemaining = Math.max(0, this.skill1CooldownRemaining - dt);
        this.skill2CooldownRemaining = Math.max(0, this.skill2CooldownRemaining - dt);
    }

    /**技能是否仍处于冷却中。 */
    protected isSkillCooling(skillIndex: 1 | 2) {
        return skillIndex === 1 ? this.skill1CooldownRemaining > 0 : this.skill2CooldownRemaining > 0;
    }

    /**成功使用技能后启动其冷却，并通知 UI 播放对应遮罩。 */
    protected startSkillCooldown(skillIndex: 1 | 2) {
        const cooldown = Math.max(0, skillIndex === 1 ? this.skill1Cooldown : this.skill2Cooldown);
        if (skillIndex === 1) {
            this.skill1CooldownRemaining = cooldown;
        } else {
            this.skill2CooldownRemaining = cooldown;
        }
        this.node.emit('skill-cooldown-start', skillIndex, cooldown);
    }

    /**结束通用技能1并恢复释放前的移速。 */
    private finishCommonSkill1() {
        if (!this.isUsingCommonSkill1) return;
        this.isUsingCommonSkill1 = false;
        this.commonSkill1RemainTime = 0;
    }

    /**查找当前枪械自动攻击范围内最近的有效敌人 */
    findNearestEnemyInAttackRange() {
        if (!this.currentWeaponComp) return null;
        const rolePos = this.node.position;
        const rangeSquared = this.currentWeaponComp.attackRange ** 2;
        let nearestEnemy: enemyBaseController = null;
        let nearestDistanceSquared = rangeSquared;
        for (const enemy of enemyMgr.enemyArr) {
            if (!enemy || !enemy.node?.isValid || !enemy.node.activeInHierarchy || enemy.hp <= 0) continue;
            const offsetX = enemy.node.position.x - rolePos.x;
            const offsetY = enemy.node.position.y - rolePos.y;
            const distanceSquared = offsetX * offsetX + offsetY * offsetY;
            if (distanceSquared <= nearestDistanceSquared) {
                nearestEnemy = enemy;
                nearestDistanceSquared = distanceSquared;
            }
        }
        return nearestEnemy;
    }

    /** 初始化角色所属界面、身份数据和初始动画。 */
    init(comp: UIGame, id: number, skinId: number, nickname = '') {
        this.gameComp = comp;
        this.roleId = id;
        this.skinId = skinId;
        this.roleData = roleConfig.getRoleDataById(this.roleId);
        if (!this.roleData) return;

        //TODO 临时降低血量
        this.hp = this.maxHp * 0.1;
        this.refreshHp(true);
        this.originalMoveSpeed = configData.moveSpeed;
        this.equipWeapon(0);
        this.applyEquippedWeaponStats();
        this.refreshRoleSpine();
        this.initData();
        if (this.roleNameLab) this.roleNameLab.string = this.roleId === 0 ? '你' : (nickname || `人机${this.roleId}`);
    }

    /**初始化数据 */
    initData(){
        
    }

    /** 将游戏外装备栏前三项（主武器、副武器、近战武器）应用到对应武器节点。 */
    private applyEquippedWeaponStats() {
        this.weaponNodes.forEach((node, slotIndex) => {
            if (!node) return;
            const weaponId = pData.equipmentIds[slotIndex];
            const weaponData = weaponsConfig.getDataById(weaponId);
            if (!weaponData) {
                console.warn(`未找到装备栏第 ${slotIndex + 1} 格的武器配置，id: ${weaponId}`);
                return;
            }

            const weapon = this.assignWeaponController(node, weaponData.type);
            if (!weapon) return;
            weapon.applyStats(weaponData);
        });

        // 配置表可能在角色创建后才加载；重新缓存以保证切换武器时拿到新挂载的组件。
        this.weaponComps = this.weaponNodes.map((node) => node?.getComponent(weaponsController) ?? null);
        const activeSlotIndex = this.weaponNodes.findIndex((node) => node?.active);
        if (activeSlotIndex >= 0) {
            this.currentWeaponComp = this.weaponComps[activeSlotIndex];
            this.gunComp = this.currentWeaponComp?.node.getComponent(gunController) ?? null;
            this.updateWeaponViewScale();
            this.syncCurrentWeaponDefaultPose();
            this.currentWeaponComp?.playIdleAnim();
        }
    }

    /**
     * 按 weapons 表的类型给武器节点挂载控制脚本：0 为刀、4 为霰弹枪、5 为狙击枪，其余为普通枪械。
     * 切换装备数据时统一移除旧的武器基类组件，避免同一节点同时存在多个武器控制器。
     */
    private assignWeaponController(node: Node, weaponType: number) {
        const oldWeapon = node.getComponent(weaponsController);
        if (oldWeapon) node.removeComponent(oldWeapon);

        if (weaponType === 0) return node.addComponent(knifeController);
        if (weaponType === 4) return node.addComponent(shotgunController);
        if (weaponType === 5) return node.addComponent(sniperController);
        return node.addComponent(gunController);
    }

    /** 当前武器为狙击枪时扩大视野；切换为其他武器后恢复默认视野。 */
    private updateWeaponViewScale() {
        const sniper = this.currentWeaponComp?.node.getComponent(sniperController);
        this.gameComp?.setGameViewScale(sniper?.viewScale ?? 1);
    }

    /** weapons 表异步加载完成后，为已创建的角色补充装备数值。 */
    private onTableLoad(tableName: string) {
        if (tableName === 'weapons') this.applyEquippedWeaponStats();
    }

    /** 刷新角色初始状态，同时通知枪械重新绑定角色挂点。 */
    private async refreshRoleSpine() {
        this.curRoleAnimName = '';
        this.currentWeaponComp?.bindToRole(this.roleAnim);
        this.currentWeaponComp?.resetRotation(true);
        this.playRoleAnim(roleAnimName.idle, true);
        this.currentWeaponComp?.playIdleAnim();
    }

    /**角色朝向仍从角色控制器入口调用，具体人物与枪械翻转由枪械控制器处理。 */
    setFacingByHorizontal(directionX: number) {
        this.currentWeaponComp?.setFacingByHorizontal(directionX);
    }

    /** 将瞄准请求转交给当前装备的枪械。 */
    aimGunAt(target: Node) {
        return this.currentWeaponComp?.aimAt(target) ?? false;
    }

    /** 将手动瞄准方向转交给当前装备的武器。 */
    aimGunInDirection(direction: Vec3) {
        return this.currentWeaponComp?.aimInDirection(direction) ?? false;
    }

    /** 清除枪械锁定目标。 */
    clearGunAimTarget() {
        this.currentWeaponComp?.clearAimTarget();
    }

    /** 由当前枪械从游戏 UI 节点中生成子弹。 */
    fireBullet(deltaTime = 0, fireSniperOnChargeComplete = true) {
        const isFired = this.gunComp?.fireBullet(
            this.gameComp?.gameUINode,
            deltaTime,
            fireSniperOnChargeComplete,
        ) ?? false;
        if (isFired) this.refreshCombatState();
        return isFired;
    }

    /** 当前武器执行一次攻击：刀使用扇形近战攻击，枪械发射子弹。 */
    attack(deltaTime = 0, fireSniperOnChargeComplete = true) {
        const knife = this.currentWeaponComp?.node.getComponent(knifeController);
        const isAttacked = knife?.attackInFacingDirection()
            ?? this.fireBullet(deltaTime, fireSniperOnChargeComplete);
        if (isAttacked) {
            this.interruptDrugUse();
            if (knife) this.refreshCombatState();
        }
        return isAttacked;
    }

    /**受到伤害时扣除生命值，并在角色头顶显示实际伤害数值。 */
    takeDamage(damage: number) {
        if (!Number.isFinite(damage) || damage <= 0 || this.hp <= 0) return false;
        const actualDamage = Math.min(this.hp, damage);
        this.hp -= actualDamage;
        this.refreshHp();
        this.gameComp?.showDamageFloat(this.node, actualDamage);
        return true;
    }

    /**恢复生命值，恢复量不会使当前生命超过上限。 */
    heal(healAmount: number) {
        if (!Number.isFinite(healAmount) || healAmount <= 0 || this.hp <= 0 || this.hp >= this.maxHp) return false;
        this.hp = Math.min(this.maxHp, this.hp + healAmount);
        this.refreshHp();
        return true;
    }

    /**当前生命值百分比。 */
    get hpPercent() {
        return this.maxHp > 0 ? this.hp / this.maxHp : 0;
    }

    /**刷新血条；扣血时血量虚影会延迟追赶。 */
    refreshHp(isImmediate = false) {
        if (!this.hpBar || !this.baseHp) return;

        const hpPercent = Math.max(0, Math.min(1, this.hpPercent));
        const isHpReduced = hpPercent < this.hpBar.fillRange;
        this.hpBar.fillRange = hpPercent;
        Tween.stopAllByTarget(this.baseHp);

        if (isImmediate || !isHpReduced) {
            this.baseHp.fillRange = hpPercent;
            return;
        }

        tween(this.baseHp)
            .to(this.hpShadowDuration, { fillRange: hpPercent }, { easing: 'linear' })
            .start();
    }

    /** 播放角色本体 Spine 动画。 */
    playRoleAnim(animName: string, loop = true) {
        if (!this.roleAnim || !this.roleAnim.skeletonData || this.curRoleAnimName === animName) return;
        this.curRoleAnimName = animName;
        this.roleAnim.setAnimation(0, animName, loop);
    }

    /**
     * 使用通用技能1：在配置的持续时间内提高移速。
     * 有专属技能逻辑的角色（如 role0）可重写此方法。
     */
    useSkill1() {
        if (this.isUsingCommonSkill1 || this.skill1Duration <= 0 || this.isSkillCooling(1)) return false;

        this.isUsingCommonSkill1 = true;
        this.commonSkill1RemainTime = this.skill1Duration;
        this.startSkillCooldown(1);
        return true;
    }

    /**技能是否正在锁定移动方向。 */
    get isMoveDirectionLocked() { return false; }

    /** 使用技能2 */
    useSkill2() {
        if (this.isSkillCooling(2)) return false;
        // 技能效果尚未实现，当前先完成使用与冷却流程。
        this.startSkillCooldown(2);
        return true;
    }
}
