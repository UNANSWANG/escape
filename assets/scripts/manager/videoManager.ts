import { _decorator, Component, Node } from 'cc';
import { gm, PlatType } from './gm';
import { pData } from './playerData';
import { gmConfig } from './configData';
const { ccclass, property } = _decorator;

@ccclass('videoManager')
export class videoManager {
    /**当前的广告场景 */
    currentAdScene: number = 68;

    /**观看广告
     * @param adScene 广告场景，参考sdk文档
     */
    watchVideo(adType = 68, complete?: (...arg: any[]) => void, noComplete?: (...arg: any[]) => void): void {
        let adCall = () => {
            gm.gameResume();
            pData.adNum++;
            this.SDKAdPlayComplete();
            complete && complete();
        }

        let noAdCall = (...args: any[]) => {
            gm.gameResume();
            noComplete && noComplete(...args);
        }

        if (gm.platType != PlatType.h5 && !gmConfig.isFreeAd) {
            this.currentAdScene = adType;
            this.SDKAdClick();
            gm.gamePause();
            gm.API.watchVideo(adCall, noAdCall);
        } else {
            console.log("没有广告平台,直接返回成功");
            adCall();
        }
    }

    /**广告点展示（界面） */
    SDKAdShow(adScene: number = 68) {
        if (gm.hgSdk) {
            gm.hgSdk.track('AD_PLACEMENT_SHOW', {
                ad_placement_name: adScene
            });
        }
    }

    /**广告位点击 */
    SDKAdClick() {
        if (gm.hgSdk) {
            gm.hgSdk.track('AD_CLICK', {
                ad_placement_name: this.currentAdScene
            });
        }
    }

    /**广告位播放完成 */
    SDKAdPlayComplete() {
        if (gm.hgSdk) {
            gm.hgSdk.track('AD_VIDEO_FINISH', {
                ad_placement_name: this.currentAdScene
            });
        }
    }
}
export let videoMgr = new videoManager();
