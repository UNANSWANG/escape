

// import { info_videoState } from "./info_videoType";

import { gm } from "../../../manager/gm";
import { userMgr } from "../../../manager/userManager";

export enum info_videoState {
    /** 视频播放完毕 */
    Complete = 1,
    /** 视频未播放完毕 */
    Cancel = 0,
    /** 没有视频广告：各种原因，网络不好或者id配置错误 */
    NoVideo = -1,
    /** 正在播放视频 */
    InWatching = -2,
    /** 不支持视频 */
    Unsupport = -3
}


export class WxVideo {

    private isWatchingVideoAd: boolean;

    public async delpoy() {
        this.createVideoAd();
    }

    private _videoAd: any = null;
    private _interstitialAd: any = null;
    private _CustomAd: any = null;
    protected _onVideoCloseCallback: ($endCode: number) => void;

    private _interstitialAdList = {}; //key value 

    /**展示插屏的回调 */
    showInterCall = false;

    currInterIdx = 0;


    private async createVideoAd(): Promise<void> {
        try {
            if (this._videoAd) {
                this._videoAd.destroy();
            }
            console.log("创建视频", userMgr.Ad_video_wx);
            this._videoAd = window["wx"].createRewardedVideoAd({ adUnitId: userMgr.Ad_video_wx });

            this._videoAd.onLoad(() => {
                console.log("=====>视频加载成功");
            });

            this._videoAd.onError((err) => {
                console.error("=====>视频加载失败");
                if (err.errCode) {
                    console.error('广告组件失败响应码：' + err.errCode);
                }
            });

            this._videoAd.onClose(($res: { isEnded: boolean } | undefined) => {
                console.warn("=====>视频关闭", $res);
                if (typeof this._onVideoCloseCallback === 'function') {
                    this._onVideoCloseCallback($res?.isEnded ? 1 : 0);
                }
                this._onVideoCloseCallback = undefined;
                try {
                    this._videoAd.load(); // 关闭之后 load 下一条
                } catch (error) {
                    console.error("加载下一条广告失败:", error);
                }
            });
        } catch (error) {
            console.error("创建视频广告时发生错误:", error);
        }
    }


    public async WatchVideo(complete: (...arg) => void = null, noComplete: (...arg) => void = null) {
        console.log("播放微信激励视频");

        this._onVideoCloseCallback = (status: number) => {
            if (status == 1) {
                complete && complete();
                if (gm.hgSdk) {
                    gm.hgSdk.rewardedVideoCallback(true);//播放完成
                }
            } else {
                //中途退出
                if (gm.hgSdk) {
                    gm.hgSdk.rewardedVideoCallback(false);
                }
                noComplete && noComplete();
            }
        }

        try {
            this._videoAd.show().catch(err => {
                this._videoAd.load()
                    .then(() => this._videoAd.show())
                    .catch(() => {
                        //加载失败
                        if (gm.hgSdk) {
                            gm.hgSdk.rewardedVideoCallback(false);
                        }
                        noComplete && noComplete();
                    });
            });
        } catch ($err) {

        }
    }
}