import { _decorator, Button, Component, EventKeyboard, input, Input, KeyCode, Label, Node, NodeEventType, sp, tween, Tween, Vec3 } from 'cc';
import { gamePath, spinePath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { UIBase } from './UIBase';
import { zoomButton } from '../extention/zoomButton';
import { pData } from '../manager/playerData';
import { configData, GameEvent, SaveKey } from '../manager/configData';
import { gm, PlatType } from '../manager/gm';
import { ccStorageTools } from '../extention/storageTools';
import { TTManager } from '../sdk/plat/tt/TTManager';
import { loopAnimation } from '../controller/loopAnimation';
import { userMgr } from '../manager/userManager';
import { WXManager } from '../sdk/plat/wx/WXManager';
import { ccTools } from '../extention/generalTools';
import { roleAnimName } from '../controller/roleController';
const { ccclass, property } = _decorator;

@ccclass('UIMain')
export class UIMain extends UIBase {
    @property(Node)
    startBtn: Node = null;

    @property(Node)
    setBtn: Node = null;

    @property(Node)
    rankBtn: Node = null;

    @property(Node)
    revisitBtn: Node = null;

    @property(sp.Skeleton)
    roleAnim: sp.Skeleton = null;

    /**是否展示过复访按钮 */
    isShowRevisit = false;
    /**是否已经点击开始并等待打开匹配界面 */
    private isOpeningMatch = false;
    /**开始按钮组件 */
    private startBtnComp: zoomButton = null;

    onLoad() {
        this.bindBtn();
    }

    onUI_Open(data?: any): void {
        this.resetStartButton();
        this.addListener();
        this.initData();
    }

    onUI_Close(data?: any): void {
        this.resetStartButton();
        this.unscheduleAllCallbacks();
        this.removeListener();
    }

    /**初始化数据 */
    initData() {
        this.refreshRed();
        this.checkRevisitBtn();
        this.refreshRoleAnim();
        gm.Event.emit(GameEvent.refreshPlayerMonetary);
    }

    bindBtn() {
        this.startBtnComp = this.startBtn.addComponent(zoomButton);
        this.startBtnComp.onClick = this.cliskStartBtn.bind(this);
        this.setBtn.addComponent(zoomButton).onClick = this.cliskSetBtn.bind(this);
        this.rankBtn.addComponent(zoomButton).onClick = this.clickRankBtn.bind(this);
        this.revisitBtn.addComponent(zoomButton).onClick = this.clickRevisitBtn.bind(this);
    }

    /**添加监听 */
    addListener() {
        // 监听刷新红点事件
        gm.Event.on(GameEvent.refreshRed, this.refreshRed, this);
        gm.Event.on(GameEvent.refreshRoleSkin, this.refreshRoleAnim, this);
    }

    /**删除监听 */
    removeListener() {
        // 监听刷新红点事件
        gm.Event.off(GameEvent.refreshRed, this.refreshRed, this);
        gm.Event.off(GameEvent.refreshRoleSkin, this.refreshRoleAnim, this);
    }

    /**刷新主页角色皮肤并循环播放待机动画 */
    private async refreshRoleAnim() {
        if (!this.roleAnim) {
            return;
        }

        this.roleAnim.skeletonData = null;
        let isLoaded = await ccTools.loadSpine(this.roleAnim, spinePath.role + pData.skinId);
        if (!isLoaded || !this.roleAnim || !this.roleAnim.isValid) {
            return;
        }

        this.roleAnim.setAnimation(0, roleAnimName.idle, true);
    }

    /**刷新红点 */
    refreshRed() {

    }

    /**检测复访按钮 */
    checkRevisitBtn() {
        this.revisitBtn.active = gm.platType == PlatType.tt;
        //抖音平台
        if (gm.platType == PlatType.tt && !this.isShowRevisit) {
            let isGetted = ccStorageTools.getLimitTimeData(SaveKey.isGetRevisit) == 1;
            let TTMgr = gm.API as TTManager;
            let canGet = TTMgr.checkCanGetGift();
            if (canGet && !isGetted) {
                this.isShowRevisit = true;
                this.clickRevisitBtn();
            }
        }
    }

    ///
    ///点击事件
    ///

    /**开始游戏 */
    cliskStartBtn() {
        if (this.isOpeningMatch) {
            return;
        }

        this.isOpeningMatch = true;
        this.startBtnComp.interactable = false;

        uiMgr.startGame();
        // if (!this.node.activeInHierarchy) {
        //     this.resetStartButton();
        //     return;
        // }

        // try {
        //     uiMgr.openPage(UIPath.UIMatch);
        // } catch (error) {
        //     console.error("打开匹配界面失败", error);
        //     this.resetStartButton();
        // }
    }

    /**回到主页或打开匹配页失败时恢复开始按钮 */
    private resetStartButton() {
        this.isOpeningMatch = false;
        if (this.startBtnComp) {
            this.startBtnComp.interactable = true;
        }
    }

    /**点击设置 */
    cliskSetBtn() {
        uiMgr.openPage(UIPath.UISetting, { mode: 0 });
    }

    /**点击复访 */
    clickRevisitBtn() {
        uiMgr.openPage(UIPath.UIRevisit);
    }

    /**点击排行榜 */
    clickRankBtn() {
        //有昵称和授权或者h5平台才直接打开排行榜
        if ((gm.API.isAuthorize && userMgr.nickName) || gm.platType == PlatType.h5) {
            uiMgr.openPage(UIPath.UIRank);
        } else {
            let getUserInfo = () => {
                let wxMgr = gm.API as WXManager;
                wxMgr.getUserProfile(() => {
                    uiMgr.openPage(UIPath.UIRank);
                }, () => {
                    uiMgr.openPage(UIPath.UIRank);
                });
            }

            if (!gm.API.isAuthorize) {
                //没有授权
                gm.API.requirePrivacyAuthorize(() => {
                    console.log("授权成功");
                    if (!userMgr.nickName) {
                        getUserInfo();
                    } else {
                        uiMgr.openPage(UIPath.UIRank);
                    }
                }, () => {
                    console.log("授权失败");
                    uiMgr.openPage(UIPath.UIRank);
                });
            } else {
                //有授权但是没有昵称
                getUserInfo();
            }
        }
    }
}


