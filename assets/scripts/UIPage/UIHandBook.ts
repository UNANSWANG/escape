import { _decorator, Node, Prefab, Label, Sprite, Color, instantiate } from 'cc';
import { UIBase } from './UIBase';
import { imgPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { ccResTools } from '../extention/resTools';
import { itemConfig, JsonItemData } from '../json/jsonItem';
import { bossConfig } from '../json/jsonBoss';
import { weaponsConfig } from '../json/jsonWeapons';
import { BossBookState, QualityColorArr } from '../manager/configData';
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

    @property(Prefab)
    bookBossItemPrefab: Prefab;

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

    private refreshBoss() {
        const content = this.pageList[0]?.getChildByPath("ScrollView/view/content");
        if (!content || !this.bookBossItemPrefab) {
            return;
        }
        ccTools.destroyAllChild(content);
        bossConfig.getAllData().forEach((bossData) => {
            const itemNode = instantiate(this.bookBossItemPrefab);
            content.addChild(itemNode);
            itemNode.active = true;
            const state = pData.getBossBookState(bossData.id);
            const isLocked = state === BossBookState.Locked;
            const isDefeated = state === BossBookState.Defeated;
            const img = itemNode.getChildByName("img");
            if (img) {
                img.active = !isLocked;
                const sprite = img.getComponent(Sprite);
                if (sprite) {
                    sprite.grayscale = isDefeated;
                }
            }
            const bossMask = itemNode.getChildByName("bossMask");
            if (bossMask) {
                bossMask.active = isLocked;
            }
            const lock = itemNode.getChildByName("lock");
            if (lock) {
                lock.active = isLocked;
            }
            const beat = itemNode.getChildByName("beat");
            if (beat) {
                beat.active = isDefeated;
            }
            const nameLab = itemNode.getChildByName("nameLab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = bossData.name;
            }
            const descLab = itemNode.getChildByName("descLab")?.getComponent(Label);
            if (descLab) {
                descLab.string = bossData.desc;
            }
            const itemNameLab = itemNode.getChildByName("itemNameLab")?.getComponent(Label);
            if (itemNameLab) {
                itemNameLab.string = weaponsConfig.getDataByItemId(bossData.dropItemId)?.name
                    ?? itemConfig.getDataByItemId(bossData.dropItemId)?.name ?? "";
            }
        });
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
                mask.active = false;
            }
            const itemSprite = itemNode.getChildByName("img")?.getComponent(Sprite);
            if (itemSprite) {
                const imagePath = pData.isCollectionUnlocked(itemData.itemId)
                    ? imgPath.item + itemData.itemId
                    : imgPath.unItem;
                ccTools.loadImg(itemSprite, imagePath);
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
        if (pageIndex === 0) {
            this.refreshBoss();
        } else if (pageIndex === 1) {
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


