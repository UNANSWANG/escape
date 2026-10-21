import { _decorator, Node, Vec2 } from 'cc';
import { soldiersController } from '../controller/enemy/soldiersController';
import type { bossBaseController } from '../controller/enemy/bossBaseController';

/** 玩家攻击、自动瞄准和技能共同使用的敌人类型。 */
export type EnemyTarget = soldiersController | bossBaseController;
const { ccclass, property } = _decorator;

@ccclass('enemyManager')
export class enemyManager {
    /**小兵数组 */
    soldiersArr: soldiersController[] = [];
    /** 本局生成的 Boss。 */
    bossesArr: bossBaseController[] = [];

    /** 统一受击目标。士兵与 Boss 保留各自的管理列表。 */
    get allEnemies(): EnemyTarget[] {
        return [...this.soldiersArr, ...this.bossesArr];
    }

    /**小兵id(单局累加) */
    soldierId: number = 0;

    /**当前关卡敌人全等级数据 */
    enemyAllData: any = [];

    /**敌人出生点位数组 */
    enemyBornPosArr: Vec2[] = [];

    /**根据id移除敌人 */
    removeEnemy(id: number) {
        let idx = -1;
        for (let i = 0; i < this.soldiersArr.length; i++) {
            let enemyComp = this.soldiersArr[i];
            if(enemyComp.id == id){
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

