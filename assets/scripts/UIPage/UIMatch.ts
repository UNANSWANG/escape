import { _decorator, Node, Animation, Label, Prefab, instantiate, UITransform, tween, Tween } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { configData } from '../manager/configData';
import { ccTools } from '../extention/generalTools';
import { pData } from '../manager/playerData';
import { playerMgr } from '../manager/playerManager';
import { roleShowController } from '../controller/role/roleShowController';
const { ccclass, property } = _decorator;

@ccclass('UIMatch')
export class UIMatch extends UIBase {
    @property(Node)
    cancelBtn: Node;

    @property(Label)
    timeLab: Label;

    @property(Label)
    titleLab: Label;

    @property(Node)
    contentLayout: Node;

    @property(Prefab)
    itemPre: Prefab;

    private matchTime = 0;
    private isMatching = false;
    private currentMatchIndex = 0;
    private matchItems: Node[] = [];
    private gamePreload: Promise<void> = null;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(count: number = 4) {
        this.initData(count);
    }

    initData(count: number) {
        this.unscheduleAllCallbacks();
        this.clearItems();
        this.matchTime = 0;
        this.currentMatchIndex = 0;
        this.isMatching = true;
        this.titleLab.string = '匹配中...';
        this.refreshTimeLab();
        const [mapIdx, difficultyType] = pData.selectMapData;
        let itemCount: number;
        try {
            itemCount = playerMgr.prepareMatch(mapIdx, difficultyType, count);
        } catch (error) {
            this.isMatching = false;
            this.titleLab.string = '未找到可用的 AI 配置';
            console.warn(error);
            return;
        }
        this.gamePreload = uiMgr.preLoadMatch(mapIdx, playerMgr.matchedAIRoles);
        // 提前启动但由匹配完成逻辑处理失败，避免产生未处理的拒绝。
        this.gamePreload.catch(error => console.warn('本局资源预加载失败', error));
        for (let index = 0; index < itemCount; index++) {
            const item = instantiate(this.itemPre);
            this.contentLayout.addChild(item);
            this.setItemVisible(item, false);
            this.matchItems.push(item);
        }

        ccTools.shuffleArray(this.matchItems);
        this.showMatchItem(this.matchItems[0], '你', true);
        this.currentMatchIndex = 1;
        this.scheduleNextMatch();
    }

    private setItemVisible(item: Node, visible: boolean) {
        const mask = item.getChildByName('mask');
        if (mask) {
            mask.active = !visible;
        }
        for (const nodeName of ['light', 'roleContent', 'nameLab']) {
            const content = item.getChildByName(nodeName);
            if (content) {
                content.active = visible;
            }
        }
    }

    showMatchItem(item: Node, nickname: string, isPlayerData = false) {
        this.setItemVisible(item, true);
        this.addRoleShow(item, isPlayerData).catch(error => {
            console.warn('匹配角色展示加载失败', error);
        });
        const lightTransform = item.getChildByName('light')?.getComponent(UITransform);
        if (lightTransform) {
            Tween.stopAllByTarget(lightTransform);
            lightTransform.width = 130;
            tween(lightTransform).to(0.1, { width: 166 }).start();
        }
        const nameLab = item.getChildByName('nameLab')?.getComponent(Label);
        if (nameLab) {
            nameLab.string = nickname;
        }
    }

    private async addRoleShow(item: Node, isPlayerData: boolean) {
        await uiMgr.preLoadRoleShow();
        // 加载期间可能已关闭界面或重新匹配，仅为当前列表中的条目添加角色。
        if (!item?.isValid || !this.matchItems.includes(item) || !uiMgr.roleShowPrefab) {
            return;
        }
        const roleContent = item.getChildByName('roleContent');
        if (!roleContent || roleContent.children.length > 0) {
            return;
        }
        const roleNode = instantiate(uiMgr.roleShowPrefab);
        const roleShow = roleNode.getComponent(roleShowController);
        roleShow?.setIsPlayerData(isPlayerData);
        if (!isPlayerData) {
            const aiIndex = this.matchItems.indexOf(item) - 1;
            const agentData = playerMgr.matchedAIRoles[aiIndex];
            roleShow?.setRoleId(agentData?.roleId ?? 0);
            roleShow?.setWeaponId(agentData?.weaponId ?? -1);
            roleShow?.setEquipmentIds(agentData?.helmetId ?? -1, agentData?.armorId ?? -1);
        }
        roleContent.addChild(roleNode);
    }

    private scheduleNextMatch() {
        if (this.currentMatchIndex >= this.matchItems.length) {
            this.isMatching = false;
            this.titleLab.string = '匹配成功';
            const matchItems = this.matchItems;
            this.scheduleOnce(async () => {
                try {
                    await this.gamePreload;
                    if (!this.node.activeInHierarchy || this.matchItems !== matchItems) return;
                    uiMgr.startGame();
                    this.onClose();
                } catch (error) {
                    if (this.node.activeInHierarchy && this.matchItems === matchItems) {
                        this.titleLab.string = '游戏资源加载失败，请重新匹配';
                        console.error('开始游戏前预加载失败', error);
                    }
                }
            }, 1);
            return;
        }
        const min = Math.max(0, Number(configData.roleMatchTime[0]) || 0);
        const max = Math.max(min, Number(configData.roleMatchTime[1]) || min);
        this.scheduleOnce(() => {
            const nickname = playerMgr.matchedAIRoles[this.currentMatchIndex - 1].nickname;
            this.showMatchItem(this.matchItems[this.currentMatchIndex], nickname);
            this.currentMatchIndex++;
            this.scheduleNextMatch();
        }, min + Math.random() * (max - min));
    }

    protected update(dt: number): void {
        if (this.isMatching) {
            this.matchTime += dt;
            this.refreshTimeLab();
        }
    }

    private refreshTimeLab() {
        const seconds = Math.floor(this.matchTime);
        this.timeLab.string = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    private clearItems() {
        for (const item of this.matchItems) {
            const lightTransform = item.getChildByName('light')?.getComponent(UITransform);
            if (lightTransform) {
                Tween.stopAllByTarget(lightTransform);
            }
            item.removeFromParent();
            item.destroy();
        }
        this.matchItems = [];
    }

    onUI_Close() {
        this.isMatching = false;
        this.unscheduleAllCallbacks();
        this.clearItems();
    }

    bindBtn() {
        this.cancelBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
    }

    clickCloseBtn() {
        playerMgr.matchedAIRoles = [];
        this.onClose();
        uiMgr.openPage(UIPath.UIMain);
    }

    onClose() {
        uiMgr.closePage(UIPath.UIMatch);
    }
}
