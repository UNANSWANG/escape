import { _decorator, Node } from 'cc';
import { weaponsController } from './weaponsController';
const { ccclass, property } = _decorator;

/**
 * 近战刀控制器。
 *
 * 刀和枪共用武器的挂点同步、翻转、瞄准及基础属性逻辑；
 * 刀专属的攻击行为后续在此类中实现，避免与枪械逻辑耦合。
 */
@ccclass('knifeController')
export class knifeController extends weaponsController {
    /** 刀待机时相对水平线的角度绝对值；左右朝向会自动取相反符号。 */
    defaultAngle = 10;

    /**
     * 刀不使用目标瞄准角度，只保留由角色朝向决定的默认角度。
     * 近战攻击表现后续在专属攻击逻辑中处理。
     */
    aimAt(_target: Node) {
        this.clearAimTarget();
        return false;
    }

    /** 使用配置的刀默认角度，并随角色左右朝向镜像。 */
    protected getDefaultAngle(): number {
        const angle = Math.abs(this.defaultAngle);
        return this.node.scale.x < 0 ? angle : -angle;
    }
}
