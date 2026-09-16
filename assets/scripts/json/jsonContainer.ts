import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonContainer')
export class jsonContainer extends jsonBase {
    /** 表格名称 */
    tableName: string = "container";
    protected jsonPath: string = "json/container";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();
    }
}
export let containerConfig = new jsonContainer();

export interface JsonContainerData {
    /**编号*/
    id: number;
    /**类型 */
    type: number;
    /**名字 */
    name: string;
    /**物品概率权重 */
    probabilityWeight: string;
    /**物品数量权重 */
    itemNumWeight: string;
}

