import { Label, tween, Tween } from 'cc';
import { ccTools } from './generalTools';

/** 结算价值从 0 递增显示，保留货币格式，关闭界面时停止动画。 */
export class MonetaryValueAnimation {
    private valueTween: Tween<{ value: number }> = null;

    play(label: Label, value: number): void {
        this.stop();
        if (!label?.isValid) return;
        const targetValue = Number.isFinite(value) ? Math.max(0, value) : 0;
        label.string = ccTools.formatMonetaryNum(0);
        if (targetValue === 0) return;

        const progress = { value: 0 };
        this.valueTween = tween(progress)
            .delay(0.3)
            .to(0.8, { value: targetValue }, {
                onUpdate: () => {
                    if (label.isValid) {
                        label.string = ccTools.formatMonetaryNum(Math.floor(progress.value));
                    }
                },
            })
            .call(() => {
                if (label.isValid) label.string = ccTools.formatMonetaryNum(targetValue);
                this.valueTween = null;
            })
            .start();
    }

    stop(): void {
        this.valueTween?.stop();
        this.valueTween = null;
    }
}
