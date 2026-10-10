import { _decorator, Component, Label, Node } from 'cc';
import { storePageBase } from './storePageBase';
const { ccclass, property } = _decorator;

@ccclass('weaponStorePage')
export class weaponStorePage extends storePageBase {
    @property(Node)
    content: Node;

    @property(Label)
    showNameLab: Label;

    @property(Node)
    attributeLayout: Node;
}


