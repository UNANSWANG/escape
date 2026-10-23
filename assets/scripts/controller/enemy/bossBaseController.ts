import { _decorator, CCFloat, CCInteger, Color, Component, Graphics, Label, Node, sp, Sprite, Tween, tween, UITransform, Vec3 } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import { bossConfig } from '../../json/jsonBoss';
import { BossBookState, enemyCommonConfig, GameEvent, gmConfig } from '../../manager/configData';
import { gm } from '../../manager/gm';
import { playerMgr } from '../../manager/playerManager';
import { pData } from '../../manager/playerData';
import { UIGame } from '../../UIPage/UIGame';
import { StaticCollisionMover } from '../staticCollisionMover';
const { ccclass, executeInEditMode, property } = _decorator;

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
@executeInEditMode
export class bossBaseController extends Component {
    private rangeGraphics: Graphics = null;
    private isFocusedInEditor = false;

    @property({ type: CCFloat, visible: false })
    private _previewRadius = 800;

    @property({ type: CCFloat, displayName: '显示范围半径', tooltip: '仅用于编辑器选中时显示圆形范围，不影响 Boss 行为' })
    get previewRadius() {
        return this._previewRadius;
    }

    set previewRadius(value: number) {
        this._previewRadius = Number.isFinite(value) ? Math.max(0, value) : 0;
        this.refreshRangePreview();
    }

    onFocusInEditor() {
        if (!EDITOR || PREVIEW) return;
        this.isFocusedInEditor = true;
        this.refreshRangePreview();
    }

    onLostFocusInEditor() {
        this.isFocusedInEditor = false;
        this.hideRangePreview();
    }

    protected onDisable() {
        this.isFocusedInEditor = false;
        this.hideRangePreview();
    }

    private refreshRangePreview() {
        if (!EDITOR || PREVIEW || !this.isFocusedInEditor) return;
        if (this.previewRadius <= 0) {
            this.hideRangePreview();
            return;
        }
        this.rangeGraphics = this.rangeGraphics ?? this.addComponent(Graphics);
        this.rangeGraphics.enabled = true;
        this.rangeGraphics.clear();
        this.rangeGraphics.lineWidth = 6;
        this.rangeGraphics.strokeColor = new Color(89, 0, 255, 220);
        this.rangeGraphics.circle(0, 0, this.previewRadius);
        this.rangeGraphics.stroke();
    }

    private hideRangePreview() {
        if (!this.rangeGraphics) return;
        this.rangeGraphics.clear();
        this.rangeGraphics.enabled = false;
        this.rangeGraphics.destroy();
        this.rangeGraphics = null;
    }

    /** Boss 表编号，由子类指定。 */
    id = 0;

    /** 攻击间隔（秒） */
    attackInterval = 1;

    /** 怒气上限，从 boss 表的 rage 读取。 */
    maxRage = 100;
    /** 当前怒气，满值后下一次普攻替换为技能。 */
    rage = 0;

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
    /** 怒气条根节点。 */
    protected angerNode: Node = null;
    /** 怒气进度条。 */
    protected angerBar: Sprite = null;
    /** 怒气虚影，消耗后缓动追赶。 */
    protected angerBase: Sprite = null;
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
    /** 攻击动画是否正在播放；播放期间禁止移动和再次攻击。 */
    private attackAnimationPlaying = false;
    private isInAttackRange = false;
    /** 当前动画名称。 */
    private currentAnim = '';
    /** 水平朝向：1 向右，-1 向左。 */
    private facingX = -1;
    /** 是否初始化成功。 */
    private initialized = false;
    /** 返回、站岗恢复的累计秒数。 */
    private recoveryElapsed = 0;
    /** 追击期间自然增怒的累计秒数。 */
    private rageRegenElapsed = 0;

    /** 缓存节点并监听表格加载。 */
    protected onLoad(): void {
        if (EDITOR && !PREVIEW) return;
        this.roleAnim = (this.node.getChildByName('anim') ?? this.node.getChildByName('roleAnim'))?.getComponent(sp.Skeleton);
        this.roleNameLab = (this.node.getChildByName('nameLab') ?? this.node.getChildByName('roleNameLab'))?.getComponent(Label);
        this.hpNode = this.node.getChildByName('hpNode');
        this.hpBar = this.hpNode?.getChildByName('bar')?.getComponent(Sprite);
        this.baseHp = this.hpNode?.getChildByName('base')?.getComponent(Sprite);
        this.angerNode = this.node.getChildByName('angerNode');
        this.angerBar = this.angerNode?.getChildByName('bar')?.getComponent(Sprite);
        this.angerBase = this.angerNode?.getChildByName('base')?.getComponent(Sprite);
        this.refreshRage(true);
        this.moveCollider = this.node.getChildByName('colliderBox')?.getComponent(UITransform);
        this.facingX = this.roleAnim?.node.scale.x < 0 ? 1 : -1;
        gm.Event.on(GameEvent.loadTable, this.onTableLoad, this);
    }

    /** 移除监听并停止缓动。 */
    protected onDestroy(): void {
        this.hideRangePreview();
        if (EDITOR && !PREVIEW) return;
        gm.Event.off(GameEvent.loadTable, this.onTableLoad, this);
        if (this.baseHp) Tween.stopAllByTarget(this.baseHp);
        if (this.angerBase) Tween.stopAllByTarget(this.angerBase);
    }

    /** 设置出生位置后调用初始化。 */
    init(comp: UIGame) {
        this.gameComp = comp;
        this.patrolOrigin.set(this.node.worldPosition);
        this.attackCooldown = 0;
        this.attackAnimationPlaying = false;
        this.isInAttackRange = false;
        this.rage = 0;
        this.recoveryElapsed = 0;
        this.rageRegenElapsed = 0;
        this.refreshRage();
        this.stopSkill();
        this.currentAnim = '';
        this.clearNavigationPath();
        this.bossState = BossState.Patrol;
        this.initialized = this.applyBossData(true);
        if (this.hpNode) this.hpNode.active = true;
        if (this.angerNode) this.angerNode.active = true;
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
        const maxRage = Number(data.rage);
        this.maxRage = Number.isFinite(maxRage) && maxRage > 0 ? maxRage : 100;
        this.rage = Math.max(0, Math.min(this.rage, this.maxRage));
        this.refreshRage();
        if (this.roleNameLab) this.roleNameLab.string = data.name;
        this.refreshHp(true);
        return true;
    }

    /** 刷新 Boss 配置和路线。 */
    private onTableLoad(tableName: string) {
        if (tableName !== 'boss' || !this.gameComp) return;
        this.initialized = this.applyBossData(!this.initialized);
        this.isInAttackRange = false;
        this.clearNavigationPath();
    }

    /** 更新攻击计时和行为状态。 */
    protected update(dt: number): void {
        if (EDITOR && !PREVIEW) return;
        if (!this.initialized || this.hp <= 0) return;
        if (this.bossState === BossState.Chase) {
            this.recoveryElapsed = 0;
            this.rageRegenElapsed += Math.max(0, dt);
            const seconds = Math.floor(this.rageRegenElapsed + 1e-9);
            if (seconds > 0) {
                this.rageRegenElapsed = Math.max(0, this.rageRegenElapsed - seconds);
                this.addRage(Math.max(0, Number(enemyCommonConfig.rageRegen) || 0) * seconds);
            }
        } else {
            this.rageRegenElapsed = 0;
        }
        if (!this.isAttacking) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.updateSkill(dt);
        // 攻击动画期间锁定行为，攻击间隔从动画结束后开始计时。
        if (this.isAttacking) return;
        const player = playerMgr.playerComp;
        const hasPlayer = player?.node?.isValid && player.node.activeInHierarchy && player.hp > 0;
        // 返回完成后恢复站岗。
        if (this.bossState === BossState.Return) {
            this.updateRecovery(dt);
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
                this.recoveryElapsed = 0;
                this.clearNavigationPath();
            } else {
                this.updateRecovery(dt);
            }
            return;
        }
        // 有效范围始终以出生点为圆心。
        if (!hasPlayer || !this.isInsideOriginRange(player.node.worldPosition, this.validRange)) {
            this.bossState = BossState.Return;
            this.isInAttackRange = false;
            this.rageRegenElapsed = 0;
            this.stopSkill();
            this.clearNavigationPath();
            return;
        }
        const target = player.node.worldPosition;
        if (this.isUsingSkill) {
            this.isInAttackRange = false;
            this.chaseDuringSkill(target, dt);
            return;
        }
        const dx = target.x - this.node.worldPosition.x;
        const dy = target.y - this.node.worldPosition.y;
        // 隔墙时继续寻路。
        const blocked = this.gameComp?.isWorldSegmentBlocked(this.node.worldPosition.x,
            this.node.worldPosition.y, target.x, target.y) ?? false;
        const stopDistance = this.attackDistance * (this.isInAttackRange ? 1 : 0.8);
        this.isInAttackRange = !blocked && dx * dx + dy * dy <= stopDistance * stopDistance;
        if (this.isInAttackRange) {
            this.clearNavigationPath();
            this.faceTarget(target);
            if (this.attackCooldown <= 0) this.normalAttack();
            else this.playAnimation('idle');
        } else {
            this.moveToward(target, dt);
        }
    }

    /** 返回、站岗时每满 1 秒回血、减怒。 */
    protected updateRecovery(dt: number) {
        this.recoveryElapsed += Math.max(0, dt);
        const elapsed = Math.floor(this.recoveryElapsed + 1e-9);
        if (elapsed <= 0) return;
        this.recoveryElapsed = Math.max(0, this.recoveryElapsed - elapsed);
        const regen = Math.max(0, Number(enemyCommonConfig.hpRegenPercent) || 0);
        const decay = Math.max(0, Number(enemyCommonConfig.rageDecay) || 0);
        const hp = Math.min(this.maxHp, this.hp + this.maxHp * regen * elapsed);
        if (hp !== this.hp) {
            this.hp = hp;
            this.refreshHp();
        }
        const rage = Math.max(0, this.rage - decay * elapsed);
        if (rage !== this.rage) {
            this.rage = rage;
            this.refreshRage();
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
        return this.attackAnimationPlaying;
    }

    /** 累计自然增长与受伤怒气，不超过上限。 */
    addRage(amount: number) {
        if (this.hp <= 0 || !Number.isFinite(amount) || amount <= 0) return;
        this.rage = Math.min(this.maxRage, this.rage + amount);
        this.refreshRage();
    }

    /** 子类实现技能，返回是否成功释放。 */
    protected startSkill(): boolean { return false; }
    protected updateSkill(dt: number): void {}
    protected stopSkill(): void {}
    get isUsingSkill(): boolean { return false; }

    /** 技能期间仍可追击，不进入普攻锁定。 */
    protected chaseDuringSkill(target: Vec3, dt: number) {
        this.moveToward(target, dt);
    }

    /** 攻击前方半圆，开始时结算伤害。 */
    protected normalAttack() {
        if (this.isAttacking || this.isUsingSkill || this.attackCooldown > 0 || this.hp <= 0) return;
        if (this.maxRage > 0 && this.rage >= this.maxRage && this.startSkill()) {
            this.rage = 0;
            this.refreshRage();
            this.attackCooldown = Math.max(0.01, this.attackInterval);
            return;
        }
        this.attackAnimationPlaying = true;
        this.playAttackAnimation();
        const player = playerMgr.playerComp;
        if (!player?.node?.isValid || !player.node.activeInHierarchy || player.hp <= 0) return;
        const dx = player.node.worldPosition.x - this.node.worldPosition.x;
        const dy = player.node.worldPosition.y - this.node.worldPosition.y;
        // 按距离和朝向筛选前方半圆。
        if (dx * dx + dy * dy <= this.attackDistance * this.attackDistance && dx * this.facingX >= 0) {
            player.takeDamage(this.attackDamage);
        }
    }

    /** 播放一次攻击动画；动画结束后才解除攻击锁定并开始攻击间隔计时。 */
    private playAttackAnimation() {
        if (!this.roleAnim?.skeletonData || !this.roleAnim.findAnimation('attack')) {
            this.finishAttackAnimation();
            return;
        }
        this.currentAnim = 'attack';
        const entry = this.roleAnim.setAnimation(0, 'attack', false);
        if (entry) this.roleAnim.setTrackCompleteListener(entry, () => this.finishAttackAnimation());
        else this.finishAttackAnimation();
    }

    private finishAttackAnimation() {
        if (!this.attackAnimationPlaying) return;
        this.attackAnimationPlaying = false;
        this.attackCooldown = Math.max(0.01, this.attackInterval);
        this.playAnimation('idle');
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
        const pathFinished = this.navigationPath.length > 0
            && this.navigationIndex >= this.navigationPath.length;
        // 已走完路线立即更新；寻路失败仍按间隔重试。
        if (pathFinished || this.navigationReplanRemaining <= 0
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
        if (distance < 0.001) {
            this.clearNavigationPath();
            return false;
        }
        if (step <= 0) return false;
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
        this.addRage(actualDamage);
        this.refreshHp();
        this.gameComp?.showDamageFloat(this.node, actualDamage);
        if (this.hp <= 0) this.playDeath();
        return true;
    }

    /** 播放死亡动画后隐藏。 */
    protected playDeath() {
        if (pData.getBossBookState(this.id) !== BossBookState.Defeated) {
            pData.setBossBookState(this.id, BossBookState.Defeated);
        }
        this.stopSkill();
        this.attackAnimationPlaying = false;
        this.clearNavigationPath();
        if (this.hpNode) this.hpNode.active = false;
        if (this.angerNode) this.angerNode.active = false;
        if (this.roleNameLab) this.roleNameLab.node.active = false;
        const finish = () => { if (this.isValid && this.hp <= 0) this.node.active = false; };
        if (!this.roleAnim?.skeletonData || !this.roleAnim.findAnimation('die')) { finish(); return; }
        const entry = this.roleAnim.setAnimation(0, 'die', false);
        this.roleAnim.setTrackCompleteListener(entry, finish);
    }

    /** 怒气减少时虚影追赶，immediate 表示立即同步。 */
    refreshRage(immediate = false) {
        const percent = this.maxRage > 0
            ? Math.max(0, Math.min(1, this.rage / this.maxRage)) : 0;
        const reduced = this.angerBar && percent < this.angerBar.fillRange;
        if (this.angerBar) this.angerBar.fillRange = percent;
        if (!this.angerBase) return;
        // 自然增长不打断尚未追上的虚影。
        if (!immediate && !reduced && this.angerBase.fillRange > percent) return;
        Tween.stopAllByTarget(this.angerBase);
        if (immediate || !reduced) this.angerBase.fillRange = percent;
        else tween(this.angerBase)
            .to(0.3, { fillRange: percent }, { easing: 'linear' })
            .call(() => this.refreshRage(true))
            .start();
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
