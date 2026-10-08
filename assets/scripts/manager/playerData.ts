import { _decorator, math, Vec2, Vec3 } from 'cc';
import { ccStorageTools } from '../extention/storageTools';
import { configData, GameEvent, gmConfig, SaveKey } from './configData';
import { gm, PlatType } from './gm';
import { httpMgr } from '../sdk/network/httpManager';
import { urlConfig } from '../sdk/network/netConfig';
import { ccTimeTools } from '../extention/timeTools';
import { commonConfig } from '../json/jsonCommon';
const { ccclass, property } = _decorator;

//用户游戏内数据
@ccclass('playerData')
export class playerData {
    /**当前已通关关卡数 */
    level = 0;
    /**道具集合 */
    propsNums = {};
    /**仓库数据，格式为 [[itemId, 数量], ...] */
    storehouseData: number[][] = [];
    /**地图半宽高 */
    mapHalfSize: Vec2 = Vec2.ZERO;
    /**银币 */
    money = 0;
    /**金币 */
    gold = 0;
    /**当前关卡所看广告数 */
    adNum = 0;
    /**角色id */
    roleId = 0;
    /**当前皮肤id */
    skinId = 0;
    /**已解锁角色皮肤 */
    unlockedRoleSkin: { [key: string]: boolean } = {};
    /**云端限时数据（每日0点重置），格式与 storageTools 一致：{ key: 值, key_time: 记录当天0点时间戳 } */
    limitTimeData: { [key: string]: any } = {};
    /**是否为引导关 */
    isGuide = false;
    /**是否开启自动瞄准 */
    isAutoAiming = true;
    /**角色默认id，角色皮肤表加载后赋值 */
    private defaultRoleId: number = null;
    /**游戏数据上报状态，避免连续修改产生乱序覆盖 */
    private isReportingGame = false;
    /**是否存在尚未上报的游戏数据修改 */
    private isGameReportDirty = false;
    /**游戏开始的时间戳 */
    gameStartTime = 0;
    /**装备栏默认值；近战武器和背包不能留空。 */
    private readonly defaultEquipmentIds: number[] = [-1, -1, 0, -1, -1, 0];
    /**装备id数组[主武器（weapons），副武器（weapons），近战武器（weapons），头盔（equipment），护甲（equipment），背包（equipment）] */
    equipmentIds: number[] = this.defaultEquipmentIds.slice();
    /**背包内价值 */
    backpackValue = 0;
    /**背包内当前容量 */
    backpackCapacity = 0;
    /**背包内最大容量 */
    maxBackpackCapacity = 0;
    /**背包内物品，格式为 [[itemId, 数量], ...] */
    backpackItems: [number, number][] = [];
    /**小药品数量 */
    drugCount = 0;
    /**大药品数量 */
    drugCountBig = 0;

    levelInit() {
        pData.adNum = 0;
        //TODO 临时写地图半宽高，后续根据配置加载
        pData.mapHalfSize = new Vec2(3500 / 2, 3500 / 2);
        this.isGuide = ccStorageTools.getNumberData(SaveKey.guide) != 1 || gmConfig.forceGuide;
        this.gameStartTime = ccTimeTools.getTime();

        //初始化背包内最大容量
        this.maxBackpackCapacity = 60;
        //初始化背包内物品
        this.backpackItems = [];
        //初始化小药品数量
        this.drugCount = Number(commonConfig.getValue("drugCount"));
        //初始化大药品数量
        this.drugCountBig = Number(commonConfig.getValue("drugCountBig"));

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

    /**获取仓库数据 */
    getStorehouseData(): number[][] {
        return this.storehouseData.map((itemData) => [itemData[0], itemData[1]]);
    }

    /**排序仓库数据并保存；比较结果相同时保持原有先后顺序 */
    sortStorehouseData(compareFn: (itemA: number[], itemB: number[]) => number) {
        if (typeof compareFn !== "function" || this.storehouseData.length < 2) {
            return;
        }

        this.storehouseData = this.storehouseData
            .map((itemData, index) => ({ itemData, index }))
            .sort((dataA, dataB) => compareFn(dataA.itemData, dataB.itemData) || dataA.index - dataB.index)
            .map((data) => data.itemData);
        this.saveStorehouseData();
    }

    /**增减单个仓库物品数量 */
    fixStorehouseData(itemId: number, num: number) {
        if (this.updateStorehouseData(itemId, num)) {
            this.saveStorehouseData();
        }
    }

    /**批量增减仓库物品数量，全部修改完成后只存储一次 */
    fixStorehouseDatas(data: number[][]) {
        if (!Array.isArray(data) || data.length === 0) {
            return;
        }

        let isChanged = false;
        for (const itemData of data) {
            if (!Array.isArray(itemData) || itemData.length < 2) {
                continue;
            }
            if (this.updateStorehouseData(itemData[0], itemData[1])) {
                isChanged = true;
            }
        }

        if (isChanged) {
            this.saveStorehouseData();
        }
    }

    /** 撤离成功时将背包物品批量转入仓库，并清空本局背包数据。 */
    moveBackpackItemsToStorehouse() {
        this.fixStorehouseDatas(this.backpackItems);
        this.backpackItems = [];
        this.backpackValue = 0;
        this.backpackCapacity = 0;
    }

    private updateStorehouseData(itemId: number, num: number): boolean {
        if (!Number.isInteger(itemId) || itemId < 0 || !Number.isInteger(num) || num === 0) {
            return false;
        }

        const itemIndex = this.storehouseData.findIndex((itemData) => itemData[0] === itemId);
        const currentNum = itemIndex >= 0 ? this.storehouseData[itemIndex][1] : 0;
        const targetNum = Math.max(0, currentNum + num);
        if (targetNum === currentNum) {
            return false;
        }

        if (targetNum === 0) {
            this.storehouseData.splice(itemIndex, 1);
        } else if (itemIndex >= 0) {
            this.storehouseData[itemIndex][1] = targetNum;
        } else {
            this.storehouseData.push([itemId, targetNum]);
        }
        return true;
    }

    private saveStorehouseData() {
        ccStorageTools.setData(SaveKey.storehouse, this.storehouseData);
    }

    /**修改单个装备槽并保存；近战武器和背包为空时自动恢复默认装备。 */
    setEquipmentId(slotIndex: number, equipmentId: number): boolean {
        if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.defaultEquipmentIds.length) {
            return false;
        }
        if (!Number.isInteger(equipmentId) || equipmentId < -1) {
            return false;
        }

        const equipmentIds = this.equipmentIds.slice();
        equipmentIds[slotIndex] = equipmentId;
        const normalizedEquipmentIds = this.normalizeEquipmentIds(equipmentIds);
        const isChanged = normalizedEquipmentIds.length !== this.equipmentIds.length
            || normalizedEquipmentIds.some((normalizedId, index) => normalizedId !== this.equipmentIds[index]);
        if (!isChanged) {
            return false;
        }

        this.equipmentIds = normalizedEquipmentIds;
        this.saveEquipmentIds();
        return true;
    }

    /**卸下指定槽位的装备，并恢复该槽位的默认装备。 */
    removeEquipment(slotIndex: number): boolean {
        return this.setEquipmentId(slotIndex, this.defaultEquipmentIds[slotIndex]);
    }

    /**获取指定装备槽位的默认装备 id。 */
    getDefaultEquipmentId(slotIndex: number): number {
        if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.defaultEquipmentIds.length) {
            return -1;
        }
        return this.defaultEquipmentIds[slotIndex];
    }

    /**读取并兼容旧版装备存档。 */
    private initEquipmentIds(data: any) {
        this.equipmentIds = this.normalizeEquipmentIds(data);
        const isNormalizedData = Array.isArray(data)
            && data.length === this.equipmentIds.length
            && data.every((equipmentId, index) => equipmentId === this.equipmentIds[index]);
        if (!isNormalizedData) {
            this.saveEquipmentIds();
        }
    }

    /**保证装备栏固定为六格，并处理不可为空的默认装备。 */
    private normalizeEquipmentIds(data: any): number[] {
        const equipmentIds = this.defaultEquipmentIds.slice();
        if (Array.isArray(data)) {
            for (let index = 0; index < equipmentIds.length; index++) {
                const equipmentId = data[index];
                if (Number.isInteger(equipmentId) && equipmentId >= -1) {
                    equipmentIds[index] = equipmentId;
                }
            }
        }

        if (equipmentIds[2] < 0) {
            equipmentIds[2] = this.defaultEquipmentIds[2];
        }
        if (equipmentIds[5] < 0) {
            equipmentIds[5] = this.defaultEquipmentIds[5];
        }
        return equipmentIds;
    }

    private saveEquipmentIds() {
        ccStorageTools.setData(SaveKey.equipmentIds, this.equipmentIds.slice());
    }

    private initStorehouseData(data: any) {
        this.storehouseData = [];
        if (!Array.isArray(data)) {
            return;
        }

        for (const itemData of data) {
            if (Array.isArray(itemData) && itemData.length >= 2) {
                this.updateStorehouseData(itemData[0], itemData[1]);
            }
        }
    }

    /**获取带等级道具的存储键 */
    private getLevelPropsNumKey(propsType: string, level: number) {
        return propsType + "_" + level;
    }


    /**修改银币*/
    fixMoney(money: number) {
        this.money += money;
        if (this.money < 0) {
            this.money = 0;
        }
        ccStorageTools.setData(SaveKey.money, this.money);
        gm.Event.emit(GameEvent.refreshPlayerMonetary);
    }

    /**修改金币*/
    fixGold(gold: number) {
        this.gold += gold;
        if (this.gold < 0) {
            this.gold = 0;
        }
        ccStorageTools.setData(SaveKey.gold, this.gold);
        gm.Event.emit(GameEvent.refreshPlayerMonetary);
    }

    /**初始化当前穿戴皮肤 */
    initRoleData(defaultRoleId: number) {
        this.defaultRoleId = defaultRoleId;
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
        //TODO 等待加入皮肤表后，再设置全皮肤拥有
        // for (let i = 0; i < ; i++) {
        //     this.unlockedRoleSkin[i + ""] = true;
        // }
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
        this.initStorehouseData(ccStorageTools.getData(SaveKey.storehouse));
        this.initEquipmentIds(ccStorageTools.getData(SaveKey.equipmentIds));
        this.money = Math.max(0, ccStorageTools.getNumberData(SaveKey.money));
        this.gold = Math.max(0, ccStorageTools.getNumberData(SaveKey.gold));
        gmConfig.onlyAttackSelf = ccStorageTools.getNumberData(SaveKey.onlyAttackSelf) == 1;
        gmConfig.isFreeAd = ccStorageTools.getNumberData(SaveKey.isFreeAd) == 1;
        const autoAimingData = ccStorageTools.getData(SaveKey.isAutoAiming);
        // 旧存档没有此字段时，保持原有自动瞄准行为。
        this.isAutoAiming = autoAimingData === null ? true : Number(autoAimingData) === 1;
    }

    /**设置自动瞄准状态并持久化到本地存储 */
    setAutoAiming(isAutoAiming: boolean) {
        this.isAutoAiming = isAutoAiming;
        ccStorageTools.setData(SaveKey.isAutoAiming, isAutoAiming ? 1 : 0);
    }
}

export let pData = new playerData();
