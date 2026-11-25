import { _decorator, AssetManager, AudioClip, AudioSource, Component, Node } from 'cc';
import { audioPath } from './pathConfig';
import { uiMgr } from './UIManager';
import { ccStorageTools } from '../extention/storageTools';
import { SaveKey } from './configData';
const { ccclass, property } = _decorator;

@ccclass('audioManager')
export class audioManager {
    /**音频组件 */
    private audios: AudioSource[] = null;
    /**背景音乐组件 */
    private musicSource: AudioSource = null;
    /**当前音频索引 */
    private _curAudioSource: number = 0;
    /**已加载完的音频 */
    private _dic: Map<string, AudioClip> = new Map();
    /**正在加载的音频 */
    private dic_loading: Map<string, number> = new Map();
    /**默认音效使用的音频组件 */
    private _audioSource: AudioSource = null;
    /**游戏页内使用的场景音效组件 */
    private _sceneAudioSource: AudioSource = null;
    /** 玩家脚步循环使用独立通道。 */
    private _walkSource: AudioSource = null;
    private _walkPath = '';
    private _walkVersion = 0;
    private _walkLoads = new Map<string, Promise<AudioClip>>();
    /**场景音效会话序号，用于丢弃退出游戏前的异步播放请求 */
    private _sceneEffectVersion: number = 0;
    /** 场景循环音效按拥有者隔离，避免不同 Boss 相互打断。 */
    private _sceneLoops = new Map<Node, AudioSource>();
    private _sceneLoopsPaused = false;
    private _sceneResumedOwners = new Set<Node>();
    /**音效开关 */
    private _isEffect: boolean = true;
    /**背景音乐开关 */
    private _isMusic: boolean = true;
    /**音效音量 */
    private _effectVolume: number = 1;
    /**背景音乐音量 */
    private _musicVolume: number = 1;
    /**振动开关 */
    private _isVibrat: boolean = true;
    /**正在播放的背景音乐 */
    private _curMusicPath: string = audioPath.background;
    private _backgroundMusicRequested = false;

    /**初始化音频管理 */
    initAudio(node) {
        this.audios = [];
        for (let i = 0; i < 10; i++) {
            let audio = node.addComponent(AudioSource);
            this.audios.push(audio);
        }
        this.musicSource = node.addComponent(AudioSource);
        this.musicSource.loop = true;

        this.initStorageData();

        //获取一个音频组件并打断所有语音
        this._audioSource = this.getOneSoundAudio(false);
    }

    /**初始化游戏页内的场景音效组件 */
    initSceneAudio(node: Node) {
        if (!node || (this._sceneAudioSource?.isValid && this._sceneAudioSource.node == node)) {
            return;
        }
        this.stopSceneEffects();
        if (this._walkSource?.isValid) this._walkSource.destroy();
        if (this._sceneAudioSource?.isValid) {
            this._sceneAudioSource.stop();
        }

        this._sceneAudioSource = node.addComponent(AudioSource);
        this._sceneAudioSource.volume = this._effectVolume;
        this._walkSource = node.addComponent(AudioSource);
        // 游戏页会缓存复用，重新激活时不能自动恢复上一局的脚步。
        this._walkSource.playOnAwake = false;
        this._walkSource.loop = true;
        this._walkSource.volume = this._effectVolume;
    }

    /**初始化内存的存储数据 */
    initStorageData() {
        let effectSave = ccStorageTools.getData(SaveKey.effect);
        let musicSave = ccStorageTools.getData(SaveKey.music);
        let effectVolumeSave = ccStorageTools.getData(SaveKey.effectVolume);
        let musicVolumeSave = ccStorageTools.getData(SaveKey.musicVolume);
        let vibratSave = ccStorageTools.getData(SaveKey.vibrat);

        if (effectSave != null) {
            this._isEffect = effectSave;
        }

        if (musicSave != null) {
            this._isMusic = musicSave;
        }

        if (effectVolumeSave != null) {
            this._effectVolume = this.limitVolume(Number(effectVolumeSave));
        }

        if (musicVolumeSave != null) {
            this._musicVolume = this.limitVolume(Number(musicVolumeSave));
        }

        if (vibratSave != null) {
            this._isVibrat = vibratSave;
        }

        this.applyEffectVolume();
        this.applyMusicVolume();
    }

    get isEffect() {
        return this._isEffect;
    }

    get isMusic() {
        return this._isMusic;
    }

    get isVibrat() {
        return this._isVibrat;
    }

    get effectVolume() {
        return this._effectVolume;
    }

    get musicVolume() {
        return this._musicVolume;
    }

    private limitVolume(value: number) {
        if (isNaN(value)) {
            return 1;
        }
        return Math.max(0, Math.min(1, value));
    }

    private applyEffectVolume() {
        for (const source of this._sceneLoops.values()) {
            if (source.isValid) source.volume = this._effectVolume;
        }
        if (this._walkSource?.isValid) this._walkSource.volume = this._effectVolume;
        if (!this.audios) {
            return;
        }
        for (let i = 0; i < this.audios.length; i++) {
            this.audios[i].volume = this._effectVolume;
        }
        if (this._audioSource) {
            this._audioSource.volume = this._effectVolume;
        }
        if (this._sceneAudioSource) {
            this._sceneAudioSource.volume = this._effectVolume;
        }
    }

    private applyMusicVolume() {
        if (this.musicSource) {
            this.musicSource.volume = this._musicVolume;
        }
    }

    /**关闭所有音频 */
    closeAllSound() {
        this.closeGlobalEffects();
        this.stopSceneEffects();
    }

    /**停止全局音效通道 */
    private closeGlobalEffects() {
        for (let i = 0; i < this.audios.length; i++) {
            this.audios[i].stop();
        }
    }

    /**停止游戏页内的全部场景音效 */
    stopSceneEffects() {
        for (const owner of this._sceneLoops.keys()) this.stopSceneLoop(owner);
        this._sceneLoopsPaused = false;
        this.stopWalkEffect();
        this._sceneEffectVersion++;
        if (this._sceneAudioSource?.isValid) {
            this._sceneAudioSource.stop();
        }
    }

    /** 每个拥有者使用独立循环通道，受音效开关、音量和场景清理控制。 */
    playSceneLoop(owner: Node, path: string, loop = true) {
        this.stopSceneLoop(owner);
        const sceneSource = this._sceneAudioSource;
        const bundle = uiMgr.resBundle;
        if (!owner?.isValid || !owner.activeInHierarchy || !bundle || !this.canEffectPlay(sceneSource)) return;
        const sourceNode = new Node('sceneOwnedAudio');
        sceneSource.node.addChild(sourceNode);
        const source = sourceNode.addComponent(AudioSource);
        source.playOnAwake = false;
        source.loop = loop;
        source.volume = this._effectVolume;
        this._sceneLoops.set(owner, source);
        if (!loop) {
            sourceNode.once(AudioSource.EventType.ENDED, () => {
                if (this._sceneLoops.get(owner) === source) this.stopSceneLoop(owner);
            });
        }
        const play = (clip: AudioClip) => {
            if (this._sceneLoops.get(owner) !== source) return;
            if (!clip || !owner.isValid || !owner.activeInHierarchy || !this.canEffectPlay(source)) {
                this.stopSceneLoop(owner);
                return;
            }
            source.clip = clip;
            if (!this._sceneLoopsPaused || this._sceneResumedOwners.has(owner)) source.play();
        };
        const cached = this._dic.get(path);
        if (cached) {
            play(cached);
        } else {
            bundle.load(path, AudioClip, (err, clip) => {
                if (err || !clip) {
                    console.error('没有找到声音资源>>>', path, err);
                    play(null);
                    return;
                }
                this._dic.set(path, clip);
                play(clip);
            });
        }
    }

    stopSceneLoop(owner: Node) {
        this._sceneResumedOwners.delete(owner);
        const source = this._sceneLoops.get(owner);
        this._sceneLoops.delete(owner);
        if (source?.isValid) {
            source.stop();
            source.clip = null;
            source.node.destroy();
        }
    }

    /** 暂停时保留循环通道，加载期间也不启动播放。 */
    pauseSceneLoops() {
        this._sceneResumedOwners.clear();
        this._sceneLoopsPaused = true;
        for (const source of this._sceneLoops.values()) {
            if (source.isValid) source.pause();
        }
    }

    resumeSceneLoops() {
        this._sceneResumedOwners.clear();
        this._sceneLoopsPaused = false;
        for (const [owner, source] of this._sceneLoops) {
            if (!owner.isValid || !owner.activeInHierarchy || !this.canEffectPlay(source)) {
                this.stopSceneLoop(owner);
            } else if (source.clip) {
                source.play();
            }
        }
    }

    resumeSceneLoop(owner: Node) {
        const source = this._sceneLoops.get(owner);
        if (!owner?.isValid || !owner.activeInHierarchy || !this.canEffectPlay(source)) return;
        this._sceneResumedOwners.add(owner);
        if (source.clip) source.play();
    }

    /** 按移动方向切换玩家脚步循环，相同方向持续移动时不重播。 */
    playWalkEffect(path: string) {
        const source = this._walkSource;
        const bundle = uiMgr.resBundle;
        if (!bundle || !this.canEffectPlay(source)) {
            this.stopWalkEffect();
            return;
        }
        if (this._walkPath === path) return;
        this.stopWalkEffect();
        this._walkPath = path;
        const version = this._walkVersion;
        const play = (clip: AudioClip) => {
            if (version !== this._walkVersion || !this.canEffectPlay(source)) return;
            if (!clip) {
                this.stopWalkEffect();
                return;
            }
            source.clip = clip;
            source.play();
        };
        const cached = this._dic.get(path);
        if (cached) {
            play(cached);
            return;
        }
        let loading = this._walkLoads.get(path);
        if (!loading) {
            loading = new Promise<AudioClip>(resolve => {
                bundle.load(path, AudioClip, (err, clip) => {
                    this._walkLoads.delete(path);
                    if (err || !clip) {
                        console.error('没有找到声音资源>>>', path, err);
                        resolve(null);
                        return;
                    }
                    this._dic.set(path, clip);
                    resolve(clip);
                });
            });
            this._walkLoads.set(path, loading);
        }
        loading.then(play);
    }

    /** 停止脚步，并作废尚未完成的加载播放请求。 */
    stopWalkEffect() {
        this._walkPath = '';
        this._walkVersion++;
        if (this._walkSource?.isValid && this._walkSource.clip) {
            this._walkSource.stop();
            // 清空 clip 也会作废 AudioSource 内部尚未完成的播放器加载。
            this._walkSource.clip = null;
        }
    }

    /**切换音效开关 */
    switchEffect($isEffect: boolean) {
        this._isEffect = $isEffect;
        ccStorageTools.setData(SaveKey.effect, $isEffect);
        if (!this._isEffect) {
            this.closeAllSound();
        }
    }

    /**切换背景音乐开关 */
    switchMusic($isMusic: boolean) {
        this._isMusic = $isMusic;
        ccStorageTools.setData(SaveKey.music, $isMusic);
        if (!this._isMusic) {
            this.closeBackgroundMusic();
        } else {
            this.playBackgroundMusic();
        }
    }

    /**设置音效音量 */
    setEffectVolume(value: number) {
        this._effectVolume = this.limitVolume(value);
        ccStorageTools.setData(SaveKey.effectVolume, this._effectVolume);
        this.applyEffectVolume();
    }

    /**设置背景音乐音量 */
    setMusicVolume(value: number) {
        this._musicVolume = this.limitVolume(value);
        ccStorageTools.setData(SaveKey.musicVolume, this._musicVolume);
        this.applyMusicVolume();
    }

    /**关闭背景音乐 */
    closeBackgroundMusic() {
        this._backgroundMusicRequested = false;
        this.musicSource.stop();
        this.musicSource.clip = null;
    }

    /**切换振动开关 */
    switchVibrat($isVibrat: boolean) {
        this._isVibrat = $isVibrat;
        ccStorageTools.setData(SaveKey.vibrat, $isVibrat);
    }

    /**获取一个音频组件 */
    getOneSoundAudio(closeSound = true) {
        // 先打断所有的语音
        if (closeSound) this.closeGlobalEffects();
        let cur = this._curAudioSource;
        this._curAudioSource++;
        if (this._curAudioSource >= this.audios.length) {
            this._curAudioSource = 0;
        }
        return this.audios[cur];
    }

    /**播放音效（单次音效播放（互不干涉） */
    playEffect($name: string, bundle: AssetManager.Bundle = uiMgr.resBundle) {
        this.playEffectBySource($name, this._audioSource, bundle);
    }

    /**播放游戏页内的场景音效 */
    playSceneEffect($name: string, bundle: AssetManager.Bundle = uiMgr.resBundle) {
        if (!this._sceneAudioSource?.isValid || !this._sceneAudioSource.node.activeInHierarchy) {
            return;
        }
        let sceneEffectVersion = this._sceneEffectVersion;
        this.playEffectBySource($name, this._sceneAudioSource, bundle, () => {
            return sceneEffectVersion == this._sceneEffectVersion;
        });
    }

    /**使用指定音频组件播放音效 */
    private playEffectBySource($name: string, source: AudioSource, bundle: AssetManager.Bundle, canPlay?: () => boolean) {
        if (!bundle || !this.canEffectPlay(source, canPlay)) {
            return;
        }
        let key = $name;
        //正在加载则直接返回
        if (this.dic_loading.has(key)) {
            return;
        }
        if (this._dic.has(key)) {
            source.playOneShot(this._dic.get(key));
            return;
        } else {
            this.dic_loading.set(key, 1);
            bundle.load($name, AudioClip, (err, res) => {
                this.dic_loading.delete(key);
                if (!res) {
                    console.error("没有找到声音资源>>>", $name);
                    return;
                }
                this._dic.set(key, res);
                if (this.canEffectPlay(source, canPlay)) {
                    source.playOneShot(res);
                }
            });
        }
    }

    /**音效组件当前是否允许播放 */
    private canEffectPlay(source: AudioSource, canPlay?: () => boolean) {
        return this._isEffect && source?.isValid && source.node.activeInHierarchy && (!canPlay || canPlay());
    }

    /**播放背景音乐（单次播放，互不干涉） */
    playBackgroundMusic($name: string = this._curMusicPath, bundle: AssetManager.Bundle = uiMgr.resBundle) {
        if (this._curMusicPath !== $name || !$name) {
            this.closeBackgroundMusic();
        }
        this._curMusicPath = $name;
        this._backgroundMusicRequested = !!$name && this._isMusic;
        if (!this._backgroundMusicRequested || !bundle) {
            return;
        }
        let key = $name;
        if (this.dic_loading.has(key)) {
            return;
        }
        if (this._dic.has(key)) {
            this.musicSource.clip = this._dic.get(key);
            this.musicSource.volume = this._musicVolume;
            this.musicSource.play();
            this._curMusicPath = $name;
            return;
        } else {
            this.dic_loading.set(key, 1);
            bundle.load($name, AudioClip, (err, res) => {
                // 失败也要清除加载标记，允许回到前台或再次进入时重试。
                this.dic_loading.delete(key);
                if (err || !res) {
                    console.error("没有找到声音资源>>>", $name, err);
                    return;
                }
                this._dic.set(key, res);
                if (!this._backgroundMusicRequested || !this._isMusic || this._curMusicPath !== key) return;
                this.musicSource.clip = res;
                this.musicSource.volume = this._musicVolume;
                this.musicSource.play();
                this._curMusicPath = $name;
            });
        }
    }

    /**播放音频（单次播放，互不干涉） */
    playMusic($name: string = this._curMusicPath, bundle: AssetManager.Bundle = uiMgr.resBundle) {
        if (!this._isMusic || !bundle) {
            return;
        }
        let key = $name;
        if (this.dic_loading.has(key)) {
            return;
        }
        if (this._dic.has(key)) {
            let audio = this.getOneSoundAudio(false);
            audio.clip = this._dic.get(key);
            audio.volume = this._musicVolume;
            audio.play();
            return;
        } else {
            this.dic_loading.set(key, 1);
            bundle.load($name, AudioClip, (err, res) => {
                if (!res) {
                    console.error("没有找到声音资源>>>", $name);
                    return;
                }
                this.dic_loading.delete(key);
                this._dic.set(key, res);
                //获取一个音频组件并打断所有语音
                let audio = this.getOneSoundAudio(false);
                audio.clip = res;
                audio.volume = this._musicVolume;
                audio.play();
            });
        }
    }

    /**播放音频时打断上一个（适用于语音）*/
    playOnceMusic($name: string, bundle: AssetManager.Bundle = uiMgr.resBundle) {
        if (!this._isMusic || !bundle) {
            return;
        }
        let key = $name;
        if (this.dic_loading.has(key)) {
            return;
        }
        if (this._dic.has(key)) {
            let audio = this.getOneSoundAudio();
            audio.clip = this._dic.get(key);
            audio.volume = this._musicVolume;
            audio.play();
            return;
        } else {
            this.dic_loading.set(key, 1);
            bundle.load($name, AudioClip, (err, res) => {
                if (!res) {
                    console.error("没有找到声音资源>>>", $name);
                    return;
                }
                this.dic_loading.delete(key);
                this._dic.set(key, res);
                //获取一个音频组件并打断所有语音
                let audio = this.getOneSoundAudio();
                audio.clip = res;
                audio.volume = this._musicVolume;
                audio.play();
            });
        }
    }
}
export let audioMgr = new audioManager();
