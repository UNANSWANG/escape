import { _decorator, Component, Node, Animation, EventTouch, Color, Label, Prefab, instantiate, Vec3, UITransform, Widget, tween, Tween } from 'cc';
import { UIBase } from './UIBase';
import { ItemPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { pData } from '../manager/playerData';
import { JsonMapData, mapConfig } from '../json/jsonMap';
import { difficultyNames, mapDifficultyColorArr, GameEvent, SaveKey } from '../manager/configData';
import { ccStorageTools } from '../extention/storageTools';
import { gm } from '../manager/gm';
import { ccResTools } from '../extention/resTools';
import { ccTools } from '../extention/generalTools';
import { showItemController } from '../controller/showItemController';
const { ccclass, property } = _decorator;


/**地图选择界面；临时选择随界面保留，点击确定后才更新玩家数据和存档 */
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

    @property(Node)
    bg: Node;

    @property({ tooltip: '选中地图放大后的水平偏移，负数向左' })
    mapFocusOffsetX: number = -120;

    /**按地图节点索引保存配置，每组包含该地图的全部难度数据 */
    private mapData: JsonMapData[][] = [];
    /**界面临时选中的地图索引；-1 表示未选择，不直接修改存档 */
    private selectedMapIdx: number = -1;
    /**界面临时选中的难度类型；-1 表示未选择 */
    private selectedDifficultyType: number = -1;
    /**是否已完成首次选择初始化，避免再次打开时用存档覆盖临时选择 */
    private hasInitializedSelection = false;
    private showItemPrefab: Prefab = null;
    private showItemLoadPromise: Promise<Prefab> = null;
    private itemListVersion = 0;
    private mapFocusTween: Tween<Node> = null;

    protected onLoad(): void {
        this.bindBtn();
        // 首次适配或后续尺寸变化后，使用最新的界面边界重新定位。
        this.bg.parent.on(Node.EventType.SIZE_CHANGED, this.refreshMapFocus, this);
    }

    protected onDestroy(): void {
        this.mapFocusTween?.stop();
        this.bg.parent?.off(Node.EventType.SIZE_CHANGED, this.refreshMapFocus, this);
    }

    onUI_Close() {
        this.mapFocusTween?.stop();
        this.mapFocusTween = null;
    }

    onUI_Open() {
        // 首次打开时先完成 Widget 适配，避免按预制体尺寸计算默认选择的位置。
        this.bg.parent.getComponent(Widget)?.updateAlignment();
        this.initData();
    }

    /**读取地图配置并更新名称；首次打开可恢复存档，之后保留临时地图和难度 */
    initData() {
        this.mapData = this.mapList.children.map((mapNode, index) => mapConfig.getDataByMapIdx(index));
        this.mapList.children.forEach((mapNode, index) => {
            const mapData = this.mapData[index][0];
            const nameLab = mapNode.getChildByName('nameLab')?.getComponent(Label);
            if (mapData && nameLab) {
                nameLab.string = mapData.name;
            }
        });
        if (!this.hasInitializedSelection) {
            if (!pData.hasConfirmedMapSelection) {
                const [mapIdx, difficultyType] = pData.selectMapData;
                if (this.mapData[mapIdx]?.length) {
                    this.selectedMapIdx = mapIdx;
                    this.selectedDifficultyType = difficultyType;
                }
            }
            this.hasInitializedSelection = true;
        }
        if (!this.mapData[this.selectedMapIdx]?.length) {
            this.selectedMapIdx = -1;
        }
        this.clickMap(this.selectedMapIdx, true);
    }

    /**绑定背景、地图、难度页签及确认和关闭按钮的点击事件 */
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

    /**点击空白区域清除临时选择；地图、详情和关闭按钮的点击不清除选择 */
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

    /**选择地图或传入 -1 清除选择；未开放地图只提示，preserveDifficulty 用于保留有效的难度选择 */
    clickMap(index: number, preserveDifficulty: boolean = false) {
        if (Number.isInteger(index) && index >= 0 && index < this.mapList.children.length && !this.mapData[index]?.length) {
            uiMgr.showTips('该地图未开放');
            return;
        }
        const previousMapIdx = this.selectedMapIdx;
        this.selectedMapIdx = Number.isInteger(index) && index >= 0 && index < this.mapList.children.length ? index : -1;
        this.mapList.children.forEach((mapNode, mapIndex) => {
            const selectNode = mapNode.getChildByName('select');
            if (selectNode) {
                selectNode.active = mapIndex === this.selectedMapIdx;
            }
        });
        this.refreshMapFocus(previousMapIdx !== this.selectedMapIdx);
        const selectedMapData = this.mapData[this.selectedMapIdx]?.[0];
        const nameLab = this.detailsNode.getChildByName('nameLab')?.getComponent(Label);
        if (nameLab) {
            nameLab.string = selectedMapData?.name ?? '';
        }
        this.initDifficultyTabs(preserveDifficulty);
        this.detailsNode.active = this.selectedMapIdx !== -1;
    }

    /**选择时放大并尽量居中地图，背景到达界面边缘时停止移动，未选择时恢复背景。 */
    private refreshMapFocus(animate: boolean = false) {
        this.mapFocusTween?.stop();
        this.mapFocusTween = null;
        const startPosition = this.bg.position.clone();
        const startScale = this.bg.scale.clone();
        const selectedMap = this.mapList.children[this.selectedMapIdx];
        this.bg.setPosition(0, 0, 0);
        this.bg.setScale(selectedMap ? 1.5 : 1, selectedMap ? 1.5 : 1, 1);
        if (selectedMap) {
            const mapPosition = this.bg.parent.inverseTransformPoint(new Vec3(), selectedMap.worldPosition);
            let x = this.mapFocusOffsetX - mapPosition.x;
            let y = -mapPosition.y;
            const viewport = this.bg.parent.getComponent(UITransform);
            const background = this.bg.getComponent(UITransform);
            if (viewport && background) {
                const width = background.width * this.bg.scale.x;
                const height = background.height * this.bg.scale.y;
                // 背景的四条边必须覆盖界面；背景小于界面时，该方向保持居中。
                const minX = viewport.width * (1 - viewport.anchorX) - width * (1 - background.anchorX);
                const maxX = -viewport.width * viewport.anchorX + width * background.anchorX;
                const minY = viewport.height * (1 - viewport.anchorY) - height * (1 - background.anchorY);
                const maxY = -viewport.height * viewport.anchorY + height * background.anchorY;
                x = minX <= maxX ? Math.min(maxX, Math.max(minX, x)) : (minX + maxX) / 2;
                y = minY <= maxY ? Math.min(maxY, Math.max(minY, y)) : (minY + maxY) / 2;
            }
            this.bg.setPosition(x, y, 0);
        }
        if (animate) {
            const targetPosition = this.bg.position.clone();
            const targetScale = this.bg.scale.clone();
            this.bg.setPosition(startPosition);
            this.bg.setScale(startScale);
            this.mapFocusTween = tween(this.bg)
                .to(0.3, { position: targetPosition, scale: targetScale }, { easing: 'quadOut' })
                .call(() => { this.mapFocusTween = null; })
                .start();
        }
    }

    /**仅显示配置中存在的难度页签；保留有效选择，否则默认选中第一个可用页签 */
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

    /**更新临时难度、难度名称和页签高亮，不保存到玩家数据或本地 */
    private clickDifficulty(difficultyType: number) {
        const rows = this.mapData[this.selectedMapIdx] ?? [];
        this.selectedDifficultyType = rows.some((row) => row.difficultyType === difficultyType) ? difficultyType : -1;
        const difficultyLab = this.detailsNode.getChildByPath('mapDifficulty/difficultyLab')?.getComponent(Label);
        if (difficultyLab) {
            difficultyLab.string = difficultyNames[this.selectedDifficultyType] ?? '';
            difficultyLab.color = new Color(mapDifficultyColorArr[this.selectedDifficultyType] ?? '#FFFFFF');
        }
        this.detailsNode.getChildByName('tabLayout').children.forEach((tabNode, index) => {
            const selectNode = tabNode.getChildByName('select');
            if (selectNode) {
                selectNode.active = index === this.selectedDifficultyType;
            }
        });
        const selectedData = rows.find((row) => row.difficultyType === this.selectedDifficultyType);
        this.refreshItemLists(selectedData);
    }

    private async refreshItemLists(data?: JsonMapData) {
        const version = ++this.itemListVersion;
        const itemLayout = this.detailsNode.getChildByName('itemLayout');
        const equipLayout = this.detailsNode.getChildByName('equipLayout');
        ccTools.destroyAllChild(itemLayout);
        ccTools.destroyAllChild(equipLayout);
        if (!data) return;

        if (!this.showItemPrefab) {
            if (!this.showItemLoadPromise) {
                this.showItemLoadPromise = ccResTools.loadPrefab(uiMgr.resBundle, ItemPath.showItem);
            }
            this.showItemPrefab = await this.showItemLoadPromise;
            this.showItemLoadPromise = null;
        }
        if (version !== this.itemListVersion || !this.node.isValid) return;
        if (!this.showItemPrefab) {
            console.warn(`加载显示物品预制体失败: ${ItemPath.showItem}`);
            return;
        }
        this.initItemList(itemLayout, data.rewardList);
        this.initItemList(equipLayout, data.equipList);
    }

    private initItemList(parent: Node, list: string) {
        let itemIds: unknown;
        try {
            itemIds = JSON.parse(list);
        } catch {
            console.warn(`地图物品列表格式错误: ${list}`);
            return;
        }
        if (!Array.isArray(itemIds)) return;
        for (const itemId of itemIds) {
            if (!Number.isInteger(itemId) || itemId < 0) continue;
            const itemNode = instantiate(this.showItemPrefab);
            parent.addChild(itemNode);
            itemNode.getComponent(showItemController).initData(itemId);
        }
    }

    ///
    ///点击事件
    ///

    /**直接关闭界面，保留临时选择，不更新已确认的地图数据 */
    clickCloseBtn() {
        this.onClose();
    }

    /**确认有效选择并保存到本地，标记本次运行已确认，通知主页刷新后关闭界面 */
    clickSureBtn() {
        const rows = this.mapData[this.selectedMapIdx] ?? [];
        if (!rows.some((row) => row.difficultyType === this.selectedDifficultyType)) {
            return;
        }
        pData.selectMapData = [this.selectedMapIdx, this.selectedDifficultyType];
        ccStorageTools.setData(SaveKey.selectMapData, pData.selectMapData.slice());
        pData.hasConfirmedMapSelection = true;
        gm.Event.emit(GameEvent.refreshMapSelection);
        this.onClose();
    }

    /**关闭界面；界面节点由 UIManager 保留，临时选择随之保留 */
    onClose() {
        uiMgr.closePage(UIPath.UIMap);
    }
}


