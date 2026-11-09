import { _decorator, Node, Animation, Label, Sprite } from 'cc';
import { UIBase } from './UIBase';
import { imgPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { ccStorageTools } from '../extention/storageTools';
import { SaveKey } from '../manager/configData';
import { JsonSignData, signConfig } from '../json/jsonSign';
import { getItemDataByItemId } from '../json/jsonItemData';
import { videoMgr } from '../manager/videoManager';
const { ccclass, property } = _decorator;

@ccclass('UISign')
export class UISign extends UIBase {
    private static readonly WEEK_DAYS = 7;

    @property(Node)
    closeBtn: Node;

    @property(Node)
    getBtn: Node;

    @property(Node)
    adBtn: Node;

    @property([Node])
    itemList: Node[] = [];

    /**当前展示的一周签到奖励 */
    private currentWeekRewards: JsonSignData[] = [];
    /**累计签到天数 */
    private signDays = 0;
    /**今日是否已签到 */
    private isGetToday = false;
    /**当前可领取或今日已领取的奖励下标 */
    private currentDayIndex = 0;
    /**是否正在观看签到奖励广告 */
    private isWatchingAd = false;

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open() {
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData();
    }

    initData() {
        this.signDays = Math.max(0, ccStorageTools.getNumberData(SaveKey.signDays));
        this.isGetToday = ccStorageTools.getLimitTimeData(SaveKey.isGetSign) === 1;

        const types = signConfig.getTypes();
        if (types.length === 0) {
            console.warn("签到表数据未加载");
            return;
        }

        // 已签到时仍展示当前这一周；未签到时展示下一次可领取所在周。
        const displayDays = this.isGetToday ? Math.max(0, this.signDays - 1) : this.signDays;
        // 到达最后一个类型后，继续循环该类型的 7 天奖励。
        const typeIndex = Math.min(Math.floor(displayDays / UISign.WEEK_DAYS), types.length - 1);
        this.currentWeekRewards = signConfig.getDataByType(types[typeIndex]);
        this.currentDayIndex = this.isGetToday
            ? Math.max(0, (this.signDays - 1) % UISign.WEEK_DAYS)
            : this.signDays % UISign.WEEK_DAYS;

        this.refreshItemList();
        const canReceive = !this.isGetToday && !!this.currentWeekRewards[this.currentDayIndex];
        this.getBtn.active = canReceive;
        this.adBtn.active = canReceive;
    }

    /**刷新七天奖励展示与领取状态 */
    private refreshItemList() {
        for (let index = 0; index < this.itemList.length; index++) {
            const itemNode = this.itemList[index];
            const reward = this.currentWeekRewards[index];
            const dayLab = itemNode.getChildByName("dayLab")?.getComponent(Label);
            const desLab = itemNode.getChildByName("desLab")?.getComponent(Label);
            const img = itemNode.getChildByName("img")?.getComponent(Sprite);
            const mask = itemNode.getChildByName("mask");
            const select = itemNode.getChildByName("select");

            if (dayLab) {
                dayLab.string = `第${ccTools.getChineseNum(index + 1)}天`;
            }

            const rewardData = this.parseReward(reward);
            if (img) {
                ccTools.cancelAssetLoad(img);
                img.spriteFrame = null;
            }
            if (rewardData) {
                const [itemId, num] = rewardData;
                if (desLab) {
                    const itemName = getItemDataByItemId(itemId)?.name || `${itemId}`;
                    desLab.string = `${itemName}x${num}`;
                }
                if (img) {
                    const isWeapon = Number.isInteger(itemId) && itemId >= 0 && itemId <= 100000;
                    img.node.angle = isWeapon ? -35 : 0;
                    const iconPath = itemId === 200001 ? imgPath.money
                        : itemId === 200002 ? imgPath.gold : ccTools.getItemIconPath(itemId);
                    ccTools.loadImg(img, iconPath);
                }
            }

            const isReceived = this.isGetToday
                ? index <= this.currentDayIndex
                : index < this.currentDayIndex;
            if (mask) {
                mask.active = isReceived;
            }
            if (select) {
                select.active = !this.isGetToday && index === this.currentDayIndex;
            }
        }
    }

    /**解析签到表中的奖励字段 */
    private parseReward(signData: JsonSignData): number[] | null {
        if (!signData?.reward) {
            return null;
        }

        try {
            const reward = JSON.parse(signData.reward);
            if (Array.isArray(reward) && reward.length >= 2
                && Number.isFinite(reward[0]) && Number.isFinite(reward[1])) {
                return [reward[0], reward[1]];
            }
        } catch (error) {
            console.warn(`签到奖励数据格式错误，id: ${signData.id}`, error);
        }
        return null;
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        this.getBtn.addComponent(zoomButton).onClick = this.clickGetBtn.bind(this);
        this.adBtn.addComponent(zoomButton).onClick = this.clickAdBtn.bind(this);
    }

    ///
    ///点击事件
    ///
    /**点击普通领取 */
    clickGetBtn() {
        if (this.isWatchingAd) {
            return;
        }
        this.receiveReward(1);
    }

    /**领取签到奖励，倍率仅影响数量，签到天数只增加一天 */
    private receiveReward(multiplier: number) {
        if (this.isGetToday) {
            return;
        }

        const rewardData = this.parseReward(this.currentWeekRewards[this.currentDayIndex]);
        if (!rewardData) {
            return;
        }

        this.isGetToday = true;
        ccStorageTools.setData(SaveKey.signDays, this.signDays + 1);
        ccStorageTools.setLimitTimeData(SaveKey.isGetSign, 1);
        this.getBtn.active = false;
        this.adBtn.active = false;
        this.onClose();
        const [itemId, num] = rewardData;
        uiMgr.openPage(UIPath.UIReward, { rewardData: [[itemId, num * multiplier]] });
    }

    /**广告播放完成后领取三倍奖励 */
    clickAdBtn() {
        if (this.isGetToday || this.isWatchingAd
            || !this.parseReward(this.currentWeekRewards[this.currentDayIndex])) {
            return;
        }

        this.isWatchingAd = true;
        videoMgr.watchVideo(68, () => {
            this.isWatchingAd = false;
            this.receiveReward(3);
        }, () => {
            this.isWatchingAd = false;
        });
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UISign);
    }
}



