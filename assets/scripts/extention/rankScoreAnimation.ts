import { Label, tween, Tween } from 'cc';
import { pData } from '../manager/playerData';

/** 先展示本次积分变化，再结算段位；关闭界面时也保证只结算一次。 */
export class RankScoreAnimation {
    private scoreTween: Tween<{ score: number }> = null;
    private settle: (() => void) = null;

    play(label: Label, scoreChange: number): number {
        this.finish();
        const startScore = pData.rankScore;
        const result = pData.getRankScoreResult(scoreChange);
        const actualChange = result.actualChange;
        // 降段从下一段位满分开始扣，晋升仍先展示累加后的总分。
        const animationStartScore = result.rank < pData.rank
            ? result.rankScore - actualChange : startScore;
        const targetScore = animationStartScore + actualChange;
        this.settle = () => {
            pData.fixRankScore(scoreChange);
            if (label?.isValid) label.string = String(pData.rankScore);
        };
        if (!label?.isValid) {
            this.finish();
            return actualChange;
        }

        label.string = String(animationStartScore);
        if (actualChange === 0) {
            this.finish();
            return actualChange;
        }
        const progress = { score: animationStartScore };
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
            // 保留积分变化结果，再统一结算段位并刷新徽章。
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
