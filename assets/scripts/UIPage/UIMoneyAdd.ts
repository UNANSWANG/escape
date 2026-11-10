import { _decorator, Node, Animation, Label } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { ccStorageTools } from '../extention/storageTools';
import { commonConfig } from '../json/jsonCommon';
import { MonetaryType, SaveKey } from '../manager/configData';
import { gm, PlatType } from '../manager/gm';
import { videoMgr } from '../manager/videoManager';
const { ccclass, property } = _decorator;

@ccclass('UIMoneyAdd')
export class UIMoneyAdd extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    getBtn_0: Node;

    @property(Node)
    getBtn_1: Node;

    @property(Label)
    addNumLab: Label;

    @property(Label)
    addNumLab2: Label;

    private rewardNums: number[] = [];
    private isWatchingAd = false;
    /**忽略重复点击分享后，旧请求迟到的回调。分享接口没有失败回调，允许重新发起分享。 */
    private requestVersion = 0;

    protected onLoad(): void {
        this.rewardNums = ['adMoneyNum', 'adMoneyNum2'].map(key => {
            const num = commonConfig.getValueNumber(key);
            return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
        });
        this.addNumLab.string = `+${ccTools.formatMonetaryNum(this.rewardNums[0])}`;
        this.addNumLab2.string = `+${ccTools.formatMonetaryNum(this.rewardNums[1])}`;
        this.bindBtn();
    }

    onUI_Open() {
        const anim = this.getComponent(Animation);
        anim?.play();
        this.initData();
    }

    initData() {
        this.refreshButton(this.getBtn_0, SaveKey.moneyAddShare);
        this.refreshButton(this.getBtn_1, SaveKey.moneyAddShare2);
    }

    private refreshButton(button: Node, shareKey: SaveKey) {
        const useShare = ccStorageTools.getLimitTimeData(shareKey) !== 1;
        const icon = button.getChildByName('icon');
        const share = icon?.getChildByName('share');
        const ad = icon?.getChildByName('ad');
        if (share) share.active = useShare;
        if (ad) ad.active = !useShare;
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.getBtn_0.addComponent(zoomButton).onClick = this.clickGetBtn.bind(this, false);
        this.getBtn_1.addComponent(zoomButton).onClick = this.clickGetBtn.bind(this, true);
    }

    /**银币和金币独立计算每日首次分享，后续通过广告领取。 */
    private clickGetBtn(isGold: boolean) {
        if (this.isWatchingAd) return;
        // 点击时重新检查日期，兼容界面保持打开时跨天。
        this.initData();
        const index = isGold ? 1 : 0;
        const num = this.rewardNums[index];
        if (num <= 0) return;

        const shareKey = isGold ? SaveKey.moneyAddShare2 : SaveKey.moneyAddShare;
        const useShare = ccStorageTools.getLimitTimeData(shareKey) !== 1;
        const button = isGold ? this.getBtn_1 : this.getBtn_0;
        const startPosition = button.worldPosition.clone();
        const version = ++this.requestVersion;
        let completed = false;
        const complete = () => {
            if (completed || version !== this.requestVersion) return;
            completed = true;
            this.isWatchingAd = false;
            if (useShare) {
                if (ccStorageTools.getLimitTimeData(shareKey) === 1) return;
                ccStorageTools.setLimitTimeData(shareKey, 1);
            }
            this.initData();
            // 使用独立起点，关闭窗口后仍可从领取位置播放动画。
            const source = new Node('moneyAddRewardSource');
            source.setWorldPosition(startPosition);
            this.onClose();
            uiMgr.playMoneyAnim(source, num, isGold ? MonetaryType.gold : MonetaryType.silver);
            source.destroy();
        };

        if (useShare) {
            if (gm.platType === PlatType.h5) {
                complete();
            } else {
                gm.API.shareAppMessage(complete);
            }
        } else {
            this.isWatchingAd = true;
            videoMgr.watchVideo(68, complete, () => {
                this.isWatchingAd = false;
            });
        }
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIMoneyAdd);
    }
}
