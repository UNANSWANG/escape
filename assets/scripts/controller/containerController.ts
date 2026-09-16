import { _decorator, Component, Enum } from 'cc';
import { ContainerType, containerConfig } from '../json/jsonContainer';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('containerController')
export class containerController extends Component {
    @property({
        type: Enum(ContainerType),
        tooltip: '选择容器类型'
    })
    containerType: ContainerType = ContainerType.SupplyBox;

    /** 容器内生成的物品索引；首次打开前为空 */
    itemData: number[] = [];
    private isItemDataInitialized = false;

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
            const itemIndex = ccTools.getWeightedRandomIndex(probabilityWeight);
            if (itemIndex >= 0) {
                this.itemData.push(itemIndex);
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

