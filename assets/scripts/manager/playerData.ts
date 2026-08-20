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
    /**关卡模式通关数据，格式 [[模式ID, 该模式已通关关卡数], ...]，模式ID从1开始 */
    modeLevels: number[][] = [];
    /**道具集合 */
    propsNums = {};
    /**当前地图的大小 */
    mapSize: math.Size = math.Size.ZERO;
    /**地图半宽高 */
    mapHalfSize: Vec2 = Vec2.ZERO;
    /**游戏币（场内） */
    gameCoin = 0;
    /**玩家电能（场内） */
    gamePower = 0;
    /**感染币（场外） */
    money = 0;
    /**本局可使用广告升级门的次数 */
    adUpgradeDoorCount = 1;
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
    /**当前关卡允许的人机难度类型 */
    AIdifficultyTypes: number[] = [];
    /**当前选择的难度表索引 */
    difficultyIndex = -1;
    /**角色默认皮肤id，角色皮肤表加载后赋值 */
    private defaultSkinId: number = null;
    /**是否已经收到登录接口下发的游戏数据 */
    private isGameDataLoaded = false;
    /**游戏数据上报状态，避免连续修改产生乱序覆盖 */
    private isReportingGame = false;
    /**是否存在尚未上报的游戏数据修改 */
    private isGameReportDirty = false;
    /**是否已安排微任务上报，用于合并同一轮同步操作产生的多次修改 */
    private isGameReportScheduled = false;
    /**游戏开始的时间戳 */
    gameStartTime = 0;

    levelInit() {
        pData.adNum = 0;
        this.gameCoin = 0;
        this.gamePower = 0;
        this.adUpgradeDoorCount = 1;
        this.isGuide = ccStorageTools.getNumberData(SaveKey.guide) != 1 || gmConfig.forceGuide;
        let levelTableIndex = this.getSelectedDifficultyIndex();
        enemyMgr.enemyAllData = levelConfig.getBossAllData(levelTableIndex);
        this.AIdifficultyTypes = levelConfig.getAIDifficultyTypes(levelTableIndex);
        this.gameStartTime = ccTimeTools.getTime();

        console.warn("--------------->当前关卡敌人全等级数据\n", enemyMgr.enemyAllData);
        this.SDKReportLevelStart();
    }

    /**通关关卡模式数据获取当前关卡数 */
    getLevelNums(): number {
        let nums = 0;
        for (let i = 0; i < this.modeLevels.length; i++) {
            nums += this.modeLevels[i][1];
        }
        return nums;
    }

    /**获取当前关卡使用的敌人关卡表索引（即当前已解锁的最高模式索引） */
    getEnemyLevelTableIndex(): number {
        return this.getUnlockedModeIndex();
    }

    /**获取指定模式（模式ID从1开始）已通关关卡数 */
    getModePassCount(modeId: number): number {
        for (let i = 0; i < this.modeLevels.length; i++) {
            if (this.modeLevels[i][0] == modeId) {
                return this.modeLevels[i][1];
            }
        }
        return 0;
    }

    /**设置指定模式（模式ID从1开始）已通关关卡数 */
    private setModePassCount(modeId: number, count: number) {
        if (count < 0) {
            count = 0;
        }
        for (let i = 0; i < this.modeLevels.length; i++) {
            if (this.modeLevels[i][0] == modeId) {
                this.modeLevels[i][1] = count;
                return;
            }
        }
        this.modeLevels.push([modeId, count]);
        //按模式ID升序，保持数据整齐，便于上传后端
        this.modeLevels.sort((a, b) => a[0] - b[0]);
    }

    /**增加指定模式（模式ID从1开始）的通关数并存储 */
    addModePass(modeId: number) {
        let count = this.getModePassCount(modeId) + 1;
        this.setModePassCount(modeId, count);
        ccStorageTools.setData(SaveKey.modeLevels, this.modeLevels);
    }

    /**获取当前已解锁的最高模式索引（0基）。模式N通关数达到其quantity则解锁模式N+1 */
    getUnlockedModeIndex(): number {
        let table = levelConfig.tableData || [];
        if (table.length <= 0) {
            return 0;
        }
        let unlockedIndex = 0;
        //最后一个模式无需quantity（无上限），只需判断前面的模式是否通关
        for (let i = 0; i < table.length - 1; i++) {
            let quantity = Number(table[i]?.quantity) || 0;
            if (this.getModePassCount(i + 1) >= quantity) {
                unlockedIndex = i + 1;
            } else {
                break;
            }
        }
        return unlockedIndex;
    }

    /**获取当前进度所在模式及模式内下一关序号 [模式索引(0基), 关卡序号(1基)] */
    getCurrentModeLevelIndex(): [number, number] {
        return this.getModeLevelIndex(this.getUnlockedModeIndex());
    }

    /**
     * 获取指定模式的当前关卡索引 [模式索引(0基), 关卡序号(1基)]，通用函数，供关卡名称显示与关卡数据读取共用。
     * 关卡序号 = 该模式已通关数 + 1；非最后一个模式封顶到该模式关卡数量（quantity），
     * 即模式关卡有限时通关数再多也只停留在最后一关（如“初学”只有2关，通关999次仍为初学-2）；
     * 仅最后一个模式为无限关卡，不设上限。
     */
    getModeLevelIndex(modeIndex: number): [number, number] {
        let table = levelConfig.tableData || [];
        let maxModeIndex = Math.max(0, table.length - 1);
        let safeModeIndex = Number.isFinite(modeIndex) ? Math.max(0, Math.floor(modeIndex)) : 0;
        safeModeIndex = Math.min(safeModeIndex, maxModeIndex);
        let levelNum = this.getModePassCount(safeModeIndex + 1) + 1;
        //非最后一个模式：关卡序号封顶到该模式关卡数量（quantity）
        if (safeModeIndex < maxModeIndex) {
            let quantity = Math.max(1, Math.floor(Number(table[safeModeIndex]?.quantity) || 1));
            levelNum = Math.min(levelNum, quantity);
        }
        return [safeModeIndex, levelNum];
    }

    /**获取指定模式的关卡名称，如“初学-1” */
    getModeLevelName(modeIndex: number): string {
        return levelConfig.getLevelName(this.getModeLevelIndex(modeIndex));
    }

    /**获取当前选择模式的关卡名称，如“初学-1” */
    getSelectedModeLevelName(): string {
        return this.getModeLevelName(this.getSelectedDifficultyIndex());
    }

    /**获取当前正在游玩的模式索引（0基），取难度选择界面所选模式，未选择则取当前已解锁的最高模式 */
    getPlayingModeIndex(): number {
        return this.difficultyIndex >= 0 ? Math.floor(this.difficultyIndex) : this.getUnlockedModeIndex();
    }

    /**
     * 获取当前所在关卡的模式进度数据（即下一关的 modeLevels），供上报 level_values 使用。
     * modeLevels 存的是已通关数，当前正在玩的这一关需要 +1（与上报 level 用 level+1 表示当前关一致）。
     * 例：存储 [[1,10]] 且选择一模式 => [[1,11]]；存储 [[1,10]] 且选择二模式 => [[1,10],[2,1]]。
     */
    getNextModeLevels(): number[][] {
        let playingModeId = this.getPlayingModeIndex() + 1;
        //深拷贝，避免污染已存储的通关数据
        let result: number[][] = this.modeLevels.map(item => [item[0], item[1]]);
        let isFound = false;
        for (let i = 0; i < result.length; i++) {
            if (result[i][0] == playingModeId) {
                result[i][1] += 1;
                isFound = true;
                break;
            }
        }
        if (!isFound) {
            result.push([playingModeId, 1]);
        }
        result.sort((a, b) => a[0] - b[0]);
        return result;
    }

    /**
     * 获取上报用的排名值。取当前进度（getNextModeLevels 的结果）中模式ID最大的一项，
     * 公式：模式ID * rankModeFactor + 该模式关卡数。例：[[1,10],[2,3],[3,2]] => 3 * 100000 + 2 = 300002。
     * @param modeLevels 可传入已计算好的进度数据，避免重复计算
     */
    getReportRank(modeLevels: number[][] = this.getNextModeLevels()): number {
        let maxModeLevel: number[] = null;
        for (let i = 0; i < modeLevels.length; i++) {
            if (!maxModeLevel || modeLevels[i][0] > maxModeLevel[0]) {
                maxModeLevel = modeLevels[i];
            }
        }
        if (!maxModeLevel) {
            return 0;
        }
        return maxModeLevel[0] * configData.rankModeFactor + maxModeLevel[1];
    }

    /**解析存储的关卡模式数据，确保为 [[模式ID, 通关数], ...] 结构 */
    private parseModeLevels(raw: any): number[][] {
        if (!Array.isArray(raw)) {
            return [];
        }
        let result: number[][] = [];
        for (let i = 0; i < raw.length; i++) {
            let item = raw[i];
            if (!Array.isArray(item) || item.length < 2) {
                continue;
            }
            let modeId = Math.floor(Number(item[0]));
            let count = Math.floor(Number(item[1]));
            if (!Number.isFinite(modeId) || modeId <= 0 || !Number.isFinite(count) || count < 0) {
                continue;
            }
            result.push([modeId, count]);
        }
        result.sort((a, b) => a[0] - b[0]);
        return result;
    }

    /**获取已保存的难度，首次进入默认选择最新解锁难度 */
    getSelectedDifficultyIndex(): number {
        let unlockedDifficultyIndex = Math.max(0, this.getEnemyLevelTableIndex());
        let selectedDifficultyIndex = this.difficultyIndex < 0
            ? unlockedDifficultyIndex
            : Math.floor(Number(this.difficultyIndex));
        if (!Number.isFinite(selectedDifficultyIndex)) {
            selectedDifficultyIndex = unlockedDifficultyIndex;
        }
        selectedDifficultyIndex = Math.max(0, Math.min(selectedDifficultyIndex, unlockedDifficultyIndex));

        if (this.difficultyIndex != selectedDifficultyIndex) {
            this.difficultyIndex = selectedDifficultyIndex;
            ccStorageTools.setData(SaveKey.difficulty, selectedDifficultyIndex);
        }
        return selectedDifficultyIndex;
    }

    /**保存已解锁的难度选择 */
    setSelectedDifficultyIndex(difficultyIndex: number): number {
        let unlockedDifficultyIndex = Math.max(0, this.getEnemyLevelTableIndex());
        let selectedDifficultyIndex = Number.isFinite(difficultyIndex)
            ? Math.floor(difficultyIndex)
            : unlockedDifficultyIndex;
        selectedDifficultyIndex = Math.max(0, Math.min(selectedDifficultyIndex, unlockedDifficultyIndex));
        this.difficultyIndex = selectedDifficultyIndex;
        ccStorageTools.setData(SaveKey.difficulty, selectedDifficultyIndex);
        return selectedDifficultyIndex;
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
        //当前所在关卡的模式进度（已通关数+1），rank 由该进度中模式ID最大的一项计算
        let modeLevels = this.getNextModeLevels();
        let levelReprotData = {
            is_pass: isPass ? 1 : 0,
            level: this.level + 1,
            level_id: this.level + 1,
            level_progress: progress,
            time_used: gameAllTime,
            level_values: modeLevels,
            level_rank: this.getReportRank(modeLevels),
        }

        //TODO 测试
        // console.warn("上报关卡给后端", levelReprotData);
        httpMgr.post(urlConfig.levelReport, levelReprotData);
    }

    /**增加用户关卡数 */
    addLevel() {
        //上报关卡完成
        this.reportLevel(true);
        let previousDifficultyIndex = this.getEnemyLevelTableIndex();
        //当前正在玩的模式ID（1基）
        let playingModeIndex = this.getPlayingModeIndex();
        this.addModePass(playingModeIndex + 1);

        this.level++;
        ccStorageTools.setData(SaveKey.level, this.level);
        let unlockedDifficultyIndex = this.getEnemyLevelTableIndex();
        if (unlockedDifficultyIndex > previousDifficultyIndex) {
            this.setSelectedDifficultyIndex(unlockedDifficultyIndex);
        }

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

    /**修改局内金币 */
    fixGameCoin(coin: number) {
        this.gameCoin += coin;
        gm.Event.emit(GameEvent.refreshGameMonetary);
    }

    /**修改局内电能 */
    fixGamePower(power: number) {
        this.gamePower += power;
        gm.Event.emit(GameEvent.refreshGameMonetary);
    }

    /**设置道具数量 */
    setPropsNum(propsName: PropsName, num: number) {
        if (num < 0) {
            num = 0;
        }
        this.propsNums[propsName] = num;
        this.reportGame();
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
        this.reportGame();
        if (isRefresh) {
            gm.Event.emit(GameEvent.refreshProps);
        }
    }

    /**获取带等级道具的存储键 */
    private getLevelPropsNumKey(propsType: string, level: number) {
        return propsType + "_" + level;
    }

    /**设置带等级道具数量 */
    setLevelPropsNum(propsType: string, level: number, num: number) {
        if (num < 0) {
            num = 0;
        }
        let propsKey = this.getLevelPropsNumKey(propsType, level);
        this.propsNums[propsKey] = num;
        this.reportGame();
        gm.Event.emit(GameEvent.refreshProps);
    }

    /**获取带等级道具数量 */
    getLevelPropsNum(propsType: string, level: number) {
        let propsKey = this.getLevelPropsNumKey(propsType, level);
        return this.propsNums[propsKey] || 0;
    }

    /**修改带等级道具数量 */
    fixLevelPropsNum(propsType: string, level: number, num = 1, isRefresh = true) {
        let propsKey = this.getLevelPropsNumKey(propsType, level);
        let tempNum = this.propsNums[propsKey] || 0;
        tempNum += num;
        if (tempNum < 0) {
            tempNum = 0;
        }
        this.propsNums[propsKey] = tempNum;
        this.reportGame();
        if (isRefresh) {
            gm.Event.emit(GameEvent.refreshProps);
        }
    }

    /**修改感染币（场外） */
    fixMoney(money: number) {
        this.money += money;
        if (this.money < 0) {
            this.money = 0;
        }
        this.reportGame();
        gm.Event.emit(GameEvent.refreshPlayerMonetary);
    }

    /**初始化当前穿戴皮肤 */
    initSkinData(defaultSkinId: number) {
        this.defaultSkinId = defaultSkinId;
        if (!this.isGameDataLoaded) {
            return;
        }

        this.completeSkinData();
    }

    /**设置当前穿戴皮肤 */
    setSkinId(skinId: number) {
        let isChanged = this.skinId != skinId;
        this.skinId = skinId;
        if (isChanged) {
            this.reportGame();
            gm.Event.emit(GameEvent.refreshRoleSkin);
        }
    }

    /**判断角色皮肤是否已解锁 */
    isSkinUnlocked(skinId: number) {
        return !!this.unlockedRoleSkin[skinId + ""];
    }

    /**设置角色皮肤解锁状态 */
    setSkinUnlocked(skinId: number, unlocked = true) {
        let key = skinId + "";
        if (!!this.unlockedRoleSkin[key] == unlocked) {
            return;
        }

        this.unlockedRoleSkin[key] = unlocked;
        this.reportGame();
    }

    /**设置全皮肤拥有 */
    getAllSkin() {
        for (let i = 0; i < configData.roleSkinCount; i++) {
            this.unlockedRoleSkin[i + ""] = true;
        }

        this.reportGame();
    }

    /**获取限时数据的时间键 */
    private getLimitTimeKey(key: string) {
        return key + "_time";
    }

    /**设置限时数据（每日0点过期），存入后端 */
    setLimitTimeData(key: string, value: any) {
        this.limitTimeData[this.getLimitTimeKey(key)] = ccTimeTools.getCurrentTime();
        this.limitTimeData[key] = value;
        this.reportGame();
    }

    /**获取限时数据（记录时间不是当天则视为过期） */
    getLimitTimeData(key: string) {
        let timeKey = this.getLimitTimeKey(key);
        if (!this.limitTimeData.hasOwnProperty(timeKey)) {
            return null;
        }

        let lastTime = Number(this.limitTimeData[timeKey]) || 0;
        if (ccTimeTools.getCurrentTime() > lastTime) {
            //已过期，置空数据（不立即上报，等下次写入时一起同步）
            this.limitTimeData[timeKey] = null;
            this.limitTimeData[key] = null;
            return null;
        }
        return this.limitTimeData[key];
    }

    /**置空云端限时数据中已过期的部分 */
    private clearExpiredLimitTimeData() {
        let curTime = ccTimeTools.getCurrentTime();
        let keys = Object.keys(this.limitTimeData);
        for (let i = 0; i < keys.length; i++) {
            let timeKey = keys[i];
            if (timeKey.length <= 5 || timeKey.substring(timeKey.length - 5) != "_time") {
                continue;
            }

            let lastTime = Number(this.limitTimeData[timeKey]) || 0;
            if (curTime > lastTime) {
                this.limitTimeData[timeKey] = null;
                this.limitTimeData[timeKey.substring(0, timeKey.length - 5)] = null;
            }
        }
    }

    /**使用登录接口下发的云端游戏数据 */
    initGameData(gold: any, ext: any) {
        let gameExt = ext && typeof ext == "object" && !Array.isArray(ext) ? ext : {};

        this.money = Math.max(0, Number(gold) || 0);
        this.propsNums = gameExt.propsNums && typeof gameExt.propsNums == "object"
            ? Object.assign({}, gameExt.propsNums)
            : {};
        this.unlockedRoleSkin = gameExt.unlockedRoleSkin && typeof gameExt.unlockedRoleSkin == "object"
            ? Object.assign({}, gameExt.unlockedRoleSkin)
            : {};
        this.skinId = Number.isInteger(+gameExt.skinId) && +gameExt.skinId >= 0
            ? +gameExt.skinId
            : this.defaultSkinId;
        this.limitTimeData = gameExt.limitTimeData && typeof gameExt.limitTimeData == "object" && !Array.isArray(gameExt.limitTimeData)
            ? Object.assign({}, gameExt.limitTimeData)
            : {};
        this.isGameDataLoaded = true;

        this.clearExpiredLimitTimeData();
        this.initPropsNum();
        this.completeSkinData();
    }

    /**没有云端道具数据时，按商城配置初始化每种道具数量 */
    initPropsNum() {
        if (!this.isGameDataLoaded || propsConfig.storePropsData.length <= 0 || Object.keys(this.propsNums).length > 0) {
            return;
        }

        for (let i = 0; i < propsConfig.storePropsData.length; i++) {
            let propsList = propsConfig.storePropsData[i] || [];
            for (let j = 0; j < propsList.length; j++) {
                let propsData = propsList[j];
                let propsKey = this.getLevelPropsNumKey(propsData.propsType, propsData.level);
                this.propsNums[propsKey] = Math.max(0, Number(propsData.storeInitNum) || 0);
            }
        }
        this.reportGame();
    }

    /**补全新用户的默认皮肤数据 */
    private completeSkinData() {
        if (this.defaultSkinId == null) {
            return;
        }

        let isChanged = false;
        if (!Number.isInteger(this.skinId) || this.skinId < 0) {
            this.skinId = this.defaultSkinId;
            isChanged = true;
        }
        if (!this.isSkinUnlocked(this.defaultSkinId)) {
            this.unlockedRoleSkin[this.defaultSkinId + ""] = true;
            isChanged = true;
        }

        if (isChanged) {
            this.reportGame();
        }
    }

    /**上报感染币、皮肤、道具和限时数据 */
    reportGame() {
        if (!gm.isLogin) {
            return;
        }

        this.isGameReportDirty = true;
        if (!this.isGameDataLoaded || !Number.isInteger(this.skinId)) {
            return;
        }
        if (this.isReportingGame || this.isGameReportScheduled) {
            return;
        }

        // 合并购买皮肤等同步流程中的多次数据修改，统一上报最终状态。
        this.isGameReportScheduled = true;
        Promise.resolve().then(() => {
            this.isGameReportScheduled = false;
            this.flushGameReport();
        });
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
        let storedDifficulty = ccStorageTools.getData(SaveKey.difficulty);
        this.difficultyIndex = storedDifficulty == null || !Number.isFinite(Number(storedDifficulty))
            ? -1
            : Math.floor(Number(storedDifficulty));
        //读取关卡模式通关数据（本地）
        // this.modeLevels = this.parseModeLevels(ccStorageTools.getData(SaveKey.modeLevels));
        gmConfig.onlyAttackSelf = ccStorageTools.getNumberData(SaveKey.onlyAttackSelf) == 1;
        gmConfig.isFreeAd = ccStorageTools.getNumberData(SaveKey.isFreeAd) == 1;
    }
}

export let pData = new playerData();

interface jsonLevelData {
    /**关卡宽度 */
    width: number;
    /**关卡高度 */
    height: number;
    /**小箭头数据 */
    arrowData: any[];
    /**大箭头数据 */
    bigArrowData: any[];
    /**道具数据 */
    propsData: any[];
    /**边缘道具数据 */
    externalPropsData: any[];
}
