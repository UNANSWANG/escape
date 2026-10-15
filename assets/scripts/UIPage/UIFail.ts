import { _decorator, Component, Node, Animation, Label, sp, tween, Tween, Vec3 } from 'cc';
import { audioPath, spinePath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { UIBase } from './UIBase';
import { gm } from '../manager/gm';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { videoMgr } from '../manager/videoManager';
import { pData } from '../manager/playerData';
import { loop_anim, loopAnimation } from '../controller/loopAnimation';
import { audioMgr } from '../manager/audioManager';
const { ccclass, property } = _decorator;

export enum FailType {
    /**时间到 */
    TimeOut = 0,
    /**生命值为0 */
    LifeZero = 1,
}
@ccclass('UIFail')
export class UIFail extends UIBase {
    @property(Node)
    mainBtn: Node;

    @property(Node)
    retrieveBtn: Node;

    @property(Label)
    timeLab: Label;

    @property(Label)
    dropNumLab: Label;

    @property(Label)
    curRankNumLab: Label;

    @property(Label)
    addRankNumLab: Label;

    @property(Node)
    itemContent: Node;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(data?: any) {
        gm.gamePause();
        audioMgr.playEffect(audioPath.fail);
        this.initData(data);
    }

    initData(data?) {
        uiMgr.clearBackpack();
        let survivalTime = Math.max(0, Number(data?.survivalTime) || 0);
        this.timeLab.string = `存活时间：${Math.floor(survivalTime)}s`;

        pData.SDKReportLevelFail();
        pData.reportLevel(false);
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
        uiMgr.closePage(UIPath.UIFail);
        gm.gameResume();
    }
}
