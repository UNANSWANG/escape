import { _decorator, Component, Enum, Rect, Sprite, UITransform } from 'cc';
import { ContainerType, containerConfig } from '../json/jsonContainer';
import { itemConfig } from '../json/jsonItem';
import { ccTools } from '../extention/generalTools';
import { ccResTools } from '../extention/resTools';
import { imgPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
const { ccclass, property } = _decorator;

/** 由完成搜索的容器节点发送，每个容器只发送一次。 */
export const CONTAINER_SEARCH_COMPLETE = 'container-search-complete';

@ccclass('containerController')
export class containerController extends Component {
    @property({
        type: Enum(ContainerType),
        tooltip: '选择容器类型'
    })
    containerType: ContainerType = ContainerType.SupplyBox;

    /** 容器内生成的物品 itemId；首次打开前为空 */
    itemData: number[] = [];
    /** 已完成加载展示的容器物品索引。 */
    private revealedItemStates: boolean[] = [];
    private isItemDataInitialized = false;
    private isOpened = false;
    private isSearchComplete = false;
    /** 记录初始物资的最高品质，避免搜索中拾取物资后丢失品质信息。 */
    private highestQuality = -1;

    protected onLoad(): void {
        this.refreshOpenState();
        const light = this.node.getChildByName('light');
        if (light) light.active = false;
        this.node.on(CONTAINER_SEARCH_COMPLETE, this.showSearchLight, this);
    }

    protected onDestroy(): void {
        this.node.off(CONTAINER_SEARCH_COMPLETE, this.showSearchLight, this);
    }

    /** 仅使用脚本所在节点的尺寸，不包含图片、光效等子节点。 */
    getInteractionBounds(): Rect | null {
        const transform = this.getComponent(UITransform);
        if (!transform) return null;
        const bounds = new Rect(-transform.anchorX * transform.width,
            -transform.anchorY * transform.height, transform.width, transform.height);
        bounds.transformMat4(this.node.worldMatrix);
        return bounds;
    }

    /** 首次打开后保持开启外观，关闭搜索界面不会重新合上容器。 */
    open() {
        this.isOpened = true;
        this.refreshOpenState();
    }

    private refreshOpenState() {
        const normal = this.node.getChildByName('normal');
        const open = this.node.getChildByName('open');
        if (normal) normal.active = !this.isOpened;
        if (open) open.active = this.isOpened;
    }

    /** 背包搜索结束时调用；只有全部物资已揭示才发送一次完成事件。 */
    completeSearch() {
        if (!this.isItemDataInitialized || this.isSearchComplete) return;
        if (this.itemData.some((itemId, index) => itemId !== -1 && !this.revealedItemStates[index])) return;
        this.isSearchComplete = true;
        this.node.emit(CONTAINER_SEARCH_COMPLETE, this.highestQuality);
    }

    private async showSearchLight(quality: number) {
        const light = this.node.getChildByName('light');
        const sprite = light?.getComponent(Sprite);
        if (!sprite || quality < 0) return;
        const spriteFrame = await ccResTools.loadPic(uiMgr.resBundle, imgPath.boxLight + quality);
        if (!this.isValid || !light.isValid || !sprite.isValid || !spriteFrame) return;
        sprite.spriteFrame = spriteFrame;
        light.active = true;
    }

    /**
     * 获取容器物品索引。首次调用时按配置生成，后续始终返回同一份数据。
     */
    getItemData(): number[] {
        if (!this.isItemDataInitialized) {
            this.initItemData();
        }
        console.warn(`容器数据: ${this.itemData}`);
        return this.itemData;
    }

    /** 获取容器物品的加载完成状态。状态与容器生命周期一致。 */
    getRevealedItemStates(): boolean[] {
        return this.revealedItemStates;
    }

    /** 按容器配置随机生成物品索引 */
    private initItemData() {
        const containerData = containerConfig.getDataByType(this.containerType);
        if (!containerData) {
            console.warn(`Container config is unavailable for type: ${this.containerType}`);
            return;
        }

        const itemNumWeight = this.parseWeights(containerData.itemNumWeight);
        const itemCountIndex = ccTools.getWeightedRandomIndex(itemNumWeight);
        if (itemCountIndex < 0) {
            console.warn(`Invalid item count weights for container type: ${this.containerType}`);
            this.isItemDataInitialized = true;
            return;
        }

        const probabilityWeight = this.parseWeights(containerData.probabilityWeight);
        for (let i = 0; i < itemCountIndex + 1; i++) {
            const quality = ccTools.getWeightedRandomIndex(probabilityWeight);
            if (quality < 0) continue;

            const qualityItems = itemConfig.getDataByQuality(quality);
            const itemIndex = ccTools.getWeightedRandomIndex(qualityItems.map((itemData) => itemData.weight));
            const itemData = qualityItems[itemIndex];
            if (itemData) {
                this.itemData.push(itemData.itemId);
                const itemQuality = itemData.quality;
                if (Number.isFinite(itemQuality)) {
                    this.highestQuality = Math.max(this.highestQuality, itemQuality);
                }
            }
        }
        this.isItemDataInitialized = true;
    }

    /** 将配置中的 JSON 权重数组转换为数值数组 */
    private parseWeights(weightData: string): number[] {
        try {
            const weights = JSON.parse(weightData);
            return Array.isArray(weights) ? weights.map((weight) => Number(weight) || 0) : [];
        } catch (error) {
            console.warn(`Invalid container weight data: ${weightData}`);
            return [];
        }
    }
}
