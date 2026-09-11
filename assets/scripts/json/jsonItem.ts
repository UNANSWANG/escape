import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('jsonItem')
export class jsonItem extends jsonBase {
    /** 表格名称 */
    tableName: string = "item";
    protected jsonPath: string = "json/item";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();
    }

    /** 根据 itemId 获取一条物品配置。 */
    getDataByItemId(itemId: number): JsonItemData | null {
        if (!Number.isFinite(itemId) || !this.data) return null;
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data);
        return rows.find((row: JsonItemData) => row?.itemId === itemId) ?? null;
    }
}
export let itemConfig = new jsonItem();

export interface JsonItemData {
    /**编号*/
    id: number;
    /**类型 */
    type: number;
    /**物品id */
    itemId: number;
    /**名字 */
    name: string;
    /**品质 */
    quality: number;
    /**价值 */
    value: number;
    /**重量 */
    weight: number;
}


