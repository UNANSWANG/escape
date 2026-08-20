import { ccStorageTools } from "../../../extention/storageTools";
import { ccTimeTools } from "../../../extention/timeTools";
import { gm } from "../../../manager/gm";
import { uiMgr } from "../../../manager/UIManager";
import { userMgr } from "../../../manager/userManager";
import { httpMgr } from "../../network/httpManager";
import { urlConfig } from "../../network/netConfig";
import { BasePlat } from "../BasePlat";
import { WxVideo } from "./WxVideo";

class Model_wx {
    /**免看广告次数 */
    freeVideoTime: number = 0;
}

export class WXManager extends BasePlat {

    public KEY: string = "wxData";
    public getInitData() {
        return new Model_wx();
    }

    PLAT = window["wx"];

    _ad: WxVideo;

    // _addToTop:

    enterGameScene: string = "";

    _videoPath: any = "";

    _startTime: number;

    _lpMgr = null;

    /**分享图片的id */
    shareImgIdArr = [];
    /**分享图片的url */
    shareImgUrlArr = [];
    /**登录的订阅数据 */
    subscribeData = {};
    /**分享文案 */
    shareTextArr = [];


    getLaunchOptionsSync() {
        return this.PLAT.getLaunchOptionsSync();
    }

    deploy() {
        console.log("部署微信>>>");
        let info = this.PLAT.getLaunchOptionsSync();
        this.enterGameScene = info.scene;
        // let sysInfo = this.PLAT.getSystemInfoSync();

        // console.warn("===========>启动信息", info);

        this.checkUpdate();
        this.initOpenDataContextListener();

        this.initConf();
        this.initVideo();
    }

    /**检查版本更新 */
    checkUpdate() {
        const updateManager = window["wx"].getUpdateManager();

        updateManager.onCheckForUpdate(function (res) {
            // 请求完新版本信息的回调
            console.warn("是否有新版本:", res.hasUpdate)
        })

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
                }
            })
        })
        updateManager.onUpdateFailed(function () {
            // 新版本下载失败
            console.error("新版本下载失败");
        })
    }

    login(): Promise<Model_wx> {
        let self = this;
        return new Promise(($resolve) => {
            self.PLAT.login({
                success(res) {
                    console.log("登录成功>>>>", res);
                    console.log(`login 调用成功${res.code} `);
                    userMgr.code = res.code;

                    self.PLAT.getSetting({
                        success(res) {
                            console.log("初始化设置信息", res);
                            //用户信息授权
                            if (res.authSetting['scope.userInfo']) {
                                // 已经授权，可以直接调用 getUserInfo 获取头像昵称
                                self.PLAT.getUserInfo({
                                    success: function (res) {
                                        var userInfo = res.userInfo
                                        console.log("用户信息", userInfo);
                                        var nickName = userInfo.nickName;
                                        var avatarUrl = userInfo.avatarUrl;
                                        userMgr.nickName = nickName;
                                        userMgr.avatarUrl = avatarUrl;
                                    },
                                    fail(err) {
                                        console.log(`getUserInfo 调用失败`, err);
                                    },
                                })
                            }
                            //朋友信息授权
                            if (res.authSetting['scope.WxFriendInteraction']) {
                                userMgr.isAuthFriend = true;
                            }
                        }
                    })

                    self.PLAT.getPrivacySetting({
                        withSubscriptions: true,
                        success(res) {
                            console.log("---------------------------->授权数据", res);
                            self.isAuthorize = !res.needAuthorization;
                        }
                    })

                    $resolve(res);
                },
                fail(res) {
                    console.log(`login 调用失败`);
                    $resolve(res)
                },
            });
        });
    }

    /**初始化配置 */
    initConf() {
        //初始化广告id
    }

    /**初始化分享菜单 */
    initShareMenu() {
        window["wx"].showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
        })
        let shareData = this.getRandomShareImg();
        let shareText = this.getRandomShareText();
        window["wx"].onShareAppMessage(() => {
            return {
                title: shareText,
                imageUrl: shareData[1], //分享图标
                imageUrlId: shareData[0], //分享图标
            }
        })
    }

    /**初始化录屏 */
    videoInit() {
        this._lpMgr = window["wx"].getGameRecorderManager();
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
        window["wx"].getSystemInfo({
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

    /**展示插屏 */
    showInterstitialAd(tips = "") {

    }

    public showCustomAd(tips = "", parent?, max_top = 125) {

    }

    public hideCustomAd() {

    }

    /**震动 */
    vibrateShort(shortMode = 1) {
        let shortType = "";
        switch (shortMode) {
            case 0:
                shortType = "light";
                break;
            case 1:
                shortType = "medium";
                break;
            case 2:
                shortType = "heavy";
                break;
            default:
                shortType = "medium";
                break;
        }
        this.PLAT.vibrateShort({
            type: shortType
        });
    }

    /**获取用户信息 */
    getUserProfile(success?, fail?) {
        this.PLAT.getUserProfile({

            desc: '用于显示玩家信息',

            success(res) {

                console.log(res);

                console.log("获取用户信息", res.userInfo);
                userMgr.nickName = res.userInfo.nickName;
                userMgr.avatarUrl = res.userInfo.avatarUrl;

                success && success();
            },

            fail(err) {
                console.log(err);
                fail && fail();
            }
        });
    }

    /**用户授权 */
    requirePrivacyAuthorize(success?, fail?) {
        this.PLAT.requirePrivacyAuthorize({
            success: () => {
                // 用户同意授权
                this.isAuthorize = true;

                success && success();
            },
            fail: () => {
                fail && fail();
            }, // 用户拒绝授权
            complete: () => { }
        })

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
        this._ad = new WxVideo();
        this._ad.delpoy();
    }

    /**获取机型 os */
    getSystemInfoSync() {
        return this.PLAT.getSystemInfoSync();
    }

    /**广告券免费一次 */
    watchVideo(complete?: (...arg: any[]) => void, noComplete?: (...arg: any[]) => void): void {
        if (userMgr.Ad_video_wx == "") {
            complete()
        }
        this._ad.WatchVideo(complete, noComplete);
    }

    shareAppMessage(successFuc?) {
        this.shareSuccess = null;
        if (successFuc) {
            this.shareSuccess = successFuc;
            this.isShare = true;
            this.lastShareTime = ccTimeTools.getTime();
        }
        if (gm.hgSdk) {
            gm.hgSdk.share({
            })
        } else {
            let shareData = this.getRandomShareImg();
            let shareText = this.getRandomShareText();
            return new Promise<Boolean>($resolve => {
                window["wx"].shareAppMessage({
                    // channel: "invite", //分享渠道
                    title: shareText, //分享标题
                    desc: "快来跟我一起玩吧！", //分享描述
                    imageUrl: shareData[1], //分享图标
                    imageUrlId: shareData[0], //分享图标
                    // success(res) {
                    //     console.log("分享成功", res);
                    //     success && success();
                    // },
                    // fail(e) {
                    //     console.log("分享失败");
                    //     fail && fail();
                    // },
                })
            })
        }
    }

    shareAppvideo() {
        return new Promise<Boolean>($resolve => {
            if (this._videoPath == "") {
                uiMgr.showTips("录屏失败,找不到录屏文件");
                return;
            }
            window["wx"].shareAppMessage({
                channel: "video", //分享渠道
                title: "游戏分享", //分享标题
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

    /**刷新设置信息 */
    refreshSetting(call?) {
        let self = this;
        self.PLAT.getSetting({
            success(res) {
                console.log("刷新设置信息", res);
                //朋友信息授权
                if (res.authSetting['scope.WxFriendInteraction']) {
                    userMgr.isAuthFriend = true;
                }
                //完成回调
                call && call();
            }
        })
    }

    /**打开设置界面 */
    openSetting(call?) {
        let self = this;
        this.PLAT.openSetting({
            success() {
                self.refreshSetting(call);
            }
        })
    }

    /**初始化开放数据域域监听 */
    initOpenDataContextListener() {
        this.openDataContext = this.PLAT.getOpenDataContext();
    }

    /**向开放数据域发送信息 */
    sendMessage(str: any) {
        this.openDataContext.postMessage({
            event: str,
            openId: userMgr.params.openId
        })
    }

    /**获取好友排行榜 */
    getFriendRank() {
        if (!this.openDataContext) {
            console.warn("获取好友排行榜失败,未初始化开放数据域");
            return;
        }
        this.sendMessage("getFriendRank");
    }

    /**设置用户云存储 */
    setUserCloudStorage(data: any, successFuc?: Function, failFuc?: Function): void {
        this.PLAT.setUserCloudStorage({
            KVDataList: data,
            success: () => {
                console.log('成功上传游戏分数到云端');
                successFuc && successFuc();
            },
            fail: (err) => {
                console.error('上传游戏分数到云端失败:', err);
                failFuc && failFuc();
            }
        });
    }

    getRandomShareImg() {
        if (this.shareImgIdArr.length == 0) {
            return ["", ""];
        }

        let randomIdx = Math.floor(Math.random() * this.shareImgIdArr.length);
        return [this.shareImgIdArr[randomIdx], this.shareImgUrlArr[randomIdx]];
    }

    getRandomShareText() {
        if (this.shareTextArr.length == 0) {
            return "";
        }

        let randomIdx = Math.floor(Math.random() * this.shareTextArr.length);
        return this.shareTextArr[randomIdx];
    }

    onHide() {
        // ProjMgr.ykmgr.event(def_yk.gameTime);
    }

    onShow($res) {
        console.log("进入onSHow");


    }

}

