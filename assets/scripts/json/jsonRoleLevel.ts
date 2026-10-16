import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonRoleLevel')
export class jsonRoleLevel extends jsonBase {
    /** 表格名称 */
    tableName: string = "roleLevel";
    protected jsonPath: string = "json/roleLevel";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    /**按角色 id 分组的等级配置，每组按等级升序排列 */
    private roleLevelData: { [roleId: number]: JsonRoleLevelData[] } = {};

    /**获取原始角色等级表的全部数据 */
    get tableData(): JsonRoleLevelData[] {
        return this.data;
    }

    /**表格加载后重新按角色 id 分组，并按等级升序排列 */
    protected processTableData(): void {
        super.processTableData();
        this.roleLevelData = {};
        for (const row of this.tableData ?? []) {
            if (!this.roleLevelData[row.roleId]) {
                this.roleLevelData[row.roleId] = [];
            }
            this.roleLevelData[row.roleId].push(row);
        }
        Object.values(this.roleLevelData).forEach((levels) => {
            levels.sort((first, second) => first.level - second.level);
        });
    }

    /**获取指定角色的全部等级配置，未配置时返回空数组 */
    getRoleLevelsById(roleId: number): JsonRoleLevelData[] {
        return this.roleLevelData[roleId] ?? [];
    }

    /**根据角色 id 和等级获取配置，未找到时返回 null */
    getRoleLevelData(roleId: number, level: number): JsonRoleLevelData | null {
        return this.getRoleLevelsById(roleId).find((row) => row.level === level) ?? null;
    }

    /**角色的配置条数决定等级上限，未配置时返回 0 */
    getMaxLevel(roleId: number): number {
        return this.getRoleLevelsById(roleId).length;
    }
}
export let roleLevelConfig = new jsonRoleLevel();

export interface JsonRoleLevelData {
    /**编号 */
    id: number;
    /**角色id */
    roleId: number;
    /**等级 */
    level: number;
    /**被动持续时间 */
    passiveTime: number;
    /**被动冷却时间 */
    passiveCd: number;
    /**被动数值 */
    passiveValue: string;
    /**主动持续时间 */
    initiativeTime: number;
    /**主动冷却时间 */
    initiativeCd: number;
    /**主动数值 */
    initiativeValue: string;
    /**被动描述 */
    passiveDesc: string;
    /**主动描述 */
    initiativeDesc: string;
    /**被动升级描述 */
    passiveUpgradeDesc: string;
    /**主动升级描述 */
    initiativeUpgradeDesc: string;
    /**升级材料 */
    upgradeItem: string;
    /**升级金额 */
    upgradeMoney: number;
}


