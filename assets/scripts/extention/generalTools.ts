import { _decorator, Component, Node, sp, Sprite, Vec2, Vec3 } from 'cc';
import { gm } from '../manager/gm';
import { audioManager, audioMgr } from '../manager/audioManager';
import { uiMgr } from '../manager/UIManager';
import { ccResTools } from './resTools';
import { configData } from '../manager/configData';
import { pData } from '../manager/playerData';
const { ccclass, property } = _decorator;

@ccclass('generalTools')
export class generalTools {
    /**显示指定子节点 */
    showChildByIdx(parent: Node, idx: number) {
        for (let i = 0; i < parent.children.length; i++) {
            parent.children[i].active = i == idx;
        }
    }

    /**显示指定数组索引节点 */
    showArrayByIdx(arr: Node[], idx: number) {
        for (let i = 0; i < arr.length; i++) {
            arr[i].active = i == idx;
        }
    }

    /**销毁并移除所有子节点 */
    destroyAllChild(parent: Node) {
        for (let i = parent.children.length - 1; i >= 0; i--) {
            let childNode = parent.children[i];
            childNode.removeFromParent();
            childNode.destroy();
        }
    }

    /**获得方向 */
    GetDir(x1: number, y1: number, x2: number, y2: number) {
        const dx = x2 - x1;
        const dy = y2 - y1;

        // 计算距离并归一化为单位向量
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
            return new Vec2(0, 0);
        }

        return new Vec2(dx / distance, dy / distance);
    }

    /**获得数据向无穷大取整 */
    ceilInteger(num: number) {
        if (num === 0) return 0;
        return Math.ceil(Math.abs(num)) * (num > 0 ? 1 : -1);
    }

    /**计算两点间距离的辅助函数 */
    calculateDistance(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**获取中文数字(0-10) */
    getChineseNum(num: number) {
        switch (num) {
            case 0:
                return "零";
            case 1:
                return "一";
            case 2:
                return "二";
            case 3:
                return "三";
            case 4:
                return "四";
            case 5:
                return "五";
            case 6:
                return "六";
            case 7:
                return "七";
            case 8:
                return "八";
            case 9:
                return "九";
            case 10:
                return "十";
            default:
                return num.toString();
        }
    }

    /**震动 */
    vibrate(shortMode = 1) {
        if (audioMgr.isVibrat) {
            gm.API.vibrateShort(shortMode);
        }
    }

    /**异步加载图片进sprite */
    async loadImg(sprite: Sprite, url: string) {
        if (!sprite || !sprite.isValid || !url) {
            return false;
        }

        // 同一组件后发请求会提升版本，先发请求完成后不会回写旧资源
        let loadVersion = this.beginAssetLoad(sprite);
        url += "/spriteFrame";
        let img = await ccResTools.loadPic(uiMgr.resBundle, url);
        if (!img) {
            console.log("加载图片失败", url);
            return false;
        }
        if (!this.isAssetLoadCurrent(sprite, loadVersion)) {
            return false;
        }
        sprite.spriteFrame = img;
        return true;
    }

    /**异步加载远端图片进sprite */
    async loadUrlImg(sprite: Sprite, url: string) {
        if (!sprite || !sprite.isValid || !url) {
            return false;
        }

        // 记录本次请求版本，防止节点复用后写入上一用途的图片
        let loadVersion = this.beginAssetLoad(sprite);
        let img = await ccResTools.loadPicByUrl(url);
        if (!img) {
            console.log("加载图片失败", url);
            return false;
        }
        if (!this.isAssetLoadCurrent(sprite, loadVersion)) {
            return false;
        }
        sprite.spriteFrame = img;
        return true;
    }

    /**异步加载spine进Skeleton */
    async loadSpine(skeleton: sp.Skeleton, url: string) {
        if (!skeleton || !skeleton.isValid || !url) {
            return false;
        }

        // 记录本次请求版本，防止异步完成时Skeleton已被回池或改作他用
        let loadVersion = this.beginAssetLoad(skeleton);
        let spinePath = this.getSpineLoadPath(url);
        let spineData = await ccResTools.loadSpine(uiMgr.resBundle, spinePath);
        if (!spineData) {
            console.log("加载spine失败", url);
            return false;
        }
        if (!this.isAssetLoadCurrent(skeleton, loadVersion)) {
            return false;
        }

        skeleton.skeletonData = spineData;
        return true;
    }

    /**使组件上尚未完成的异步资源请求失效 */
    cancelAssetLoad(component: Component) {
        if (!component) {
            return;
        }
        this.beginAssetLoad(component);
    }

    /**创建组件级资源请求版本 */
    private beginAssetLoad(component: Component) {
        let target = component as any;
        let version = (Number(target.__asyncAssetLoadVersion) || 0) + 1;
        target.__asyncAssetLoadVersion = version;
        return version;
    }

    /**确认组件仍有效且本次请求仍是最后一次请求 */
    private isAssetLoadCurrent(component: Component, version: number) {
        return !!component && component.isValid && (component as any).__asyncAssetLoadVersion == version;
    }

    /**获取spine加载路径，只有role和boss需要通过目录名拼资源名 */
    private getSpineLoadPath(url: string) {
        if (!url.startsWith("spine/role/") && !url.startsWith("spine/boss/")) {
            return url;
        }

        let pathArr = url.split("/");
        let dirName = pathArr[pathArr.length - 1] || "";
        let spineName = dirName.split("_")[0] || dirName;
        return `${url}/${spineName}`;
    }

    /**打乱数组顺序 */
    shuffleArray<T>(arr: T[]) {
        for (let i = arr.length - 1; i > 0; i--) {
            let randomIdx = Math.floor(Math.random() * (i + 1));
            let temp = arr[i];
            arr[i] = arr[randomIdx];
            arr[randomIdx] = temp;
        }
    }

    /**获取随机数字（左闭右开） */
    getRandomNum(min: number, max: number) {
        if(min >= max){
            return min;
        }
        return Math.floor(Math.random() * (max - min) + min);
    }

    /**获取名称内的字符串，数字 */
    getNameData(name: string) {
        let matchData = name.match(/^([^\d]*)(\d+)$/);
        let nameData = matchData ? [matchData[1], Number(matchData[2])] : [name, 0];
        return nameData;
    }


    /**按非负权重随机行为索引 */
    getWeightedRandomIndex(weights: number[]) {
        let totalWeight = 0;
        for (let i = 0; i < weights.length; i++) {
            totalWeight += Math.max(0, Number(weights[i]) || 0);
        }
        if (totalWeight <= 0) {
            return -1;
        }

        let randomValue = Math.random() * totalWeight;
        for (let i = 0; i < weights.length; i++) {
            randomValue -= Math.max(0, Number(weights[i]) || 0);
            if (randomValue < 0) {
                // console.warn("获得权重索引:", i);
                return i;
            }
        }

        // console.warn("获得权重索引:", weights.length - 1);
        return weights.length - 1;
    }
}
export let ccTools = new generalTools();
