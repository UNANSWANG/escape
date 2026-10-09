import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('jsonWeapons')
export class jsonWeapons extends jsonBase {
    /** 表格名称 */
    tableName: string = "weapons";
    protected jsonPath: string = "json/weapons";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    protected processTableData(): void {
        super.processTableData();

    }

    /** 根据 weapons 表的 id 获取一条武器配置。 */
    getDataById(id: number): JsonWeaponsData | null {
        if (!Number.isFinite(id) || !this.data) return null;
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data);
        return rows.find((row: JsonWeaponsData) => row?.id === id) ?? null;
    }

    /** 根据 itemId 获取一条武器配置。 */
    getDataByItemId(itemId: number): JsonWeaponsData | null {
        if (!Number.isFinite(itemId) || !this.data) return null;
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data);
        return rows.find((row: JsonWeaponsData) => row?.itemId === itemId) ?? null;
    }

    /** 获取 weapons 表的全部配置。 */
    getAllData(): JsonWeaponsData[] {
        if (!this.data) return [];
        const rows = Array.isArray(this.data) ? this.data : Object.values(this.data);
        return rows as JsonWeaponsData[];
    }
}
export let weaponsConfig = new jsonWeapons();

export interface JsonWeaponsData {
    /**编号*/
    id: number;
    /**类型 */
    type: number;
    /**物品id */
    itemId: number;
    /**名字 */
    name: string;
    /**种类 */
    kinds: number;
    /**品质 */
    quality: number;
    /**货币类型 */
    currencyType: number;
    /**价值 */
    value: number;
    /**是否广告购买 */
    isAdBuy: number;
    /**攻击间隔 */
    attackInterval: number;
    /**子弹飞行速度 */
    flightSpeed: number;
    /**攻击力 */
    attack: number;
    /**移动速度百分比 */
    speed: number;
    /**弹夹容量 */
    capacity: number;
    /**攻击范围 */
    attackRange: number;
    /**子弹数量(霰弹) */
    bulletNum: number;
    /**蓄力时间（狙击枪） */
    chargeTime: number;
}

