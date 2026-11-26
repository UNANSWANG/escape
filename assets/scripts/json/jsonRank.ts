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

    /**最高段位使用配置中的最大编号，而不是段位组编号或数组下标。 */
    get maxRank(): number {
        return (this.tableData ?? []).reduce((maxId, rankData) =>
            Number.isInteger(rankData?.id) ? Math.max(maxId, rankData.id) : maxId, 0);
    }

    /**按段位编号读取；存档编号超出配置时按最高编号读取。 */
    getRankData(rank: number): JsonRankData | null {
        const ranks = this.tableData;
        if (!ranks?.length) return null;
        const rankId = Number.isFinite(rank) ? Math.max(0, Math.floor(rank)) : 0;
        return ranks.find((rankData) => rankData.id === rankId)
            ?? ranks.find((rankData) => rankData.id === this.maxRank)
            ?? null;
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


