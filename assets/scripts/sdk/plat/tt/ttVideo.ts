
import { gm } from "../../../manager/gm";
import { userMgr } from "../../../manager/userManager";
import { TTManager } from "./TTManager";

export class ttVideo {

    private isWatchingVideoAd: boolean;

    public async delpoy() {
        this.createVideoAd();
    }

    private _videoAd: any = null;
    protected _onVideoCloseCallback: ($endCode: number) => void;

    get TTMGR(): TTManager {
        return gm.API as TTManager;
    }

    private async createVideoAd(): Promise<unknown> {
        return new Promise<unknown>(($resolved) => {
            if (this._videoAd) {
                this._videoAd.destroy();
            }
            let adID = userMgr.Ad_video_tt;
            console.log("创建视频", adID);
            this._videoAd = window["tt"].createRewardedVideoAd({ adUnitId: adID });

            if (this._videoAd) {
                this._videoAd.onLoad(() => {
                    console.log("加载广告视频成功>>>");
                    $resolved(undefined);
                });
                this._videoAd.onError((err) => {
                    console.error("=====>视频加载失败");
                    if (err.errCode) {
                        console.error('广告组件失败响应码：' + err.errCode);
                    }
                    $resolved(undefined);
                });
                this._videoAd.onClose(($res: { isEnded: boolean } | undefined) => {
                    console.log("tt广告结束>>>>");
                    console.warn("=====>tt视频关闭", $res);
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
                this._videoAd.load();
            }
        });
    }

    public async WatchVideo(complete: (...arg) => void = null, noComplete: (...arg) => void = null) {
        console.log("播放抖音激励视频");

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