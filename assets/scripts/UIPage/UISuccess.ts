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
    adBtn: Node;

    @property(Node)
    commonBtn: Node;

    @property(Node)
    moneyRewardNode: Node;

    @property(Node)
    boxRewardNode: Node;

    @property(Node)
    boxNode: Node;

    @property(sp.Skeleton)
    roleSk: sp.Skeleton;

    @property(Label)
    timeLab: Label;

    @property(Node)
    title: Node;

    @property(Node)
    titleLogo: Node;

    /**奖励污染币数量 */
    moneyNum = 0;
    /**奖励魔盒数量 */
    boxNum = 0;
    /**本次胜利奖励是否已领取或正在领取 */
    private isRewardClaimed = false;
    /**广告按钮循环动画 */
    private adBtnAnimation: loopAnimation = null;

    protected onLoad(): void {
        this.initAdBtnAnimation();
        this.bindBtn();
    }

    onUI_Open(data?) {
        gm.gamePause();
        audioMgr.playEffect(audioPath.success);
        this.playOpenAnim();
        this.initData(data);
        this.adBtnAnimation.playAni();
    }

    /**播放标题开屏缩放动画 */
    private playOpenAnim() {
        let titleNodes = [this.title, this.titleLogo];
        for (let i = 0; i < titleNodes.length; i++) {
            let titleNode = titleNodes[i];
            if (!titleNode || !titleNode.isValid) {
                continue;
            }

            Tween.stopAllByTarget(titleNode);
            titleNode.setScale(new Vec3(2, 2, 1));
            tween(titleNode)
                .to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                .start();
        }
    }

    /**初始化广告按钮循环放缩动画 */
    private initAdBtnAnimation() {
        this.adBtnAnimation = this.adBtn.getComponent(loopAnimation) || this.adBtn.addComponent(loopAnimation);
        this.adBtnAnimation.startPlay = false;
        this.adBtnAnimation.animType = loop_anim.scaling;
        this.adBtnAnimation.scaleOffset = 0.08;
    }

    initData(data?) {
        let skinId = Number.isInteger(data?.skinId) && data.skinId >= 0 ? data.skinId : pData.skinId;
        this.refreshRoleSpine(skinId);

        if(pData.isGuide){
            ccStorageTools.setData(SaveKey.guide, 1);
        }

        let survivalTime = Math.max(0, Number(data?.survivalTime) || 0);
        this.initRewardNum(survivalTime);
        this.timeLab.string = `存活时间：${Math.floor(survivalTime)}s`;
        this.isRewardClaimed = false;
        this.refreshRewardNum();
        this.refreshBoxNum();

        this.boxRewardNode.active = this.boxNum > 0;

        pData.SDKReportLevelComplete();
        this.SDKAdReport();
        pData.addLevel();
    }

    /**根据存活时间初始化胜利基础奖励 */
    private initRewardNum(survivalTime: number) {
        this.moneyNum = Math.floor(50 + 20 * survivalTime / 60);
        this.boxNum = ccTools.getRandomNum(1, 3);
    }

    /**加载胜利角色并循环播放待机动画 */
    private async refreshRoleSpine(skinId: number) {
        if (!this.roleSk) {
            return;
        }

        this.roleSk.skeletonData = null;
        let isLoaded = await ccTools.loadSpine(this.roleSk, spinePath.role + skinId);
        if (!isLoaded) {
            return;
        }

        this.roleSk.setAnimation(0, roleAnimName.idle, true);
    }

    bindBtn() {
        this.adBtn.addComponent(zoomButton).onClick = this.clickAdBtn.bind(this);
        this.commonBtn.addComponent(zoomButton).onClick = this.clickCommonBtn.bind(this);
    }

    /**广告点上报 */
    SDKAdReport() {
        videoMgr.SDKAdShow(4);
    }

    ///
    ///点击事件
    ///

    /**点击广告按钮 */
    clickAdBtn() {
        if (this.isRewardClaimed) {
            return;
        }

        this.isRewardClaimed = true;
        videoMgr.watchVideo(4, () => {
            this.getReward(3);
        }, () => {
            this.isRewardClaimed = false;
        });
    }

    /**点击普通按钮 */
    clickCommonBtn() {
        if (this.isRewardClaimed) {
            return;
        }

        this.isRewardClaimed = true;
        this.getReward(1);
    }

    /**刷新基础奖励数量 */
    private refreshRewardNum() {
        let moneyLab = this.moneyRewardNode?.getChildByName("numLab")?.getComponent(Label);
        let boxLab = this.boxRewardNode?.getChildByName("numLab")?.getComponent(Label);
        if (moneyLab) {
            moneyLab.string = `X ${this.moneyNum}`;
        }
        if (boxLab) {
            boxLab.string = `X ${this.boxNum}`;
        }
    }

    /**刷新当前魔盒数量 */
    private refreshBoxNum() {
        let boxLab = this.boxNode?.getChildByName("numLab")?.getComponent(Label);
        if (boxLab) {
        }
    }

    /**领取胜利奖励 */
    private getReward(multiplier: number) {
        let rewardMoney = this.moneyNum * multiplier;
        let rewardBox = this.boxNum * multiplier;
        let moneyImg = this.moneyRewardNode?.getChildByName("img") || this.moneyRewardNode;
        let boxImg = this.boxRewardNode?.getChildByName("img") || this.boxRewardNode;
        let boxTarget = this.boxNode?.getChildByName("img") || this.boxNode;

        uiMgr.playMoneyAnim(moneyImg, rewardMoney, () => {
            this.scheduleOnce(() => {
                uiMgr.closeGame();
                this.onClose();
            }, 1);
        });
        uiMgr.playRewardAnim(boxImg, boxTarget, rewardBox, () => {
            this.refreshBoxNum();
        });
    }

    onClose() {
        this.adBtnAnimation.unscheduleAllCallbacks();
        this.adBtnAnimation.stopAni();
        gm.gameResume();
        uiMgr.closePage(UIPath.UISuccess);
    }
}
