import { _decorator, Node, Animation, instantiate, UITransform } from 'cc';
import { UIBase } from './UIBase';
import { ItemPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { pData } from '../manager/playerData';
import { ccResTools } from '../extention/resTools';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('UISmallMap')
export class UISmallMap extends UIBase {
    @property(Node)
    mapBg: Node;

    @property(Node)
    mapParent: Node;

    private mapLoadVersion = 0;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData();
    }

    /**加载当前地图的小地图，并让背景宽高各增加 20。 */
    async initData() {
        const version = ++this.mapLoadVersion;
        ccTools.destroyAllChild(this.mapParent);
        const mapIdx = pData.selectMapData[0];
        const path = ItemPath.smallMap + mapIdx;
        const prefab = await ccResTools.loadPrefab(uiMgr.resBundle, path);
        if (!this.node.isValid || version !== this.mapLoadVersion || !this.node.activeInHierarchy) return;
        if (!prefab) {
            console.warn('加载小地图预制体失败', path);
            return;
        }
        const map = instantiate(prefab);
        const mapTransform = map.getComponent(UITransform);
        if (!mapTransform) {
            map.destroy();
            console.warn('小地图预制体缺少 UITransform', path);
            return;
        }
        this.mapParent.addChild(map);
        map.setPosition(0, 0, 0);
        this.mapBg.getComponent(UITransform).setContentSize(mapTransform.width + 20, mapTransform.height + 20);
    }

    onUI_Close() {
        ++this.mapLoadVersion;
    }

    bindBtn() {
        this.node.getChildByName('mask').on(Node.EventType.TOUCH_END, this.clickCloseBtn, this);
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UISmallMap);
    }
}

