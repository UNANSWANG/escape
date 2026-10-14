import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;
@ccclass('jsonMap')
export class jsonMap extends jsonBase {
    /** 表格名称 */
    tableName: string = "map";
    protected jsonPath: string = "json/map";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    private mapDataByMapIdx: Map<number, JsonMapData[]> = new Map();

    protected processTableData(): void {
        super.processTableData();
        this.mapDataByMapIdx.clear();

        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data ?? {});
        for (const mapData of rows as JsonMapData[]) {
            if (!Number.isInteger(mapData?.mapIdx) || mapData.mapIdx < 0) continue;

            const maps = this.mapDataByMapIdx.get(mapData.mapIdx) ?? [];
            maps.push(mapData);
            this.mapDataByMapIdx.set(mapData.mapIdx, maps);
        }
    }

    getDataByMapIdx(mapIdx: number): JsonMapData[] {
        return this.mapDataByMapIdx.get(mapIdx) ?? [];
    }

    get tableData(): JsonMapData[] {
        return this.data;
    }
}
export let mapConfig = new jsonMap();

export interface JsonMapData {
    /**编号 */
    id: number;
    /**名称 */
    name: string;
    /**地图索引 */
    mapIdx: number;
    /**难度类型 */
    difficultyType: number;
    /**奖励列表 */
    rewardList: string;
    /**装备推荐 */
    equipList: string;
    /**boss索引 */
    bossId: number;
}


