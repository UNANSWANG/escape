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
    addGameMonetaryBtn: Node;

    @property(Node)
    addGameMonetaryBtn2: Node;

    @property(Node)
    fullSkinBtn: Node;

    @property(Node)
    addPlayerMonetaryBtn: Node;

    @property(Toggle)
    onlyAttackSelfToggle: Toggle;

    @property(Toggle)
    adToggle: Toggle;

    @property(Toggle)
    bossToggle: Toggle;

    @property(Toggle)
    forceGuideToggle: Toggle;

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
        this.addGameMonetaryBtn.addComponent(zoomButton).onClick = this.clickAddGameMonetaryBtn.bind(this);
        this.fullSkinBtn.addComponent(zoomButton).onClick = this.clickFullSkinBtn.bind(this);
        this.addPlayerMonetaryBtn.addComponent(zoomButton).onClick = this.clickAddPlayerMonetaryBtn.bind(this);
        this.addGameMonetaryBtn2.addComponent(zoomButton).onClick = this.clickAddGameMonetary2Btn.bind(this);
        this.onlyAttackSelfToggle.node.on(Toggle.EventType.TOGGLE, this.clickOnlyAttackSelfToggle, this);
        this.adToggle.node.on(Toggle.EventType.TOGGLE, this.clickAdToggle, this);
        this.bossToggle.node.on(Toggle.EventType.TOGGLE, this.clickBossToggle, this);
        this.forceGuideToggle.node.on(Toggle.EventType.TOGGLE, this.clickForceGuideToggle, this);
    }

    /**刷新只攻击玩家自身开关 */
    refreshToggle() {
        this.onlyAttackSelfToggle.isChecked = gmConfig.onlyAttackSelf;
        this.adToggle.isChecked = gmConfig.isFreeAd;
        this.bossToggle.isChecked = gmConfig.isBossInvincible;
        this.forceGuideToggle.isChecked = gmConfig.forceGuide;
    }

    ///
    ///点击事件
    ///
    /**点击增加货币 */
    clickAddGameMonetaryBtn() {
        gm.Event.emit(GameEvent.addGameMonetary, 100);
    }

    /**点击增加货币2 */
    clickAddGameMonetary2Btn() {
        gm.Event.emit(GameEvent.addGameMonetary);
    }

    /**点击全皮肤 */
    clickFullSkinBtn() {
        gm.Event.emit(GameEvent.fullSkin);
    }

    /**点击增加玩家货币 */
    clickAddPlayerMonetaryBtn() {
        pData.fixMoney(100000);
    }

    /**点击只攻击玩家自身开关 */
    clickOnlyAttackSelfToggle() {
        gmConfig.onlyAttackSelf = this.onlyAttackSelfToggle?.isChecked;
        ccStorageTools.setData(SaveKey.onlyAttackSelf, gmConfig.onlyAttackSelf ? 1 : 0);
    }

    /**点击广告开关 */
    clickAdToggle() {
        gmConfig.isFreeAd = this.adToggle?.isChecked;
        ccStorageTools.setData(SaveKey.isFreeAd, gmConfig.isFreeAd ? 1 : 0);
    }

    /**点击boss无敌开关 */
    clickBossToggle() {
        gmConfig.isBossInvincible = this.bossToggle?.isChecked;
    }

    /**点击强制引导开关 */
    clickForceGuideToggle() {
        gmConfig.forceGuide = this.forceGuideToggle?.isChecked;
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIConsole);
    }
}


