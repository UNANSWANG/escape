import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
const { ccclass, property } = _decorator;

@ccclass('jsonProps')
export class jsonProps extends jsonBase {
    /** 表格名称 */
    tableName: string = "props";
    protected jsonPath: string = "json/props";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    private propsData: JsonPropsData[][] = [];
    /**可随机生成的道具数据 */
    private randomPropsData: JsonPropsData[] = [];
    /**神秘商店道具数据 */
    storePropsData: JsonPropsData[][] = [];
    /**按建筑类型分组的一级道具数据 */
    private buildTypePropsData: { [key: number]: JsonPropsData[] } = {};

    /**表格处理 */
    protected processTableData() {
        super.processTableData();
        this.propsData = [];
        this.randomPropsData = [];
        this.storePropsData = [];
        this.buildTypePropsData = {};
        for (let i = 0; i < this.data.length; i++) {
            let data: JsonPropsData = this.data[i];
            if (typeof data.desc == "string") {
                data.desc = data.desc.replace(/\\r\\n|\\n|\/n/g, "\n");
            }
            data.level -= 1;
            if (data.level == 0 && data.buildType > 0) {
                if (!this.buildTypePropsData[data.buildType]) {
                    this.buildTypePropsData[data.buildType] = [];
                }
                this.buildTypePropsData[data.buildType].push(data);
            }
            if (this.propsData.hasOwnProperty(data.propsType)) {
                this.propsData[data.propsType].push(data);
            } else {
                this.propsData[data.propsType] = [data];
            }

            if (data.isRandom == 1) {
                this.randomPropsData.push(data);
            }

            if (data.hasOwnProperty("storeType")) {
                let storeType = data.storeType - 1;
                if (storeType < 0) {
                    continue;
                }
                if (!this.storePropsData[storeType]) {
                    this.storePropsData[storeType] = [data];
                } else {
                    this.storePropsData[storeType].push(data);
                }
            }
        }
        // console.warn("-------->初始化道具分类型数据:\n", this.propsData);
        // console.warn("-------->初始化可随机生成道具数据:\n", this.randomPropsData);
        // console.warn("-------->初始化神秘商店道具数据:\n", this.storePropsData);
    }

    /**获取指定类型道具数据 */
    getPropsData(propsType: string): JsonPropsData[] {
        if (!propsType) {
            return this.data || [];
        }

        return this.propsData[propsType];
    }

    /**获取全部道具数据 */
    getAllTable(): JsonPropsData[][] {
        if (!this.propsData) {
            return [];
        }
        return this.propsData;
    }

    /**获取可随机生成道具数据 */
    getRandomPropsData(): JsonPropsData[] {
        return this.randomPropsData || [];
    }

    /**获取神秘商店分类型道具数据 */
    getStorePropsData(): JsonPropsData[][] {
        return this.storePropsData || [];
    }

    /**获取指定建筑类型的一级道具数据 */
    getBuildTypePropsData(buildType: number): JsonPropsData[] {
        return this.buildTypePropsData[buildType] || [];
    }
}
export let propsConfig = new jsonProps();

export interface JsonPropsData {
    /**道具类型(标识符) */
    propsType: string;
    /**建筑类型 */
    buildType: number;
    /**描述 */
    desc: string;
    /**名称 */
    name: string;
    /**所需金币 */
    coin: number;
    /**所需电能 */
    power: number;
    /**前置条件 */
    preConditions: string;
    /**血量 */
    hp: number;
    /**产出金币 */
    produceCoin: number;
    /**产出电能 */
    producePower: number;
    /**攻击力 */
    attack: number;
    /**攻击距离 */
    attackRange: number;
    /**建造上限 */
    builNumMax: number;
    /**是否随机生成 */
    isRandom: number;
    /**等级*/
    level: number;
    /**神秘商店类型 */
    storeType: number;
    /**商店价格 */
    storePrice: number;
    /**价格数组 */
    priceArray: string;
    /**神秘商店初始数量 */
    storeInitNum: number;
}


