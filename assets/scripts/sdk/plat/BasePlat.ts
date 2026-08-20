import { HTML5 } from 'cc/env';

export class BasePlat {
    _ad;
    /**分享成功回调 */
    shareSuccess: Function = null;
    /**是否分享 */
    isShare: boolean = false;
    /**分享失败次数 */
    shareFailCount: number = 0;
    /**上次分享时间 */
    lastShareTime: number = 0;
    /**开放数据域 */
    openDataContext = null;
    /**是否已经授权 */
    isAuthorize = false;

    PLAT: any;
    deploy(): void {

    }

    watchVideo(complete?: (...arg: any[]) => void, noComplete?: (...arg: any[]) => void): void {
    }

    /**展示插屏 */
    showInterstitialAd(tips = "") {
    }

    public showCustomAd(tips = "", parent?, max_top = 125) {
    }

    public hideCustomAd() {
    }

    login(): any {

    }

    shareAppMessage(successFuc?) {
        if (HTML5) {
            successFuc && successFuc();
        }
    }

    /**获取数据 */
    getStorage(key: string) {
        if (HTML5) {
            JSON.parse(localStorage.getItem(key) || "{}");
        }
    }

    /**设置数据 */
    setStorage(key: string, value: any) {
        if (HTML5) {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }

    /**设置用户云存储 */
    setUserCloudStorage(data: any, successFuc?: Function, failFuc?: Function) {

    }

    /**向开放数据域发送信息 */
    sendMessage(str: any) {

    }

    /**获取好友排行榜 */
    getFriendRank() {

    }

    /**用户授权 */
    requirePrivacyAuthorize(success?, fail?) {

    }

    /**刷新设置信息 */
    refreshSetting(call?) {

    }

    /**打开设置界面 */
    openSetting(call?) {

    }

    /**震动 */
    vibrateShort(shortMode = 1) {
        if (HTML5) {
            console.log("震动");
        }
    }
}