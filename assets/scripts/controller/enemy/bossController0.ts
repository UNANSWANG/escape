import { _decorator } from 'cc';
import { bossBaseController } from './bossBaseController';
const { ccclass } = _decorator;

@ccclass('bossController0')
export class bossController0 extends bossBaseController {
    /** 此 Boss 使用 boss 表中 id 为 0 的配置。 */
    id = 0;
}
