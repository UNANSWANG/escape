import { _decorator, Node, Vec2 } from 'cc';
import { soldiersController } from '../controller/enemy/soldiersController';
const { ccclass, property } = _decorator;

@ccclass('enemyManager')
export class enemyManager {
    /**小兵数组 */
    soldiersArr: soldiersController[] = [];
    /**小兵id(单局累加) */
    soldierId: number = 0;

    /**当前关卡敌人全等级数据 */
    enemyAllData: any = [];

    /**敌人出生点位数组 */
    enemyBornPosArr: Vec2[] = [];

    /**根据id移除敌人 */
    removeEnemy(roleId: number) {
        let idx = -1;
        for (let i = 0; i < this.soldiersArr.length; i++) {
            let enemyComp = this.soldiersArr[i];
            if(enemyComp.roleId == roleId){
                idx = i;
                break;
            }
        }
        if(idx != -1){
            this.soldiersArr.splice(idx, 1);
        }
    }
}
export let enemyMgr = new enemyManager();

