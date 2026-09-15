import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonSign')
export class jsonSign extends jsonBase {
    /** 表格名称 */
    tableName: string = "sign";
    protected jsonPath: string = "json/sign";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();
    }
}
export let signConfig = new jsonSign();

export interface JsonSignData {
    /**编号*/
    id: number;
    /**类型 */
    type: number;
    /**奖励 */
    reward: string;
}



