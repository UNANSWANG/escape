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

    /**根据已通关关卡数获取等级索引和等级内关卡序号 */
    getLevelIndex(level: number): [number, number] {
        if (!this.data?.length) {
            return [-1, -1];
        }

        let remainingLevel = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
        for (let i = 0; i < this.tableData.length; i++) {
            if (i == this.tableData.length - 1) {
                return [i, remainingLevel + 1];
            }
            let quantity = this.tableData[i].quantity;
            if (remainingLevel < quantity) {
                return [i, remainingLevel + 1];
            }
            remainingLevel -= quantity;
        }

        return [-1, -1];
    }

    /**根据已通关关卡数获取关卡配置 */
    getLevelData(level: number): JsonLevelData {
        let levelIndex = this.getLevelIndex(level);
        return this.tableData?.[levelIndex[0]] || null;
    }

    /**根据关卡表索引获取人机难度类型 */
    getAIDifficultyTypes(levelTableIndex: number): number[] {
        return this.tableData?.[levelTableIndex]?.AIdifficulty || [];
    }

    /**根据关卡表索引生成Boss全等级数据 */
    getBossAllData(levelTableIndex: number): JsonBossData[] {
        let levelData = this.tableData?.[levelTableIndex];
        if (!levelData) {
            return [];
        }

        let bossAllData: JsonBossData[] = [];
        let levelMax = Number.isFinite(levelData.levelMax) ? Math.max(0, Math.floor(levelData.levelMax)) : 0;
        for (let bossLevel = 0; bossLevel < levelMax; bossLevel++) {
            let previousBossData = bossAllData[bossLevel - 1];
            bossAllData.push({
                level: bossLevel + 1,
                hp: previousBossData ? previousBossData.hp * levelData.healthMultiplier : levelData.hp,
                attack: previousBossData ? previousBossData.attack * levelData.attackMultiplier : levelData.attack,
                upgradeTimeMin: previousBossData
                    ? previousBossData.upgradeTimeMin + bossLevel * levelData.timeMinMultiplier
                    : levelData.upgradeTimeMin,
                upgradeTimeMax: previousBossData
                    ? previousBossData.upgradeTimeMax + bossLevel * levelData.timeMaxMultiplier
                    : levelData.upgradeTimeMax,
            });
        }
        return bossAllData.map(data => ({
            level: data.level,
            hp: Math.round(data.hp),
            attack: Math.round(data.attack),
            upgradeTimeMin: Math.round(data.upgradeTimeMin),
            upgradeTimeMax: Math.round(data.upgradeTimeMax),
        }));
    }

    /**根据等级索引和等级内关卡序号获取关卡名称 */
    getLevelName(levelIndex: [number, number]): string {
        let levelData = this.tableData?.[levelIndex?.[0]];
        if (!levelData || levelIndex[1] < 1) {
            return "";
        }
        return `${levelData.name}-${levelIndex[1]}`;
    }

    /**
     * 将上报的排名值（rank）反向解析为关卡索引 [模式索引(0基), 关卡序号(1基)]。
     * rank = 模式ID * rankModeFactor + 该模式已通关数，展示的是该模式的下一关（已通关数 + 1）；
     * 若已通关数已达到该模式关卡数量（quantity），则进位到下一模式第1关；
     * 最后一个模式为无限关卡，不进位。
     * 例：400002 => 进阶已通关2关 => [3, 3]（进阶-3）；400003 => 进阶已满3关 => [4, 1]（困难-1）。
     */
    getRankLevelIndex(rank: number): [number, number] {
        let table = this.tableData || [];
        let rankValue = Number.isFinite(Number(rank)) ? Math.max(0, Math.floor(Number(rank))) : 0;
        if (table.length <= 0 || rankValue <= 0) {
            return [-1, -1];
        }

        let modeIndex = Math.floor(rankValue / configData.rankModeFactor) - 1;
        let passCount = rankValue % configData.rankModeFactor;
        if (modeIndex < 0) {
            return [-1, -1];
        }

        let maxModeIndex = table.length - 1;
        modeIndex = Math.min(modeIndex, maxModeIndex);
        let levelNum = passCount + 1;
        //非最后一个模式：已通关数达到该模式关卡数量时，进位到下一模式第1关
        if (modeIndex < maxModeIndex) {
            let quantity = Math.max(1, Math.floor(Number(table[modeIndex]?.quantity) || 1));
            if (levelNum > quantity) {
                modeIndex++;
                levelNum = 1;
            }
        }
        return [modeIndex, levelNum];
    }

    /**根据上报的排名值（rank）获取关卡名称，如 400002 => “进阶-3”、400003 => “困难-1” */
    getRankLevelName(rank: number): string {
        return this.getLevelName(this.getRankLevelIndex(rank));
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

export interface JsonBossData {
    /**等级 */
    level: number;
    /**血量 */
    hp: number;
    /**攻击力 */
    attack: number;
    /**升级最小时间 */
    upgradeTimeMin: number;
    /**升级最大时间 */
    upgradeTimeMax: number;
}
