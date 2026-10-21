import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonBoss')
export class jsonBoss extends jsonBase {
    /** 表格名称 */
    tableName: string = "boss";
    protected jsonPath: string = "json/boss";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();
    }

    /** 按配置编号读取 Boss 数据。 */
    getDataById(id: number): JsonBossData | null {
        if (!Number.isFinite(id)) return null;
        return this.getAllData().find(row => Number(row?.id) === id) ?? null;
    }

    /** 获取 boss 表的全部配置。 */
    getAllData(): JsonBossData[] {
        if (!this.data) return [];
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data);
        return rows as JsonBossData[];
    }
}
export let bossConfig = new jsonBoss();

export interface JsonBossData {
    /**编号*/
    id: number;
    /**名字 */
    name: string;
    /**掉落物品id */
    dropItemId: number;
    /**描述 */
    desc: string;
    /**血量 */
    hp: number;
    /**攻击力 */
    attack: number;
    /**移动速度 */
    speed: number;
    /**攻击距离 */
    attackDistance: number;
    /**攻击间隔 */
    attackInterval: number;
    /**追击范围 */
    chaseRange: number;
    /**有效范围 */
    validRange: number;
    /**怒气上限 */
    rage: number;
}


