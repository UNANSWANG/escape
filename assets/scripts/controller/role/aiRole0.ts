import { _decorator } from 'cc';
import { role0 } from './role0';
const { ccclass } = _decorator;

@ccclass('aiRole0')
export class aiRole0 extends role0 {
    get isAI(): boolean { return true; }
}
