import { _decorator } from 'cc';
import { role1 } from './role1';
import { AIPatrol } from './aiPatrol';
import type { UIGame } from '../../UIPage/UIGame';
const { ccclass } = _decorator;

@ccclass('aiRole1')
export class aiRole1 extends role1 {
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
