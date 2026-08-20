import { _decorator, Node, Vec2 } from 'cc';
import type { enemyBaseController } from '../controller/enemy/enemyBaseController';
const { ccclass, property } = _decorator;

@ccclass('enemyManager')
export class enemyManager {
    /**敌人数组 */
    enemyArr: enemyBaseController[] = [];
    /**敌人id(单局累加) */
    enemyId: number = 0;

    /**当前关卡敌人全等级数据 */
    enemyAllData: any = [];

    /**敌人出生点位数组 */
    enemyBornPosArr: Vec2[] = [];

    /**根据id移除敌人 */
    removeEnemy(roleId: number) {
        let idx = -1;
        for (let i = 0; i < this.enemyArr.length; i++) {
            let enemyComp = this.enemyArr[i];
            if(enemyComp.roleId == roleId){
                idx = i;
                break;
            }
        }
        if(idx != -1){
            this.enemyArr.splice(idx, 1);
        }
    }
}
export let enemyMgr = new enemyManager();

