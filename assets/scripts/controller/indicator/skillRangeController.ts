import { _decorator, Color, Component, Graphics, tween, Tween, UITransform } from 'cc';
const { ccclass } = _decorator;

@ccclass('skillRangeController')
export class skillRangeController extends Component {
    private bgTween: Tween<UITransform> = null;

    /** Set the radius and the time in seconds for the background to fill the range. */
    init(radius: number, time: number): void {
        this.stopBgTween();
        const lineNode = this.node.getChildByName('line');
        const line = lineNode?.getComponent(UITransform);
        const graphics = lineNode?.getComponent(Graphics);
        const bg = this.node.getChildByName('bg')?.getComponent(UITransform);
        const diameter = Number.isFinite(radius) ? Math.max(0, radius) * 2 : 0;
        line?.setContentSize(diameter, diameter);
        if (graphics) {
            graphics.clear();
            graphics.strokeColor = Color.WHITE;
            graphics.lineWidth = 8;
            if (diameter > 2) {
                graphics.circle(0, 0, diameter / 2 - graphics.lineWidth / 2);
                graphics.stroke();
            }
        }
        if (!bg) return;

        bg.setContentSize(0, 0);
        const size = Math.max(0, diameter - 2);
        if (!Number.isFinite(time) || time <= 0) {
            bg.setContentSize(size, size);
            return;
        }
        this.bgTween = tween(bg)
            .to(time, { width: size, height: size }, { easing: 'linear' })
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
