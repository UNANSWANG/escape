import { _decorator } from 'cc';

//用户信息
export class userManager {

    /**微信插屏广告id */
    Ad_interstitialAd_wx: string = "";
    /**微信激励视频广告id */
    Ad_video_wx: string = "adunit-cf38c23824867e27";

    /**抖音插屏广告id */
    Ad_interstitialAd_tt: string = "";
    /**抖音激励视频广告id */
    Ad_video_tt: string = "35fpg95go4oppq4q8q";

    /**用户昵称 */
    nickName: string = "";
    /**用户头像url */
    avatarUrl: string = "";
    /**是否授权朋友信息 */
    isAuthFriend: boolean = false;
    /**授权码 */
    code: string = "";

    /**接口公告参数 */
    params = {
        /**后台游戏id 躺平（抖音）：9，躺平（微信）：8*/
        game_id: 8,
        /**后台账号ID*/
        uid: 0,
        /**用户openId */
        openId: "",
        /**用户token */
        token: "",
    }
}
export const userMgr = new userManager();

