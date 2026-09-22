import { _decorator, Color, Component, Label, Node, sp, Sprite, tween, Tween, UITransform, UIOpacity, Vec2, Vec3 } from 'cc';
import { ccTools } from '../../extention/generalTools';
import { UIGame } from '../../UIPage/UIGame';
import { audioPath, spinePath, UIPath } from '../../manager/pathConfig';
import { ScoutType, soldiersData } from '../../data/soldiersData';
import { configData, enemyCommonConfig, GameEvent, robotCommonConfig } from '../../manager/configData';
import { armsConfig } from '../../json/jsonArms';
import { weaponsConfig } from '../../json/jsonWeapons';
import { gm } from '../../manager/gm';
import { playerMgr } from '../../manager/playerManager';
import { weaponsController } from '../weaponsController';
import { gunController } from '../gunController';
import { knifeController } from '../knifeController';
import { shotgunController } from '../shotgunController';
import { sniperController } from '../sniperController';
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
    private scoutType: ScoutType = ScoutType.StandGuard;
    private patrolOrigin = new Vec3();
    private patrolTarget = new Vec3();
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

    protected onLoad(): void {
        this.roleAnim = this.node.getChildByName("roleAnim").getComponent(sp.Skeleton);
        this.weaponNode = this.node.getChildByName("weapons");
        this.weaponDefaultX = this.weaponNode?.position.x ?? 0;
        this.roleNameLab = this.node.getChildByName("roleNameLab").getComponent(Label);
        this.hpNode = this.node.getChildByName("hpBg");
        this.hpBar = this.hpNode.getChildByName("hpBar").getComponent(Sprite);
        this.baseHp = this.hpNode.getChildByName("baseHp").getComponent(Sprite);
        this.effectNode = this.node.getChildByName("effectNode");
        gm.Event.on(GameEvent.loadTable, this.onTableLoad, this);
    }

    protected onDestroy(): void {
        Tween.stopAllByTarget(this.baseHp);
        gm.Event.off(GameEvent.loadTable, this.onTableLoad, this);
    }

    /**初始化 */
    init(comp: UIGame, id: number, armsId: number, data: soldiersData = null, nickname = "") {
        this.hp = this.maxHp;
        
        this.refreshHp();
        
        this.gameComp = comp;
        this.id = id;
        this.armsId = armsId;
        this.applyArmsAndWeapon();

        this.refreshRoleSpine();

        this.roleNameLab.string = nickname || `小兵${this.id + 1}`
        this.initPatrol(data);
    }

    protected update(dt: number): void {
        if (this.hp <= 0) return;
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        if (this.updateAttack(dt)) return;
        if (this.patrolState === PatrolState.Moving) {
            this.updatePatrolMovement(dt);
        } else if (this.patrolState === PatrolState.Waiting) {
            this.waitRemaining -= dt;
            if (this.waitRemaining <= 0) this.startNextPatrolLeg();
        }
    }

    /** 一名小兵只装配兵种表指定的一把武器。 */
    private applyArmsAndWeapon() {
        const arms = armsConfig.getDataById(this.armsId);
        if (!arms) return;
        this.maxHp = Math.max(1, arms.hp);
        this.hp = this.maxHp;
        this.refreshHp(true);

        const weaponData = weaponsConfig.getDataById(arms.weaponId);
        if (!weaponData || !this.weaponNode) return;
        const oldWeapon = this.weaponNode.getComponent(weaponsController);
        if (oldWeapon) this.weaponNode.removeComponent(oldWeapon);
        if (weaponData.type === 0) this.weaponComp = this.weaponNode.addComponent(knifeController);
        else if (weaponData.type === 4) this.weaponComp = this.weaponNode.addComponent(shotgunController);
        else if (weaponData.type === 5) this.weaponComp = this.weaponNode.addComponent(sniperController);
        else this.weaponComp = this.weaponNode.addComponent(gunController);

        this.weaponComp.applyStats(weaponData);
        this.weaponComp.attack *= robotCommonConfig.npcAttackPercent;
        this.weaponComp.targetPlayer = true;
        this.weaponComp.bindToRole(this.roleAnim);
        this.weaponComp.resetRotation(true);
        this.weaponComp.playIdleAnim();
        this.attackCooldown = 0;
    }

    private onTableLoad(tableName: string) {
        if (tableName === 'arms' || tableName === 'weapons') this.applyArmsAndWeapon();
    }

    /** 玩家进入武器攻击范围时停下巡逻、瞄准并按武器间隔攻击。 */
    private updateAttack(dt: number) {
        const player = playerMgr.playerComp;
        const weapon = this.weaponComp;
        if (!weapon || !player?.node?.isValid || !player.node.activeInHierarchy || player.hp <= 0) {
            this.stopAttack();
            return false;
        }
        const dx = player.node.worldPosition.x - this.node.worldPosition.x;
        const dy = player.node.worldPosition.y - this.node.worldPosition.y;
        if (dx * dx + dy * dy > weapon.attackRange * weapon.attackRange) {
            this.stopAttack();
            return false;
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
        this.weaponComp?.resetRotation();
        if (this.patrolState === PatrolState.Moving) this.playPatrolAnimation(enemyAnim.move);
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
        this.patrolState = PatrolState.Idle;
        this.playPatrolAnimation(enemyAnim.idle);
        this.setWeaponDefaultAngle();
        this.startNextPatrolLeg();
    }

    private startNextPatrolLeg() {
        if (this.scoutType === ScoutType.AreaScout && this.rangeRadius > 0) {
            // 均匀地在出生点周围的圆内选点。
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.sqrt(Math.random()) * this.rangeRadius;
            this.patrolTarget.set(
                this.patrolOrigin.x + Math.cos(angle) * radius,
                this.patrolOrigin.y + Math.sin(angle) * radius,
                this.patrolOrigin.z,
            );
        } else if (this.scoutType === ScoutType.PathScout && this.patrolPath.length > 0) {
            this.patrolTarget.set(this.patrolPath[this.pathIndex]);
        } else {
            this.patrolState = PatrolState.Idle;
            this.playPatrolAnimation(enemyAnim.idle);
            return;
        }

        this.gameComp?.clampWorldPointToMap(this.node, this.patrolTarget, this.patrolTarget);
        this.facePatrolTarget();
        this.patrolState = PatrolState.Moving;
        this.playPatrolAnimation(enemyAnim.move);
    }

    /**按玩家的朝向规则翻转人物和枪，不影响名字和血条。 */
    private facePatrolTarget() {
        const directionX = this.patrolTarget.x - this.node.worldPosition.x;
        if (Math.abs(directionX) < 0.001) return;
        const facingScale = directionX > 0 ? -1 : 1;
        const animNode = this.roleAnim.node;
        const animScale = animNode.scale;
        animNode.setScale(facingScale * Math.abs(animScale.x), animScale.y, animScale.z);

        if (this.weaponComp) {
            this.weaponComp.setFacingByHorizontal(directionX);
            this.weaponComp.resetRotation(true);
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
        const current = this.node.worldPosition;
        const dx = this.patrolTarget.x - current.x;
        const dy = this.patrolTarget.y - current.y;
        const distance = Math.hypot(dx, dy);
        const step = Math.max(0, configData.moveSpeed * (this.weaponComp?.moveSpeedScale ?? 1) * dt);
        if (distance <= step || distance < 0.001) {
            this.patrolPosition.set(this.patrolTarget.x, this.patrolTarget.y, current.z);
            this.node.setWorldPosition(this.patrolPosition);
            this.arriveAtPatrolTarget();
            return;
        }

        this.patrolPosition.set(current.x + dx / distance * step,
            current.y + dy / distance * step, current.z);
        this.node.setWorldPosition(this.patrolPosition);
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
