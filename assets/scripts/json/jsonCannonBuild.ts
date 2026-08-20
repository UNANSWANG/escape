import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { gm } from '../manager/gm';
const { ccclass, property } = _decorator;

@ccclass('jsonCannonBuild')
export class jsonCannonBuild extends jsonBase {
    /** 表格名称 */
    tableName: string = "cannonBuild";
    protected jsonPath: string = "json/cannonBuild";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    /**根据模式分数据 */
    modeData: { [mode: number]: JsonCannonBuildData[] } = {};

    /**表格处理 */
    protected processTableData() {
        super.processTableData();
        this.modeData = {};
        for (let i = 0; i < this.data.length; i++) {
            let data: JsonCannonBuildData = this.data[i];
            if (!this.modeData[data.mode]) {
                this.modeData[data.mode] = [];
            }
            this.modeData[data.mode].push(data);
        }
        if(gm.isDebug){
            console.warn("-------->初始化炮台建造数据:\n",this.modeData);
        }
    }

    /**按模式和当前炮台数量获取对应的建造配置 */
    getDataByCannonCount(cannonCount: number, mode: number): JsonCannonBuildData {
        let dataArr = this.modeData[mode];
        if (!Array.isArray(dataArr)) {
            return null;
        }

        let count = Math.max(0, Math.floor(Number(cannonCount) || 0));
        for (let i = 0; i < dataArr.length; i++) {
            let data = dataArr[i];
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
export let cannonBuildConfig = new jsonCannonBuild();

export interface JsonCannonBuildData {
    /**模式 */
    mode: number;
    /**索引 */
    idx: number;
    /**最小数量 */
    minNum: number;
    /**最大数量 */
    maxNum?: number | string;
    /**判定时间 */
    time: number;
}

