import { _decorator } from 'cc';
import { role2 } from './role2';
import { AIPatrol } from './aiPatrol';
import type { UIGame } from '../../UIPage/UIGame';
const { ccclass } = _decorator;

@ccclass('aiRole2')
export class aiRole2 extends role2 {
    private patrol = new AIPatrol();

    get isAI(): boolean { return true; }

    init(comp: UIGame, id: number, skinId: number, nickname = '') {
        super.init(comp, id, skinId, nickname);
        this.patrol.reset();
    }

    protected update(dt: number): void {
        super.update(dt);
        this.patrol.update(this, dt);
    }
}
