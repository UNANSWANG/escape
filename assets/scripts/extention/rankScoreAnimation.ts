import { Label, tween, Tween } from 'cc';
import { pData } from '../manager/playerData';

/** 先展示本次积分变化，再结算晋升；关闭界面时也保证只结算一次。 */
export class RankScoreAnimation {
    private scoreTween: Tween<{ score: number }> = null;
    private settle: (() => void) = null;

    play(label: Label, scoreChange: number): number {
        this.finish();
        const startScore = pData.rankScore;
        const targetScore = Math.max(0, startScore + Math.trunc(scoreChange));
        const actualChange = targetScore - startScore;
        this.settle = () => {
            pData.fixRankScore(actualChange);
            if (label?.isValid) label.string = String(pData.rankScore);
        };
        if (!label?.isValid) {
            this.finish();
            return actualChange;
        }

        label.string = String(startScore);
        if (actualChange === 0) {
            this.finish();
            return actualChange;
        }
        const progress = { score: startScore };
        this.scoreTween = tween(progress)
            .delay(0.3)
            .to(0.8, { score: targetScore }, {
                onUpdate: () => {
                    if (label.isValid) label.string = String(Math.round(progress.score));
                },
            })
            .call(() => {
                if (label.isValid) label.string = String(targetScore);
            })
            // 保留累加后的总分，再扣除晋升所需积分。
            .delay(0.2)
            .call(() => this.finish())
            .start();
        return actualChange;
    }

    finish(): void {
        this.scoreTween?.stop();
        this.scoreTween = null;
        const settle = this.settle;
        this.settle = null;
        settle?.();
    }
}
