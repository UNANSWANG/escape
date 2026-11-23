import { _decorator, Color, Label, Layout, Node, ScrollView, Sprite, UITransform, Vec2, instantiate } from 'cc';
import { storePageBase } from './storePageBase';
import { weaponsConfig, JsonWeaponsData } from '../../json/jsonWeapons';
import { imgPath, ItemPath, UIPath } from '../../manager/pathConfig';
import { uiMgr } from '../../manager/UIManager';
import { ccTools } from '../../extention/generalTools';
import { zoomButton } from '../../extention/zoomButton';
import { pData } from '../../manager/playerData';
import { QualityColorArr, weaponCommonConfig } from '../../manager/configData';
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
    private buyButtons = new Map<number, Node>();

    async initData() {
        const weaponData = weaponsConfig.getAllData().slice(1).filter((weapon) => weapon.kinds === 0 && weapon.isStore === 1);
        const itemPrefab = await uiMgr.preLoadPrefab(ItemPath.storeItem);
        if (!this.node.isValid || !this.content?.isValid) {
            return;
        }
        if (!itemPrefab) {
            console.warn(`加载武器商品预制体失败: ${ItemPath.storeItem}`);
            return;
        }

        ccTools.destroyAllChild(this.content);
        this.buyButtons.clear();
        const itemNodes: Node[] = [];
        for (const weapon of weaponData) {
            const itemNode = instantiate(itemPrefab);
            this.content.addChild(itemNode);
            itemNodes.push(itemNode);

            const weaponImg = itemNode.getChildByName("img")?.getComponent(Sprite);
            if (weaponImg) {
                weaponImg.spriteFrame = null;
                ccTools.loadImg(weaponImg, imgPath.weaponIcon + weapon.itemId);
            }
            const nameLab = itemNode.getChildByName("nameLab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = weapon.name ?? "";
                nameLab.color = new Color(QualityColorArr[weapon.quality] ?? "#FFFFFF");
            }
            const bgSprite = itemNode.getChildByName("bg")?.getComponent(Sprite);
            if (bgSprite) {
                ccTools.loadImg(bgSprite, imgPath.storeItemBg + weapon.quality);
            }
            const firePowerLab = itemNode.getChildByName("firepowerLayout")?.getChildByName("numLab")?.getComponent(Label);
            const firePowerLayout = itemNode.getChildByName("firepowerLayout");
            if (firePowerLayout) {
                firePowerLayout.active = true;
            }
            if (firePowerLab) {
                firePowerLab.string = String(weapon.firePower ?? 0);
            }
            const buyBtn = itemNode.getChildByName("buyBtn");
            const priceLab = buyBtn?.getChildByName("moneyLayout")?.getChildByName("numLab")?.getComponent(Label);
            if (priceLab) {
                priceLab.string = ccTools.formatMonetaryNum(weapon.value ?? 0);
            }
            if (buyBtn) {
                this.buyButtons.set(weapon.itemId, buyBtn);
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
            this.refreshShowWeaponImage(null);
            if (this.showNameLab) {
                this.showNameLab.string = "";
            }
        }
    }

    getGuideBuyButton(itemId: number): Node {
        const button = this.buyButtons.get(itemId);
        if (!button?.isValid) throw new Error(`未找到武器商品购买按钮: ${itemId}`);
        this.content.getComponent(Layout)?.updateLayout();
        const scrollView = this.node.getComponentInChildren(ScrollView);
        if (scrollView?.content === this.content && scrollView.vertical) {
            const transform = this.content.getComponent(UITransform);
            const item = button.parent;
            const itemTransform = item.getComponent(UITransform);
            const offset = transform.height * (1 - transform.anchorY)
                - item.position.y - itemTransform.height * (1 - itemTransform.anchorY);
            scrollView.stopAutoScroll();
            scrollView.scrollToOffset(new Vec2(0, Math.max(0, offset)), 0);
        }
        return button;
    }

    buyGuideWeapon(itemId: number, onClose: () => void): Promise<boolean> {
        return this.clickBuy(weaponsConfig.getDataByItemId(itemId), { showGetBtn: true, onClose });
    }

    private async clickBuy(weapon: JsonWeaponsData, rewardOptions?: { showGetBtn: boolean; onClose: () => void }): Promise<boolean> {
        if (this.purchasing || !weapon || !Number.isInteger(weapon.itemId)) {
            return false;
        }
        const price = Number(weapon.value);
        if (!Number.isFinite(price) || price < 0) {
            return false;
        }
        if (pData.money < price) {
            uiMgr.showTips("银币不足");
            return false;
        }

        this.purchasing = true;
        try {
            pData.fixMoney(-price);
            await uiMgr.openPage(UIPath.UIReward, { rewardData: [[weapon.itemId, 1]], ...rewardOptions });
            return true;
        } catch (error) {
            console.error("购买武器失败", error);
            return false;
        } finally {
            this.purchasing = false;
        }
    }

    private selectWeapon(weapon: JsonWeaponsData, itemNodes: Node[], selectedNode: Node) {
        this.selectedWeapon = weapon;
        this.refreshShowWeaponImage(weapon);
        this.refreshAttributes(weapon);
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

    /** 默认选中和切换商品时同步刷新展示武器。 */
    private refreshShowWeaponImage(weapon: JsonWeaponsData | null) {
        const weaponImg = this.node.getChildByName("showNode")?.getChildByName("img")?.getComponent(Sprite);
        if (!weaponImg) return;
        ccTools.cancelAssetLoad(weaponImg);
        weaponImg.spriteFrame = null;
        if (weapon) {
            ccTools.loadImg(weaponImg, imgPath.weaponIcon + weapon.itemId);
        }
    }

    private refreshAttributes(weapon: JsonWeaponsData) {
        if (!this.attributeLayout || !weapon) {
            return;
        }
        const bulletNum = Number(weapon.bulletNum) > 0 ? Number(weapon.bulletNum) : 1;
        const attributes = [
            { nodeName: "attackNode", value: (Number(weapon.attack) || 0) * bulletNum, range: weaponCommonConfig.attackRangePercent },
            { nodeName: "attackSpeedNode", value: Number(weapon.attackInterval) || 0, range: weaponCommonConfig.attackIntervalRangePercent },
            { nodeName: "magazinesNode", value: Number(weapon.capacity) || 0, range: weaponCommonConfig.capacityRangePercent },
            { nodeName: "rangeNode", value: Number(weapon.attackRange) || 0, range: weaponCommonConfig.attackRangeRangePercent },
            { nodeName: "speedNode", value: Number(weapon.speed) || 0, range: weaponCommonConfig.speedRangePercent },
        ];
        attributes.forEach(({ nodeName, value, range }) => {
            const attributeNode = this.attributeLayout.getChildByName(nodeName);
            if (!attributeNode) {
                return;
            }
            attributeNode.active = nodeName !== "magazinesNode" || Number(weapon.type) !== 0;
            if (!attributeNode.active) {
                return;
            }
            const numLab = attributeNode.getChildByName("numLab")?.getComponent(Label);
            if (numLab) {
                numLab.string = String(value);
            }
            const bar = attributeNode.getChildByName("bar")?.getComponent(Sprite);
            if (bar) {
                const min = Number(range?.[0]) || 0;
                const max = Number(range?.[1]) || min;
                const ratio = max > min ? (value - min) / (max - min) : 0;
                const normalizedRatio = Math.max(0, Math.min(1, ratio));
                bar.fillRange = nodeName === "attackSpeedNode" ? 1 - normalizedRatio : normalizedRatio;
            }
        });
    }
}
