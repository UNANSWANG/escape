import { _decorator, Component, Node, Animation, EventTouch, Color, Label, Sprite, Prefab, instantiate, Vec3, UITransform, Widget, tween, Tween } from 'cc';
import { UIBase } from './UIBase';
import { imgPath, ItemPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { pData } from '../manager/playerData';
import { JsonMapData, mapConfig } from '../json/jsonMap';
import { rankConfig } from '../json/jsonRank';
import { difficultyNames, mapDifficultyColorArr, GameEvent, SaveKey } from '../manager/configData';
import { ccStorageTools } from '../extention/storageTools';
import { gm } from '../manager/gm';
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
    private itemListVersion = 0;
    private mapFocusTween: Tween<Node> = null;

    protected onLoad(): void {
        this.bindBtn();
        gm.Event.on(GameEvent.resetMapSelection, this.resetSelection, this);
        // 首次适配或后续尺寸变化后，使用最新的界面边界重新定位。
        this.bg.parent.on(Node.EventType.SIZE_CHANGED, this.refreshMapFocus, this);
    }

    protected onDestroy(): void {
        gm.Event.off(GameEvent.resetMapSelection, this.resetSelection, this);
        this.mapFocusTween?.stop();
        this.bg.parent?.off(Node.EventType.SIZE_CHANGED, this.refreshMapFocus, this);
    }

    private resetSelection() {
        this.selectedMapIdx = -1;
        this.selectedDifficultyType = -1;
        this.hasInitializedSelection = false;
        if (this.node.activeInHierarchy) this.initData();
    }

    onUI_Close() {
        this.mapFocusTween?.stop();
        this.mapFocusTween = null;
        this.itemListVersion++;
    }

    onUI_Open() {
        // 首次打开时先完成 Widget 适配，避免按预制体尺寸计算默认选择的位置。
        this.bg.parent.getComponent(Widget)?.updateAlignment();
        this.initData();
    }

    /**读取地图配置并更新名称、图片和置灰状态；首次打开可恢复存档，之后保留临时地图和难度 */
    initData() {
        this.mapData = this.mapList.children.map((mapNode, index) => mapConfig.getDataByMapIdx(index));
        this.mapList.children.forEach((mapNode, index) => {
            const mapData = this.mapData[index][0];
            const nameLab = mapNode.getChildByName('nameLab')?.getComponent(Label);
            if (mapData && nameLab) {
                nameLab.string = mapData.name;
            }
            const mapImg = mapNode.getChildByName('img')?.getComponent(Sprite);
            if (mapImg) {
                mapImg.grayscale = !this.mapData[index].some((row) => pData.isMapUnlocked(index, row.difficultyType));
                ccTools.loadImg(mapImg, imgPath.showMap + (mapData?.mapIdx ?? 0));
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
        const mapImg = this.detailsNode.getChildByName('map')?.getComponent(Sprite);
        if (mapImg) {
            ccTools.cancelAssetLoad(mapImg);
            mapImg.spriteFrame = null;
            if (selectedMapData) {
                ccTools.loadImg(mapImg, imgPath.showMap + selectedMapData.mapIdx);
            }
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

    /**优先选择已解锁难度；全部锁定时预览配置中最低难度的详情 */
    private initDifficultyTabs(preserveDifficulty: boolean) {
        const rows = this.mapData[this.selectedMapIdx] ?? [];
        const tabs = this.detailsNode.getChildByName('tabLayout').children;
        tabs.forEach((tabNode, difficultyType) => {
            tabNode.active = rows.some((row) => row.difficultyType === difficultyType);
            const unlocked = pData.isMapUnlocked(this.selectedMapIdx, difficultyType);
            const lockNode = tabNode.getChildByName('lock');
            if (lockNode) {
                lockNode.active = tabNode.active && !unlocked;
            }
            const selectNode = tabNode.getChildByName('select');
            if (selectNode) {
                selectNode.active = false;
            }
        });
        const difficultyType = preserveDifficulty && tabs[this.selectedDifficultyType]?.active
            && pData.isMapUnlocked(this.selectedMapIdx, this.selectedDifficultyType)
            ? this.selectedDifficultyType
            : tabs.findIndex((tabNode, index) => tabNode.active && pData.isMapUnlocked(this.selectedMapIdx, index));
        const previewDifficultyType = difficultyType === -1
            ? tabs.findIndex((tabNode) => tabNode.active)
            : difficultyType;
        this.refreshDifficultyDetails(previewDifficultyType);
    }

    /**锁定页签提示解锁段位，只有初始化详情时可以预览锁定难度 */
    private clickDifficulty(difficultyType: number) {
        if (difficultyType !== -1 && !pData.isMapUnlocked(this.selectedMapIdx, difficultyType)) {
            const row = mapConfig.getMapData(this.selectedMapIdx, difficultyType);
            if (row) {
                uiMgr.showTips(`段位达到${rankConfig.getRankName(row.unlockRank)}解锁`);
            }
            return;
        }
        this.refreshDifficultyDetails(difficultyType);
    }

    /**更新难度详情；锁定难度仅供预览，隐藏确认按钮和页签高亮 */
    private refreshDifficultyDetails(difficultyType: number) {
        const rows = this.mapData[this.selectedMapIdx] ?? [];
        this.selectedDifficultyType = rows.some((row) => row.difficultyType === difficultyType) ? difficultyType : -1;
        this.sureBtn.active = pData.isMapUnlocked(this.selectedMapIdx, this.selectedDifficultyType);
        pData.markMapSelected(this.selectedMapIdx, this.selectedDifficultyType);
        this.refreshMapNew();
        const difficultyLab = this.detailsNode.getChildByPath('mapDifficulty/difficultyLab')?.getComponent(Label);
        if (difficultyLab) {
            difficultyLab.string = difficultyNames[this.selectedDifficultyType] ?? '';
            difficultyLab.color = new Color(mapDifficultyColorArr[this.selectedDifficultyType] ?? '#FFFFFF');
        }
        this.detailsNode.getChildByName('tabLayout').children.forEach((tabNode, index) => {
            const selectNode = tabNode.getChildByName('select');
            if (selectNode) {
                selectNode.active = index === this.selectedDifficultyType && pData.isMapUnlocked(this.selectedMapIdx, index);
            }
        });
        const selectedData = rows.find((row) => row.difficultyType === this.selectedDifficultyType);
        const bossImg = this.detailsNode.getChildByName('bossImg')?.getComponent(Sprite);
        if (bossImg) {
            ccTools.cancelAssetLoad(bossImg);
            bossImg.spriteFrame = null;
            if (selectedData && Number.isInteger(selectedData.bossId) && selectedData.bossId >= 0) {
                ccTools.loadImg(bossImg, imgPath.bossBody + selectedData.bossId);
            }
        }
        this.refreshItemLists(selectedData);
    }

    /**地图列表汇总各难度的 new，右侧页签只显示自身难度的 new。 */
    private refreshMapNew() {
        this.mapList.children.forEach((mapNode, mapIdx) => {
            const newNode = mapNode.getChildByName('new');
            if (newNode) newNode.active = pData.hasNewMaps(mapIdx);
        });
        this.detailsNode.getChildByName('tabLayout').children.forEach((tabNode, difficultyType) => {
            const newNode = tabNode.getChildByName('new');
            if (newNode) newNode.active = pData.isMapNew(this.selectedMapIdx, difficultyType);
        });
    }

    private async refreshItemLists(data?: JsonMapData) {
        const version = ++this.itemListVersion;
        const itemLayout = this.detailsNode.getChildByName('itemLayout');
        const equipLayout = this.detailsNode.getChildByName('equipLayout');
        for (const parent of [itemLayout, equipLayout]) {
            for (const child of parent.children) child.active = false;
        }
        if (!data) return;
        try {
            // 缓存命中时直接复用节点，首次只等待模板，不等待物品图片。
            if (!this.showItemPrefab) {
                this.showItemPrefab = await uiMgr.preLoadPrefab(ItemPath.showItem);
            }
        } catch (error) {
            console.warn('地图物品资源加载失败', error);
            return;
        }
        if (version !== this.itemListVersion || !this.node.isValid) return;
        if (!this.showItemPrefab) {
            console.warn(`加载显示物品预制体失败: ${ItemPath.showItem}`);
            return;
        }
        this.initItemList(itemLayout, data.rewardList);
        this.initItemList(equipLayout, data.equipList);
        const otherIds: number[] = [];
        for (const row of this.mapData[this.selectedMapIdx] || []) {
            otherIds.push(...this.parseList(row.rewardList), ...this.parseList(row.equipList));
        }
        void uiMgr.preLoadItemIcons(otherIds, true, () => this.isValid
            && this.node.activeInHierarchy && version === this.itemListVersion)
            .catch(error => console.warn('地图其他难度物品预加载失败', error));
    }

    private parseList(list: string): number[] {
        try {
            const items = JSON.parse(list);
            return Array.isArray(items) ? items.filter(id => Number.isInteger(id) && id >= 0) : [];
        } catch {
            console.warn('地图物品列表格式错误: ' + list);
            return [];
        }
    }

    private initItemList(parent: Node, list: string) {
        this.parseList(list).forEach((itemId, index) => {
            const itemNode = parent.children[index] || instantiate(this.showItemPrefab);
            if (!itemNode.parent) parent.addChild(itemNode);
            itemNode.active = true;
            itemNode.getComponent(showItemController).initData(itemId);
        });
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
        if (!rows.some((row) => row.difficultyType === this.selectedDifficultyType)
            || !pData.isMapUnlocked(this.selectedMapIdx, this.selectedDifficultyType)) {
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


