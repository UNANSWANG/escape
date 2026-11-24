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

    /**最高段位固定为配置表的最后一项。 */
    get maxRank(): number {
        return Math.max(0, (this.tableData?.length ?? 0) - 1);
    }

    /**超出范围时按最高段位读取。 */
    getRankData(rank: number): JsonRankData | null {
        const ranks = this.tableData;
        if (!ranks?.length) return null;
        return ranks[Math.min(rank, ranks.length - 1)];
    }

    getRankName(rank: number): string {
        const rankData = this.getRankData(rank);
        if (!rankData) return '';
        return rankData.name;
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
    /**段位id */
    rankId: number;
    /**晋升所需积分，最高段位无需配置 */
    rankScore?: number;
}


