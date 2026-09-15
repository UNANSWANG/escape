import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { JsonItemData } from './jsonItem';
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

    /** 根据 itemId 获取一条物品配置。 */
    getDataByItemId(itemId: number): JsonItemData | null {
        if (!Number.isFinite(itemId) || !this.data) return null;
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data);
        return rows.find((row: JsonItemData) => row?.itemId === itemId) ?? null;
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



