import { _decorator, Color, Label, Node, Sprite, instantiate } from 'cc';
import { storePageBase } from './storePageBase';
const { ccclass, property } = _decorator;

@ccclass('equipStorePage')
export class equipStorePage extends storePageBase {
    @property(Node)
    content: Node;

    @property(Label)
    showNameLab: Label;

    @property(Node)
    attributeNode: Node;

}


