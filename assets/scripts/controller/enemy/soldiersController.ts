import { _decorator, Color, Component, Label, Node, sp, Sprite, tween, Tween, UITransform, UIOpacity, Vec2, Vec3 } from 'cc';
import { ccTools } from '../../extention/generalTools';
import { UIGame } from '../../UIPage/UIGame';
import { audioPath, spinePath, UIPath } from '../../manager/pathConfig';
import { ScoutType, soldiersData } from '../../data/soldiersData';
import { configData, enemyCommonConfig } from '../../manager/configData';
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
    /**角色当前游戏内id */
    roleId: number = 0;
    /**皮肤id */
    skinId: number = 0;
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

    protected onLoad(): void {
        this.roleAnim = this.node.getChildByName("roleAnim").getComponent(sp.Skeleton);
        this.weaponNode = this.node.getChildByName("weapons");
        this.weaponDefaultX = this.weaponNode?.position.x ?? 0;
        this.roleNameLab = this.node.getChildByName("roleNameLab").getComponent(Label);
        this.hpNode = this.node.getChildByName("hpBg");
        this.hpBar = this.hpNode.getChildByName("hpBar").getComponent(Sprite);
        this.baseHp = this.hpNode.getChildByName("baseHp").getComponent(Sprite);
        this.effectNode = this.node.getChildByName("effectNode");
    }

    protected onDestroy(): void {
        Tween.stopAllByTarget(this.baseHp);
    }

    /**初始化 */
    init(comp: UIGame, id: number, skinId: number, data: soldiersData = null, nickname = "") {
        this.hp = this.maxHp;
        
        this.refreshHp();
        
        this.gameComp = comp;
        this.roleId = id;
        this.skinId = skinId;
        this.refreshRoleSpine();

        this.roleNameLab.string = nickname || `小兵${this.roleId + 1}`
        this.initPatrol(data);
    }

    protected update(dt: number): void {
        if (this.hp <= 0) return;
        if (this.patrolState === PatrolState.Moving) {
            this.updatePatrolMovement(dt);
        } else if (this.patrolState === PatrolState.Waiting) {
            this.waitRemaining -= dt;
            if (this.waitRemaining <= 0) this.startNextPatrolLeg();
        }
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

        const weapon = this.weaponNode;
        if (!weapon) return;
        const weaponScale = weapon.scale;
        weapon.setScale(facingScale * Math.abs(weaponScale.x), weaponScale.y, weaponScale.z);
        weapon.setPosition(facingScale < 0 ? -this.weaponDefaultX : this.weaponDefaultX,
            weapon.position.y, weapon.position.z);
        this.setWeaponDefaultAngle();
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
        const step = Math.max(0, configData.moveSpeed * dt);
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
