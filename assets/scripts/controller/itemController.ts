import { _decorator, Component, Label, Node, Sprite, tween, Tween } from 'cc';
import { ccTools } from '../extention/generalTools';
import { getItemDataByItemId } from '../json/jsonItemData';
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
    /** 物品图片。 */
    private itemImgSp: Sprite = null;
    /** 遮罩中的搜索图标，沿圆周移动时保持朝向。 */
    private searchNode: Node = null;
    private readonly searchRadius = 8;
    private readonly searchProgress = { turns: 0 };

    protected onLoad(): void {
        this.initNodes();
    }

    /** 初始化物品显示。 */
    initData(itemId: number, num = 1) {
        this.initNodes();
        this.itemId = itemId;
        this.showNormal();
        const itemData = getItemDataByItemId(itemId);
        const quality = itemData?.quality ?? 4;
        ccTools.loadImg(this.bgSp, imgPath.itemBg + quality);
        if (this.itemImgSp) {
            const isWeapon = Number.isInteger(itemId) && itemId >= 0 && itemId <= 100000;
            this.itemImgSp.node.angle = isWeapon ? -35 : 0;
            ccTools.cancelAssetLoad(this.itemImgSp);
            this.itemImgSp.spriteFrame = null;
            ccTools.loadImg(this.itemImgSp, ccTools.getItemIconPath(itemId));
        }

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
        this.itemImgSp = this.normalNode.getChildByName("itemImg")?.getComponent(Sprite) ?? null;
        this.searchNode = this.maskNode.getChildByName("search");
    }

    /** 显示物品的正常信息。 */
    showNormal() {
        this.stopMaskLoading();
        this.normalNode.active = true;
        this.maskNode.active = false;
        this.searchNode.active = false;
    }

    /** 显示物品遮罩，并将搜索图标复位到圆周起点。 */
    showMask() {
        this.stopMaskLoading();
        this.normalNode.active = false;
        this.maskNode.active = true;
        this.searchNode.active = false;
        this.searchProgress.turns = 0;
        this.updateSearchPosition();
    }

    private updateSearchPosition() {
        const radians = -Math.PI * 2 * this.searchProgress.turns;
        this.searchNode.setPosition(
            Math.cos(radians) * this.searchRadius,
            Math.sin(radians) * this.searchRadius,
            this.searchNode.position.z,
        );
    }

    /** 播放遮罩加载动画，完成后显示物品信息。 */
    playMaskLoading(duration: number, circleCount: number, onComplete: () => void) {
        this.showMask();
        this.searchNode.active = true;
        tween(this.searchProgress)
            .to(duration, { turns: circleCount }, {
                easing: 'linear',
                onUpdate: () => this.updateSearchPosition(),
            })
            .call(() => {
                this.showNormal();
                onComplete?.();
            })
            .start();
    }

    /** 停止遮罩加载动画。 */
    stopMaskLoading() {
        Tween.stopAllByTarget(this.searchProgress);
    }

    protected onDisable(): void {
        this.stopMaskLoading();
    }
}
