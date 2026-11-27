import { gm, PlatType } from "../manager/gm";
import { ccTimeTools } from "./timeTools";
import { SaveKey } from "../manager/configData";
import { httpMgr } from "../sdk/network/httpManager";
import { urlConfig } from "../sdk/network/netConfig";

let KEY_STORAGE = "playerData";
export class storageTools {
    /**仅保存设备本地设置；云端字段独立存放。 */
    private data: any = {};
    private batchDepth = 0;
    private hasPendingSave = false;
    private readonly localKeys = new Set<string>([
        SaveKey.selectMapData, SaveKey.selectedMaps, SaveKey.mapGuide, SaveKey.effect, SaveKey.effectVolume,
        SaveKey.music, SaveKey.musicVolume, SaveKey.vibrat, SaveKey.isAutoAiming, SaveKey.isFreeAd, SaveKey.useLocalTable,
    ]);
    private readonly cloudKeys = new Set<string>([
        SaveKey.gameGuide, SaveKey.rank, SaveKey.rankScore, SaveKey.money, SaveKey.gold, SaveKey.storehouse,
        SaveKey.equipmentIds, SaveKey.lostItems, SaveKey.roleId, SaveKey.roleLevels, SaveKey.unlockedRoles,
        SaveKey.unlockedMaps, SaveKey.showItems, SaveKey.unlockedCollections,
        SaveKey.claimedCollectionRewards, SaveKey.bossBookStates, SaveKey.signDays,
        SaveKey.isGetSign, SaveKey.isGetRevisit, SaveKey.moneyAddShare, SaveKey.moneyAddShare2,
        SaveKey.isShowEquipment, SaveKey.avatarUrl,
    ]);
    private cloudData: { [key: string]: any } = {};
    private cloudReady = false;
    private localDirty = false;
    private cloudDirty = false;
    private isReporting = false;
    private reportScheduled = false;
    private retryTimer: ReturnType<typeof setTimeout> = null;

    private isCloudKey(key: string): boolean {
        const baseKey = key.endsWith("_time") ? key.slice(0, -5) : key;
        return this.cloudKeys.has(key)
            || [SaveKey.isGetSign, SaveKey.isGetRevisit, SaveKey.moneyAddShare, SaveKey.moneyAddShare2].includes(baseKey as SaveKey)
            || /^bossDropGold_\d+(_time)?$/.test(key);
    }

    /**登录成功后恢复 ext；玩家初始化必须在此之后执行。 */
    initCloudData(ext: any) {
        const data = typeof ext === "string" ? JSON.parse(ext || "{}") : ext;
        this.cloudData = {};
        if (data && typeof data === "object" && !Array.isArray(data)) {
            for (const key of Object.keys(data)) {
                if (this.isCloudKey(key)) this.cloudData[key] = data[key];
            }
        }
        this.cloudReady = true;
        this.cloudDirty = false;
    }

    private writeData(key: string, value: any) {
        if (this.localKeys.has(key)) {
            this.data[key] = value;
            this.localDirty = true;
        } else if (this.isCloudKey(key)) {
            if (!this.cloudReady) throw new Error("云端存档尚未恢复");
            this.cloudData[key] = value;
            this.cloudDirty = true;
        } else {
            throw new Error(`未配置存储字段：${key}`);
        }
    }

    private scheduleReport() {
        if (!this.cloudReady || !this.cloudDirty || this.isReporting || this.reportScheduled || this.retryTimer) return;
        this.reportScheduled = true;
        Promise.resolve().then(() => {
            this.reportScheduled = false;
            return this.reportCloudData();
        });
    }

    private async reportCloudData() {
        if (!gm.isLogin || !this.cloudReady || !this.cloudDirty || this.isReporting) return;
        this.isReporting = true;
        const ext = JSON.parse(JSON.stringify(this.cloudData));
        this.cloudDirty = false;
        let succeeded = false;
        try {
            await httpMgr.post(urlConfig.reportGame, { gold: 0, ext }, () => {
                succeeded = true;
            }, error => console.error("云端存档上报失败，稍后重试", error));
        } catch (error) {
            console.error("云端存档上报异常，稍后重试", error);
        } finally {
            this.isReporting = false;
            if (!succeeded) {
                this.cloudDirty = true;
                this.retryTimer = setTimeout(() => {
                    this.retryTimer = null;
                    this.scheduleReport();
                }, 3000);
            } else {
                this.scheduleReport();
            }
        }
    }

    /**初始化数据 */
    async initData() {
        if (gm.platType != PlatType.h5) {
            //使用平台存储
            this.setexternalData(await gm.API.getStorage(KEY_STORAGE));
        } else {
            this.setexternalData(JSON.parse(localStorage.getItem(KEY_STORAGE) || "{}"));
        }
    }

    /**外部设置数据 */
    setexternalData(data: any) {
        this.data = {};
        if (data && typeof data === "object" && !Array.isArray(data)) {
            for (const key of Object.keys(data)) {
                if (this.localKeys.has(key)) this.data[key] = data[key];
            }
        }
    }

    /**保存数据 */
    saveData() {
        if (this.batchDepth > 0) {
            this.hasPendingSave = true;
            return;
        }
        if (this.localDirty && gm.platType != PlatType.h5) {
            //使用平台存储
            gm.API.setStorage(KEY_STORAGE, this.data);
        } else if (this.localDirty) {
            localStorage.setItem(KEY_STORAGE, JSON.stringify(this.data));
        }
        this.localDirty = false;
        this.scheduleReport();
    }

    /**设置数据 */
    setData(key: string, value: any) {
        this.writeData(key, value);
        this.saveData();
    }

    batch<T>(action: () => T): T {
        this.batchDepth++;
        try {
            return action();
        } finally {
            this.batchDepth--;
            if (this.batchDepth === 0 && this.hasPendingSave) {
                this.hasPendingSave = false;
                this.saveData();
            }
        }
    }

    setDatas(entries: Array<[string, any]>) {
        if (entries.length === 0) return;
        for (const [key, value] of entries) {
            this.writeData(key, value);
        }
        this.saveData();
    }

    /**获取数据 */
    getData(key: string) {
        const data = this.localKeys.has(key) ? this.data : this.cloudData;
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    }

    /**获取数字类型数据 */
    getNumberData(key: string) {
        return Number(this.getData(key)) || 0;
    }

    /**设置限时数据 */
    setLimitTimeData(key: string, value: number) {
        let timeKey = key + "_time";
        this.setDatas([[timeKey, ccTimeTools.getCurrentTime()], [key, value]]);
    }

    /**获取限时数据 */
    getLimitTimeData(key: string) {
        let timeKey = key + "_time";
        const lastTime = this.getData(timeKey);
        if (lastTime !== null) {
            let curTime = ccTimeTools.getCurrentTime();
            if (curTime > lastTime) {
                return null;
            } else {
                return this.getData(key);
            }
        }
        return null;
    }
}
export let ccStorageTools = new storageTools();

