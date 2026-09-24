import { _decorator, Color, Component, Label, Node, sp, Sprite, tween, Tween, UITransform, UIOpacity, Vec2, Vec3 } from 'cc';
import { ccTools } from '../../extention/generalTools';
import { UIGame } from '../../UIPage/UIGame';
import { audioPath, spinePath, UIPath } from '../../manager/pathConfig';
import { ScoutType, soldiersData } from '../../data/soldiersData';
import { configData, enemyCommonConfig, GameEvent, playerCommonConfig, soldierCommonConfig } from '../../manager/configData';
import { armsConfig } from '../../json/jsonArms';
import { weaponsConfig } from '../../json/jsonWeapons';
import { gm } from '../../manager/gm';
import { playerMgr } from '../../manager/playerManager';
import { weaponsController } from '../weaponsController';
import { gunController } from '../gunController';
import { knifeController } from '../knifeController';
import { shotgunController } from '../shotgunController';
import { sniperController } from '../sniperController';
import { StaticCollisionMover } from '../staticCollisionMover';
const { ccclass, property } = _decorator;

enum enemyAnim {
    /**静止 */
    idle = "idle",
    /**攻击 */
    attack = "attack",
    /**移动 */
    move = "move",
}

enum PatrolState {
    Idle,
    Moving,
    Waiting,
}

enum SoldierState {
    Patrol,
    Chase,
    Return,
}

@ccclass('soldiersController')
export class soldiersController extends Component {
    /**小兵当前游戏内id */
    id: number = 0;
    /**兵种id */
    armsId: number = 0;
    /**游戏脚本 */
    gameComp: UIGame = null;
    /**最大血量 */
    maxHp: number = 100;
    /**当前血量 */
    hp: number = 0;
    /**攻击伤害 */
    attackDamage: number = 0;

    ///
    ///节点
    ///
    /**角色spine节点 */
    roleAnim: sp.Skeleton = null;
    /**手持武器节点 */
    weaponNode: Node = null;
    /**角色名称 */
    roleNameLab: Label = null;
    /**血量节点 */
    hpNode: Node = null;
    /**血量图片 */
    hpBar: Sprite = null;
    /**血量虚影 */
    baseHp: Sprite = null;
    /**特效动画节点 */
    effectNode: Node = null;
    /**血量虚影追赶动画时长 */
    private hpShadowDuration: number = 0.3;
    private patrolState: PatrolState = PatrolState.Idle;
    private soldierState: SoldierState = SoldierState.Patrol;
    private scoutType: ScoutType = ScoutType.StandGuard;
    private patrolOrigin = new Vec3();
    private patrolTarget = new Vec3();
    private returnTarget = new Vec3();
    private patrolPosition = new Vec3();
    private patrolPath: Vec3[] = [];
    private pathIndex = 0;
    private pathDirection = 1;
    private rangeRadius = 0;
    private isPathLoop = false;
    private waitRemaining = 0;
    private currentAnim: enemyAnim = null;
    private weaponDefaultX = 0;
    private weaponComp: weaponsController = null;
    private attackCooldown = 0;
    private isAttacking = false;
    private gunResetRemaining: number | null = null;
    private detectRange = 0;
    private chaseTimeRange: [number, number] = [0, 0];
    private chaseRemaining = 0;
    /** NPC 脚底碰撞区域及静态障碍物移动器。 */
    private moveCollider: UITransform = null;
    private collisionMover = new StaticCollisionMover();
    private actualMove = new Vec3();
    /** A* 计算得到的世界坐标路线。玩家移动时会定期重新规划。 */
    private navigationPath: Vec3[] = [];
    private navigationIndex = 0;
    private navigationTarget = new Vec3(Number.NaN, Number.NaN, 0);
    private navigationReplanRemaining = 0;
    private readonly navigationReplanInterval = 0.35;

    protected onLoad(): void {
        this.roleAnim = this.node.getChildByName("roleAnim").getComponent(sp.Skeleton);
        this.weaponNode = this.node.getChildByName("weapons");
        this.weaponDefaultX = this.weaponNode?.position.x ?? 0;
        this.roleNameLab = this.node.getChildByName("roleNameLab").getComponent(Label);
        this.hpNode = this.node.getChildByName("hpBg");
        this.hpBar = this.hpNode.getChildByName("hpBar").getComponent(Sprite);
        this.baseHp = this.hpNode.getChildByName("baseHp").getComponent(Sprite);
        this.effectNode = this.node.getChildByName("effectNode");
        this.moveCollider = this.node.getChildByName('colliderBox')?.getComponent(UITransform);
        if (!this.moveCollider) console.warn('NPC 预制体缺少 colliderBox 或 UITransform，无法避开地图碰撞体');
        gm.Event.on(GameEvent.loadTable, this.onTableLoad, this);
    }

    protected onDestroy(): void {
        Tween.stopAllByTarget(this.baseHp);
        gm.Event.off(GameEvent.loadTable, this.onTableLoad, this);
    }

    /**初始化 */
    init(comp: UIGame, id: number, armsId: number, data: soldiersData = null, nickname = "") {
        this.gameComp = comp;
        this.id = id;
        this.armsId = armsId;
        this.initArmsData();
        this.initWeapon();

        this.refreshRoleSpine();

        this.roleNameLab.string = nickname || `小兵${this.id + 1}`
        this.initPatrol(data);
    }

    protected update(dt: number): void {
        if (this.hp <= 0) return;
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.updateGunReset(dt);
        if (this.soldierState === SoldierState.Chase) {
            this.updateChase(dt);
            return;
        }
        if (this.soldierState === SoldierState.Return) {
            this.updateReturn(dt);
            return;
        }
        if (this.canDetectPlayer()) {
            this.startChase();
            return;
        }
        if (this.patrolState === PatrolState.Moving) {
            this.updatePatrolMovement(dt);
        } else if (this.patrolState === PatrolState.Waiting) {
            this.waitRemaining -= dt;
            if (this.waitRemaining <= 0) this.startNextPatrolLeg();
        }
    }

    /** 兵种的生命值和追击参数与武器装配分开初始化。 */
    private initArmsData() {
        const arms = armsConfig.getDataById(this.armsId);
        if (!arms) return;
        this.maxHp = Math.max(1, arms.hp);
        this.hp = this.maxHp;
        this.refreshHp(true);
        this.detectRange = Math.max(0, arms.detectRange);
        try {
            const range = JSON.parse(arms.chaseTime);
            if (!Array.isArray(range) || range.length !== 2) throw new Error('chaseTime must be [min, max]');
            const first = Number(range[0]);
            const second = Number(range[1]);
            if (!Number.isFinite(first) || !Number.isFinite(second)) throw new Error('invalid chaseTime bounds');
            this.chaseTimeRange = [Math.max(0, Math.min(first, second)), Math.max(0, first, second)];
        } catch (error) {
            console.warn(`兵种 ${this.armsId} 的 chaseTime 配置无效: ${arms.chaseTime}`);
        }
    }

    /** 一名小兵只装配兵种表指定的一把武器。 */
    private initWeapon() {
        const arms = armsConfig.getDataById(this.armsId);
        if (!arms) return;
        const weaponData = weaponsConfig.getDataById(arms.weaponId);
        if (!weaponData || !this.weaponNode) return;
        const oldWeapon = this.weaponNode.getComponent(weaponsController);
        if (oldWeapon) this.weaponNode.removeComponent(oldWeapon);
        if (weaponData.type === 0) this.weaponComp = this.weaponNode.addComponent(knifeController);
        else if (weaponData.type === 4) this.weaponComp = this.weaponNode.addComponent(shotgunController);
        else if (weaponData.type === 5) this.weaponComp = this.weaponNode.addComponent(sniperController);
        else this.weaponComp = this.weaponNode.addComponent(gunController);

        this.weaponComp.applyStats(weaponData);
        this.weaponComp.attack *= soldierCommonConfig.npcAttackPercent;
        const attackRangePercent = Number.isFinite(soldierCommonConfig.npcAttackRangePercent)
            ? Math.max(0, soldierCommonConfig.npcAttackRangePercent) : 1;
        this.weaponComp.attackRange *= attackRangePercent;
        const fireRatePercent = Number.isFinite(soldierCommonConfig.npcFireRatePercent)
            && soldierCommonConfig.npcFireRatePercent > 0
            ? soldierCommonConfig.npcFireRatePercent : 1;
        // 射速与攻击间隔成反比：80% 射速对应基础攻击间隔除以 0.8。
        this.weaponComp.attackInterval /= fireRatePercent;
        this.weaponComp.targetPlayer = true;
        this.weaponComp.bindToRole(this.roleAnim);
        this.weaponComp.resetRotation(true);
        this.weaponComp.playIdleAnim();
        this.attackCooldown = 0;
        this.gunResetRemaining = null;
    }

    private onTableLoad(tableName: string) {
        if (tableName === 'arms') this.initArmsData();
        if (tableName === 'arms' || tableName === 'weapons') this.initWeapon();
    }

    private canDetectPlayer() {
        const player = playerMgr.playerComp;
        if (!player?.node?.isValid || !player.node.activeInHierarchy || player.hp <= 0 || this.detectRange <= 0) return false;
        const dx = player.node.worldPosition.x - this.node.worldPosition.x;
        const dy = player.node.worldPosition.y - this.node.worldPosition.y;
        return dx * dx + dy * dy <= this.detectRange * this.detectRange;
    }

    private startChase() {
        this.soldierState = SoldierState.Chase;
        this.clearNavigationPath();
        if (this.scoutType === ScoutType.AreaScout && this.rangeRadius > 0) {
            this.pickAreaPoint(this.returnTarget);
        } else if (this.scoutType === ScoutType.PathScout && this.patrolPath.length > 0) {
            // pathIndex 始终指向巡逻的下一个路径点。
            this.returnTarget.set(this.patrolPath[this.pathIndex]);
        } else {
            this.returnTarget.set(this.patrolOrigin);
        }
        this.gameComp?.clampWorldPointToMap(this.node, this.returnTarget, this.returnTarget);
        const [min, max] = this.chaseTimeRange;
        this.chaseRemaining = min + Math.random() * (max - min);
    }

    private updateChase(dt: number) {
        this.chaseRemaining -= dt;
        const player = playerMgr.playerComp;
        if (this.chaseRemaining <= 0 || !player?.node?.isValid || !player.node.activeInHierarchy || player.hp <= 0) {
            this.finishChase();
            return;
        }
        if (this.updateAttack(dt)) return;
        this.moveToward(player.node.worldPosition, dt);
    }

    private finishChase() {
        this.stopAttack();
        this.clearNavigationPath();
        this.soldierState = SoldierState.Return;
        this.playPatrolAnimation(enemyAnim.move);
    }

    private updateReturn(dt: number) {
        if (!this.moveToward(this.returnTarget, dt)) return;
        this.soldierState = SoldierState.Patrol;
        if (this.scoutType === ScoutType.StandGuard || this.scoutType === ScoutType.AreaScout && this.rangeRadius <= 0) {
            this.patrolState = PatrolState.Idle;
            this.playPatrolAnimation(enemyAnim.idle);
        } else {
            this.arriveAtPatrolTarget();
        }
    }

    /** 只有追击状态才会调用攻击；武器射程外继续向玩家移动。 */
    private updateAttack(dt: number) {
        const player = playerMgr.playerComp;
        const weapon = this.weaponComp;
        if (!weapon || !player?.node?.isValid || !player.node.activeInHierarchy || player.hp <= 0) {
            this.stopAttack();
            return false;
        }
        const dx = player.node.worldPosition.x - this.node.worldPosition.x;
        const dy = player.node.worldPosition.y - this.node.worldPosition.y;
        // 进入攻击需要比最大射程更近一些，离开时仍按最大射程判断，避免边缘反复切换。
        const enterRange = Math.max(0, weapon.attackRange - Math.min(20, weapon.attackRange * 0.1));
        const allowedRange = this.isAttacking ? weapon.attackRange : enterRange;
        // 隔着墙即使在武器射程内也继续寻路，避免 NPC 停在障碍物另一侧攻击。
        const sightBlocked = this.gameComp?.isWorldSegmentBlocked(
            this.node.worldPosition.x, this.node.worldPosition.y,
            player.node.worldPosition.x, player.node.worldPosition.y) ?? false;
        if (dx * dx + dy * dy > allowedRange * allowedRange || sightBlocked) {
            this.stopAttack();
            return false;
        }
        if (!this.isAttacking) {
            this.gunResetRemaining = null;
            weapon.stopResetRotationTween();
        }
        this.isAttacking = true;
        this.playPatrolAnimation(enemyAnim.idle);
        weapon.aimAt(player.node);
        if (this.attackCooldown > 0) return true;

        const knife = weapon instanceof knifeController ? weapon : null;
        const attacked = knife ? knife.attackInFacingDirection()
            : (weapon as gunController).fireBullet(this.gameComp?.gameUINode, dt);
        if (attacked) this.attackCooldown = weapon.attackInterval;
        return true;
    }

    private stopAttack() {
        if (!this.isAttacking) return;
        this.isAttacking = false;
        this.weaponNode?.getComponent(sniperController)?.cancelCharge();
        this.weaponComp?.clearAimTarget();
        this.gunResetRemaining = Math.max(0, playerCommonConfig.gunResetTime);
        if (this.patrolState === PatrolState.Moving) this.playPatrolAnimation(enemyAnim.move);
    }

    private updateGunReset(dt: number) {
        if (this.gunResetRemaining === null || this.isAttacking) return;
        this.gunResetRemaining = Math.max(0, this.gunResetRemaining - dt);
        if (this.gunResetRemaining > 0) return;
        this.gunResetRemaining = null;
        this.weaponComp?.resetRotation();
    }

    private initPatrol(data: soldiersData) {
        this.scoutType = data?.scoutType ?? ScoutType.StandGuard;
        this.rangeRadius = Math.max(0, data?.rangeRadius ?? 0);
        this.isPathLoop = data?.isLoop ?? false;
        this.patrolOrigin.set(this.node.worldPosition);
        this.patrolPath = (data?.scoutPath ?? [])
            .filter(point => point?.isValid)
            .map(point => new Vec3(point.worldPosition.x, point.worldPosition.y, this.patrolOrigin.z));
        this.pathIndex = 0;
        this.pathDirection = 1;
        this.waitRemaining = 0;
        this.soldierState = SoldierState.Patrol;
        this.patrolState = PatrolState.Idle;
        this.playPatrolAnimation(enemyAnim.idle);
        this.setWeaponDefaultAngle();
        this.startNextPatrolLeg();
    }

    private startNextPatrolLeg() {
        this.clearNavigationPath();
        if (this.scoutType === ScoutType.AreaScout && this.rangeRadius > 0) {
            this.pickAreaPoint(this.patrolTarget);
        } else if (this.scoutType === ScoutType.PathScout && this.patrolPath.length > 0) {
            this.patrolTarget.set(this.patrolPath[this.pathIndex]);
        } else {
            this.patrolState = PatrolState.Idle;
            this.playPatrolAnimation(enemyAnim.idle);
            return;
        }

        this.gameComp?.clampWorldPointToMap(this.node, this.patrolTarget, this.patrolTarget);
        this.facePatrolTarget(this.patrolTarget);
        this.patrolState = PatrolState.Moving;
        this.playPatrolAnimation(enemyAnim.move);
    }

    /** 均匀选取出生点周围圆形巡逻区中的目标点。 */
    private pickAreaPoint(out: Vec3) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * this.rangeRadius;
        out.set(this.patrolOrigin.x + Math.cos(angle) * radius,
            this.patrolOrigin.y + Math.sin(angle) * radius, this.patrolOrigin.z);
    }

    /**按玩家的朝向规则翻转人物和枪，不影响名字和血条。 */
    private facePatrolTarget(target: Vec3) {
        const directionX = target.x - this.node.worldPosition.x;
        if (Math.abs(directionX) < 0.001) return;
        const facingScale = directionX > 0 ? -1 : 1;
        const animNode = this.roleAnim.node;
        const animScale = animNode.scale;
        animNode.setScale(facingScale * Math.abs(animScale.x), animScale.y, animScale.z);

        if (this.weaponComp) {
            this.weaponComp.setFacingByHorizontal(directionX);
        } else {
            const weapon = this.weaponNode;
            if (!weapon) return;
            const weaponScale = weapon.scale;
            weapon.setScale(facingScale * Math.abs(weaponScale.x), weaponScale.y, weaponScale.z);
            weapon.setPosition(facingScale < 0 ? -this.weaponDefaultX : this.weaponDefaultX,
                weapon.position.y, weapon.position.z);
            this.setWeaponDefaultAngle();
        }
    }

    /**与玩家武器回正时使用相同的左右默认角度。 */
    private setWeaponDefaultAngle() {
        if (this.weaponNode) this.weaponNode.angle = this.weaponNode.scale.x < 0 ? 10 : -10;
    }

    private updatePatrolMovement(dt: number) {
        if (this.moveToward(this.patrolTarget, dt)) this.arriveAtPatrolTarget();
    }

    /** 按 A* 路线逐个前往路点；碰撞移动器只作为路线执行时的安全保护。 */
    private moveToward(target: Vec3, dt: number) {
        const current = this.node.worldPosition;
        const targetDx = target.x - current.x;
        const targetDy = target.y - current.y;
        const targetDistance = Math.hypot(targetDx, targetDy);
        const speedPercent = Number.isFinite(soldierCommonConfig.npcSpeedPercent)
            ? Math.max(0, soldierCommonConfig.npcSpeedPercent) : 1;
        const step = Math.max(0, configData.moveSpeed * speedPercent
            * (this.weaponComp?.moveSpeedScale ?? 1) * dt);
        if (targetDistance < 0.5) {
            this.clearNavigationPath();
            return true;
        }

        this.navigationReplanRemaining = Math.max(0, this.navigationReplanRemaining - dt);
        const targetMovedX = target.x - this.navigationTarget.x;
        const targetMovedY = target.y - this.navigationTarget.y;
        const targetMoved = targetMovedX * targetMovedX + targetMovedY * targetMovedY > 24 * 24;
        if (this.navigationIndex >= this.navigationPath.length && this.navigationReplanRemaining <= 0
            || targetMoved && this.navigationReplanRemaining <= 0) {
            this.rebuildNavigationPath(target);
        }
        let waypoint = this.navigationPath[this.navigationIndex];
        if (!waypoint) {
            this.playPatrolAnimation(enemyAnim.idle);
            return false;
        }

        let dx = waypoint.x - current.x;
        let dy = waypoint.y - current.y;
        let distance = Math.hypot(dx, dy);
        // 只跳过已经实际抵达的路点，不能因为单帧步长较大而跨过障碍物转角。
        while (distance < 0.5 && this.navigationIndex + 1 < this.navigationPath.length) {
            this.navigationIndex++;
            waypoint = this.navigationPath[this.navigationIndex];
            dx = waypoint.x - current.x;
            dy = waypoint.y - current.y;
            distance = Math.hypot(dx, dy);
        }

        if (distance < 0.001 || step <= 0) return false;
        this.facePatrolTarget(this.navigationPath[this.navigationIndex]);
        this.playPatrolAnimation(enemyAnim.move);
        const moveDistance = Math.min(distance, step);
        const directionX = dx / distance;
        const directionY = dy / distance;

        if (!this.moveCollider || !this.gameComp) {
            this.patrolPosition.set(current.x + directionX * moveDistance,
                current.y + directionY * moveDistance, current.z);
            this.node.setWorldPosition(this.patrolPosition);
        } else {
            this.collisionMover.moveWorld(this.node, this.moveCollider, this.gameComp,
                directionX * moveDistance, directionY * moveDistance, this.actualMove);
            const forwardProgress = this.actualMove.x * directionX + this.actualMove.y * directionY;
            if (forwardProgress < moveDistance * 0.2) {
                // 场景碰撞体或目标在寻路后发生变化，下一帧重新规划，不继续顶墙。
                this.navigationPath.length = 0;
                this.navigationIndex = 0;
                this.navigationReplanRemaining = 0;
            }
        }

        const remainingX = target.x - this.node.worldPosition.x;
        const remainingY = target.y - this.node.worldPosition.y;
        const arrived = remainingX * remainingX + remainingY * remainingY < 0.25;
        if (arrived) {
            this.clearNavigationPath();
        } else {
            const waypointRemainingX = waypoint.x - this.node.worldPosition.x;
            const waypointRemainingY = waypoint.y - this.node.worldPosition.y;
            if (waypointRemainingX * waypointRemainingX + waypointRemainingY * waypointRemainingY < 0.25) {
                this.navigationIndex++;
            }
        }
        return arrived;
    }

    private rebuildNavigationPath(target: Vec3) {
        this.navigationPath.length = 0;
        this.navigationIndex = 0;
        this.navigationTarget.set(target);
        this.navigationReplanRemaining = this.navigationReplanInterval;
        if (!this.moveCollider || !this.gameComp) {
            this.navigationPath.push(new Vec3(target.x, target.y, this.node.worldPosition.z));
            return;
        }
        this.collisionMover.findPath(this.node, this.moveCollider, this.gameComp,
            target, this.navigationPath);
    }

    private clearNavigationPath() {
        this.navigationPath.length = 0;
        this.navigationIndex = 0;
        this.navigationTarget.set(Number.NaN, Number.NaN, 0);
        this.navigationReplanRemaining = 0;
    }

    private arriveAtPatrolTarget() {
        if (this.scoutType === ScoutType.PathScout) this.advancePathIndex();
        const [first, second] = enemyCommonConfig.patrolWaitTime;
        const min = Math.max(0, Math.min(first, second));
        const max = Math.max(min, first, second);
        this.waitRemaining = min + Math.random() * (max - min);
        this.patrolState = PatrolState.Waiting;
        this.playPatrolAnimation(enemyAnim.idle);
    }

    private advancePathIndex() {
        const count = this.patrolPath.length;
        if (count < 2) return;
        if (this.isPathLoop) {
            this.pathIndex = (this.pathIndex + 1) % count;
            return;
        }
        if (this.pathIndex === count - 1) this.pathDirection = -1;
        else if (this.pathIndex === 0) this.pathDirection = 1;
        this.pathIndex += this.pathDirection;
    }

    private playPatrolAnimation(animation: enemyAnim) {
        if (this.currentAnim === animation) return;
        this.currentAnim = animation;
        this.roleAnim.setAnimation(0, animation, true);
    }

    /**根据皮肤id刷新敌人spine */
    private async refreshRoleSpine() {
        // if (this.roleAnim) {
        //     this.roleAnim.skeletonData = null;
        // }

        // let isLoaded = await ccTools.loadSpine(this.roleAnim, spinePath.boss + this.skinId);
        // if (!isLoaded) {
        //     return;
        // }

        this.currentAnim = null;
        this.playPatrolAnimation(enemyAnim.idle);
    }

    /**生命值百分比 */
    get hpPercent() {
        return this.hp / this.maxHp;
    }

    /**受到伤害并刷新血条；死亡状态由 hp 为 0 表示。 */
    takeDamage(damage: number) {
        if (!Number.isFinite(damage) || damage <= 0 || this.hp <= 0) return false;
        const actualDamage = Math.min(this.hp, damage);
        this.hp -= actualDamage;
        this.refreshHp();
        if (this.hp <= 0) {
            this.stopAttack();
            this.patrolState = PatrolState.Idle;
            this.playPatrolAnimation(enemyAnim.idle);
        }
        this.gameComp?.showDamageFloat(this.node, actualDamage);
        return true;
    }

    /**刷新血量 */
    refreshHp(isImmediate: boolean = false) {
        let hpPercent = Math.max(0, Math.min(1, this.hpPercent));
        let isHpReduced = hpPercent < this.hpBar.fillRange;
        this.hpBar.fillRange = hpPercent;
        Tween.stopAllByTarget(this.baseHp);

        if (isImmediate || !isHpReduced) {
            this.baseHp.fillRange = hpPercent;
            return;
        }

        tween(this.baseHp)
            .to(this.hpShadowDuration, { fillRange: hpPercent }, { easing: "linear" })
            .start();
    }
}
