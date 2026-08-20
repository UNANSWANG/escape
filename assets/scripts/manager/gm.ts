import { _decorator, Component, director, game, Node, EventTarget, Game } from 'cc';
import { audioMgr } from './audioManager';
import { ccStorageTools } from '../extention/storageTools';
import { BasePlat } from '../sdk/plat/BasePlat';
import { ccTimeTools } from '../extention/timeTools';
import { GameEvent } from './configData';
import { pData } from './playerData';
import { uiMgr } from './UIManager';
const { ccclass, property } = _decorator;

export enum PlatType {
    /**网页h5 */
    h5 = "h5",
    /**抖音 */
    tt = "tt",
    /**微信 */
    wx = "wx",
    /**快手 */
    ks = "ks",
}
@ccclass('gm')
export class gm extends Component {
    static API: BasePlat = null;
    static hgSdk: any = null;
    static platType: PlatType = PlatType.h5;
    /**是否是调试模式 */
    static isDebug: boolean = true;
    /**是否已经登录 */
    static isLogin: boolean = false;
    /**游戏是否全局暂停 */
    static isGamePause: boolean = false;

    static Event: EventTarget;
    protected onLoad(): void {
        this.initData();
    }

    initData() {
        director.addPersistRootNode(this.node);
        gm.Event = new EventTarget();

        //调试模式下，不打印日志
        if (!gm.isDebug) {
            console.log = () => { };
        }

        this.initStorage();
        audioMgr.initAudio(this.node);
        this.addListener();
    }

    /**增加监听 */
    addListener() {
        game.on(Game.EVENT_HIDE, () => {
            console.log("进入后台");
            gm.gamePause();
            pData.SDKReportLevelExit();
            audioMgr.closeBackgroundMusic();
        }, this);
        game.on(Game.EVENT_SHOW, () => {
            console.log("恢复前台");
            gm.gameResume();
            //微信的回调需要单独写
            if (gm.platType == PlatType.wx && gm.API.isShare && gm.API.lastShareTime != 0) {
                let curTime = ccTimeTools.getTime();
                let offsetTime = curTime - gm.API.lastShareTime;

                let call = ()=>{
                    gm.API.lastShareTime = 0;
                    gm.API.isShare = false;
                    gm.API.shareFailCount = 0;
                    gm.API.shareSuccess && gm.API.shareSuccess();
                }

                //超过3秒算成功
                if(offsetTime >= 3){
                    call();
                }else{
                    gm.API.shareFailCount++;
                    //失败3次算成功
                    if(gm.API.shareFailCount >= 3){
                        call();
                    }else{
                        uiMgr.showTips("分享失败");
                    }
                }
            }
            audioMgr.playBackgroundMusic();
        }, this);
    }

    /**初始化存储数据 */
    initStorage() {
        ccStorageTools.initData();
    }

    /**游戏暂停 */
    static gamePause(){
        if (gm.isGamePause) {
            return;
        }

        gm.isGamePause = true;
        gm.Event.emit(GameEvent.gamePause);
    }

    /**游戏继续 */
    static gameResume(){
        if (!gm.isGamePause) {
            return;
        }

        gm.isGamePause = false;
        gm.Event.emit(GameEvent.gameResume);
    }
}
