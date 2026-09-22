import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonArms')
export class jsonArms extends jsonBase {
    /** 表格名称 */
    tableName: string = "arms";
    protected jsonPath: string = "json/arms";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    get tableData(): JsonArmsData[] {
        return this.data;
    }

    getDataById(id: number): JsonArmsData | null {
        if (!Number.isFinite(id) || !this.data) return null;
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data);
        return rows.find((row: JsonArmsData) => Number(row?.id) === id) ?? null;
    }
}
export let armsConfig = new jsonArms();

export interface JsonArmsData {
    /**编号 */
    id: number;
    /**名称 */
    name: string;
    /**使用武器编号 */
    weaponId: number;
    /**血量 */
    hp: number;
    /**检测范围 */
    detectRange: number;
    /**追击时间 */
    chaseTime: string;
}


