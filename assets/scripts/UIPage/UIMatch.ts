import { _decorator, Node, Animation, Label, Prefab, instantiate, UITransform, tween, Tween } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { configData } from '../manager/configData';
import { ccTools } from '../extention/generalTools';
import { nicknameConfig } from '../json/jsonNickname';
import { agentRoleConfig } from '../json/jsonAgentRole';
import { mapConfig } from '../json/jsonMap';
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
    private nicknamePool: string[] = [];

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(count: number = 4) {
        this.initData(count);
    }

    initData(count: number) {
        this.unscheduleAllCallbacks();
        this.clearItems();
        uiMgr.preLoadGame().catch((error) => {
            console.error('匹配界面预加载游戏资源失败', error);
        });
        this.matchTime = 0;
        this.currentMatchIndex = 0;
        this.isMatching = true;
        this.titleLab.string = '匹配中...';
        this.refreshTimeLab();
        this.nicknamePool = Array.from(new Set(
            (nicknameConfig.roleNicknameAllData || [])
                .map((data) => data.nickname?.trim())
                .filter((nickname) => !!nickname && nickname !== '你')
        ));
        ccTools.shuffleArray(this.nicknamePool);

        const itemCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 6;
        playerMgr.matchedAIRoles = [];
        const [mapIdx, difficultyType] = pData.selectMapData;
        const rawTypes: unknown = mapConfig.getMapData(mapIdx, difficultyType)?.agentList;
        let agentTypes: number[] = [];
        try {
            const parsed: unknown = typeof rawTypes === 'string' ? JSON.parse(rawTypes) : rawTypes;
            if (Array.isArray(parsed)) agentTypes = parsed.filter(value => Number.isInteger(value));
        } catch {
            console.warn('地图 agentList 配置格式错误', rawTypes);
        }
        playerMgr.matchedAIRoles = agentRoleConfig.randomRoles(agentTypes, itemCount - 1);
        console.log('本局随机人机表 ID:', playerMgr.matchedAIRoles.map(data => data.id));
        if (playerMgr.matchedAIRoles.length !== itemCount - 1) {
            this.isMatching = false;
            this.titleLab.string = '未找到可用的 AI 配置';
            console.warn('agentRole 表中没有符合地图 agentList 的 AI 配置', agentTypes);
            return;
        }
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
        this.addRoleShow(item, isPlayerData);
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
        await uiMgr.preLoadGame();
        // 加载期间可能已关闭界面或重新匹配，仅为当前列表中的条目添加角色。
        if (!item?.isValid || !this.matchItems.includes(item) || !uiMgr.roleShowPrefab) {
            return;
        }
        const roleContent = item.getChildByName('roleContent');
        if (!roleContent || roleContent.children.length > 0) {
            return;
        }
        const roleNode = instantiate(uiMgr.roleShowPrefab);
        roleNode.getComponent(roleShowController)?.setIsPlayerData(isPlayerData);
        roleContent.addChild(roleNode);
    }

    private scheduleNextMatch() {
        if (this.currentMatchIndex >= this.matchItems.length) {
            this.isMatching = false;
            this.titleLab.string = '匹配成功';
            this.scheduleOnce(() => {
                uiMgr.startGame();
                this.onClose();
            }, 1);
            return;
        }
        const min = Math.max(0, Number(configData.roleMatchTime[0]) || 0);
        const max = Math.max(min, Number(configData.roleMatchTime[1]) || min);
        this.scheduleOnce(() => {
            const nickname = this.nicknamePool.pop() || `玩家${this.currentMatchIndex}`;
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
