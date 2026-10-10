import { _decorator, Node, Label, instantiate } from 'cc';
import { storePageBase } from './storePageBase';
import { weaponsConfig, JsonWeaponsData } from '../../json/jsonWeapons';
import { ItemPath, UIPath } from '../../manager/pathConfig';
import { uiMgr } from '../../manager/UIManager';
import { ccResTools } from '../../extention/resTools';
import { ccTools } from '../../extention/generalTools';
import { zoomButton } from '../../extention/zoomButton';
import { pData } from '../../manager/playerData';
import { MonetaryType } from '../../manager/configData';
import { videoMgr } from '../../manager/videoManager';
const { ccclass, property } = _decorator;

@ccclass('superWeaponStorePage')
export class superWeaponStorePage extends storePageBase {
    @property(Node)
    content: Node;

    private purchasing = false;

    async initData() {
        const weaponData = weaponsConfig.getAllData().filter((weapon) => weapon.kinds === 1);
        const itemPrefab = await ccResTools.loadPrefab(uiMgr.resBundle, ItemPath.superWeaponItem);
        if (!this.node.isValid || !this.content.isValid) {
            return;
        }
        if (!itemPrefab) {
            console.warn(`加载超武商品预制体失败: ${ItemPath.superWeaponItem}`);
            return;
        }
        ccTools.destroyAllChild(this.content);
        for (const weapon of weaponData) {
            const itemNode = instantiate(itemPrefab);
            this.content.addChild(itemNode);
            const nameLab = itemNode.getChildByName("nameLab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = weapon.name ?? "";
            }
            const firePowerLab = itemNode.getChildByName("firepowerLayout")?.getChildByName("numLab")?.getComponent(Label);
            if (firePowerLab) {
                firePowerLab.string = String(weapon.firePower ?? 0);
            }
            const getBtn = itemNode.getChildByName("getBtn");
            const adNode = getBtn?.getChildByName("adNode");
            const moneyNode = getBtn?.getChildByName("moneyNode");
            const isAdBuy = weapon.isAdBuy === 1;
            if (adNode) {
                adNode.active = isAdBuy;
            }
            if (moneyNode) {
                moneyNode.active = !isAdBuy;
                const priceLab = moneyNode.getChildByName("numLab")?.getComponent(Label);
                if (priceLab) {
                    priceLab.string = ccTools.formatMonetaryNum(weapon.value ?? 0);
                }
            }
            if (getBtn) {
                const button = getBtn.getComponent(zoomButton) ?? getBtn.addComponent(zoomButton);
                button.onClick = this.clickBuy.bind(this, weapon);
            }
        }
    }

    /**购买一个超武；广告商品在广告完成后发放，货币商品先扣款再发放。 */
    private clickBuy(weapon: JsonWeaponsData) {
        if (this.purchasing || !weapon || !Number.isInteger(weapon.itemId)) {
            return;
        }

        const rewardData: number[][] = [[weapon.itemId, 1]];
        if (weapon.isAdBuy === 1) {
            this.purchasing = true;
            videoMgr.watchVideo(68, () => {
                this.openReward(rewardData);
            }, () => {
                this.purchasing = false;
            });
            return;
        }

        const price = Math.max(0, Math.floor(Number(weapon.value) || 0));
        const isGold = Number(weapon.currencyType) === MonetaryType.gold;
        const balance = isGold ? pData.gold : pData.money;
        if (balance < price) {
            uiMgr.showTips(isGold ? "金币不足" : "银币不足");
            return;
        }

        this.purchasing = true;
        if (isGold) {
            pData.fixGold(-price);
        } else {
            pData.fixMoney(-price);
        }
        this.openReward(rewardData);
    }

    private async openReward(rewardData: number[][]) {
        try {
            await uiMgr.openPage(UIPath.UIReward, { rewardData });
        } catch (error) {
            console.error("打开恭喜获得窗口失败", error);
        } finally {
            this.purchasing = false;
        }
    }
}
