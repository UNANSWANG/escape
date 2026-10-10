import { _decorator, Label, Node, instantiate } from 'cc';
import { storePageBase } from './storePageBase';
import { weaponsConfig, JsonWeaponsData } from '../../json/jsonWeapons';
import { ItemPath } from '../../manager/pathConfig';
import { uiMgr } from '../../manager/UIManager';
import { ccResTools } from '../../extention/resTools';
import { ccTools } from '../../extention/generalTools';
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
            }
            const priceLab = itemNode.getChildByName("buyBtn")?.getChildByName("moneyLayout")?.getChildByName("numLab")?.getComponent(Label);
            if (priceLab) {
                priceLab.string = ccTools.formatMonetaryNum(weapon.value ?? 0);
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

    private selectWeapon(weapon: JsonWeaponsData, itemNodes: Node[], selectedNode: Node) {
        this.selectedWeapon = weapon;
        if (this.showNameLab) {
            this.showNameLab.string = this.selectedWeapon.name ?? "";
        }
        itemNodes.forEach((itemNode) => {
            const selectNode = itemNode.getChildByName("select");
            if (selectNode) {
                selectNode.active = itemNode === selectedNode;
            }
        });
    }
}


