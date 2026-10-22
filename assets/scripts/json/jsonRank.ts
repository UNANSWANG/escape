import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonRank')
export class jsonRank extends jsonBase {
    /** 表格名称 */
    tableName: string = "rank";
    protected jsonPath: string = "json/rank";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    get tableData(): JsonRankData[] {
        return this.data;
    }
}
export let rankConfig = new jsonRank();

export interface JsonRankData {
    /**编号 */
    id: number;
    /**名称 */
    name: string;
    /**段位积分 */
    rankScore: number;
}


