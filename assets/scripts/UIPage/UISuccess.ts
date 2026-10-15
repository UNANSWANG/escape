import { _decorator, Label, Node, sp, tween, Tween, Vec3 } from 'cc';
import { UIBase } from './UIBase';
import { audioPath, spinePath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { pData } from '../manager/playerData';
import { gm } from '../manager/gm';
import { audioMgr } from '../manager/audioManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { videoMgr } from '../manager/videoManager';
import { loop_anim, loopAnimation } from '../controller/loopAnimation';
import { ccStorageTools } from '../extention/storageTools';
import { SaveKey } from '../manager/configData';
import { roleAnimName } from '../controller/role/roleController';
const { ccclass, property } = _decorator;

@ccclass('UISuccess')
export class UISuccess extends UIBase {
    @property(Node)
    mainBtn: Node;

    @property(Label)
    timeLab: Label;

    @property(Label)
    getNumLab: Label;

    @property(Label)
    curRankNumLab: Label;

    @property(Label)
    addRankNumLab: Label;

    @property(Node)
    itemContent: Node;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(data?) {
        gm.gamePause();
        audioMgr.playEffect(audioPath.success);
        this.initData(data);
    }

    initData(data?) {
        let survivalTime = Math.max(0, Number(data?.survivalTime) || 0);
        this.timeLab.string = `存活时间：${Math.floor(survivalTime)}s`;

        pData.SDKReportLevelComplete();
        pData.addLevel();
    }

    bindBtn() {
        this.mainBtn.addComponent(zoomButton).onClick = this.clickMainBtn.bind(this);
    }

    ///
    ///点击事件
    ///

    /**点击返回主界面按钮 */
    clickMainBtn() {
        this.onClose();
        uiMgr.closeGame();
    }

    onClose() {
        gm.gameResume();
        uiMgr.closePage(UIPath.UISuccess);
    }
}
