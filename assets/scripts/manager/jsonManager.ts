import { _decorator, Component, Node } from 'cc';
import { gm } from './gm';
import { GameEvent } from './configData';
import { commonConfig } from '../json/jsonCommon';
import { levelConfig } from '../json/jsonLevel';
const { ccclass, property } = _decorator;

@ccclass('jsonManager')
export class jsonManager  {
    /**表格数量 */
    tableNum = 1;
    /**已加载的表格数量 */
    tableLoadNum = 0;

    async load(){
        gm.Event.on(GameEvent.loadTable, this.loadCall, this);
        if(this.tableNum == 0){
            //没有表格直接加载完成
            gm.Event.emit(GameEvent.tableLoadComplete);
        }
        commonConfig.initTable();
        // levelConfig.initTable();
    }

    loadCall(name: string){
        this.tableLoadNum++;
        if(this.tableLoadNum == this.tableNum){
            gm.Event.emit(GameEvent.tableLoadComplete);
        }
    }
}

export let jsonMgr = new jsonManager();



