
import { ccStorageTools } from "../../../extention/storageTools";
import { GameEvent } from "../../../manager/configData";
import { gm } from "../../../manager/gm";
import { pData } from "../../../manager/playerData";
import { uiMgr } from "../../../manager/UIManager";
import { userMgr } from "../../../manager/userManager";
import { BasePlat } from "../BasePlat";
import { ttVideo } from "./ttVideo";

class Model_tt {
    /**是否领取过侧边栏奖励 */
    haveGetSlideGift: boolean = false;
    /**免看广告次数 */
    freeVideoTime: number = 0;

}
//openid: "_000TDV9mUbjJUTTXhAdRdYFC31UugDLzeRj"   uid: 492208248

export class TTManager extends BasePlat {

    public KEY: string = "ttData";
    public getInitData() {
        return new Model_tt();
    }

    PLAT = window["tt"];

    _ad: ttVideo;

    // _addToTop:

    enterGameScene: string = "";


    getLaunchOptionsSync() {
        return this.PLAT.getLaunchOptionsSync();
    }

    deploy() {
        console.log("部署抖音>>>");
        let sysInfo = this.PLAT.getSystemInfoSync();
        let info = this.PLAT.getLaunchOptionsSync();
        this.enterGameScene = info.scene;
        console.log("抖音场景值>>>：", this.enterGameScene);

        this.initVideo();

        this.PLAT.onShow(($res) => {
            this.onShow($res)
        });

        this.PLAT.onHide(() => {
            this.onHide()
        });

        this.PLAT.onRealNameAuthenticationComplete(
            () => {
                console.log("实名认证完成回调");
            }
        )
        this.initShouCang();

        this.checkUpdate();

        this.videoInit();

    }

    checkUpdate() {

        const updateManager = this.PLAT.getUpdateManager();
        updateManager.onUpdateReady((res) => {
            console.log("需要更新");
            this.PLAT.showModal({
                title: "更新提示",
                content: "新版本已经准备好，是否重启小游戏？",
                success: (res) => {
                    if (res.confirm) {
                        // 新的版本已经下载好，调用 applyUpdate 应用新版本并重启
                        updateManager.applyUpdate();
                    }
                },
            });
        });

    }


    login() {
        return new Promise(($resolve) => {
            this.PLAT.login({
                force: true,
                success(res) {
                    console.log("登录成功>>>>", res);
                    console.log(`login 调用成功${res.code} `);
                    userMgr.code = res.code;

                    window["tt"].getUserInfo({
                        success: (res) => {
                            console.log("获取用户信息成功", res);
                            if (res.realNameAuthenticationStatus == "certified") {
                                console.log("用户已实名认证");
                            } else {
                                console.log("用户未实名认证");
                                window["tt"].authenticateRealName({
                                    success: (res) => {
                                        console.log("实名认证成功", res);
                                    },
                                    fail: (res) => {
                                        console.log("实名认证失败", res);
                                    }
                                })
                            }
                        },
                        complete: (res) => {
                            console.log("获取用户信息完成", res);
                        },
                        fail: (res) => {
                            console.log("获取用户信息失败", res);
                        },
                        withCredentials: false, //是否返回敏感数据
                        withRealNameAuthenticationInfo: true, //是否返回用户实名信息
                    });
                    $resolve(res);
                },
                fail(res) {
                    console.log(`login 调用失败`);
                    $resolve(res)
                },
            });
        });
    }


    initShouCang(): void {
        this.PLAT.onFavoriteStateChange((isFavorited) => {
            if (isFavorited) {
                console.log("收藏成功");
            } else {
                console.log("收藏失败");
            }
        });

    }

    /**展示插屏 */
    showInterstitialAd(tips = "") {

    }

    public showCustomAd(tips = "", parent?, max_top = 125) {

    }

    public hideCustomAd() {

    }

    setStorage(key: string, value: any): void {
        // console.log("wx.setStorage", key, JSON.stringify(value));
        this.PLAT.setStorage({
            key: key,
            data: value,
            success: () => {
                // console.log('setStorage调用成功');
            },
            fail: (res) => {
                console.log('setStorage调用失败', res);
            },
            complete: () => {
                // console.log('setStorage触发');
            }
        });
    }

    getStorage(key: string): any {
        this.PLAT.getStorage({
            key: key,
            success: (res) => {
                console.log('getStorage调用成功', res);
                ccStorageTools.setexternalData(res.data);
                // return res.data;
            },
            fail: (res) => {
                console.log('getStorage调用失败返回{}', res);
                ccStorageTools.setexternalData({});
                // return {};
            }
        })
    }

    initVideo() {
        this._ad = new ttVideo();
        this._ad.delpoy();
    }

    /**观看广告 */
    watchVideo(complete?: (...arg: any[]) => void, noComplete?: (...arg: any[]) => void): void {
        if (userMgr.Ad_video_tt == "") {
            complete()
        }
        this.videoPause();
        this._ad.WatchVideo(complete, noComplete);
    }

    onShow($res) {
        console.log("进入onSHow", $res);

        this.enterGameScene = $res.scene;

        if (this.checkScene()) {
            console.log("需要领取侧边栏");
            gm.Event.emit(GameEvent.revisitSidebar);
        }
        this.enterGameScene = $res.scene;
    }

    /**获取用户信息 */
    getUserInfo() {
        this.PLAT.getUserInfo({
            success: (res) => {
                console.log("获取用户信息成功", res);
                if (res.realNameAuthenticationStatus == "certified") {
                    console.log("用户已实名认证");
                } else {
                    console.log("用户未实名认证");
                }
            },
            complete: (res) => {
                console.log("获取用户信息完成", res);
            },
            fail: (res) => {
                console.log("获取用户信息失败", res);
            },
            withCredentials: false, //是否返回敏感数据
            withRealNameAuthenticationInfo: true, //是否返回用户实名信息
        });
    }

    /**实名认证 */
    realNameAuth() {
        this.PLAT.authenticateRealName({
            success: (res) => {
                console.log("实名认证成功", res);
            },
            fail: (res) => {
                console.log("实名认证失败", res);
            }
        })
    }

    /**
     * 
     * 抖音：scene=021036，首页侧边栏-最近使用（常用小程序）。
抖极：scene=101036，抖极首页侧边栏。
番茄小说：scene=181036，首页侧边栏。
红果短剧：scene=261036，首页侧边栏。
     * 
     * @param $res 
     */


    /**
     * 场景值是否可以领取奖励
     * @returns 
     */
    checkCanGetGift(): boolean {
        if (this.enterGameScene == "021036" || this.enterGameScene == "101036" || this.enterGameScene == "181036" || this.enterGameScene == "261036") {
            return true;
        }
        return false;
    }

    shareAppMessage(successFuc?) {
        return new Promise<Boolean>($resolve => {
            window["tt"].shareAppMessage({
                // channel: "invite", //分享渠道
                title: "标题", //分享标题
                desc: "快来跟我一起玩吧！", //分享描述
                imageUrl: "", //分享图标
                query: "",
                success(res) {
                    successFuc && successFuc();
                    console.log("分享成功", res);
                },
                fail(e) {
                    uiMgr.showTips("分享失败");
                    console.log("分享失败");
                },
            })
        })
    }

    shareAppvideo() {
        return new Promise<Boolean>($resolve => {
            if (this._videoPath == "") {
                uiMgr.showTips("录屏失败,找不到录屏文件");
                return;
            }
            window["tt"].shareAppMessage({
                channel: "video", //分享渠道
                title: "标题", //分享标题
                desc: "快来跟我一起玩吧！", //分享描述
                imageUrl: "", //分享图标
                query: "",
                extra: {
                    videoPath: this._videoPath, // 替换成录屏得到的视频地址
                    videoTopics: ["休闲益智", "消除解压", "小游戏"],
                    withVideoId: true,
                    //   defaultBgm: "https://v.douyin.com/JmcxWo8/", //这里传入你获取的 PGC 音乐地址
                },
                success(res) {
                    console.log("分享视频成功", res);
                },
                fail(e) {
                    console.log("分享视频失败");
                    if (e["errNo"] == 21105) {
                        console.log("录屏失败：录屏时长低于 3 秒");
                        uiMgr.showTips("录屏失败：录屏时长低于 3 秒");
                    }
                },
            })
        })
    }

    _lpMgr = null;
    _videoPath: any = "";
    _startTime: number;

    /**初始化录屏 */
    videoInit() {
        this._lpMgr = window["tt"].getGameRecorderManager();
        console.log("初始化录屏", this._lpMgr);
        this._lpMgr.onStart((res) => {
            console.log("录屏开始");
            // do something;
        });
        this._lpMgr.onPause((res) => {
            console.log("录屏暂停");
            // do something;
        });
        this._lpMgr.onResume((res) => {
            console.log("录屏继续");
            // do something;
        });

        this._lpMgr.onStop((res) => {
            console.log("录屏结束>>>", res.videoPath);
            this._videoPath = res.videoPath
        });
    }

    /**录屏开始 */
    videoOpen() {
        console.log("录屏：videoOpen");
        this._startTime = Date.now();
        let self = this;
        window["tt"].getSystemInfo({
            success(res) {
                const screenWidth = res.screenWidth;
                const screenHeight = res.screenHeight;
                var maskInfo = self._lpMgr.getMark();
                var x = (screenWidth - maskInfo.markWidth) / 2;
                var y = (screenHeight - maskInfo.markHeight) / 2;

                //添加水印并且居中处理
                self._lpMgr.start({
                    duration: 300,
                    isMarkOpen: true,
                    locLeft: x,
                    locTop: y,
                });
            },
        });

    }
    /**录屏暂停 */
    videoPause() {
        console.log("录屏：videoPause");
        this._lpMgr.pause();
    }

    /**录屏继续 */
    videoResume() {
        console.log("录屏：videoResume");
        this._lpMgr.resume();
    }

    /**录屏结束 */
    videoOver() {
        console.log("录屏：videoOver");
        this._lpMgr.stop();
        let now = Date.now();
        if (now - this._startTime < 3000) {
            console.log("录屏时间不足>>>>");
            // GameMgr.showTip("录屏失败：录屏时长低于 3 秒");
            return;
        }
    }


    onHide() {

    }

    checkShortcut(): Promise<Boolean> {
        return new Promise<Boolean>(($resolve) => {
            window["tt"].checkShortcut({
                success: (res) => {
                    console.log("check scene success: ", res.status);
                    //成功回调逻辑
                    if (res["exist"]) {
                        $resolve(true);
                    }
                    else {
                        $resolve(false);
                    }
                },
                fail: (res) => {
                    $resolve(false)
                }
            });
        });
    }

    async addToDesktop(complete: (...arg) => void = null, noComplete: (...arg) => void = null) {
        let flag = await this.checkShortcut();
        if (flag) {
            uiMgr.showTips("已添加到桌面");
            return;
        }
        console.log("尝试添加到桌面>>>>");
        window["tt"].addShortcut({
            success() {
                console.log("添加桌面成功");
                if (complete) {
                    complete();
                }
            },
            fail(err) {
                console.log("添加桌面失败", err.errMsg);
                if (noComplete) {
                    noComplete();
                }
            },
        });
    }

    /**检查是否可以访问侧边栏 */
    private async checkScene(): Promise<Boolean> {
        return new Promise<Boolean>(($resolve) => {
            window["tt"].checkScene({
                scene: "sidebar",
                success: (isExist) => {
                    $resolve(true)
                },
                fail: (res) => {
                    $resolve(false)
                }
            });

        });
    }

    /**跳转到侧边栏 */
    public async navigateToScene() {
        let flag = await this.checkScene();
        if (!flag) {
            return;
        }
        window["tt"].navigateToScene({
            scene: "sidebar",
            success: (res) => {
            },
            fail: (res) => {
            },
        });
    }

    showShouCang(): void {
        window["tt"].showFavoriteGuide({
            type: "bar",
            content: "一键添加到我的小程序",
            position: "bottom",
            success(res) {
                console.log("引导组件展示成功");
            },
            fail(res) {
                console.log("引导组件展示失败");
            },
        });

    }

    /**震动 */
    vibrateShort(shortMode = 1) {
        this.PLAT.vibrateShort({
            success(res) {
                console.log(`${res}`);
            },
            fail(res) {
                console.log(`vibrateShort调用失败`);
            },
        });
    }
}