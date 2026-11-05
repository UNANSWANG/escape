import { _decorator, Camera, Component, Rect, Vec2, Vec3, view } from 'cc';
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
    private playerPos = new Vec3();
    private cameraPos: Vec3 = null;
    private lastFollowPos = new Vec3(NaN, NaN, NaN);
    private halfViewWidth = 0;
    private halfViewHeight = 0;
    private cameraWorldPos: Vec3 = new Vec3();
    private isPositionLocked: boolean = false;
    /** 当前视野倍率。数值越大，可见的地图范围越大。 */
    private viewScale = 1;
    /**地图背景在世界坐标中的实际边界。 */
    private mapBounds: Rect = null;

    setMapBounds(bounds: Rect | null) {
        if (this.mapBounds === bounds || (this.mapBounds && bounds
            && this.mapBounds.x === bounds.x && this.mapBounds.y === bounds.y
            && this.mapBounds.width === bounds.width && this.mapBounds.height === bounds.height)) return;
        this.mapBounds = bounds;
        this.updateOrthoHeight();
    }
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
        // 开场可能已在 start 前定位并锁定相机，保留出生点坐标。
        this.cameraPos = this.node.position.clone();
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
        let orthoHeight = this.OrthoHeight * this.viewScale * designAspect / currentAspect;
        if (this.mapBounds) {
            // 地图小于当前视野时缩小视野，保证画面四边仍在地图内。
            orthoHeight = Math.min(orthoHeight,
                this.mapBounds.height / 2, this.mapBounds.width / (2 * currentAspect));
        }
        const projectionChanged = this.camera.orthoHeight !== orthoHeight
            || this.halfViewWidth !== orthoHeight * currentAspect || this.halfViewHeight !== orthoHeight;
        if (this.camera.orthoHeight !== orthoHeight) this.camera.orthoHeight = orthoHeight;
        this.halfViewHeight = orthoHeight;
        this.halfViewWidth = orthoHeight * currentAspect;
        // 分辨率或缩放变化后，即使开场锁定了位置也必须重新校正边界。
        this.cameraPos = this.limitCameraPos(this.node.position);
        if (!this.node.position.equals(this.cameraPos)) this.node.setPosition(this.cameraPos);
        this.lastFollowPos.set(NaN, NaN, NaN);
        if (projectionChanged) gm.Event.emit(GameEvent.refreshGameCamera);
    }

    /** 设置相机可视范围倍率，并立即重新计算相机边界与 UI 坐标换算比例。 */
    setViewScale(scale = 1) {
        const validScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
        if (this.viewScale === validScale) return;
        this.viewScale = validScale;
        this.updateOrthoHeight();
    }

    private limitCameraPos(cameraPos: Vec3): Vec3 {
        if (!this.camera) {
            return cameraPos;
        }

        const halfViewHeight = this.halfViewHeight;
        const halfViewWidth = this.halfViewWidth;
        const bounds = this.mapBounds;
        const centerX = bounds ? bounds.x + bounds.width / 2 : 0;
        const centerY = bounds ? bounds.y + bounds.height / 2 : 0;
        const minX = (bounds ? bounds.x : -pData.mapHalfSize.x) + halfViewWidth;
        const maxX = (bounds ? bounds.x + bounds.width : pData.mapHalfSize.x) - halfViewWidth;
        const minY = (bounds ? bounds.y : -pData.mapHalfSize.y) + halfViewHeight;
        const maxY = (bounds ? bounds.y + bounds.height : pData.mapHalfSize.y) - halfViewHeight;
        const limitPos = cameraPos.clone();
        if (this.node.parent) Vec3.transformMat4(limitPos, limitPos, this.node.parent.worldMatrix);

        limitPos.x = minX <= maxX ? Math.min(Math.max(limitPos.x, minX), maxX) : centerX;
        limitPos.y = minY <= maxY ? Math.min(Math.max(limitPos.y, minY), maxY) : centerY;
        if (this.node.parent) this.node.parent.inverseTransformPoint(limitPos, limitPos);

        return limitPos;
    }

    /**直接设置相机的坐标 */
    setCameraPos(pos: Vec3) {
        if (this.isPositionLocked) {
            return;
        }

        this.cameraPos = this.limitCameraPos(pos);
        if (!this.node.position.equals(this.cameraPos)) this.node.setPosition(this.cameraPos);
        this.lastFollowPos.set(NaN, NaN, NaN);
    }

    /**锁定相机坐标，解锁前忽略其他位置控制 */
    lockCameraPos(pos: Vec3) {
        this.isPositionLocked = false;
        this.setCameraPos(pos);
        this.isPositionLocked = true;
    }

    /**解除相机坐标锁定 */
    unlockCameraPos() {
        this.isPositionLocked = false;
        this.lastFollowPos.set(NaN, NaN, NaN);
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

        this.node.getWorldPosition(this.cameraWorldPos);
        const halfViewHeight = this.halfViewHeight;
        const halfViewWidth = this.halfViewWidth;
        return worldPos.x >= this.cameraWorldPos.x - halfViewWidth
            && worldPos.x <= this.cameraWorldPos.x + halfViewWidth
            && worldPos.y >= this.cameraWorldPos.y - halfViewHeight
            && worldPos.y <= this.cameraWorldPos.y + halfViewHeight;
    }

    lateUpdate(deltaTime: number) {
        if (!this.isPositionLocked && playerMgr.cameraFollow && playerMgr.player) {
            playerMgr.player.getWorldPosition(this.playerPos);
            if (this.node.parent) this.node.parent.inverseTransformPoint(this.playerPos, this.playerPos);
            if (this.playerPos.equals(this.lastFollowPos)) return;
            this.setCameraPos(this.playerPos);
            this.lastFollowPos.set(this.playerPos);
        }

    }
}
