import { _decorator, AssetManager, Component, director, Director, instantiate, Node, Prefab, Sprite, tween, UITransform, Vec3 } from 'cc';
import { UIBase } from '../UIPage/UIBase';
import { UIBackpack } from '../UIPage/UIBackpack';
import { animationItemPath, audioPath, gamePath, imgPath, ItemPath, spinePath, UIPath } from './pathConfig';
import { ccResTools } from '../extention/resTools';
import { tipsNotice } from '../UIPage/tips/tipsNotice';
import { pData } from './playerData';
import { ccTools } from '../extention/generalTools';
import { audioMgr } from './audioManager';
import { configData, MonetaryType, SaveKey } from './configData';
import { weaponsConfig } from '../json/jsonWeapons';
import { equipmentConfig } from '../json/jsonEquipment';
import { armsConfig } from '../json/jsonArms';
import { soldiersData } from '../data/soldiersData';
import { poolMgr } from './poolManager';
import { mapConfig } from '../json/jsonMap';
import { getItemDataByItemId } from '../json/jsonItemData';
import { signConfig } from '../json/jsonSign';
import { ccStorageTools } from '../extention/storageTools';
import { roleLevelConfig } from '../json/jsonRoleLevel';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
/**统一管理界面缓存、页面切换、预制体加载和奖励动画 */
export class UIManager {
    /**界面与游戏资源所在的资源包 */
    resBundle: AssetManager.Bundle = null;
    /**通用文字提示预制体 */
    tipsPrefab: Prefab = null;
    /**提示2预制体，用于 Boss 击败和奖励提示 */
    tips2Prefab: Prefab = null;
    /**游戏子弹预制体 */
    bulletPrefab: Prefab = null;
    /**游戏连线预制体 */
    gameLinePrefab: Prefab = null;
    /**货币和奖励飞行动画使用的特效预制体 */
    effectItemPrefab: Prefab = null;
    /**游戏通用图片节点预制体 */
    gameSpriteItemPrefab: Prefab = null;
    /**游戏通用文本节点预制体，也用于伤害飘字 */
    gameLabelItemPrefab: Prefab = null;
    /**游戏通用 Spine 动画节点预制体 */
    gameSpineItemPrefab: Prefab = null;
    /**弹壳专用预制体，包含图片和动画资源引用。 */
    bulletShellPrefab: Prefab = null;
    whirlwindPrefab: Prefab = null;
    /**role0 滑铲期间播放的烟雾预制体。 */
    shovelSmokePrefab: Prefab = null;
    /** Bullet impact animation prefab. */
    bulletExplosionPrefab: Prefab = null;
    /**通过 ItemPath.role 加载，供游戏界面创建玩家 */
    rolePrefab: Prefab = null;
    /**通过 ItemPath.soldier 加载，供游戏界面创建士兵 */
    soldierPrefab: Prefab = null;
    /**通过 ItemPath.roleShow 加载，供匹配界面显示角色 */
    roleShowPrefab: Prefab = null;
    /**死亡掉落容器预制体。 */
    supplyBoxPrefab: Prefab = null;
    eliminationBoxPrefab: Prefab = null;
    bossBoxPrefab: Prefab = null;
    /**role1 主动技能使用的无人机预制体。 */
    dronePrefab: Prefab = null;
    /** 圆形技能范围指示器预制体。 */
    skillRangeCirclePrefab: Prefab = null;
    /**矩形技能范围指示器预制体 */
    skillRangeRectPrefab: Prefab = null;
    skillRangeRectLeftPrefab: Prefab = null;
    dragonBreathPrefab: Prefab = null;
    /**角色打药使用的注射器预制体。 */
    syringePrefab: Prefab = null;
    /**开场直升机预制体。 */
    helicopterPrefab: Prefab = null;

    /**游戏页面挂载节点 */
    private gamePage: Node = null;
    /**普通界面挂载节点 */
    private uiPage: Node = null;
    /**提示界面挂载节点 */
    private noticePage: Node = null;
    /**货币和奖励动画挂载节点 */
    private effectNode: Node = null;

    /**以路径末段名称为键缓存界面实例，关闭后保留供再次打开 */
    private uiMap: Map<string, Node> = new Map();
    /**预加载和打开页面共享创建任务，避免并发创建多个实例。 */
    private pageLoadingTasks = new Map<string, Promise<Node>>();
    /**同一页面同时收到多个打开请求时，仅执行一次打开回调。 */
    private pageOpeningTasks = new Map<string, Promise<void>>();
    /**等待依次打开的界面队列 */
    private queuePageArr: queuePageData[] = [];
    /**当前通过队列打开的界面 */
    private currentQueuePage: queuePageData = null;
    /**游戏资源预加载任务，防止匹配页重复打开时并发加载 */
    private gamePreloadPromise: Promise<void> = null;
    /**游戏资源是否已全部预加载 */
    private gamePreloadComplete = false;
    /** 按地图索引缓存加载任务，匹配期间提前加载地图及其依赖。 */
    private mapPreloadTasks = new Map<number, Promise<Prefab>>();

    /**资源请求共享缓存，失败后允许重试。 */
    private prefabTasks = new Map<string, Promise<Prefab>>();
    /**页面创建串行执行，避免多个下载同时完成时集中实例化。 */
    private pageCreationTail: Promise<void> = Promise.resolve();
    private backgroundPreloadVersions = new WeakMap<Component, number>();
    private foregroundItemLoads = 0;

    private parseItemIds(value: string, pairs = false): number[] {
        try {
            const items = JSON.parse(value);
            if (!Array.isArray(items)) return [];
            return items.map(item => pairs ? item?.[0] : item)
                .filter(itemId => Number.isInteger(itemId) && itemId >= 0);
        } catch {
            return [];
        }
    }

    async preLoadItemIcons(itemIds: number[], background = false, isCurrent = () => true) {
        const paths = new Set<string>();
        for (const itemId of itemIds) {
            const data = getItemDataByItemId(itemId);
            if (!data) continue;
            paths.add(ccTools.getItemIconPath(itemId));
            paths.add(imgPath.itemBg + data.quality);
            if (itemId === 200001) paths.add(imgPath.money);
            if (itemId === 200002) paths.add(imgPath.gold);
        }
        const pictures = Array.from(paths).filter(Boolean);
        for (let index = 0; index < pictures.length; index += 4) {
            while (background && this.foregroundItemLoads > 0 && isCurrent()) await this.nextPreloadFrame();
            if (!isCurrent()) return;
            await Promise.all(pictures.slice(index, index + 4)
                .map(path => ccResTools.loadPic(this.resBundle, path, undefined, background)));
            if (background) await this.nextPreloadFrame();
        }
    }

    private getPageItemIds(pagePath: string, data?: any): number[] {
        switch (pagePath) {
            case UIPath.UIMap: {
                const rows = mapConfig.getDataByMapIdx(pData.selectMapData[0]);
                const selected = rows.find(row => row.difficultyType === pData.selectMapData[1]) || rows[0];
                return selected ? [...this.parseItemIds(selected.rewardList), ...this.parseItemIds(selected.equipList)] : [];
            }
            case UIPath.UIStore:
                return weaponsConfig.getAllData().filter(weapon => weapon.kinds === 1 && weapon.isStore === 1)
                    .slice(0, 12).map(weapon => weapon.itemId);
            case UIPath.UIStorehouse:
            case UIPath.UIShowItem:
                return [...pData.equipmentIds, ...pData.getStorehouseData().filter(item => item[1] > 0)
                    .slice(0, 20).map(item => item[0])];
            case UIPath.UIRoleStore: {
                const level = roleLevelConfig.getRoleLevelData(pData.roleId, pData.getRoleLevel(pData.roleId));
                return level ? this.parseItemIds(level.upgradeItem, true) : [];
            }
            case UIPath.UISign: {
                const days = Math.max(0, ccStorageTools.getNumberData(SaveKey.signDays));
                const received = ccStorageTools.getLimitTimeData(SaveKey.isGetSign) === 1;
                const types = signConfig.getTypes();
                const week = Math.floor((received ? Math.max(0, days - 1) : days) / 7);
                return signConfig.getDataByType(types[Math.min(week, types.length - 1)])
                    .map(row => this.parseItemIds(row.reward)[0]).filter(itemId => Number.isInteger(itemId));
            }
            case UIPath.UIReward:
                return (data?.rewardData || []).map(item => item[0]);
            case UIPath.UISuccess:
                return (data?.backpackItems || []).map(item => item[0]);
            case UIPath.UIFail:
                return pData.lostItems.map(item => item[0]);
            default:
                return [];
        }
    }

    private async preLoadPageItems(pagePath: string, data?: any, background = false, isCurrent = () => true) {
        const prefabs: string[] = [];
        if ([UIPath.UIMap, UIPath.UIShowItem, UIPath.UIRoleStore, UIPath.UIFail, UIPath.UISuccess].includes(pagePath as UIPath)) {
            prefabs.push(ItemPath.showItem);
        }
        if (pagePath === UIPath.UIStore) {
            prefabs.push(UIPath.storePage + 1, ItemPath.superWeaponItem, ItemPath.storeItem);
        }
        await Promise.all([
            ...prefabs.map(path => this.preLoadPrefab(path)),
            this.preLoadItemIcons(this.getPageItemIds(pagePath, data), background, isCurrent),
            ...(pagePath === UIPath.UIStore ? Array.from({ length: 5 }, (_, quality) =>
                ccResTools.loadPic(this.resBundle, imgPath.storeItemBg + quality, undefined, background)) : []),
        ]);
    }

    private nextPreloadFrame(): Promise<void> {
        return new Promise(resolve => director.once(Director.EVENT_AFTER_DRAW, () => resolve()));
    }

    preLoadPrefab(path: string): Promise<Prefab> {
        const cached = this.prefabTasks.get(path);
        if (cached) return cached;
        if (!this.resBundle) return Promise.reject(new Error('资源包尚未加载'));
        const task = ccResTools.loadPrefab(this.resBundle, path, false).then(prefab => {
            if (!prefab) throw new Error('加载预制体失败: ' + path);
            return prefab;
        }).catch(error => {
            this.prefabTasks.delete(path);
            throw error;
        });
        this.prefabTasks.set(path, task);
        return task;
    }

    /**每帧最多推进一项后台任务，离开页面后停止后续任务。 */
    private async preLoadInFrames(tasks: Array<() => Promise<unknown>>, isCurrent: () => boolean) {
        for (const task of tasks) {
            await this.nextPreloadFrame();
            while (this.foregroundItemLoads > 0 && isCurrent()) await this.nextPreloadFrame();
            if (!isCurrent()) return;
            try {
                await task();
            } catch (error) {
                console.warn('后台预加载失败，使用时将重试', error);
            }
        }
    }

    /**每次打开页面生成新的批次，旧批次不再继续发起任务。 */
    private beginBackgroundPreload(owner: Component) {
        const version = (this.backgroundPreloadVersions.get(owner) || 0) + 1;
        this.backgroundPreloadVersions.set(owner, version);
        return () => owner.isValid && owner.node.activeInHierarchy
            && this.backgroundPreloadVersions.get(owner) === version;
    }

    /**关闭或重开页面时立即作废其后台批次。 */
    cancelPreload(owner: Component) {
        this.backgroundPreloadVersions.set(owner, (this.backgroundPreloadVersions.get(owner) || 0) + 1);
    }

    /**加载页只等待大厅首屏和通用资源。 */
    async preLoadStartup() {
        await Promise.all([this.preLoadCommonPrefab(), this.preLoadPage(UIPath.UIMain)]);
    }

    /**大厅常用界面按使用优先级分帧准备。 */
    preLoadMainPages(owner: Component) {
        const isCurrent = this.beginBackgroundPreload(owner);
        const paths = [UIPath.UIMap, UIPath.UIMatch, UIPath.UISetting, UIPath.UIReward,
            UIPath.UIRevisit, UIPath.UIStorehouse, UIPath.UIRoleStore, UIPath.UISign,
            UIPath.UIShowItem, UIPath.UIStore, UIPath.UIHandBook];
        return this.preLoadInFrames([
            () => this.preLoadPrefab(ItemPath.showItem),
            () => this.preLoadPageItems(UIPath.UIMap, undefined, true, isCurrent),
            () => this.preLoadPrefab(ItemPath.item),
            ...Array.from({ length: 5 }, (_, quality) => () =>
                ccResTools.loadPic(this.resBundle, imgPath.itemBg + quality, undefined, true)),
            ...paths.map(path => async () => {
                await this.preLoadPageItems(path, undefined, true, isCurrent);
                if (isCurrent()) await this.preLoadPage(path);
            }),
            () => this.preLoadRoleShow(),
            () => this.preLoadPage(gamePath.UIGame),
        ], isCurrent);
    }

    /**局内界面和对象池在后台分帧准备，关闭或重开后停止旧批次。 */
    async preLoadInGamePages(owner: Component) {
        const isCurrent = this.beginBackgroundPreload(owner);
        await this.preLoadInFrames([
            () => this.preLoadPage(UIPath.UIFail),
            () => this.preLoadPage(UIPath.UIBackpack),
            () => this.preLoadPrefab(ItemPath.item),
            () => this.preLoadPage(UIPath.UISmallMap),
            () => this.preLoadPage(UIPath.UISuccess),
            () => this.preLoadPrefab(ItemPath.showItem),
        ], isCurrent);
        try {
            await poolMgr.preWarmCombat({
                bullet: this.bulletPrefab,
                label: this.gameLabelItemPrefab,
                shell: this.bulletShellPrefab,
                explosion: this.bulletExplosionPrefab,
            }, () => this.nextPreloadFrame(), isCurrent);
        } catch (error) {
            console.warn('对象池分帧预热失败', error);
        }
    }

    async preLoadRoleShow() {
        this.roleShowPrefab = await this.preLoadPrefab(ItemPath.roleShow);
    }

    preLoadSmallMap(mapIndex = pData.selectMapData[0]) {
        if (!Number.isInteger(mapIndex) || mapIndex < 0) {
            return Promise.reject(new Error('小地图索引无效: ' + mapIndex));
        }
        return this.preLoadPrefab(ItemPath.smallMap + mapIndex);
    }

    /**匹配确定阵容后准备动态外观，不能只等待角色 Prefab。 */
    private async preLoadRoundAppearance(mapIndex: number, agents: Array<{
        roleId: number; weaponId: number; helmetId: number; armorId: number;
    }>) {
        const roles = new Set([pData.roleId, ...agents.map(agent => agent.roleId)]);
        const weapons = new Set(pData.equipmentIds.slice(0, 3));
        const equipment = new Set(pData.equipmentIds.slice(3, 5));
        const spines = new Set<string>();
        const pictures = new Set<string>();
        for (const agent of agents) {
            weapons.add(agent.weaponId);
            equipment.add(agent.helmetId);
            equipment.add(agent.armorId);
        }
        for (const roleId of roles) {
            spines.add(spinePath.role + roleId);
            pictures.add(imgPath.roleLeftHand + roleId);
            pictures.add(imgPath.roleRightHand + roleId);
            pictures.add(imgPath.activeIcon + roleId);
            pictures.add(imgPath.smallMapAvatar + roleId);
        }
        if (roles.has(0)) spines.add(spinePath.gem);
        if (roles.has(2)) spines.add(spinePath.shield);
        const map = await this.preLoadMap(mapIndex);
        const soldiers = map.data.getChildByName('soldiersList');
        for (const spawn of soldiers?.children || []) {
            const data = spawn.getComponent(soldiersData);
            const arms = data && armsConfig.getDataById(data.armsId);
            if (arms) weapons.add(arms.weaponId);
        }
        if (soldiers?.children.length) {
            for (let id = 0; id < configData.soldierAnimCount; id++) {
                spines.add(spinePath.soldier + id);
                pictures.add(imgPath.soldierLeftHand + id);
                pictures.add(imgPath.soldierRightHand + id);
            }
        }
        if (map.data.getChildByName('bossList')?.children.some(node => node.getComponent('bossController1'))) {
            spines.add(spinePath.swordRain);
        }
        for (const id of weapons) {
            const data = weaponsConfig.getDataByItemId(id);
            if (data) {
                spines.add(spinePath.weapon + data.itemId);
                pictures.add(imgPath.weaponIcon + data.itemId);
            }
        }
        for (const id of equipment) {
            const data = equipmentConfig.getDataByItemId(id);
            if (data) pictures.add(imgPath.equipment + data.itemId);
        }
        // 限制同时加载数量，避免解码任务在同一时刻大量完成。
        const tasks = [
            ...Array.from(spines, path => () => ccResTools.loadSpine(this.resBundle,
                path === spinePath.gem ? path : path + '/animation')),
            ...Array.from(pictures, path => () => ccResTools.loadPic(this.resBundle, path)),
        ];
        for (let index = 0; index < tasks.length; index += 4) {
            const assets = await Promise.all(tasks.slice(index, index + 4).map(task => task()));
            if (assets.some(asset => !asset)) throw new Error('本局角色或武器资源加载失败');
            await this.nextPreloadFrame();
        }
    }

    /**匹配确定阵容后统一准备本局资源，全部完成才可开始游戏。 */
    async preLoadMatch(mapIndex: number, agents: Array<{
        roleId: number; weaponId: number; helmetId: number; armorId: number;
    }>) {
        await Promise.all([
            this.preLoadGame(),
            this.preLoadMap(mapIndex),
            this.preLoadSmallMap(mapIndex),
            this.preLoadRoundAppearance(mapIndex, agents),
        ]);
    }

    preLoadMap(mapIndex = pData.selectMapData[0]): Promise<Prefab> {
        if (!this.resBundle || !Number.isInteger(mapIndex) || mapIndex < 0) {
            return Promise.reject(new Error(`无法预加载地图，索引无效或资源包未加载: ${mapIndex}`));
        }
        const cached = this.mapPreloadTasks.get(mapIndex);
        if (cached) return cached;
        const path = ItemPath.map + mapIndex;
        const task = ccResTools.loadPrefab(this.resBundle, path, false).then((prefab) => {
            if (!prefab) throw new Error(`加载地图预制体失败: ${path}`);
            return prefab;
        }).catch((error) => {
            this.mapPreloadTasks.delete(mapIndex);
            throw error;
        });
        this.mapPreloadTasks.set(mapIndex, task);
        return task;
    }

    /**从场景容器中初始化各类页面和特效的挂载节点 */
    initData(node) {
        this.initPage(node);
    }

    /**获取父节点下的 Game、UI、Notice 和 Effect 容器 */
    initPage(parent) {
        this.gamePage = parent.getChildByName('Game');
        this.uiPage = parent.getChildByName('UI');
        this.noticePage = parent.getChildByName('Notice');
        this.effectNode = parent.getChildByName('Effect');
    }

    /**加载启动后各页面都可能使用的预制体 */
    async preLoadCommonPrefab() {
        if (this.tipsPrefab && this.tips2Prefab && this.effectItemPrefab) {
            return;
        }
        if (!this.resBundle) {
            throw new Error("资源包尚未加载");
        }

        this.tipsPrefab = await ccResTools.loadPrefab(this.resBundle, ItemPath.tips, false);
        if (!this.tipsPrefab) {
            throw new Error(`加载预制体失败: ${ItemPath.tips}`);
        }
        this.tips2Prefab = await ccResTools.loadPrefab(this.resBundle, ItemPath.tips2, false);
        if (!this.tips2Prefab) {
            throw new Error(`加载预制体失败: ${ItemPath.tips2}`);
        }
        this.effectItemPrefab = await ccResTools.loadPrefab(this.resBundle, ItemPath.effectItem, false);
    }

    /**匹配期间准备开战必需资源；并发调用共享任务，失败后允许重试 */
    async preLoadGame() {
        if (this.gamePreloadComplete) {
            return;
        }
        if (this.gamePreloadPromise) {
            return this.gamePreloadPromise;
        }

        this.gamePreloadPromise = this.loadGameResources();
        try {
            await this.gamePreloadPromise;
            this.gamePreloadComplete = true;
        } catch (error) {
            // 清除失败任务，避免后续调用一直复用已失败的 Promise。
            this.gamePreloadPromise = null;
            throw error;
        }
    }

    /**执行游戏资源预加载 */
    private async loadGameResources() {
        if (!this.resBundle) {
            throw new Error("资源包尚未加载");
        }

        await Promise.all([
            this.preLoadPage(gamePath.UIGame),
            this.loadGamePrefab(),
        ]);
    }

    /**并行加载游戏内动态创建的预制体，全部成功后写入公共字段 */
    private async loadGamePrefab() {
        let prefabs = await Promise.all([
            ccResTools.loadPrefab(this.resBundle, ItemPath.bullet, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameLine, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameSpriteItem, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameLabelItem, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.gameSpineItem, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.role, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.soldier, false),
            this.preLoadPrefab(ItemPath.roleShow),
            ccResTools.loadPrefab(this.resBundle, ItemPath.supplyBox, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.eliminationBox, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.bossBox, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.skillRangeCircle, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.syringe, false),
            ccResTools.loadPrefab(this.resBundle, animationItemPath.bulletShell, false),
            ccResTools.loadPrefab(this.resBundle, animationItemPath.whirlwind, false),
            ccResTools.loadPrefab(this.resBundle, animationItemPath.shovelSmoke, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.helicopter, false),
            ccResTools.loadPrefab(this.resBundle, animationItemPath.bomb, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.skillRangeRect, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.skillRangeRectLeft, false),
            ccResTools.loadPrefab(this.resBundle, animationItemPath.dragonBreath, false),
            ccResTools.loadPrefab(this.resBundle, ItemPath.drone, false),
        ]);

        if (prefabs.some((prefab) => !prefab)) {
            throw new Error("游戏预制体加载失败");
        }

        this.bulletPrefab = prefabs[0];
        this.gameLinePrefab = prefabs[1];
        this.gameSpriteItemPrefab = prefabs[2];
        this.gameLabelItemPrefab = prefabs[3];
        this.gameSpineItemPrefab = prefabs[4];
        this.rolePrefab = prefabs[5];
        this.soldierPrefab = prefabs[6];
        this.roleShowPrefab = prefabs[7];
        this.supplyBoxPrefab = prefabs[8];
        this.eliminationBoxPrefab = prefabs[9];
        this.bossBoxPrefab = prefabs[10];
        this.skillRangeCirclePrefab = prefabs[11];
        this.syringePrefab = prefabs[12];
        this.bulletShellPrefab = prefabs[13];
        this.whirlwindPrefab = prefabs[14];
        this.shovelSmokePrefab = prefabs[15];
        this.helicopterPrefab = prefabs[16];
        this.bulletExplosionPrefab = prefabs[17];
        this.skillRangeRectPrefab = prefabs[18];
        this.skillRangeRectLeftPrefab = prefabs[19];
        this.dragonBreathPrefab = prefabs[20];
        this.dronePrefab = prefabs[21];
    }

    /**等待按顺序播放的奖励提示。 */
    private rewardTipsQueue: { message: string, useTips2: boolean }[] = [];
    private isShowingRewardTips = false;

    /**将一组奖励提示加入队列，每隔 1 秒显示下一条。 */
    showRewardTips(messages: string[]) {
        this.enqueueRewardTips(messages, false);
    }

    /**将一组奖励提示加入队列，并使用提示2预制体。 */
    showRewardTips2(messages: string[]) {
        this.enqueueRewardTips(messages, true);
    }

    private enqueueRewardTips(messages: string[], useTips2: boolean) {
        this.rewardTipsQueue.push(...messages.map(message => ({ message, useTips2 })));
        this.showNextRewardTip();
    }

    private showNextRewardTip() {
        if (this.isShowingRewardTips || this.rewardTipsQueue.length === 0) return;
        this.isShowingRewardTips = true;
        const rewardTip = this.rewardTipsQueue.shift();
        if (rewardTip.useTips2) this.showTips2(rewardTip.message);
        else this.showTips(rewardTip.message);
        setTimeout(() => {
            this.isShowingRewardTips = false;
            this.showNextRewardTip();
        }, 1000);
    }

    /**显示提示 */
    showTips(str?) {
        let noticeItem = instantiate(this.tipsPrefab);
        this.noticePage.addChild(noticeItem);

        let notice = noticeItem.getComponent(tipsNotice);
        notice.initData(str);
    }

    /**显示提示2，文字和动画处理与提示1相同 */
    showTips2(str?) {
        let noticeItem = instantiate(this.tips2Prefab);
        this.noticePage.addChild(noticeItem);

        let notice = noticeItem.getComponent(tipsNotice);
        notice.initData(str);
    }

    /**激活已预加载的游戏页面，切换背景音乐并将参数传给 onUI_Open */
    startGame(data?: any) {
        if (!this.resBundle) {
            return;
        }
        let keyName = this.getUIName(gamePath.UIGame);
        if (!this.uiMap.has(keyName)) {
            console.error("游戏页尚未预加载，无法开始游戏");
            return;
        }
        let gameNode = this.uiMap.get(keyName);
        gameNode.active = true;
        this.gamePage.addChild(gameNode);
        let uiComp = gameNode.getComponent(UIBase);
        uiMgr.closePage(UIPath.UIMain);
        audioMgr.closeBackgroundMusic();
        audioMgr.playBackgroundMusic(audioPath.gameBackground);
        uiComp.onUI_Open(data);
    }

    /**清理本局背包并关闭游戏，恢复主页和主页背景音乐 */
    closeGame() {
        this.clearBackpack();
        this.closePage(UIPath.UIBackpack);
        let keyName = this.getUIName(gamePath.UIGame);
        if (this.uiMap.has(keyName)) {
            let uiComp = this.uiMap.get(keyName).getComponent(UIBase);
            uiComp.onUI_Close();
            this.uiMap.get(keyName).active = false;
        }
        audioMgr.closeBackgroundMusic();
        audioMgr.playBackgroundMusic(audioPath.background);
        uiMgr.openPage(UIPath.UIMain);
    }

    /**清除玩家背包数据，并同步重置已创建的背包界面 */
    clearBackpack() {
        pData.clearBackpack();
        const backpackNode = this.uiMap.get(this.getUIName(UIPath.UIBackpack));
        if (backpackNode?.isValid) {
            backpackNode.getComponent(UIBackpack)?.resetBackpack();
        }
    }

    /**加载并实例化界面后缓存，保持隐藏；已缓存的界面直接复用 */
    async preLoadPage(pagePath: string) {
        await this.getOrCreatePage(pagePath);
    }

    private async getOrCreatePage(pagePath: string): Promise<Node> {
        if (!this.resBundle) {
            throw new Error("资源包尚未加载");
        }
        const keyName = this.getUIName(pagePath);
        const cached = this.uiMap.get(keyName);
        if (cached?.isValid) return cached;
        const pending = this.pageLoadingTasks.get(keyName);
        if (pending) return pending;
        const task = (async () => {
            const prefab = await this.preLoadPrefab(pagePath);
            const creation = this.pageCreationTail.then(async () => {
                await this.nextPreloadFrame();
                const node = instantiate(prefab);
                node.active = false;
                this.uiMap.set(keyName, node);
                return node;
            });
            // 某项失败不阻塞后续页面创建。
            this.pageCreationTail = creation.then(() => undefined, () => undefined);
            return creation;
        })();
        this.pageLoadingTasks.set(keyName, task);
        try {
            return await task;
        } finally {
            // 成功和失败都移除任务，失败后允许重试。
            this.pageLoadingTasks.delete(keyName);
        }
    }

    /**复用或加载界面实例，挂载到 UI 容器并调用 onUI_Open(data) */
    async openPage(pagePath: string, data?: any) {
        if (!this.resBundle) {
            return;
        }
        const keyName = this.getUIName(pagePath);
        const pending = this.pageOpeningTasks.get(keyName);
        if (pending) return pending;
        const task = (async () => {
            this.foregroundItemLoads++;
            let pageNode: Node;
            try {
                [pageNode] = await Promise.all([
                    this.getOrCreatePage(pagePath),
                    this.preLoadPageItems(pagePath, data).catch(error => console.warn('界面物品预加载失败', error)),
                ]);
            } finally {
                this.foregroundItemLoads--;
            }
            this.uiPage.addChild(pageNode);
            pageNode.active = true;
            pageNode.getComponent(UIBase).onUI_Open(data);
        })();
        this.pageOpeningTasks.set(keyName, task);
        try {
            await task;
        } finally {
            this.pageOpeningTasks.delete(keyName);
        }
    }

    /**将界面加入队列，关闭当前队列界面后依次打开 */
    openQueuePage(pagePath: string, data?: any) {
        if (!this.resBundle || !pagePath) {
            return;
        }

        this.queuePageArr.push({ pagePath: pagePath, data: data });
        this.openNextQueuePage();
    }

    /**队列中同时只打开一个界面；加载失败时继续处理下一项 */
    private async openNextQueuePage() {
        if (this.currentQueuePage || this.queuePageArr.length == 0) {
            return;
        }

        let queuePage = this.queuePageArr.shift();
        this.currentQueuePage = queuePage;
        try {
            await this.openPage(queuePage.pagePath, queuePage.data);
        } catch (error) {
            console.error(`打开排队界面失败: ${queuePage.pagePath}`, error);
            if (this.currentQueuePage == queuePage) {
                this.currentQueuePage = null;
                this.openNextQueuePage();
            }
        }
    }

    /**调用关闭回调并隐藏、移出界面；保留缓存，队列界面关闭后继续下一项 */
    closePage(pagePath: string) {
        let keyName = this.getUIName(pagePath);
        let isCurrentQueuePage = this.currentQueuePage
            && this.getUIName(this.currentQueuePage.pagePath) == keyName;
        let hasClosedPage = false;
        if (this.uiMap.has(keyName)) {
            let pageNode = this.uiMap.get(keyName);;
            hasClosedPage = pageNode.active;
            let uiComp = pageNode.getComponent(UIBase);
            uiComp.onUI_Close();
            pageNode.active = false;
            //将自己移出父节点但不删除节点
            pageNode.removeFromParent();
        }

        if (isCurrentQueuePage && hasClosedPage) {
            this.currentQueuePage = null;
            this.openNextQueuePage();
        }
    }

    /**页面是否正在显示 */
    isPageOpen(pagePath: string) {
        const pageNode = this.uiMap.get(this.getUIName(pagePath));
        return !!pageNode && pageNode.activeInHierarchy;
    }

    /**取资源路径的最后一段作为界面缓存键 */
    getUIName(str) {
        let strs = str.split('/');
        return strs[strs.length - 1];
    }

    /**货币动画目标位置(世界坐标) */
    moneyTargetPos: Vec3 = new Vec3();
    /**金币动画目标位置(世界坐标) */
    goldTargetPos: Vec3 = new Vec3();

    /**播放货币动画
     * @param rootNode 仅提供货币动画起始世界坐标，不参与尺寸计算
     * @param num 货币数量
     * @param moneyType 货币类型，默认银币
     * @param call 动画完成回调
     */
    playMoneyAnim(rootNode: Node, num: number, moneyType: MonetaryType = MonetaryType.silver, call?) {
        if (num <= 0) {
            return;
        }
        if (!rootNode || !rootNode.isValid || !this.effectNode || !this.effectNode.isValid
            || !this.effectItemPrefab || !this.resBundle) {
            this.fixMonetary(moneyType, num);
            return;
        }

        let effectTransform = this.effectNode.getComponent(UITransform);
        if (!effectTransform) {
            this.fixMonetary(moneyType, num);
            return;
        }

        let startCenter = effectTransform.convertToNodeSpaceAR(rootNode.worldPosition);
        const targetWorldPos = moneyType === MonetaryType.gold ? this.goldTargetPos : this.moneyTargetPos;
        let targetPos = effectTransform.convertToNodeSpaceAR(targetWorldPos);
        if (!this.effectNode.isValid) {
            this.fixMonetary(moneyType, num);
            return;
        }

        audioMgr.playEffect(audioPath.getMoney);
        let itemCount = Math.min(Math.ceil(num / 10), 10);
        let completedCount = 0;

        for (let i = 0; i < itemCount; i++) {
            let effectItem = instantiate(this.effectItemPrefab);
            this.effectNode.addChild(effectItem);

            effectItem.setPosition(startCenter);
            effectItem.setScale(1, 1, 1);

            let sprite = effectItem.getComponent(Sprite);
            if (sprite) {
                const iconPath = moneyType === MonetaryType.gold ? imgPath.gold : imgPath.money;
                ccTools.loadImg(sprite, iconPath);
            }

            let moneyTween = tween(effectItem).delay(i * 0.02);
            if (itemCount > 1) {
                let randomAngle = Math.random() * Math.PI * 2;
                let randomRadius = Math.sqrt(Math.random()) * 200;
                let randomPos = new Vec3(
                    startCenter.x + Math.cos(randomAngle) * randomRadius,
                    startCenter.y + Math.sin(randomAngle) * randomRadius,
                    startCenter.z,
                );
                moneyTween.to(0.1, { position: randomPos }, { easing: 'quadOut' });
            }

            moneyTween
                .to(0.5, { position: targetPos }, { easing: 'quadIn' })
                .call(() => {
                    effectItem.destroy();
                    completedCount++;
                    if (completedCount === itemCount) {
                        this.fixMonetary(moneyType, num);
                        call && call();
                    }
                })
                .start();
        }
    }

    /**增加指定类型的货币 */
    private fixMonetary(moneyType: MonetaryType, num: number) {
        if (moneyType === MonetaryType.gold) {
            pData.fixGold(num);
        } else {
            pData.fixMoney(num);
        }
    }

    /**存储节点 */
    storeNode = null;

    /**播放通用奖励获取动画
     * @param startNode 奖励动画起点及图标节点
     * @param targetNode 奖励动画目标节点
     * @param num 奖励数量
     * @param complete 动画完成回调
     */
    playRewardAnim(startNode: Node, targetNode: Node, num: number, complete?: () => void) {
        if (num <= 0) {
            complete && complete();
            return;
        }
        if (!startNode || !startNode.isValid) {
            console.warn("播放奖励动画失败：起点节点为空或已销毁，请检查节点是否存在于对应父节点下", startNode);
            complete && complete();
            return;
        }
        if (!targetNode || !targetNode.isValid) {
            console.warn("播放奖励动画失败：终点节点为空或已销毁", targetNode);
            complete && complete();
            return;
        }
        if (!this.effectNode || !this.effectNode.isValid || !this.effectItemPrefab) {
            console.warn("播放奖励动画失败：特效节点或特效预制体未就绪");
            complete && complete();
            return;
        }

        let effectTransform = this.effectNode.getComponent(UITransform);
        if (!effectTransform) {
            console.warn("播放奖励动画失败：特效节点缺少UITransform组件");
            complete && complete();
            return;
        }

        //起点和终点允许是未激活（active为false）的节点，此处仅取其世界坐标与图标，
        //未激活节点的世界矩阵可能未刷新，先主动刷新再取世界坐标。
        startNode.updateWorldTransform();
        targetNode.updateWorldTransform();
        let startCenter = effectTransform.convertToNodeSpaceAR(startNode.worldPosition);
        let targetPos = effectTransform.convertToNodeSpaceAR(targetNode.worldPosition);
        let iconSpriteFrame = startNode.getComponent(Sprite)?.spriteFrame;
        let itemCount = num <= 10 ? num : Math.min(Math.ceil(num / 10), 10);
        let completedCount = 0;

        for (let i = 0; i < itemCount; i++) {
            let effectItem = instantiate(this.effectItemPrefab);
            this.effectNode.addChild(effectItem);
            effectItem.setPosition(startCenter);
            effectItem.setScale(1, 1, 1);

            let sprite = effectItem.getComponent(Sprite);
            if (sprite && iconSpriteFrame) {
                sprite.spriteFrame = iconSpriteFrame;
            }

            let rewardTween = tween(effectItem).delay(i * 0.02);
            if (itemCount > 1) {
                let randomAngle = Math.random() * Math.PI * 2;
                let randomRadius = Math.sqrt(Math.random()) * 200;
                let randomPos = new Vec3(
                    startCenter.x + Math.cos(randomAngle) * randomRadius,
                    startCenter.y + Math.sin(randomAngle) * randomRadius,
                    startCenter.z,
                );
                rewardTween.to(0.1, { position: randomPos }, { easing: 'quadOut' });
            }

            rewardTween
                .to(0.5, { position: targetPos }, { easing: 'quadIn' })
                .call(() => {
                    effectItem.destroy();
                    completedCount++;
                    if (completedCount === itemCount) {
                        complete && complete();
                    }
                })
                .start();
        }
    }
}

/**等待按顺序打开的界面及其初始化参数 */
interface queuePageData {
    /**界面预制体资源路径 */
    pagePath: string;
    /**传递给界面 onUI_Open 的参数 */
    data?: any;
}

/**全局共用的界面管理器实例 */
export let uiMgr = new UIManager();
