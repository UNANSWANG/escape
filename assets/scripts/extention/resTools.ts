import { _decorator, AnimationClip, AssetManager, assetManager, Component, ImageAsset, JsonAsset, Node, Prefab, sp, Sprite, SpriteFrame, Texture2D, TiledMapAsset } from 'cc';
import { gm, PlatType } from '../manager/gm';
import { GameEvent } from '../manager/configData';
const { ccclass, property } = _decorator;

@ccclass('RemoteImageLease')
export class RemoteImageLease extends Component {
    private frame: SpriteFrame = null;
    private listeningForDestroy = false;

    setFrame(frame: SpriteFrame) {
        if (frame && !this.listeningForDestroy) {
            // 未激活过的节点也可能销毁，不能只依赖组件的 onDestroy。
            this.node.once(Node.EventType.NODE_DESTROYED, this.onDestroy, this);
            this.listeningForDestroy = true;
        }
        const previous = this.frame;
        this.frame = frame;
        if (previous) ccResTools.releaseRemoteImage(previous);
    }

    protected onDestroy(): void {
        this.node.off(Node.EventType.NODE_DESTROYED, this.onDestroy, this);
        this.setFrame(null);
    }

    /**对象池回收时立即释放头像引用。 */
    onPoolPut() {
        const sprite = this.getComponent(Sprite);
        if (sprite?.spriteFrame === this.frame) sprite.spriteFrame = null;
        this.setFrame(null);
    }
}

@ccclass('resTools')
export class resTools {
    /**已完成的本地图片资源缓存 */
    picMap: Map<string, SpriteFrame> = new Map();
    /**已完成的Spine资源缓存 */
    spineMap: Map<string, sp.SkeletonData> = new Map();
    /**正在加载的图片Promise，同路径并发请求共享一次加载 */
    private picLoadingMap: Map<string, Promise<SpriteFrame>> = new Map();
    /**正在加载的Spine Promise，同路径并发请求共享一次加载 */
    private spineLoadingMap: Map<string, Promise<sp.SkeletonData>> = new Map();
    private prefabLoadingMaps = new WeakMap<AssetManager.Bundle, Map<string, Promise<Prefab>>>();
    private pictureQueue: Array<{ key: string; background: boolean; run: () => void }> = [];
    private activePictures = 0;
    private activeBackgroundPictures = 0;
    /**远程头像按最近使用顺序保留，正在显示或等待回写的图片不淘汰。 */
    private remoteImages = new Map<string, SpriteFrame>();
    private readonly remoteImageLimit = 64;
    //加载bundle
    loadBundle($name): Promise<AssetManager.Bundle> {
        return new Promise(($resolve, reject) => {
            assetManager.loadBundle($name, (err, res: AssetManager.Bundle) => {
                if (err || !res) {
                    reject(err || new Error(`加载bundle失败: ${$name}`));
                    return;
                }
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
    /**加载网络图片并取得一份使用引用，调用方需转交给 RemoteImageLease 或主动释放。 */
    async loadPicByUrl($url: string): Promise<SpriteFrame> {
        let cacheKey = `remote:${$url}`;
        const cached = this.remoteImages.get(cacheKey);
        if (cached) {
            this.remoteImages.delete(cacheKey);
            this.remoteImages.set(cacheKey, cached);
            cached.addRef();
            return cached;
        }
        if (this.picLoadingMap.has(cacheKey)) {
            // 相同URL已在加载时直接等待同一个Promise，避免重复创建纹理
            const frame = await this.picLoadingMap.get(cacheKey);
            frame?.addRef();
            return frame;
        }

        let loading = new Promise<SpriteFrame>(($resolve) => {
            assetManager.loadRemote($url, { ext: `.jpg` }, (err, res: ImageAsset) => {
                if (err || !res) {
                    console.log(err);
                    $resolve(null);
                    return;
                }
                let $img = res instanceof ImageAsset ? res : new ImageAsset(res);
                $img.addRef();
                let $tex = new Texture2D();
                let $spriteFrame = new SpriteFrame();
                // 独立管理头像纹理，避免进入动态图集后误释放共享图集纹理。
                $spriteFrame.packable = false;
                $tex.image = $img;
                $spriteFrame.texture = $tex;
                this.remoteImages.set(cacheKey, $spriteFrame);
                $resolve($spriteFrame);
            });
        });
        this.picLoadingMap.set(cacheKey, loading);
        try {
            const result = await loading;
            result?.addRef();
            return result;
        } finally {
            this.picLoadingMap.delete(cacheKey);
        }
    }

    releaseRemoteImage(frame: SpriteFrame) {
        frame.decRef(false);
        this.trimRemoteImages();
    }

    trimRemoteImages() {
        for (const [key, frame] of this.remoteImages) {
            if (this.remoteImages.size <= this.remoteImageLimit) break;
            if (frame.refCount > 0) continue;
            this.remoteImages.delete(key);
            const texture = frame.texture as Texture2D;
            const image = texture?.image;
            frame.destroy();
            texture?.destroy();
            image?.decRef();
        }
    }

    /**加载预制体*/
    loadPrefab($bundle: AssetManager.Bundle, $path: string, showLoading: boolean = true): Promise<Prefab> {
        if (!$bundle) return Promise.reject(new Error('资源包尚未加载'));
        const cached = $bundle.get($path, Prefab);
        if (cached) return Promise.resolve(cached);
        let tasks = this.prefabLoadingMaps.get($bundle);
        if (!tasks) {
            tasks = new Map();
            this.prefabLoadingMaps.set($bundle, tasks);
        }
        if (tasks.has($path)) return tasks.get($path);
        const task = new Promise<Prefab>(($resolve, reject) => {
            $bundle.load($path, Prefab,
                (finish: number, total: number) => {
                    if (showLoading) {
                        gm.Event.emit(GameEvent.loading, [finish, total, $path]);
                    }
                },
                (err, prefab: Prefab) => {
                    if (err || !prefab) {
                        reject(err || new Error(`加载预制体失败: ${$path}`));
                        return;
                    }
                    $resolve(prefab);
                })
        }).then(prefab => { tasks.delete($path); return prefab; }, error => {
            tasks.delete($path);
            throw error;
        });
        tasks.set($path, task);
        return task;
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

    /**同步查询已解析的图片，命中后可在当前帧直接赋值。 */
    getCachedPic(bundle: AssetManager.Bundle, path: string): SpriteFrame | null {
        if (!bundle) return null;
        return this.picMap.get(`local:${bundle.name}:${path}/spriteFrame`)
            || bundle.get(path + '/spriteFrame', SpriteFrame) || null;
    }

    /**前台最多并发四项，后台仅占一个名额，为当前界面保留加载容量。 */
    private pumpPictures() {
        while (this.activePictures < 4) {
            let index = this.pictureQueue.findIndex(task => !task.background);
            if (index < 0) {
                if (this.activeBackgroundPictures >= 1) return;
                index = this.pictureQueue.findIndex(task => task.background);
            }
            if (index < 0) return;
            const task = this.pictureQueue.splice(index, 1)[0];
            this.activePictures++;
            if (task.background) this.activeBackgroundPictures++;
            task.run();
        }
    }

    /**加载图片；同路径共享任务，前台请求可提升尚未开始的后台任务优先级。 */
    async loadPic($bundle: AssetManager.Bundle, $path: string, call?, background = false): Promise<SpriteFrame> {
        if (!$bundle) return null;
        const cached = this.getCachedPic($bundle, $path);
        if (cached) {
            call && call(cached);
            return cached;
        }
        $path += '/spriteFrame';
        let cacheKey = `local:${$bundle.name}:${$path}`;
        if (this.picMap.has(cacheKey)) {
            let cached = this.picMap.get(cacheKey);
            call && call(cached);
            return cached;
        }
        if (this.picLoadingMap.has(cacheKey)) {
            const queued = this.pictureQueue.find(task => task.key === cacheKey);
            if (queued && !background) {
                queued.background = false;
                this.pumpPictures();
            }
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
            const task = { key: cacheKey, background, run: () => {
                const complete = (err, res: SpriteFrame) => {
                    this.activePictures--;
                    if (task.background) this.activeBackgroundPictures--;
                    if (err || !res) {
                        console.error("加载图片失败", $path, err);
                        $resolve(null);
                    } else {
                        this.picMap.set(cacheKey, res);
                        $resolve(res);
                    }
                    this.pumpPictures();
                };
                try {
                    $bundle.load($path, SpriteFrame, complete);
                } catch (error) {
                    complete(error, null);
                }
            } };
            this.pictureQueue.push(task);
        });
        this.picLoadingMap.set(cacheKey, loading);
        this.pumpPictures();
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


