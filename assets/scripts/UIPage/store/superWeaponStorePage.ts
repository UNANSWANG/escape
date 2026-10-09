import { _decorator, Node, Label, instantiate } from 'cc';
import { storePageBase } from './storePageBase';
import { weaponsConfig } from '../../json/jsonWeapons';
import { ItemPath } from '../../manager/pathConfig';
import { uiMgr } from '../../manager/UIManager';
import { ccResTools } from '../../extention/resTools';
import { ccTools } from '../../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('superWeaponStorePage')
export class superWeaponStorePage extends storePageBase {
    @property(Node)
    content: Node;

    async initData() {
        const content = this.content ?? this.node.getChildByPath("ScrollView/view/content");
        if (!content) {
            console.warn("超武商城缺少商品容器");
            return;
        }
        const weaponData = weaponsConfig.getAllData().filter((weapon) => weapon.kinds === 1);
        const itemPrefab = await ccResTools.loadPrefab(uiMgr.resBundle, ItemPath.superWeaponItem);
        if (!this.node.isValid || !content.isValid) {
            return;
        }
        if (!itemPrefab) {
            console.warn(`加载超武商品预制体失败: ${ItemPath.superWeaponItem}`);
            return;
        }
        ccTools.destroyAllChild(content);
        for (const weapon of weaponData) {
            const itemNode = instantiate(itemPrefab);
            content.addChild(itemNode);
            const nameLab = itemNode.getChildByName("nameLab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = weapon.name ?? "";
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
        }
    }
}


