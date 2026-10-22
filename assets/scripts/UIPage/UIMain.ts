import { _decorator, Button, Component, EventKeyboard, input, Input, KeyCode, Label, Node, NodeEventType, sp, Sprite, tween, Tween, Vec3 } from 'cc';
import { gamePath, imgPath, spinePath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { UIBase } from './UIBase';
import { zoomButton } from '../extention/zoomButton';
import { pData } from '../manager/playerData';
import { configData, difficultyNames, GameEvent, SaveKey } from '../manager/configData';
import { gm, PlatType } from '../manager/gm';
import { ccStorageTools } from '../extention/storageTools';
import { TTManager } from '../sdk/plat/tt/TTManager';
import { userMgr } from '../manager/userManager';
import { WXManager } from '../sdk/plat/wx/WXManager';
import { ccTools } from '../extention/generalTools';
import { roleAnimName } from '../controller/role/roleController';
import { mapConfig } from '../json/jsonMap';
import { itemConfig } from '../json/jsonItem';
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

    @property(Node)
    handbookBtn: Node = null;

    @property(Node)
    signBtn: Node = null;

    @property(Node)
    storeBtn: Node = null;

    @property(Node)
    storehouseBtn: Node = null;

    @property(Node)
    roleBtn: Node = null;

    @property(Node)
    roomBtn: Node = null;

    @property(Node)
    mapBtn: Node = null;

    @property(Node)
    roleNode: Node = null;

    @property(Node)
    showContent: Node = null;

    @property(Label)
    rankNameLab: Label = null;

    @property(Label)
    rankLab: Label = null;

    @property(Sprite)
    rankBar: Sprite = null;

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
        this.refreshMapSelection();
        this.refreshShowContent();
        gm.Event.emit(GameEvent.refreshPlayerMonetary);
    }

    bindBtn() {
        this.startBtnComp = this.startBtn.addComponent(zoomButton);
        this.startBtnComp.onClick = this.cliskStartBtn.bind(this);
        this.setBtn.addComponent(zoomButton).onClick = this.cliskSetBtn.bind(this);
        this.rankBtn.addComponent(zoomButton).onClick = this.clickRankBtn.bind(this);
        this.revisitBtn.addComponent(zoomButton).onClick = this.clickRevisitBtn.bind(this);
        this.handbookBtn.addComponent(zoomButton).onClick = this.clickHandbookBtn.bind(this);
        this.signBtn.addComponent(zoomButton).onClick = this.clickSignBtn.bind(this);
        this.storeBtn.addComponent(zoomButton).onClick = this.clickStoreBtn.bind(this);
        this.storehouseBtn.addComponent(zoomButton).onClick = this.clickStorehouseBtn.bind(this);
        this.roleBtn.addComponent(zoomButton).onClick = this.clickRoleBtn.bind(this);
        this.roomBtn.addComponent(zoomButton).onClick = this.clickRoomBtn.bind(this);
        this.mapBtn.addComponent(zoomButton).onClick = this.clickMapBtn.bind(this);
        this.showContent?.children.forEach((showNode, slotIndex) => {
            const button = showNode.getComponent(zoomButton) || showNode.addComponent(zoomButton);
            button.onClick = this.clickShowItem.bind(this, slotIndex);
        });
    }

    private refreshShowContent() {
        this.showContent?.children.forEach((showNode, slotIndex) => {
            const itemId = pData.getShowItem(slotIndex);
            const itemData = itemId !== null ? itemConfig.getDataByItemId(itemId) : null;
            const background = showNode.getChildByName('bg');
            background?.children.forEach((stateNode) => {
                stateNode.active = stateNode.name === (itemData ? 'show' : 'normal');
            });
            const setLab = showNode.getChildByName('setLab');
            if (setLab) {
                setLab.active = !itemData;
            }
            const image = showNode.getChildByName('img');
            if (image) {
                image.active = !!itemData;
                const sprite = image.getComponent(Sprite);
                if (sprite) {
                    ccTools.cancelAssetLoad(sprite);
                    sprite.spriteFrame = null;
                    if (itemData) {
                        ccTools.loadImg(sprite, imgPath.item + itemId);
                    }
                }
            }
            const nameLab = showNode.getChildByName('nameLab')?.getComponent(Label);
            if (nameLab) {
                nameLab.string = itemData?.name ?? '';
            }
        });
    }

    /**添加监听 */
    addListener() {
        // 监听刷新红点事件
        gm.Event.on(GameEvent.refreshRed, this.refreshRed, this);
        gm.Event.on(GameEvent.refreshRoleSkin, this.refreshRoleAnim, this);
        gm.Event.on(GameEvent.refreshMapSelection, this.refreshMapSelection, this);
        gm.Event.on(GameEvent.refreshShowContent, this.refreshShowContent, this);
    }

    /**删除监听 */
    removeListener() {
        // 监听刷新红点事件
        gm.Event.off(GameEvent.refreshRed, this.refreshRed, this);
        gm.Event.off(GameEvent.refreshRoleSkin, this.refreshRoleAnim, this);
        gm.Event.off(GameEvent.refreshMapSelection, this.refreshMapSelection, this);
        gm.Event.off(GameEvent.refreshShowContent, this.refreshShowContent, this);
    }

    /**按本次运行的确认状态刷新地图按钮；未确认时显示默认文本 */
    private refreshMapSelection() {
        const [mapIdx, difficultyType] = pData.selectMapData;
        const mapData = pData.hasConfirmedMapSelection
            ? mapConfig.getMapData(mapIdx, difficultyType)
            : null;
        const mapNameLab = this.mapBtn.getChildByName('mapNameLab')?.getComponent(Label);
        const difficultyLab = this.mapBtn.getChildByName('difficultyLab')?.getComponent(Label);
        if (mapNameLab) {
            mapNameLab.string = mapData?.name ?? '请选择地图';
        }
        if (difficultyLab) {
            difficultyLab.string = mapData ? (difficultyNames[difficultyType] ?? '') : '';
        }
    }

    /**刷新主页角色皮肤并循环播放待机动画 */
    private async refreshRoleAnim() {
        
    }

    /**刷新红点 */
    refreshRed() {
        const red = this.handbookBtn?.getChildByName("red");
        if (red) {
            red.active = pData.hasClaimableCollectionReward();
        }
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

        const [mapIdx, difficultyType] = pData.selectMapData;
        const mapData = mapConfig.getMapData(mapIdx, difficultyType);
        if (!pData.hasConfirmedMapSelection || !mapData) {
            this.clickMapBtn();
            return;
        }

        this.isOpeningMatch = true;
        this.startBtnComp.interactable = false;

        uiMgr.startGame();
        return;
        uiMgr.openPage(UIPath.UIMatch, mapData.gameNumber).then(() => {
            uiMgr.closePage(UIPath.UIMain);
        }).catch((error) => {
            this.resetStartButton();
            console.error('打开匹配界面失败', error);
        });
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
        return;
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

    /**点击图鉴 */
    clickHandbookBtn() {
        uiMgr.openPage(UIPath.UIHandBook);
    }

    /**点击签到 */
    clickSignBtn() {
        uiMgr.openPage(UIPath.UISign);
    }

    /**点击商店 */
    clickStoreBtn() {
        uiMgr.openPage(UIPath.UIStore);
    }

    /**点击仓库 */
    clickStorehouseBtn() {
        uiMgr.openPage(UIPath.UIStorehouse);
    }

    /**点击角色 */
    clickRoleBtn() {
        uiMgr.openPage(UIPath.UIRoleStore);
    }

    /**点击收藏室 */
    clickRoomBtn() {
        uiMgr.showTips("打开收藏室");
    }

    /**点击地图 */
    clickMapBtn() {
        uiMgr.openPage(UIPath.UIMap);
    }

    clickShowItem(slotIndex: number) {
        uiMgr.openPage(UIPath.UIShowItem, slotIndex);
    }
}


