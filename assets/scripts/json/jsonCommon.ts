import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { GameEvent } from '../manager/configData';
import { gm } from '../manager/gm';
const { ccclass, property } = _decorator;

@ccclass('jsonCommon')
export class jsonCommon extends jsonBase {
    /** 表格名称 */
    tableName: string = "common";
    protected jsonPath: string = "json/common";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    private commonData = {};

    /**表格处理 */
    protected processTableData() {
        super.processTableData();
        for (let i = 0; i < this.data.length; i++) {
            let data = this.data[i];
            this.commonData[data.key] = data;
        }
        gm.Event.emit(GameEvent.commonTableFinish);
        // console.warn("-------->初始化公共分类型数据:\n",this.commonData);
    }

    /**获取指定类型公共数据 */
    getValue(key){
        return this.commonData[key]?.value;
    }

    /**获取指定类型公共数据（数字） */
    getValueNumber(key){
        return Number(this.commonData[key]?.value);
    }
}
export let commonConfig = new jsonCommon();

interface JsonCommonData {
    /**键 */
    key: string;
    /**值 */
    value: string;
}
