import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonItem')
export class jsonItem extends jsonBase {
    /** 表格名称 */
    tableName: string = "item";
    protected jsonPath: string = "json/item";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";
    /** 按品质分组的物品数据；无品质的物品不会加入 */
    private itemDataByQuality: Map<number, JsonItemData[]> = new Map();

    protected processTableData(): void {
        super.processTableData();
        this.itemDataByQuality.clear();

        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data ?? {});
        for (const itemData of rows as JsonItemData[]) {
            if (!Number.isFinite(itemData?.quality)) continue;

            const qualityItems = this.itemDataByQuality.get(itemData.quality) ?? [];
            qualityItems.push(itemData);
            this.itemDataByQuality.set(itemData.quality, qualityItems);
        }

        console.log(`--------->物品数据:`, this.itemDataByQuality);
    }

    /** 获取指定品质的全部物品数据 */
    getDataByQuality(quality: number): JsonItemData[] {
        if (!Number.isFinite(quality)) return [];
        return this.itemDataByQuality.get(quality) ?? [];
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


