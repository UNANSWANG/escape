import { equipmentConfig, JsonEquipmentData } from './jsonEquipment';
import { itemConfig, JsonItemData } from './jsonItem';
import { weaponsConfig, JsonWeaponsData } from './jsonWeapons';

/** 三种物品表中任意一条配置数据。 */
export type JsonItemDataUnion = JsonWeaponsData | JsonEquipmentData | JsonItemData;

/**
 * 根据 itemId 所属区间，从对应表中获取配置。
 * weapons: 0-100000
 * equipment: 100001-200000
 * item: 200001-300000
 */
export function getItemDataByItemId(itemId: number): JsonItemDataUnion | null {
    if (!Number.isInteger(itemId)) return null;

    if (itemId >= 0 && itemId <= 100000) {
        return weaponsConfig.getDataByItemId(itemId);
    }

    if (itemId >= 100001 && itemId <= 200000) {
        return equipmentConfig.getDataByItemId(itemId);
    }

    if (itemId >= 200001 && itemId <= 300000) {
        return itemConfig.getDataByItemId(itemId);
    }

    return null;
}
