import { _decorator, BlockInputEvents, EventTouch, Graphics, Mask, Node, Rect, UITransform, Vec3 } from 'cc';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
const { ccclass } = _decorator;

@ccclass('UIGuide')
export class UIGuide extends UIBase {

    private maskTransform: UITransform = null;
    private graphics: Graphics = null;
    private finger: Node = null;
    private targets: Node[] = [];
    private clickTarget: Node = null;
    private onClick: (() => void) = null;
    private passingTouches = new Set<number>();

    protected onLoad(): void {
        const maskNode = this.node.getChildByName('mask');
        const mask = maskNode.getComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        mask.inverted = true;
        this.maskTransform = maskNode.getComponent(UITransform);
        this.graphics = maskNode.getComponent(Graphics);
        this.finger = this.node.getChildByName('finger');
        // 根节点统一拦截输入，仅首个目标区域的触摸穿透到底层节点。
        for (const blocker of maskNode.getComponentsInChildren(BlockInputEvents)) {
            blocker.enabled = false;
        }
        this.node.on(Node.EventType.TOUCH_START, this.handleTouch, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.handleTouch, this);
        this.node.on(Node.EventType.TOUCH_END, this.handleTouch, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.handleTouch, this);
    }

    onUI_Open(data?: { targets: Node | Node[]; onClick?: () => void }) {
        this.showGuide(data?.targets, data?.onClick);
    }

    /**绘制所有目标的矩形挖空区域，并监听首个节点的点击。 */
    showGuide(targets: Node | Node[], onClick?: () => void) {
        this.clearGuide();
        const nodes = Array.isArray(targets) ? targets : [targets];
        this.targets = nodes.filter(node => node?.isValid && !!node.getComponent(UITransform));
        if (!nodes[0]?.isValid || !nodes[0].getComponent(UITransform)) {
            this.onClose();
            return;
        }
        this.clickTarget = nodes[0];
        this.onClick = onClick;
        if (!onClick) this.clickTarget.on(Node.EventType.TOUCH_END, this.clickGuideTarget, this);
        this.node.setSiblingIndex(this.node.parent.children.length - 1);
        this.refreshGuide();
    }

    protected lateUpdate(): void {
        if (!this.clickTarget) return;
        if (!this.clickTarget.isValid || !this.clickTarget.activeInHierarchy) {
            this.onClose();
            return;
        }
        // 跟随布局、缩放及目标移动，保持挖空区域和手指对齐。
        this.refreshGuide();
    }

    private refreshGuide() {
        this.graphics.clear();
        for (const target of this.targets) {
            if (!target.isValid || !target.activeInHierarchy) continue;
            const rect = this.getTargetRect(target);
            this.graphics.rect(rect.x, rect.y, rect.width, rect.height);
            if (target === this.clickTarget) {
                this.finger.setWorldPosition(this.maskTransform.convertToWorldSpaceAR(
                    new Vec3(rect.x + rect.width / 2, rect.y + rect.height / 2)));
            }
        }
        this.graphics.fill();
        this.finger.active = !!this.clickTarget?.activeInHierarchy;
    }

    private getTargetRect(target: Node): Rect {
        const transform = target.getComponent(UITransform);
        const left = -transform.width * transform.anchorX;
        const bottom = -transform.height * transform.anchorY;
        const corners = [
            new Vec3(left, bottom), new Vec3(left + transform.width, bottom),
            new Vec3(left, bottom + transform.height), new Vec3(left + transform.width, bottom + transform.height),
        ].map(point => this.maskTransform.convertToNodeSpaceAR(transform.convertToWorldSpaceAR(point)));
        const minX = Math.min(...corners.map(point => point.x));
        const minY = Math.min(...corners.map(point => point.y));
        return new Rect(minX, minY, Math.max(...corners.map(point => point.x)) - minX,
            Math.max(...corners.map(point => point.y)) - minY);
    }

    private handleTouch(event: EventTouch) {
        const id = event.getID();
        if (event.type === Node.EventType.TOUCH_START && this.clickTarget?.isValid) {
            if (this.clickTarget.getComponent(UITransform).hitTest(event.getLocation())) {
                this.passingTouches.add(id);
            }
        }
        const passing = this.passingTouches.has(id);
        event.preventSwallow = passing && !this.onClick;
        if (event.type === Node.EventType.TOUCH_END || event.type === Node.EventType.TOUCH_CANCEL) {
            this.passingTouches.delete(id);
        }
        if (passing && this.onClick && event.type === Node.EventType.TOUCH_END) {
            this.clickGuideTarget(event);
        }
    }

    private clickGuideTarget(event: EventTouch) {
        if (!this.clickTarget?.isValid
            || !this.clickTarget.getComponent(UITransform).hitTest(event.getLocation())) return;
        const callback = this.onClick;
        this.onClose();
        callback?.();
    }

    private clearGuide() {
        if (this.clickTarget?.isValid) {
            this.clickTarget.off(Node.EventType.TOUCH_END, this.clickGuideTarget, this);
        }
        this.targets = [];
        this.clickTarget = null;
        this.onClick = null;
        this.passingTouches.clear();
        this.graphics?.clear();
        if (this.finger) this.finger.active = false;
    }

    onUI_Close() {
        this.clearGuide();
    }

    protected onDisable(): void {
        this.clearGuide();
    }

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIGuide);
    }
}


