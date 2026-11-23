import { _decorator, Node, Animation, Prefab, instantiate, Layout, ScrollView } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { gm } from '../manager/gm';
import { GameEvent} from '../manager/configData';
import { pData } from '../manager/playerData';
import { ccTools } from '../extention/generalTools';
import { rewardItem } from '../controller/rewardItem';
import { weaponsConfig } from '../json/jsonWeapons';
import { equipmentConfig } from '../json/jsonEquipment';
import { ccStorageTools } from '../extention/storageTools';
const { ccclass, property } = _decorator;

@ccclass('UIReward')
export class UIReward extends UIBase {
    @property(Node)
    rewardNode: Node;

    @property(Node)
    getBtn: Node;

    @property(Prefab)
    rewardItemPre: Prefab;

    /**奖励数据 0:奖励id 1:奖励数量 */
    rewardData: number[][] = [];
    private canEquipRewards = false;
    private closedCallback: (() => void) = null;
    private closing = false;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(data?: { rewardData: number[][]; showGetBtn?: boolean; onClose?: () => void }) {
        this.closing = false;
        this.closedCallback = data?.onClose;
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData(data);
    }

    initData(data?: { rewardData: number[][]; showGetBtn?: boolean }) {
        this.rewardData = (data?.rewardData || []).map(item => item.slice());
        this.canEquipRewards = data?.showGetBtn === true;
        this.getBtn.active = this.canEquipRewards;

        this.applyRewards();
        this.showReward();
    }

    /**领取并持久化当前奖励 */
    private applyRewards() {
        pData.applyRewards(this.rewardData);
    }

    bindBtn() {
        this.node.getChildByName("mask").on(Node.EventType.TOUCH_END, this.clickCloseBtn.bind(this));
        const button = this.getBtn.getComponent(zoomButton) || this.getBtn.addComponent(zoomButton);
        button.onClick = this.clickGetBtn.bind(this);
    }

    /**显示奖励（不刷新数据） */
    showReward() {
        const layout = this.rewardNode.getComponent(Layout);
        if (layout) {
            layout.enabled = true;
        }
        ccTools.destroyAllChild(this.rewardNode);
        for (let i = 0; i < this.rewardData.length; i++) {
            let item = this.rewardData[i];
            let itemNode = instantiate(this.rewardItemPre);
            this.rewardNode.addChild(itemNode);
            itemNode.getComponent(rewardItem).initData(item);
        }

        if (layout) {
            layout.updateLayout();
            if (this.rewardData.length === 1) {
                const itemNode = this.rewardNode.children[0];
                if (itemNode) {
                    itemNode.setPosition(0, itemNode.position.y, itemNode.position.z);
                }
                layout.enabled = false;
            }
        }

        // 奖励列表布局完成后，停止上次滚动并立即回到顶部。
        const scrollView = this.node.getComponentInChildren(ScrollView);
        if (scrollView) {
            scrollView.stopAutoScroll();
            scrollView.scrollToTop(0);
        }
    }

    /**刷新数据 */
    refreshData() {
        gm.Event.emit(GameEvent.refreshProps);
    }

    ///
    ///点击事件
    ///

    /**按奖励顺序穿戴，每个槽位只取一件，其余已领取奖励留在仓库。 */
    clickGetBtn() {
        if (!this.canEquipRewards) return;
        this.canEquipRewards = false;
        this.getBtn.active = false;
        const usedSlots = new Set<number>();
        const available = new Map(pData.getStorehouseData().map(([itemId, num]) => [itemId, num] as [number, number]));
        const changes: number[][] = [];
        ccStorageTools.batch(() => {
            for (const [itemId, num] of this.rewardData) {
                if (!Number.isInteger(num) || num <= 0) continue;
                const weapon = weaponsConfig.getDataByItemId(itemId);
                const equipment = weapon ? null : equipmentConfig.getDataByItemId(itemId);
                const slots = weapon ? (weapon.type === 0 ? [2] : [0, 1])
                    : equipment && [0, 1, 2].includes(equipment.type) ? [equipment.type + 3] : [];
                let remaining = Math.min(num, available.get(itemId) || 0);
                for (const slot of slots) {
                    if (remaining <= 0) break;
                    if (usedSlots.has(slot)) continue;
                    const oldItemId = pData.equipmentIds[slot];
                    if (oldItemId !== itemId && !pData.setEquipmentId(slot, itemId)) continue;
                    usedSlots.add(slot);
                    remaining--;
                    available.set(itemId, (available.get(itemId) || 0) - 1);
                    changes.push([itemId, -1]);
                    if (oldItemId >= 0 && oldItemId !== pData.getDefaultEquipmentId(slot)) {
                        changes.push([oldItemId, 1]);
                    }
                }
            }
            pData.fixStorehouseDatas(changes);
        });
        this.onClose();
    }

    /**点击关闭 */
    clickCloseBtn() {
        if (this.canEquipRewards) return;
        this.onClose();
    }

    onClose() {
        if (this.closing) return;
        this.closing = true;
        const callback = this.closedCallback;
        this.closedCallback = null;
        this.refreshData();
        gm.Event.emit(GameEvent.closeRewardPage);
        uiMgr.closePage(UIPath.UIReward);
        callback?.();
    }
}


