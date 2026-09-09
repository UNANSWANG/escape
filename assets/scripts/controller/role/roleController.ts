import { _decorator, Component, Label, Node, sp } from 'cc';
import { enemyMgr } from '../../manager/enemyManager';
import { UIGame } from '../../UIPage/UIGame';
import { configData, GameEvent, playerCommonConfig } from '../../manager/configData';
import { gm } from '../../manager/gm';
import { enemyBaseController } from '../enemy/enemyBaseController';
import { gunController } from '../gunController';
import { knifeController } from '../knifeController';
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
    /**基础移速。角色专属技能可重写 moveSpeed，在读取时按自身状态计算最终速度。 */
    protected baseMoveSpeed = 0;
    /**游戏界面脚本 */
    gameComp: UIGame = null;
    /**角色当前播放的动画名 */
    protected curRoleAnimName = '';

    /**角色类型 */
    roleType: roleType = roleType.advance;
    /** 角色本体 Spine。 */
    roleAnim: sp.Skeleton = null;
    /** 角色头顶名称文本。 */
    roleNameLab: Label = null;
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
    /**角色血量 */
    hp = 0;
    /**角色数据 */
    roleData: JsonRoleData = null;

    /** 缓存角色自身与子节点组件。 */
    protected onLoad(): void {
        this.roleAnim = this.node.getChildByName('roleAnim')?.getComponent(sp.Skeleton);
        this.roleNameLab = this.node.getChildByName('roleNameLab')?.getComponent(Label);
        const weaponRoot = this.node.getChildByName('weapons');
        const weaponNodes = ['weapons_0', 'weapons_1', 'weapons_2'];
        this.weaponNodes = weaponNodes.map((name) => weaponRoot?.getChildByName(name) ?? null);
        this.weaponComps = this.weaponNodes.map((node) => node?.getComponent(weaponsController) ?? null);
        this.currentWeaponComp = this.weaponComps.find((weapon) => weapon?.node.activeInHierarchy) ?? null;
        this.gunComp = this.currentWeaponComp?.node.getComponent(gunController) ?? null;
        gm.Event.on(GameEvent.loadTable, this.onTableLoad, this);
    }

    protected onDestroy(): void {
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

        if (this.currentWeaponComp) {
            this.syncCurrentWeaponDefaultPose();
            this.currentWeaponComp.playIdleAnim();
        }
        return true;
    }

    /** UI 完成换弹事件绑定后调用，处理当前枪械的切入状态。 */
    onCurrentWeaponEquipped() {
        this.gunComp?.onWeaponEquipped();
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

    /**当前移速。基类仅处理通用技能1的加速，专属角色可按自身状态重写。 */
    get moveSpeed() {
        return this.baseMoveSpeed * (this.isUsingCommonSkill1 ? this.skill1SpeedScale : 1);
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
    setAttackHeld(isHeld: boolean) {
        if (this.isAttackHeld === isHeld) return;
        this.isAttackHeld = isHeld;
        if (isHeld) {
            this.refreshCombatState();
        } else if (this.battleState === roleBattleState.combat) {
            this.combatRemainTime = Math.max(0, playerCommonConfig.gunResetTime);
        }
    }

    protected update(dt: number): void {
        this.updateBattleState(dt);
        this.updateCommonSkill1(dt);
        this.updateSkillCooldown(dt);
    }

    /**组件停用时终止通用技能1，避免加速状态遗留到下次启用。 */
    protected onDisable(): void {
        this.finishCommonSkill1();
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

        this.hp = this.roleData?.hp ?? 0;
        this.baseMoveSpeed = configData.moveSpeed;
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
            this.syncCurrentWeaponDefaultPose();
            this.currentWeaponComp?.playIdleAnim();
        }
    }

    /**
     * 按 weapons 表的类型给武器节点挂载控制脚本：0 为刀，其余为枪械。
     * 切换装备数据时会移除旧类型组件，避免同一节点同时存在刀和枪两个控制器。
     */
    private assignWeaponController(node: Node, weaponType: number) {
        const gun = node.getComponent(gunController);
        const knife = node.getComponent(knifeController);
        if (weaponType === 0) {
            if (gun) node.removeComponent(gun);
            const weapon = node.getComponent(weaponsController);
            if (weapon && !knife) node.removeComponent(weapon);
            return knife ?? node.addComponent(knifeController);
        }

        const weapon = node.getComponent(weaponsController);
        if (weapon && !gun) node.removeComponent(weapon);
        return node.getComponent(gunController) ?? node.addComponent(gunController);
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

    /** 清除枪械锁定目标。 */
    clearGunAimTarget() {
        this.currentWeaponComp?.clearAimTarget();
    }

    /** 由当前枪械从游戏 UI 节点中生成子弹。 */
    fireBullet() {
        const isFired = this.gunComp?.fireBullet(this.gameComp?.gameUINode) ?? false;
        if (isFired) this.refreshCombatState();
        return isFired;
    }

    /**受到伤害时扣除生命值，并在角色头顶显示实际伤害数值。 */
    takeDamage(damage: number) {
        if (!Number.isFinite(damage) || damage <= 0 || this.hp <= 0) return false;
        const actualDamage = Math.min(this.hp, damage);
        this.hp -= actualDamage;
        this.gameComp?.showDamageFloat(this.node, actualDamage);
        return true;
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
