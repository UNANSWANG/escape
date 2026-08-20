import { _decorator, Component, instantiate, Node } from 'cc';
import { ccResTools } from '../extention/resTools';
import { uiMgr } from './UIManager';
import { UIPath } from './pathConfig';
const { ccclass, property } = _decorator;

@ccclass('startManager')
export class startManager extends Component {
    start() {
        this.init();
    }

    async init() {
        await this.preLoadBundle();

    }

    /**预加载bundle */
    async preLoadBundle() {
        return new Promise<void>(async (resolve, reject) => {
            let startBundle = await ccResTools.loadBundle("startAsset");

            let prefab = await ccResTools.loadPrefab(startBundle, UIPath.UILoading);
            let node = instantiate(prefab);
            this.node.addChild(node);
            resolve();
        });
    }
}


