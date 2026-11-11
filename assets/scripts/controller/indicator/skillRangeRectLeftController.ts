import { _decorator, Color, Component, Graphics, Sprite, tween, Tween, UITransform } from 'cc';
const { ccclass } = _decorator;

@ccclass('skillRangeRectLeftController')
export class skillRangeRectLeftController extends Component {
    private bgTween: Tween<Sprite> = null;

    /** 初始化矩形范围：宽、高和背景填满所需时间（秒）。 */
    init(width: number, height: number, time: number): void {
        this.stopBgTween();
        const lineNode = this.node.getChildByName('line');
        const line = lineNode?.getComponent(UITransform);
        const graphics = lineNode?.getComponent(Graphics);
        const bgNode = this.node.getChildByName('bg');
        const bg = bgNode?.getComponent(UITransform);
        const sprite = bgNode?.getComponent(Sprite);
        const rangeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
        const rangeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
        this.node.getComponent(UITransform)?.setContentSize(rangeWidth, rangeHeight);
        line?.setContentSize(rangeWidth, rangeHeight);
        if (graphics) {
            graphics.clear();
            graphics.strokeColor = Color.WHITE;
            graphics.lineWidth = 8;
            if (rangeWidth > graphics.lineWidth && rangeHeight > graphics.lineWidth) {
                // Graphics 坐标相对 line 原点，边框跟随 bg 的位置和锚点。
                const offsetX = (bgNode?.position.x ?? 0) - lineNode.position.x;
                const offsetY = (bgNode?.position.y ?? 0) - lineNode.position.y;
                graphics.rect(
                    offsetX - rangeWidth * (bg?.anchorX ?? 0.5) + graphics.lineWidth / 2,
                    offsetY - rangeHeight * (bg?.anchorY ?? 0.5) + graphics.lineWidth / 2,
                    rangeWidth - graphics.lineWidth,
                    rangeHeight - graphics.lineWidth,
                );
                graphics.stroke();
            }
        }
        if (!bg) return;

        bg.setContentSize(rangeWidth, rangeHeight);
        if (!sprite) return;
        sprite.type = Sprite.Type.FILLED;
        sprite.fillType = Sprite.FillType.HORIZONTAL;
        sprite.fillStart = 0;
        sprite.fillRange = 0;
        if (!Number.isFinite(time) || time <= 0) {
            sprite.fillRange = 1;
            return;
        }
        this.bgTween = tween(sprite)
            .to(time, { fillRange: 1 }, { easing: 'linear' })
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
