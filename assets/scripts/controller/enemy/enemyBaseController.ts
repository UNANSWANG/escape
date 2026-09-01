import { _decorator, Color, Component, Label, Node, sp, Sprite, tween, Tween, UITransform, UIOpacity, Vec2, Vec3 } from 'cc';
import { ccTools } from '../../extention/generalTools';
import { UIGame } from '../../UIPage/UIGame';
import { audioPath, spinePath, UIPath } from '../../manager/pathConfig';
const { ccclass, property } = _decorator;

enum enemyAnim {
    /**静止 */
    idle = "idle",
    /**攻击 */
    attack = "attack",
    /**移动 */
    move = "move",
}

@ccclass('enemyBaseController')
export class enemyBaseController extends Component {
    /**角色当前游戏内id */
    roleId: number = 0;
    /**皮肤id */
    skinId: number = 0;
    /**游戏脚本 */
    gameComp: UIGame = null;
    /**最大血量 */
    maxHp: number = 0;
    /**当前血量 */
    hp: number = 0;
    /**攻击伤害 */
    attackDamage: number = 0;

    ///
    ///节点
    ///
    /**角色spine节点 */
    roleAnim: sp.Skeleton = null;
    /**角色名称 */
    roleNameLab: Label = null;
    /**角色等级 */
    levelLab: Label = null;
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

    protected onLoad(): void {
        this.roleAnim = this.node.getChildByName("roleAnim").getComponent(sp.Skeleton);
        this.roleNameLab = this.node.getChildByName("roleNameLab").getComponent(Label);
        this.levelLab = this.node.getChildByName("levelLab").getComponent(Label);
        this.hpNode = this.node.getChildByName("hpBg");
        this.hpBar = this.hpNode.getChildByName("hpBar").getComponent(Sprite);
        this.baseHp = this.hpNode.getChildByName("baseHp").getComponent(Sprite);
        this.effectNode = this.node.getChildByName("effectNode");
    }

    protected onDestroy(): void {
        Tween.stopAllByTarget(this.baseHp);
    }

    /**初始化 */
    init(comp: UIGame, id: number, skinId: number, nickname = "") {
        this.refreshHp();

        this.gameComp = comp;
        this.roleId = id;
        this.skinId = skinId;
        this.refreshRoleSpine();

        this.roleNameLab.string = nickname || `感染者${this.roleId + 1}`
    }

    /**根据皮肤id刷新敌人spine */
    private async refreshRoleSpine() {
        if (this.roleAnim) {
            this.roleAnim.skeletonData = null;
        }

        let isLoaded = await ccTools.loadSpine(this.roleAnim, spinePath.boss + this.skinId);
        if (!isLoaded) {
            return;
        }

        this.roleAnim.setAnimation(0, enemyAnim.idle, true);
    }

    /**生命值百分比 */
    get hpPercent() {
        return this.hp / this.maxHp;
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
