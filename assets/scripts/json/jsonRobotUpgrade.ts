import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonRobotUpgrade')
export class jsonRobotUpgrade extends jsonBase {
    /** 表格名称 */
    tableName: string = "robotUpgrade";
    protected jsonPath: string = "json/robotUpgrade";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";
    
    /**获取机器人升级数据 */
    get robotUpgradeAllData() : JsonRobotUpgradeData[]{
        return this.data;
    }

    /**数据数量 */
    get dataLength() : number{
        return this.data.length;
    }

    /**获取指定等级数据 */
    getData(level: number): JsonRobotUpgradeData {
        if (!this.data) {
            return null;
        }

        if(level >= this.data.length){
            level = this.data.length - 1;
        }
        return this.data[level];
    }
}
export let robotUpgradeConfig = new jsonRobotUpgrade();

export interface JsonRobotUpgradeData {
    /**升级的道具类型 */
    propsType: string;
    /**时间下限 */
    timeMin: number;
    /**时间上限 */
    timeMax: number;
}


