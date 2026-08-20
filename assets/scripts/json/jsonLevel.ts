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
    /**关卡数量 */
    quantity: number;
    /**boss血量（1级） */
    hp: number;
    /**boss攻击力（1级） */
    attack: number;
    /**升级最小时间 */
    upgradeTimeMin: number;
    /**升级最大时间 */
    upgradeTimeMax: number;
    /**升级血量倍率 */
    healthMultiplier: number;
    /**升级攻击力倍率 */
    attackMultiplier: number;
    /**升级最小时间倍率 */
    timeMinMultiplier: number;
    /**升级最大时间倍率 */
    timeMaxMultiplier: number;
    /**人机难度选择 */
    AIdifficulty: number[];
}
