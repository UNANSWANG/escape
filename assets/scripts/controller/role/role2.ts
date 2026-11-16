import { _decorator, instantiate, Node, sp } from 'cc';
import { roleController, roleType } from './roleController';
import { gm } from '../../manager/gm';
import { uiMgr } from '../../manager/UIManager';
import { ccTools } from '../../extention/generalTools';
import { spinePath } from '../../manager/pathConfig';
const { ccclass } = _decorator;

@ccclass('role2')
export class role2 extends roleController {
    /**角色类型 */
    roleType: roleType = roleType.shield;

    /**主动技能剩余无敌时间（秒）。 */
    private invincibleRemainTime = 0;
    private shieldNode: Node = null;
    private shieldSkeleton: sp.Skeleton = null;

    get isInvincible(): boolean {
        return this.hp > 0 && this.invincibleRemainTime > 0;
    }

    /**被动：将当前等级配置的减伤百分比转换为受伤倍率。 */
    get damageTakenScale(): number {
        const value = Number(this.roleLevelData?.passiveValue);
        return Number.isFinite(value) ? 1 - Math.min(100, Math.max(0, value)) / 100 : 1;
    }

    initData(): void {
        super.initData();
        const cooldown = Number(this.roleLevelData?.initiativeCd);
        this.skill2Cooldown = Number.isFinite(cooldown) ? Math.max(0, cooldown) : 0;
    }

    /**主动技能：在配置的持续时间内免疫所有伤害。 */
    useSkill2() {
        if (this.hp <= 0 || this.isInvincible || this.isSkillCooling(2)) return false;
        const duration = Number(this.roleLevelData?.initiativeTime);
        if (!Number.isFinite(duration) || duration <= 0) return false;

        this.invincibleRemainTime = duration;
        this.createShieldEffect();
        this.startSkillCooldown(2);
        return true;
    }

    private createShieldEffect() {
        this.clearShieldEffect();
        if (!this.effectNode?.isValid || !uiMgr.gameSpineItemPrefab) return;
        const effect = instantiate(uiMgr.gameSpineItemPrefab);
        const skeleton = effect.getComponent(sp.Skeleton);
        if (!skeleton) {
            effect.destroy();
            return;
        }
        this.shieldNode = effect;
        this.shieldSkeleton = skeleton;
        this.effectNode.addChild(effect);
        effect.layer = this.effectNode.layer;
        effect.setPosition(0, 0, 0);
        void this.playShieldAnimation(effect, skeleton);
    }

    private async playShieldAnimation(effect: Node, skeleton: sp.Skeleton): Promise<void> {
        try {
            const loaded = await ccTools.loadSpine(skeleton, spinePath.shield);
            if (this.shieldNode !== effect || !effect.isValid || !skeleton.isValid) return;
            if (!loaded || !this.isInvincible || !skeleton.findAnimation('animation')) {
                this.clearShieldEffect();
                return;
            }
            skeleton.timeScale = gm.isGamePause ? 0 : 1;
            skeleton.setAnimation(0, 'animation', true);
        } catch (error) {
            if (this.shieldNode === effect) this.clearShieldEffect();
            console.warn('role2 光盾动画加载失败', error);
        }
    }

    private clearShieldEffect() {
        if (this.shieldSkeleton?.isValid) ccTools.cancelAssetLoad(this.shieldSkeleton);
        if (this.shieldNode?.isValid) {
            this.shieldNode.active = false;
            this.shieldNode.destroy();
        }
        this.shieldNode = null;
        this.shieldSkeleton = null;
    }

    /**无敌时直接拦截伤害，护甲和生命值均不会减少。 */
    takeDamage(damage: number) {
        if (this.isInvincible) return false;
        return super.takeDamage(damage);
    }

    protected update(dt: number): void {
        if (this.hp <= 0) {
            this.invincibleRemainTime = 0;
            this.clearShieldEffect();
            return;
        }
        if (this.shieldSkeleton?.isValid) this.shieldSkeleton.timeScale = gm.isGamePause ? 0 : 1;
        if (gm.isGamePause || dt <= 0) return;
        super.update(dt);
        this.invincibleRemainTime = Math.max(0, this.invincibleRemainTime - dt);
        if (this.invincibleRemainTime <= 0 && this.shieldNode) this.clearShieldEffect();
    }

    playDeath(onComplete?: () => void) {
        this.invincibleRemainTime = 0;
        this.clearShieldEffect();
        super.playDeath(onComplete);
    }

    protected onDisable(): void {
        super.onDisable();
        this.invincibleRemainTime = 0;
        this.clearShieldEffect();
    }
}
