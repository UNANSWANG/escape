import { _decorator, Color, Label, Node, Sprite, instantiate } from 'cc';
import { storePageBase } from './storePageBase';
import { equipmentConfig, JsonEquipmentData } from '../../json/jsonEquipment';
import { imgPath, ItemPath, UIPath } from '../../manager/pathConfig';
import { uiMgr } from '../../manager/UIManager';
import { ccResTools } from '../../extention/resTools';
import { ccTools } from '../../extention/generalTools';
import { zoomButton } from '../../extention/zoomButton';
import { pData } from '../../manager/playerData';
import { equipmentCommonConfig, QualityColorArr } from '../../manager/configData';
const { ccclass, property } = _decorator;

@ccclass('equipStorePage')
export class equipStorePage extends storePageBase {
    @property(Node)
    content: Node;

    @property(Label)
    showNameLab: Label;

    @property(Node)
    attributeNode: Node;

    private selectedEquipment: JsonEquipmentData | null = null;
    private purchasing = false;

    async initData() {
        const equipmentData = equipmentConfig.getAllData().slice(1);
        const itemPrefab = await ccResTools.loadPrefab(uiMgr.resBundle, ItemPath.storeItem);
        if (!this.node.isValid || !this.content?.isValid) {
            return;
        }
        if (!itemPrefab) {
            console.warn(`加载装备商品预制体失败: ${ItemPath.storeItem}`);
            return;
        }

        ccTools.destroyAllChild(this.content);
        const itemNodes: Node[] = [];
        for (const equipment of equipmentData) {
            const itemNode = instantiate(itemPrefab);
            this.content.addChild(itemNode);
            itemNodes.push(itemNode);

            const firePowerLayout = itemNode.getChildByName("firepowerLayout");
            if (firePowerLayout) {
                firePowerLayout.active = false;
            }
            const nameLab = itemNode.getChildByName("nameLab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = equipment.name ?? "";
                nameLab.color = new Color(QualityColorArr[equipment.quality] ?? "#FFFFFF");
            }
            const bgSprite = itemNode.getChildByName("bg")?.getComponent(Sprite);
            if (bgSprite) {
                ccTools.loadImg(bgSprite, imgPath.storeItemBg + equipment.quality);
            }
            const buyBtn = itemNode.getChildByName("buyBtn");
            const priceLab = buyBtn?.getChildByName("moneyLayout")?.getChildByName("numLab")?.getComponent(Label);
            if (priceLab) {
                priceLab.string = ccTools.formatMonetaryNum(equipment.value ?? 0);
            }
            if (buyBtn) {
                const button = buyBtn.getComponent(zoomButton) ?? buyBtn.addComponent(zoomButton);
                button.onClick = this.clickBuy.bind(this, equipment);
            }
            itemNode.on(Node.EventType.TOUCH_END, () => {
                this.selectEquipment(equipment, itemNodes, itemNode);
            }, this);
        }

        if (equipmentData.length > 0) {
            this.selectEquipment(equipmentData[0], itemNodes, itemNodes[0]);
        } else {
            this.selectedEquipment = null;
            this.refreshAttribute(null);
            if (this.showNameLab) {
                this.showNameLab.string = "";
            }
        }
    }

    private async clickBuy(equipment: JsonEquipmentData) {
        if (this.purchasing || !equipment || !Number.isInteger(equipment.itemId)) {
            return;
        }
        const price = Number(equipment.value);
        if (!Number.isFinite(price) || price < 0) {
            return;
        }
        if (pData.money < price) {
            uiMgr.showTips("银币不足");
            return;
        }
        this.purchasing = true;
        try {
            pData.fixMoney(-price);
            await uiMgr.openPage(UIPath.UIReward, { rewardData: [[equipment.itemId, 1]] });
        } catch (error) {
            console.error("购买装备失败", error);
        } finally {
            this.purchasing = false;
        }
    }

    private selectEquipment(equipment: JsonEquipmentData, itemNodes: Node[], selectedNode: Node) {
        this.selectedEquipment = equipment;
        this.refreshAttribute(equipment);
        if (this.showNameLab) {
            this.showNameLab.string = this.selectedEquipment.name ?? "";
            this.showNameLab.color = new Color(QualityColorArr[this.selectedEquipment.quality] ?? "#FFFFFF");
        }
        itemNodes.forEach((itemNode) => {
            const selectNode = itemNode.getChildByName("select");
            if (selectNode) {
                selectNode.active = itemNode === selectedNode;
            }
        });
    }

    private refreshAttribute(equipment: JsonEquipmentData | null) {
        if (!this.attributeNode) {
            return;
        }
        const attributes = [
            { type: 0, name: "免伤", value: equipment?.damageImmunity, range: equipmentCommonConfig.invincibleRangePercent },
            { type: 1, name: "护甲值", value: equipment?.defenseValue, range: equipmentCommonConfig.armorRangePercent },
            { type: 2, name: "容量", value: equipment?.capacity, range: equipmentCommonConfig.capacityRangePercent },
        ];
        const attribute = equipment ? attributes.find((entry) => entry.type === Number(equipment.type)) : null;
        this.attributeNode.active = !!attribute;
        if (!attribute) {
            return;
        }
        const attributeLab = this.attributeNode.getChildByName("attributeLab")?.getComponent(Label);
        if (attributeLab) {
            attributeLab.string = attribute.name;
        }
        const bar = this.attributeNode.getChildByName("bar")?.getComponent(Sprite);
        if (bar) {
            const value = Number(attribute.value);
            const min = Number(attribute.range?.[0]);
            const max = Number(attribute.range?.[1]);
            const ratio = Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && max > min
                ? (value - min) / (max - min)
                : 0;
            bar.fillRange = Math.max(0, Math.min(1, ratio));
        }
    }
}


