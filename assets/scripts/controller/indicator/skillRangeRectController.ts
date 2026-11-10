import { _decorator, Color, Component, Graphics, tween, Tween, UITransform } from 'cc';
const { ccclass } = _decorator;

@ccclass('skillRangeRectController')
export class skillRangeRectController extends Component {
    private bgTween: Tween<UITransform> = null;

    /** 初始化矩形范围：宽、高和背景填满所需时间（秒）。 */
    init(width: number, height: number, time: number): void {
        this.stopBgTween();
        const lineNode = this.node.getChildByName('line');
        const line = lineNode?.getComponent(UITransform);
        const graphics = lineNode?.getComponent(Graphics);
        const bg = this.node.getChildByName('bg')?.getComponent(UITransform);
        const rangeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
        const rangeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
        this.node.getComponent(UITransform)?.setContentSize(rangeWidth, rangeHeight);
        line?.setContentSize(rangeWidth, rangeHeight);
        if (graphics) {
            graphics.clear();
            graphics.strokeColor = Color.WHITE;
            graphics.lineWidth = 8;
            if (rangeWidth > graphics.lineWidth && rangeHeight > graphics.lineWidth) {
                graphics.rect(
                    -rangeWidth / 2 + graphics.lineWidth / 2,
                    -rangeHeight / 2 + graphics.lineWidth / 2,
                    rangeWidth - graphics.lineWidth,
                    rangeHeight - graphics.lineWidth,
                );
                graphics.stroke();
            }
        }
        if (!bg) return;

        bg.setContentSize(0, 0);
        const bgWidth = Math.max(0, rangeWidth - 2);
        const bgHeight = Math.max(0, rangeHeight - 2);
        if (!Number.isFinite(time) || time <= 0) {
            bg.setContentSize(bgWidth, bgHeight);
            return;
        }
        this.bgTween = tween(bg)
            .to(time, { width: bgWidth, height: bgHeight }, { easing: 'linear' })
            .call(() => { this.bgTween = null; })
            .start();
    }

    protected onDisable(): void {
        this.stopBgTween();
    }

    protected onDestroy(): void {
        this.stopBgTween();
    }

    private stopBgTween(): void {
        this.bgTween?.stop();
        this.bgTween = null;
    }
}
