import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { gm } from '../manager/gm';
const { ccclass, property } = _decorator;

@ccclass('jsonRobotDifficulty')
export class jsonRobotDifficulty extends jsonBase {
    /** 表格名称 */
    tableName: string = "robotDifficulty";
    protected jsonPath: string = "json/robotDifficulty";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    /**根据模式分数据 */
    modeData: { [mode: number]: JsonRobotDifficultyData[][] } = {};

    /**表格处理 */
    protected processTableData() {
        super.processTableData();
        this.modeData = {};
        for (let i = 0; i < this.data.length; i++) {
            let data = this.data[i] as JsonRobotDifficultyData;
            if (!this.modeData[data.mode]) {
                this.modeData[data.mode] = [];
            }
            if (!this.modeData[data.mode][data.type - 1]) {
                this.modeData[data.mode][data.type - 1] = [];
            }
            this.modeData[data.mode][data.type - 1].push(data);
        }

        if(gm.isDebug){
            console.warn("-------->初始化机器人难度数据:\n",this.modeData);
        }
    }

    /**按模式和难度类型获取配置组 */
    getDataByModeAndType(mode: number, type: number): JsonRobotDifficultyData[] {
        return this.modeData[mode]?.[type - 1] || [];
    }
}
export let robotDifficultyConfig = new jsonRobotDifficulty();

export interface JsonRobotDifficultyData {
    /**模式 */
    mode: number;
    /**难度类型 */
    type: number;
    /**炮台行为权重 */
    [key: `probability${number}`]: string | number[];
}


