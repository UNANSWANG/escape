import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonBossLevel')
export class jsonBossLevel extends jsonBase {
    /** 表格名称 */
    tableName: string = "bossLevel";
    protected jsonPath: string = "json/bossLevel";
    protected tableUrl1: string = "https://cdn.taozigame.com/lt/config/15/bossLevel.json";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();
    }

    /** 根据 Boss 编号和地图难度读取配置；id 仅为行编号。 */
    getDataByBossIdAndType(bossId: number, type: number): JsonBossLevelData | null {
        if (!Number.isFinite(bossId) || !Number.isFinite(type)) return null;
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data ?? {});
        return (rows as JsonBossLevelData[]).find(row =>
            Number(row?.bossId) === bossId && Number(row?.type) === type) ?? null;
    }

}
export let bossLevelConfig = new jsonBossLevel();

export interface JsonBossLevelData {
    /**编号*/
    id: number;
    /**boss的Id */
    bossId: number;
    /**难度类型 */
    type: number;
    /**掉落物品概率（百分数，20 表示 20%） */
    dropItemProb: number;
    /**血量 */
    hp: number;
    /**攻击力 */
    attack: number;
    /**掉落金币数 */
    dropGoldNum: number;
}


