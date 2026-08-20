import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonVeinBuild')
export class jsonVeinBuild extends jsonBase {
    /** 表格名称 */
    tableName: string = "veinBuild";
    protected jsonPath: string = "json/veinBuild";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    /**表格处理 */
    protected processTableData() {
        super.processTableData();
    }

    /**按当前矿脉数量获取对应的建造配置 */
    getDataByVeinCount(veinCount: number): JsonVeinBuildData {
        if (!Array.isArray(this.data)) {
            return null;
        }

        let count = Math.max(0, Math.floor(Number(veinCount) || 0));
        for (let i = 0; i < this.data.length; i++) {
            let data = this.data[i] as JsonVeinBuildData;
            let minNum = Math.max(0, Math.floor(Number(data?.minNum) || 0));
            let hasMaxNum = data?.maxNum !== undefined && data?.maxNum !== null && data?.maxNum !== "";
            let maxNum = hasMaxNum ? Math.floor(Number(data.maxNum)) : Number.MAX_SAFE_INTEGER;
            if (count >= minNum && count <= maxNum) {
                return data;
            }
        }

        return null;
    }
}
export let veinBuildConfig = new jsonVeinBuild();

export interface JsonVeinBuildData {
    /**最小数量 */
    minNum: number;
    /**最大数量 */
    maxNum?: number | string;
    /**概率 */
    probability: string;
}


