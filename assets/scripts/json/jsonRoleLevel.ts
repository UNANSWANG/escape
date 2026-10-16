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

    get tableData(): JsonRoleLevelData[] {
        return this.data;
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
    initiativeValue: number[] | string;
    /**被动描述 */
    passiveDesc: string;
    /**主动描述 */
    initiativeDesc: string;
}


