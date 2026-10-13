import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonBoss')
export class jsonBoss extends jsonBase {
    /** 表格名称 */
    tableName: string = "boss";
    protected jsonPath: string = "json/boss";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();
    }

    /** 获取 boss 表的全部配置。 */
    getAllData(): JsonBossData[] {
        if (!this.data) return [];
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data);
        return rows as JsonBossData[];
    }
}
export let bossConfig = new jsonBoss();

export interface JsonBossData {
    /**编号*/
    id: number;
    /**名字 */
    name: string;
    /**掉落物品id */
    dropItemId: number;
    /**描述 */
    desc: string;
}


