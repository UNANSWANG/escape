import { _decorator, Node, Prefab, Label, Sprite, Color, instantiate } from 'cc';
import { UIBase } from './UIBase';
import { imgPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { ccResTools } from '../extention/resTools';
import { itemConfig, JsonItemData } from '../json/jsonItem';
import { QualityColorArr } from '../manager/configData';
import { pData } from '../manager/playerData';
const { ccclass, property } = _decorator;

@ccclass('UIHandBook')
export class UIHandBook extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    tabContent: Node;

    @property(Prefab)
    tabPrefab: Prefab;

    @property(Prefab)
    bookItemPrefab: Prefab;

    @property([Node])
    pageList: Node[] = [];

    /**页签名称 */
    private tabNames: string[] = ["Boss", "藏品"];
    /**页签数组 */
    private tabsArray: number[] = [0, 1];
    private selectedTabIndex = 0;
    private tabsInitialized = false;
    private collectionInitialized = false;
    private collectionItems: JsonItemData[] = [];
    private collectionNodes = new Map<number, Node>();

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        this.initData();
    }

    initData() {
        if (!this.tabsInitialized) {
            this.initTabs();
            this.tabsInitialized = true;
        }
        this.clickTabBtn(this.selectedTabIndex);
    }

    private initTabs() {
        ccTools.destroyAllChild(this.tabContent);
        this.tabsArray.forEach((tabIndex, index) => {
            const tabNode = instantiate(this.tabPrefab);
            this.tabContent.addChild(tabNode);
            const nameLab = tabNode.getChildByName("lab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = this.tabNames[tabIndex] ?? "";
            }
            const button = tabNode.getComponent(zoomButton) ?? tabNode.addComponent(zoomButton);
            button.onClick = this.clickTabBtn.bind(this, index);
        });
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
    }

    private initCollection() {
        if (this.collectionInitialized) {
            return;
        }
        const content = this.pageList[1]?.getChildByPath("ScrollView/view/content");
        if (!content || !this.bookItemPrefab) {
            return;
        }
        this.collectionItems = itemConfig.getAllData()
            .filter((itemData) => Number.isFinite(itemData?.quality));
        this.collectionInitialized = true;
        ccTools.destroyAllChild(content);
        this.collectionItems.forEach((itemData) => {
            const itemNode = instantiate(this.bookItemPrefab);
            content.addChild(itemNode);
            this.collectionNodes.set(itemData.itemId, itemNode);
            itemNode.active = true;
            const nameLab = itemNode.getChildByName("nameLab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = itemData.name;
                nameLab.color = new Color(QualityColorArr[itemData.quality] ?? "#FFFFFF");
            }
            const valueLab = itemNode.getChildByPath("moneyLayout/numLab")?.getComponent(Label);
            if (valueLab) {
                valueLab.string = ccTools.formatMonetaryNum(itemData.value);
            }
            const itemSprite = itemNode.getChildByName("img")?.getComponent(Sprite);
            if (itemSprite) {
                itemSprite.spriteFrame = null;
                ccTools.loadImg(itemSprite, imgPath.item + itemData.itemId);
            }
            const bgSprite = itemNode.getChildByName("bg")?.getComponent(Sprite);
            if (bgSprite) {
                ccResTools.loadPic(uiMgr.resBundle, imgPath.bookItemBg + itemData.quality + "/spriteFrame", (spriteFrame) => {
                    if (bgSprite.isValid && spriteFrame) {
                        bgSprite.spriteFrame = spriteFrame;
                    }
                });
            }
        });
    }

    private refreshCollection() {
        pData.unlockStorehouseCollections();
        this.initCollection();
        this.collectionItems.sort((first, second) =>
            Number(pData.isCollectionUnlocked(second.itemId)) - Number(pData.isCollectionUnlocked(first.itemId))
            || second.quality - first.quality || second.value - first.value);
        this.collectionItems.forEach((itemData, index) => {
            const itemNode = this.collectionNodes.get(itemData.itemId);
            if (!itemNode?.isValid) {
                return;
            }
            itemNode.setSiblingIndex(index);
            const mask = itemNode.getChildByName("mask");
            if (mask) {
                mask.active = !pData.isCollectionUnlocked(itemData.itemId);
            }
        });
    }

    ///
    ///点击事件
    ///

    clickTabBtn(index: number) {
        const pageIndex = this.tabsArray[index];
        if (pageIndex === undefined) {
            return;
        }
        this.selectedTabIndex = index;
        if (pageIndex === 1) {
            this.refreshCollection();
        }
        this.tabContent.children.forEach((tabNode, tabIndex) => {
            const selectNode = tabNode.getChildByName("select");
            if (selectNode) {
                selectNode.active = tabIndex === index;
            }
        });
        this.pageList.forEach((pageNode, index) => {
            if (pageNode?.isValid) {
                pageNode.active = index === pageIndex;
            }
        });
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIHandBook);
    }
}


