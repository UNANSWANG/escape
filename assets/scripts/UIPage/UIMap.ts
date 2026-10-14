import { _decorator, Component, Node, Animation, EventTouch, Label} from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { pData } from '../manager/playerData';
import { JsonMapData, mapConfig } from '../json/jsonMap';
import { difficultyNames } from '../manager/configData';
const { ccclass, property } = _decorator;


@ccclass('UIMap')
export class UIMap extends UIBase {
    @property(Node)
    closeBtn: Node;
    
    @property(Node)
    mapList: Node;
    
    @property(Node)
    detailsNode: Node;

    @property(Node)
    sureBtn: Node;
    
    private mapData: JsonMapData[][] = [];
    private selectedMapIdx: number = -1;
    private selectedDifficultyType: number = -1;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        this.initData();
    }

    initData() {
        this.mapData = this.mapList.children.map((mapNode, index) => mapConfig.getDataByMapIdx(index));
        this.mapList.children.forEach((mapNode, index) => {
            const mapData = this.mapData[index][0];
            const nameLab = mapNode.getChildByName('nameLab')?.getComponent(Label);
            if (mapData && nameLab) {
                nameLab.string = mapData.name;
            }
        });
        if (!this.mapData[this.selectedMapIdx]?.length) {
            this.selectedMapIdx = -1;
        }
        this.clickMap(this.selectedMapIdx, true);
    }

    bindBtn() {
        this.node.on(Node.EventType.TOUCH_END, this.clickBlankArea, this);
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        const sureButton = this.sureBtn.getComponent(zoomButton) || this.sureBtn.addComponent(zoomButton);
        sureButton.onClick = this.clickSureBtn.bind(this);
        this.mapList.children.forEach((mapNode, index) => {
            const button = mapNode.getComponent(zoomButton) || mapNode.addComponent(zoomButton);
            button.onClick = () => this.clickMap(index);
        });
        this.detailsNode.getChildByName('tabLayout').children.forEach((tabNode, difficultyType) => {
            const button = tabNode.getComponent(zoomButton) || tabNode.addComponent(zoomButton);
            button.onClick = () => this.clickDifficulty(difficultyType);
        });
    }

    private clickBlankArea(event: EventTouch) {
        let targetNode = event.target as Node;
        while (targetNode && targetNode !== this.node) {
            if (targetNode.parent === this.mapList || targetNode === this.detailsNode || targetNode === this.closeBtn) {
                return;
            }
            targetNode = targetNode.parent;
        }
        this.clickMap(-1);
    }

    clickMap(index: number, preserveDifficulty: boolean = false) {
        if (Number.isInteger(index) && index >= 0 && index < this.mapList.children.length && !this.mapData[index]?.length) {
            uiMgr.showTips('该地图未开放');
            return;
        }
        this.selectedMapIdx = Number.isInteger(index) && index >= 0 && index < this.mapList.children.length ? index : -1;
        this.mapList.children.forEach((mapNode, mapIndex) => {
            const selectNode = mapNode.getChildByName('select');
            if (selectNode) {
                selectNode.active = mapIndex === this.selectedMapIdx;
            }
        });
        const selectedMapData = this.mapData[this.selectedMapIdx]?.[0];
        const nameLab = this.detailsNode.getChildByName('nameLab')?.getComponent(Label);
        if (nameLab) {
            nameLab.string = selectedMapData?.name ?? '';
        }
        this.initDifficultyTabs(preserveDifficulty);
        this.detailsNode.active = this.selectedMapIdx !== -1;
    }

    private initDifficultyTabs(preserveDifficulty: boolean) {
        const rows = this.mapData[this.selectedMapIdx] ?? [];
        const tabs = this.detailsNode.getChildByName('tabLayout').children;
        tabs.forEach((tabNode, difficultyType) => {
            tabNode.active = rows.some((row) => row.difficultyType === difficultyType);
        });
        const difficultyType = preserveDifficulty && tabs[this.selectedDifficultyType]?.active
            ? this.selectedDifficultyType
            : tabs.findIndex((tabNode) => tabNode.active);
        this.clickDifficulty(difficultyType);
    }

    private clickDifficulty(difficultyType: number) {
        const rows = this.mapData[this.selectedMapIdx] ?? [];
        this.selectedDifficultyType = rows.some((row) => row.difficultyType === difficultyType) ? difficultyType : -1;
        const difficultyLab = this.detailsNode.getChildByPath('mapDifficulty/difficultyLab')?.getComponent(Label);
        if (difficultyLab) {
            difficultyLab.string = difficultyNames[this.selectedDifficultyType] ?? '';
        }
        this.detailsNode.getChildByName('tabLayout').children.forEach((tabNode, index) => {
            const selectNode = tabNode.getChildByName('select');
            if (selectNode) {
                selectNode.active = index === this.selectedDifficultyType;
            }
        });
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    clickSureBtn() {
        const rows = this.mapData[this.selectedMapIdx] ?? [];
        if (!rows.some((row) => row.difficultyType === this.selectedDifficultyType)) {
            return;
        }
        pData.selectMapData = [this.selectedMapIdx, this.selectedDifficultyType];
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIMap);
    }
}


