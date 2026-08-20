import { gm, PlatType } from "../manager/gm";
import { ccTimeTools } from "./timeTools";

let KEY_STORAGE = "playerData";
export class storageTools {
    /**数据 */
    private data: any = {};

    /**初始化数据 */
    initData() {
        // this.data = JSON.parse(localStorage.getItem(KEY_STORAGE) || "{}");
        // return;
        if (gm.platType != PlatType.h5) {
            //使用平台存储
            // this.data = 
            gm.API.getStorage(KEY_STORAGE);
        } else {
            this.data = JSON.parse(localStorage.getItem(KEY_STORAGE) || "{}");
        }
    }

    /**外部设置数据 */
    setexternalData(data: any) {
        this.data = data;
    }

    /**保存数据 */
    saveData() {
        // localStorage.setItem(KEY_STORAGE, JSON.stringify(this.data));
        // return;
        if (gm.platType != PlatType.h5) {
            //使用平台存储
            gm.API.setStorage(KEY_STORAGE, this.data);
        } else {
            localStorage.setItem(KEY_STORAGE, JSON.stringify(this.data));
        }
    }

    /**设置数据 */
    setData(key: string, value: any) {
        // console.log("设置数据", key, value);
        this.data[key] = value;
        this.saveData();
    }

    /**获取数据 */
    getData(key: string) {
        if (this.data.hasOwnProperty(key)) {
            return this.data[key];
        }
        return null;
    }

    /**获取数字类型数据 */
    getNumberData(key: string) {
        if (this.data.hasOwnProperty(key)) {
            return Number(this.data[key]);
        }
        return 0;
    }

    /**设置限时数据 */
    setLimitTimeData(key: string, value: number) {
        let timeKey = key + "_time";
        this.data[timeKey] = ccTimeTools.getCurrentTime();
        this.data[key] = value;
        this.saveData();
    }

    /**获取限时数据 */
    getLimitTimeData(key: string) {
        let timeKey = key + "_time";
        if (this.data.hasOwnProperty(timeKey)) {
            let lastTime = this.data[timeKey];
            let curTime = ccTimeTools.getCurrentTime();
            if (curTime > lastTime) {
                this.data[key] = null;
                return this.data[key];
            } else {
                return this.data[key];
            }
        }
        return null;
    }
}
export let ccStorageTools = new storageTools();

