import { _decorator, Node, Animation, Label, Prefab, instantiate, UITransform, tween, Tween } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { configData } from '../manager/configData';
import { ccTools } from '../extention/generalTools';
import { nicknameConfig } from '../json/jsonNickname';
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

    onUI_Open(count: number = 6) {
        let anim = this.getComponent(Animation);
        anim?.play();
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
        this.nicknamePool = Array.from(new Set(
            (nicknameConfig.roleNicknameAllData || [])
                .map((data) => data.nickname?.trim())
                .filter((nickname) => !!nickname && nickname !== '你')
        ));
        ccTools.shuffleArray(this.nicknamePool);

        const itemCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 6;
        for (let index = 0; index < itemCount; index++) {
            const item = instantiate(this.itemPre);
            this.contentLayout.addChild(item);
            this.setItemVisible(item, false);
            this.matchItems.push(item);
        }

        ccTools.shuffleArray(this.matchItems);
        this.showMatchItem(this.matchItems[0], '你');
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

    showMatchItem(item: Node, nickname: string) {
        this.setItemVisible(item, true);
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
        this.onClose();
        uiMgr.openPage(UIPath.UIMain);
    }

    onClose() {
        uiMgr.closePage(UIPath.UIMatch);
    }
}
