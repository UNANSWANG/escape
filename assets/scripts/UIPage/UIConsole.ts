import { _decorator, Component, Node, Animation, Toggle } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { gm } from '../manager/gm';
import { GameEvent, gmConfig, SaveKey } from '../manager/configData';
import { pData } from '../manager/playerData';
import { ccStorageTools } from '../extention/storageTools';
import { videoMgr } from '../manager/videoManager';
const { ccclass, property } = _decorator;


@ccclass('UIConsole')
export class UIConsole extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    fullSkinBtn: Node;

    @property(Node)
    addPlayerMonetaryBtn: Node;

    @property(Toggle)
    adToggle: Toggle;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData();
    }

    initData() {
        this.refreshToggle();
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.fullSkinBtn.addComponent(zoomButton).onClick = this.clickFullSkinBtn.bind(this);
        this.addPlayerMonetaryBtn.addComponent(zoomButton).onClick = this.clickAddPlayerMonetaryBtn.bind(this);
        this.adToggle.node.on(Toggle.EventType.TOGGLE, this.clickAdToggle, this);
    }

    /**刷新只攻击玩家自身开关 */
    refreshToggle() {
        this.adToggle.isChecked = gmConfig.isFreeAd;
    }

    ///
    ///点击事件
    ///

    /**点击全皮肤 */
    clickFullSkinBtn() {
        gm.Event.emit(GameEvent.fullSkin);
    }

    /**点击增加玩家货币 */
    clickAddPlayerMonetaryBtn() {
        pData.fixMoney(100000);
    }

    /**点击广告开关 */
    clickAdToggle() {
        gmConfig.isFreeAd = this.adToggle?.isChecked;
        ccStorageTools.setData(SaveKey.isFreeAd, gmConfig.isFreeAd ? 1 : 0);
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIConsole);
    }
}


