import { _decorator, Component, Node } from 'cc';
import { userMgr } from './userManager';
import { gm, PlatType } from './gm';
import { TTManager } from '../sdk/plat/tt/TTManager';
import { WXManager } from '../sdk/plat/wx/WXManager';
import { BasePlat } from '../sdk/plat/BasePlat';
import { httpMgr } from '../sdk/network/httpManager';
import { netConfig, urlConfig } from '../sdk/network/netConfig';
import { GameEvent } from './configData';
import { pData } from './playerData';
const { ccclass, property } = _decorator;

@ccclass('platformManager')
export class platformManager extends Component {
    protected onLoad(): void {
        this.initNetwork();
        this.initPlat();
    }

    /**初始化平台 */
    async initPlat() {
        if (window["tt"]) {
            //抖音
            gm.API = new TTManager();
            gm.platType = PlatType.tt;
            gm.API.deploy();
            await gm.API.login();
            console.warn("初始化抖音平台");
        } else if (window["ks"]) {
            //快手
            gm.platType = PlatType.ks;
            console.warn("初始化快手平台");
        } else if (window["wx"]) {
            //微信
            gm.API = new WXManager();
            gm.platType = PlatType.wx;
            gm.API.deploy();
            await gm.API.login();
            console.warn("初始化微信平台");
        } else {
            gm.API = new BasePlat();
            gm.platType = PlatType.h5;
            console.warn("初始化h5平台");
        }

        this.login();
    }

    /**初始化网络 */
    initNetwork() {
        //使用无加密链接
        netConfig.netBaseUrl = netConfig.baseUrlConfig.noEncryptionUrl;
    }

    /**登录 */
    login() {
        let tempType = gm.platType.toString();
        if (tempType == PlatType.h5) {
            //测试用
            tempType = "lingtao168";
            userMgr.code = "123";
        }

        //TODO 暂时不需要登录
        // gm.isLogin = true;
        // return;

        httpMgr.post(urlConfig.login, { type: tempType, code: userMgr.code }, (data) => {
            gm.isLogin = true;

            userMgr.params.openId = data.openid;
            userMgr.params.token = data.token;
            userMgr.params.uid = +data.uid || 0;
            pData.modeLevels = data.level_values || [];
            pData.level = pData.getLevelNums();
            pData.initGameData(data.gold, data.ext);

            // console.warn("------------->用户关卡数:", pData.level);

            console.log("------------->登录成功用户数据:\n", userMgr.params);
            gm.Event.emit(GameEvent.checkLoginLoad);
        });
    }
}
