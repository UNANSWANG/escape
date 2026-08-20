import { _decorator, AnimationClip, AssetManager, assetManager, Component, ImageAsset, JsonAsset, Node, Prefab, sp, SpriteFrame, Texture2D, TiledMapAsset } from 'cc';
import { gm, PlatType } from '../manager/gm';
import { GameEvent } from '../manager/configData';
const { ccclass, property } = _decorator;

@ccclass('resTools')
export class resTools {
    /**已完成的图片资源缓存，本地与远端使用不同前缀避免路径碰撞 */
    picMap: Map<string, SpriteFrame> = new Map();
    /**已完成的Spine资源缓存 */
    spineMap: Map<string, sp.SkeletonData> = new Map();
    /**正在加载的图片Promise，同路径并发请求共享一次加载 */
    private picLoadingMap: Map<string, Promise<SpriteFrame>> = new Map();
    /**正在加载的Spine Promise，同路径并发请求共享一次加载 */
    private spineLoadingMap: Map<string, Promise<sp.SkeletonData>> = new Map();
    //加载bundle
    loadBundle($name): Promise<AssetManager.Bundle> {
        return new Promise(($resolve) => {
            assetManager.loadBundle($name, (err, res: AssetManager.Bundle) => {
                console.log("加载bundle完成:", $name);
                $resolve(res);
            })
        });
    }
    //通过budle加载资源，此处以json资源为例
    loadJsonByUrl(url): Promise<JSON> {
        return new Promise((resolve: (value) => void, reject: (error?: Error) => void) => {
            if (gm.platType == PlatType.h5) {
                try {
                    fetch(url).then((response) => {
                        if (!response.ok) {

                            throw new Error(`HTTP ${response.status}`);
                        }

                        resolve(response.json());
                    });

                } catch (e) {

                    console.error("加载json失败:", e);

                    reject(e);
                }
            } else {
                try {
                    assetManager.loadRemote(url, { ext: '.json' }, (err, myJson: any) => {
                        if (err) {
                            console.log("加载远程json失败:", err);
                            reject(err);
                        }
                        // console.log("NET_JSON=======>,", myJson.json);
                        resolve(myJson.json);
                    })
                } catch (err) {
                    console.log("加载远程json失败catch:", err);
                    reject(err);
                }
            }
        });
    }
    /**加载网络图片 */
    async loadPicByUrl($url: string): Promise<SpriteFrame> {
        let cacheKey = `remote:${$url}`;
        if (this.picMap.has(cacheKey)) {
            return this.picMap.get(cacheKey);
        }
        if (this.picLoadingMap.has(cacheKey)) {
            // 相同URL已在加载时直接等待同一个Promise，避免重复创建纹理
            return this.picLoadingMap.get(cacheKey);
        }

        let loading = new Promise<SpriteFrame>(($resolve) => {
            assetManager.loadRemote($url, { ext: `.jpg` }, (err, res: ImageAsset) => {
                if (err || !res) {
                    console.log(err);
                    $resolve(null);
                    return;
                }
                let $img = res instanceof ImageAsset ? res : new ImageAsset(res);
                let $tex = new Texture2D();
                let $spriteFrame = new SpriteFrame();
                $tex.image = $img;
                $spriteFrame.texture = $tex;
                this.picMap.set(cacheKey, $spriteFrame);
                $resolve($spriteFrame);
            });
        });
        this.picLoadingMap.set(cacheKey, loading);
        let result = await loading;
        this.picLoadingMap.delete(cacheKey);
        return result;
    }

    /**加载预制体*/
    loadPrefab($bundle: AssetManager.Bundle, $path: string, showLoading: boolean = true): Promise<Prefab> {
        return new Promise(($resolve) => {
            $bundle.load($path, Prefab,
                (finish: number, total: number) => {
                    if (showLoading) {
                        gm.Event.emit(GameEvent.loading, [finish, total, $path]);
                    }
                },
                (err, prefab: Prefab) => {
                    $resolve(prefab);
                })
        });
    }

    /**加载animation动画 */
    loadAnimationClip($bundle: AssetManager.Bundle, $path: string, showLoading: boolean = true): Promise<AnimationClip> {
        return new Promise(($resolve) => {
            $bundle.load($path, AnimationClip,
                (finish: number, total: number) => {
                    if (showLoading) {
                        gm.Event.emit(GameEvent.loading, [finish, total, $path]);
                    }
                },
                (err, clip: AnimationClip) => {
                    if (err) {
                        console.error("加载animation动画失败", $path, err);
                        $resolve(null);
                        return;
                    }

                    $resolve(clip);
                })
        });
    }

    /**
     * 加载一张图片,
     * @param $bundle 
     * @param $path 资源路径
     * @param call 回调
     * @returns 
     */
    async loadPic($bundle: AssetManager.Bundle, $path: string, call?): Promise<SpriteFrame> {
        let cacheKey = `local:${$path}`;
        if (this.picMap.has(cacheKey)) {
            let cached = this.picMap.get(cacheKey);
            call && call(cached);
            return cached;
        }
        if (this.picLoadingMap.has(cacheKey)) {
            // 相同资源路径只发起一次bundle.load
            let loadingResult = await this.picLoadingMap.get(cacheKey);
            call && call(loadingResult);
            return loadingResult;
        }

        let loading = new Promise<SpriteFrame>(($resolve) => {
            if (!$bundle) {
                $resolve(null);
                return;
            }
            $bundle.load($path, SpriteFrame, (err, res: SpriteFrame) => {
                if (err || !res) {
                    console.error("加载图片失败", $path, err);
                    $resolve(null);
                    return;
                }
                this.picMap.set(cacheKey, res);
                $resolve(res);
            });
        });
        this.picLoadingMap.set(cacheKey, loading);
        let result = await loading;
        this.picLoadingMap.delete(cacheKey);
        call && call(result);
        return result;
    }

    /**加载spine数据 */
    async loadSpine($bundle: AssetManager.Bundle, $path: string): Promise<sp.SkeletonData> {
        if (this.spineMap.has($path)) {
            return this.spineMap.get($path);
        }
        if (this.spineLoadingMap.has($path)) {
            // 多个节点同时请求同一份骨骼数据时复用加载任务
            return this.spineLoadingMap.get($path);
        }

        let loading = new Promise<sp.SkeletonData>(($resolve) => {
            if (!$bundle) {
                $resolve(null);
                return;
            }
            $bundle.load($path, sp.SkeletonData, (err, res: sp.SkeletonData) => {
                if (err || !res) {
                    console.log("加载spine失败", $path, err);
                    $resolve(null);
                    return;
                }

                this.spineMap.set($path, res);
                $resolve(res);
            });
        });
        this.spineLoadingMap.set($path, loading);
        let result = await loading;
        this.spineLoadingMap.delete($path);
        return result;
    }

    loadJson($bundle: AssetManager.Bundle, $path: string): Promise<any> {
        return new Promise(($resolve) => {
            $bundle.load($path, JsonAsset, (err, jsonAsset: JsonAsset) => {

                // 获取 JSON 数据
                const jsonData = jsonAsset.json;
                // console.warn($path,'JSON 数据:', jsonData);

                $resolve(jsonData);
            });
        });
    }

    /**加载瓦片地图 */
    loadTiledMap($bundle: AssetManager.Bundle, $path: string, showLoading: boolean = true): Promise<TiledMapAsset> {
        return new Promise(($resolve) => {
            $bundle.load($path, TiledMapAsset,
                (finish: number, total: number) => {
                    if (showLoading) {
                        gm.Event.emit(GameEvent.loading, [finish, total, $path]);
                    }
                },
                (err, tiledMapAsset: TiledMapAsset) => {
                    if (err) {
                        console.error("加载瓦片地图失败", $path, err);
                        $resolve(null);
                        return;
                    }

                    $resolve(tiledMapAsset);
                });
        });
    }
}
export let ccResTools = new resTools();


