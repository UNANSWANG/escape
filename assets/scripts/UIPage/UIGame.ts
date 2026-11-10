import { _decorator, AnimationClip, Camera, Canvas, Color, EventKeyboard, EventTouch, Input, input, instantiate, KeyCode, Label, Layout, Node, UITransform, Vec2, Vec3, NodeEventType, director, TiledMap, TiledObjectGroup, Sprite, Tween, UIOpacity, tween, sp, view, Size, PolygonCollider2D, Rect } from 'cc';
import { uiMgr } from '../manager/UIManager';
import { pData } from '../manager/playerData';
import { UIBase } from './UIBase';
import { imgPath, ItemPath, UIPath } from '../manager/pathConfig';
import { BossBookState, configData, floatColorArr, GameEvent, QualityColorArr } from '../manager/configData';
import { gm } from '../manager/gm';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { playerMgr } from '../manager/playerManager';
import { CameraController } from '../controller/CameraController';
import { enemyMgr } from '../manager/enemyManager';
import { audioMgr } from '../manager/audioManager';
import { roleAnimName, roleController } from '../controller/role/roleController';
import { role0Skill2RemainEvent } from '../controller/role/role0';
import { addAIRoleScript, addRoleScript } from '../controller/role/roleScriptFactory';
import { poolMgr } from '../manager/poolManager';
import { containerController } from '../controller/containerController';
import { sniperController } from '../controller/sniperController';
import { gunController } from '../controller/gunController';
import { weaponsConfig } from '../json/jsonWeapons';
import { videoMgr } from '../manager/videoManager';
import { soldiersController } from '../controller/enemy/soldiersController';
import { bossBaseController } from '../controller/enemy/bossBaseController';
import type { EnemyTarget } from '../manager/enemyManager';
import { soldiersData } from '../data/soldiersData';
import { commonConfig } from '../json/jsonCommon';
import { mapConfig } from '../json/jsonMap';
import { bossConfig } from '../json/jsonBoss';
const { ccclass, property } = _decorator;

/** 静态障碍物的世界坐标数据。points 为 null 时直接使用矩形包围盒。 */
export interface StaticCollisionShape {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    points: ReadonlyArray<{ x: number; y: number }> | null;
    edges: ReadonlyArray<{ x: number; y: number; nx: number; ny: number; tx: number; ty: number; length: number }>;
    queryStamp: number;
}

/** 透视区域的世界坐标数据。 */
interface PerspectiveArea {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    points: ReadonlyArray<{ x: number; y: number }>;
}

/** 遮挡物的碰撞检测区域及显示节点。 */
interface ShelterArea {
    colliderTransform: UITransform;
    imgNode: Node;
}

@ccclass('UIGame')
export class UIGame extends UIBase {
    aiRoles: roleController[] = [];

    @property(Node)
    setBtn: Node;

    @property(Node)
    roleNode: Node;

    @property(Node)
    rockerTouchNode: Node;

    @property(Node)
    gameUINode: Node;

    @property(Node)
    shootBtn: Node;

    @property(Node)
    reloadBtn: Node;

    @property(Node)
    skillBtn1: Node;

    @property(Node)
    skillBtn2: Node;

    @property(Node)
    knifeBtn: Node;

    @property(Node)
    bagBtn: Node;

    @property(Node)
    weaponBox_0: Node;

    @property(Node)
    weaponBox_1: Node;

    @property(Node)
    aimingBtn: Node;

    @property(Node)
    openBtn: Node;

    @property(Node)
    drugBtn_0: Node;

    @property(Node)
    drugBtn_1: Node;

    @property(Node)
    mapContainer: Node;

    @property(Label)
    skill2RemainLab: Label;

    @property(Label)
    leaveRemainLab: Label;

    @property(Label)
    gameTimeLab: Label;

    @property(Node)
    leftUINode: Node;

    @property(Node)
    rightUINode: Node;

    @property(Node)
    centerUINode: Node;

    @property(Node)
    timeShowLab: Node;

    @property(Node)
    bossHpBar: Node;

    ///
    ///需要获取的节点
    ///

    ///
    ///属性
    ///
    /**当前移动方向 */
    private currentMoveDirection: Vec3 = new Vec3();
    /**是否正在移动 */
    private isMoving = false;
    /**玩家本次输入请求的方向；技能锁定结束后用它恢复控制。 */
    private inputMoveDirection: Vec3 = new Vec3();
    /**上一帧是否由技能锁定移动方向。 */
    private wasMoveDirectionLocked = false;
    /**摇杆触摸是否正在控制移动；摇杆优先于键盘 */
    private isRockerControlling = false;
    /**当前按住的移动按键（W、A、S、D） */
    private pressedMoveKeys: Set<KeyCode> = new Set();
    /**键盘攻击键是否按住 */
    private isKeyboardAttackPressed = false;
    /**射击按钮是否按住 */
    private isShootButtonPressed = false;
    /**手动瞄准摇杆是否正在控制 */
    private isManualAimControlling = false;
    /**距离下一发子弹的剩余冷却时间（秒） */
    private shootCooldownRemaining = 0;
    /**换弹按钮遮罩。 */
    private reloadMask: Sprite = null;
    /** 当前绑定 reload-start 事件的枪械节点。 */
    private reloadEventGunNode: Node = null;
    /**技能1按钮遮罩。 */
    private skill1Mask: Sprite = null;
    /**技能2按钮遮罩。 */
    private skill2Mask: Sprite = null;
    /**摇杆初始位置 */
    private rockerInitPos: Vec3 = new Vec3(270, -15, 0);
    /**当前是否正在攻击瞄准 */
    private isAttackAiming = false;
    /**本轮持续攻击锁定的目标；离开检测范围后仍保留至松开攻击键 */
    private autoAttackTarget: EnemyTarget = null;
    /**非攻击状态下的角色朝向 */
    private normalFacingRight = false;
    /**地图层相机，用于把瓦片世界坐标转成屏幕坐标 */
    private gameCamera: Camera = null;
    /**地图层相机控制器 */
    private gameCameraComp: CameraController = null;
    /**UI层相机，用于把屏幕坐标转回UI世界坐标 */
    private uiCamera: Camera = null;
    /**游戏摄像机到UI摄像机的视角比例 */
    private gameToUICameraScale = 1;
    /**地图层容器列表，用于存储所有地图层容器节点 */
    private containerList: Node = null;
    /**地图层碰撞体列表，用于存储所有地图层碰撞体节点 */
    private colliderList: Node = null;
    /**玩家进入后需要半透明显示的区域列表 */
    private perspectiveList: Node = null;
    /**玩家进入检测范围后需要隐藏的遮挡物列表 */
    private shelterList: Node = null;
    /**地图中的全部撤离点。 */
    private leaveList: Node = null;
    /**玩家是否正在任意撤离点内。 */
    private isPlayerInLeavePoint = false;
    /**本次撤离剩余时间（秒），离开撤离点后重置。 */
    private leaveRemaining = 0;
    /**本局已经进行的时间（秒），用于结算界面的存活时间。 */
    private survivalTime = 0;
    /**本局距离撤离截止的剩余时间（秒）。 */
    private gameTimeRemaining = 0;
    /**防止倒计时结束后重复打开成功界面。 */
    private isLeaveSuccessTriggered = false;
    /**防止死亡后重复结算。 */
    private isFailTriggered = false;
    /**地图节点，用于存储地图层容器节点 */
    mapNode: Node;

    ///
    ///临时变量，不参与重新开始游戏数据恢复
    ///
    /**触摸点对应的地图世界坐标 */
    private tempTouchWorldPos: Vec3 = new Vec3();
    /**触摸点对应的地图节点本地坐标 */
    private tempTouchMapLocalPos: Vec3 = new Vec3();
    /**玩家每帧移动偏移 */
    private tempPlayerMoveOffset: Vec3 = new Vec3();
    /**地图边界计算复用坐标 */
    private tempMapCenter: Vec3 = new Vec3();
    private tempMapScale: Vec3 = new Vec3();
    private tempMapNodePos: Vec3 = new Vec3();
    private tempMapClampedPos: Vec3 = new Vec3();
    /**手动瞄准摇杆当前方向。 */
    private manualAimDirection: Vec3 = new Vec3();
    /**游戏是否暂停 */
    private isGamePause = false;
    /**落地前屏蔽游戏操作，离场时允许战斗。 */
    private isOpening = false;
    /**撤离演出在战斗暂停期间继续播放。 */
    private isEvacuating = false;
    private openingHelicopter: Node = null;
    private openingSkeleton: sp.Skeleton = null;
    private openingTweens: Tween<any>[] = [];
    /**倒计时从屏幕中央移入常驻位置的补间。 */
    private timeShowTween: Tween<Node> = null;
    private readonly helicopterFlyTime = 1.2;
    private readonly openingDropTime = 0.6;
    /**当前游戏局序号，用于避免异步加载回写旧局 */
    private openVersion = 0;
    /**当前播放中的伤害飘字节点。 */
    private damageFloatNodes: Set<Node> = new Set();
    /**伤害飘字坐标转换复用对象。 */
    private tempDamageFloatWorldPos: Vec3 = new Vec3();
    private tempDamageFloatLocalPos: Vec3 = new Vec3();
    private tempDamageFloatWorldScale: Vec3 = new Vec3();
    /** 当前与玩家重叠的容器 */
    private currentContainer: containerController = null;
    /**是否正在等待药品激励广告结果，防止大小药品按钮重复拉起广告。 */
    private isDrugAdWatching = false;
    /** 静态障碍物使用世界坐标缓存；仅在场景障碍物变化时重建。 */
    private staticColliders: StaticCollisionShape[] = [];
    private readonly collisionCellSize = 256;
    private collisionCells: Map<string, StaticCollisionShape[]> = new Map();
    private collisionQueryStamp = 0;
    private tempColliderLocalPoint = new Vec3();
    private tempColliderWorldPoint = new Vec3();
    private lineCollisionCandidates: StaticCollisionShape[] = [];
    /**地图透视区域的世界坐标缓存。 */
    private perspectiveAreas: PerspectiveArea[] = [];
    private tempPerspectiveWorldPos = new Vec3();
    /**地图遮挡物及其检测区域缓存。 */
    private shelterAreas: ShelterArea[] = [];
    /** 正在追击的 Boss；多个 Boss 同时追击时显示最后进入追击的一个。 */
    private chasingBosses: Set<bossBaseController> = new Set();
    private currentHpBoss: bossBaseController = null;
    private bossNameLab: Label = null;
    private bossAvatarImg: Sprite = null;
    private bossBar: Sprite = null;
    private bossBarBase: Sprite = null;

    protected onLoad(): void {
        this.bossNameLab = this.bossHpBar?.getChildByName('nameLab')?.getComponent(Label);
        this.bossAvatarImg = this.bossHpBar?.getChildByName('avatarImg')?.getComponent(Sprite);
        this.bossBar = this.bossHpBar?.getChildByName('bossBar')?.getComponent(Sprite);
        this.bossBarBase = this.bossHpBar?.getChildByName('bossBarBase')?.getComponent(Sprite);
        this.clearBossHpBar();
        this.bindBtn();
        this.initButtonMasks();
        this.updateSkill2RemainLab(0, false);
        this.leaveRemainLab.node.active = false;
        this.initCamera();
        audioMgr.initSceneAudio(this.node);
    }

    async onUI_Open(data?: any) {
        ++this.openVersion;
        this.addListener();
        this.refreshAimingBtnDisplay();
        this.restartGame();
    }

    onUI_Close(): void {
        audioMgr.stopSceneEffects();
        // 先提升版本号，使本局尚未完成的异步地图加载结果失效
        this.openVersion++;
        this.removeListener();
        this.clearData();
        this.clearMap();
    }

    /**重新开始单局 */
    private async restartGame() {
        // 每次重开都先作废上一局的异步任务并立即清场，不能等新地图加载完成后再清理
        let version = ++this.openVersion;
        this.clearData();
        this.clearMap();
        pData.levelInit();
        this.isGamePause = true;
        this.isOpening = true;
        this.setGameControlsVisible(false);

        try {
            await uiMgr.preLoadGame();
            if (version != this.openVersion || !this.node.activeInHierarchy) return;
            if (!await this.initMap(version)) return;
        } catch (error) {
            if (version == this.openVersion && this.node.activeInHierarchy) {
                console.error('加载游戏资源失败', error);
            }
            return;
        }

        if (version != this.openVersion || !this.node.activeInHierarchy) {
            return;
        }

        this.initData();
    }

    /** 根据所选地图索引加载地图，完成后再初始化本局角色和地图数据。 */
    private async initMap(version: number): Promise<boolean> {
        const mapIndex = pData.selectMapData[0];
        if (!this.mapContainer?.isValid || !Number.isInteger(mapIndex) || mapIndex < 0) {
            console.error('初始化地图失败：地图容器或所选地图索引无效', mapIndex);
            return false;
        }
        const path = ItemPath.map + mapIndex;
        const prefab = await uiMgr.preLoadMap(mapIndex);
        if (version != this.openVersion || !this.node.activeInHierarchy || !this.mapContainer?.isValid) return false;
        if (!prefab) {
            console.error('加载地图预制体失败', path);
            return false;
        }
        const map = instantiate(prefab);
        const bg = map.getChildByName('bg')?.getComponent(UITransform);
        if (!bg || bg.width <= 0 || bg.height <= 0) {
            map.destroy();
            console.error('地图 bg 缺少有效的 UITransform 宽高', path);
            return false;
        }
        this.mapContainer.addChild(map);
        map.setPosition(0, 0, 0);
        this.mapNode = map;
        pData.mapHalfSize = new Vec2(bg.width / 2, bg.height / 2);
        this.gameCameraComp?.setMapBounds(bg.getBoundingBoxToWorld());
        return true;
    }

    private clearMap(): void {
        this.gameCameraComp?.setMapBounds(null);
        if (this.mapContainer?.isValid) ccTools.destroyAllChild(this.mapContainer);
        this.mapNode = null;
        this.containerList = null;
        this.colliderList = null;
        this.perspectiveList = null;
        this.shelterList = null;
        this.leaveList = null;
    }

    /**添加监听 */
    addListener() {
        gm.Event.on(GameEvent.bossChaseChanged, this.onBossChaseChanged, this);
        gm.Event.on(GameEvent.bossHpChanged, this.onBossHpChanged, this);
        gm.Event.on(GameEvent.refreshGameLevel, this.restartGame, this);
        gm.Event.on(GameEvent.refreshGameCamera, this.refreshGameCamera, this);
        gm.Event.on(GameEvent.gamePause, this.onGamePause, this);
        gm.Event.on(GameEvent.gameResume, this.onGameResume, this);
        // 监听键盘按下
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        // 监听触摸事件
        this.rockerTouchNode.on(NodeEventType.TOUCH_START, this.onTouchRockerStart, this);
        this.rockerTouchNode.on(NodeEventType.TOUCH_MOVE, this.onTouchRockerMove, this);
        this.rockerTouchNode.on(NodeEventType.TOUCH_END, this.onTouchRockerEnd, this);
        this.rockerTouchNode.on(NodeEventType.TOUCH_CANCEL, this.onTouchRockerEnd, this);
    }

    /**删除监听 */
    removeListener() {
        gm.Event.off(GameEvent.bossChaseChanged, this.onBossChaseChanged, this);
        gm.Event.off(GameEvent.bossHpChanged, this.onBossHpChanged, this);
        gm.Event.off(GameEvent.refreshGameLevel, this.restartGame, this);
        gm.Event.off(GameEvent.refreshGameCamera, this.refreshGameCamera, this);
        gm.Event.off(GameEvent.gamePause, this.onGamePause, this);
        gm.Event.off(GameEvent.gameResume, this.onGameResume, this);
        // 监听键盘按下
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        // 监听触摸事件
        this.rockerTouchNode.off(NodeEventType.TOUCH_START, this.onTouchRockerStart, this);
        this.rockerTouchNode.off(NodeEventType.TOUCH_MOVE, this.onTouchRockerMove, this);
        this.rockerTouchNode.off(NodeEventType.TOUCH_END, this.onTouchRockerEnd, this);
        this.rockerTouchNode.off(NodeEventType.TOUCH_CANCEL, this.onTouchRockerEnd, this);
    }

    /** 追击开始时切换资料，脱战时回退到仍在追击的 Boss。 */
    private onBossChaseChanged(boss: bossBaseController, isChasing: boolean) {
        if (boss.gameComp !== this) return;
        if (isChasing && boss.hp > 0 && boss.node.activeInHierarchy) {
            this.chasingBosses.delete(boss);
            this.chasingBosses.add(boss);
        } else {
            this.chasingBosses.delete(boss);
        }
        const candidates = Array.from(this.chasingBosses).filter(candidate =>
            candidate.isValid && candidate.node.activeInHierarchy && candidate.hp > 0);
        const next = candidates[candidates.length - 1] ?? null;
        if (next === this.currentHpBoss) return;
        this.currentHpBoss = next;
        if (this.bossHpBar) this.bossHpBar.active = !!next;
        if (this.bossBarBase) Tween.stopAllByTarget(this.bossBarBase);
        if (this.bossAvatarImg) {
            ccTools.cancelAssetLoad(this.bossAvatarImg);
            this.bossAvatarImg.spriteFrame = null;
        }
        if (!next) return;
        if (this.bossNameLab) this.bossNameLab.string = bossConfig.getDataById(next.id)?.name ?? '';
        if (this.bossAvatarImg) void ccTools.loadImg(this.bossAvatarImg, imgPath.bossAvatar + next.id);
        this.onBossHpChanged(next, true);
    }

    /** 实际血条立即更新，扣血虚影以 0.2 秒补间追赶。 */
    private onBossHpChanged(boss: bossBaseController, immediate = false) {
        if (boss !== this.currentHpBoss || !this.bossBar || !this.bossBarBase) return;
        const percent = boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0;
        const reduced = percent < this.bossBar.fillRange;
        this.bossBar.fillRange = percent;
        Tween.stopAllByTarget(this.bossBarBase);
        if (immediate || !reduced) this.bossBarBase.fillRange = percent;
        else tween(this.bossBarBase).to(0.2, { fillRange: percent }, { easing: 'linear' }).start();
    }

    private clearBossHpBar() {
        this.chasingBosses.clear();
        this.currentHpBoss = null;
        if (this.bossHpBar) this.bossHpBar.active = false;
        if (this.bossBarBase) Tween.stopAllByTarget(this.bossBarBase);
        if (this.bossAvatarImg) ccTools.cancelAssetLoad(this.bossAvatarImg);
    }

    bindBtn() {
        this.setBtn.addComponent(zoomButton).onClick = this.clickSetBtn.bind(this);
        const autoAimBtn = this.shootBtn.getChildByName("btn");
        autoAimBtn?.addComponent(zoomButton);
        autoAimBtn?.on(NodeEventType.TOUCH_START, this.onShootButtonStart, this);
        autoAimBtn?.on(NodeEventType.TOUCH_END, this.onShootButtonEnd, this);
        autoAimBtn?.on(NodeEventType.TOUCH_CANCEL, this.onShootButtonEnd, this);

        const aimingRocker = this.shootBtn.getChildByName("rocker");
        aimingRocker?.on(NodeEventType.TOUCH_START, this.onManualAimRockerStart, this);
        aimingRocker?.on(NodeEventType.TOUCH_MOVE, this.onManualAimRockerMove, this);
        aimingRocker?.on(NodeEventType.TOUCH_END, this.onManualAimRockerEnd, this);
        aimingRocker?.on(NodeEventType.TOUCH_CANCEL, this.onManualAimRockerEnd, this);
        this.reloadBtn.addComponent(zoomButton).onClick = this.clickReloadBtn.bind(this);
        this.skillBtn1.addComponent(zoomButton).onClick = this.clickSkillBtn1.bind(this);
        this.skillBtn2.addComponent(zoomButton).onClick = this.clickSkillBtn2.bind(this);
        this.knifeBtn.addComponent(zoomButton).onClick = this.clickKnifeBtn.bind(this);
        this.bagBtn.addComponent(zoomButton).onClick = this.clickBagBtn.bind(this);
        this.openBtn.addComponent(zoomButton).onClick = this.clickOpenContainerBtn.bind(this);
        this.aimingBtn.addComponent(zoomButton).onClick = this.clickAimingBtn.bind(this);
        this.drugBtn_0.addComponent(zoomButton).onClick = this.clickDrugBtn.bind(this, false);
        this.drugBtn_1.addComponent(zoomButton).onClick = this.clickDrugBtn.bind(this, true);

        this.weaponBox_0.on(NodeEventType.TOUCH_END, this.onClickWeaponBox_0, this);
        this.weaponBox_1.on(NodeEventType.TOUCH_END, this.onClickWeaponBox_1, this);
    }

    /**初始化游戏摄像机 */
    initCamera() {
        let gameCamera = this.node.getChildByName("gameCamera");
        this.gameCameraComp = gameCamera?.getComponent(CameraController);
        this.gameCamera = gameCamera?.getComponent(Camera);

        let canvas = director.getScene()?.getChildByName("Canvas")?.getComponent(Canvas);
        this.uiCamera = canvas?.cameraComponent;
        this.updateGameToUICameraScale();
    }

    /**记录游戏摄像机与UI摄像机的视角比例 */
    private updateGameToUICameraScale() {
        if (!this.gameCamera || !this.uiCamera || this.gameCamera.orthoHeight <= 0) {
            this.gameToUICameraScale = 1;
            return;
        }

        this.gameToUICameraScale = this.uiCamera.orthoHeight / this.gameCamera.orthoHeight;
    }

    initData() {
        /**清除数据 */
        this.clearData();

        this.initMapChildNodes();
        this.rebuildStaticColliders();
        this.rebuildPerspectiveAreas();
        this.rebuildShelterAreas();

        this.isOpening = true;
        this.setGameControlsVisible(false);
        this.initRockerArea();
        this.initPlayer();
        this.initGameCountdown();
        this.refreshDrugButtons();
        this.updateContainerOpenButton();

        this.playOpening();

        const [mapIdx, difficultyType] = pData.selectMapData;
        const bossId = mapConfig.getMapData(mapIdx, difficultyType)?.bossId;
        if (Number.isInteger(bossId) && bossId >= 0
            && pData.getBossBookState(bossId) === BossBookState.Locked) {
            pData.setBossBookState(bossId, BossBookState.Unlocked);
        }
    }

    /**从地图节点获取容器和碰撞节点。 */
    private initMapChildNodes() {
        this.containerList = this.mapNode?.getChildByName('containerList') ?? null;
        this.colliderList = this.mapNode?.getChildByName('colliderList') ?? null;
        this.perspectiveList = this.mapNode?.getChildByName('perspectiveList') ?? null;
        this.shelterList = this.mapNode?.getChildByName('shelterList') ?? null;
        this.leaveList = this.mapNode?.getChildByName('leaveList') ?? null;
        const bossList = this.mapNode?.getChildByName('bossList');
        if (bossList) bossList.active = false;
    }

    /** 在死亡位置生成对应盒子，统一归入地图容器列表。 */
    spawnDeathBox(type: 'soldier' | 'ai' | 'boss', worldPosition: Vec3): Node | null {
        if (!this.containerList?.isValid) return null;
        const prefab = type === 'soldier' ? uiMgr.supplyBoxPrefab
            : type === 'ai' ? uiMgr.eliminationBoxPrefab : uiMgr.bossBoxPrefab;
        if (!prefab) return null;
        const boxNode = instantiate(prefab);
        this.containerList.addChild(boxNode);
        boxNode.setWorldPosition(worldPosition);
        return boxNode;
    }

    clearData() {
        this.clearBossHpBar();
        this.unscheduleAllCallbacks();
        this.clearOpening();
        this.clearTimeShowAnimation();
        playerMgr.cameraFollow = false;
        this.gameCameraComp?.unlockCameraPos();
        this.setGameViewScale(1, 0);
        this.isGamePause = false;
        this.isKeyboardAttackPressed = false;
        this.isShootButtonPressed = false;
        this.isManualAimControlling = false;
        this.manualAimDirection.set(0, 0, 0);
        this.resetManualAimRocker();
        this.shootCooldownRemaining = 0;
        this.clearCurrentGunReloadEvent();
        this.stopReloadMaskCooldown();
        this.stopSkillMaskCooldown();
        this.updateSkill2RemainLab(0, false);
        this.stopAutoAim();
        this.clearDamageFloats();
        if (this.openBtn) this.openBtn.active = false;
        this.currentContainer = null;
        this.resetLeaveCountdown();
        this.survivalTime = 0;
        this.gameTimeRemaining = 0;
        this.refreshGameTimeLab();
        this.isLeaveSuccessTriggered = false;
        this.isFailTriggered = false;
        this.staticColliders.length = 0;
        this.collisionCells.clear();
        this.perspectiveAreas.length = 0;
        this.resetShelterVisibility();
        this.shelterAreas.length = 0;
        this.isDrugAdWatching = false;

        ccTools.destroyAllChild(this.roleNode);
        this.aiRoles.length = 0;

        playerMgr.clearPlayer();
        enemyMgr.soldiersArr = [];
        enemyMgr.bossesArr = [];
        enemyMgr.aiRoles = [];
        enemyMgr.soldierId = 0;
        enemyMgr.enemyBornPosArr = [];
        this.rockerReset(true);
    }

    /** colliderList 的直属子节点：有 PolygonCollider2D 时取顶点，否则取 UITransform 矩形。 */
    rebuildStaticColliders() {
        this.staticColliders.length = 0;
        this.collisionCells.clear();
        if (!this.colliderList) return;

        for (const node of this.colliderList.children) {
            if (!node.activeInHierarchy) continue;
            const transform = node.getComponent(UITransform);
            if (!transform) continue;
            const polygon = node.getComponent(PolygonCollider2D);
            const points: Array<{ x: number; y: number }> = [];
            // 组件可以在编辑器中关闭物理计算，顶点仍作为静态数据读取。
            if (polygon && polygon.points.length >= 3) {
                for (const point of polygon.points) {
                    this.pushColliderWorldPoint(node, point.x + polygon.offset.x, point.y + polygon.offset.y, points);
                }
            } else {
                const left = -transform.width * transform.anchorX;
                const bottom = -transform.height * transform.anchorY;
                const right = left + transform.width;
                const top = bottom + transform.height;
                this.pushColliderWorldPoint(node, left, bottom, points);
                this.pushColliderWorldPoint(node, right, bottom, points);
                this.pushColliderWorldPoint(node, right, top, points);
                this.pushColliderWorldPoint(node, left, top, points);
            }

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const point of points) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }
            if (minX >= maxX || minY >= maxY) continue;
            // 没有多边形组件的轴对齐节点只需矩形相交检测。
            const axisAligned = !polygon && points.every((point) =>
                (Math.abs(point.x - minX) < 0.001 || Math.abs(point.x - maxX) < 0.001)
                && (Math.abs(point.y - minY) < 0.001 || Math.abs(point.y - maxY) < 0.001));
            let twiceArea = 0;
            for (let i = 0; i < points.length; i++) {
                const a = points[i], b = points[(i + 1) % points.length];
                twiceArea += a.x * b.y - b.x * a.y;
            }
            const winding = twiceArea >= 0 ? 1 : -1;
            const edges: StaticCollisionShape['edges'][number][] = [];
            for (let i = 0; i < points.length; i++) {
                const a = points[i], b = points[(i + 1) % points.length];
                const length = Math.hypot(b.x - a.x, b.y - a.y);
                if (length <= 0.0001) continue;
                const tx = (b.x - a.x) / length, ty = (b.y - a.y) / length;
                edges.push({ x: a.x, y: a.y, nx: winding * ty, ny: -winding * tx, tx, ty, length });
            }
            const shape: StaticCollisionShape = {
                minX, minY, maxX, maxY, points: axisAligned ? null : points, edges, queryStamp: 0,
            };
            this.staticColliders.push(shape);
            const startX = Math.floor(minX / this.collisionCellSize);
            const endX = Math.floor(maxX / this.collisionCellSize);
            const startY = Math.floor(minY / this.collisionCellSize);
            const endY = Math.floor(maxY / this.collisionCellSize);
            for (let x = startX; x <= endX; x++) {
                for (let y = startY; y <= endY; y++) {
                    const key = `${x},${y}`;
                    let cell = this.collisionCells.get(key);
                    if (!cell) this.collisionCells.set(key, cell = []);
                    cell.push(shape);
                }
            }
        }
    }

    private pushColliderWorldPoint(node: Node, x: number, y: number, points: Array<{ x: number; y: number }>) {
        this.tempColliderLocalPoint.set(x, y, 0);
        Vec3.transformMat4(this.tempColliderWorldPoint, this.tempColliderLocalPoint, node.worldMatrix);
        points.push({ x: this.tempColliderWorldPoint.x, y: this.tempColliderWorldPoint.y });
    }

    /**缓存 perspectiveList 直属子节点的矩形或多边形范围。 */
    private rebuildPerspectiveAreas() {
        this.perspectiveAreas.length = 0;
        if (!this.perspectiveList) return;

        for (const node of this.perspectiveList.children) {
            if (!node.activeInHierarchy) continue;
            const transform = node.getComponent(UITransform);
            if (!transform) continue;

            const polygon = node.getComponent(PolygonCollider2D);
            const points: Array<{ x: number; y: number }> = [];
            if (polygon && polygon.points.length >= 3) {
                for (const point of polygon.points) {
                    this.pushColliderWorldPoint(node, point.x + polygon.offset.x, point.y + polygon.offset.y, points);
                }
            } else {
                const left = -transform.width * transform.anchorX;
                const bottom = -transform.height * transform.anchorY;
                const right = left + transform.width;
                const top = bottom + transform.height;
                this.pushColliderWorldPoint(node, left, bottom, points);
                this.pushColliderWorldPoint(node, right, bottom, points);
                this.pushColliderWorldPoint(node, right, top, points);
                this.pushColliderWorldPoint(node, left, top, points);
            }

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const point of points) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }
            if (minX < maxX && minY < maxY) {
                this.perspectiveAreas.push({ minX, minY, maxX, maxY, points });
            }
        }
    }

    /**玩家和 NPC 分别根据自身所在的透视区域更新透明度。 */
    private updateRolePerspectives() {
        this.updateRolePerspective(playerMgr.player);
        for (const ai of this.aiRoles) {
            this.updateRolePerspective(ai.node, this.isAIHiddenByShelter(ai.node));
        }
        for (const soldier of [...enemyMgr.soldiersArr, ...enemyMgr.bossesArr]) {
            this.updateRolePerspective(soldier?.node);
        }
    }

    /**角色进入任意透视区域时半透明，离开所有区域后恢复不透明。 */
    private updateRolePerspective(roleNode: Node, isHidden = false) {
        if (!roleNode?.isValid) return;
        // 下机期间透明度由开场补间管理，避免透视逻辑提前显示人物。
        if (this.isOpening && roleNode === playerMgr.player) return;
        const opacity = roleNode.getComponent(UIOpacity);
        if (!opacity) return;
        if (isHidden) {
            if (opacity.opacity !== 0) opacity.opacity = 0;
            return;
        }

        roleNode.getWorldPosition(this.tempPerspectiveWorldPos);
        const x = this.tempPerspectiveWorldPos.x;
        const y = this.tempPerspectiveWorldPos.y;
        const isInside = this.perspectiveAreas.some((area) =>
            x >= area.minX && x <= area.maxX && y >= area.minY && y <= area.maxY
            && this.pointInsideStaticPolygon(x, y, area.points));
        const targetOpacity = isInside ? 120 : 255;
        if (opacity.opacity !== targetOpacity) opacity.opacity = targetOpacity;
    }

    private isAIHiddenByShelter(aiNode: Node) {
        if (!aiNode?.isValid) return false;
        const aiTransform = aiNode.getChildByName('colliderBox')?.getComponent(UITransform)
            ?? aiNode.getComponent(UITransform);
        if (!aiTransform) return false;
        const playerNode = playerMgr.player;
        const playerTransform = playerNode?.getChildByName('colliderBox')?.getComponent(UITransform)
            ?? playerNode?.getComponent(UITransform);
        const aiBounds = aiTransform.getBoundingBoxToWorld();
        const playerBounds = playerTransform?.getBoundingBoxToWorld();
        let isInsideShelter = false;
        for (const shelter of this.shelterAreas) {
            if (!shelter.imgNode?.isValid || !shelter.colliderTransform?.isValid) continue;
            const shelterBounds = shelter.colliderTransform.getBoundingBoxToWorld();
            if (!aiBounds.intersects(shelterBounds)) continue;
            isInsideShelter = true;
            if (playerBounds?.intersects(shelterBounds)) return false;
        }
        return isInsideShelter;
    }

    /**缓存 shelterList 直属子节点中的 collider 和 img。 */
    private rebuildShelterAreas() {
        this.shelterAreas.length = 0;
        if (!this.shelterList) return;

        for (const shelterNode of this.shelterList.children) {
            const colliderTransform = shelterNode.getChildByName('collider')?.getComponent(UITransform);
            const imgNode = shelterNode.getChildByName('img');
            if (!colliderTransform || !imgNode) continue;

            imgNode.active = true;
            this.shelterAreas.push({ colliderTransform, imgNode });
        }
    }

    /**玩家与遮挡物检测区域相交时隐藏遮挡物，离开后恢复显示。 */
    private updateShelterVisibility() {
        const playerNode = playerMgr.player;
        const playerTransform = playerNode?.getChildByName('colliderBox')?.getComponent(UITransform)
            ?? playerNode?.getComponent(UITransform);
        if (!playerTransform) {
            this.resetShelterVisibility();
            return;
        }

        const playerBounds = playerTransform.getBoundingBoxToWorld();
        for (const shelter of this.shelterAreas) {
            if (!shelter.imgNode?.isValid || !shelter.colliderTransform?.isValid) continue;
            const isIntersecting = playerBounds.intersects(shelter.colliderTransform.getBoundingBoxToWorld());
            const shouldShow = !isIntersecting;
            if (shelter.imgNode.active !== shouldShow) shelter.imgNode.active = shouldShow;
        }
    }

    /**恢复全部遮挡物的显示状态。 */
    private resetShelterVisibility() {
        for (const shelter of this.shelterAreas) {
            if (shelter.imgNode?.isValid) shelter.imgNode.active = true;
        }
    }

    /** 按移动路径范围取候选；精确碰撞由 roleController 计算。 */
    queryStaticColliders(minX: number, minY: number, maxX: number, maxY: number, out: StaticCollisionShape[]) {
        out.length = 0;
        const stamp = ++this.collisionQueryStamp;
        const startX = Math.floor(minX / this.collisionCellSize);
        const endX = Math.floor(maxX / this.collisionCellSize);
        const startY = Math.floor(minY / this.collisionCellSize);
        const endY = Math.floor(maxY / this.collisionCellSize);
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const cell = this.collisionCells.get(`${x},${y}`);
                if (!cell) continue;
                for (const shape of cell) {
                    if (shape.queryStamp === stamp || shape.maxX <= minX || shape.minX >= maxX
                        || shape.maxY <= minY || shape.minY >= maxY) continue;
                    shape.queryStamp = stamp;
                    out.push(shape);
                }
            }
        }
        return out;
    }

    /**根据玩家与容器的包围盒重合状态显示或隐藏开启按钮 */
    private updateContainerOpenButton() {
        if (!this.openBtn) return;

        const playerNode = playerMgr.player;
        // 角色根节点没有 UITransform，使用脚下阴影的包围盒作为交互范围。
        const playerTransform = playerNode?.getChildByName('shadow')?.getComponent(UITransform)
            ?? playerNode?.getComponent(UITransform);
        if (!playerTransform || !this.containerList) {
            this.openBtn.active = false;
            return;
        }

        const playerBounds = playerTransform.getBoundingBoxToWorld();
        this.currentContainer = null;
        for (const containerNode of this.containerList.children) {
            const container = containerNode.getComponent(containerController);
            if (!containerNode.activeInHierarchy || !container) {
                continue;
            }
            const containerBounds = container.getInteractionBounds();
            if (containerBounds && playerBounds.intersects(containerBounds)) {
                this.currentContainer = container;
                break;
            }
        }

        if (this.openBtn.active !== !!this.currentContainer) {
            this.openBtn.active = !!this.currentContainer;
        }
    }

    /** 判断两点间的世界坐标线段是否穿过地图静态碰撞体。 */
    isWorldSegmentBlocked(x1: number, y1: number, x2: number, y2: number) {
        const padding = 0.01;
        this.queryStaticColliders(Math.min(x1, x2) - padding, Math.min(y1, y2) - padding,
            Math.max(x1, x2) + padding, Math.max(y1, y2) + padding, this.lineCollisionCandidates);
        for (const shape of this.lineCollisionCandidates) {
            if (!this.segmentHitsBounds(x1, y1, x2, y2, shape)) continue;
            if (!shape.points || this.pointInsideStaticPolygon(x1, y1, shape.points)
                || this.pointInsideStaticPolygon(x2, y2, shape.points)) return true;
            for (let i = 0; i < shape.points.length; i++) {
                const a = shape.points[i];
                const b = shape.points[(i + 1) % shape.points.length];
                if (this.staticSegmentsIntersect(x1, y1, x2, y2, a.x, a.y, b.x, b.y)) return true;
            }
        }
        return false;
    }

    private segmentHitsBounds(x1: number, y1: number, x2: number, y2: number, shape: StaticCollisionShape) {
        let enter = 0;
        let exit = 1;
        const dx = x2 - x1;
        const dy = y2 - y1;
        for (let axis = 0; axis < 2; axis++) {
            const origin = axis === 0 ? x1 : y1;
            const delta = axis === 0 ? dx : dy;
            const min = axis === 0 ? shape.minX : shape.minY;
            const max = axis === 0 ? shape.maxX : shape.maxY;
            if (Math.abs(delta) < 0.000001) {
                if (origin < min || origin > max) return false;
                continue;
            }
            const first = (min - origin) / delta;
            const second = (max - origin) / delta;
            enter = Math.max(enter, Math.min(first, second));
            exit = Math.min(exit, Math.max(first, second));
            if (enter > exit) return false;
        }
        return true;
    }

    private pointInsideStaticPolygon(x: number, y: number,
        points: ReadonlyArray<{ x: number; y: number }>) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[i];
            const b = points[j];
            const cross = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
            if (Math.abs(cross) < 0.000001 && x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x)
                && y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y)) return true;
            if ((a.y > y) !== (b.y > y)
                && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    private staticSegmentsIntersect(ax: number, ay: number, bx: number, by: number,
        cx: number, cy: number, dx: number, dy: number) {
        const abx = bx - ax;
        const aby = by - ay;
        const cdx = dx - cx;
        const cdy = dy - cy;
        const denominator = abx * cdy - aby * cdx;
        if (Math.abs(denominator) < 0.000001) return false;
        const acx = cx - ax;
        const acy = cy - ay;
        const alongAB = (acx * cdy - acy * cdx) / denominator;
        const alongCD = (acx * aby - acy * abx) / denominator;
        return alongAB >= 0 && alongAB <= 1 && alongCD >= 0 && alongCD <= 1;
    }

    /**记录开场补间，统一处理暂停和清理。 */
    private startOpeningTween(action: Tween<any>) {
        this.openingTweens.push(action);
        action.start();
        if (gm.isGamePause && !this.isEvacuating) action.pause();
    }

    private clearOpening() {
        for (const action of this.openingTweens) action.stop();
        this.openingTweens.length = 0;
        this.openingSkeleton = null;
        if (this.openingHelicopter?.isValid) this.openingHelicopter.destroy();
        this.openingHelicopter = null;
        this.isOpening = false;
        this.isEvacuating = false;
    }

    /**按相机边界计算离屏位置，额外留出整个机身和旋翼的宽度。 */
    private getHelicopterOffscreenX(side: -1 | 1) {
        const size = view.getVisibleSize();
        const halfWidth = (this.gameCamera?.orthoHeight ?? size.height / 2) * size.width / Math.max(1, size.height);
        const centerX = this.gameCamera?.node.worldPosition.x ?? playerMgr.player.worldPosition.x;
        const scale = this.openingHelicopter?.worldScale.x ?? 1;
        return centerX + side * (halfWidth + 800 * Math.abs(scale));
    }

    /**用 endPos 对齐出生点，开场看向 showPos，人物显示后跟随下落。 */
    private playOpening() {
        const player = playerMgr.player;
        const landingPos = player.worldPosition.clone();
        playerMgr.cameraFollow = false;
        const helicopter = instantiate(uiMgr.helicopterPrefab);
        this.openingHelicopter = helicopter;
        this.roleNode.addChild(helicopter);
        // 同一角色层中，人物排在直升机之后渲染，避免下机时被机身遮住。
        helicopter.setSiblingIndex(player.getSiblingIndex());
        const skeleton = helicopter.getComponentInChildren(sp.Skeleton);
        const showPos = helicopter.getChildByName('showPos');
        const endPos = helicopter.getChildByName('endPos');
        if (!skeleton || !showPos || !endPos
            || ['idle', 'open', 'idle2', 'close'].some(name => !skeleton.findAnimation(name))) {
            console.error('直升机开场缺少动画或 showPos/endPos 挂点');
            this.clearOpening();
            this.finishOpening();
            return;
        }
        this.openingSkeleton = skeleton;
        const targetPos = helicopter.worldPosition.clone().add(landingPos).subtract(endPos.worldPosition);
        // 先放到到达位置再获取挂点世界坐标，避免使用预制体的初始位置。
        helicopter.setWorldPosition(targetPos);
        const cameraPos = landingPos.clone();
        cameraPos.y = showPos.worldPosition.y;
        if (this.gameCamera?.node.parent) this.gameCamera.node.parent.inverseTransformPoint(cameraPos, cameraPos);
        this.gameCameraComp?.lockCameraPos(cameraPos);
        helicopter.setWorldPosition(new Vec3(Math.max(this.getHelicopterOffscreenX(1), targetPos.x + 800), targetPos.y, targetPos.z));
        skeleton.setAnimation(0, 'idle', true);
        if (gm.isGamePause) skeleton.timeScale = 0;
        const version = this.openVersion;
        const isCurrent = () => version === this.openVersion && this.openingHelicopter === helicopter && helicopter.isValid;
        this.startOpeningTween(tween(helicopter).to(this.helicopterFlyTime, { worldPosition: targetPos }, { easing: 'sineOut' }).call(() => {
            if (!isCurrent()) return;
            const showWorld = showPos.worldPosition.clone();
            const opacity = player.getComponent(UIOpacity);
            const showStart = showWorld.clone();
            showStart.x += 20 * Math.abs(helicopter.worldScale.x);
            player.setWorldPosition(showStart);
            const openEntry = skeleton.setAnimation(0, 'open', false);
            let opened = false;
            let shown = false;
            const drop = () => {
                if (!isCurrent() || !opened || !shown) return;
                this.startOpeningTween(tween(player).to(this.openingDropTime, { worldPosition: endPos.worldPosition.clone() }, { easing: 'quadIn' }).call(() => {
                    if (!isCurrent()) return;
                    this.finishOpening();
                    const closeEntry = skeleton.setAnimation(0, 'close', false);
                    skeleton.setTrackCompleteListener(closeEntry, () => {
                        if (!isCurrent()) return;
                        skeleton.setAnimation(0, 'idle', true);
                        const exitPos = helicopter.worldPosition.clone();
                        exitPos.x = Math.min(this.getHelicopterOffscreenX(-1), exitPos.x - 800);
                        this.startOpeningTween(tween(helicopter).to(this.helicopterFlyTime, { worldPosition: exitPos }, { easing: 'sineIn' }).call(() => {
                            if (isCurrent()) this.clearOpening();
                        }));
                    });
                }));
            };
            skeleton.setTrackCompleteListener(openEntry, () => {
                if (!isCurrent()) return;
                skeleton.setAnimation(0, 'idle2', true);
                opened = true;
                drop();
            });
            this.startOpeningTween(tween(player).delay(0.1).call(() => {
                if (!isCurrent()) return;
                this.startOpeningTween(tween(opacity).to(0.2, { opacity: 255 }));
            }).to(0.2, { worldPosition: showWorld }).call(() => {
                if (!isCurrent()) return;
                shown = true;
                this.gameCameraComp?.unlockCameraPos();
                playerMgr.cameraFollow = true;
                drop();
            }));
        }));
    }

    /**撤离计时结束后暂停战斗，飞机登机演出结束才结算。 */
    private playEvacuation() {
        // 也取消仍未离场的开场飞机，避免两架飞机及旧回调重叠。
        this.clearOpening();
        gm.gamePause();
        this.isGamePause = true;
        this.isOpening = true;
        this.isEvacuating = true;
        this.setGameControlsVisible(false);
        this.leaveRemainLab.node.active = false;
        uiMgr.closePage(UIPath.UIBackpack);
        playerMgr.cameraFollow = false;
        this.gameCameraComp?.lockCameraPos(this.gameCamera.node.position.clone());
        playerMgr.playerComp?.interruptDrugUse();
        playerMgr.playerComp?.playRoleAnim(roleAnimName.idle, true);

        const player = playerMgr.player;
        const helicopter = instantiate(uiMgr.helicopterPrefab);
        this.openingHelicopter = helicopter;
        this.roleNode.addChild(helicopter);
        helicopter.setSiblingIndex(player.getSiblingIndex());
        const skeleton = helicopter.getComponentInChildren(sp.Skeleton);
        const showPos = helicopter.getChildByName('showPos');
        const endPos = helicopter.getChildByName('endPos');
        const version = this.openVersion;
        const isCurrent = () => version === this.openVersion && this.openingHelicopter === helicopter && helicopter.isValid;
        const complete = () => {
            if (!isCurrent()) return;
            this.clearOpening();
            // 成功页出现前持续屏蔽输入，直到关闭本局。
            this.isOpening = true;
            const backpackItems = pData.backpackItems.map(([itemId, num]) => [itemId, num]);
            pData.moveBackpackItemsToStorehouse();
            uiMgr.openPage(UIPath.UISuccess, {
                survivalTime: this.survivalTime,
                skinId: pData.skinId,
                backpackItems,
            });
        };
        if (!skeleton || !showPos || !endPos
            || ['idle', 'open', 'idle2', 'close'].some(name => !skeleton.findAnimation(name))) {
            console.error('撤离直升机缺少动画或 showPos/endPos 挂点');
            complete();
            return;
        }
        this.openingSkeleton = skeleton;
        // 用梯子底部对齐人物当前位置，人物无需先走到屏幕中心。
        const targetPos = helicopter.worldPosition.clone().add(player.worldPosition).subtract(endPos.worldPosition);
        helicopter.setWorldPosition(new Vec3(this.getHelicopterOffscreenX(1), targetPos.y, targetPos.z));
        skeleton.setAnimation(0, 'idle', true);
        this.startOpeningTween(tween(helicopter).to(this.helicopterFlyTime, { worldPosition: targetPos }, { easing: 'sineOut' }).call(() => {
            if (!isCurrent()) return;
            const openEntry = skeleton.setAnimation(0, 'open', false);
            skeleton.setTrackCompleteListener(openEntry, () => {
                if (!isCurrent()) return;
                skeleton.setAnimation(0, 'idle2', true);
                const opacity = player.getComponent(UIOpacity) ?? player.addComponent(UIOpacity);
                this.startOpeningTween(tween(player)
                    .to(this.openingDropTime, { worldPosition: showPos.worldPosition.clone() }, { easing: 'quadOut' })
                    .call(() => {
                        if (!isCurrent()) return;
                        const hiddenPos = showPos.worldPosition.clone();
                        hiddenPos.x += 20 * Math.abs(helicopter.worldScale.x);
                        this.startOpeningTween(tween(player).to(0.2, { worldPosition: hiddenPos }));
                        this.startOpeningTween(tween(opacity).to(0.2, { opacity: 0 }).call(() => {
                            if (!isCurrent()) return;
                            const closeEntry = skeleton.setAnimation(0, 'close', false);
                            skeleton.setTrackCompleteListener(closeEntry, () => {
                                if (!isCurrent()) return;
                                skeleton.setAnimation(0, 'idle', true);
                                const exitPos = helicopter.worldPosition.clone();
                                exitPos.x = this.getHelicopterOffscreenX(-1);
                                this.startOpeningTween(tween(helicopter).to(this.helicopterFlyTime, { worldPosition: exitPos }, { easing: 'sineIn' }).call(complete));
                            });
                        }));
                    }));
            });
        }));
    }

    /**开场隐藏操作界面，落地恢复控制时统一显示。 */
    private setGameControlsVisible(visible: boolean) {
        for (const node of [this.leftUINode, this.rightUINode, this.centerUINode, this.rockerTouchNode]) {
            if (node?.isValid) node.active = visible;
        }
    }

    /**UI显示后，先在中央展示倒计时，再移入常驻位置。 */
    private playTimeShowAnimation(): void {
        this.clearTimeShowAnimation();
        if (!this.timeShowLab?.isValid || !this.gameTimeLab?.isValid || !this.timeShowLab.parent) return;

        this.timeShowLab.setPosition(0, 140, 0);
        this.timeShowLab.setScale(1, 1, 1);
        this.timeShowLab.active = true;
        this.refreshTimeShowLab();
        this.gameTimeLab.node.active = false;

        // 目标节点可能在其他父节点下，先转换到展示节点的父节点坐标系。
        const targetPosition = new Vec3();
        this.timeShowLab.parent.inverseTransformPoint(targetPosition, this.gameTimeLab.node.worldPosition);
        this.timeShowTween = tween(this.timeShowLab)
            .delay(1.2)
            .to(0.3, { position: targetPosition, scale: new Vec3(0.5, 0.5, 1) })
            .call(() => {
                this.timeShowTween = null;
                this.timeShowLab.active = false;
                this.gameTimeLab.node.active = true;
            });
        this.timeShowTween.start();
        if (gm.isGamePause) this.timeShowTween.pause();
    }

    /**重开或关闭游戏页时，停止动画并恢复节点显示状态。 */
    private clearTimeShowAnimation(): void {
        this.timeShowTween?.stop();
        this.timeShowTween = null;
        if (this.timeShowLab?.isValid) this.timeShowLab.active = false;
        if (this.gameTimeLab?.isValid) this.gameTimeLab.node.active = true;
    }

    /**展示期间同步倒计时文字与颜色。 */
    private refreshTimeShowLab(): void {
        if (!this.timeShowLab?.active) return;
        const label = this.timeShowLab.getComponent(Label);
        if (!label) return;
        label.string = `撤离倒计时:${this.gameTimeLab.string}`;
        if (!label.color.equals(this.gameTimeLab.color)) {
            label.color = this.gameTimeLab.color;
        }
    }

    /**落地后再创建敌人，开场期间既不显示也不运行 AI。 */
    private finishOpening() {
        this.isOpening = false;
        this.setGameControlsVisible(true);
        this.playTimeShowAnimation();
        playerMgr.player.getComponent(UIOpacity).opacity = 255;
        this.rockerReset(true);
        this.gameCameraComp?.unlockCameraPos();
        playerMgr.cameraFollow = true;
        this.initAI();
        this.initSoldier();
        this.initBoss();
        // 敌人创建完成后，将玩家放到父节点的最后一层。
        playerMgr.player.setSiblingIndex(this.roleNode.children.length - 1);
        this.updateRolePerspectives();
        this.updateShelterVisibility();
    }

    /**初始化玩家 */
    initPlayer() {
        playerMgr.player = instantiate(uiMgr.rolePrefab);
        const opacity = playerMgr.player.getComponent(UIOpacity) ?? playerMgr.player.addComponent(UIOpacity);
        opacity.opacity = 0;
        this.roleNode.addChild(playerMgr.player);
        playerMgr.cameraFollow = false;
        this.initRolePos(playerMgr.player);
        this.keepNodeInsideMap(playerMgr.player);
        const roleComp = addRoleScript(playerMgr.player, pData.roleId);
        playerMgr.setPlayerComp(roleComp);
        roleComp.node.on('skill-cooldown-start', this.playSkillMaskCooldown, this);
        roleComp.node.on(role0Skill2RemainEvent, this.updateSkill2RemainLab, this);
        roleComp.init(this, pData.roleId, 0);
        this.refreshWeaponNames();
        this.refreshWeaponNums();
        this.bindCurrentGunReloadEvent();
        roleComp.onCurrentWeaponEquipped();
        this.updateRolePerspectives();
    }

    private initAI() {
        const [mapIdx, difficultyType] = pData.selectMapData;
        const gameNumber = Number(mapConfig.getMapData(mapIdx, difficultyType)?.gameNumber);
        const aiCount = Number.isFinite(gameNumber) ? Math.max(0, Math.floor(gameNumber) - 1) : 0;
        if (!aiCount) return;

        const bornList = this.mapNode?.getChildByName('aiBornList');
        const bornPoints = bornList?.children.filter(point => point.activeInHierarchy
            && !point.worldPosition.equals(playerMgr.player.worldPosition)) ?? [];
        if (!bornPoints.length) {
            console.warn('地图缺少有效的 AI 出生点，无法生成 AI');
            return;
        }
        if (bornPoints.length < aiCount) console.warn('AI 出生点不足，将重复使用出生点');

        const availablePoints = bornPoints.slice();
        for (let index = 0; index < aiCount; index++) {
            const agentData = playerMgr.matchedAIRoles[index];
            if (!agentData) {
                console.warn(`缺少匹配阶段的第 ${index + 1} 个 AI 配置`);
                continue;
            }
            const roleId = agentData.roleId;
            if (!availablePoints.length) availablePoints.push(...bornPoints);
            const pointIndex = Math.floor(Math.random() * availablePoints.length);
            const bornPoint = availablePoints.splice(pointIndex, 1)[0];
            const aiNode = instantiate(uiMgr.rolePrefab);
            aiNode.name = `ai_${index + 1}`;
            this.roleNode.addChild(aiNode);
            aiNode.setWorldPosition(bornPoint.worldPosition);
            this.keepNodeInsideMap(aiNode);
            const aiComp = addAIRoleScript(aiNode, roleId);
            aiComp.setAIEquipment(agentData.weaponId, agentData.helmetId, agentData.armorId);
            const detectRange = Number(agentData.detectRange);
            aiComp.aiDetectRange = Number.isFinite(detectRange) ? Math.max(0, detectRange) : 0;
            const damageRatio = Number(agentData.damageRatio);
            aiComp.aiDamageRatio = Number.isFinite(damageRatio) ? Math.max(0, damageRatio) : 1;
            const attackIntervalRatio = Number(agentData.attackIntervalRatio);
            aiComp.aiAttackIntervalRatio = Number.isFinite(attackIntervalRatio) ? Math.max(0, attackIntervalRatio) : 1;
            aiComp.init(this, roleId, agentData.skinId, agentData.nickname);
            this.aiRoles.push(aiComp);
            enemyMgr.aiRoles.push(aiComp);
        }
        this.updateRolePerspectives();
    }

    /** 武器切换后，将换弹 UI 事件绑定到当前枪械，并移除旧枪监听。 */
    private bindCurrentGunReloadEvent() {
        this.clearCurrentGunReloadEvent();
        const gunNode = playerMgr.playerComp?.gunController?.node ?? null;
        gunNode?.on('reload-start', this.playReloadMaskCooldown, this);
        gunNode?.on('ammo-change', this.refreshWeaponNums, this);
        this.reloadEventGunNode = gunNode;
        if (this.reloadBtn) this.reloadBtn.active = !!gunNode;
    }

    /** 安全移除旧枪的换弹事件；节点已销毁时不能再调用其 off。 */
    private clearCurrentGunReloadEvent() {
        if (this.reloadEventGunNode?.isValid) {
            this.reloadEventGunNode.off('reload-start', this.playReloadMaskCooldown, this);
            this.reloadEventGunNode.off('ammo-change', this.refreshWeaponNums, this);
        }
        this.reloadEventGunNode = null;
    }

    /**按地图中 soldiersList 的子节点生成小兵 */
    private initSoldier() {
        const soldiersList = this.mapNode?.getChildByName('soldiersList');
        if (!uiMgr.soldierPrefab || !soldiersList || !this.roleNode) return;

        for (const spawnNode of soldiersList.children) {
            const data = spawnNode.getComponent(soldiersData);
            const soldierId = enemyMgr.soldierId++;
            const soldierNode = instantiate(uiMgr.soldierPrefab);
            this.roleNode.addChild(soldierNode);
            soldierNode.setWorldPosition(spawnNode.worldPosition);
            this.keepNodeInsideMap(soldierNode);

            const soldierComp = soldierNode.getComponent(soldiersController);
            if (soldierComp) {
                soldierComp.init(this, soldierId, data.armsId, data);
                enemyMgr.soldiersArr.push(soldierComp);
            }
        }
    }

    /** bossList 子节点作为模板，复制到角色层，在原点位站岗。 */
    private initBoss() {
        const bossList = this.mapNode?.getChildByName('bossList');
        if (!bossList || !this.roleNode) return;
        // 隐藏模板，防止与运行中的 Boss 重复显示；重新开局时仍可复用模板。
        bossList.active = false;
        for (const template of bossList.children) {
            if (!template.active || !template.getComponent(bossBaseController)) continue;
            const bossNode = instantiate(template);
            this.roleNode.addChild(bossNode);
            bossNode.setWorldPosition(template.worldPosition);
            this.keepNodeInsideMap(bossNode);
            const boss = bossNode.getComponent(bossBaseController);
            boss.init(this);
            enemyMgr.bossesArr.push(boss);
        }
    }

    /**从地图 bornList 的有效子节点中随机选择玩家出生点。 */
    initRolePos(node: Node) {
        const bornList = this.mapNode?.getChildByName('bornList');
        const bornPoints = bornList?.children.filter(point => point.activeInHierarchy) ?? [];
        if (!bornPoints.length) {
            node.setPosition(Vec3.ZERO);
            return;
        }

        const bornPoint = bornPoints[Math.floor(Math.random() * bornPoints.length)];
        node.setWorldPosition(bornPoint.worldPosition);
    }

    /**将节点目标位置限制在地图内，按脚下 colliderBox 保留人物体积。 */
    clampWorldPointToMap(node: Node, target: Vec3, out: Vec3) {
        out.set(target);
        if (!this.mapNode || !node || pData.mapHalfSize.x <= 0 || pData.mapHalfSize.y <= 0) return out;

        this.mapNode.getWorldPosition(this.tempMapCenter);
        this.mapNode.getWorldScale(this.tempMapScale);
        node.getWorldPosition(this.tempMapNodePos);
        const colliderBounds = node.getChildByName('colliderBox')
            ?.getComponent(UITransform)?.getBoundingBoxToWorld();
        const left = colliderBounds ? this.tempMapNodePos.x - colliderBounds.x : 0;
        const right = colliderBounds
            ? colliderBounds.x + colliderBounds.width - this.tempMapNodePos.x : 0;
        const bottom = colliderBounds ? this.tempMapNodePos.y - colliderBounds.y : 0;
        const top = colliderBounds
            ? colliderBounds.y + colliderBounds.height - this.tempMapNodePos.y : 0;
        const halfWidth = pData.mapHalfSize.x * Math.abs(this.tempMapScale.x);
        const halfHeight = pData.mapHalfSize.y * Math.abs(this.tempMapScale.y);
        const minX = this.tempMapCenter.x - halfWidth + left;
        const maxX = this.tempMapCenter.x + halfWidth - right;
        const minY = this.tempMapCenter.y - halfHeight + bottom;
        const maxY = this.tempMapCenter.y + halfHeight - top;
        out.x = minX <= maxX ? Math.max(minX, Math.min(maxX, target.x)) : this.tempMapCenter.x;
        out.y = minY <= maxY ? Math.max(minY, Math.min(maxY, target.y)) : this.tempMapCenter.y;
        return out;
    }

    /**校正人物当前坐标，避免玩家移动或其他位移越过地图边缘。 */
    keepNodeInsideMap(node: Node) {
        if (!node) return;
        const current = node.worldPosition;
        this.clampWorldPointToMap(node, current, this.tempMapClampedPos);
        if (this.tempMapClampedPos.x !== current.x || this.tempMapClampedPos.y !== current.y) {
            node.setWorldPosition(this.tempMapClampedPos);
        }
    }

    /**在受击目标头顶播放伤害飘字，动画结束后回收至标签对象池。 */
    showDamageFloat(targetNode: Node, damage: number) {
        this.showHpFloat(targetNode, damage, false);
    }

    /**在玩家头顶播放实际治疗量。 */
    showHealFloat(targetNode: Node, healAmount: number) {
        this.showHpFloat(targetNode, healAmount, true);
    }

    /**共用生命变化飘字动画，每次设置颜色以避免对象池复用时残留。 */
    private showHpFloat(targetNode: Node, damage: number, isHeal: boolean) {
        if (!targetNode?.isValid || !Number.isFinite(damage) || damage <= 0
            || !this.gameUINode?.isValid || !uiMgr.gameLabelItemPrefab) {
            return;
        }

        const uiTransform = this.gameUINode.getComponent(UITransform);
        if (!uiTransform) return;

        const targetBodyNode = targetNode.getChildByName('roleAnim') || targetNode;
        targetBodyNode.updateWorldTransform();
        targetBodyNode.getWorldPosition(this.tempDamageFloatWorldPos);
        targetBodyNode.getWorldScale(this.tempDamageFloatWorldScale);
        const targetTransform = targetBodyNode.getComponent(UITransform);
        const targetHeight = targetTransform?.height ?? 100;
        const topOffset = targetHeight * (1 - (targetTransform?.anchorY ?? 0.5));
        // 以人物顶部向下 10 像素为飘字基准高度。
        this.tempDamageFloatWorldPos.y += topOffset * Math.abs(this.tempDamageFloatWorldScale.y) - 10;
        uiTransform.convertToNodeSpaceAR(this.tempDamageFloatWorldPos, this.tempDamageFloatLocalPos);

        const floatNode = poolMgr.getGameLabelNode(uiMgr.gameLabelItemPrefab);
        const label = poolMgr.getGameNodeLabel(floatNode);
        if (!label) {
            poolMgr.putGameLabelNode(floatNode);
            return;
        }

        this.gameUINode.addChild(floatNode);
        // 在人物中心横向 ±30 像素内生成，飞行方向以竖直向上为 0°，随机偏转 ±45°。
        const spawnOffsetX = (Math.random() * 2 - 1) * 30;
        const flyAngle = (Math.random() * 90 - 45) * Math.PI / 180;
        const flyOffsetX = Math.tan(flyAngle) * 80;
        floatNode.setPosition(this.tempDamageFloatLocalPos.x + spawnOffsetX, this.tempDamageFloatLocalPos.y, 0);
        floatNode.setScale(0.8, 0.8, 1);
        label.string = isHeal ? `+${Math.ceil(damage)}` : `${Math.ceil(damage)}`;
        label.color = new Color(floatColorArr[isHeal ? 0 : 1]);

        const opacity = floatNode.getComponent(UIOpacity) || floatNode.addComponent(UIOpacity);
        opacity.opacity = 255;
        this.damageFloatNodes.add(floatNode);
        tween(floatNode)
            .by(0.1, { position: new Vec3(flyOffsetX * 0.2, 16, 0), scale: new Vec3(0.3, 0.3, 0) })
            .by(0.5, { position: new Vec3(flyOffsetX * 0.8, 64, 0) }, { easing: 'quadOut' })
            .call(() => this.recycleDamageFloat(floatNode))
            .start();
        tween(opacity)
            .delay(0.1)
            .to(0.5, { opacity: 0 })
            .start();
    }

    /**回收单个伤害飘字。 */
    private recycleDamageFloat(floatNode: Node) {
        if (!this.damageFloatNodes.delete(floatNode)) return;
        poolMgr.putGameLabelNode(floatNode);
    }

    /**清理当前局尚未结束的伤害飘字。 */
    private clearDamageFloats() {
        for (const floatNode of this.damageFloatNodes) {
            poolMgr.putGameLabelNode(floatNode);
        }
        this.damageFloatNodes.clear();
    }

    /**初始化摇杆区域 */
    initRockerArea() {
        let visibleSize = view.getVisibleSize();
        let rockerTrans = this.rockerTouchNode.getComponent(UITransform);
        rockerTrans.setContentSize(visibleSize.width / 2 - 320, rockerTrans.height);
    }

    /**响应全局游戏暂停 */
    private onGamePause() {
        this.timeShowTween?.pause();
        for (const action of this.openingTweens) action.pause();
        if (this.openingSkeleton?.isValid) this.openingSkeleton.timeScale = 0;
        this.isGamePause = true;
        this.isKeyboardAttackPressed = false;
        this.isShootButtonPressed = false;
        this.isManualAimControlling = false;
        this.manualAimDirection.set(0, 0, 0);
        this.resetManualAimRocker();
        this.syncPlayerAttackHeldState();
        this.stopAutoAim();
        this.rockerReset(true);
    }

    /**响应全局游戏继续 */
    private onGameResume() {
        this.timeShowTween?.resume();
        for (const action of this.openingTweens) action.resume();
        if (this.openingSkeleton?.isValid) this.openingSkeleton.timeScale = 1;
        if (this.isEvacuating) gm.isGamePause = true;
        this.isGamePause = this.isEvacuating;
    }

    /**摇杆归位 */
    rockerReset(clearKeyboard = false) {
        if (clearKeyboard) {
            this.pressedMoveKeys.clear();
        }
        this.isRockerControlling = false;
        this.inputMoveDirection.set(0, 0, 0);

        let rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        let rockerPoint = rockerNode.getChildByName("rockerPoint");
        rockerNode.setPosition(this.rockerInitPos);
        rockerPoint.position = Vec3.ZERO;

        if (this.isMoveDirectionLocked()) return;
        if (!this.refreshKeyboardMove()) {
            this.isMoving = false;
            this.currentMoveDirection.set(0, 0, 0);
            playerMgr.playerComp?.playRoleAnim(roleAnimName.idle, true);
        }
    }

    protected update(dt: number): void {
        if (this.isGamePause || this.isOpening) {
            return;
        }

        if (playerMgr.playerComp && playerMgr.playerComp.hp <= 0) {
            this.onPlayerDead();
            return;
        }

        this.shootCooldownRemaining = Math.max(0, this.shootCooldownRemaining - dt);
        this.survivalTime += dt;
        this.gameTimeRemaining = Math.max(0, this.gameTimeRemaining - Math.max(0, dt));
        this.refreshGameTimeLab();
        if (this.gameTimeRemaining <= 0) {
            this.onGameFail();
            return;
        }

        const moveDirectionLocked = this.isMoveDirectionLocked();
        if (this.wasMoveDirectionLocked && !moveDirectionLocked) {
            this.restoreMoveInputAfterDirectionUnlock();
        }
        this.wasMoveDirectionLocked = moveDirectionLocked;

        // 移动玩家（不使用vec3计算）
        if (this.isMoving) {
            let speed = playerMgr.playerComp.moveSpeed;
            if (!moveDirectionLocked) playerMgr.playerComp?.playRoleAnim(roleAnimName.move, true);
            //玩家移动
            this.tempPlayerMoveOffset.set(this.currentMoveDirection.x * speed * dt, this.currentMoveDirection.y * speed * dt, 0);

            // 攻击瞄准期间由目标决定人物朝向；其余时间跟随移动方向。
            if (!this.isAttackAiming && this.currentMoveDirection.x !== 0) {
                this.normalFacingRight = this.currentMoveDirection.x > 0;
                playerMgr.playerComp?.setFacingByHorizontal(this.normalFacingRight ? 1 : -1);
            }
            playerMgr.playerComp.moveWithStaticCollision(
                this.tempPlayerMoveOffset.x, this.tempPlayerMoveOffset.y, this.tempPlayerMoveOffset);
        }

        this.updateContainerOpenButton();
        this.updateRolePerspectives();
        this.updateShelterVisibility();
        this.updateLeaveCountdown(dt);
        if (this.isLeaveSuccessTriggered) return;

        if (this.isAttacking()) {
            if (pData.isAutoAiming) {
                this.refreshAutoAim();
            }
            this.shootEnemy(dt);
        }
    }

    /**根据当前地图和难度初始化本局时限，配置单位为秒。 */
    private initGameCountdown(): void {
        const [mapIdx, difficultyType] = pData.selectMapData;
        const gameTime = Number(mapConfig.getMapData(mapIdx, difficultyType)?.gameTime);
        this.gameTimeRemaining = Number.isFinite(gameTime) ? Math.max(0, gameTime) : 0;
        this.refreshGameTimeLab();
    }

    /**上次显示的倒计时秒数，避免每帧格式化相同文本。 */
    private displayedGameTimeSeconds = -1;
    /**倒计时常规颜色。 */
    private readonly gameTimeNormalColor = new Color('#9CFE41');
    /**倒计时最后60秒的颜色。 */
    private readonly gameTimeLastMinuteColor = new Color('#FE6941');

    /**剩余秒数向上取整，显示为“撤离倒计时：分:秒”。 */
    private refreshGameTimeLab(): void {
        if (!this.gameTimeLab) return;
        const totalSeconds = Math.ceil(this.gameTimeRemaining);
        if (totalSeconds === this.displayedGameTimeSeconds) return;
        this.displayedGameTimeSeconds = totalSeconds;
        const targetColor = totalSeconds <= 60 ? this.gameTimeLastMinuteColor : this.gameTimeNormalColor;
        if (!this.gameTimeLab.color.equals(targetColor)) {
            this.gameTimeLab.color = targetColor;
        }
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        const text = `${minutes}:${seconds}`;
        if (this.gameTimeLab.string !== text) this.gameTimeLab.string = text;
        this.refreshTimeShowLab();
    }

    /**玩家死亡时进入本局失败结算。 */
    onPlayerDead() {
        if (this.isFailTriggered || this.isLeaveSuccessTriggered) return;
        const player = playerMgr.playerComp;
        if (!player) {
            this.onGameFail();
            return;
        }
        gm.gamePause();
        player.playDeath(() => this.onGameFail());
    }

    /**死亡或撤离超时后停止本局，保存背包及穿戴装备掉落并打开失败结算。 */
    private onGameFail(): void {
        if (this.isFailTriggered || this.isLeaveSuccessTriggered) return;
        this.isFailTriggered = true;
        gm.gamePause();
        pData.saveLostItems();
        uiMgr.closePage(UIPath.UIBackpack);
        uiMgr.openPage(UIPath.UIFail, { survivalTime: this.survivalTime });
    }

    /**检测玩家是否站在任意撤离点中，并更新可中断的撤离倒计时。 */
    private updateLeaveCountdown(dt: number) {
        if (this.isLeaveSuccessTriggered) return;
        const playerNode = playerMgr.player;
        const playerTransform = playerNode?.getChildByName('colliderBox')?.getComponent(UITransform)
            ?? playerNode?.getComponent(UITransform);
        let isInside = false;
        if (playerTransform && this.leaveList) {
            const playerBounds = playerTransform.getBoundingBoxToWorld();
            for (const leaveNode of this.leaveList.children) {
                if (!leaveNode.activeInHierarchy) continue;
                const leaveTransform = leaveNode.getComponent(UITransform);
                if (!leaveTransform) continue;
                // 仅使用撤离点自身尺寸，子节点的图片、文字和特效不参与区域判断。
                const leaveBounds = new Rect(-leaveTransform.anchorX * leaveTransform.width,
                    -leaveTransform.anchorY * leaveTransform.height, leaveTransform.width, leaveTransform.height);
                leaveBounds.transformMat4(leaveNode.worldMatrix);
                if (playerBounds.intersects(leaveBounds)) {
                    isInside = true;
                    break;
                }
            }
        }

        if (!isInside) {
            if (this.isPlayerInLeavePoint) this.resetLeaveCountdown();
            return;
        }

        if (!this.isPlayerInLeavePoint) {
            this.isPlayerInLeavePoint = true;
            this.leaveRemaining = Math.max(0, Number(configData.leaveTime) || 0);
            this.leaveRemainLab.node.active = true;
        }

        this.leaveRemaining = Math.max(0, this.leaveRemaining - Math.max(0, dt));
        this.leaveRemainLab.string = `撤离时间：${Math.ceil(this.leaveRemaining)}`;
        if (this.leaveRemaining > 0) return;

        this.isLeaveSuccessTriggered = true;
        this.playEvacuation();
    }

    /**隐藏撤离文本，并让下一次进入撤离点时从完整时间重新开始。 */
    private resetLeaveCountdown() {
        this.isPlayerInLeavePoint = false;
        this.leaveRemaining = Math.max(0, Number(configData.leaveTime) || 0);
        this.leaveRemainLab.node.active = false;
        this.leaveRemainLab.string = `撤离时间：${Math.ceil(this.leaveRemaining)}`;
    }

    /**摇杆区域点击开始 */
    onTouchRockerStart(event: EventTouch) {
        if (this.isOpening) return;
        let rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        let rockerPoint = rockerNode.getChildByName("rockerPoint");

        this.isRockerControlling = true;
        this.inputMoveDirection.set(0, 0, 0);
        if (this.isMoveDirectionLocked()) return;
        this.isMoving = false;
        this.currentMoveDirection.set(0, 0, 0);
        let worldPos = event.getUILocation();
        this.tempTouchWorldPos.set(worldPos.x, worldPos.y, 0);
        this.rockerTouchNode.getComponent(UITransform).convertToNodeSpaceAR(this.tempTouchWorldPos, this.tempTouchMapLocalPos);
        rockerNode.setPosition(this.tempTouchMapLocalPos);
        rockerPoint.position = Vec3.ZERO;
    }

    /**摇杆区域移动 */
    onTouchRockerMove(event: EventTouch) {
        if (this.isOpening) return;
        const maxDistance = 34;
        const moveMultiplier = 4; // 移动倍数，可以根据需要调整
        let rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        let rockerPoint = rockerNode.getChildByName("rockerPoint");

        let worldPos = event.getUILocation();
        this.tempTouchWorldPos.set(worldPos.x, worldPos.y, 0);
        rockerNode.getComponent(UITransform).convertToNodeSpaceAR(this.tempTouchWorldPos, this.tempTouchMapLocalPos);

        let directionX = this.tempTouchMapLocalPos.x;
        let directionY = this.tempTouchMapLocalPos.y;
        // 直接使用数值计算方向与限位，避免触摸移动时反复clone Vec3
        let directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        let extendedLength = directionLength * moveMultiplier;
        let currentRatio = Math.min(extendedLength / maxDistance, 1);
        let clampedScale = directionLength > 0 ? Math.min(moveMultiplier, maxDistance / directionLength) : 0;

        let dirVec = ccTools.GetDir(0, 0, directionX, directionY);
        this.inputMoveDirection.set(dirVec.x * currentRatio, dirVec.y * currentRatio, 0);
        if (!this.isMoveDirectionLocked()) {
            this.isMoving = true;
            this.currentMoveDirection.set(this.inputMoveDirection);
        }

        // 设置摇杆点的位置
        rockerPoint.setPosition(directionX * clampedScale, directionY * clampedScale, 0);
    }

    /**摇杆区域点击结束 */
    onTouchRockerEnd(event: any) {
        if (this.isOpening) return;
        this.rockerReset();
    }

    /**将当前 W/A/S/D 按键状态转换为最大幅度的摇杆方向 */
    private refreshKeyboardMove() {
        if (this.isRockerControlling) {
            return false;
        }

        const directionX = (this.pressedMoveKeys.has(KeyCode.KEY_D) ? 1 : 0) - (this.pressedMoveKeys.has(KeyCode.KEY_A) ? 1 : 0);
        const directionY = (this.pressedMoveKeys.has(KeyCode.KEY_W) ? 1 : 0) - (this.pressedMoveKeys.has(KeyCode.KEY_S) ? 1 : 0);
        const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionLength === 0) {
            return false;
        }

        const normalizedX = directionX / directionLength;
        const normalizedY = directionY / directionLength;
        this.inputMoveDirection.set(normalizedX, normalizedY, 0);
        if (this.isMoveDirectionLocked()) return true;
        this.currentMoveDirection.set(normalizedX, normalizedY, 0);
        this.isMoving = true;

        // 键盘输入时将摇杆点直接推至该方向的最边缘。
        const rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        const rockerPoint = rockerNode.getChildByName("rockerPoint");
        rockerNode.setPosition(this.rockerInitPos);
        rockerPoint.setPosition(normalizedX * 34, normalizedY * 34, 0);
        return true;
    }

    /**攻击期间优先锁定范围内最近的敌人；范围为空时保留本轮原锁定 */
    private refreshAutoAim() {
        const nearestTarget = playerMgr.playerComp?.findNearestEnemyInAttackRange();
        if (nearestTarget) {
            this.autoAttackTarget = nearestTarget;
        }

        if (!this.autoAttackTarget || !this.isValidAttackTarget(this.autoAttackTarget) || !playerMgr.player) {
            this.autoAttackTarget = null;
            this.isAttackAiming = false;
            // 本轮攻击未锁定目标时，不能沿用上一次攻击留下的目标坐标。
            playerMgr.playerComp?.clearGunAimTarget();
            return;
        }

        // 枪械对准目标坐标；刀只根据目标的左右方向调整人物朝向。
        this.isAttackAiming = playerMgr.playerComp?.aimGunAt(this.autoAttackTarget.node) ?? false;
    }

    /**锁定目标是否仍可攻击；锁定后不再受自动瞄准范围限制 */
    private isValidAttackTarget(target: EnemyTarget) {
        return !!target && target.node?.isValid && target.node.activeInHierarchy && target.hp > 0;
    }

    /**结束瞄准；仅在主动移动时恢复移动朝向，保留枪最后一次瞄准角度 */
    private stopAutoAim() {
        this.unschedule(this.stopAutoAim);
        this.isAttackAiming = false;
        this.autoAttackTarget = null;
        playerMgr.playerComp?.clearGunAimTarget();
        if (this.isMoving && this.currentMoveDirection.x !== 0) {
            this.normalFacingRight = this.currentMoveDirection.x > 0;
            playerMgr.playerComp?.setFacingByHorizontal(this.normalFacingRight ? 1 : -1);
        }
    }

    refreshGameCamera() {
        this.updateGameToUICameraScale();
    }

    /**设置武器视野倍率；开场直接应用，局内默认在 0.2 秒内平滑切换。 */
    setGameViewScale(scale: number, duration = 0.2) {
        this.gameCameraComp?.setViewScale(scale, this.isOpening ? 0 : duration);
    }

    /**技能视野与武器视野的增幅按加法叠加，默认在 0.2 秒内平滑切换。 */
    setSkillViewScale(scale: number, duration = 0.2) {
        this.gameCameraComp?.setSkillViewScale(scale, duration);
    }

    /**射击敌人  */
    shootEnemy(deltaTime = 0) {
        if (this.isOpening) return;
        if (this.shootCooldownRemaining > 0) {
            return;
        }

        if (pData.isAutoAiming) {
            this.refreshAutoAim();
        }
        const roleComp = playerMgr.playerComp;
        // 手动瞄准的狙击枪只蓄力，松手时由 setAttackHeld 完成开火；自动模式维持蓄满即开火。
        if (!roleComp?.attack(deltaTime, pData.isAutoAiming)) {
            return;
        }

        this.refreshWeaponNums();

        const weaponComp = roleComp.weaponsController;
        if (weaponComp) {
            this.shootCooldownRemaining = weaponComp.attackInterval;
        }
    }

    /**初始化四个功能按钮的遮罩，开局不显示冷却状态。 */
    private initButtonMasks() {
        const buttons = [this.reloadBtn, this.skillBtn1, this.skillBtn2, this.knifeBtn];
        for (const button of buttons) {
            const mask = button?.getChildByName('mask')?.getComponent(Sprite) ?? null;
            if (!mask) continue;
            Tween.stopAllByTarget(mask);
            mask.fillRange = 0;
            if (button === this.reloadBtn) this.reloadMask = mask;
            if (button === this.skillBtn1) this.skill1Mask = mask;
            if (button === this.skillBtn2) this.skill2Mask = mask;
        }
    }

    /**根据角色技能2事件实时刷新倒计时；非 role0 或技能未生效时保持隐藏。 */
    private updateSkill2RemainLab(remainTime: number, isVisible: boolean) {
        if (!this.skill2RemainLab) return;
        this.skill2RemainLab.node.active = isVisible;
        if (isVisible) this.skill2RemainLab.string = `${Math.ceil(Math.max(0, remainTime))}`;
    }

    /**按角色技能配置的冷却时间播放对应按钮遮罩。 */
    private playSkillMaskCooldown(skillIndex: 1 | 2, cooldown: number) {
        const mask = skillIndex === 1 ? this.skill1Mask : this.skill2Mask;
        if (!mask) return;
        Tween.stopAllByTarget(mask);
        mask.fillRange = 1;
        if (cooldown > 0) {
            tween(mask).to(cooldown, { fillRange: 0 }).start();
        } else {
            mask.fillRange = 0;
        }
    }

    /**停止技能冷却补间并清空两个技能遮罩。 */
    private stopSkillMaskCooldown() {
        for (const mask of [this.skill1Mask, this.skill2Mask]) {
            if (!mask) continue;
            Tween.stopAllByTarget(mask);
            mask.fillRange = 0;
        }
    }

    /**使用换弹动画时长，让遮罩从满值直接补间至空值。 */
    private playReloadMaskCooldown(reloadTime: number) {
        // 只有枪械确认进入换弹后才打断，点击无效换弹不会中断打药。
        playerMgr.playerComp?.interruptDrugUse();
        if (!this.reloadMask) return;
        Tween.stopAllByTarget(this.reloadMask);
        this.reloadMask.fillRange = 1;
        if (reloadTime > 0) {
            tween(this.reloadMask).to(reloadTime, { fillRange: 0 }).start();
        } else {
            this.reloadMask.fillRange = 0;
        }
    }

    /**停止冷却补间并清空遮罩。 */
    private stopReloadMaskCooldown() {
        if (!this.reloadMask) return;
        Tween.stopAllByTarget(this.reloadMask);
        this.reloadMask.fillRange = 0;
    }

    /**是否正通过键盘或射击按钮持续攻击 */
    private isAttacking() {
        return this.isKeyboardAttackPressed || this.isShootButtonPressed;
    }

    /** 背包打开时不响应游戏键盘操作 */
    private isBackpackOpen() {
        return uiMgr.isPageOpen(UIPath.UIBackpack);
    }

    /** 打开背包时清除已按住的键盘移动与攻击状态 */
    private clearKeyboardGameInput() {
        this.pressedMoveKeys.clear();
        this.isKeyboardAttackPressed = false;
        // 清掉狙击枪蓄力，避免打开背包时同步松键导致开火。
        playerMgr.playerComp?.weaponsController?.node.getComponent(sniperController)?.cancelCharge();
        this.syncPlayerAttackHeldState();
        if (!this.isRockerControlling) {
            this.isMoving = false;
            this.currentMoveDirection.set(0, 0, 0);
            playerMgr.playerComp?.playRoleAnim(roleAnimName.idle, true);
        }
        if (!this.isAttacking()) this.stopAutoAim();
    }

    /**攻击按键状态变化时通知角色；不在 update 中重复刷新。 */
    private syncPlayerAttackHeldState() {
        const isAttacking = this.isAttacking();
        // 冷却期间仍记录按住状态，但狙击枪不应提前显示下一轮蓄力辅助线。
        const roleComp = playerMgr.playerComp;
        const isFiredOnRelease = roleComp?.setAttackHeld(
            isAttacking,
            !isAttacking || this.shootCooldownRemaining <= 0,
        );
        if (isFiredOnRelease) this.startCurrentWeaponAttackCooldown(roleComp);
    }

    /** 松手提前开火同样需要进入当前武器的攻击间隔。 */
    private startCurrentWeaponAttackCooldown(roleComp = playerMgr.playerComp) {
        const weaponComp = roleComp?.weaponsController;
        if (weaponComp) this.shootCooldownRemaining = weaponComp.attackInterval;
        this.refreshWeaponNums();
    }

    /**按装备栏主、副武器 id 刷新武器框名称和图标，空槽隐藏图片。 */
    refreshWeaponNames() {
        const weaponBoxes = [this.weaponBox_0, this.weaponBox_1];
        weaponBoxes.forEach((weaponBox, slotIndex) => {
            const weaponData = weaponsConfig.getDataByItemId(pData.equipmentIds[slotIndex]);
            const weaponImg = weaponBox?.getChildByName('img')?.getComponent(Sprite);
            if (weaponImg) {
                weaponImg.node.active = !!weaponData;
                ccTools.cancelAssetLoad(weaponImg);
                weaponImg.spriteFrame = null;
                if (weaponData) {
                    ccTools.loadImg(weaponImg, imgPath.weaponIcon + weaponData.itemId);
                }
            }
            const nameLab = weaponBox?.getChildByName('nameLab')?.getComponent(Label);
            if (!nameLab) return;
            nameLab.string = weaponData?.name ?? '';
            nameLab.color = new Color(QualityColorArr[weaponData?.quality] ?? '#FFFFFF');
        });
    }

    /**刷新主、副武器的当前弹匣数量，备用弹药显示为无限。 */
    refreshWeaponNums() {
        const weaponBoxes = [this.weaponBox_0, this.weaponBox_1];
        weaponBoxes.forEach((weaponBox, slotIndex) => {
            const numLab = weaponBox?.getChildByName('numLab')?.getComponent(Label);
            if (!numLab) return;
            if (pData.equipmentIds[slotIndex] < 0) {
                numLab.string = '';
                return;
            }
            const weapon = playerMgr.playerComp?.getWeaponController(slotIndex);
            const gun = weapon?.node.getComponent(gunController);
            const weaponData = weaponsConfig.getDataByItemId(pData.equipmentIds[slotIndex]);
            const hasInfiniteAmmo = weaponData?.capacity === -1;
            numLab.string = hasInfiniteAmmo ? '∞/∞' : `${gun?.ammo ?? 0}/∞`;
        });
    }

    /**射击按钮按下：立即尝试射击，按住期间由 update 持续射击 */
    private onShootButtonStart() {
        if (this.isOpening) return;
        // 攻击输入按下即视为动作开始；狙击枪进入瞄准/蓄力时也应立即打断打药。
        playerMgr.playerComp?.interruptDrugUse();
        const wasAttacking = this.isAttacking();
        this.isShootButtonPressed = true;
        this.syncPlayerAttackHeldState();
        if (!wasAttacking && pData.isAutoAiming) {
            this.refreshAutoAim();
        }
        this.shootEnemy();
    }

    /**射击按钮松开或取消：停止持续射击 */
    private onShootButtonEnd() {
        if (this.isOpening) return;
        this.isShootButtonPressed = false;
        this.syncPlayerAttackHeldState();
        if (!this.isAttacking()) {
            this.stopAutoAim();
        }
    }

    /**手动瞄准摇杆按下：确定方向后开始持续攻击。 */
    private onManualAimRockerStart(event: EventTouch) {
        if (this.isOpening) return;
        if (pData.isAutoAiming) return;
        this.isManualAimControlling = true;
        this.updateManualAimDirection(event);
        this.onShootButtonStart();
    }

    /**手动瞄准摇杆移动：更新摇杆点和枪口方向。 */
    private onManualAimRockerMove(event: EventTouch) {
        if (this.isOpening) return;
        if (!this.isManualAimControlling || pData.isAutoAiming) return;
        this.updateManualAimDirection(event);
    }

    /**手动瞄准摇杆松开：归位并停止攻击。 */
    private onManualAimRockerEnd() {
        if (this.isOpening) return;
        if (!this.isManualAimControlling) return;
        this.isManualAimControlling = false;
        this.manualAimDirection.set(0, 0, 0);
        this.resetManualAimRocker();
        this.onShootButtonEnd();
    }

    /**根据手动瞄准摇杆触点更新枪口朝向。 */
    private updateManualAimDirection(event: EventTouch) {
        const aimingRocker = this.shootBtn?.getChildByName("rocker");
        const rockerPoint = aimingRocker?.getChildByName("rockerPoint");
        const rockerTransform = aimingRocker?.getComponent(UITransform);
        if (!aimingRocker || !rockerPoint || !rockerTransform) return;

        const touchPos = event.getUILocation();
        this.tempTouchWorldPos.set(touchPos.x, touchPos.y, 0);
        rockerTransform.convertToNodeSpaceAR(this.tempTouchWorldPos, this.tempTouchMapLocalPos);

        const directionX = this.tempTouchMapLocalPos.x;
        const directionY = this.tempTouchMapLocalPos.y;
        const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        // 与移动摇杆保持一致的圆点最大偏移，摇杆本体不添加缩放效果。
        const maxDistance = 34;
        const positionScale = directionLength > 0 ? Math.min(1, maxDistance / directionLength) : 0;
        rockerPoint.setPosition(directionX * positionScale, directionY * positionScale, 0);
        if (directionLength === 0) return;

        this.manualAimDirection.set(directionX / directionLength, directionY / directionLength, 0);
        this.isAttackAiming = playerMgr.playerComp?.aimGunInDirection(this.manualAimDirection) ?? false;
    }

    /**将手动瞄准摇杆的摇杆点归位。 */
    private resetManualAimRocker() {
        const rockerPoint = this.shootBtn?.getChildByName("rocker")?.getChildByName("rockerPoint");
        rockerPoint?.setPosition(0, 0, 0);
    }

    /** 切换角色武器，并清除旧武器的瞄准和冷却状态。 */
    private switchWeapon(slotIndex: number) {
        if (this.isOpening) return;
        const roleComp = playerMgr.playerComp;
        if (!roleComp?.equipWeapon(slotIndex)) return;
        this.shootCooldownRemaining = 0;
        if (this.isAttacking()) {
            // 枪械立即重算到目标的朝向和角度；刀会保留 equipWeapon 中同步的默认姿态。
            if (pData.isAutoAiming) {
                this.refreshAutoAim();
            } else if (this.isManualAimControlling) {
                this.isAttackAiming = roleComp.aimGunInDirection(this.manualAimDirection);
            }
        } else {
            this.stopAutoAim();
            roleComp.syncCurrentWeaponDefaultPose();
        }
        this.bindCurrentGunReloadEvent();
        roleComp.onCurrentWeaponEquipped();
    }

    /**供角色技能查询：当前是否正通过摇杆或方向键提供有效移动方向。 */
    hasMoveDirectionInput() {
        if (this.isRockerControlling) {
            return this.inputMoveDirection.x !== 0 || this.inputMoveDirection.y !== 0;
        }
        return this.pressedMoveKeys.size > 0 && (this.currentMoveDirection.x !== 0 || this.currentMoveDirection.y !== 0);
    }

    /**技能方向锁定结束后，立即按当前仍按住的输入恢复可控移动。 */
    private restoreMoveInputAfterDirectionUnlock() {
        if (this.isRockerControlling) {
            this.currentMoveDirection.set(this.inputMoveDirection);
            this.isMoving = this.inputMoveDirection.x !== 0 || this.inputMoveDirection.y !== 0;
            return;
        }
        if (!this.refreshKeyboardMove()) this.rockerReset();
    }

    /**当前角色是否正在锁定移动方向。 */
    private isMoveDirectionLocked() {
        return playerMgr.playerComp?.isMoveDirectionLocked ?? false;
    }

    /**刷新自动瞄准开关与射击按钮显示 */
    private refreshAimingBtnDisplay() {
        const aimingSelect = this.aimingBtn
            ?.getChildByName("aimingNode")
            ?.getChildByName("aimingSelect");
        if (aimingSelect) {
            const position = aimingSelect.position;
            aimingSelect.setPosition(pData.isAutoAiming ? -25 : 25, position.y, position.z);
        }

        // 自动瞄准使用普通射击按钮；手动瞄准时显示瞄准摇杆。
        const autoAimBtn = this.shootBtn?.getChildByName("btn");
        const aimingRocker = this.shootBtn?.getChildByName("rocker");
        if (autoAimBtn) {
            autoAimBtn.active = pData.isAutoAiming;
        }
        if (aimingRocker) {
            aimingRocker.active = !pData.isAutoAiming;
        }
    }

    ///
    ///点击函数
    ///

    /**监听按钮点击事件 */
    onKeyDown(event: EventKeyboard) {
        if (this.isOpening) return;
        if (this.isBackpackOpen()) {
            if (event.keyCode === KeyCode.KEY_B) this.clickBagBtn();
            return;
        }

        switch (event.keyCode) {
            case KeyCode.KEY_W:
            case KeyCode.KEY_A:
            case KeyCode.KEY_S:
            case KeyCode.KEY_D:
                this.pressedMoveKeys.add(event.keyCode);
                this.refreshKeyboardMove();
                break;
            case KeyCode.KEY_J: {
                // 键盘攻击按下即打断，包含狙击枪尚未开火的瞄准/蓄力阶段。
                playerMgr.playerComp?.interruptDrugUse();
                const wasAttacking = this.isAttacking();
                this.isKeyboardAttackPressed = true;
                this.syncPlayerAttackHeldState();
                if (!wasAttacking && pData.isAutoAiming) {
                    this.refreshAutoAim();
                }
                this.shootEnemy();
                break;
            }
            case KeyCode.KEY_R:
                // 主动换弹；枪械组件会自行拦截满弹或换弹中的重复请求。
                playerMgr.playerComp?.gunController?.reload();
                break;
            case KeyCode.KEY_P:
                this.clickAimingBtn();
                break;
            case KeyCode.DIGIT_1:
                this.switchWeapon(0);
                break;
            case KeyCode.DIGIT_2:
                this.switchWeapon(1);
                break;
            case KeyCode.DIGIT_3:
                this.switchWeapon(2);
                break;
            case KeyCode.DIGIT_4:
                this.clickDrugBtn(false);
                break;
            case KeyCode.DIGIT_5:
                this.clickDrugBtn(true);
                break;
            case KeyCode.SPACE:
                this.clickSkillBtn1();
                break;
            case KeyCode.KEY_K:
                this.clickSkillBtn2();
                break;
            case KeyCode.KEY_B:
                this.clickBagBtn();
                break;
            case KeyCode.KEY_F:
                if (this.openBtn?.activeInHierarchy) this.clickOpenContainerBtn();
                break;
        }
    }

    /**监听键盘松开，恢复剩余按键的方向或停止移动 */
    onKeyUp(event: EventKeyboard) {
        if (this.isOpening) return;
        if (this.isBackpackOpen()) return;

        switch (event.keyCode) {
            case KeyCode.KEY_W:
            case KeyCode.KEY_A:
            case KeyCode.KEY_S:
            case KeyCode.KEY_D:
                this.pressedMoveKeys.delete(event.keyCode);
                if (!this.isRockerControlling && !this.refreshKeyboardMove()) {
                    this.rockerReset();
                }
                break;
            case KeyCode.KEY_J:
                this.isKeyboardAttackPressed = false;
                this.syncPlayerAttackHeldState();
                if (!this.isAttacking()) {
                    this.stopAutoAim();
                }
                break;
        }
    }

    /**点击换弹按钮 */
    clickReloadBtn() {
        if (this.isOpening) return;
        // 主动换弹；枪械组件会自行拦截满弹或换弹中的重复请求。
        playerMgr.playerComp?.gunController?.reload();
    }

    /**点击技能按钮1 */
    clickSkillBtn1() {
        if (this.isOpening) return;
        const roleComp = playerMgr.playerComp;
        if (roleComp?.useSkill1()) roleComp.interruptDrugUse();
    }

    /**点击技能按钮2 */
    clickSkillBtn2() {
        if (this.isOpening) return;
        const roleComp = playerMgr.playerComp;
        if (roleComp?.useSkill2()) roleComp.interruptDrugUse();
    }

    /**点击小/大药品；库存为空时观看广告，成功后补充数量并自动使用一次。 */
    private clickDrugBtn(isBig: boolean) {
        if (this.isOpening) return;
        const roleComp = playerMgr.playerComp;
        if (!roleComp || roleComp.usingDrug) return;

        if (this.getDrugCount(isBig) > 0) {
            this.startUseDrug(isBig);
            return;
        }
        if (this.isDrugAdWatching) return;

        this.isDrugAdWatching = true;
        const gameVersion = this.openVersion;
        videoMgr.watchVideo(68, () => {
            this.isDrugAdWatching = false;
            const rewardCount = Number(isBig ? commonConfig.getValue("drugAdCountBig") : commonConfig.getValue("drugAdCount"));
            this.setDrugCount(isBig, this.getDrugCount(isBig) + Math.max(0, rewardCount));
            this.refreshDrugButtons();
            if (gameVersion === this.openVersion && this.node.activeInHierarchy) this.startUseDrug(isBig);
        }, () => {
            this.isDrugAdWatching = false;
        });
    }

    /**开始打药；药品仅在完整读条结束后扣除，被动作打断不会消耗。 */
    private startUseDrug(isBig: boolean) {
        if (this.getDrugCount(isBig) <= 0) return false;
        const roleComp = playerMgr.playerComp;
        const useTime = isBig ? configData.drugUseTimeBig : configData.drugUseTime;
        const healPercent = Number(isBig ? commonConfig.getValue("drugHpBig") : commonConfig.getValue("drugHp")) / 100;
        return roleComp?.useDrug(useTime, healPercent, () => {
            this.setDrugCount(isBig, this.getDrugCount(isBig) - 1);
            this.refreshDrugButtons();
        }) ?? false;
    }

    /**刷新两个药品按钮的数量/广告状态。 */
    private refreshDrugButtons() {
        this.refreshDrugButton(this.drugBtn_0, pData.drugCount);
        this.refreshDrugButton(this.drugBtn_1, pData.drugCountBig);
    }

    private refreshDrugButton(button: Node, count: number) {
        const availableCount = Math.max(0, Math.floor(count));
        const numNode = button?.getChildByName('numNode');
        const adNode = button?.getChildByName('ad');
        if (numNode) numNode.active = availableCount > 0;
        if (adNode) adNode.active = availableCount <= 0;
        const numLab = numNode?.getChildByName('numLab')?.getComponent(Label);
        if (numLab) numLab.string = `${availableCount}`;
    }

    private getDrugCount(isBig: boolean) {
        return isBig ? pData.drugCountBig : pData.drugCount;
    }

    private setDrugCount(isBig: boolean, count: number) {
        const validCount = Math.max(0, Math.floor(count));
        if (isBig) {
            pData.drugCountBig = validCount;
        } else {
            pData.drugCount = validCount;
        }
    }

    /**点击刀按钮 */
    clickKnifeBtn() {
        this.switchWeapon(2);
    }

    /**点击背包按钮 */
    clickBagBtn() {
        if (this.isOpening) return;
        if (uiMgr.isPageOpen(UIPath.UIBackpack)) {
            uiMgr.closePage(UIPath.UIBackpack);
            return;
        }
        this.clearKeyboardGameInput();
        uiMgr.openPage(UIPath.UIBackpack);
    }

    /**点击打开容器按钮 */
    clickOpenContainerBtn() {
        if (this.isOpening) return;
        if (!this.currentContainer) return;
        this.clearKeyboardGameInput();
        this.currentContainer.open();
        uiMgr.openPage(UIPath.UIBackpack, {
            showSearchNode: true,
            sourceContainer: this.currentContainer,
            itemData: this.currentContainer.getItemData(),
            revealedItemStates: this.currentContainer.getRevealedItemStates(),
        });
    }

    /**点击武器框0 */
    onClickWeaponBox_0() {
        this.switchWeapon(0);
        return;
    }

    /**点击武器框1 */
    onClickWeaponBox_1() {
        this.switchWeapon(1);
        return;
    }

    /**点击自动瞄准按钮 */
    clickAimingBtn() {
        if (this.isOpening) return;
        pData.setAutoAiming(!pData.isAutoAiming);
        this.isManualAimControlling = false;
        this.manualAimDirection.set(0, 0, 0);
        this.resetManualAimRocker();
        this.refreshAimingBtnDisplay();
        this.stopAutoAim();
    }

    /**点击设置按钮 */
    clickSetBtn() {
        if (this.isOpening) return;
        uiMgr.openPage(UIPath.UISetting, { mode: 1 });
        gm.gamePause();
    }
}
