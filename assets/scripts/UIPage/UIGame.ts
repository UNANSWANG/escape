import { _decorator, AnimationClip, Camera, Canvas, EventKeyboard, EventTouch, Input, input, instantiate, KeyCode, Label, Layout, Node, UITransform, Vec2, Vec3, NodeEventType, director, TiledMap, TiledObjectGroup, Prefab, Sprite, Tween, UIOpacity, tween, sp, view, Size } from 'cc';
import { uiMgr } from '../manager/UIManager';
import { pData } from '../manager/playerData';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { configData, GameEvent } from '../manager/configData';
import { gm } from '../manager/gm';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { playerMgr } from '../manager/playerManager';
import { CameraController } from '../controller/CameraController';
import { roleAnimName, roleState } from '../controller/roleController';
import { enemyMgr } from '../manager/enemyManager';
import { enemyBaseController } from '../controller/enemy/enemyBaseController';
import { audioMgr } from '../manager/audioManager';
const { ccclass, property } = _decorator;

@ccclass('UIGame')
export class UIGame extends UIBase {
    @property(Node)
    setBtn: Node;

    @property(Node)
    roleNode: Node;

    @property(Node)
    rockerTouchNode: Node;

    @property(Node)
    gameUINode: Node;

    @property(Prefab)
    rolePre: Prefab;

    @property(Prefab)
    enemyPre: Prefab;

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
    /**摇杆触摸是否正在控制移动；摇杆优先于键盘 */
    private isRockerControlling = false;
    /**当前按住的移动按键（W、A、S、D） */
    private pressedMoveKeys: Set<KeyCode> = new Set();
    /**摇杆初始位置 */
    private rockerInitPos: Vec3 = new Vec3(200, -56, 0);
    /**临时敌人与玩家的水平间距 */
    private readonly tempEnemyOffsetX = 300;
    /**地图层相机，用于把瓦片世界坐标转成屏幕坐标 */
    private gameCamera: Camera = null;
    /**地图层相机控制器 */
    private gameCameraComp: CameraController = null;
    /**UI层相机，用于把屏幕坐标转回UI世界坐标 */
    private uiCamera: Camera = null;
    /**游戏摄像机到UI摄像机的视角比例 */
    private gameToUICameraScale = 1;

    ///
    ///临时变量，不参与重新开始游戏数据恢复
    ///
    /**触摸点对应的地图世界坐标 */
    private tempTouchWorldPos: Vec3 = new Vec3();
    /**触摸点对应的地图节点本地坐标 */
    private tempTouchMapLocalPos: Vec3 = new Vec3();
    /**玩家每帧移动偏移 */
    private tempPlayerMoveOffset: Vec3 = new Vec3();
    /**游戏是否暂停 */
    private isGamePause = false;
    /**当前游戏局序号，用于避免异步加载回写旧局 */
    private openVersion = 0;

    protected onLoad(): void {
        this.bindBtn();
        this.initCamera();
        audioMgr.initSceneAudio(this.node);
    }

    async onUI_Open(data?: any) {
        ++this.openVersion;
        this.addListener();
        this.restartGame();
    }

    onUI_Close(): void {
        audioMgr.stopSceneEffects();
        // 先提升版本号，使本局尚未完成的异步地图加载结果失效
        this.openVersion++;
        this.removeListener();
        this.clearData();
    }

    /**重新开始单局 */
    private async restartGame() {
        // 每次重开都先作废上一局的异步任务并立即清场，不能等新地图加载完成后再清理
        let version = ++this.openVersion;
        this.clearData();
        pData.levelInit();

        if (version != this.openVersion || !this.node.activeInHierarchy) {
            return;
        }

        this.initData();
    }

    /**添加监听 */
    addListener() {
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

    bindBtn() {
        this.setBtn.addComponent(zoomButton).onClick = this.clickSetBtn.bind(this);
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

        this.initRockerArea();
        this.initPlayer();
        this.initEnemy();
    }

    clearData() {
        this.unscheduleAllCallbacks();
        this.gameCameraComp?.unlockCameraPos();
        this.isGamePause = false;

        ccTools.destroyAllChild(this.roleNode);

        playerMgr.player = null;
        enemyMgr.enemyArr = [];
        enemyMgr.enemyId = 0;
        enemyMgr.enemyBornPosArr = [];
        this.rockerReset(true);
    }

    /**初始化玩家 */
    initPlayer() {
        playerMgr.player = instantiate(this.rolePre);
        this.roleNode.addChild(playerMgr.player);
        playerMgr.cameraFollow = true;
        this.initRolePos(playerMgr.player);
        playerMgr.playerComp.init(this, 0, pData.skinId);
    }

    /**在玩家右侧生成一个仅播放待机动画的临时敌人 */
    private initEnemy() {
        if (!this.enemyPre || !playerMgr.player) {
            return;
        }

        let enemyNode = instantiate(this.enemyPre);
        this.roleNode.addChild(enemyNode);
        let enemyComp: enemyBaseController = enemyNode.getComponent(enemyBaseController);
        const enemyId = enemyMgr.enemyId++;

        // 敌人不添加 AI；仅初始化外观、名称和满血状态。
        if (enemyComp) {
            enemyComp.maxHp = 1;
            enemyComp.hp = 1;
            enemyComp.init(this, enemyId, 0);
            enemyMgr.enemyArr.push(enemyComp);
        }

        const playerPos = playerMgr.player.position;
        enemyNode.setPosition(playerPos.x + this.tempEnemyOffsetX, playerPos.y, playerPos.z);
    }

    /**初始化角色位置 */
    initRolePos(node) {
        node.setPosition(Vec3.ZERO);
    }

    /**初始化摇杆区域 */
    initRockerArea() {
        let visibleSize = view.getVisibleSize();
        let rockerTrans = this.rockerTouchNode.getComponent(UITransform);
        rockerTrans.setContentSize(visibleSize.width / 2 - 320, rockerTrans.height);
    }

    /**响应全局游戏暂停 */
    private onGamePause() {
        this.isGamePause = true;
        this.rockerReset(true);
    }

    /**响应全局游戏继续 */
    private onGameResume() {
        this.isGamePause = false;
    }

    /**摇杆归位 */
    rockerReset(clearKeyboard = false) {
        if (clearKeyboard) {
            this.pressedMoveKeys.clear();
        }
        this.isRockerControlling = false;

        let rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        let rockerPoint = rockerNode.getChildByName("rockerPoint");
        rockerNode.setPosition(this.rockerInitPos);
        rockerPoint.position = Vec3.ZERO;

        if (!this.refreshKeyboardMove()) {
            this.isMoving = false;
            this.currentMoveDirection.set(0, 0, 0);
            playerMgr.playerComp?.playRoleAnim(roleAnimName.idle, true);
        }
    }

    protected update(dt: number): void {
        if (this.isGamePause) {
            return;
        }

        // 移动玩家（不使用vec3计算）
        if (this.isMoving) {
            let speed = configData.moveSpeed;
            playerMgr.playerComp?.playRoleAnim(roleAnimName.move, true);
            //玩家移动
            this.tempPlayerMoveOffset.set(this.currentMoveDirection.x * speed * dt, this.currentMoveDirection.y * speed * dt, 0);
            let playerPos = new Vec3(playerMgr.player.position.x + this.tempPlayerMoveOffset.x, playerMgr.player.position.y + this.tempPlayerMoveOffset.y, 0);

            let roleAnimNode = playerMgr.playerComp?.roleAnim?.node;
            //人物左右反向
            if (roleAnimNode) {
                roleAnimNode.setScale((this.currentMoveDirection.x < 0 ? 1 : -1) * Math.abs(roleAnimNode.scale.x), roleAnimNode.scale.y, 1);
            }
            playerMgr.player.setPosition(playerPos);
        }
    }

    /**摇杆区域点击开始 */
    onTouchRockerStart(event: EventTouch) {
        let rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        let rockerPoint = rockerNode.getChildByName("rockerPoint");

        this.isRockerControlling = true;
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
        this.isMoving = true;
        this.currentMoveDirection.set(dirVec.x * currentRatio, dirVec.y * currentRatio, 0);

        // 设置摇杆点的位置
        rockerPoint.setPosition(directionX * clampedScale, directionY * clampedScale, 0);
    }

    /**摇杆区域点击结束 */
    onTouchRockerEnd(event: any) {
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
        this.currentMoveDirection.set(normalizedX, normalizedY, 0);
        this.isMoving = true;

        // 键盘输入时将摇杆点直接推至该方向的最边缘。
        const rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        const rockerPoint = rockerNode.getChildByName("rockerPoint");
        rockerNode.setPosition(this.rockerInitPos);
        rockerPoint.setPosition(normalizedX * 34, normalizedY * 34, 0);
        return true;
    }

    /**刷新游戏摄像机视角 */
    refreshGameCamera() {
        this.updateGameToUICameraScale();
    }

    ///
    ///点击函数
    ///

    /**监听按钮点击事件 */
    onKeyDown(event: EventKeyboard) {
        switch (event.keyCode) {
            case KeyCode.KEY_W:
            case KeyCode.KEY_A:
            case KeyCode.KEY_S:
            case KeyCode.KEY_D:
                this.pressedMoveKeys.add(event.keyCode);
                this.refreshKeyboardMove();
                break;
            case KeyCode.KEY_R:
                //重新开始游戏
                this.restartGame();
                break;
            case KeyCode.SPACE:
                playerMgr.playerComp?.playRoleAnim("appear", false);
                break;
        }
    }

    /**监听键盘松开，恢复剩余按键的方向或停止移动 */
    onKeyUp(event: EventKeyboard) {
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
        }
    }

    /**点击设置按钮 */
    clickSetBtn() {
        uiMgr.openPage(UIPath.UISetting, { mode: 1 });
        gm.gamePause();
    }
}
