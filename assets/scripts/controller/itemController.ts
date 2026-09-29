import { _decorator, Component, Label, Node, Sprite, tween, Tween } from 'cc';
import { ccTools } from '../extention/generalTools';
import { getItemDataByItemId } from '../json/jsonItemData';
import { itemConfig, JsonItemData } from '../json/jsonItem';
import { imgPath } from '../manager/pathConfig';
const { ccclass } = _decorator;

@ccclass('itemController')
export class itemController extends Component {
    /** 当前物品的 itemId。 */
    itemId = 0;
    /** 物品正常展示节点。 */
    private normalNode: Node = null;
    /** 物品遮罩节点。 */
    private maskNode: Node = null;
    /** 物品品质背景。 */
    private bgSp: Sprite = null;
    /** 遮罩中的加载圆环节点。 */
    private circleNode: Node = null;

    protected onLoad(): void {
        this.initNodes();
    }

    /** 初始化物品显示。 */
    initData(itemId: number, num = 1) {
        this.initNodes();
        this.itemId = itemId;
        this.showNormal();
        const quality = itemConfig.getDataByItemId(itemId)?.quality ?? 4;
        ccTools.loadImg(this.bgSp, imgPath.itemBg + quality);

        const itemData = getItemDataByItemId(itemId) as JsonItemData;
        if (!itemData) {
            console.warn(`未找到物品配置，itemId: ${itemId}`);
            return;
        }

        this.setLabel("nameLab", itemData.name ?? "");
        this.setLabel("capacityLab", `${itemData.capacity ?? 0}`);
        this.setLabel("valueLab", ccTools.formatMonetaryNum(itemData.value ?? 0));
        const itemNum = Number.isFinite(num) ? Math.max(1, Math.floor(num)) : 1;
        this.setLabel("numLab", `x${itemNum}`);
    }

    /** 设置物品预制体内的标签。 */
    private setLabel(nodeName: string, content: string) {
        const label = this.normalNode?.getChildByName(nodeName)?.getComponent(Label);
        if (label) {
            label.string = content;
        }
    }

    /** 缓存物品预制体中的展示节点。 */
    private initNodes() {
        this.normalNode = this.node.getChildByName("normal");
        this.maskNode = this.node.getChildByName("mask");
        this.bgSp = this.normalNode.getChildByName("bg").getComponent(Sprite);
        this.circleNode = this.maskNode.getChildByName("circle");
    }

    /** 显示物品的正常信息。 */
    showNormal() {
        this.stopMaskLoading();
        this.normalNode.active = true;
        this.maskNode.active = false;
        this.circleNode.active = false;
    }

    /** 显示物品遮罩，并将加载圆环复位。 */
    showMask() {
        this.stopMaskLoading();
        this.normalNode.active = false;
        this.maskNode.active = true;
        this.circleNode.active = false;
        this.circleNode.angle = 0;
    }

    /** 播放遮罩加载动画，完成后显示物品信息。 */
    playMaskLoading(duration: number, circleCount: number, onComplete: () => void) {
        this.showMask();
        this.circleNode.active = true;
        tween(this.circleNode)
            .by(duration, { angle: -360 * circleCount })
            .call(() => {
                this.showNormal();
                onComplete?.();
            })
            .start();
    }

    /** 停止遮罩加载动画。 */
    stopMaskLoading() {
        if (this.circleNode) {
            Tween.stopAllByTarget(this.circleNode);
        }
    }
}
