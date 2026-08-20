import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { pData } from '../manager/playerData';
const { ccclass, property } = _decorator;

@ccclass('jsonRoleSkin')
export class jsonRoleSkin extends jsonBase {
    /** 表格名称 */
    tableName: string = "roleSkin";
    protected jsonPath: string = "json/roleSkin";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    isInit = false;
    _defaultSkinId: number = 0;
    get defaultSkinId() : number{
        if(!this.isInit){
            for(let i = 0; i < this.roleSkinAllData.length; i++){
                let skin = this.roleSkinAllData[i];
                if(skin.isDefault == 1){
                    this._defaultSkinId = skin.skinId;
                    break;
                }
            }

            this.isInit = true;
            return this._defaultSkinId;
        }else{
            return this._defaultSkinId;
        }
    }

    /**获取角色皮肤数据 */
    get roleSkinAllData() : JsonRoleSkinData[]{
        return this.data;
    }

    /**根据皮肤id获取皮肤数据 */
    getSkinDataById(skinId: number) : JsonRoleSkinData {
        return this.roleSkinAllData?.find((item) => item.skinId == skinId) || null;
    }

    protected processTableData(): void {
        super.processTableData();
        pData.initSkinData(this.defaultSkinId);
    }
}
export let roleSkinConfig = new jsonRoleSkin();

interface JsonRoleSkinData {
    /**皮肤id */
    skinId: number;
    /**名称 */
    name: string;
    /**是否为初始皮肤 */
    isDefault: number;
    /**获取条件 */
    limitType: number;
    /**购买所需金币（类型1） */
    money: number;
    /**通关次数（类型3） */
    levelNum: number;
}


