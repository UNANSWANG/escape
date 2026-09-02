import { _decorator, math, Vec2, Vec3 } from 'cc';
import { levelConfig } from '../json/jsonLevel';
import { ccStorageTools } from '../extention/storageTools';
import { configData, GameEvent, gmConfig, PropsName, SaveKey } from './configData';
import { gm, PlatType } from './gm';
import { httpMgr } from '../sdk/network/httpManager';
import { urlConfig } from '../sdk/network/netConfig';
import { propsConfig } from '../json/jsonProps';
import { enemyMgr } from './enemyManager';
import { ccTimeTools } from '../extention/timeTools';
const { ccclass, property } = _decorator;

//用户游戏内数据
@ccclass('playerData')
export class playerData {
    /**当前已通关关卡数 */
    level = 0;
    /**道具集合 */
    propsNums = {};
    /**地图半宽高 */
    mapHalfSize: Vec2 = Vec2.ZERO;
    /**感染币（场外） */
    money = 0;

    /**当前关卡所看广告数 */
    adNum = 0;
    /**当前皮肤id */
    skinId = 0;
    /**已解锁角色皮肤 */
    unlockedRoleSkin: { [key: string]: boolean } = {};
    /**云端限时数据（每日0点重置），格式与 storageTools 一致：{ key: 值, key_time: 记录当天0点时间戳 } */
    limitTimeData: { [key: string]: any } = {};
    /**是否为引导关 */
    isGuide = false;
    /**角色默认皮肤id，角色皮肤表加载后赋值 */
    private defaultSkinId: number = null;
    /**游戏数据上报状态，避免连续修改产生乱序覆盖 */
    private isReportingGame = false;
    /**是否存在尚未上报的游戏数据修改 */
    private isGameReportDirty = false;
    /**游戏开始的时间戳 */
    gameStartTime = 0;

    levelInit() {
        pData.adNum = 0;
        pData.mapHalfSize = new Vec2(2680/2, 1500/2);
        this.isGuide = ccStorageTools.getNumberData(SaveKey.guide) != 1 || gmConfig.forceGuide;
        this.gameStartTime = ccTimeTools.getTime();

        this.SDKReportLevelStart();
    }

    /**SDK关卡开始上报 */
    SDKReportLevelStart() {
        if (gm.hgSdk) {
            gm.hgSdk.track('LEVEL_ENTER', {
                enter_level_id: 0,	    //进入的关卡进度（ 0 ~ 1 之间的数值），需保留两位小数
                level_id: (pData.level + 1),    	//关卡ID，数值
            });
        }
    }

    /**SDK关卡中途退出上报 */
    SDKReportLevelExit() {
        if (gm.hgSdk) {
            gm.hgSdk.track('LEVEL_EXIT', {
                ad_cnt: pData.adNum,
                enter_level_id: 0,	    //进入的关卡进度（ 0 ~ 1 之间的数值），需保留两位小数
                level_id: (pData.level + 1),    	//关卡ID，数值
            });
        }
    }

    /**SDK关卡失败上报 */
    SDKReportLevelFail() {
        if (gm.hgSdk) {
            gm.hgSdk.track('LEVEL_LOSE', {
                ad_cnt: pData.adNum,
                enter_level_id: 0,	    //进入的关卡进度（ 0 ~ 1 之间的数值），需保留两位小数
                level_id: (pData.level + 1),    	//关卡ID，数值
            });
        }
    }

    /**SDK关卡完成上报 */
    SDKReportLevelComplete() {
        if (gm.hgSdk) {
            gm.hgSdk.track('LEVEL_PASS', {
                ad_cnt: pData.adNum,
                enter_level_id: 0,	    //进入的关卡进度（ 0 ~ 1 之间的数值），需保留两位小数
                level_id: (pData.level + 1),    	//关卡ID，数值
            });
        }
    }

    /**上报关卡给后端 */
    reportLevel(isPass) {
        let progress = 0;
        //已经通关进度就是100%
        if (isPass) {
            progress = 100;
        } else {
            progress = 0;
        }

        let curTime = ccTimeTools.getTime();
        let gameAllTime = curTime - this.gameStartTime;
        let levelReprotData = {
            is_pass: isPass ? 1 : 0,
            level: this.level + 1,
            level_id: this.level + 1,
            level_progress: progress,
            time_used: gameAllTime,
        }

        //TODO 测试
        // console.warn("上报关卡给后端", levelReprotData);
        // httpMgr.post(urlConfig.levelReport, levelReprotData);
    }

    /**增加用户关卡数 */
    addLevel() {
        //上报关卡完成
        this.reportLevel(true);

        this.level++;
        ccStorageTools.setData(SaveKey.level, this.level);

        //上传微信好友榜
        if (gm.platType === PlatType.wx) {
            const kvDataList = [];
            kvDataList.push({
                key: `level`,
                value: `${this.level}`
            });
            gm.API.setUserCloudStorage(kvDataList);
        }

    }

    /**设置道具数量 */
    setPropsNum(propsName: PropsName, num: number) {
        if (num < 0) {
            num = 0;
        }
        this.propsNums[propsName] = num;
        ccStorageTools.setData(SaveKey.props, this.propsNums);
        gm.Event.emit(GameEvent.refreshProps);
    }

    /**获取道具数量 */
    getPropsNum(propsName: PropsName) {
        return this.propsNums[propsName] || 0;
    }

    /**修改道具数量 */
    fixPropsNum(propsName: PropsName, num = 1, isRefresh = true) {
        let tempNum = this.propsNums[propsName] || 0;
        tempNum += num;
        if (tempNum < 0) {
            tempNum = 0;
        }
        this.propsNums[propsName] = tempNum;
        ccStorageTools.setData(SaveKey.props, this.propsNums);
        if (isRefresh) {
            gm.Event.emit(GameEvent.refreshProps);
        }
    }

    /**获取带等级道具的存储键 */
    private getLevelPropsNumKey(propsType: string, level: number) {
        return propsType + "_" + level;
    }


    /**修改感染币（场外） */
    fixMoney(money: number) {
        this.money += money;
        if (this.money < 0) {
            this.money = 0;
        }
        gm.Event.emit(GameEvent.refreshPlayerMonetary);
    }

    /**初始化当前穿戴皮肤 */
    initSkinData(defaultSkinId: number) {
        this.defaultSkinId = defaultSkinId;
    }

    /**设置当前穿戴皮肤 */
    setSkinId(skinId: number) {
        let isChanged = this.skinId != skinId;
        this.skinId = skinId;
        if (isChanged) {
            gm.Event.emit(GameEvent.refreshRoleSkin);
        }
    }

    /**判断角色皮肤是否已解锁 */
    isSkinUnlocked(skinId: number) {
        return !!this.unlockedRoleSkin[skinId + ""];
    }

    /**设置全皮肤拥有 */
    getAllSkin() {
        for (let i = 0; i < configData.roleSkinCount; i++) {
            this.unlockedRoleSkin[i + ""] = true;
        }
    }

    /**没有云端道具数据时，按商城配置初始化每种道具数量 */
    initPropsNum() {
        
    }

    /**串行上报，避免旧请求后返回并覆盖新数据 */
    private async flushGameReport() {
        if (this.isReportingGame || !this.isGameReportDirty || !gm.isLogin) {
            return;
        }

        this.isGameReportDirty = false;
        this.isReportingGame = true;
        try {
            await httpMgr.post(urlConfig.reportGame, {
                gold: this.money,
                ext: {
                    skinId: this.skinId,
                    unlockedRoleSkin: Object.assign({}, this.unlockedRoleSkin),
                    propsNums: Object.assign({}, this.propsNums),
                    limitTimeData: Object.assign({}, this.limitTimeData),
                },
            });
        } finally {
            this.isReportingGame = false;
            if (this.isGameReportDirty) {
                this.flushGameReport();
            }
        }
    }

    /**初始化存储数据 */
    initData() {
        this.propsNums = ccStorageTools.getData(SaveKey.props) || {};
        gmConfig.onlyAttackSelf = ccStorageTools.getNumberData(SaveKey.onlyAttackSelf) == 1;
        gmConfig.isFreeAd = ccStorageTools.getNumberData(SaveKey.isFreeAd) == 1;
    }
}

export let pData = new playerData();