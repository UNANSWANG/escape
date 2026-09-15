import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonRoleSkin')
export class jsonRoleSkin extends jsonBase {
    /** 表格名称 */
    tableName: string = "roleSkin";
    protected jsonPath: string = "json/roleSkin";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();
    }
}
export let roleSkinConfig = new jsonRoleSkin();

export interface JsonRoleSkinData {
    /**编号*/
    id: number;
    /**角色id */
    roleId: number;
    /**物品id */
    itemId: number;
    /**名字 */
    name: string;
}



