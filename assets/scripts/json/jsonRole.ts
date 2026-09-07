import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { pData } from '../manager/playerData';
const { ccclass, property } = _decorator;

@ccclass('jsonRole')
export class jsonRole extends jsonBase {
    /** 表格名称 */
    tableName: string = "role";
    protected jsonPath: string = "json/role";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    isInit = false;
    _defaultRoleId: number = 0;
    get defaultRoleId() : number{
        if(!this.isInit){
            for(let i = 0; i < this.roleAllData.length; i++){
                let role = this.roleAllData[i];
                if(role.isDefault == 1){
                    this._defaultRoleId = role.roleId;
                    break;
                }
            }

            this.isInit = true;
            return this._defaultRoleId;
        }else{
            return this._defaultRoleId;
        }
    }
    
    /**获取角色数据 */
    get roleAllData() : JsonRoleData[]{
        return this.data;
    }

    /**根据角色id获取角色数据 */
    getRoleDataById(roleId: number) : JsonRoleData {
        return this.roleAllData?.find((item) => item.roleId == roleId) || null;
    }

    protected processTableData(): void {
        super.processTableData();
        pData.initRoleData(this.defaultRoleId);
    }
}
export let roleConfig = new jsonRole();

export interface JsonRoleData {
    /**角色id */
    roleId: number;
    /**名称 */
    name: string;
    /**是否为初始皮肤 */
    isDefault: number;
    /**类型 */
    type: number;
    /**生命值 */
    hp: number;
    /**被动持续时间 */
    passiveTime: number;
    /**被动冷却时间 */
    passiveCd: number;
    /**被动数值 */
    passiveValue: string;
    /**主动持续时间 */
    initiativeTime: number;
    /**主动冷却时间 */
    initiativeCd: number;
    /**主动数值 */
    initiativeValue: string;
    /**被动描述 */
    passiveDesc: string;
    /**主动描述 */
    initiativeDesc: string;
}


