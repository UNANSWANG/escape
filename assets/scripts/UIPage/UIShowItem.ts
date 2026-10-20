import { _decorator, Node, Animation, EventTouch, Prefab, instantiate } from 'cc';
import { UIBase } from './UIBase';
import { ItemPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccResTools } from '../extention/resTools';
import { pData } from '../manager/playerData';
import { itemConfig } from '../json/jsonItem';
import { showItemController } from '../controller/showItemController';
const { ccclass, property } = _decorator;


@ccclass('UIShowItem')
export class UIShowItem extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    useBtn: Node;

    @property(Node)
    removeBtn: Node;

    @property(Node)
    content: Node;

    private showItemPrefabLoad: Promise<Prefab> = null;
    private refreshVersion = 0;
    private selectedItemNode: Node = null;
    private selectedItemId: number = null;
    private slotIndex = -1;
    private itemIds = new Map<Node, number>();

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(slotIndex: number) {
        this.slotIndex = slotIndex;
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData();
    }

    async initData() {
        const version = ++this.refreshVersion;
        this.selectedItemNode = null;
        this.selectedItemId = null;
        this.itemIds.clear();
        this.refreshButtons();
        this.content.destroyAllChildren();
        const collections = pData.getStorehouseData()
            .filter(([itemId, num]) => num > 0 && itemConfig.getDataByItemId(itemId)?.quality === 4);
        if (!collections.length) {
            return;
        }
        try {
            if (!this.showItemPrefabLoad) {
                this.showItemPrefabLoad = ccResTools.loadPrefab(uiMgr.resBundle, ItemPath.showItem);
            }
            const prefab = await this.showItemPrefabLoad;
            if (!this.isValid || version !== this.refreshVersion) {
                return;
            }
            if (!prefab) {
                this.showItemPrefabLoad = null;
                console.warn(`加载显示物品预制体失败: ${ItemPath.showItem}`);
                return;
            }
            collections.forEach(([itemId]) => {
                const itemNode = instantiate(prefab);
                this.content.addChild(itemNode);
                const controller = itemNode.getComponent(showItemController)
                    || itemNode.addComponent(showItemController);
                controller.initData(itemId);
                this.itemIds.set(itemNode, itemId);
                const selectNode = itemNode.getChildByName('select');
                if (selectNode) {
                    selectNode.active = false;
                }
                itemNode.on(Node.EventType.TOUCH_END, this.clickItem, this);
            });
        } catch (error) {
            this.showItemPrefabLoad = null;
            console.error('加载仓库藏品失败', error);
        }
    }

    onUI_Close() {
        this.refreshVersion++;
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.useBtn.addComponent(zoomButton).onClick = this.clickUseBtn.bind(this);
        this.removeBtn.addComponent(zoomButton).onClick = this.clickRemoveBtn.bind(this);
    }

    private refreshButtons() {
        this.useBtn.active = this.selectedItemId !== null;
        this.removeBtn.active = pData.getShowItem(this.slotIndex) !== null;
    }

    private clickUseBtn() {
        if (this.selectedItemId !== null && pData.setShowItem(this.slotIndex, this.selectedItemId)) {
            this.onClose();
        }
    }

    private clickRemoveBtn() {
        if (pData.removeShowItem(this.slotIndex)) {
            this.onClose();
        }
    }

    private clickItem(event: EventTouch) {
        if (event.getUILocation().subtract(event.getUIStartLocation()).length() > 10) {
            return;
        }
        const previousSelect = this.selectedItemNode?.getChildByName('select');
        if (previousSelect) {
            previousSelect.active = false;
        }
        this.selectedItemNode = event.currentTarget as Node;
        this.selectedItemId = this.itemIds.get(this.selectedItemNode) ?? null;
        const selectNode = this.selectedItemNode.getChildByName('select');
        if (selectNode) {
            selectNode.active = true;
        }
        this.refreshButtons();
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIShowItem);
    }
}


