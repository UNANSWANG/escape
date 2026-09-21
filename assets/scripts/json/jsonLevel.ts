import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { configData } from '../manager/configData';
const { ccclass, property } = _decorator;

@ccclass('jsonLevel')
export class jsonLevel extends jsonBase {
    /** 表格名称 */
    tableName: string = "levelTable";
    protected jsonPath: string = "json/levelTable";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    get tableData() : JsonLevelData[]{
        return this.data;
    }
}
export let levelConfig = new jsonLevel();

export interface JsonLevelData {
    /**关卡名称 */
    name: string;
    /**等级最大值 */
    levelMax: number;
}
