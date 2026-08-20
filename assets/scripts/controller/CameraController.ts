import { _decorator, Camera, Component, Vec2, v3, Vec3, view } from 'cc';
import { pData } from '../manager/playerData';
import { playerMgr } from '../manager/playerManager';
import { GameEvent } from '../manager/configData';
import { gm } from '../manager/gm';
const { ccclass, property } = _decorator;

@ccclass('CameraController')
export class CameraController extends Component {
    @property
    OrthoHeight: number = 400;

    @property
    DesignWidth: number = 1080;

    @property
    DesignHeight: number = 1920;

    private camera: Camera = null;
    // private shelter: Node = null;
    private playerPos: Vec3 = null;
    private cameraPos: Vec3 = null;
    private move: Vec3 = null;
    private cameraWorldPos: Vec3 = new Vec3();
    private isPositionLocked: boolean = false;
    onLoad() {
        this.camera = this.node.getComponent(Camera);
    }

    onEnable() {
        view.on('canvas-resize', this.updateOrthoHeight, this);
    }

    onDisable() {
        view.off('canvas-resize', this.updateOrthoHeight, this);
    }

    start() {
        this.cameraPos = v3(0, 0, 0);
        this.updateOrthoHeight();
    }

    private updateOrthoHeight() {
        if (!this.camera || this.DesignWidth <= 0 || this.DesignHeight <= 0) {
            return;
        }

        const visibleSize = view.getVisibleSize();
        if (visibleSize.width <= 0 || visibleSize.height <= 0) {
            return;
        }

        const designAspect = this.DesignWidth / this.DesignHeight;
        const currentAspect = visibleSize.width / visibleSize.height;
        this.camera.orthoHeight = this.OrthoHeight * designAspect / currentAspect;
        gm.Event.emit(GameEvent.refreshGameCamera);
    }

    private limitCameraPos(cameraPos: Vec3): Vec3 {
        if (!this.camera) {
            return cameraPos;
        }

        const visibleSize = view.getVisibleSize();
        if (visibleSize.width <= 0 || visibleSize.height <= 0) {
            return cameraPos;
        }

        const halfViewHeight = this.camera.orthoHeight;
        const halfViewWidth = halfViewHeight * visibleSize.width / visibleSize.height;
        const minX = -pData.mapHalfSize.x + halfViewWidth;
        const maxX = pData.mapHalfSize.x - halfViewWidth;
        const minY = -pData.mapHalfSize.y + halfViewHeight;
        const maxY = pData.mapHalfSize.y - halfViewHeight;
        const limitPos = cameraPos.clone();

        limitPos.x = minX <= maxX ? Math.min(Math.max(limitPos.x, minX), maxX) : 0;
        limitPos.y = minY <= maxY ? Math.min(Math.max(limitPos.y, minY), maxY) : 0;

        return limitPos;
    }

    /**直接设置相机的坐标 */
    setCameraPos(pos: Vec3, isRefresh: boolean = false) {
        if (this.isPositionLocked) {
            return;
        }

        this.cameraPos = this.limitCameraPos(pos);
        this.node.setPosition(this.cameraPos);
        if (isRefresh) {
            this.scheduleOnce(() => {
                this.node.setPosition(this.cameraPos);
            }, 0);
        }
    }

    /**锁定相机坐标，解锁前忽略其他位置控制 */
    lockCameraPos(pos: Vec3) {
        this.isPositionLocked = false;
        this.setCameraPos(pos, true);
        this.isPositionLocked = true;
    }

    /**解除相机坐标锁定 */
    unlockCameraPos() {
        this.isPositionLocked = false;
    }

    /**根据屏幕滑动距离移动相机，表现为拖动画面 */
    moveCameraByScreenDelta(delta: Vec2) {
        if (!this.camera) {
            return;
        }

        const visibleSize = view.getVisibleSize();
        if (visibleSize.height <= 0) {
            return;
        }

        const worldPerPixel = this.camera.orthoHeight * 2 / visibleSize.height;
        const pos = this.node.position.clone();
        pos.x -= delta.x * worldPerPixel;
        pos.y -= delta.y * worldPerPixel;
        this.setCameraPos(pos);
    }

    /**世界坐标是否位于当前游戏摄像机视野内 */
    isWorldPosVisible(worldPos: Vec3) {
        if (!this.camera || !worldPos) {
            return false;
        }

        const visibleSize = view.getVisibleSize();
        if (visibleSize.width <= 0 || visibleSize.height <= 0) {
            return false;
        }

        this.node.getWorldPosition(this.cameraWorldPos);
        const halfViewHeight = this.camera.orthoHeight;
        const halfViewWidth = halfViewHeight * visibleSize.width / visibleSize.height;
        return worldPos.x >= this.cameraWorldPos.x - halfViewWidth
            && worldPos.x <= this.cameraWorldPos.x + halfViewWidth
            && worldPos.y >= this.cameraWorldPos.y - halfViewHeight
            && worldPos.y <= this.cameraWorldPos.y + halfViewHeight;
    }

    lateUpdate(deltaTime: number) {
        if (playerMgr.cameraFollow && playerMgr.player) {
            this.playerPos = playerMgr.player.getPosition();

            this.setCameraPos(this.playerPos);
        }

    }
}
