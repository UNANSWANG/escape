import { _decorator, Component, Node } from 'cc';
import { jsonBase } from './jsonBase';
import { pData } from '../manager/playerData';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('jsonNickname')
export class jsonNickname extends jsonBase {
    /** 表格名称 */
    tableName: string = "nickname";
    protected jsonPath: string = "json/nickname";
    protected tableUrl1: string = "";
    protected tableUrl2: string = "";

    /**获取角色昵称数据 */
    get roleNicknameAllData(): JsonNicknameData[] {
        return this.data;
    }

    /**获取随机的昵称 */
    getRandomNickname() : string {
        let nicknameData = this.roleNicknameAllData[ccTools.getRandomNum(0, this.roleNicknameAllData.length)];
        return nicknameData.nickname;
    }
}
export let nicknameConfig = new jsonNickname();

interface JsonNicknameData {
    /**昵称 */
    nickname: string;
}


