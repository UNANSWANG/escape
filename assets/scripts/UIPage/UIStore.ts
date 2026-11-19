import { _decorator, Node, Prefab, Label, instantiate, director, Director } from 'cc';
import { UIBase } from './UIBase';
import { ItemPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { storePageBase } from './store/storePageBase';
const { ccclass, property } = _decorator;

@ccclass('UIStore')
export class UIStore extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    tabContent: Node;

    @property(Node)
    pageContent: Node;

    @property(Prefab)
    storeTabPrefab: Prefab;

    /**页签名称 */
    private storeTabNames: string[] = ["黑市", "超武", "武器", "装备", "道具"];
    /**页签数组 */
    private storeTabsArray: number[] = [1, 2, 3];
    private pageLoadId = 0;
    private selectedTabIndex = 0;
    private tabsInitialized = false;
    private preloadVersion = 0;
    private storePages = new Map<number, Node>();
    private storePageLoads = new Map<number, Promise<Node | null>>();

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        this.preloadVersion++;
        this.initData();
    }

    initData() {
        if (!this.tabsInitialized) {
            this.initTabs();
            this.tabsInitialized = true;
        }
        const version = this.preloadVersion;
        void this.clickTabBtn(this.selectedTabIndex).then(() => this.preloadStorePages(version));
    }

    /**首屏显示后逐帧预热其余页签模板，关闭或重开后停止后续任务。 */
    private async preloadStorePages(version: number) {
        const paths = [ItemPath.storeItem, ItemPath.superWeaponItem,
            ...this.storeTabsArray.map(index => UIPath.storePage + index)];
        for (const path of paths) {
            await new Promise<void>(resolve => director.once(Director.EVENT_AFTER_DRAW, () => resolve()));
            if (!this.isValid || !this.node.activeInHierarchy || version !== this.preloadVersion) return;
            try {
                await uiMgr.preLoadPrefab(path);
            } catch (error) {
                console.warn(`商城模板预加载失败: ${path}`, error);
            }
        }
    }

    private initTabs() {
        ccTools.destroyAllChild(this.tabContent);
        this.storeTabsArray.forEach((tabIndex, index) => {
            const tabNode = instantiate(this.storeTabPrefab);
            this.tabContent.addChild(tabNode);
            const nameLab = tabNode.getChildByName("lab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = this.storeTabNames[tabIndex] ?? "";
            }
            const button = tabNode.getComponent(zoomButton) ?? tabNode.addComponent(zoomButton);
            button.onClick = this.clickTabBtn.bind(this, index);
        });
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
    }

    ///
    ///点击事件
    ///

    async clickTabBtn(index: number) {
        const storeTabIndex = this.storeTabsArray[index];
        if (storeTabIndex === undefined) {
            return;
        }
        this.selectedTabIndex = index;
        const pageLoadId = ++this.pageLoadId;
        let pageNode = this.storePages.get(storeTabIndex);
        if (!pageNode?.isValid) {
            let pageLoad = this.storePageLoads.get(storeTabIndex);
            if (!pageLoad) {
                pageLoad = this.loadStorePage(storeTabIndex);
                this.storePageLoads.set(storeTabIndex, pageLoad);
            }
            try {
                pageNode = await pageLoad;
            } catch (error) {
                console.warn('商城页签加载失败', error);
                return;
            } finally {
                this.storePageLoads.delete(storeTabIndex);
            }
        }
        if (pageLoadId !== this.pageLoadId || !this.node.isValid || !pageNode?.isValid) {
            return;
        }
        // 目标页的文字和按钮就绪后再切换，加载期间保留当前内容。
        this.storePages.forEach((cachedPage) => {
            cachedPage.active = cachedPage === pageNode;
        });
        this.tabContent.children.forEach((tabNode, tabIndex) => {
            const selectNode = tabNode.getChildByName("select");
            if (selectNode) selectNode.active = tabIndex === index;
        });
        pageNode.getComponent(storePageBase)?.refreshPage();
    }

    private async loadStorePage(storeTabIndex: number): Promise<Node | null> {
        const pagePath = UIPath.storePage + storeTabIndex;
        const pagePrefab = await uiMgr.preLoadPrefab(pagePath);
        if (!this.node.isValid || !this.pageContent.isValid) {
            return null;
        }
        if (!pagePrefab) {
            console.warn(`加载商店子界面失败: ${pagePath}`);
            return null;
        }
        const pageNode = instantiate(pagePrefab);
        pageNode.active = false;
        this.pageContent.addChild(pageNode);
        pageNode.setPosition(0, 0, 0);
        try {
            await pageNode.getComponent(storePageBase)?.initData();
        } catch (error) {
            pageNode.destroy();
            throw error;
        }
        if (!this.node.isValid || !pageNode.isValid) {
            return null;
        }
        this.storePages.set(storeTabIndex, pageNode);
        return pageNode;
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIStore);
    }

    onUI_Close() {
        this.pageLoadId++;
        this.preloadVersion++;
        this.storePages.forEach((pageNode) => {
            pageNode.active = false;
        });
    }

    protected onDestroy(): void {
        this.pageLoadId++;
        this.preloadVersion++;
        this.storePages.clear();
        this.storePageLoads.clear();
    }
}

