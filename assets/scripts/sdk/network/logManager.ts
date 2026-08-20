interface LogMessage {
    type: "log";
    data: {
        name: string;
        time: number;
        log: Record<string, any>;
    };
}

interface LogConnectionConfig {
    websocketUrl: string;
    gameId: number;
    uid: number;
    token: string;
}

/**桃子游戏日志 WebSocket 管理器 */
export class logManager {
    private socket: WebSocket = null;
    private config: LogConnectionConfig = null;
    private reconnectTimer: ReturnType<typeof setTimeout> = null;
    private pendingMessages: LogMessage[] = [];
    private isClosed = false;

    /**使用登录接口返回的信息初始化日志连接 */
    init(websocketUrl: string, gameId: number, uid: number, token: string) {
        if (!websocketUrl || !gameId || !uid || !token) {
            console.warn("日志 WebSocket 初始化参数不完整");
            return;
        }

        let nextConfig: LogConnectionConfig = {
            websocketUrl,
            gameId,
            uid,
            token,
        };
        let isUserChanged = !!this.config
            && (this.config.gameId != gameId || this.config.uid != uid || this.config.token != token);

        this.clearReconnectTimer();
        this.closeSocket();
        if (isUserChanged) {
            this.pendingMessages.length = 0;
        }
        this.config = nextConfig;
        this.isClosed = false;
        this.connect();
    }

    /**上报一条业务日志 */
    report(name: string, log: Record<string, any>) {
        let message: LogMessage = {
            type: "log",
            data: {
                name,
                time: Math.floor(Date.now() / 1000),
                log,
            },
        };

        if (!this.trySend(message)) {
            this.pendingMessages.push(message);
            if (this.pendingMessages.length > 100) {
                this.pendingMessages.shift();
            }
            this.connect();
        }
    }

    /**主动关闭日志连接 */
    close() {
        this.isClosed = true;
        this.clearReconnectTimer();
        this.closeSocket();
    }

    private connect() {
        if (this.isClosed || !this.config || this.socket) {
            return;
        }
        if (typeof WebSocket == "undefined") {
            console.warn("当前环境不支持 WebSocket 日志上报");
            return;
        }

        let socket: WebSocket;
        try {
            socket = new WebSocket(this.getConnectionUrl());
        } catch (error) {
            console.error("创建日志 WebSocket 失败", error);
            this.scheduleReconnect();
            return;
        }

        this.socket = socket;
        socket.onopen = () => {
            if (this.socket != socket) {
                return;
            }
            this.clearReconnectTimer();
            this.flushPendingMessages();
        };
        socket.onmessage = (event: MessageEvent) => {
            if (this.socket != socket) {
                return;
            }
            this.handleMessage(event.data);
        };
        socket.onerror = (event: Event) => {
            if (this.socket != socket) {
                return;
            }
            console.warn("日志 WebSocket 连接异常", event);
            this.socket = null;
            try {
                socket.close();
            } catch (error) {
                console.warn("关闭异常日志 WebSocket 失败", error);
            }
            this.scheduleReconnect();
        };
        socket.onclose = () => {
            if (this.socket != socket) {
                return;
            }
            this.socket = null;
            this.scheduleReconnect();
        };
    }

    private getConnectionUrl() {
        let url = this.config.websocketUrl;
        let separator = url.indexOf("?") >= 0 ? "&" : (url.endsWith("/") ? "?" : "/?");
        return url + separator
            + "game_id=" + encodeURIComponent(this.config.gameId.toString())
            + "&uid=" + encodeURIComponent(this.config.uid.toString())
            + "&token=" + encodeURIComponent(this.config.token);
    }

    private handleMessage(data: any) {
        let message = data;
        if (typeof data == "string") {
            try {
                message = JSON.parse(data);
            } catch (error) {
                return;
            }
        }

        if (message?.type == "ping") {
            this.sendRaw({ type: "ping" });
        }
    }

    private trySend(message: LogMessage) {
        return this.sendRaw(message);
    }

    private sendRaw(message: any) {
        if (!this.socket || this.socket.readyState != WebSocket.OPEN) {
            return false;
        }

        try {
            this.socket.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.warn("发送日志 WebSocket 消息失败", error);
            return false;
        }
    }

    private flushPendingMessages() {
        while (this.pendingMessages.length > 0) {
            if (!this.trySend(this.pendingMessages[0])) {
                return;
            }
            this.pendingMessages.shift();
        }
    }

    private scheduleReconnect() {
        if (this.isClosed || !this.config || this.reconnectTimer) {
            return;
        }
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 3000);
    }

    private clearReconnectTimer() {
        if (!this.reconnectTimer) {
            return;
        }
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }

    private closeSocket() {
        let socket = this.socket;
        this.socket = null;
        if (!socket) {
            return;
        }
        try {
            socket.close();
        } catch (error) {
            console.warn("关闭日志 WebSocket 失败", error);
        }
    }
}

export const logMgr = new logManager();
