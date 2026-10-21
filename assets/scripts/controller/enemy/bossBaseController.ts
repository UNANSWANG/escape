import { _decorator, CCInteger, Component, Label, Node, sp, Sprite, Tween, tween, UITransform, Vec3 } from 'cc';
import { bossConfig } from '../../json/jsonBoss';
import { GameEvent, gmConfig } from '../../manager/configData';
import { gm } from '../../manager/gm';
import { playerMgr } from '../../manager/playerManager';
import { UIGame } from '../../UIPage/UIGame';
import { StaticCollisionMover } from '../staticCollisionMover';
const { ccclass, property } = _decorator;

/** Boss 行为状态。 */
export enum BossState {
    /** 定点站岗。 */
    Patrol,
    /** 追击或攻击。 */
    Chase,
    /** 返回出生点，途中不追击。 */
    Return,
}

/** Boss 通用行为基类，子类通过 id 选择配置。 */
@ccclass('bossBaseController')
export class bossBaseController extends Component {
    /** Boss 表编号，由子类指定。 */
    id = 0;

    /** 攻击间隔（秒） */
    attackInterval = 2;

    /** 攻击时长（秒），期间禁止移动。 */
    attackDuration = 0.5;

    /** 当前游戏页。 */
    gameComp: UIGame = null;
    /** Boss 本体动画。 */
    roleAnim: sp.Skeleton = null;
    /** 最大血量。 */
    maxHp = 0;
    /** 当前血量。 */
    hp = 0;
    /** 普通攻击伤害。 */
    attackDamage = 0;
    /** 每秒移动距离。 */
    moveSpeed = 0;
    /** 攻击距离及半圆伤害半径。 */
    attackDistance = 0;
    /** 站岗检测半径，以出生点为圆心。 */
    chaseRange = 0;
    /** 追击有效半径，以出生点为圆心。 */
    validRange = 0;
    /** 当前行为状态。 */
    protected bossState = BossState.Patrol;
    /** 固定出生点（世界坐标）。 */
    protected readonly patrolOrigin = new Vec3();
    /** 名称标签。 */
    protected roleNameLab: Label = null;
    /** 血条根节点。 */
    protected hpNode: Node = null;
    /** 当前血条。 */
    protected hpBar: Sprite = null;
    /** 血条虚影。 */
    protected baseHp: Sprite = null;
    /** 脚底碰撞区域。 */
    private moveCollider: UITransform = null;
    /** 静态碰撞移动器。 */
    private collisionMover = new StaticCollisionMover();
    /** 碰撞后的实际位移。 */
    private actualMove = new Vec3();
    /** 世界坐标寻路路线。 */
    private navigationPath: Vec3[] = [];
    /** 当前路点下标。 */
    private navigationIndex = 0;
    /** 上次寻路目标。 */
    private navigationTarget = new Vec3(Number.NaN, Number.NaN, 0);
    /** 寻路刷新剩余时间。 */
    private navigationReplanRemaining = 0;
    /** 攻击冷却剩余时间。 */
    private attackCooldown = 0;
    /** 攻击状态剩余时间。 */
    private attackRemaining = 0;
    /** 当前动画名称。 */
    private currentAnim = '';
    /** 水平朝向：1 向右，-1 向左。 */
    private facingX = -1;
    /** 是否初始化成功。 */
    private initialized = false;

    /** 缓存节点并监听表格加载。 */
    protected onLoad(): void {
        this.roleAnim = (this.node.getChildByName('anim') ?? this.node.getChildByName('roleAnim'))?.getComponent(sp.Skeleton);
        this.roleNameLab = (this.node.getChildByName('nameLab') ?? this.node.getChildByName('roleNameLab'))?.getComponent(Label);
        this.hpNode = this.node.getChildByName('hpNode');
        this.hpBar = this.hpNode?.getChildByName('bar')?.getComponent(Sprite);
        this.baseHp = this.hpNode?.getChildByName('base')?.getComponent(Sprite);
        this.moveCollider = this.node.getChildByName('colliderBox')?.getComponent(UITransform);
        this.facingX = this.roleAnim?.node.scale.x < 0 ? 1 : -1;
        gm.Event.on(GameEvent.loadTable, this.onTableLoad, this);
    }

    /** 移除监听并停止缓动。 */
    protected onDestroy(): void {
        gm.Event.off(GameEvent.loadTable, this.onTableLoad, this);
        if (this.baseHp) Tween.stopAllByTarget(this.baseHp);
    }

    /** 设置出生位置后调用初始化。 */
    init(comp: UIGame) {
        this.gameComp = comp;
        this.patrolOrigin.set(this.node.worldPosition);
        this.attackCooldown = 0;
        this.attackRemaining = 0;
        this.currentAnim = '';
        this.clearNavigationPath();
        this.bossState = BossState.Patrol;
        this.initialized = this.applyBossData(true);
        if (this.hpNode) this.hpNode.active = true;
        if (this.roleNameLab) this.roleNameLab.node.active = true;
        this.playAnimation('idle');
    }

    /** 读取配置，resetHp 决定是否回满血。 */
    private applyBossData(resetHp: boolean) {
        const data = bossConfig.getDataById(this.id);
        if (!data) {
            console.warn('boss 表中找不到配置，id=' + this.id);
            return false;
        }
        this.maxHp = Math.max(1, Number(data.hp) || 1);
        this.hp = resetHp ? this.maxHp : Math.min(this.hp, this.maxHp);
        this.attackDamage = Math.max(0, Number(data.attack) || 0);
        this.moveSpeed = Math.max(0, Number(data.speed) || 0);
        this.attackDistance = Math.max(0, Number(data.attackDistance) || 0);
        const interval = Number(data.attackInterval);
        this.attackInterval = Number.isFinite(interval) && interval > 0 ? Math.max(0.01, interval) : 1;
        this.chaseRange = Math.max(0, Number(data.chaseRange) || 0);
        this.validRange = Math.max(0, Number(data.validRange) || 0);
        if (this.roleNameLab) this.roleNameLab.string = data.name;
        this.refreshHp(true);
        return true;
    }

    /** 刷新 Boss 配置和路线。 */
    private onTableLoad(tableName: string) {
        if (tableName !== 'boss' || !this.gameComp) return;
        this.initialized = this.applyBossData(!this.initialized);
        this.clearNavigationPath();
    }

    /** 更新攻击计时和行为状态。 */
    protected update(dt: number): void {
        if (!this.initialized || this.hp <= 0) return;
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        const wasAttacking = this.isAttacking;
        this.attackRemaining = Math.max(0, this.attackRemaining - dt);
        // 攻击期间锁定行为，冷却继续计时。
        if (this.isAttacking) return;
        if (wasAttacking) this.playAnimation('idle');
        const player = playerMgr.playerComp;
        const hasPlayer = player?.node?.isValid && player.node.activeInHierarchy && player.hp > 0;
        // 返回完成后恢复站岗。
        if (this.bossState === BossState.Return) {
            if (this.moveToward(this.patrolOrigin, dt)) {
                this.bossState = BossState.Patrol;
                this.playAnimation('idle');
            }
            return;
        }
        // 仅站岗时检测追击范围。
        if (this.bossState === BossState.Patrol) {
            this.playAnimation('idle');
            if (hasPlayer && this.chaseRange > 0
                && this.isInsideOriginRange(player.node.worldPosition, this.chaseRange)
                && this.isInsideOriginRange(player.node.worldPosition, this.validRange)) {
                this.bossState = BossState.Chase;
                this.clearNavigationPath();
            }
            return;
        }
        // 有效范围始终以出生点为圆心。
        if (!hasPlayer || !this.isInsideOriginRange(player.node.worldPosition, this.validRange)) {
            this.bossState = BossState.Return;
            this.clearNavigationPath();
            return;
        }
        const target = player.node.worldPosition;
        const dx = target.x - this.node.worldPosition.x;
        const dy = target.y - this.node.worldPosition.y;
        // 隔墙时继续寻路。
        const blocked = this.gameComp?.isWorldSegmentBlocked(this.node.worldPosition.x,
            this.node.worldPosition.y, target.x, target.y) ?? false;
        if (dx * dx + dy * dy <= this.attackDistance * this.attackDistance && !blocked) {
            this.faceTarget(target);
            if (this.attackCooldown <= 0) this.normalAttack();
            else this.playAnimation('idle');
        } else {
            this.moveToward(target, dt);
        }
    }

    /** 判断是否位于出生点指定半径内。 */
    protected isInsideOriginRange(point: Vec3, range: number) {
        const dx = point.x - this.patrolOrigin.x;
        const dy = point.y - this.patrolOrigin.y;
        return dx * dx + dy * dy <= range * range;
    }

    /** 是否处于攻击状态。 */
    get isAttacking() {
        return this.attackRemaining > 0;
    }

    /** 攻击前方半圆，开始时结算伤害。 */
    protected normalAttack() {
        if (this.isAttacking || this.attackCooldown > 0 || this.hp <= 0) return;
        // 两套计时同时开始，均结束后才能再次攻击。
        this.attackCooldown = Math.max(0.01, this.attackInterval);
        this.attackRemaining = Number.isFinite(this.attackDuration) ? Math.max(0, this.attackDuration) : 0.5;
        this.playAnimation('attack', false, true);
        const player = playerMgr.playerComp;
        if (!player?.node?.isValid || !player.node.activeInHierarchy || player.hp <= 0) return;
        const dx = player.node.worldPosition.x - this.node.worldPosition.x;
        const dy = player.node.worldPosition.y - this.node.worldPosition.y;
        // 按距离和朝向筛选前方半圆。
        if (dx * dx + dy * dy <= this.attackDistance * this.attackDistance && dx * this.facingX >= 0) {
            player.takeDamage(this.attackDamage);
        }
    }

    /** 翻转本体朝向。 */
    protected faceTarget(target: Vec3) {
        const dx = target.x - this.node.worldPosition.x;
        if (Math.abs(dx) < 0.001) return;
        this.facingX = dx > 0 ? 1 : -1;
        if (!this.roleAnim) return;
        const scale = this.roleAnim.node.scale;
        this.roleAnim.node.setScale(-this.facingX * Math.abs(scale.x), scale.y, scale.z);
    }

    /** 播放动画，force 表示强制重播。 */
    protected playAnimation(name: string, loop = true, force = false) {
        if (!this.roleAnim?.skeletonData || !this.roleAnim.findAnimation(name)) return;
        if (!force && this.currentAnim === name) return;
        this.currentAnim = name;
        this.roleAnim.setAnimation(0, name, loop);
    }

    /** 清空路线，允许立即重新寻路。 */
    protected clearNavigationPath() {
        this.navigationPath.length = 0;
        this.navigationIndex = 0;
        this.navigationTarget.set(Number.NaN, Number.NaN, 0);
        this.navigationReplanRemaining = 0;
    }

    /** 沿路线移动并处理静态碰撞。 */
    protected moveToward(target: Vec3, dt: number) {
        if (this.isAttacking) return false;
        const current = this.node.worldPosition;
        if (Math.hypot(target.x - current.x, target.y - current.y) < 0.5) {
            this.clearNavigationPath();
            return true;
        }
        this.navigationReplanRemaining = Math.max(0, this.navigationReplanRemaining - dt);
        // 目标偏移超过 24 时，按 0.35 秒间隔重规划。
        const targetMoved = Math.hypot(target.x - this.navigationTarget.x, target.y - this.navigationTarget.y) > 24;
        if (this.navigationReplanRemaining <= 0
            && (this.navigationIndex >= this.navigationPath.length || targetMoved)) {
            this.navigationPath.length = 0;
            this.navigationIndex = 0;
            this.navigationTarget.set(target);
            this.navigationReplanRemaining = 0.35;
            if (this.moveCollider && this.gameComp) {
                this.collisionMover.findPath(this.node, this.moveCollider, this.gameComp, target, this.navigationPath);
            } else {
                this.navigationPath.push(new Vec3(target.x, target.y, current.z));
            }
        }
        let waypoint = this.navigationPath[this.navigationIndex];
        if (!waypoint) {
            this.playAnimation('idle');
            return false;
        }
        let distance = Math.hypot(waypoint.x - current.x, waypoint.y - current.y);
        // 仅跳过已到达路点，避免穿过转角。
        while (distance < 0.5 && this.navigationIndex + 1 < this.navigationPath.length) {
            waypoint = this.navigationPath[++this.navigationIndex];
            distance = Math.hypot(waypoint.x - current.x, waypoint.y - current.y);
        }
        const step = Math.min(distance, this.moveSpeed * Math.max(0, dt));
        if (distance < 0.001 || step <= 0) return false;
        const dx = (waypoint.x - current.x) / distance * step;
        const dy = (waypoint.y - current.y) / distance * step;
        this.faceTarget(waypoint);
        this.playAnimation('move');
        if (this.moveCollider && this.gameComp) {
            this.collisionMover.moveWorld(this.node, this.moveCollider, this.gameComp, dx, dy, this.actualMove);
            // 向前进度不足 20% 时重新寻路。
            if ((this.actualMove.x * dx + this.actualMove.y * dy) / step < step * 0.2) {
                this.clearNavigationPath();
            }
        } else {
            this.node.setWorldPosition(current.x + dx, current.y + dy, current.z);
        }
        if (Math.hypot(waypoint.x - this.node.worldPosition.x, waypoint.y - this.node.worldPosition.y) < 0.5) {
            this.navigationIndex++;
        }
        return Math.hypot(target.x - this.node.worldPosition.x, target.y - this.node.worldPosition.y) < 0.5;
    }

    /** 当前血量比例。 */
    get hpPercent() { return this.hp / this.maxHp; }

    /** 受伤处理，返回是否成功受伤。 */
    takeDamage(damage: number) {
        if (gmConfig.isBossInvincible || !Number.isFinite(damage) || damage <= 0 || this.hp <= 0) return false;
        const actualDamage = Math.min(this.hp, damage);
        this.hp -= actualDamage;
        this.refreshHp();
        this.gameComp?.showDamageFloat(this.node, actualDamage);
        if (this.hp <= 0) this.playDeath();
        return true;
    }

    /** 播放死亡动画后隐藏。 */
    protected playDeath() {
        this.attackRemaining = 0;
        this.clearNavigationPath();
        if (this.hpNode) this.hpNode.active = false;
        if (this.roleNameLab) this.roleNameLab.node.active = false;
        const finish = () => { if (this.isValid && this.hp <= 0) this.node.active = false; };
        if (!this.roleAnim?.skeletonData || !this.roleAnim.findAnimation('die')) { finish(); return; }
        const entry = this.roleAnim.setAnimation(0, 'die', false);
        this.roleAnim.setTrackCompleteListener(entry, finish);
    }

    /** 刷新血条，immediate 表示立即同步虚影。 */
    refreshHp(immediate = false) {
        const percent = Math.max(0, Math.min(1, this.hpPercent));
        const reduced = this.hpBar && percent < this.hpBar.fillRange;
        if (this.hpBar) this.hpBar.fillRange = percent;
        if (!this.baseHp) return;
        Tween.stopAllByTarget(this.baseHp);
        if (immediate || !reduced) this.baseHp.fillRange = percent;
        else tween(this.baseHp).to(0.3, { fillRange: percent }, { easing: 'linear' }).start();
    }
}
