import { _decorator } from 'cc';
import { bossBaseController } from './bossBaseController';
const { ccclass } = _decorator;

/**Boss 1 复用通用移动、待机、攻击和死亡逻辑，暂不释放技能。 */
@ccclass('bossController1')
export class bossController1 extends bossBaseController {
    /**Boss 表编号。 */
    id = 1;

    /**尚未实现技能；满怒时保留怒气，继续移动和普通攻击。 */
    protected startSkill(): boolean {
        return false;
    }
}
