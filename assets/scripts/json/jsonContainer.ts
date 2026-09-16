import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

/** 容器表中 type 字段的取值 */
export enum ContainerType {
    /** 物资盒 */
    SupplyBox = 0,
    /** 淘汰盒 */
    EliminationBox = 1,
    /** Boss 盒 */
    BossBox = 2,
    /** 保险箱 */
    SafeBox = 3,
}

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

    /** 根据容器类型获取对应的容器配置 */
    getDataByType(type: ContainerType): JsonContainerData | null {
        if (!this.data) return null;
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data);
        return rows.find((row: JsonContainerData) => row?.type === type) ?? null;
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

