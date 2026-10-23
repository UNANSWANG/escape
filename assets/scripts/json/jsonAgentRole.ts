import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;
@ccclass('jsonAgentRole')
export class jsonAgentRole extends jsonBase {
    /** 表格名称 */
    tableName: string = "agentRole";
    protected jsonPath: string = "json/agentRole";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    get tableData(): JsonAgentRoleData[] {
        return this.data;
    }
}
export let agentRoleConfig = new jsonAgentRole();

export interface JsonAgentRoleData {
    /**编号 */
    id: number;
    /**类型 */
    type: number;
    /**角色id */
    roleId: number;
    /**皮肤id */
    skinId: number;
    /**武器id */
    weaponId: number;
    /**头盔id */
    helmetId: number;
    /**护甲id */
    armorId: number;
}


