import { _decorator, director, Rect, Vec2 } from 'cc';
import { EnemySpatialGrid } from './enemySpatialGrid';
import { soldiersController } from '../controller/enemy/soldiersController';
import type { bossBaseController } from '../controller/enemy/bossBaseController';
import type { roleController } from '../controller/role/roleController';

/** 玩家攻击、自动瞄准和技能共同使用的敌人类型。 */
export type EnemyTarget = soldiersController | bossBaseController | roleController;
const { ccclass, property } = _decorator;

@ccclass('enemyManager')
export class enemyManager {
    /**小兵数组 */
    soldiersArr: soldiersController[] = [];
    /** 本局生成的 Boss。 */
    bossesArr: bossBaseController[] = [];

    aiRoles: roleController[] = [];

    private spatialGrid = new EnemySpatialGrid();
    private spatialFrame = -1;
    private spatialGroups: ReadonlyArray<EnemyTarget>[] = [];
    private spatialCounts: number[] = [];

    /** 共用当帧包围盒；名单变化后在下一次查询立即同步。 */
    queryEnemies(bounds: Rect, out: EnemyTarget[]) {
        const frame = director.getTotalFrames();
        if (this.spatialFrame !== frame
            || this.spatialGroups[0] !== this.soldiersArr || this.spatialCounts[0] !== this.soldiersArr.length
            || this.spatialGroups[1] !== this.bossesArr || this.spatialCounts[1] !== this.bossesArr.length
            || this.spatialGroups[2] !== this.aiRoles || this.spatialCounts[2] !== this.aiRoles.length) {
            this.spatialGroups[0] = this.soldiersArr;
            this.spatialGroups[1] = this.bossesArr;
            this.spatialGroups[2] = this.aiRoles;
            this.spatialCounts[0] = this.soldiersArr.length;
            this.spatialCounts[1] = this.bossesArr.length;
            this.spatialCounts[2] = this.aiRoles.length;
            this.spatialGrid.sync(this.spatialGroups);
            this.spatialFrame = frame;
        }
        return this.spatialGrid.query(bounds, out);
    }

    clearSpatialIndex() {
        this.spatialGrid.clear();
        this.spatialGroups.length = 0;
        this.spatialCounts.length = 0;
        this.spatialFrame = -1;
    }

    /** 统一受击目标。士兵与 Boss 保留各自的管理列表。 */
    get allEnemies(): EnemyTarget[] {
        return [...this.soldiersArr, ...this.bossesArr, ...this.aiRoles];
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
            this.spatialFrame = -1;
        }
    }
}
export let enemyMgr = new enemyManager();

