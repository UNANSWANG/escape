import { _decorator, Component, Node, Animation, Toggle, UITransform, Vec3, Widget, Label, Slider, Sprite } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { audioMgr } from '../manager/audioManager';
import { gm } from '../manager/gm';
import { GameEvent } from '../manager/configData';
import { pData } from '../manager/playerData';
import { userMgr } from '../manager/userManager';
const { ccclass, property } = _decorator;
const SliderEventSlide = 'slide';

@ccclass('UISetting')
export class UISetting extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    homeBtn: Node;

    @property(Node)
    continueBtn: Node;

    @property(Node)
    consoleBtn: Node;

    @property(Node)
    bg: Node;

    @property(Node)
    toggleList: Node;

    @property(Label)
    uidLab: Label;

    @property(Slider)
    musicSlider: Slider;

    @property(Sprite)
    musicProgress: Sprite;

    @property(Node)
    musicCloseFlag: Node;
    
    @property(Slider)
    effctSlider: Slider;
    
    @property(Sprite)
    effectProgress: Sprite;

    @property(Node)
    effectCloseFlag: Node;

    @property(Toggle)
    vibratToggle: Toggle;

    /**模式：0：普通模式 1：关卡模式（重新开始和返回主页） */
    mode = 0;
    /**控制台连点次数 */
    consoleClickCount = 0;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(data) {
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData(data);
    }

    initData(data) {
        if (data && data.mode) {
            this.mode = data.mode;
        } else {
            this.mode = 0;
        }

        this.uidLab.string = `uid:${userMgr.params.uid}`

        this.refreshState();
        this.refreshUI();
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.homeBtn.addComponent(zoomButton).onClick = this.clickHomeBtn.bind(this);
        this.continueBtn.addComponent(zoomButton).onClick = this.clickContinueBtn.bind(this);
        this.consoleBtn.addComponent(zoomButton).onClick = this.clickConsoleBtn.bind(this);
        this.vibratToggle.node.on(Toggle.EventType.TOGGLE, this.clickVibratBtn, this);
        this.musicSlider.node.on(SliderEventSlide, this.changeMusicVolume, this);
        this.effctSlider.node.on(SliderEventSlide, this.changeEffectVolume, this);
    }

    /**刷新界面 */
    refreshUI() {
        let bgTrans = this.bg.getComponent(UITransform);
        if (this.mode == 1) {
            bgTrans.height = 775;
            this.homeBtn.active = true;
            this.continueBtn.active = true;
        } else {
            bgTrans.height = 635;
            this.homeBtn.active = false;
            this.continueBtn.active = false;
        }

        this.bg.getChildByName("topNode").getComponent(Widget).updateAlignment();
    }

    /**刷新按钮状态 */
    refreshState() {
        this.vibratToggle.isChecked = audioMgr.isVibrat;
        this.musicSlider.progress = audioMgr.musicVolume;
        this.effctSlider.progress = audioMgr.effectVolume;
        this.musicProgress.fillRange = this.musicSlider.progress;
        this.effectProgress.fillRange = this.effctSlider.progress;
        this.musicCloseFlag.active = this.musicSlider.progress == 0;
        this.effectCloseFlag.active = this.effctSlider.progress == 0;
    }

    ///
    ///点击事件
    ///

    /**点击振动开关 */
    clickVibratBtn() {
        audioMgr.switchVibrat(!audioMgr.isVibrat);
    }

    /**调整背景音乐音量 */
    changeMusicVolume() {
        audioMgr.setMusicVolume(this.musicSlider.progress);
        this.musicProgress.fillRange = this.musicSlider.progress;
        this.musicCloseFlag.active = this.musicSlider.progress == 0;
    }

    /**调整音效音量 */
    changeEffectVolume() {
        audioMgr.setEffectVolume(this.effctSlider.progress);
        this.effectProgress.fillRange = this.effctSlider.progress;
        this.effectCloseFlag.active = this.effctSlider.progress == 0;
    }

    /**点击主页 */
    clickHomeBtn() {
        this.onClose();
        //上报失败
        pData.reportLevel(false);
        pData.SDKReportLevelExit();
        uiMgr.closeGame();
    }

    /**点击重新开始 */
    clickRestartBtn() {
        this.onClose();
        gm.Event.emit(GameEvent.refreshGameLevel);
    }

    /**点击控制台 */
    clickConsoleBtn() {
        if(!gm.isDebug){
            return;
        }
        this.consoleClickCount++;
        if (this.consoleClickCount >= 5) {
            this.consoleClickCount = 0;
            uiMgr.openPage(UIPath.UIConsole);
        }
    }

    /**点击继续游戏 */
    clickContinueBtn() {
        this.onClose();
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        this.consoleClickCount = 0;
        uiMgr.closePage(UIPath.UISetting);
        if (this.mode == 1) {
            gm.gameResume();
        }
    }
}


