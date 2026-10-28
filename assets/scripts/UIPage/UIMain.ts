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
import { rankConfig } from '../json/jsonRank';
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

    @property({ tooltip: '主页角色向左移动的范围' })
    roleMoveLeftRange = 250;

    @property({ tooltip: '主页角色向右移动的范围' })
    roleMoveRightRange = 200;

    @property({ tooltip: '主页角色移动速度（每秒本地坐标单位）' })
    roleMoveSpeed = 60;

    private roleOrigin = new Vec3();
    private roleSkeleton: sp.Skeleton = null;
    private isRoleWalking = false;
    private isRoleResting = false;
    private roleStateRemaining = 0;
    private roleMoveDirection = -1;
    private currentRoleAnimation = '';

    /**是否展示过复访按钮 */
    isShowRevisit = false;
    /**是否已经点击开始并等待打开匹配界面 */
    private isOpeningMatch = false;
    /**开始按钮组件 */
    private startBtnComp: zoomButton = null;

    onLoad() {
        this.bindBtn();
        if (this.roleNode) this.roleOrigin.set(this.roleNode.position);
    }

    onUI_Open(data?: any): void {
        this.resetStartButton();
        this.addListener();
        this.initData();
    }

    onUI_Close(data?: any): void {
        this.resetStartButton();
        this.stopRoleWalking();
        this.unscheduleAllCallbacks();
        this.removeListener();
    }

    /**初始化数据 */
    initData() {
        this.refreshRed();
        this.refreshRank();
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
        gm.Event.on(GameEvent.refreshRank, this.refreshRank, this);
    }

    /**删除监听 */
    removeListener() {
        // 监听刷新红点事件
        gm.Event.off(GameEvent.refreshRed, this.refreshRed, this);
        gm.Event.off(GameEvent.refreshRoleSkin, this.refreshRoleAnim, this);
        gm.Event.off(GameEvent.refreshMapSelection, this.refreshMapSelection, this);
        gm.Event.off(GameEvent.refreshShowContent, this.refreshShowContent, this);
        gm.Event.off(GameEvent.refreshRank, this.refreshRank, this);
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

    /**显示当前段位名称、段内积分及晋升进度。 */
    private refreshRank() {
        const targetScore = rankConfig.getRankData(pData.rank)?.rankScore ?? 0;
        if (this.rankNameLab) this.rankNameLab.string = rankConfig.getRankName(pData.rank);
        if (this.rankLab) this.rankLab.string = pData.rankScore + '/' + targetScore;
        if (this.rankBar) {
            this.rankBar.fillRange = targetScore > 0
                ? Math.max(0, Math.min(1, pData.rankScore / targetScore)) : 0;
        }
    }

    /**从场景中的初始位置开始左右往返移动。 */
    private refreshRoleAnim() {
        this.stopRoleWalking();
        if (!this.roleNode?.isValid) return;
        this.roleSkeleton = this.roleNode.getChildByName('roleAnim')?.getComponent(sp.Skeleton)
            ?? this.roleNode.getComponent(sp.Skeleton);
        this.roleNode.setPosition(this.roleOrigin);
        this.roleMoveDirection = -1;
        this.isRoleResting = false;
        this.roleStateRemaining = 5 + Math.random() * 5;
        this.isRoleWalking = true;
        this.updateRoleFacing();
        this.playRoleAnimation(roleAnimName.move);
    }

    protected update(dt: number): void {
        if (!this.isRoleWalking || !this.roleNode?.isValid) return;
        let remaining = Math.max(0, dt);
        while (remaining > 0) {
            const step = Math.min(remaining, this.roleStateRemaining);
            if (!this.isRoleResting) this.moveRole(step);
            remaining -= step;
            this.roleStateRemaining -= step;
            if (this.roleStateRemaining <= 0) {
                this.isRoleResting = !this.isRoleResting;
                this.roleStateRemaining = this.isRoleResting ? 2 : 5 + Math.random() * 5;
                this.playRoleAnimation(this.isRoleResting ? roleAnimName.idle : roleAnimName.move);
            }
        }
    }

    private moveRole(dt: number) {
        const minX = this.roleOrigin.x - Math.max(0, this.roleMoveLeftRange);
        const maxX = this.roleOrigin.x + Math.max(0, this.roleMoveRightRange);
        if (maxX <= minX) return;
        let x = this.roleNode.position.x + this.roleMoveDirection * Math.max(0, this.roleMoveSpeed) * dt;
        // 保留越过边界的移动距离，低帧率时也能连续往返。
        while (x > maxX || x < minX) {
            if (x > maxX) {
                x = maxX - (x - maxX);
                this.roleMoveDirection = -1;
            } else {
                x = minX + (minX - x);
                this.roleMoveDirection = 1;
            }
        }
        this.roleNode.setPosition(x, this.roleOrigin.y, this.roleOrigin.z);
        this.updateRoleFacing();
    }

    private updateRoleFacing() {
        // 角色原始朝向为左；翻转整个展示节点，使武器和装备一起转向。
        const scale = this.roleNode.scale;
        this.roleNode.setScale(-this.roleMoveDirection * Math.abs(scale.x), scale.y, scale.z);
    }

    private playRoleAnimation(animation: roleAnimName) {
        if (!this.roleSkeleton?.skeletonData || this.currentRoleAnimation === animation) return;
        if (!this.roleSkeleton.findAnimation(animation)) return;
        this.roleSkeleton.setAnimation(0, animation, true);
        this.currentRoleAnimation = animation;
    }

    private stopRoleWalking() {
        this.isRoleWalking = false;
        this.playRoleAnimation(roleAnimName.idle);
        this.currentRoleAnimation = '';
    }

    protected onDisable(): void {
        this.stopRoleWalking();
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

        // uiMgr.startGame();
        // return;
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


