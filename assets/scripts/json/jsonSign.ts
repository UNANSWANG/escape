import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonSign')
export class jsonSign extends jsonBase {
    /** 表格名称 */
    tableName: string = "sign";
    protected jsonPath: string = "json/sign";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();
    }

    /**获取所有签到类型，按类型从小到大排序 */
    getTypes(): number[] {
        if (!this.data) {
            return [];
        }

        const types = new Set<number>();
        for (const row of this.getRows()) {
            if (Number.isFinite(row?.type)) {
                types.add(row.type);
            }
        }
        return Array.from(types).sort((a, b) => a - b);
    }

    /**获取指定类型的签到奖励，按编号从小到大排序 */
    getDataByType(type: number): JsonSignData[] {
        return this.getRows()
            .filter((row) => row?.type === type)
            .sort((a, b) => a.id - b.id);
    }

    private getRows(): JsonSignData[] {
        if (!this.data) {
            return [];
        }
        return (Array.isArray(this.data) ? this.data : Object.values(this.data)) as JsonSignData[];
    }
}
export let signConfig = new jsonSign();

export interface JsonSignData {
    /**编号*/
    id: number;
    /**类型 */
    type: number;
    /**奖励 */
    reward: string;
}



