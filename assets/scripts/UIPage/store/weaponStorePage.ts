import { _decorator, Color, Label, Node, Sprite, instantiate } from 'cc';
import { storePageBase } from './storePageBase';
import { weaponsConfig, JsonWeaponsData } from '../../json/jsonWeapons';
import { imgPath, ItemPath, UIPath } from '../../manager/pathConfig';
import { uiMgr } from '../../manager/UIManager';
import { ccResTools } from '../../extention/resTools';
import { ccTools } from '../../extention/generalTools';
import { zoomButton } from '../../extention/zoomButton';
import { pData } from '../../manager/playerData';
import { QualityColorArr } from '../../manager/configData';
const { ccclass, property } = _decorator;

@ccclass('weaponStorePage')
export class weaponStorePage extends storePageBase {
    @property(Node)
    content: Node;

    @property(Label)
    showNameLab: Label;

    @property(Node)
    attributeLayout: Node;

    private selectedWeapon: JsonWeaponsData | null = null;
    private purchasing = false;

    async initData() {
        const weaponData = weaponsConfig.getAllData().filter((weapon) => weapon.kinds === 0);
        const itemPrefab = await ccResTools.loadPrefab(uiMgr.resBundle, ItemPath.storeItem);
        if (!this.node.isValid || !this.content?.isValid) {
            return;
        }
        if (!itemPrefab) {
            console.warn(`加载武器商品预制体失败: ${ItemPath.storeItem}`);
            return;
        }

        ccTools.destroyAllChild(this.content);
        const itemNodes: Node[] = [];
        for (const weapon of weaponData) {
            const itemNode = instantiate(itemPrefab);
            this.content.addChild(itemNode);
            itemNodes.push(itemNode);

            const nameLab = itemNode.getChildByName("nameLab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = weapon.name ?? "";
                nameLab.color = new Color(QualityColorArr[weapon.quality] ?? "#FFFFFF");
            }
            const bgSprite = itemNode.getChildByName("bg")?.getComponent(Sprite);
            if (bgSprite) {
                ccTools.loadImg(bgSprite, imgPath.storeItemBg + weapon.quality);
            }
            const buyBtn = itemNode.getChildByName("buyBtn");
            const priceLab = buyBtn?.getChildByName("moneyLayout")?.getChildByName("numLab")?.getComponent(Label);
            if (priceLab) {
                priceLab.string = ccTools.formatMonetaryNum(weapon.value ?? 0);
            }
            if (buyBtn) {
                const button = buyBtn.getComponent(zoomButton) ?? buyBtn.addComponent(zoomButton);
                button.onClick = this.clickBuy.bind(this, weapon);
            }

            itemNode.on(Node.EventType.TOUCH_END, () => {
                this.selectWeapon(weapon, itemNodes, itemNode);
            }, this);
        }

        if (weaponData.length > 0) {
            this.selectWeapon(weaponData[0], itemNodes, itemNodes[0]);
        } else {
            this.selectedWeapon = null;
            if (this.showNameLab) {
                this.showNameLab.string = "";
            }
        }
    }

    private async clickBuy(weapon: JsonWeaponsData) {
        if (this.purchasing || !weapon || !Number.isInteger(weapon.itemId)) {
            return;
        }
        const price = Number(weapon.value);
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
            await uiMgr.openPage(UIPath.UIReward, { rewardData: [[weapon.itemId, 1]] });
        } catch (error) {
            console.error("购买武器失败", error);
        } finally {
            this.purchasing = false;
        }
    }

    private selectWeapon(weapon: JsonWeaponsData, itemNodes: Node[], selectedNode: Node) {
        this.selectedWeapon = weapon;
        if (this.showNameLab) {
            this.showNameLab.string = this.selectedWeapon.name ?? "";
            this.showNameLab.color = new Color(QualityColorArr[this.selectedWeapon.quality] ?? "#FFFFFF");
        }
        itemNodes.forEach((itemNode) => {
            const selectNode = itemNode.getChildByName("select");
            if (selectNode) {
                selectNode.active = itemNode === selectedNode;
            }
        });
    }
}
