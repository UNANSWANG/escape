import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('jsonEquipment')
export class jsonEquipment extends jsonBase {
    /** 表格名称 */
    tableName: string = "equipment";
    protected jsonPath: string = "json/equipment";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();
    }

    /** 根据 itemId 获取一条装备配置。 */
    getDataByItemId(itemId: number): JsonEquipmentData | null {
        if (!Number.isFinite(itemId) || !this.data) return null;
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data);
        return rows.find((row: JsonEquipmentData) => row?.itemId === itemId) ?? null;
    }
}
export let equipmentConfig = new jsonEquipment();

export interface JsonEquipmentData {
    /**编号*/
    id: number;
    /**类型 */
    type: number;
    /**物品id */
    itemId: number;
    /**名字 */
    name: string;
    /**免伤百分比 */
    damageImmunity: number;
    /**护甲值 */
    defenseValue: number;
    /**容量 */
    capacity: number;
}

