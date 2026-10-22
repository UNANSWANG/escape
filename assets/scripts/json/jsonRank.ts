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

    /**超出基础段位后，沿用最后一个段位的积分配置。 */
    getRankData(rank: number): JsonRankData | null {
        const ranks = this.tableData;
        if (!ranks?.length) return null;
        return ranks[Math.min(rank, ranks.length - 1)];
    }

    getRankName(rank: number): string {
        const rankData = this.getRankData(rank);
        if (!rankData) return '';
        const lastRank = this.tableData.length - 1;
        return rank > lastRank ? rankData.name + (rank - lastRank + 1) : rankData.name;
    }

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


