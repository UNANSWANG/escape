import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('jsonItem')
export class jsonItem extends jsonBase {
    /** 表格名称 */
    tableName: string = "item";
    protected jsonPath: string = "json/item";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();
    }
}
export let itemConfig = new jsonItem();

interface JsonItemData {
    /**类型 */
    type: number;
    /**物品id */
    itemId: number;
    /**名字 */
    name: string;
    /**品质 */
    quality: number;
    /**价值 */
    value: number;
    /**重量 */
    weight: number;
}


