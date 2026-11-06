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
    /**武器视野独立过渡，与技能视野的增幅按加法叠加。 */
    private viewScale = 1;
    private viewStartScale = 1;
    private viewTargetScale = 1;
    private viewElapsed = 0;
    private viewDuration = 0;
    /**技能视野独立于武器视野，按游戏时间平滑过渡。 */
    private skillViewScale = 1;
    private skillViewStartScale = 1;
    private skillViewTargetScale = 1;
    private skillViewElapsed = 0;
    private skillViewDuration = 0;
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
        this.setViewScale(1, 0);
        this.setSkillViewScale(1, 0);
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
        let orthoHeight = this.OrthoHeight * (1 + (this.viewScale - 1) + (this.skillViewScale - 1)) * designAspect / currentAspect;
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

    /**设置武器视野倍率；与技能一样默认在 0.2 秒内平滑过渡。 */
    setViewScale(scale = 1, duration = 0.2) {
        const validScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
        const validDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
        // 重复同步同一武器时保留正在进行的过渡；duration 为 0 时立即应用。
        if (this.viewTargetScale === validScale && validDuration > 0) return;
        this.viewStartScale = this.viewScale;
        this.viewTargetScale = validScale;
        this.viewElapsed = 0;
        this.viewDuration = validDuration;
        if (this.viewDuration === 0) {
            this.viewScale = this.viewTargetScale;
            this.updateOrthoHeight();
        }
    }

    /**设置技能视野倍率；从当前倍率开始过渡，结束后传入 1 恢复。 */
    setSkillViewScale(scale = 1, duration = 0.2) {
        this.skillViewStartScale = this.skillViewScale;
        this.skillViewTargetScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
        this.skillViewElapsed = 0;
        this.skillViewDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
        if (this.skillViewDuration === 0) {
            this.skillViewScale = this.skillViewTargetScale;
            this.updateOrthoHeight();
        }
    }

    private updateViewScales(dt: number) {
        if (gm.isGamePause || dt <= 0) return;
        let changed = false;
        if (this.viewScale !== this.viewTargetScale) {
            this.viewElapsed = Math.min(this.viewDuration, this.viewElapsed + dt);
            const progress = this.viewDuration > 0 ? this.viewElapsed / this.viewDuration : 1;
            const ratio = progress * progress * (3 - 2 * progress);
            this.viewScale = progress >= 1 ? this.viewTargetScale
                : this.viewStartScale + (this.viewTargetScale - this.viewStartScale) * ratio;
            changed = true;
        }
        if (this.skillViewScale !== this.skillViewTargetScale) {
            this.updateSkillViewScale(dt);
            changed = true;
        }
        // 同帧的武器与技能过渡合并刷新，保持相机边界和 UI 换算同步。
        if (changed) this.updateOrthoHeight();
    }

    private updateSkillViewScale(dt: number) {
        this.skillViewElapsed = Math.min(this.skillViewDuration, this.skillViewElapsed + dt);
        const progress = this.skillViewDuration > 0 ? this.skillViewElapsed / this.skillViewDuration : 1;
        // 平滑起止速度，避免视野变化开始和结束时突兀。
        const ratio = progress * progress * (3 - 2 * progress);
        this.skillViewScale = progress >= 1 ? this.skillViewTargetScale
            : this.skillViewStartScale + (this.skillViewTargetScale - this.skillViewStartScale) * ratio;
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
        this.updateViewScales(deltaTime);
        if (!this.isPositionLocked && playerMgr.cameraFollow && playerMgr.player) {
            playerMgr.player.getWorldPosition(this.playerPos);
            if (this.node.parent) this.node.parent.inverseTransformPoint(this.playerPos, this.playerPos);
            if (this.playerPos.equals(this.lastFollowPos)) return;
            this.setCameraPos(this.playerPos);
            this.lastFollowPos.set(this.playerPos);
        }

    }
}
