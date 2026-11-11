import { _decorator } from 'cc';
import { bossBaseController } from './bossBaseController';
const { ccclass } = _decorator;

/** Boss2 控制器，复用 Boss 通用行为。 */
@ccclass('bossController2')
export class bossController2 extends bossBaseController {
    /** Boss 表编号。 */
    id = 2;
}
