import { _decorator } from 'cc';
import { gunController } from './gunController';
const { ccclass } = _decorator;

/** 狙击枪控制器：沿用普通枪械的射击与换弹逻辑，装备时扩大游戏相机视野。 */
@ccclass('sniperController')
export class sniperController extends gunController {
    /** 装备狙击枪后的可视范围倍率：1.2 表示扩大 20%。 */
    viewScale = 1.2;
}
