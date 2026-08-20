import { _decorator, Component, getSymbolLength, Node } from 'cc';
import { uiMgr } from './UIManager';
import { UIPath } from './pathConfig';
import { ccStorageTools } from '../extention/storageTools';
import { GameEvent, SaveKey } from './configData';
import { gm } from './gm';
import { pData } from './playerData';
const { ccclass, property } = _decorator;

@ccclass('preloadManager')
export class preloadManager extends Component {
    protected onLoad(): void {
        this.initData();
    }

    initData() {
        /**初始化界面管理 */
        uiMgr.initData(this.node);

        uiMgr.openPage(UIPath.UIMain);

        gm.Event.on(GameEvent.fullSkin, pData.getAllSkin, pData);
    }
}


